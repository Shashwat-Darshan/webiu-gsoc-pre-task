import type { Octokit } from "@octokit/rest";
import {
  DataQuality,
  GitHubRepoRef,
  GitHubRepositoryError,
  GitHubRepositoryResult,
  RecentCommit,
  RepositoryMetrics,
  RepositoryStats
} from "../models/repo.model";
import { parseGitHubRepoUrl } from "../utils/repo-url";

export interface GitHubServiceOptions {
  defaultToken?: string;
  requestTimeoutMs: number;
  concurrencyLimit: number;
  rateLimitStopThreshold: number;
  treeTimeoutMs?: number;
}

interface ServiceState {
  rateLimitStop: boolean;
}

interface TreeMetrics {
  fileCount: number;
  folderDepth: number;
  hasDependencyFile: boolean;
  usedFallback: boolean;
}

type LimitFunction = <T>(task: () => Promise<T>) => Promise<T>;
type OctokitConstructor = typeof import("@octokit/rest").Octokit;

function estimateFileCountFromSizeKb(sizeKb: number): number {
  return Math.max(1, Math.floor(sizeKb / 4.5));
}

function createLimiter(concurrency: number): LimitFunction {
  const maxConcurrency = Math.max(1, concurrency);
  let activeCount = 0;
  const queue: Array<() => void> = [];

  const runNext = (): void => {
    if (activeCount >= maxConcurrency) {
      return;
    }

    const next = queue.shift();

    if (!next) {
      return;
    }

    activeCount += 1;
    next();
  };

  return async function limit<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const execute = (): void => {
        void task()
          .then(resolve, reject)
          .finally(() => {
            activeCount -= 1;
            runNext();
          });
      };

      queue.push(execute);
      runNext();
    });
  };
}

async function loadOctokitConstructor(): Promise<OctokitConstructor> {
  const dynamicImport = new Function(
    'return import("@octokit/rest")'
  ) as () => Promise<{ Octokit: OctokitConstructor }>;
  const module = await dynamicImport();

  return module.Octokit;
}

const DEPENDENCY_FILES = new Set([
  "package.json",
  "requirements.txt",
  "pipfile",
  "pom.xml",
  "build.gradle",
  "gemfile",
  "go.mod",
  "cargo.toml",
  "composer.json"
]);

const TREE_IGNORE_PATTERNS = [
  /^node_modules\//i,
  /^vendor\//i,
  /^dist\//i,
  /^build\//i,
  /^out\//i,
  /^coverage\//i,
  /^\.next\//i,
  /^\.nuxt\//i,
  /^target\//i,
  /^docs\//i,
  /^doc\//i,
  /\.min\.(js|css)$/i,
  /(^|\/)package-lock\.json$/i,
  /(^|\/)yarn\.lock$/i,
  /(^|\/)pnpm-lock\.yaml$/i,
  /(^|\/)bun\.lockb$/i,
  /\.md$/i
];

export class GitHubService {
  private readonly requestLimiter: LimitFunction;
  private readonly searchRequestLimiter: LimitFunction;
  private readonly options: GitHubServiceOptions;
  private readonly state: ServiceState = { rateLimitStop: false };

  constructor(options: GitHubServiceOptions) {
    this.options = options;
    this.requestLimiter = createLimiter(options.concurrencyLimit);
    this.searchRequestLimiter = createLimiter(1);
  }

  async fetchMany(repoUrls: string[], token?: string): Promise<GitHubRepositoryResult[]> {
    this.state.rateLimitStop = false;

    const octokit = await this.createClient(token);

    const jobs = repoUrls.map((repoUrl) => this.fetchOne(octokit, repoUrl));

    return Promise.all(jobs);
  }

  private async createClient(token?: string): Promise<Octokit> {
    const authToken = token ?? this.options.defaultToken;
    const Octokit = await loadOctokitConstructor();

    return new Octokit({
      auth: authToken,
      request: {
        timeout: this.options.requestTimeoutMs
      }
    });
  }

  private async fetchOne(octokit: Octokit, repoUrl: string): Promise<GitHubRepositoryResult> {
    if (this.state.rateLimitStop) {
      return this.toErrorResult(
        {
          repo: this.safeRepoName(repoUrl),
          url: repoUrl,
          error: "Skipped due to low remaining GitHub API budget",
          dataQuality: "unavailable",
          rateLimited: true
        },
        undefined
      );
    }

    let repoRef: GitHubRepoRef;

    try {
      repoRef = parseGitHubRepoUrl(repoUrl);
    } catch (error) {
      return this.toErrorResult(
        {
          repo: this.safeRepoName(repoUrl),
          url: repoUrl,
          error: error instanceof Error ? error.message : "Invalid repository URL",
          dataQuality: "unavailable"
        },
        undefined
      );
    }

    try {
      const stats = await this.fetchRepositoryStats(octokit, repoRef);

      const [
        languagesResult,
        commitsResult,
        contributorsResult,
        closedIssuesResult,
        goodFirstResult,
        releasesResult,
        treeResult,
        communityHealthResult
      ] =
        await Promise.allSettled([
          this.fetchLanguages(octokit, repoRef),
          this.fetchRecentCommitHistory(octokit, repoRef),
          this.fetchContributorsCount(octokit, repoRef),
          this.fetchClosedIssuesLast90d(octokit, repoRef),
          this.fetchGoodFirstIssues(octokit, repoRef),
          this.fetchReleasesLastYear(octokit, repoRef),
          this.fetchTreeMetrics(octokit, repoRef, stats.defaultBranch, stats.sizeKb),
          this.fetchCommunityHealth(octokit, repoRef)
        ]);

      const qualityFlags: string[] = [];

      if (goodFirstResult.status !== "fulfilled") {
        qualityFlags.push("search");
      }

      if (treeResult.status !== "fulfilled") {
        qualityFlags.push("tree");
      } else if (treeResult.value.usedFallback) {
        qualityFlags.push("tree");
      }

      if (communityHealthResult.status !== "fulfilled") {
        qualityFlags.push("community");
      }

      const dataQuality = this.buildDataQuality(qualityFlags);

      const languages = languagesResult.status === "fulfilled" ? languagesResult.value : {};
      const recentCommits = commitsResult.status === "fulfilled" ? commitsResult.value : [];
      const treeMetrics =
        treeResult.status === "fulfilled"
          ? treeResult.value
          : {
              fileCount: 0,
              folderDepth: 0,
              hasDependencyFile: false,
              usedFallback: true
            };

      const closedIssuesLast90d = closedIssuesResult.status === "fulfilled" ? closedIssuesResult.value : 0;
      const issueClosureRate = this.computeIssueClosureRate(closedIssuesLast90d, stats.openIssues);

      const metrics: RepositoryMetrics = {
        contributorsCount: contributorsResult.status === "fulfilled" ? contributorsResult.value : 0,
        commitsLast90d: recentCommits.length,
        closedIssuesLast90d,
        issueClosureRate,
        goodFirstIssuesCount: goodFirstResult.status === "fulfilled" ? goodFirstResult.value : 0,
        healthPercentage: communityHealthResult.status === "fulfilled" ? communityHealthResult.value : 0,
        releasesLastYear: releasesResult.status === "fulfilled" ? releasesResult.value : 0,
        daysSinceLastCommit: this.computeDaysSince(stats.pushedAt),
        fileCount: treeMetrics.fileCount,
        folderDepth: treeMetrics.folderDepth,
        hasDependencyFile: treeMetrics.hasDependencyFile,
        languageCount: Object.keys(languages).length
      };

      return {
        ok: true,
        data: {
          repo: repoRef,
          stats,
          metrics,
          languages,
          recentCommits,
          dataQuality
        }
      };
    } catch (error) {
      return this.toErrorResult(
        {
          repo: repoRef.fullName,
          url: repoRef.url,
          error: this.buildErrorMessage(error),
          dataQuality: "unavailable"
        },
        error
      );
    }
  }

  private async fetchRepositoryStats(octokit: Octokit, repo: GitHubRepoRef): Promise<RepositoryStats> {
    const response = await this.safeRequest(() =>
      octokit.repos.get({
        owner: repo.owner,
        repo: repo.name
      })
    );

    const payload = response.data;

    return {
      stars: payload.stargazers_count,
      forks: payload.forks_count,
      openIssues: payload.open_issues_count,
      primaryLanguage: payload.language,
      sizeKb: payload.size,
      pushedAt: payload.pushed_at,
      defaultBranch: payload.default_branch
    };
  }

  private async fetchLanguages(octokit: Octokit, repo: GitHubRepoRef): Promise<Record<string, number>> {
    const response = await this.safeRequest(() =>
      octokit.repos.listLanguages({
        owner: repo.owner,
        repo: repo.name
      })
    );

    const languageBytes = response.data as Record<string, number>;
    const total = Object.values(languageBytes).reduce((sum, value) => sum + value, 0);

    if (total <= 0) {
      return {};
    }

    const percentages: Record<string, number> = {};

    for (const [language, bytes] of Object.entries(languageBytes)) {
      percentages[language] = Number(((bytes / total) * 100).toFixed(2));
    }

    return percentages;
  }

  private async fetchRecentCommitHistory(
    octokit: Octokit,
    repo: GitHubRepoRef
  ): Promise<RecentCommit[]> {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - 90);

    const commits: RecentCommit[] = [];

    for (let page = 1; page <= 3; page += 1) {
      const response = await this.safeRequest(() =>
        octokit.repos.listCommits({
          owner: repo.owner,
          repo: repo.name,
          since: sinceDate.toISOString(),
          per_page: 100,
          page
        })
      );

      const mapped = response.data.map((commit) => ({
        sha: commit.sha,
        message: commit.commit.message,
        author: commit.commit.author?.name ?? null,
        date: commit.commit.author?.date ?? null
      }));

      commits.push(...mapped);

      if (response.data.length < 100) {
        break;
      }
    }

    return commits;
  }

  private async fetchContributorsCount(octokit: Octokit, repo: GitHubRepoRef): Promise<number> {
    const response = await this.safeRequest(() =>
      octokit.repos.listContributors({
        owner: repo.owner,
        repo: repo.name,
        per_page: 1,
        page: 1,
        anon: "true"
      })
    );

    const linkHeader = response.headers.link;
    const derivedFromLink = this.extractTotalFromLinkHeader(linkHeader);

    if (derivedFromLink !== null) {
      return derivedFromLink;
    }

    if (response.data.length === 0) {
      return 0;
    }

    if (response.data.length === 1) {
      // Some intermediaries strip Link headers; probe page 2 to avoid falsely reporting 1.
      try {
        const secondPage = await this.safeRequest(() =>
          octokit.repos.listContributors({
            owner: repo.owner,
            repo: repo.name,
            per_page: 1,
            page: 2,
            anon: "true"
          })
        );

        return secondPage.data.length > 0 ? 2 : 1;
      } catch {
        return 1;
      }
    }

    return response.data.length;
  }

  private async fetchClosedIssuesLast90d(octokit: Octokit, repo: GitHubRepoRef): Promise<number> {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - 90);

    let total = 0;

    for (let page = 1; page <= 3; page += 1) {
      const response = await this.safeRequest(() =>
        octokit.issues.listForRepo({
          owner: repo.owner,
          repo: repo.name,
          state: "closed",
          since: sinceDate.toISOString(),
          per_page: 100,
          page
        })
      );

      const issueCount = response.data.filter((item) => !item.pull_request).length;
      total += issueCount;

      if (response.data.length < 100) {
        break;
      }
    }

    return total;
  }

  private async fetchGoodFirstIssues(octokit: Octokit, repo: GitHubRepoRef): Promise<number> {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - 90);
    const q = `repo:${repo.fullName} is:issue is:open label:"good first issue" updated:>${sinceDate.toISOString().slice(0, 10)}`;

    // Search endpoint gets its own limiter to reduce secondary-rate-limit bursts.
    const response = await this.searchRequestLimiter(() =>
      this.safeRequest(() =>
        octokit.search.issuesAndPullRequests({
          q,
          per_page: 1
        })
      )
    );

    return response.data.total_count || 0;
  }

  private async fetchReleasesLastYear(octokit: Octokit, repo: GitHubRepoRef): Promise<number> {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const response = await this.safeRequest(() =>
      octokit.repos.listReleases({
        owner: repo.owner,
        repo: repo.name,
        per_page: 100,
        page: 1
      })
    );

    return response.data.filter((release) => {
      if (!release.published_at) {
        return false;
      }

      return new Date(release.published_at) >= oneYearAgo;
    }).length;
  }

  private async fetchTreeMetrics(
    octokit: Octokit,
    repo: GitHubRepoRef,
    branch: string,
    sizeKb: number
  ): Promise<TreeMetrics> {
    if (sizeKb >= 500000) {
      return {
        fileCount: estimateFileCountFromSizeKb(sizeKb),
        folderDepth: 6,
        hasDependencyFile: true,
        usedFallback: true
      };
    }

    let response: Awaited<ReturnType<Octokit["git"]["getTree"]>>;

    try {
      response = await this.withTimeout(
        this.safeRequest(() =>
          octokit.git.getTree({
            owner: repo.owner,
            repo: repo.name,
            tree_sha: branch,
            recursive: "true"
          })
        ),
        this.options.treeTimeoutMs ?? 3000
      );
    } catch {
      return {
        fileCount: estimateFileCountFromSizeKb(sizeKb),
        folderDepth: 6,
        hasDependencyFile: true,
        usedFallback: true
      };
    }

    const blobs = response.data.tree.filter((item) => item.type === "blob" && Boolean(item.path));
    const relevantBlobs = blobs.filter((item) => !this.isIgnoredPath(item.path ?? ""));

    const folderDepth = relevantBlobs.reduce((maxDepth, item) => {
      const path = item.path ?? "";
      const depth = path.split("/").length;
      return depth > maxDepth ? depth : maxDepth;
    }, 0);

    const hasDependencyFile = relevantBlobs.some((item) => {
      const path = (item.path ?? "").toLowerCase();
      const fileName = path.split("/").pop() ?? "";
      const normalized = fileName === "pipfile.lock" ? "pipfile" : fileName;
      return DEPENDENCY_FILES.has(normalized) || normalized.endsWith(".csproj");
    });

    return {
      fileCount: relevantBlobs.length,
      folderDepth,
      hasDependencyFile,
      usedFallback: false
    };
  }

  private async fetchCommunityHealth(octokit: Octokit, repo: GitHubRepoRef): Promise<number> {
    const response = await this.safeRequest(() =>
      octokit.repos.getCommunityProfileMetrics({
        owner: repo.owner,
        repo: repo.name
      })
    );

    return Math.round(response.data.health_percentage ?? 0);
  }

  private isIgnoredPath(path: string): boolean {
    const normalized = path.replace(/\\/g, "/").toLowerCase();
    return TREE_IGNORE_PATTERNS.some((pattern) => pattern.test(normalized));
  }

  private buildDataQuality(qualityFlags: string[]): DataQuality {
    const uniqueFlags = [...new Set(qualityFlags)];

    if (uniqueFlags.length === 0) {
      return "complete";
    }

    const hasSearch = uniqueFlags.includes("search");
    const hasTree = uniqueFlags.includes("tree");

    if (hasSearch && hasTree) {
      return "degraded";
    }

    if (hasSearch) {
      return "partial_search";
    }

    if (hasTree) {
      return "partial_tree";
    }

    return "partial";
  }

  private computeIssueClosureRate(closedIssuesLast90d: number, openIssues: number): number {
    const denominator = closedIssuesLast90d + Math.max(0, openIssues);

    if (denominator <= 0) {
      return 0;
    }

    return Number((closedIssuesLast90d / denominator).toFixed(4));
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  private extractTotalFromLinkHeader(linkHeader: string | undefined): number | null {
    if (!linkHeader) {
      return null;
    }

    const lastMatch = /[?&]page=(\d+)[^>]*>;\s*rel="last"/i.exec(linkHeader);

    if (lastMatch) {
      const parsed = Number(lastMatch[1]);
      return Number.isFinite(parsed) ? parsed : null;
    }

    const nextMatch = /[?&]page=(\d+)[^>]*>;\s*rel="next"/i.exec(linkHeader);

    if (nextMatch) {
      return 2;
    }

    return null;
  }

  private computeDaysSince(isoDate: string | null): number {
    if (!isoDate) {
      return 365;
    }

    const date = new Date(isoDate);

    if (Number.isNaN(date.getTime())) {
      return 365;
    }

    const diffMs = Date.now() - date.getTime();
    const oneDayMs = 1000 * 60 * 60 * 24;

    return Math.max(0, Math.floor(diffMs / oneDayMs));
  }

  private async safeRequest<T>(fn: () => Promise<T>): Promise<T> {
    try {
      const response = await this.requestLimiter(async () => fn());
      this.trackRateLimit(response);
      return response;
    } catch (error) {
      this.trackRateLimit(error);
      throw error;
    }
  }

  private trackRateLimit(source: unknown): void {
    const headers = this.extractHeaders(source);

    if (!headers) {
      return;
    }

    const remainingRaw = headers["x-ratelimit-remaining"];
    const remaining = remainingRaw ? Number(remainingRaw) : NaN;

    if (Number.isFinite(remaining) && remaining <= this.options.rateLimitStopThreshold) {
      this.state.rateLimitStop = true;
    }
  }

  private extractHeaders(source: unknown): Record<string, string | undefined> | null {
    if (!source || typeof source !== "object") {
      return null;
    }

    const candidate = source as {
      headers?: Record<string, string | undefined>;
      response?: { headers?: Record<string, string | undefined> };
    };

    return candidate.headers ?? candidate.response?.headers ?? null;
  }

  private buildErrorMessage(error: unknown): string {
    if (!error || typeof error !== "object") {
      return "Unexpected GitHub API error";
    }

    const maybeError = error as {
      status?: number;
      message?: string;
      response?: {
        data?: {
          message?: string;
        };
      };
    };

    const message = maybeError.response?.data?.message ?? maybeError.message;

    if (maybeError.status === 404) {
      return "Repository not found or private";
    }

    if (maybeError.status === 403 && message?.toLowerCase().includes("rate limit")) {
      return "GitHub rate limit exhausted. Provide a token or retry later.";
    }

    return message ?? "Unexpected GitHub API error";
  }

  private toErrorResult(base: GitHubRepositoryError, error: unknown): GitHubRepositoryResult {
    const statusCode = this.extractStatusCode(error);
    const rateLimited = this.isRateLimited(error);

    return {
      ok: false,
      error: {
        ...base,
        statusCode,
        rateLimited: base.rateLimited ?? rateLimited
      }
    };
  }

  private extractStatusCode(error: unknown): number | undefined {
    if (!error || typeof error !== "object") {
      return undefined;
    }

    const maybeError = error as { status?: number };
    return maybeError.status;
  }

  private isRateLimited(error: unknown): boolean {
    if (!error || typeof error !== "object") {
      return false;
    }

    const maybeError = error as {
      status?: number;
      message?: string;
      response?: { data?: { message?: string } };
    };

    const message = (maybeError.response?.data?.message ?? maybeError.message ?? "").toLowerCase();

    return maybeError.status === 403 && message.includes("rate limit");
  }

  private safeRepoName(repoUrl: string): string {
    try {
      const parsed = parseGitHubRepoUrl(repoUrl);
      return parsed.fullName;
    } catch {
      return repoUrl;
    }
  }
}

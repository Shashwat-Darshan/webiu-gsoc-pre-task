import { GitHubRepoRef } from "../models/repo.model";

const GITHUB_REPO_URL_PATTERN = /^https:\/\/github\.com\/([^\s/]+)\/([^\s/]+)\/?$/i;

export function parseGitHubRepoUrl(url: string): GitHubRepoRef {
  const trimmed = url.trim();
  const match = GITHUB_REPO_URL_PATTERN.exec(trimmed);

  if (!match) {
    throw new Error("Invalid GitHub repository URL. Expected format: https://github.com/owner/repo");
  }

  const owner = match[1];
  const repo = match[2].replace(/\.git$/i, "");

  if (!owner || !repo) {
    throw new Error("Invalid GitHub repository URL. Owner and repo are required.");
  }

  return {
    owner,
    name: repo,
    fullName: `${owner}/${repo}`,
    url: `https://github.com/${owner}/${repo}`
  };
}

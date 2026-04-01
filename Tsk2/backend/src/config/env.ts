import dotenv from "dotenv";

dotenv.config();

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const env = {
  port: parseNumber(process.env.PORT, 8000),
  githubToken: process.env.GITHUB_TOKEN,
  githubRequestTimeoutMs: parseNumber(process.env.GITHUB_REQUEST_TIMEOUT_MS, 15000),
  githubTreeTimeoutMs: parseNumber(process.env.GITHUB_TREE_TIMEOUT_MS, 3000),
  githubCacheTtlMs: Math.max(0, parseNumber(process.env.GITHUB_CACHE_TTL_MS, 300000)),
  githubCacheMaxEntries: Math.max(10, parseNumber(process.env.GITHUB_CACHE_MAX_ENTRIES, 500)),
  githubConcurrencyLimit: Math.max(1, parseNumber(process.env.GITHUB_CONCURRENCY_LIMIT, 5)),
  githubRateLimitStopThreshold: Math.max(
    1,
    parseNumber(process.env.GITHUB_RATE_LIMIT_STOP_THRESHOLD, 50)
  )
};

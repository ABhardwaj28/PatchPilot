export interface GitHubIssueLabel {
  id: number | string;
  name: string;
  color: string;
  description?: string | null;
}

export interface GitHubIssueAuthor {
  login: string;
  avatarUrl: string;
  htmlUrl: string;
}

export interface GitHubRepoSummary {
  fullName: string;
  description: string | null;
  isPrivate: boolean;
  starsCount: number;
  forksCount: number;
  openIssuesCount: number;
  defaultBranch: string;
  language: string | null;
  htmlUrl: string;
}

export interface GitHubIssueMetadata {
  owner: string;
  repo: string;
  issueNumber: number;
  title: string;
  state: "open" | "closed";
  bodyExcerpt: string;
  fullBody: string;
  htmlUrl: string;
  createdAt: string;
  updatedAt: string;
  commentsCount: number;
  author: GitHubIssueAuthor;
  labels: GitHubIssueLabel[];
  repository: GitHubRepoSummary;
}

export interface GitHubRateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: string;
  isLow: boolean;
}

export type GitHubApiErrorCode =
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "UNAUTHORIZED"
  | "TIMEOUT"
  | "FORBIDDEN"
  | "PULL_REQUEST_NOT_SUPPORTED"
  | "SERVER_ERROR"
  | "NETWORK_ERROR"
  | "INVALID_RESPONSE";

export type GitHubIssueResult =
  | {
      success: true;
      data: GitHubIssueMetadata;
      rateLimit?: GitHubRateLimitInfo;
    }
  | {
      success: false;
      error: string;
      code: GitHubApiErrorCode;
      status?: number;
      rateLimit?: GitHubRateLimitInfo;
    };

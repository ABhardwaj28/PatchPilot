/**
 * Server-side sliding-window rate limiter for Next.js route handlers.
 * Mitigates denial-of-service, API credential exhaustion, and brute-force attempts.
 */

export interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
}

export interface RateLimitStatus {
  isLimited: boolean;
  remaining: number;
  limit: number;
  resetSeconds: number;
  retryAfterSeconds: number;
}

export class SlidingWindowRateLimiter {
  private readonly history = new Map<string, number[]>();
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private lastCleanup = Date.now();

  constructor(options: RateLimiterOptions) {
    this.windowMs = options.windowMs;
    this.maxRequests = options.maxRequests;
  }

  /**
   * Checks whether the given key (e.g. client IP) has exceeded the rate limit.
   */
  public check(key: string): RateLimitStatus {
    const now = Date.now();
    this.cleanup(now);

    const timestamps = this.history.get(key) || [];
    const validTimestamps = timestamps.filter((t) => now - t < this.windowMs);

    const isLimited = validTimestamps.length >= this.maxRequests;

    if (!isLimited) {
      validTimestamps.push(now);
      this.history.set(key, validTimestamps);
    }

    const remaining = Math.max(0, this.maxRequests - validTimestamps.length);
    const oldest = validTimestamps[0] || now;
    const resetTime = oldest + this.windowMs;
    const retryAfterSeconds = Math.max(1, Math.ceil((resetTime - now) / 1000));

    return {
      isLimited,
      remaining,
      limit: this.maxRequests,
      resetSeconds: retryAfterSeconds,
      retryAfterSeconds: isLimited ? retryAfterSeconds : 0,
    };
  }

  /**
   * Resets the rate limit record for a specific key (useful in tests).
   */
  public reset(key?: string): void {
    if (key) {
      this.history.delete(key);
    } else {
      this.history.clear();
    }
  }

  /**
   * Prunes keys that haven't been active in more than 2 windows.
   */
  private cleanup(now: number): void {
    if (now - this.lastCleanup < this.windowMs) {
      return;
    }
    this.lastCleanup = now;
    for (const [key, timestamps] of this.history.entries()) {
      const active = timestamps.filter((t) => now - t < this.windowMs);
      if (active.length === 0) {
        this.history.delete(key);
      } else {
        this.history.set(key, active);
      }
    }
  }
}

/**
 * Creates standard HTTP headers for rate-limit reporting.
 */
export function getRateLimitHeaders(status: RateLimitStatus): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": status.limit.toString(),
    "X-RateLimit-Remaining": status.remaining.toString(),
    "X-RateLimit-Reset": status.resetSeconds.toString(),
  };

  if (status.isLimited) {
    headers["Retry-After"] = status.retryAfterSeconds.toString();
  }

  return headers;
}

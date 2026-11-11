import { describe, it, expect, beforeEach } from "vitest";
import { SlidingWindowRateLimiter, getRateLimitHeaders } from "@/lib/security/rate-limiter";

describe("Stage 7: Sliding Window Rate Limiter", () => {
  let limiter: SlidingWindowRateLimiter;

  beforeEach(() => {
    limiter = new SlidingWindowRateLimiter({
      windowMs: 1000,
      maxRequests: 3,
    });
  });

  it("permits requests within quota and decrements remaining count", () => {
    const res1 = limiter.check("ip-1");
    expect(res1.isLimited).toBe(false);
    expect(res1.remaining).toBe(2);

    const res2 = limiter.check("ip-1");
    expect(res2.isLimited).toBe(false);
    expect(res2.remaining).toBe(1);

    const res3 = limiter.check("ip-1");
    expect(res3.isLimited).toBe(false);
    expect(res3.remaining).toBe(0);
  });

  it("blocks requests once the threshold is exceeded", () => {
    limiter.check("ip-2");
    limiter.check("ip-2");
    limiter.check("ip-2");

    const resBlocked = limiter.check("ip-2");
    expect(resBlocked.isLimited).toBe(true);
    expect(resBlocked.remaining).toBe(0);
    expect(resBlocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it("tracks different keys independently", () => {
    limiter.check("client-a");
    limiter.check("client-a");
    limiter.check("client-a");

    expect(limiter.check("client-a").isLimited).toBe(true);
    expect(limiter.check("client-b").isLimited).toBe(false);
  });

  it("generates correct HTTP rate limit headers", () => {
    const allowedStatus = {
      isLimited: false,
      remaining: 5,
      limit: 10,
      resetSeconds: 60,
      retryAfterSeconds: 0,
    };

    const allowedHeaders = getRateLimitHeaders(allowedStatus);
    expect(allowedHeaders["X-RateLimit-Limit"]).toBe("10");
    expect(allowedHeaders["X-RateLimit-Remaining"]).toBe("5");
    expect(allowedHeaders["X-RateLimit-Reset"]).toBe("60");
    expect(allowedHeaders["Retry-After"]).toBeUndefined();

    const blockedStatus = {
      isLimited: true,
      remaining: 0,
      limit: 10,
      resetSeconds: 45,
      retryAfterSeconds: 45,
    };

    const blockedHeaders = getRateLimitHeaders(blockedStatus);
    expect(blockedHeaders["Retry-After"]).toBe("45");
  });

  it("resets limits when explicitly requested", () => {
    limiter.check("reset-ip");
    limiter.check("reset-ip");
    limiter.check("reset-ip");
    expect(limiter.check("reset-ip").isLimited).toBe(true);

    limiter.reset("reset-ip");
    expect(limiter.check("reset-ip").isLimited).toBe(false);
  });
});

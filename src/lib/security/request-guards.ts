export type RateLimitResult = {
  ok: boolean;
  retryAfterSeconds?: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

export class MemoryRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  check(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
    const bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      this.cleanup(now);
      return { ok: true };
    }

    if (bucket.count >= limit) {
      return {
        ok: false,
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
      };
    }

    bucket.count += 1;
    return { ok: true };
  }

  private cleanup(now: number) {
    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}

export function isUnsafeMethod(method: string): boolean {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

export function isSameOriginRequest(requestUrl: string, origin: string | null, fetchSite: string | null): boolean {
  if (fetchSite === "cross-site") return false;
  if (!origin) return true;
  try {
    const originUrl = new URL(origin);
    const targetUrl = new URL(requestUrl);
    if (originUrl.origin === targetUrl.origin) return true;

    const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
    return localHosts.has(originUrl.hostname)
      && localHosts.has(targetUrl.hostname)
      && originUrl.port === targetUrl.port
      && originUrl.protocol === targetUrl.protocol;
  } catch {
    return false;
  }
}

export function clientIpFromHeaders(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || headers.get("x-real-ip")
    || "unknown";
}

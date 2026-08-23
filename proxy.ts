import { NextResponse, type NextRequest } from "next/server";
import { clientIpFromHeaders, isSameOriginRequest, isUnsafeMethod, MemoryRateLimiter } from "@/lib/security/request-guards";

const limiter = new MemoryRateLimiter();

const rules = [
  { prefix: "/api/auth/login", limit: 10, windowMs: 60_000 },
  { prefix: "/api/auth/register", limit: 5, windowMs: 60_000 },
  { prefix: "/api/invoices/", suffix: "/pdf", limit: 30, windowMs: 60_000 },
  { prefix: "/api/reports/", limit: 20, windowMs: 60_000 },
  { prefix: "/api/", limit: 120, windowMs: 60_000 }
];

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    if (isUnsafeMethod(request.method) && !isSameOriginRequest(
      request.url,
      request.headers.get("origin"),
      request.headers.get("sec-fetch-site")
    )) {
      return Response.json({ ok: false, error: "Cross-origin requests are not allowed." }, { status: 403 });
    }

    const rule = rules.find((candidate) => {
      const prefixMatch = request.nextUrl.pathname.startsWith(candidate.prefix);
      const suffixMatch = candidate.suffix ? request.nextUrl.pathname.endsWith(candidate.suffix) : true;
      return prefixMatch && suffixMatch;
    });

    if (rule) {
      const ip = clientIpFromHeaders(request.headers);
      const result = limiter.check(`${ip}:${rule.prefix}:${request.method}`, rule.limit, rule.windowMs);
      if (!result.ok) {
        return Response.json(
          { ok: false, error: "Too many requests. Please try again shortly." },
          {
            status: 429,
            headers: { "Retry-After": String(result.retryAfterSeconds ?? 60) }
          }
        );
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*"
};

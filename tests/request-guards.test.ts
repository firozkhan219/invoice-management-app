import { describe, expect, it } from "vitest";
import { isSameOriginRequest, isUnsafeMethod, MemoryRateLimiter } from "@/lib/security/request-guards";

describe("request guards", () => {
  it("identifies unsafe HTTP methods", () => {
    expect(isUnsafeMethod("POST")).toBe(true);
    expect(isUnsafeMethod("DELETE")).toBe(true);
    expect(isUnsafeMethod("GET")).toBe(false);
    expect(isUnsafeMethod("HEAD")).toBe(false);
  });

  it("allows same-origin form posts and rejects cross-origin posts", () => {
    expect(isSameOriginRequest("https://app.example.test/api/invoices", "https://app.example.test", "same-origin")).toBe(true);
    expect(isSameOriginRequest("https://app.example.test/api/invoices", "https://app.example.test", "same-site")).toBe(true);
    expect(isSameOriginRequest("https://app.example.test/api/invoices", "https://evil.example.test", "cross-site")).toBe(false);
  });

  it("allows loopback hostname variations during local development", () => {
    expect(isSameOriginRequest("http://127.0.0.1:3000/api/auth/login", "http://localhost:3000", "same-site")).toBe(true);
    expect(isSameOriginRequest("http://localhost:3000/api/auth/login", "http://127.0.0.1:3000", "same-site")).toBe(true);
    expect(isSameOriginRequest("http://127.0.0.1:3000/api/auth/login", "http://localhost:3001", "same-site")).toBe(false);
  });

  it("allows configured public origin behind a hosting proxy", () => {
    expect(isSameOriginRequest(
      "https://s15175.bom1.stableserver.net:2083/proxied/api/auth/register",
      "https://app.decorativehandicraft.com",
      "same-site",
      ["https://app.decorativehandicraft.com"]
    )).toBe(true);
  });

  it("rate limits within a fixed window", () => {
    const limiter = new MemoryRateLimiter();
    expect(limiter.check("login:1", 2, 60_000, 1000).ok).toBe(true);
    expect(limiter.check("login:1", 2, 60_000, 1001).ok).toBe(true);
    expect(limiter.check("login:1", 2, 60_000, 1002)).toMatchObject({ ok: false });
    expect(limiter.check("login:1", 2, 60_000, 61_001).ok).toBe(true);
  });
});

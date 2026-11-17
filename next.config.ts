import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", experimental: { cpus: 2 },
  poweredByHeader: false,
  allowedDevOrigins: ["127.0.0.1"],
  serverExternalPackages: ["pdfkit"],
  async headers() {
    const contentSecurityPolicy = (frameAncestors: string) =>
      [
        "default-src 'self'",
        "base-uri 'self'",
        `frame-ancestors ${frameAncestors}`,
        "object-src 'none'",
        "form-action 'self'",
        "img-src 'self' data:",
        "style-src 'self' 'unsafe-inline'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "connect-src 'self'"
      ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy("'none'") }
        ]
      },
      {
        // Document PDFs are shown inside the app's own preview frames, so allow same-origin framing.
        // Listed last so these values override the stricter defaults above.
        source: "/api/:kind(invoices|packing-lists|credit-notes)/:id/pdf",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy("'self'") }
        ]
      }
    ];
  }
};

export default nextConfig;

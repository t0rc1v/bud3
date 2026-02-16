import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  // {
  //   key: "Content-Security-Policy",
  //   value: [
  //     "default-src 'self'",
  //     "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://va.vercel-scripts.com https://*.clerk.accounts.dev https://unpkg.com",
  //     "worker-src 'self' blob: https://unpkg.com",
  //     "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  //     "font-src 'self' https://fonts.gstatic.com",
  //     "img-src 'self' blob: data: https://*.clerk.accounts.dev",
  //     "connect-src 'self' https://va.vercel-scripts.com https://*.clerk.accounts.dev https://unpkg.com",
  //     "frame-src 'self' https://*.clerk.accounts.dev",
  //     "frame-ancestors 'none'",
  //     "base-uri 'self'",
  //     "form-action 'self'",
  //   ].join("; "),
  // },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;

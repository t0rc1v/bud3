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
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Clerk requires unsafe-eval for its JS; Vercel analytics
      // clerk.budlm.com = production Clerk custom domain (serves clerk.browser.js)
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://va.vercel-scripts.com https://*.clerk.accounts.dev https://clerk.budlm.com",
      "script-src-elem 'self' 'unsafe-inline' https://va.vercel-scripts.com https://*.clerk.accounts.dev https://clerk.budlm.com",
      "worker-src 'self' blob:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      // Clerk profile images; UploadThing file storage (utfs.io / *.ufs.sh); blob/data for previews
      "img-src 'self' blob: data: https://*.clerk.accounts.dev https://clerk.budlm.com https://utfs.io https://*.ufs.sh",
      // Clerk auth; UploadThing upload endpoints; Vercel analytics
      "connect-src 'self' https://va.vercel-scripts.com https://*.clerk.accounts.dev https://clerk.budlm.com https://uploadthing.com https://*.uploadthing.com https://utfs.io https://*.ufs.sh https://*.ingest.uploadthing.com",
      "frame-src 'self' https://*.clerk.accounts.dev https://clerk.budlm.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.clerk.accounts.dev" },
      { protocol: "https", hostname: "clerk.budlm.com" },
      { protocol: "https", hostname: "utfs.io" },
      { protocol: "https", hostname: "**.ufs.sh" },
    ],
  },
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

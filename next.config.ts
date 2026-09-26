import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  poweredByHeader: false,
  serverExternalPackages: ["@libsql/client", "playwright", "playwright-core", "cheerio"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://accounts.google.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://api.stripe.com https://accounts.google.com https://www.google.com",
              "frame-src https://js.stripe.com https://hooks.stripe.com https://accounts.google.com https://checkout.stripe.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self' https://accounts.google.com https://checkout.stripe.com",
            ].join("; "),
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
      { protocol: "https", hostname: "lh3.googleusercontent.com", pathname: "/**" },
      { protocol: "https", hostname: "*.alicdn.com", pathname: "/**" },
      { protocol: "https", hostname: "ae01.alicdn.com", pathname: "/**" },
      { protocol: "https", hostname: "ae02.alicdn.com", pathname: "/**" },
      { protocol: "https", hostname: "ae03.alicdn.com", pathname: "/**" },
      { protocol: "https", hostname: "ae04.alicdn.com", pathname: "/**" },
    ],
  },
};

export default nextConfig;

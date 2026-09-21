import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: ["@libsql/client", "playwright", "playwright-core", "cheerio"],
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

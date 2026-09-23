import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security/headers";

const nextConfig: NextConfig = {
  output: "standalone",
  async redirects() {
    return [{ source: "/favicon.ico", destination: "/icon.svg", permanent: true }];
  },
  async headers() {
    return [{ source: "/(.*)", headers: Object.entries(securityHeaders()).map(([key, value]) => ({ key, value })) }];
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Ensure API routes run on the Node.js runtime where Clerk server helpers are supported
    typedRoutes: true,
  },
};

export default nextConfig;

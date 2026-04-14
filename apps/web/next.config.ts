import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            // unsafe-eval needed by ReactFlow/d3 and Three.js at runtime
            value: "script-src 'self' 'unsafe-inline' 'unsafe-eval'; object-src 'none';",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

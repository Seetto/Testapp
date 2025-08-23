import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow external access from devices on the same network
  async rewrites() {
    return []
  },
  // Configure hostname for external access
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
        ],
      },
    ]
  },
};

export default nextConfig;

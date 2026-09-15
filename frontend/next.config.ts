import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js blocks development assets requested through a LAN origin unless
  // the origin is explicitly allowed. Keep both currently used networks and
  // the Mac's stable Bonjour hostname available for workstation access.
  allowedDevOrigins: [
    "192.168.1.177",
    "172.20.10.3",
    "Kiattisaks-Laptop.local",
  ],
  async rewrites() {
    return [
      {
        source: "/backend-api/:path*",
        destination: "http://127.0.0.1:3001/:path*",
      },
    ];
  },
};

export default nextConfig;

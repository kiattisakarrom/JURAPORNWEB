import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

export default function nextConfig(phase: string): NextConfig {
  return {
    // Keep development artifacts away from the production build directory.
    // Running `npm run build` while LAN clients use `next dev` must not make
    // Fast Refresh reload every connected workstation.
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
    // Next.js blocks development assets requested through a LAN origin unless
    // the origin is explicitly allowed. Allow the private LAN ranges used by
    // the workstation so a DHCP address change does not break development.
    allowedDevOrigins: [
      "192.168.1.*",
      "172.20.10.*",
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
}

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tree-shake heavy icon + animation libs aggressively. With this, importing
  // a single icon from lucide-react no longer pulls the whole barrel into the
  // client bundle.
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion", "sonner"],
  },
};

export default nextConfig;

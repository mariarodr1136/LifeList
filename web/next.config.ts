import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // The page scans are pre-resized by extract/build_web.py to exactly the sizes
    // the layout asks for, so re-encoding them through the optimizer would cost
    // build time and Vercel image units to produce the same bytes.
    unoptimized: true,
  },
};

export default nextConfig;

import type { NextConfig } from "next";

// GitHub Pages serves plain files: no Next server, no image optimizer, no writes.
// The static build is opt-in so `next dev` and the Vercel deploy keep the review
// queue's write path (see app/api/review), which an export cannot include.
const staticExport = process.env.STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  images: {
    // The page scans are pre-resized by extract/build_web.py to exactly the sizes
    // the layout asks for, so re-encoding them through the optimizer would cost
    // build time and Vercel image units to produce the same bytes.
    unoptimized: true,
  },
  ...(staticExport
    ? {
        output: "export" as const,
        // The site lives under the repository name on github.io.
        basePath: "/LifeList",
        // Pages serves /checklist/index.html, not /checklist.
        trailingSlash: true,
      }
    : {}),
};

export default nextConfig;

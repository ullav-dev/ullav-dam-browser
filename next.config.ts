import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Raise the middleware body-size limit to match the DAM server's 200 MB upload cap.
  // Without this, Next.js truncates request bodies larger than 10 MB before rewriting
  // them to the upstream server (affects /api/zip/upload and /api/assets/upload).
  experimental: {
    middlewareClientMaxBodySize: 200 * 1024 * 1024,
  },
};

export default nextConfig;

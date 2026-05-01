import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { execFileSync } from "child_process";
import { readFileSync } from "fs";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const appVersion: string = JSON.parse(readFileSync("./package.json", "utf-8")).version;
const gitSha: string = (() => {
  try { return execFileSync("git", ["rev-parse", "--short", "HEAD"]).toString().trim(); }
  catch { return "dev"; }
})();

const portalOrigins = process.env.PORTAL_URL
  ? process.env.PORTAL_URL
  : "https://portal.ullav.com http://localhost:3003";

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
    NEXT_PUBLIC_GIT_SHA: gitSha,
  },
  // Raise the middleware body-size limit to match the DAM server's 200 MB upload cap.
  // Without this, Next.js truncates request bodies larger than 10 MB before rewriting
  // them to the upstream server (affects /api/zip/upload and /api/assets/upload).
  experimental: {
    middlewareClientMaxBodySize: 200 * 1024 * 1024,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `frame-ancestors 'self' ${portalOrigins}`,
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);

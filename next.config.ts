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

const nextConfig: NextConfig = {
  output: "standalone",
  // @ullav-dev/tack-notes ships raw TS source with no build step, like
  // @ullav-dev/dam-picker (see awe-client's next.config.ts) -- without this,
  // Next excludes node_modules from transpilation and the build fails.
  transpilePackages: ["@ullav-dev/tack-notes"],
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
};

export default withNextIntl(nextConfig);

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Proxy /api/* → ullav-dam-server (strips /api prefix)
  if (pathname.startsWith("/api/")) {
    const apiUrl = process.env.API_URL ?? "http://localhost:8080";
    return NextResponse.rewrite(
      new URL(pathname.slice("/api".length) + search, apiUrl)
    );
  }

  // Proxy /auth-api/* → ullav-user-management (strips /auth-api prefix)
  if (pathname.startsWith("/auth-api/")) {
    const authUrl = process.env.AUTH_URL ?? "http://localhost:8081";
    return NextResponse.rewrite(
      new URL(pathname.slice("/auth-api".length) + search, authUrl)
    );
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!_next|_vercel|.*\\..*).*)"],
};

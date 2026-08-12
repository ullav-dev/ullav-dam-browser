import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

function route(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;

  // IIIF image requests go to the Next.js route handler, which injects auth and
  // rewrites info.json ids — don't rewrite them to the DAM server here.
  if (pathname.startsWith("/api/iiif/image/")) {
    return NextResponse.next();
  }

  // Proxy /api/tack/* → tack-server (strips /api/tack prefix). Must come
  // before the generic /api/* rule below -- same "browsers call tack-server
  // directly via a same-origin passthrough proxy" pattern as togra's own
  // /api/tack/* rule and cunav's.
  if (pathname.startsWith("/api/tack/")) {
    const tackUrl = process.env.TACK_URL ?? "http://localhost:8087";
    return NextResponse.rewrite(
      new URL(pathname.slice("/api/tack".length) + search, tackUrl)
    );
  }

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

  return intlMiddleware(request) as NextResponse;
}

export function proxy(request: NextRequest) {
  const response = route(request);
  const portalUrl =
    process.env.PORTAL_URL ?? "https://setanta-portal.ullav.com http://localhost:3003";
  response.headers.set("Content-Security-Policy", `frame-ancestors 'self' ${portalUrl}`);
  return response;
}

export const config = {
  matcher: ["/((?!_next|_vercel|.*\\..*).*)"],
};

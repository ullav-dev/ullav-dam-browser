import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ params: string[] }> }
) {
  const { params: segments } = await params;
  const apiUrl = process.env.API_URL ?? "http://localhost:8080";
  const upstreamPath = `/iiif/image/${segments.join("/")}`;

  const cookieStore = await cookies();
  const token = cookieStore.get("iiif_access_token")?.value;

  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${apiUrl}${upstreamPath}`, { headers });

  if (!res.ok) {
    return new NextResponse(null, { status: res.status });
  }

  const isInfoJson = segments[segments.length - 1] === "info.json";
  if (isInfoJson) {
    const info = await res.json();
    // Rewrite the absolute server id to the proxy origin so OSD constructs
    // tile URLs via this handler (which injects auth) rather than the server directly.
    const origin = new URL(request.url).origin;
    const assetId = segments[0];
    info.id = `${origin}/api/iiif/image/${assetId}`;
    return NextResponse.json(info, {
      headers: {
        "Content-Type": "application/ld+json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  const body = await res.arrayBuffer();
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

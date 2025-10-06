import { NextRequest, NextResponse } from "next/server";

import { getServerEnv } from "@/lib/env";

const STATIC_MAP_URL = "https://maps.googleapis.com/maps/api/staticmap";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const center = searchParams.get("center");
  const zoom = searchParams.get("zoom") ?? "16";
  const maptype = searchParams.get("maptype") ?? "satellite";
  const scale = searchParams.get("scale") ?? "2";

  if (!center) {
    return NextResponse.json({ error: "center parameter is required" }, { status: 400 });
  }

  const { GOOGLE_MAPS_API_KEY } = getServerEnv();
  if (!GOOGLE_MAPS_API_KEY) {
    return NextResponse.json({ error: "GOOGLE_MAPS_API_KEY is not configured" }, { status: 501 });
  }

  const params = new URLSearchParams({
    center,
    zoom,
    scale,
    maptype,
    size: "640x640",
    key: GOOGLE_MAPS_API_KEY
  });

  const targetUrl = `${STATIC_MAP_URL}?${params.toString()}`;

  const response = await fetch(targetUrl);
  if (!response.ok) {
    const status = response.status;
    const message = status === 404 ? "No map imagery available" : "Failed to fetch static map";
    return NextResponse.json({ error: message }, { status });
  }

  const arrayBuffer = await response.arrayBuffer();
  const mimeType = response.headers.get("content-type") ?? "image/png";
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  return NextResponse.json({ base64, mimeType });
}

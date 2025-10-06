import { NextRequest, NextResponse } from "next/server";

import { getServerEnv } from "@/lib/env";

const STREET_VIEW_BASE_URL = "https://maps.googleapis.com/maps/api/streetview";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const heading = searchParams.get("heading");
  const pitch = searchParams.get("pitch");
  const fov = searchParams.get("fov");

  if (!lat || !lng) {
    return NextResponse.json({ error: "lat and lng are required" }, { status: 400 });
  }

  const { GOOGLE_MAPS_API_KEY } = getServerEnv();

  if (!GOOGLE_MAPS_API_KEY) {
    return NextResponse.json({ error: "GOOGLE_MAPS_API_KEY is not configured" }, { status: 501 });
  }

  const params = new URLSearchParams({
    size: "640x640",
    location: `${lat},${lng}`,
    source: "outdoor",
    radius: "150",
    key: GOOGLE_MAPS_API_KEY,
    return_error_code: "1"
  });

  if (heading) params.set("heading", heading);
  if (pitch) params.set("pitch", pitch);
  if (fov) params.set("fov", fov);

  const targetUrl = `${STREET_VIEW_BASE_URL}?${params.toString()}`;

  const response = await fetch(targetUrl);

  if (!response.ok) {
    const status = response.status;
    const message = status === 404 ? "No Street View imagery available" : "Failed to fetch Street View image";
    return NextResponse.json({ error: message }, { status });
  }

  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const mimeType = response.headers.get("content-type") ?? "image/jpeg";

  return NextResponse.json({ base64, mimeType });
}

import { NextRequest, NextResponse } from "next/server";

import { getServerEnv } from "@/lib/env";

const STREET_VIEW_IMAGE_URL = "https://maps.googleapis.com/maps/api/streetview";
const STREET_VIEW_METADATA_URL = "https://maps.googleapis.com/maps/api/streetview/metadata";

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

  const metadataUrl = `${STREET_VIEW_METADATA_URL}?${params.toString()}`;
  const metadataResponse = await fetch(metadataUrl);
  const metadata = await metadataResponse.json().catch(() => null);

  if (!metadataResponse.ok || metadata?.status !== "OK") {
    const status = metadataResponse.status === 200 ? 404 : metadataResponse.status;
    const message = metadata?.status === "ZERO_RESULTS"
      ? "No Street View imagery available"
      : metadata?.error_message || "Failed to fetch Street View metadata";
    return NextResponse.json({ error: message }, { status: status || 500 });
  }

  const imageResponse = await fetch(`${STREET_VIEW_IMAGE_URL}?${params.toString()}`);

  if (!imageResponse.ok) {
    const status = imageResponse.status;
    const message = status === 404 ? "No Street View imagery available" : "Failed to fetch Street View image";
    return NextResponse.json({ error: message }, { status });
  }

  const arrayBuffer = await imageResponse.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const mimeType = imageResponse.headers.get("content-type") ?? "image/jpeg";

  const location = metadata?.location ?? {};
  const description = location.description || location.shortDescription || metadata?.copyright || null;

  return NextResponse.json({ base64, mimeType, metadata: { ...metadata, description } });
}

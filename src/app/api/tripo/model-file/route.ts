import { NextRequest } from "next/server";

const ALLOWED_HOST_SUFFIX = ".tripo3d.com";

function isAllowedUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && url.hostname.endsWith(ALLOWED_HOST_SUFFIX);
  } catch (error) {
    console.error("Invalid model file URL", error);
    return false;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawUrl = searchParams.get("url");
  if (!rawUrl) {
    return new Response(JSON.stringify({ error: "Missing url parameter" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (!isAllowedUrl(rawUrl)) {
    return new Response(JSON.stringify({ error: "URL not permitted" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const upstream = await fetch(rawUrl, {
      headers: {
        "User-Agent": `emokai-viewer/${process.env.VERCEL_GIT_COMMIT_SHA ?? "local"}`
      }
    });

    if (!upstream.ok) {
      const message = await upstream.text();
      return new Response(JSON.stringify({ error: "Upstream request failed", message }), {
        status: upstream.status,
        headers: { "Content-Type": "application/json" }
      });
    }

    const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
    const buffer = await upstream.arrayBuffer();

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=60"
      }
    });
  } catch (error) {
    console.error("Failed to proxy Tripo model file", error);
    return new Response(JSON.stringify({ error: "Failed to fetch model file" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

export type ARSupport = "supported" | "unsupported" | "fallback";

function getUserAgent(): string {
  if (typeof navigator === "undefined") return "";
  return navigator.userAgent || "";
}

export function detectDeviceType(): "ios" | "android" | "unknown" {
  const ua = getUserAgent().toLowerCase();
  if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ipod")) return "ios";
  if (ua.includes("android")) return "android";
  return "unknown";
}

export function checkARCapability(): ARSupport {
  const device = detectDeviceType();

  if (device === "ios") {
    const isSupported = typeof navigator !== "undefined" && "xr" in navigator;
    return isSupported ? "supported" : "fallback";
  }

  if (device === "android") {
    const isSupported = typeof navigator !== "undefined" && "xr" in navigator;
    return isSupported ? "supported" : "fallback";
  }

  return "unsupported";
}

const SHARE_PREFIX = "https://sofu.app/share/";

function randomToken() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

export function createShareUrl(): { url: string; expiresAt: string } {
  const token = randomToken().slice(0, 24);
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  return {
    url: `${SHARE_PREFIX}${token}`,
    expiresAt: expires.toISOString()
  };
}

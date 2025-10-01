export function isLiveApisEnabled(): boolean {
  return process.env.NEXT_PUBLIC_USE_APIS === "true";
}


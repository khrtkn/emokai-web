const LOCK_KEY = "generation-lock";

type LockPayload = {
  startedAt: number;
};

function now() {
  return Date.now();
}

export function isGenerationLocked(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(LOCK_KEY) !== null;
}

export function acquireGenerationLock(): boolean {
  if (typeof window === "undefined") return false;
  if (isGenerationLocked()) {
    return false;
  }
  const payload: LockPayload = {
    startedAt: now()
  };
  sessionStorage.setItem(LOCK_KEY, JSON.stringify(payload));
  return true;
}

export function releaseGenerationLock() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(LOCK_KEY);
}

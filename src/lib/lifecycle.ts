const EXPIRATION_KEY = "creation-expiration";

export type LifecycleConfig = {
  tempTimeoutMinutes: number;
  sessionTimeoutHours: number;
  retentionDays: number;
};

const DEFAULT_CONFIG: LifecycleConfig = {
  tempTimeoutMinutes: 30,
  sessionTimeoutHours: 24,
  retentionDays: 7
};

type ExpirationRecord = {
  key: string;
  expiresAt: string;
};

function now() {
  return Date.now();
}

function addMinutes(date: number, minutes: number) {
  return date + minutes * 60 * 1000;
}

function addHours(date: number, hours: number) {
  return date + hours * 60 * 60 * 1000;
}

function addDays(date: number, days: number) {
  return date + days * 24 * 60 * 60 * 1000;
}

export function scheduleExpiration(key: string, expiresAt: number) {
  if (typeof window === "undefined") return;
  const record: ExpirationRecord[] = JSON.parse(localStorage.getItem(EXPIRATION_KEY) ?? "[]");
  const filtered = record.filter((entry) => entry.key !== key);
  filtered.push({ key, expiresAt: new Date(expiresAt).toISOString() });
  localStorage.setItem(EXPIRATION_KEY, JSON.stringify(filtered));
}

export function cleanupExpired(config: LifecycleConfig = DEFAULT_CONFIG) {
  if (typeof window === "undefined") return;
  const record: ExpirationRecord[] = JSON.parse(localStorage.getItem(EXPIRATION_KEY) ?? "[]");
  const current = now();
  const remaining: ExpirationRecord[] = [];

  record.forEach(({ key, expiresAt }) => {
    const expiry = new Date(expiresAt).getTime();
    if (expiry <= current) {
      localStorage.removeItem(key);
    } else {
      remaining.push({ key, expiresAt });
    }
  });

  localStorage.setItem(EXPIRATION_KEY, JSON.stringify(remaining));

  // Clean session storage entries older than sessionTimeoutHours
  const sessionExpiry = current - config.sessionTimeoutHours * 60 * 60 * 1000;
  for (let i = 0; i < sessionStorage.length; i += 1) {
    const key = sessionStorage.key(i);
    if (!key) continue;
    try {
      const value = JSON.parse(sessionStorage.getItem(key) ?? "null");
      const timestamp = value?.timestamp;
      if (typeof timestamp === "number" && timestamp < sessionExpiry) {
        sessionStorage.removeItem(key);
      }
    } catch (error) {
      // ignore malformed values
    }
  }
}

export function scheduleTemporary(key: string, config: LifecycleConfig = DEFAULT_CONFIG) {
  const expiresAt = addMinutes(now(), config.tempTimeoutMinutes);
  scheduleExpiration(key, expiresAt);
}

export function scheduleRetention(key: string, config: LifecycleConfig = DEFAULT_CONFIG) {
  const expiresAt = addDays(now(), config.retentionDays);
  scheduleExpiration(key, expiresAt);
}

export function scheduleSession(key: string, config: LifecycleConfig = DEFAULT_CONFIG) {
  const expiresAt = addHours(now(), config.sessionTimeoutHours);
  scheduleExpiration(key, expiresAt);
}

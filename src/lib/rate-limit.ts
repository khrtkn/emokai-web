const LIMIT_KEY = "creation-limit";
const DAILY_LIMIT = 3;

export type LimitCheck = {
  allowed: boolean;
  remaining: number;
  resetInHours: number;
};

type StoredLimit = {
  date: string;
  count: number;
};

function getMidnight(date: Date) {
  const midnight = new Date(date);
  midnight.setHours(24, 0, 0, 0);
  return midnight;
}

export function checkDailyLimit(): LimitCheck {
  if (typeof window === "undefined") {
    return { allowed: true, remaining: DAILY_LIMIT, resetInHours: 24 };
  }

  const today = new Date();
  const storedRaw = localStorage.getItem(LIMIT_KEY);
  let stored: StoredLimit = {
    date: today.toDateString(),
    count: 0
  };

  if (storedRaw) {
    try {
      const parsed = JSON.parse(storedRaw) as StoredLimit;
      if (parsed.date === today.toDateString()) {
        stored = parsed;
      } else {
        localStorage.removeItem(LIMIT_KEY);
      }
    } catch (error) {
      console.warn("Failed to parse limit", error);
      localStorage.removeItem(LIMIT_KEY);
    }
  }

  const allowed = stored.count < DAILY_LIMIT;
  const remaining = Math.max(DAILY_LIMIT - stored.count, 0);
  const msUntilReset = getMidnight(today).getTime() - today.getTime();
  const resetInHours = Math.max(Math.ceil(msUntilReset / (1000 * 60 * 60)), 0);

  return {
    allowed,
    remaining,
    resetInHours
  };
}

export function incrementDailyLimit() {
  if (typeof window === "undefined") return;
  const today = new Date();
  const storedRaw = localStorage.getItem(LIMIT_KEY);
  let stored: StoredLimit = {
    date: today.toDateString(),
    count: 0
  };

  if (storedRaw) {
    try {
      const parsed = JSON.parse(storedRaw) as StoredLimit;
      if (parsed.date === today.toDateString()) {
        stored = parsed;
      }
    } catch (error) {
      console.warn("Failed to parse limit", error);
    }
  }

  stored.count += 1;
  localStorage.setItem(LIMIT_KEY, JSON.stringify(stored));
}

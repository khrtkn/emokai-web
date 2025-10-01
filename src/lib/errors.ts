export type Retryable<T> = () => Promise<T>;

type RetryOptions = {
  retries?: number;
  delayMs?: number;
  onAttempt?: (attempt: number, error: unknown) => void;
};

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  retries: 3,
  delayMs: 1000,
  onAttempt: () => {}
};

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(fn: Retryable<T>, options: RetryOptions = {}): Promise<T> {
  const { retries, delayMs, onAttempt } = { ...DEFAULT_OPTIONS, ...options };

  let attempt = 0;
  let lastError: unknown;

  while (attempt < retries) {
    try {
      attempt += 1;
      return await fn();
    } catch (error) {
      lastError = error;
      onAttempt(attempt, error);
      if (attempt >= retries) {
        break;
      }
      await wait(delayMs);
    }
  }

  throw lastError ?? new Error("Unknown error");
}

export class GenerationError extends Error {
  constructor(message: string, readonly step: string, readonly original?: unknown) {
    super(message);
    this.name = "GenerationError";
  }
}

export function normalizeErrorMessage(locale: "ja" | "en", fallback: string): string {
  if (locale === "ja") {
    return "生成に失敗しました。もう一度お試しください";
  }
  return fallback;
}

/* eslint-disable no-console */

type LogMethod = (...input: unknown[]) => void;

type Logger = {
  info: LogMethod;
  warn: LogMethod;
  error: LogMethod;
};

type CreateLoggerOptions = {
  enabled?: boolean;
};

const DEFAULT_NAMESPACE = "app";

export function createLogger(namespace = DEFAULT_NAMESPACE, options: CreateLoggerOptions = {}): Logger {
  const shouldLog = options.enabled ?? process.env.NANOBANANA_DEBUG === "true";
  const prefix = `[${namespace}]`;

  const info: LogMethod = (...input) => {
    if (!shouldLog) return;
    console.info(prefix, ...input);
  };

  const warn: LogMethod = (...input) => {
    if (!shouldLog) return;
    console.warn(prefix, ...input);
  };

  const error: LogMethod = (...input) => {
    console.error(prefix, ...input);
  };

  if (!shouldLog) {
    return {
      info: () => {},
      warn: () => {},
      error
    };
  }

  return { info, warn, error };
}

export function createDebugLogger(namespace: string, options: CreateLoggerOptions = {}): Logger {
  const enabled = options.enabled ?? process.env.NODE_ENV === "development";
  return createLogger(namespace, { enabled });
}

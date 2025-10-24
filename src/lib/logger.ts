/* eslint-disable no-console */

const isVerboseLoggingEnabled =
  typeof process !== 'undefined' && process.env.NEXT_PUBLIC_DEBUG_LOGS === 'true';

function emit(level: 'log' | 'info' | 'warn' | 'error', args: unknown[]) {
  if ((level === 'log' || level === 'info') && !isVerboseLoggingEnabled) {
    return;
  }

  switch (level) {
    case 'log':
      console.log(...args);
      break;
    case 'info':
      console.info(...args);
      break;
    case 'warn':
      console.warn(...args);
      break;
    case 'error':
      console.error(...args);
      break;
    default:
      console.log(...args);
  }
}

export function logDebug(...args: unknown[]) {
  emit('log', args);
}

export function logInfo(...args: unknown[]) {
  emit('info', args);
}

export function logWarn(...args: unknown[]) {
  emit('warn', args);
}

export function logError(...args: unknown[]) {
  emit('error', args);
}

type Logger = {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

export function createLogger(namespace: string): Logger {
  const prefix = `[${namespace}]`;
  return {
    debug: (...args: unknown[]) => logDebug(prefix, ...args),
    info: (...args: unknown[]) => logInfo(prefix, ...args),
    warn: (...args: unknown[]) => logWarn(prefix, ...args),
    error: (...args: unknown[]) => logError(prefix, ...args)
  };
}

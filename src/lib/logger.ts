/* eslint-disable no-console */

const isDebugEnabled = typeof process !== 'undefined' && process.env.NEXT_PUBLIC_DEBUG_LOGS === 'true';

export function logDebug(...args: unknown[]) {
  if (!isDebugEnabled) return;
  console.log(...args);
}

export function logWarn(...args: unknown[]) {
  if (!isDebugEnabled) return;
  console.warn(...args);
}

export function logError(...args: unknown[]) {
  if (!isDebugEnabled) return;
  console.error(...args);
}


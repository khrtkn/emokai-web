"use client";

import { useEffect } from "react";

import { cleanupExpired } from "@/lib/lifecycle";

export function useLifecycleCleanup() {
  useEffect(() => {
    cleanupExpired();
    const interval = window.setInterval(() => cleanupExpired(), 5 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, []);
}

"use client";

import { useEffect, ReactNode } from "react";

import { initAnalytics, trackEvent } from "@/lib/analytics";

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    initAnalytics();
    trackEvent("page_view", { timestamp: Date.now() });
  }, []);

  return <>{children}</>;
}

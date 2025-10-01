const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? process.env.GA4_MEASUREMENT_ID;

declare global {
  interface Window {
    dataLayer: Record<string, unknown>[];
  }
}

export function initAnalytics() {
  if (typeof window === "undefined") return;
  if (!GA_MEASUREMENT_ID) return;
  if (document.querySelector("script[data-analytics='ga4']")) return;

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ js: new Date() });
  window.dataLayer.push({ config: GA_MEASUREMENT_ID });

  const script = document.createElement("script");
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  script.async = true;
  script.dataset.analytics = "ga4";
  document.head.appendChild(script);

  const inline = document.createElement("script");
  inline.text = `window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', '${GA_MEASUREMENT_ID}');`;
  document.head.appendChild(inline);
}

export type AnalyticsEvent =
  | "page_view"
  | "generation_start"
  | "generation_complete"
  | "generation_error"
  | "share_action"
  | "gallery_open"
  | "gallery_detail"
  | "ar_launch";

export function trackEvent(event: AnalyticsEvent, params: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  if (!window.dataLayer) {
    window.dataLayer = [];
  }
  window.dataLayer.push({ event, ...params });
  if (process.env.NODE_ENV !== "production") {
    console.info("[analytics]", event, params);
  }
}

export function trackError(step: string, error: unknown) {
  trackEvent("generation_error", {
    step,
    message: error instanceof Error ? error.message : String(error)
  });
}
*** End Patch

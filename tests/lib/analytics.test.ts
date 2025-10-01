import { trackEvent } from "@/lib/analytics";

describe("analytics", () => {
  beforeEach(() => {
    (globalThis as any).window = { dataLayer: [] } as Window & typeof globalThis;
  });

  it("pushes to dataLayer", () => {
    trackEvent("page_view", { foo: "bar" });
    expect(window.dataLayer).toHaveLength(1);
    expect(window.dataLayer[0]).toMatchObject({ event: "page_view", foo: "bar" });
  });
});

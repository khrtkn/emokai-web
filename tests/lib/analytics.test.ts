import { trackEvent } from '@/lib/analytics';

describe('analytics', () => {
  beforeEach(() => {
    const stub = { dataLayer: [] as Record<string, unknown>[] };
    Object.defineProperty(globalThis, 'window', {
      value: stub as unknown as Window & typeof globalThis,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it('pushes to dataLayer', () => {
    trackEvent('page_view', { foo: 'bar' });
    expect(window.dataLayer).toHaveLength(1);
    expect(window.dataLayer[0]).toMatchObject({ event: 'page_view', foo: 'bar' });
  });
});

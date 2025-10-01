describe('analytics init and error tracking', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv, NEXT_PUBLIC_GA_MEASUREMENT_ID: 'G-TEST123' };
    // Reset any previous head elements
    document.head.innerHTML = '';
    (window as any).dataLayer = undefined;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('injects GA scripts and pushes config to dataLayer', async () => {
    const { initAnalytics } = await import('@/lib/analytics');
    initAnalytics();

    const tag = document.querySelector("script[data-analytics='ga4']") as HTMLScriptElement | null;
    expect(tag).not.toBeNull();
    expect(tag?.src).toContain('https://www.googletagmanager.com/gtag/js?id=G-TEST123');

    expect(Array.isArray((window as any).dataLayer)).toBe(true);
    const dl = (window as any).dataLayer as any[];
    expect(dl.length).toBeGreaterThanOrEqual(2);
    expect(dl.some((e) => 'config' in e && (e as any).config === 'G-TEST123')).toBe(true);
  });

  it('tracks generation_error via trackError', async () => {
    const { trackError } = await import('@/lib/analytics');
    (window as any).dataLayer = [];
    trackError('stage', new Error('oops'));
    const dl = (window as any).dataLayer as any[];
    expect(dl[0]).toMatchObject({ event: 'generation_error', step: 'stage' });
  });
});


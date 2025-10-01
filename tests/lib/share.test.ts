import { createShareUrl } from '@/lib/share';

describe('share', () => {
  it('creates a share URL with random token and 30d expiry', () => {
    const { url, expiresAt } = createShareUrl();
    expect(url).toMatch(/^https:\/\/sofu\.app\/share\/[a-z0-9]+$/);
    const token = url.replace('https://sofu.app/share/', '');
    expect(token.length).toBeGreaterThanOrEqual(16);
    expect(token.length).toBeLessThanOrEqual(64);

    const expires = new Date(expiresAt).getTime();
    const in30Days = Date.now() + 30 * 24 * 60 * 60 * 1000;
    // within a small delta of 30 days
    expect(Math.abs(expires - in30Days)).toBeLessThan(2000);
  });
});

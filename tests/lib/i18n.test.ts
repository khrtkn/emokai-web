import { isLocale, getMessages } from '@/lib/i18n/messages';

describe('i18n/messages', () => {
  it('validates locales', () => {
    expect(isLocale('ja')).toBe(true);
    expect(isLocale('en')).toBe(true);
    expect(isLocale('fr')).toBe(false);
  });

  it('returns messages for supported locale', async () => {
    const ja = await getMessages('ja');
    expect(ja.stage.title.length).toBeGreaterThan(0);
  });
});


import LocaleHomePage from '@/app/[locale]/page';

describe('HomePage', () => {
  it('redirects to the Emokai flow', () => {
    expect(() => LocaleHomePage({ params: { locale: 'en' } })).toThrowError(/NEXT_REDIRECT/i);
  });
});

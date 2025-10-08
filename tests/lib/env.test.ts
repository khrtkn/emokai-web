import { getServerEnv } from '@/lib/env';

describe('env loader', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('throws when required variables are missing', () => {
    for (const key of [
      'OPENAI_API_KEY',
      'GEMINI_API_KEY',
      'TRIPO_API_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'SUPABASE_URL',
      'SUPABASE_GALLERY_PRIVATE_BUCKET',
      'SUPABASE_GALLERY_PUBLIC_BUCKET',
      'GALLERY_REVIEWER_TOKEN',
      'GA4_MEASUREMENT_ID'
    ])
      delete (process.env as Record<string, unknown>)[key];

    expect(() => getServerEnv()).toThrow(/Invalid server environment variables/);
  });

  it('returns parsed env when all present', () => {
    process.env.OPENAI_API_KEY = 'x';
    process.env.GEMINI_API_KEY = 'x';
    process.env.TRIPO_API_KEY = 'x';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'x';
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_GALLERY_PRIVATE_BUCKET = 'gallery-private';
    process.env.SUPABASE_GALLERY_PUBLIC_BUCKET = 'gallery-public';
    process.env.GALLERY_REVIEWER_TOKEN = 'secret-token';
    process.env.GALLERY_REVIEWER_ID = '11111111-1111-1111-1111-111111111111';
    process.env.GA4_MEASUREMENT_ID = 'G-XXXX';

    const env = getServerEnv();
    expect(env.SUPABASE_URL).toMatch(/^https:\/\//);
  });
});

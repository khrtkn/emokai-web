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
      'OPENAI_API_KEY','GOOGLE_NANOBANANA_KEY','TRIPO_API_KEY','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_URL','GA4_MEASUREMENT_ID'
    ]) delete (process.env as any)[key];

    expect(() => getServerEnv()).toThrow(/Invalid server environment variables/);
  });

  it('returns parsed env when all present', () => {
    process.env.OPENAI_API_KEY = 'x';
    process.env.GOOGLE_NANOBANANA_KEY = 'x';
    process.env.TRIPO_API_KEY = 'x';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'x';
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.GA4_MEASUREMENT_ID = 'G-XXXX';

    const env = getServerEnv();
    expect(env.SUPABASE_URL).toMatch(/^https:\/\//);
  });
});


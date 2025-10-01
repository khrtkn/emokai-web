import { moderateText } from '@/lib/moderation';

describe('moderation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('rejects empty input with localized message (ja)', async () => {
    const p = moderateText('   ', 'ja');
    await jest.runAllTimersAsync();
    await expect(p).resolves.toMatchObject({ allowed: false });
  });

  it('blocks NG words', async () => {
    const p = moderateText('please KILL the lights', 'en');
    await jest.runAllTimersAsync();
    await expect(p).resolves.toEqual({ allowed: false, reason: 'Inappropriate content detected.' });
  });

  it('allows safe text', async () => {
    const p = moderateText('a calm garden with lanterns', 'en');
    await jest.runAllTimersAsync();
    await expect(p).resolves.toEqual({ allowed: true });
  });
});


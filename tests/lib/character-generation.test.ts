import { createCharacterOptions } from '@/lib/character-generation';

describe('character-generation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Ensure btoa is available in the test environment
    if (typeof (global as any).btoa === 'undefined') {
      (global as any).btoa = (input: string) => Buffer.from(input, 'binary').toString('base64');
    }
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns 4 options with data URI previews', async () => {
    const promise = createCharacterOptions('a brave traveler');
    jest.advanceTimersByTime(1200);
    const options = await promise;
    expect(options).toHaveLength(4);
    for (const opt of options) {
      expect(opt.prompt).toBe('a brave traveler');
      expect(opt.previewUrl.startsWith('data:image/svg+xml;base64,')).toBe(true);
      expect(typeof opt.id).toBe('string');
      expect(opt.imageBase64.length).toBeGreaterThan(0);
      expect(opt.mimeType).toBe('image/svg+xml');
    }
  });
});

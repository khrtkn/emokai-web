import { generateModel, generateComposite, generateStory } from '@/lib/generation-jobs';

describe('generation-jobs', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('generates a model payload', async () => {
    const promise = generateModel({
      characterId: 'char-123',
      description: 'a character desc'
    });
    jest.advanceTimersByTime(1500);
    await expect(promise).resolves.toMatchObject({
      id: 'char-123',
      url: expect.stringContaining('.fbx'),
      previewUrl: null,
      polygons: 4800
    });
  });

  it('generates a composite payload', async () => {
    const promise = generateComposite(
      { imageBase64: 'c3RhZ2U=', mimeType: 'image/png' },
      { imageBase64: 'Y2hhcg==', mimeType: 'image/png' }
    );
    jest.advanceTimersByTime(2000);
    const result = await promise;
    expect(result.imageBase64).toBe('Y2hhcg==');
    expect(result.mimeType).toBe('image/png');
    expect(result.url).toBe('data:image/png;base64,Y2hhcg==');
  });

  it('generates a localized story', async () => {
    const promise = generateStory('test', 'ja');
    jest.advanceTimersByTime(800);
    const result = await promise;
    expect(result.locale).toBe('ja');
    expect(result.content.length).toBeGreaterThan(10);
  });
});

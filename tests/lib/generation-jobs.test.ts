import { generateModel, generateComposite, generateStory } from '@/lib/generation-jobs';

describe('generation-jobs', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('generates a model payload', async () => {
    const promise = generateModel('char-123');
    jest.advanceTimersByTime(1500);
    await expect(promise).resolves.toMatchObject({ id: 'char-123', url: expect.stringContaining('.fbx') });
  });

  it('generates a composite payload', async () => {
    const promise = generateComposite('stage-1', 'char-1');
    jest.advanceTimersByTime(2000);
    await expect(promise).resolves.toMatchObject({ id: 'stage-1-char-1', url: expect.stringContaining('.webp') });
  });

  it('generates a localized story', async () => {
    const promise = generateStory('test', 'ja');
    jest.advanceTimersByTime(800);
    const result = await promise;
    expect(result.locale).toBe('ja');
    expect(result.content.length).toBeGreaterThan(10);
  });
});


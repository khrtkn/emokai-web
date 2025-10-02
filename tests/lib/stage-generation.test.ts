import { Blob as NodeBlob } from 'buffer';

import { createStageOptions } from '@/lib/stage-generation';
import type { ProcessedImage } from '@/lib/image';

describe('stage-generation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns 4 options using processed image preview', async () => {
    const processed: ProcessedImage = {
      blob: new NodeBlob(['x']),
      webpUrl: 'blob:preview',
      size: 42
    };

    const promise = createStageOptions('a rooftop garden', processed);
    jest.advanceTimersByTime(1200);
    const options = await promise;
    expect(options).toHaveLength(4);
    for (const opt of options) {
      expect(opt.previewUrl).toBe('blob:preview');
      expect(opt.prompt).toBe('a rooftop garden');
      expect(typeof opt.id).toBe('string');
      expect(opt.imageBase64.length).toBeGreaterThan(0);
      expect(opt.mimeType).toBe('image/webp');
    }
  });
});

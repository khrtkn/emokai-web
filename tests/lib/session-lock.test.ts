import { acquireGenerationLock, isGenerationLocked, releaseGenerationLock } from '@/lib/session-lock';

describe('session-lock', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('acquires a lock when none exists', () => {
    expect(isGenerationLocked()).toBe(false);
    expect(acquireGenerationLock()).toBe(true);
    expect(isGenerationLocked()).toBe(true);
  });

  it('prevents acquiring twice until released', () => {
    expect(acquireGenerationLock()).toBe(true);
    expect(acquireGenerationLock()).toBe(false);
    releaseGenerationLock();
    expect(acquireGenerationLock()).toBe(true);
  });
});


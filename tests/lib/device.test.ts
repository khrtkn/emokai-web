import { detectDeviceType, checkARCapability } from '@/lib/device';

describe('device', () => {
  const originalNavigator = global.navigator;

  function setUA(ua: string, withXR = false) {
    Object.defineProperty(global, 'navigator', {
      value: { userAgent: ua, ...(withXR ? { xr: {} } : {}) },
      configurable: true
    });
  }

  afterEach(() => {
    Object.defineProperty(global, 'navigator', { value: originalNavigator, configurable: true });
  });

  it('detects iOS via userAgent', () => {
    setUA('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
    expect(detectDeviceType()).toBe('ios');
  });

  it('detects Android via userAgent', () => {
    setUA('Mozilla/5.0 (Linux; Android 14; Pixel 7)');
    expect(detectDeviceType()).toBe('android');
  });

  it('returns unknown for other agents', () => {
    setUA('Mozilla/5.0 (X11; Ubuntu; Linux x86_64)');
    expect(detectDeviceType()).toBe('unknown');
  });

  it('reports AR supported when navigator.xr present', () => {
    setUA('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', true);
    expect(checkARCapability()).toBe('supported');
  });

  it('reports AR fallback when device known but xr missing', () => {
    setUA('Mozilla/5.0 (Linux; Android 14; Pixel 7)');
    expect(checkARCapability()).toBe('fallback');
  });

  it('reports unsupported on unknown devices', () => {
    setUA('Something Else');
    expect(checkARCapability()).toBe('unsupported');
  });
});


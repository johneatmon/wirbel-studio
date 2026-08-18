import { describe, expect, it } from 'vitest';
import { DEFAULT_CLIPS, DEFAULT_LANES, emptyActiveClips } from '../session/model';
import { portableSessionCode, strudelShareUrl, utf8ToBase64 } from './export-session';

describe('portable session export', () => {
  it('prefixes compiled stack code with setcps', () => {
    const code = portableSessionCode(DEFAULT_LANES, DEFAULT_CLIPS, { drums: 'drums-909' }, 120);
    expect(code).toContain('setcps(0.5)');
    expect(code).toContain('stack(');
    expect(code).toContain('bd*4');
  });

  it('returns null when nothing is launched', () => {
    expect(portableSessionCode(DEFAULT_LANES, DEFAULT_CLIPS, emptyActiveClips(DEFAULT_LANES), 120)).toBeNull();
  });

  it('encodes share URLs as hash + base64', () => {
    const code = 'setcps(0.5)\nnote("c4")';
    const url = strudelShareUrl(code);
    expect(url.startsWith('https://strudel.cc/#')).toBe(true);
    const encoded = url.slice('https://strudel.cc/#'.length);
    expect(decodeURIComponent(encoded)).toBe(utf8ToBase64(code));
    expect(atob(decodeURIComponent(encoded))).toBe(code);
  });
});

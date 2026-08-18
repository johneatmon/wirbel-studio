import { describe, expect, it } from 'vitest';
import { compileSessionResilient } from './compile-isolated';
import type { SessionCompilePart } from './model';

const parts: SessionCompilePart[] = [
  { laneId: 'drums', laneName: 'Drums', clipId: 'drums-a', expression: 's("bd*4")' },
  { laneId: 'bass', laneName: 'Bass', clipId: 'bass-a', expression: 'note("c2")' },
];

describe('compileSessionResilient', () => {
  it('keeps valid lanes and records last-known-good expressions', async () => {
    const result = await compileSessionResilient(parts, {}, async (code) =>
      code.includes('syntax error') ? { ok: false, error: 'bad' } : { ok: true },
    );
    expect(result.code).toContain('bd*4');
    expect(result.code).toContain('c2');
    expect(result.laneErrors).toEqual({});
    expect(result.lastGoodUpdates).toEqual({
      'drums-a': 's("bd*4")',
      'bass-a': 'note("c2")',
    });
  });

  it('falls back to last-known-good when a lane expression fails', async () => {
    const result = await compileSessionResilient(
      [{ ...parts[1], expression: 'syntax error' }],
      { 'bass-a': 'note("c2")' },
      async (code) =>
        code.includes('syntax error') ? { ok: false, error: 'parse failed' } : { ok: true },
    );
    expect(result.code).toContain('c2');
    expect(result.laneErrors.bass).toBe('parse failed');
    expect(result.usedFallback.bass).toBe(true);
  });

  it('omits a lane when current and fallback both fail', async () => {
    const result = await compileSessionResilient(
      parts,
      { 'bass-a': 'also broken' },
      async () => ({ ok: false, error: 'nope' }),
    );
    expect(result.code).toBeNull();
    expect(Object.keys(result.laneErrors)).toHaveLength(2);
  });
});

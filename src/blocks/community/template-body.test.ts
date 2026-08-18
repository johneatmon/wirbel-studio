import { describe, expect, it } from 'vitest';
import { blockDefFromSerializable, segmentsFromTemplate } from './template-body';

describe('community block templates', () => {
  it('replaces slot placeholders with rendered values', () => {
    const segments = segmentsFromTemplate(
      'note({note}).lpf({cutoff})',
      { note: 'c2', cutoff: 900 },
      [
        { kind: 'mini', key: 'note', label: 'notes', default: 'c2' },
        { kind: 'number', key: 'cutoff', label: 'cutoff', min: 1, max: 9, step: 1, default: 1 },
      ],
    );
    expect(segments.map((segment) => (typeof segment === 'string' ? segment : segment.text)).join('')).toBe(
      'note("c2").lpf(900)',
    );
  });

  it('builds a block def from serializable JSON', () => {
    const def = blockDefFromSerializable({
      id: 'test-block',
      name: 'Test',
      category: 'bass',
      description: 'test',
      slots: [{ kind: 'mini', key: 'note', label: 'notes', default: 'c2' }],
      bodyTemplate: 'note({note})',
    });
    expect(def.body({ note: 'eb2' })).toEqual(['note(', { slot: 'note', text: '"eb2"' }, ')']);
  });
});

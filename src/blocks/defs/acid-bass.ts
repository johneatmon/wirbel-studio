import type { BlockDef } from '../protocol';
import { sl } from '../protocol';

export const acidBass: BlockDef = {
  id: 'acid-bass',
  name: 'Acid Bass',
  category: 'bass',
  description: '303-style sawtooth line with filter envelope',
  slots: [
    { kind: 'mini', key: 'note', label: 'notes', default: 'c2 [c2 c3]*2 c2 [~ c2]' },
    {
      kind: 'number',
      key: 'cutoff',
      label: 'cutoff',
      min: 100,
      max: 4000,
      step: 1,
      default: 500,
      scale: 'log',
      unit: 'Hz',
    },
    { kind: 'number', key: 'res', label: 'reso', min: 0, max: 40, step: 1, default: 14 },
  ],
  body: (s) => [
    'note(',
    sl('note', s.note),
    ')\n',
    '  .s("sawtooth").lpf(',
    sl('cutoff', s.cutoff),
    ').lpq(',
    sl('res', s.res),
    ')\n',
    '  .lpenv(4).lpattack(0.01)\n',
    // kept modest by default — a bare sawtooth line is grating at full gain
    '  .gain(0.4)',
  ],
};

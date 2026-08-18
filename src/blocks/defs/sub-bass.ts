import type { BlockDef } from '../protocol';
import { sl } from '../protocol';

export const subBass: BlockDef = {
  id: 'sub-bass',
  name: 'Sub Bass',
  category: 'bass',
  description: 'Rounded sub line with a slow filter envelope',
  slots: [
    { kind: 'mini', key: 'note', label: 'notes', default: '<c2 c2 eb2 bb1>' },
    {
      kind: 'number',
      key: 'cutoff',
      label: 'cutoff',
      min: 200,
      max: 2000,
      step: 10,
      default: 900,
      scale: 'log',
      unit: 'Hz',
    },
  ],
  body: (s) => [
    'note(',
    sl('note', s.note),
    ')\n',
    '  .s("triangle").lpf(',
    sl('cutoff', s.cutoff),
    ')\n',
    '  .release(0.2).gain(0.38)',
  ],
};

import type { BlockDef } from '../protocol';
import { sl } from '../protocol';

export const arpPad: BlockDef = {
  id: 'arp-pad',
  name: 'Arp Pad',
  category: 'melody',
  description: 'Soft arpeggiated chord pad',
  slots: [
    { kind: 'mini', key: 'root', label: 'chord', default: '<c4,e4,g4> <a3,c4,e4>' },
    {
      kind: 'enum',
      key: 'wave',
      label: 'wave',
      options: ['triangle', 'sine', 'square'],
      default: 'triangle',
    },
    {
      kind: 'number',
      key: 'cutoff',
      label: 'cutoff',
      min: 200,
      max: 4000,
      step: 1,
      default: 1200,
      scale: 'log',
      unit: 'Hz',
    },
  ],
  body: (s) => [
    'note(',
    sl('root', s.root),
    ')\n',
    '  .s(',
    sl('wave', s.wave),
    ').lpf(',
    sl('cutoff', s.cutoff),
    ')\n',
    '  .attack(0.1).release(0.3).room(0.3)\n',
    '  .gain(0.3)',
  ],
};

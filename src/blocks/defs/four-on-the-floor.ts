import type { BlockDef } from '../protocol';
import { sl } from '../protocol';

export const fourOnTheFloor: BlockDef = {
  id: 'four-on-the-floor',
  name: 'Four on the Floor',
  category: 'drums',
  description: 'Kick, clap and hats over a classic drum machine bank',
  slots: [
    {
      kind: 'enum',
      key: 'bank',
      label: 'bank',
      options: ['RolandTR909', 'RolandTR808', 'AkaiLinn'],
      default: 'RolandTR909',
    },
    { kind: 'number', key: 'hats', label: 'hats', min: 4, max: 16, step: 4, default: 8 },
  ],
  body: (s) => [
    's("bd*4, ~ cp ~ cp, hh*',
    { slot: 'hats', text: String(s.hats) },
    '")\n',
    '  .bank(',
    sl('bank', s.bank),
    ')\n',
    '  .gain(0.55)',
  ],
};

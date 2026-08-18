import type { BlockDef } from '../protocol';
import { sl } from '../protocol';

export const rimGroove: BlockDef = {
  id: 'rim-groove',
  name: 'Rim Groove',
  category: 'drums',
  description: 'Kick and rim pattern with claps on the backbeat',
  slots: [
    {
      kind: 'enum',
      key: 'bank',
      label: 'bank',
      options: ['RolandTR909', 'RolandTR808', 'AkaiLinn'],
      default: 'RolandTR808',
    },
    { kind: 'number', key: 'hats', label: 'hats', min: 4, max: 16, step: 4, default: 8 },
  ],
  body: (s) => [
    's("bd ~ rim ~, ~ cp ~ cp, hh*',
    { slot: 'hats', text: String(s.hats) },
    '")\n',
    '  .bank(',
    sl('bank', s.bank),
    ')\n',
    '  .gain(0.48)',
  ],
};

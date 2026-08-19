import type { SerializableBlockDef } from './template-body';

export const COMMUNITY_BLOCK_MANIFEST: SerializableBlockDef[] = [
  {
    id: 'shuffled-hats',
    name: 'Shuffled Hats',
    category: 'drums',
    description: 'Offbeat kick with shuffled hats on a classic drum machine',
    author: 'Wirbel',
    source: 'community',
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
    bodyTemplate: 's("bd ~ bd ~, ~ ~ cp ~, hh*{hats}")\n  .bank({bank})\n  .gain(0.5)',
  },
  {
    id: 'sub-pulse',
    name: 'Sub Pulse',
    category: 'bass',
    description: 'Simple sub pulse with a gentle filter',
    author: 'Wirbel',
    source: 'community',
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
    bodyTemplate:
      'note({note})\n  .s("triangle").lpf({cutoff}).release(0.2).gain(0.38)',
  },
  {
    id: 'sparkle-top',
    name: 'Sparkle Top',
    category: 'melody',
    description: 'High bell-like figures with a little room',
    author: 'Wirbel',
    source: 'community',
    slots: [
      { kind: 'mini', key: 'note', label: 'notes', default: '<g5 bb5 d6>*2' },
      { kind: 'number', key: 'room', label: 'room', min: 0, max: 1, step: 0.05, default: 0.35 },
    ],
    bodyTemplate:
      'note({note})\n  .s("triangle").attack(0.01).release(0.3).room({room}).gain(0.2)',
  },
];

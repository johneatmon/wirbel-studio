import type { SceneTemplate } from './types';

export const DEFAULT_SCENE_TEMPLATES: SceneTemplate[] = [
  {
    id: 'foundation',
    name: 'Night Drive',
    description: '808 cruise, analog bass, chrome pad, neon arp.',
    clipIds: {
      drums: 'drums-909',
      bass: 'bass-acid',
      harmony: 'harmony-warm',
      melody: 'melody-glass',
      texture: 'texture-dust',
    },
  },
  {
    id: 'lift',
    name: 'Overdrive',
    description: 'Gated snare, choir stabs, lead hook.',
    clipIds: {
      drums: 'drums-broken',
      bass: 'bass-sub',
      harmony: 'harmony-stabs',
      melody: 'melody-motif',
      texture: 'texture-swell',
    },
  },
  {
    id: 'deep',
    name: 'Chrome',
    description: 'Half-time night shift, wide pads, high hooks.',
    clipIds: {
      drums: 'drums-half',
      bass: 'bass-pluck',
      harmony: 'harmony-drift',
      melody: 'melody-bells',
      texture: 'texture-dust',
    },
  },
];

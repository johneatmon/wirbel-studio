import type { SceneTemplate } from './types';

export const DEFAULT_SCENE_TEMPLATES: SceneTemplate[] = [
  {
    id: 'foundation',
    name: 'Foundation',
    description: 'Balanced groove — good first launch.',
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
    name: 'Lift',
    description: 'More motion and brighter harmony.',
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
    name: 'Deep',
    description: 'Half-time drums with drifting pads.',
    clipIds: {
      drums: 'drums-half',
      bass: 'bass-pluck',
      harmony: 'harmony-drift',
      melody: 'melody-bells',
      texture: 'texture-dust',
    },
  },
];

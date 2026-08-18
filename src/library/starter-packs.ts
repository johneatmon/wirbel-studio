import { DEFAULT_LANES } from '../session/model';
import { STARTER_CLIPS } from './starter-clips';
import { DEFAULT_SCENE_TEMPLATES } from './starter-scenes';
import type { StarterPack } from './types';

export const STARTER_PACKS: StarterPack[] = [
  {
    id: 'starter-jam',
    name: 'Starter jam',
    description: 'Five lanes, three scenes, and a full clip library to launch your first set.',
    tempo: 120,
    launchQuantize: 'cycle',
    lanes: DEFAULT_LANES.map((lane) => ({ ...lane })),
    clips: STARTER_CLIPS,
    scenes: DEFAULT_SCENE_TEMPLATES,
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'One scene and a small clip set — less to learn, faster to play.',
    tempo: 118,
    launchQuantize: 'cycle',
    lanes: DEFAULT_LANES.map((lane) => ({ ...lane })),
    clips: STARTER_CLIPS.filter((clip) =>
      ['drums-909', 'bass-sub', 'harmony-warm', 'melody-glass', 'texture-dust'].includes(clip.id),
    ),
    scenes: [
      {
        id: 'intro',
        name: 'Intro',
        description: 'Launch everything at once.',
        clipIds: {
          drums: 'drums-909',
          bass: 'bass-sub',
          harmony: 'harmony-warm',
          melody: 'melody-glass',
          texture: 'texture-dust',
        },
      },
    ],
  },
];

export const DEFAULT_STARTER_PACK = STARTER_PACKS[0];

export function starterPackById(id: string): StarterPack | undefined {
  return STARTER_PACKS.find((pack) => pack.id === id);
}

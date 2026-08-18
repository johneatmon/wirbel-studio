import type { SessionLane, SessionQuantize } from '../session/model';

export interface LibraryClip {
  id: string;
  laneId: string;
  name: string;
  color: string;
  code: string;
}

export interface SceneTemplate {
  id: string;
  name: string;
  description?: string;
  clipIds: Record<string, string>;
}

export interface StarterPack {
  id: string;
  name: string;
  description: string;
  tempo: number;
  launchQuantize: SessionQuantize;
  lanes: SessionLane[];
  clips: LibraryClip[];
  scenes: SceneTemplate[];
}

export type StarterProjectSlice = Pick<
  StarterPack,
  'tempo' | 'launchQuantize' | 'lanes' | 'clips' | 'scenes'
> & { name: string };

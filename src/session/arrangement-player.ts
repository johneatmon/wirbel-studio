import { onFrame } from '../audio/clock';
import { currentCycleNow } from '../store/clock-store';
import { useSessionStore } from './session-store';

/** Replays captured launch-state events against the scheduler clock. */
export function startArrangementPlayer(onChange: () => void): () => void {
  return onFrame(() => {
    const state = useSessionStore.getState();
    if (!state.playingArrangement) return;
    const time = currentCycleNow() - state.playbackOriginCycle;
    if (state.applyArrangementUntil(time)) onChange();
    if (time >= state.arrangement.lengthCycles) state.stopArrangementPlayback();
  });
}

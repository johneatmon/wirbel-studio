import { evaluateCode, stopEngine, tryEvaluateExpression, type QuantizeBoundary } from '../audio/engine';
import { compileSessionParts } from './model';
import { compileSessionResilient } from './compile-isolated';
import { useSessionStore } from './session-store';

export async function evaluateActiveSession(
  boundary: QuantizeBoundary,
  onEvaluated?: () => void,
): Promise<void> {
  const state = useSessionStore.getState();
  const parts = compileSessionParts(state.lanes, state.clips, state.activeByLane);

  if (!parts.length) {
    state.setLaneErrors({});
    stopEngine();
    return;
  }

  const result = await compileSessionResilient(
    parts,
    state.lastGoodByClipId,
    tryEvaluateExpression,
  );

  state.mergeLastGood(result.lastGoodUpdates);
  state.setLaneErrors(result.laneErrors);

  if (!result.code) return;

  try {
    await evaluateCode(result.code, boundary);
    onEvaluated?.();
  } catch {
    // Engine surfaces errors via onUpdateState.
  }
}

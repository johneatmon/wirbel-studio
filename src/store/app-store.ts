import { create } from 'zustand';
import type { EngineState, QuantizeBoundary } from '../audio/engine';

interface AppStore extends EngineState {
  ready: boolean;
  lastEvaluatedAt: number | null;
  /** Lives here (not local component state) so vanilla-DOM slot chips —
   * outside React — can read the current setting via getState() when a drag
   * commits, without needing a subscription. */
  quantize: QuantizeBoundary;
  setEngineState: (state: EngineState) => void;
  setReady: (ready: boolean) => void;
  markEvaluated: () => void;
  setQuantize: (quantize: QuantizeBoundary) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  started: false,
  pattern: null,
  error: null,
  ready: false,
  lastEvaluatedAt: null,
  quantize: 'cycle',
  setEngineState: (state) => set(state),
  setReady: (ready) => set({ ready }),
  markEvaluated: () => set({ lastEvaluatedAt: Date.now() }),
  setQuantize: (quantize) => set({ quantize }),
}));

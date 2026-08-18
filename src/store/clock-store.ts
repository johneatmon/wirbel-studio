import { create } from 'zustand';

export interface ClockState {
  cycle: number;
  phase: number;
  beat: number;
  cps: number;
  playing: boolean;
}

export const useClockStore = create<ClockState>(() => ({
  cycle: 0,
  phase: 0,
  beat: 0,
  cps: 0.5,
  playing: false,
}));

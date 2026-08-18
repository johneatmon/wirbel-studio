export type SlotValue = string | number;

export type SlotSpec =
  | {
      kind: 'number';
      key: string;
      label: string;
      min: number;
      max: number;
      step: number;
      default: number;
      scale?: 'linear' | 'log';
      unit?: string;
    }
  | { kind: 'enum'; key: string; label: string; options: readonly string[]; default: string }
  | { kind: 'mini'; key: string; label: string; default: string };

export type Segment = string | { slot: string; text: string };

export interface BlockDef {
  id: string;
  name: string;
  category: 'drums' | 'bass' | 'melody' | 'texture' | 'fx' | 'structure';
  description: string;
  slots: SlotSpec[];
  /** Pure. Given slot values, emit body segments. */
  body: (s: Record<string, SlotValue>) => Segment[];
}

export const sl = (slot: string, v: SlotValue): Segment => ({
  slot,
  text: typeof v === 'string' ? JSON.stringify(v) : String(v),
});

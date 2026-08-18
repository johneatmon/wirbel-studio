import type { BlockDef } from './protocol';
import { acidBass } from './defs/acid-bass';
import { fourOnTheFloor } from './defs/four-on-the-floor';
import { arpPad } from './defs/arp-pad';

const defs: BlockDef[] = [acidBass, fourOnTheFloor, arpPad];

export const registry = new Map<string, BlockDef>(defs.map((d) => [d.id, d]));

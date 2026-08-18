import type { BlockDef } from './protocol';
import { acidBass } from './defs/acid-bass';
import { fourOnTheFloor } from './defs/four-on-the-floor';
import { arpPad } from './defs/arp-pad';
import { subBass } from './defs/sub-bass';
import { rimGroove } from './defs/rim-groove';
import { loadCommunityBlockDefs } from './community/store';

const builtInDefs: BlockDef[] = [acidBass, fourOnTheFloor, arpPad, subBass, rimGroove];

let mergedBlocks: BlockDef[] = [...builtInDefs, ...loadCommunityBlockDefs()];

export function refreshCommunityRegistry(): void {
  mergedBlocks = [...builtInDefs, ...loadCommunityBlockDefs()];
}

export function getBlock(id: string): BlockDef | undefined {
  return mergedBlocks.find((def) => def.id === id);
}

export function allBlocks(): BlockDef[] {
  const byId = new Map<string, BlockDef>();
  for (const def of mergedBlocks) byId.set(def.id, def);
  return [...byId.values()];
}

export function blockCategories(): BlockDef['category'][] {
  return [...new Set(allBlocks().map((def) => def.category))];
}

/** Back-compat for call sites that still expect a Map-like registry. */
export const registry = {
  get(id: string) {
    return getBlock(id);
  },
  values() {
    return allBlocks().values();
  },
  [Symbol.iterator]() {
    return allBlocks()[Symbol.iterator]();
  },
};

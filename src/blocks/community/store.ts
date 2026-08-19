import type { BlockDef } from '../protocol';
import { COMMUNITY_BLOCK_MANIFEST } from './manifest';
import {
  blockDefFromSerializable,
  type SerializableBlockDef,
} from './template-body';

const STORAGE_KEY = 'wirbel-community-blocks';

function readUserBlocks(): SerializableBlockDef[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSerializableBlock);
  } catch {
    return [];
  }
}

function writeUserBlocks(blocks: SerializableBlockDef[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(blocks));
}

function isSerializableBlock(value: unknown): value is SerializableBlockDef {
  if (!value || typeof value !== 'object') return false;
  const block = value as Partial<SerializableBlockDef>;
  return (
    typeof block.id === 'string' &&
    typeof block.name === 'string' &&
    typeof block.description === 'string' &&
    typeof block.bodyTemplate === 'string' &&
    Array.isArray(block.slots) &&
    typeof block.category === 'string'
  );
}

export function validateSerializableBlock(value: unknown): SerializableBlockDef {
  if (!isSerializableBlock(value)) throw new Error('Not a valid community block definition');
  if (!/^[a-z0-9-]+$/.test(value.id)) throw new Error('Block id must use lowercase letters, numbers, and dashes');
  blockDefFromSerializable(value);
  return value;
}

export function loadCommunityBlockDefs(): BlockDef[] {
  const bundled = COMMUNITY_BLOCK_MANIFEST.map(blockDefFromSerializable);
  const user = readUserBlocks().map(blockDefFromSerializable);
  const byId = new Map<string, BlockDef>();
  for (const block of [...bundled, ...user]) byId.set(block.id, block);
  return [...byId.values()];
}

export function listCommunityCatalog(): SerializableBlockDef[] {
  const bundled = COMMUNITY_BLOCK_MANIFEST;
  const user = readUserBlocks();
  const byId = new Map<string, SerializableBlockDef>();
  for (const block of [...bundled, ...user]) byId.set(block.id, block);
  return [...byId.values()];
}

export function addUserCommunityBlock(block: SerializableBlockDef): void {
  validateSerializableBlock(block);
  const next = readUserBlocks().filter((candidate) => candidate.id !== block.id);
  next.push({ ...block, source: 'user' });
  writeUserBlocks(next);
}

export function removeUserCommunityBlock(id: string): void {
  writeUserBlocks(readUserBlocks().filter((block) => block.id !== id));
}

export function exportCommunityBlock(block: SerializableBlockDef): string {
  return `${JSON.stringify(validateSerializableBlock(block), null, 2)}\n`;
}

export function importCommunityBlockJson(text: string): SerializableBlockDef {
  const parsed = JSON.parse(text) as unknown;
  const block = validateSerializableBlock(parsed);
  addUserCommunityBlock(block);
  return block;
}

export function isBundledCommunityBlock(id: string): boolean {
  return COMMUNITY_BLOCK_MANIFEST.some((block) => block.id === id);
}

import type { BlockDef, Segment, SlotSpec, SlotValue } from '../protocol';

export interface SerializableBlockDef {
  id: string;
  name: string;
  category: BlockDef['category'];
  description: string;
  slots: SlotSpec[];
  bodyTemplate: string;
  author?: string;
  source?: 'community' | 'user';
}

function formatSlotValue(spec: SlotSpec | undefined, value: SlotValue): string {
  if (spec?.kind === 'mini' || spec?.kind === 'enum') return JSON.stringify(String(value));
  return String(value);
}

export function segmentsFromTemplate(
  template: string,
  slots: Record<string, SlotValue>,
  slotSpecs: SlotSpec[],
): Segment[] {
  const specByKey = Object.fromEntries(slotSpecs.map((spec) => [spec.key, spec]));
  const pattern = /\{([a-zA-Z0-9_]+)\}/g;
  const segments: Segment[] = [];
  let lastIndex = 0;
  for (const match of template.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > lastIndex) segments.push(template.slice(lastIndex, index));
    const key = match[1];
    const value = slots[key];
    if (value === undefined) throw new Error(`Missing slot "${key}" for block template`);
    const spec = specByKey[key];
    const text = formatSlotValue(spec, value);
    segments.push({ slot: key, text });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < template.length) segments.push(template.slice(lastIndex));
  return segments;
}

export function blockDefFromSerializable(def: SerializableBlockDef): BlockDef {
  return {
    id: def.id,
    name: def.name,
    category: def.category,
    description: def.description,
    slots: def.slots,
    body: (slots) => segmentsFromTemplate(def.bodyTemplate, slots, def.slots),
  };
}

export function serializeBlockDef(def: BlockDef, bodyTemplate: string): SerializableBlockDef {
  return {
    id: def.id,
    name: def.name,
    category: def.category,
    description: def.description,
    slots: def.slots,
    bodyTemplate,
    source: 'user',
  };
}

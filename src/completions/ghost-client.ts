import type { GhostSettings } from './ghost-settings';

const SYSTEM_PROMPT = `You complete Strudel live-coding music code.
Return only the exact code to insert at <cursor>, with no markdown or explanation.
Use at most two short lines. Prefer continuing the current chain or adding one complementary layer.
Use idiomatic Strudel such as note(), s(), sound(), .bank(), .gain(), .lpf(), .room(), stack(), and $:.
Keep gain conservative. Never repeat code already before <cursor>.

Examples:
s("bd*4, ~ cp ~ cp")\n  .bank("RolandTR909")
note("<c3 eb3 g3 bb3>")\n  .s("triangle").lpf(1200).gain(0.3)
$: s("hh*8").gain(0.25)`;

const RIFF_PROMPT = `You write one complementary Strudel layer for an existing pattern.
Return only valid Strudel code for the new layer: no markdown, no comments, no stack() wrapper, no $: prefix.
One expression, 1-8 lines. Conservative gain. Complementary rhythm or register — do not copy the buffer.
Use idiomatic Strudel such as note(), s(), sound(), .bank(), .gain(), .lpf(), .room().`;

interface AnthropicResponse {
  content?: { type?: string; text?: string }[];
  error?: { message?: string };
}

async function requestMessage(
  settings: GhostSettings,
  system: string,
  user: string,
  options: { maxTokens: number; temperature: number; signal: AbortSignal },
): Promise<string> {
  const response = await fetch(settings.endpoint, {
    method: 'POST',
    signal: options.signal,
    headers: {
      'content-type': 'application/json',
      'x-api-key': settings.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: settings.model,
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as AnthropicResponse;
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `Completion request failed (${response.status})`);
  }
  return payload.content?.find((part) => part.type === 'text')?.text ?? '';
}

function stripFence(raw: string): string {
  return raw
    .replace(/^```(?:javascript|js|strudel)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n');
}

/** Strip common model framing mistakes while preserving indentation/newlines,
 * which are meaningful for an inline continuation. */
export function normalizeGhostSuggestion(raw: string, currentLine: string): string {
  let text = stripFence(raw);

  // Models occasionally echo the line even when asked for insertion-only text.
  if (currentLine && text.startsWith(currentLine)) text = text.slice(currentLine.length);

  const lines = text.split('\n').slice(0, 2);
  text = lines.join('\n').slice(0, 320).replace(/\s+$/, '');
  return text.trim() ? text : '';
}

export function normalizeRiffSuggestion(raw: string): string {
  let text = stripFence(raw).replace(/^\$:\s*/m, '');
  const lines = text.split('\n').slice(0, 8);
  text = lines.join('\n').slice(0, 800).replace(/^\s+|\s+$/g, '');
  return text;
}

export function formatRiffInsert(code: string): string {
  const [first, ...rest] = code.split('\n');
  return [`$: ${first}`, ...rest].join('\n');
}

export async function requestGhostSuggestion(
  prefix: string,
  currentLine: string,
  settings: GhostSettings,
  signal: AbortSignal,
): Promise<string> {
  const raw = await requestMessage(settings, SYSTEM_PROMPT, `${prefix}<cursor>`, {
    maxTokens: 96,
    temperature: 0.3,
    signal,
  });
  return normalizeGhostSuggestion(raw, currentLine);
}

export async function requestRiffSuggestion(
  buffer: string,
  settings: GhostSettings,
  signal: AbortSignal,
): Promise<string> {
  const raw = await requestMessage(
    settings,
    RIFF_PROMPT,
    `Existing pattern:\n${buffer || '// empty'}\n\nComplementary layer:`,
    { maxTokens: 256, temperature: 0.4, signal },
  );
  const text = normalizeRiffSuggestion(raw);
  if (!text) throw new Error('Riff returned empty code');
  return text;
}

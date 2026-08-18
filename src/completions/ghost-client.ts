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

interface AnthropicResponse {
  content?: { type?: string; text?: string }[];
  error?: { message?: string };
}

/** Strip common model framing mistakes while preserving indentation/newlines,
 * which are meaningful for an inline continuation. */
export function normalizeGhostSuggestion(raw: string, currentLine: string): string {
  let text = raw.replace(/^```(?:javascript|js)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  text = text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n');

  // Models occasionally echo the line even when asked for insertion-only text.
  if (currentLine && text.startsWith(currentLine)) text = text.slice(currentLine.length);

  const lines = text.split('\n').slice(0, 2);
  text = lines.join('\n').slice(0, 320).replace(/\s+$/, '');
  return text.trim() ? text : '';
}

export async function requestGhostSuggestion(
  prefix: string,
  currentLine: string,
  settings: GhostSettings,
  signal: AbortSignal,
): Promise<string> {
  const response = await fetch(settings.endpoint, {
    method: 'POST',
    signal,
    headers: {
      'content-type': 'application/json',
      'x-api-key': settings.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: settings.model,
      max_tokens: 96,
      temperature: 0.3,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `${prefix}<cursor>` }],
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as AnthropicResponse;
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `Completion request failed (${response.status})`);
  }
  const raw = payload.content?.find((part) => part.type === 'text')?.text ?? '';
  return normalizeGhostSuggestion(raw, currentLine);
}

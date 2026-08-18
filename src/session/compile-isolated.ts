import type { SessionCompilePart } from './model';
import { buildSessionStack } from './model';

export type ValidateExpression = (
  code: string,
) => Promise<{ ok: true } | { ok: false; error: string }>;

export interface ResilientCompileResult {
  code: string | null;
  laneErrors: Record<string, string>;
  usedFallback: Record<string, boolean>;
  lastGoodUpdates: Record<string, string>;
}

/** Validate each active lane independently and fall back to last-known-good
 * clip code so one broken edit cannot silence the rest of the jam. */
export async function compileSessionResilient(
  parts: SessionCompilePart[],
  lastGoodByClipId: Record<string, string>,
  validate: ValidateExpression,
): Promise<ResilientCompileResult> {
  const laneErrors: Record<string, string> = {};
  const usedFallback: Record<string, boolean> = {};
  const lastGoodUpdates: Record<string, string> = {};
  const stackExpressions: string[] = [];

  for (const part of parts) {
    const current = await validate(part.expression);
    if (current.ok) {
      lastGoodUpdates[part.clipId] = part.expression;
      stackExpressions.push(part.expression);
      continue;
    }

    laneErrors[part.laneId] = current.error;
    const fallback = lastGoodByClipId[part.clipId];
    if (fallback) {
      const fallbackResult = await validate(fallback);
      if (fallbackResult.ok) {
        usedFallback[part.laneId] = true;
        stackExpressions.push(fallback);
      }
    }
  }

  return {
    code: buildSessionStack(stackExpressions),
    laneErrors,
    usedFallback,
    lastGoodUpdates,
  };
}

import { syntaxTree } from '@codemirror/language';
import type { CompletionContext } from '@codemirror/autocomplete';
import type { SyntaxNode } from '@lezer/common';

export function isInsideString(context: CompletionContext): boolean {
  const node = syntaxTree(context.state).resolveInner(context.pos, -1);
  return node.name === 'String';
}

/** Walks up from the cursor to the nearest enclosing call and returns the
 * called function/method's name — `s` for `s("…")`, `lpf` for `x.lpf("…")`.
 * Used to pick which set of context-aware string completions applies. */
export function enclosingCallName(context: CompletionContext): string | null {
  let node: SyntaxNode | null = syntaxTree(context.state).resolveInner(context.pos, -1);
  while (node) {
    if (node.name === 'CallExpression') {
      const callee = node.firstChild;
      if (!callee) return null;
      if (callee.name === 'MemberExpression') {
        const prop = callee.lastChild;
        return prop ? context.state.sliceDoc(prop.from, prop.to) : null;
      }
      if (callee.name === 'VariableName') {
        return context.state.sliceDoc(callee.from, callee.to);
      }
      return null;
    }
    node = node.parent;
  }
  return null;
}

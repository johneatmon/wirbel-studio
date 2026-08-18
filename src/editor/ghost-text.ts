import { StateEffect, StateField, type Extension } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, WidgetType, type Command } from '@codemirror/view';
import { blocksField } from './blocks-field';
import { loadGhostSettings } from '../completions/ghost-settings';
import { requestGhostSuggestion } from '../completions/ghost-client';

interface GhostSuggestion {
  pos: number;
  text: string;
}

export type GhostStatus = 'idle' | 'loading' | 'ready' | 'error';

const setGhost = StateEffect.define<GhostSuggestion | null>();

class GhostWidget extends WidgetType {
  readonly text: string;

  constructor(text: string) {
    super();
    this.text = text;
  }

  eq(other: GhostWidget): boolean {
    return other.text === this.text;
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'cm-ghost-text';
    span.textContent = this.text;
    return span;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

const ghostField = StateField.define<GhostSuggestion | null>({
  create: () => null,
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setGhost)) return effect.value;
    }
    if (transaction.docChanged || transaction.selection) return null;
    return value;
  },
  provide: (field) =>
    EditorView.decorations.from(field, (ghost) =>
      ghost
        ? Decoration.set([
            Decoration.widget({ widget: new GhostWidget(ghost.text), side: 1 }).range(ghost.pos),
          ])
        : Decoration.none,
    ),
});

export const acceptGhost: Command = (view) => {
  const ghost = view.state.field(ghostField, false);
  if (!ghost) return false;
  view.dispatch({
    changes: { from: ghost.pos, insert: ghost.text },
    selection: { anchor: ghost.pos + ghost.text.length },
    effects: setGhost.of(null),
    userEvent: 'input.complete',
  });
  return true;
};

function completionContext(view: EditorView): { pos: number; prefix: string; line: string } | null {
  const selection = view.state.selection.main;
  if (!selection.empty) return null;
  const pos = selection.head;
  const line = view.state.doc.lineAt(pos);
  if (pos !== line.to || !line.text.trim()) return null;
  if (view.state.field(blocksField).some((block) => pos >= block.from && pos <= block.to))
    return null;

  const firstLine = Math.max(1, line.number - 39);
  const from = view.state.doc.line(firstLine).from;
  return { pos, prefix: view.state.sliceDoc(from, pos), line: line.text };
}

interface GhostTextOptions {
  onStatus?: (status: GhostStatus, message?: string) => void;
}

/** Idle-triggered, opt-in inline completion. Configuration is read when a
 * request starts, so saving settings takes effect without rebuilding CM6. */
export function ghostText(options: GhostTextOptions = {}): Extension {
  const plugin = ViewPlugin.fromClass(
    class {
      private readonly view: EditorView;
      private timer: number | null = null;
      private request: AbortController | null = null;
      private readonly cache = new Map<string, string>();

      constructor(view: EditorView) {
        this.view = view;
        this.schedule();
      }

      update(update: { docChanged: boolean; selectionSet: boolean }): void {
        if (update.docChanged || update.selectionSet) this.schedule();
      }

      destroy(): void {
        this.cancel();
      }

      private cancel(): void {
        if (this.timer !== null) window.clearTimeout(this.timer);
        this.timer = null;
        this.request?.abort();
        this.request = null;
      }

      private schedule(): void {
        this.cancel();
        options.onStatus?.('idle');
        const settings = loadGhostSettings();
        const context = completionContext(this.view);
        if (!settings.enabled || !settings.apiKey || !context) return;

        this.timer = window.setTimeout(() => {
          this.timer = null;
          void this.complete(context);
        }, 500);
      }

      private async complete(context: {
        pos: number;
        prefix: string;
        line: string;
      }): Promise<void> {
        const cached = this.cache.get(context.prefix);
        if (cached !== undefined) {
          if (cached) this.showIfCurrent(context, cached);
          return;
        }

        const controller = new AbortController();
        this.request = controller;
        options.onStatus?.('loading');
        try {
          const suggestion = await requestGhostSuggestion(
            context.prefix,
            context.line,
            loadGhostSettings(),
            controller.signal,
          );
          this.cache.set(context.prefix, suggestion);
          if (this.cache.size > 100) this.cache.delete(this.cache.keys().next().value ?? '');
          if (suggestion) this.showIfCurrent(context, suggestion);
          else options.onStatus?.('idle');
        } catch (error) {
          if (!controller.signal.aborted) {
            options.onStatus?.('error', error instanceof Error ? error.message : String(error));
          }
        } finally {
          if (this.request === controller) this.request = null;
        }
      }

      private showIfCurrent(context: { pos: number; prefix: string }, text: string): void {
        const current = completionContext(this.view);
        if (!current || current.pos !== context.pos || current.prefix !== context.prefix) return;
        this.view.dispatch({ effects: setGhost.of({ pos: context.pos, text }) });
        options.onStatus?.('ready');
      }
    },
  );

  return [ghostField, plugin];
}

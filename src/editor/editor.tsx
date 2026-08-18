import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { EditorView, keymap } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { defaultKeymap, indentWithTab } from '@codemirror/commands';
import { autocompletion } from '@codemirror/autocomplete';
import { onApply } from '../audio/engine';
import { blocksField } from './blocks-field';
import { enforceLocks } from './enforce-locks';
import { blockDecorations, blockAtomicRanges } from './block-decorations';
import { insertBlock as insertBlockCmd } from './block-commands';
import { repairBlocks } from './repair-blocks';
import { functionDocCompletions } from '../completions/function-docs';
import { contextStringCompletions } from '../completions/context-strings';
import { miniNotationSnippets } from '../completions/mini-snippets';
import { acceptGhost, ghostText, type GhostStatus } from './ghost-text';

export interface StrudelEditorHandle {
  getCode(): string;
  insertBlock(defId: string): void;
}

interface StrudelEditorProps {
  initialDoc: string;
  onEvaluate: (code: string) => void;
  onStop: () => void;
  onGhostStatus?: (status: GhostStatus, message?: string) => void;
}

export const StrudelEditor = forwardRef<StrudelEditorHandle, StrudelEditorProps>(
  function StrudelEditor({ initialDoc, onEvaluate, onStop, onGhostStatus }, ref) {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const viewRef = useRef<EditorView | null>(null);
    const onEvaluateRef = useRef(onEvaluate);
    const onStopRef = useRef(onStop);
    const onGhostStatusRef = useRef(onGhostStatus);
    onEvaluateRef.current = onEvaluate;
    onStopRef.current = onStop;
    onGhostStatusRef.current = onGhostStatus;
    const [flashSeq, setFlashSeq] = useState(0);

    useImperativeHandle(ref, () => ({
      getCode: () => viewRef.current?.state.doc.toString() ?? '',
      insertBlock: (defId: string) => {
        if (viewRef.current) insertBlockCmd(viewRef.current, defId);
      },
    }));

    // Fires the instant an eval actually applies (immediate or a quantized
    // boundary firing later) — synced tightly to the boundary, not to when
    // the (possibly slow) evaluate promise resolves.
    useEffect(() => onApply(() => setFlashSeq((s) => s + 1)), []);

    useEffect(() => {
      if (!hostRef.current) return;

      const evalKeymap = keymap.of([
        {
          key: 'Mod-Enter',
          run: (view) => {
            onEvaluateRef.current(view.state.doc.toString());
            return true;
          },
        },
        {
          key: 'Mod-.',
          run: () => {
            onStopRef.current();
            return true;
          },
        },
        { key: 'Tab', run: acceptGhost },
        indentWithTab,
        ...defaultKeymap,
      ]);

      const state = EditorState.create({
        doc: initialDoc,
        extensions: [
          basicSetup,
          javascript(),
          evalKeymap,
          blocksField,
          enforceLocks,
          blockDecorations,
          blockAtomicRanges,
          ghostText({
            onStatus: (status, message) => onGhostStatusRef.current?.(status, message),
          }),
          autocompletion({
            override: [functionDocCompletions, contextStringCompletions, miniNotationSnippets],
          }),
          EditorView.theme(
            {
              '&': { height: '100%', fontSize: '14px' },
              '.cm-scroller': { fontFamily: 'ui-monospace, SFMono-Regular, monospace' },
              '.cm-content': { padding: '12px 0' },
            },
            { dark: true },
          ),
        ],
      });

      const view = new EditorView({ state, parent: hostRef.current });
      viewRef.current = view;
      repairBlocks(view);

      return () => {
        view.destroy();
        viewRef.current = null;
      };
      // Only (re)create the editor on mount — initialDoc is a seed, not a controlled value.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
      <div className="relative h-full w-full">
        <div ref={hostRef} className="h-full w-full overflow-auto" />
        <div
          key={flashSeq}
          className={flashSeq > 0 ? 'eval-flash' : ''}
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background: 'white',
            pointerEvents: 'none',
            opacity: 0,
          }}
        />
      </div>
    );
  },
);

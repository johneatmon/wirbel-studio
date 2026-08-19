import {
  snippetCompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from '@codemirror/autocomplete';
import { isInsideString } from './syntax-utils';

const snippets: Completion[] = [
  snippetCompletion('${1:bd}*${2:4}', {
    label: 'bd*4',
    type: 'text',
    detail: 'repeat',
    info: 'Repeats a sound n times within one step.',
  }),
  snippetCompletion('<${1:a} ${2:b} ${3:c}>', {
    label: '<a b c>',
    type: 'text',
    detail: 'alternate',
    info: 'Plays a different value each cycle, looping through the list.',
  }),
  snippetCompletion('[${1:x} ~]*${2:2}', {
    label: '[x ~]*2',
    type: 'text',
    detail: 'grouped subdivision',
    info: 'Groups a sequence as one step, then repeats the whole group n times.',
  }),
];

const TOKEN = /[\w*<>[\]~]*/;

/** Mini-notation template snippets — available inside any pattern string, not
 * just specific calls like s()/scale(). */
export function miniNotationSnippets(context: CompletionContext): CompletionResult | null {
  if (!isInsideString(context)) return null;
  const word = context.matchBefore(TOKEN);
  if (word && word.from === word.to && !context.explicit) return null;
  return { from: word ? word.from : context.pos, options: snippets, validFor: TOKEN };
}

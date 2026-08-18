#!/usr/bin/env node
// Vendors Strudel's function/method docs into a static JSON completions
// source (DESIGN.md §6 Tier 1, item 1). Strudel's own doc-generation
// pipeline lives in their monorepo tooling, not in the published npm
// package, but the package DOES ship its original unminified source .mjs
// files (unlike the bundled dist) with the JSDoc intact — this script
// parses those directly instead.
//
// Re-run (`pnpm run docs:extract`) whenever the pinned @strudel/core
// version bumps, since the output is committed, not generated at build time.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const SOURCE_FILES = [
  'node_modules/@strudel/core/controls.mjs',
  'node_modules/@strudel/core/pattern.mjs',
  'node_modules/@strudel/core/signal.mjs',
  'node_modules/@strudel/core/euclid.mjs',
  'node_modules/@strudel/core/pick.mjs',
];

const OUTPUT = 'src/completions/strudel-docs.json';

const JS_KEYWORDS = new Set([
  'if',
  'for',
  'while',
  'return',
  'switch',
  'function',
  'const',
  'let',
  'var',
  'else',
  'do',
  'try',
  'catch',
  'new',
  'typeof',
  'throw',
]);

function parseFile(relPath) {
  const src = readFileSync(path.join(root, relPath), 'utf8');
  const entries = [];
  const blockRe = /\/\*\*([\s\S]*?)\*\//g;
  let m;
  while ((m = blockRe.exec(src))) {
    const commentBody = m[1];
    const rest = src.slice(blockRe.lastIndex);
    const immediate = rest.slice(0, 60);
    if (/^\s*export class /.test(immediate)) continue; // classes aren't callable completions

    let names = null;
    let mm;
    // Class methods (`withValue(func) {`) and simple exports are always
    // immediate — check narrowly first, since a broad search for a bare
    // `identifier(` risks matching a control-flow keyword (`if (…)`) deep in
    // an unrelated function body.
    if ((mm = immediate.match(/^\s*(\w+)\s*\(/)) && !JS_KEYWORDS.has(mm[1])) {
      names = [mm[1]];
    } else if ((mm = immediate.match(/^\s*export const \{([^}]+)\}/))) {
      names = mm[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if ((mm = immediate.match(/^\s*export const (\w+)/))) {
      names = [mm[1]];
    } else if ((mm = immediate.match(/^\s*export function (\w+)/))) {
      names = [mm[1]];
    } else {
      // A few blocks (e.g. euclid.mjs's base `euclid` doc) sit before an
      // unexported helper first — widen the search, but only for `export`
      // declarations (never the bare-identifier case, too risky to search
      // broadly for that).
      const wide = rest.slice(0, 4000);
      const candidates = [
        wide.match(/export const \{([^}]+)\}/),
        wide.match(/export const (\w+)/),
        wide.match(/export function (\w+)/),
      ].filter(Boolean);
      // Several export statements can appear within the window (e.g.
      // euclid.mjs has three between one doc block and the next) — take
      // whichever comes FIRST in the text, not whichever pattern happened to
      // be checked first.
      candidates.sort((a, b) => a.index - b.index);
      const first = candidates[0];
      if (first) {
        names = first[1]
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }
    if (!names) continue; // no recognizable declaration found nearby; skip

    const lines = commentBody.split('\n').map((l) => l.replace(/^[ \t]*\*[ \t]?/, ''));

    const descLines = [];
    const examples = [];
    let name = null;
    let synonyms = [];
    let memberOf = null;
    let currentTag = null;
    let currentExample = [];

    const flushExample = () => {
      if (currentExample.length) {
        examples.push(currentExample.join('\n').trim());
        currentExample = [];
      }
    };

    for (const line of lines) {
      const tagMatch = line.match(/^@(\w+)\s*(.*)$/);
      if (tagMatch) {
        if (currentTag === 'example') flushExample();
        currentTag = tagMatch[1];
        const val = tagMatch[2];
        if (currentTag === 'name') name = val.trim();
        else if (currentTag === 'memberof') memberOf = val.trim();
        else if (currentTag === 'synonyms')
          synonyms = val
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        else if (currentTag === 'example') currentExample.push(val);
        continue;
      }
      if (currentTag === 'example') {
        currentExample.push(line);
      } else if (!currentTag) {
        descLines.push(line);
      }
    }
    flushExample();

    const primaryName = name || names[0];
    const aliases = Array.from(new Set([primaryName, ...names, ...synonyms].filter(Boolean)));
    const summary = descLines
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/`([^`]+)`/g, '$1') // strip markdown code ticks
      .replace(/\*\*([^*]+)\*\*/g, '$1'); // and bold markers — plain text in a tooltip

    if (!primaryName || !summary) continue;
    entries.push({ name: primaryName, aliases, memberOf, summary, examples });
  }
  return entries;
}

const all = SOURCE_FILES.flatMap(parseFile);

// De-dupe by primary name (last-write-wins is fine — no observed collisions
// across these files as of @strudel 1.2.6/1.3.0).
const byName = new Map();
for (const entry of all) byName.set(entry.name, entry);
const deduped = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));

writeFileSync(path.join(root, OUTPUT), JSON.stringify(deduped, null, 2) + '\n');
console.log(`Wrote ${deduped.length} entries to ${OUTPUT}`);

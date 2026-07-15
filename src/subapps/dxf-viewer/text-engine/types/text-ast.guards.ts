/**
 * ADR-344 — Narrowing helpers for the `TextRun | TextStack` union.
 *
 * A paragraph's `runs` mix inline text runs with stacked fractions (`\S`). The two share no
 * discriminant field, so every consumer has to narrow structurally. These are the **one** place
 * that knows how (N.0.2): before this file the `'text' in run` check was copy-pasted across the
 * text engine, and the copies that forgot it read `run.text` off a stack — `undefined`, which
 * `Array.join` silently renders as an empty string instead of failing.
 */

import type { TextRun, TextStack } from './text-ast.types';

/** True for an inline run of styled text (carries `text`). */
export function isTextRun(run: TextRun | TextStack): run is TextRun {
  return 'text' in run;
}

/** True for a stacked fraction/tolerance produced by the `\S` inline code (carries `top`/`bottom`). */
export function isTextStack(run: TextRun | TextStack): run is TextStack {
  return !('text' in run);
}

/**
 * ADR-344 Phase 8 — DXF Text Engine spell-check Web Worker.
 *
 * Runs nspell + Hunspell dictionaries (el_GR MPL-1.1 + en_US MIT/BSD) on a
 * dedicated worker thread so the main-thread TipTap editor never blocks on
 * dictionary load or per-word lookups. Bootstrapped lazily by
 * `spell-checker.ts` via `new Worker(new URL('./spell.worker.ts', import.meta.url))`.
 *
 * Protocol: discriminated union messages defined in `spell.types.ts`.
 * Every request has a `requestId`; the worker echoes it on the matching
 * response so the main-thread façade can resolve the awaiting promise.
 *
 * @module text-engine/spell/spell.worker
 */

import type { NSpell } from 'nspell';
import { loadHunspell } from './dictionary-loader';
import type {
  CustomTermPayload,
  SpellCheckRequest,
  SpellLanguage,
  SpellSuggestRequest,
  SpellWorkerRequest,
  SpellWorkerResponse,
  MisspelledRange,
} from './spell.types';

// ─── Worker globals ──────────────────────────────────────────────────────────

/** Per-language nspell instances. Populated on `init` and on first `check`. */
const checkers = new Map<SpellLanguage, NSpell>();

/** Custom terms hydrated into every checker — kept here so we can re-apply on lazy load. */
const customTerms: CustomTermPayload[] = [];

/**
 * Tokeniser. Splits on Unicode word boundaries so Greek diacritics (e.g.
 * «καλημέρα») stay intact inside a single token. The negation form
 * `[^\p{L}\p{M}]+` is the simplest portable rule — both Greek + Latin
 * letters and combining marks count as word characters.
 */
const WORD_TOKENISER = /[\p{L}\p{M}]+/gu;

function isLikelyGreek(token: string): boolean {
  // U+0370 .. U+03FF (Greek and Coptic), U+1F00 .. U+1FFF (Greek Extended)
  return /[Ͱ-Ͽἀ-῿]/.test(token);
}

function detectLanguage(
  token: string,
  available: readonly SpellLanguage[],
): SpellLanguage | null {
  if (isLikelyGreek(token)) return available.includes('el') ? 'el' : null;
  if (/^[A-Za-z][A-Za-z'-]*$/.test(token)) return available.includes('en') ? 'en' : null;
  return null;
}

async function ensureChecker(language: SpellLanguage): Promise<NSpell> {
  const cached = checkers.get(language);
  if (cached) return cached;
  const checker = await loadHunspell(language);
  // Re-apply hydrated custom terms (worker may have been recreated mid-session).
  for (const term of customTerms) {
    if (term.language === language) checker.add(term.term);
  }
  checkers.set(language, checker);
  return checker;
}

// ─── Request handlers ────────────────────────────────────────────────────────

async function handleInit(
  request: SpellWorkerRequest & { type: 'init' },
): Promise<SpellWorkerResponse> {
  customTerms.length = 0;
  for (const term of request.customTerms) customTerms.push(term);
  await Promise.all(request.languages.map(ensureChecker));
  return { type: 'init', requestId: request.requestId, ok: true };
}

async function handleCheck(request: SpellCheckRequest): Promise<SpellWorkerResponse> {
  const misspelled: MisspelledRange[] = [];
  WORD_TOKENISER.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = WORD_TOKENISER.exec(request.text)) !== null) {
    const word = match[0];
    const language = detectLanguage(word, request.languages);
    if (language === null) continue;
    const checker = await ensureChecker(language);
    if (!checker.correct(word)) {
      misspelled.push({
        from: match.index,
        to: match.index + word.length,
        word,
        language,
      });
    }
  }
  return { type: 'check', requestId: request.requestId, misspelled };
}

async function handleSuggest(request: SpellSuggestRequest): Promise<SpellWorkerResponse> {
  const checker = await ensureChecker(request.language);
  const all = checker.suggest(request.word);
  const suggestions = all.slice(0, Math.max(1, Math.min(request.limit, 20)));
  return { type: 'suggest', requestId: request.requestId, suggestions };
}

async function handleAddWord(
  request: SpellWorkerRequest & { type: 'addWord' },
): Promise<SpellWorkerResponse> {
  customTerms.push(request.term);
  const checker = await ensureChecker(request.term.language);
  checker.add(request.term.term);
  return { type: 'ack', requestId: request.requestId, ok: true };
}

async function handleRemoveWord(
  request: SpellWorkerRequest & { type: 'removeWord' },
): Promise<SpellWorkerResponse> {
  const idx = customTerms.findIndex(
    (t) => t.term === request.term.term && t.language === request.term.language,
  );
  if (idx !== -1) customTerms.splice(idx, 1);
  const checker = await ensureChecker(request.term.language);
  checker.remove(request.term.term);
  return { type: 'ack', requestId: request.requestId, ok: true };
}

// ─── Message dispatcher ──────────────────────────────────────────────────────

async function dispatch(request: SpellWorkerRequest): Promise<SpellWorkerResponse> {
  try {
    switch (request.type) {
      case 'init':
        return await handleInit(request);
      case 'check':
        return await handleCheck(request);
      case 'suggest':
        return await handleSuggest(request);
      case 'addWord':
        return await handleAddWord(request);
      case 'removeWord':
        return await handleRemoveWord(request);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown spell-worker error';
    return { type: 'error', requestId: request.requestId, message };
  }
}

self.addEventListener('message', (event: MessageEvent<SpellWorkerRequest>) => {
  void dispatch(event.data).then((response) => {
    (self as unknown as Worker).postMessage(response);
  });
});

// Empty export keeps this file a module under `isolatedModules`.
export {};

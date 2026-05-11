/**
 * ADR-344 Phase 8 — Public types for the DXF spell-check engine.
 *
 * The spell-check engine runs in a dedicated Web Worker (`spell.worker.ts`)
 * with main-thread façade `spell-checker.ts`. This file is the shared
 * contract between the two — both the worker and the façade import from
 * here, no nspell types leak past the worker boundary.
 *
 * @module text-engine/spell/spell.types
 */

/** Supported dictionary languages — Phase 8 ships with el_GR + en_US. */
export type SpellLanguage = 'el' | 'en';

/**
 * One misspelled occurrence inside a checked text block. Offsets are
 * character positions into the ProseMirror flat text — the TipTap
 * SpellCheckExtension translates them to document positions when building
 * the `DecorationSet`.
 */
export interface MisspelledRange {
  readonly from: number;
  readonly to: number;
  readonly word: string;
  readonly language: SpellLanguage;
}

// ── Worker RPC: requests ─────────────────────────────────────────────────────

/** Worker bootstrap: hydrate per-company custom dictionary before first check. */
export interface SpellInitRequest {
  readonly type: 'init';
  readonly requestId: string;
  readonly languages: readonly SpellLanguage[];
  readonly customTerms: readonly CustomTermPayload[];
}

/** Run spell check over a flat text string. */
export interface SpellCheckRequest {
  readonly type: 'check';
  readonly requestId: string;
  readonly text: string;
  readonly languages: readonly SpellLanguage[];
}

/** Ask for the top-N suggestions for a single mis-spelled word. */
export interface SpellSuggestRequest {
  readonly type: 'suggest';
  readonly requestId: string;
  readonly word: string;
  readonly language: SpellLanguage;
  readonly limit: number;
}

/** Add a single term to the in-memory custom dictionary. */
export interface SpellAddWordRequest {
  readonly type: 'addWord';
  readonly requestId: string;
  readonly term: CustomTermPayload;
}

/** Remove a single term from the in-memory custom dictionary. */
export interface SpellRemoveWordRequest {
  readonly type: 'removeWord';
  readonly requestId: string;
  readonly term: CustomTermPayload;
}

export type SpellWorkerRequest =
  | SpellInitRequest
  | SpellCheckRequest
  | SpellSuggestRequest
  | SpellAddWordRequest
  | SpellRemoveWordRequest;

// ── Worker RPC: responses ────────────────────────────────────────────────────

export interface SpellInitResponse {
  readonly type: 'init';
  readonly requestId: string;
  readonly ok: true;
}

export interface SpellCheckResponse {
  readonly type: 'check';
  readonly requestId: string;
  readonly misspelled: readonly MisspelledRange[];
}

export interface SpellSuggestResponse {
  readonly type: 'suggest';
  readonly requestId: string;
  readonly suggestions: readonly string[];
}

export interface SpellAckResponse {
  readonly type: 'ack';
  readonly requestId: string;
  readonly ok: true;
}

export interface SpellErrorResponse {
  readonly type: 'error';
  readonly requestId: string;
  readonly message: string;
}

export type SpellWorkerResponse =
  | SpellInitResponse
  | SpellCheckResponse
  | SpellSuggestResponse
  | SpellAckResponse
  | SpellErrorResponse;

// ── Custom-term payload (subset of CustomDictionaryEntryDoc) ─────────────────

/**
 * Wire shape pushed into the worker for custom dictionary hydration /
 * incremental add. We intentionally do NOT pass full Firestore docs across
 * the postMessage boundary — only the matching key + language.
 */
export interface CustomTermPayload {
  readonly term: string;
  readonly language: SpellLanguage;
}

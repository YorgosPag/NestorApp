/**
 * ADR-344 Phase 8 — DXF Text Engine spell-check module barrel.
 *
 * Public API:
 *   - `getSpellChecker(options)` — lazy-spawned process-wide spell checker.
 *   - `disposeSpellChecker()` — tear down singleton (logout / tenant switch).
 *   - Type re-exports: `SpellLanguage`, `MisspelledRange`, `CustomTermPayload`.
 *
 * **DO NOT** import `nspell` or worker internals outside this directory —
 * `.ssot-registry.json` module `text-spell` blocks it at pre-commit.
 *
 * @module text-engine/spell
 */

export { getSpellChecker, disposeSpellChecker } from './spell-checker';
export type { SpellChecker, SpellCheckerOptions } from './spell-checker';
export type {
  CustomTermPayload,
  MisspelledRange,
  SpellLanguage,
} from './spell.types';
export type {
  CustomDictionaryEntryDoc,
  CreateCustomDictionaryEntryInput,
  UpdateCustomDictionaryEntryInput,
  CustomDictionaryActor,
} from './custom-dictionary.types';
export {
  CustomDictionaryNotFoundError,
  CustomDictionaryCrossTenantError,
  CustomDictionaryValidationError,
  CustomDictionaryDuplicateError,
} from './custom-dictionary.types';

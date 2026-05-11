/**
 * ADR-344 Phase 8 — Firestore document types for per-company custom
 * dictionary entries.
 *
 * The `text_custom_dictionary` collection stores company-scoped terms that
 * extend the bundled Hunspell dictionaries with CAD / architectural
 * vocabulary (e.g. «οπτοπλινθοδομή», «κουφώματα PVC»).
 *
 * The service in `custom-dictionary.service.ts` is the ONLY allowed writer —
 * `.ssot-registry.json` module `text-spell` blocks direct `setDoc` / `addDoc`
 * elsewhere.
 *
 * @module text-engine/spell/custom-dictionary.types
 */

import { Timestamp } from 'firebase-admin/firestore';
import type { SpellLanguage } from './spell.types';

/**
 * Persisted custom dictionary entry. Field order matches the write order in
 * `custom-dictionary.service.ts` so reader and writer see the same shape.
 */
export interface CustomDictionaryEntryDoc {
  readonly id: string;
  readonly companyId: string;
  readonly term: string;
  readonly language: SpellLanguage;

  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
  readonly createdBy: string;
  readonly createdByName: string | null;
  readonly updatedBy: string;
  readonly updatedByName: string | null;
}

/** Input payload for `createCustomDictionaryEntry`. */
export interface CreateCustomDictionaryEntryInput {
  readonly companyId: string;
  readonly term: string;
  readonly language: SpellLanguage;
}

/**
 * Patch payload for `updateCustomDictionaryEntry`. At least one of `term` or
 * `language` must be present — empty patches are rejected by the Zod schema.
 */
export interface UpdateCustomDictionaryEntryInput {
  readonly term?: string;
  readonly language?: SpellLanguage;
}

/** Identity for audit attribution. The service never invents this. */
export interface CustomDictionaryActor {
  readonly userId: string;
  readonly userName: string | null;
}

// ── Tagged errors (pattern-match instead of sniffing message strings) ────────

export class CustomDictionaryNotFoundError extends Error {
  readonly code = 'CUSTOM_DICTIONARY_NOT_FOUND' as const;
  constructor(entryId: string) {
    super(`Custom dictionary entry "${entryId}" not found.`);
    this.name = 'CustomDictionaryNotFoundError';
  }
}

export class CustomDictionaryCrossTenantError extends Error {
  readonly code = 'CUSTOM_DICTIONARY_CROSS_TENANT' as const;
  constructor(entryId: string, expectedCompanyId: string, actualCompanyId: string) {
    super(
      `Custom dictionary entry "${entryId}" belongs to company "${actualCompanyId}", not "${expectedCompanyId}".`,
    );
    this.name = 'CustomDictionaryCrossTenantError';
  }
}

export class CustomDictionaryValidationError extends Error {
  readonly code = 'CUSTOM_DICTIONARY_VALIDATION' as const;
  constructor(message: string, readonly issues: readonly string[]) {
    super(message);
    this.name = 'CustomDictionaryValidationError';
  }
}

/**
 * Raised when a term + language + companyId triple already exists. The
 * service is the sole authority on uniqueness — Firestore rules do not
 * enforce it because the index would be expensive and rules cannot run
 * cross-document predicates.
 */
export class CustomDictionaryDuplicateError extends Error {
  readonly code = 'CUSTOM_DICTIONARY_DUPLICATE' as const;
  constructor(term: string, language: SpellLanguage, companyId: string) {
    super(
      `Custom dictionary already contains "${term}" (${language}) for company "${companyId}".`,
    );
    this.name = 'CustomDictionaryDuplicateError';
  }
}

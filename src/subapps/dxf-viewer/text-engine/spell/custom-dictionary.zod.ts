/**
 * ADR-344 Phase 8 — Zod validation for custom-dictionary Firestore payloads.
 *
 * Validation rules:
 *   - `term` is 1-80 characters, trimmed non-empty, no whitespace inside
 *     (single-word dictionary entries — phrases are out of scope).
 *   - `language` ∈ {'el','en'} — Phase 8 ships these two; future ADR can
 *     extend the enum.
 *   - `companyId` non-empty string.
 *
 * Cross-document uniqueness (term + language + companyId) is enforced by
 * the service layer, not here — Zod does not have repository access.
 *
 * @module text-engine/spell/custom-dictionary.zod
 */

import { z } from 'zod';

export const CUSTOM_DICTIONARY_TERM_MIN = 1;
export const CUSTOM_DICTIONARY_TERM_MAX = 80;

const nonEmptyString = z.string().min(1, 'must be non-empty');

const termSchema = z
  .string()
  .min(CUSTOM_DICTIONARY_TERM_MIN, 'term must be non-empty')
  .max(CUSTOM_DICTIONARY_TERM_MAX, `term exceeds maximum length of ${CUSTOM_DICTIONARY_TERM_MAX} characters`)
  .refine((s) => s.trim() === s, { message: 'term must not have leading or trailing whitespace' })
  .refine((s) => !/\s/.test(s), { message: 'term must not contain whitespace (single-word entries only)' });

const languageSchema = z.enum(['el', 'en']);

/** Validation schema for `createCustomDictionaryEntry` input. */
export const createCustomDictionaryEntryInputSchema = z
  .object({
    companyId: nonEmptyString,
    term: termSchema,
    language: languageSchema,
  })
  .strict();

/**
 * Validation schema for `updateCustomDictionaryEntry` patches. At least one
 * field must be present — empty patches are rejected at the service layer.
 */
export const updateCustomDictionaryEntryInputSchema = z
  .object({
    term: termSchema.optional(),
    language: languageSchema.optional(),
  })
  .strict()
  .refine(
    (patch) => patch.term !== undefined || patch.language !== undefined,
    { message: 'update patch must contain at least one field' },
  );

/** Flat string list of failures — same shape as text-template.zod for parity. */
export function collectIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
    return `${path}: ${issue.message}`;
  });
}

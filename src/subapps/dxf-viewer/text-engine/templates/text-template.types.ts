/**
 * ADR-344 Phase 7.B — Firestore document types for user text templates.
 *
 * Mirrors {@link TextTemplate} (the canonical, tenant-agnostic shape used
 * by Phase 7.A built-ins + future Phase 7.D management UI) but narrows the
 * fields to the contract enforced by the Firestore `text_templates`
 * collection:
 *
 *   - `companyId` is required (never null — built-ins live in TS, not Firestore)
 *   - `isDefault` is always false (built-ins never round-trip through Firestore)
 *   - `createdAt` / `updatedAt` are admin-SDK Timestamps, not Date
 *   - audit denormalization fields populated by the service on every write
 *
 * The service in `text-template.service.ts` is the ONLY allowed writer —
 * `.ssot-registry.json` module `text-templates` blocks direct setDoc/addDoc
 * elsewhere.
 */

import { Timestamp } from 'firebase-admin/firestore';
import type {
  TextTemplateCreateFields,
  TextTemplateUpdateFields,
  UserTextTemplateFields,
} from './template.types';

/**
 * Persisted text-template document — το κοινό σχήμα {@link UserTextTemplateFields} με τον
 * χρόνο σε admin-SDK `Timestamp`. Η wire όψη (`SerializedUserTextTemplate`, ISO strings)
 * είναι το ίδιο σχήμα με `string` — μία λίστα πεδίων, δύο κόσμοι (N.18).
 */
export type UserTextTemplateDoc = UserTextTemplateFields<Timestamp>;

/**
 * Input payload for `createTextTemplate` — τα user-provided πεδία
 * ({@link TextTemplateCreateFields}, ο SSoT) + το server-provided `companyId`.
 * `placeholders` είναι επίσης server-derived (εξάγεται από το `content` μέσω του Phase 7.A
 * `extractPlaceholders`) ώστε ο caller να μη μπορεί να αποκλίνει τη δηλωμένη λίστα.
 */
export interface CreateTextTemplateInput extends TextTemplateCreateFields {
  readonly companyId: string;
}

/**
 * Patch payload for `updateTextTemplate` — ίδια πηγή με τον client payload
 * ({@link TextTemplateUpdateFields}). Οι scope locators (`companyId` + `templateId`) περνούν
 * ως χωριστά args. `placeholders` server-derived όταν αλλάζει το `content`.
 */
export type UpdateTextTemplateInput = TextTemplateUpdateFields;

/** Identity for audit attribution. The service never invents this. */
export interface TextTemplateActor {
  readonly userId: string;
  readonly userName: string | null;
}

/**
 * Tagged-error union for the service — callers pattern-match instead of
 * sniffing `Error.message` strings.
 */
export class TextTemplateNotFoundError extends Error {
  readonly code = 'TEXT_TEMPLATE_NOT_FOUND' as const;
  constructor(templateId: string) {
    super(`Text template "${templateId}" not found.`);
    this.name = 'TextTemplateNotFoundError';
  }
}

export class TextTemplateCrossTenantError extends Error {
  readonly code = 'TEXT_TEMPLATE_CROSS_TENANT' as const;
  constructor(templateId: string, expectedCompanyId: string, actualCompanyId: string) {
    super(
      `Text template "${templateId}" belongs to company "${actualCompanyId}", not "${expectedCompanyId}".`,
    );
    this.name = 'TextTemplateCrossTenantError';
  }
}

export class TextTemplateValidationError extends Error {
  readonly code = 'TEXT_TEMPLATE_VALIDATION' as const;
  constructor(message: string, readonly issues: readonly string[]) {
    super(message);
    this.name = 'TextTemplateValidationError';
  }
}

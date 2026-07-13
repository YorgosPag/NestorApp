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
import type { DxfTextNode } from '../types/text-ast.types';
import type {
  TextTemplateCategory,
  TextTemplateTitleBlockMeta,
  UserTextTemplateFields,
  WritableTextTemplateScope,
} from './template.types';

/**
 * Persisted text-template document — το κοινό σχήμα {@link UserTextTemplateFields} με τον
 * χρόνο σε admin-SDK `Timestamp`. Η wire όψη (`SerializedUserTextTemplate`, ISO strings)
 * είναι το ίδιο σχήμα με `string` — μία λίστα πεδίων, δύο κόσμοι (N.18).
 */
export type UserTextTemplateDoc = UserTextTemplateFields<Timestamp>;

/**
 * Input payload for `createTextTemplate` — same shape as the persisted doc
 * minus the server-controlled fields (`id`, timestamps, audit fields,
 * `isDefault`). `placeholders` is also server-derived (extracted from
 * `content` via Phase 7.A `extractPlaceholders`) so callers cannot drift
 * the declared list out of sync with the actual placeholder tokens.
 */
export interface CreateTextTemplateInput {
  readonly companyId: string;
  readonly name: string;
  readonly category: TextTemplateCategory;
  readonly content: DxfTextNode;
  /** ADR-651 Φάση Θ — default {@link DEFAULT_TEXT_TEMPLATE_SCOPE} (βιβλιοθήκη γραφείου). */
  readonly scope?: WritableTextTemplateScope;
  /** Υποχρεωτικό όταν `scope === 'project'` (αλλιώς αγνοείται). */
  readonly projectId?: string;
  /** Η προέλευση, όταν το πρότυπο **αποσπάται** από γονιό (must-have #1). */
  readonly parentId?: string;
  /** Το `updatedAt` του γονιού τη στιγμή της απόσπασης (ms). */
  readonly parentSyncedAt?: number;
  readonly titleBlock?: TextTemplateTitleBlockMeta;
}

/**
 * Patch payload for `updateTextTemplate`. All fields optional except the
 * scope locators (`companyId` + `templateId` are passed as separate args).
 * `placeholders` is again server-derived when `content` is patched.
 */
export interface UpdateTextTemplateInput {
  readonly name?: string;
  readonly category?: TextTemplateCategory;
  readonly content?: DxfTextNode;
  /** «Δημοσίευση» σε άλλο scope (π.χ. δικά μου → γραφείου) — ίδιο doc, ΟΧΙ αντίγραφο. */
  readonly scope?: WritableTextTemplateScope;
  readonly projectId?: string;
  /** Ανανεώνεται στο ρητό «Ενημέρωση από τον γονιό» (pull) — μαζί με το `content`. */
  readonly parentSyncedAt?: number;
  readonly titleBlock?: TextTemplateTitleBlockMeta;
}

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

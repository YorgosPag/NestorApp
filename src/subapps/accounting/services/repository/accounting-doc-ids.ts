/**
 * @fileoverview Accounting Settings — Per-Tenant Doc-ID Convention (SSoT)
 * @description Single source of truth for the composite document ids used by the
 *              accounting sibling singletons inside the shared `accounting_settings`
 *              collection. Each tenant gets its own document per singleton type via a
 *              deterministic suffix convention: `accounting_settings/{companyId}__{type}`.
 *
 * Why a suffix (and not a subcollection): the existing Firestore rules for
 * `accounting_settings/{docId}` are *gate-by-body-companyId* (they read
 * `resource.data.companyId`, never the doc id). Composite doc ids that carry a bare
 * `companyId` field therefore pass with ZERO rules change and ZERO index change.
 *
 * The `__` separator never appears inside enterprise ids (`comp_<uuid>`), so there is
 * no ambiguity between the company id and the type suffix.
 *
 * @author Claude Code (Anthropic AI) + Giorgos Pagonis
 * @created 2026-06-10
 * @see ADR-439 Tenant Identity SSoT & Provisioning — Phase 2c
 * @see N.6 — deterministic doc id + setDoc (never addDoc)
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

/**
 * The accounting sibling singletons that became per-tenant in ADR-439 Phase 2c.
 * The string value doubles as the doc-id suffix AND the legacy global doc id
 * (the migration source), keeping a single token per type.
 */
export type AccountingSingletonType =
  | 'partners'
  | 'members'
  | 'shareholders'
  | 'service_presets'
  | 'matching_config';

/** Separator between the tenant id and the singleton type in the composite doc id. */
const ACCOUNTING_DOC_ID_SEPARATOR = '__';

/**
 * Build the per-tenant document id for an accounting settings singleton.
 *
 * @example accountingDocId('comp_9c7c…', 'partners') → 'comp_9c7c…__partners'
 */
export function accountingDocId(companyId: string, type: AccountingSingletonType): string {
  return `${companyId}${ACCOUNTING_DOC_ID_SEPARATOR}${type}`;
}

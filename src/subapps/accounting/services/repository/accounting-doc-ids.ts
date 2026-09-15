/**
 * @fileoverview Accounting Settings — Per-Tenant Doc-ID Convention (SSoT)
 * @description Single source of truth for the composite document ids used by the
 *              accounting sibling singletons inside the shared `accounting_settings`
 *              collection. Each tenant gets its own document per singleton type via a
 *              deterministic suffix convention: `accounting_settings/{companyId}__{type}`.
 *
 * Why a suffix (and not a subcollection): the Firestore rules for
 * `accounting_settings/{docId}` gate READS by body `companyId`, so composite doc ids
 * that carry a bare `companyId` field need no index change.
 *
 * WRITES are narrower (ADR-841 §7 Α23 Γ3β, 2026-09-15): the browser may create/update
 * ONLY `{companyId}__<type>` for the types in `CLIENT_WRITABLE_ACCOUNTING_SINGLETONS`,
 * with the doc id BOUND to its own `companyId`. Everything else — the company profile
 * `{companyId}` (legal identity) above all — is server-only (Admin SDK), so every change
 * goes through the field mask + audit trail of one transaction.
 *
 * The `__` separator never appears inside enterprise ids (`comp_<uuid>`), so there is
 * no ambiguity between the company id and the type suffix.
 *
 * @author Claude Code (Anthropic AI) + Giorgos Pagonis
 * @created 2026-06-10
 * @see ADR-439 Tenant Identity SSoT & Provisioning — Phase 2c
 * @see ADR-841 §7 Α23 — Γ3β client-write allowlist
 * @see N.6 — deterministic doc id + setDoc (never addDoc)
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

/**
 * The accounting sibling singletons that became per-tenant in ADR-439 Phase 2c.
 * The string value doubles as the doc-id suffix AND the legacy global doc id
 * (the migration source), keeping a single token per type.
 */
export const ACCOUNTING_SINGLETON_TYPES = [
  'partners',
  'members',
  'shareholders',
  'service_presets',
  'matching_config',
] as const;

export type AccountingSingletonType = (typeof ACCOUNTING_SINGLETON_TYPES)[number];

/**
 * The ONLY singletons the browser may write directly (web SDK) — mirrored by
 * `isClientWritableAccountingSetting` in `firestore.rules`. Default-deny: a type that is
 * not listed here is server-only. The rules suite
 * (`tests/firestore-rules/suites/accounting-settings.rules.test.ts`) iterates BOTH lists
 * against the emulator, so adding a type here without the rule — or the rule without
 * the type — turns it red.
 */
export const CLIENT_WRITABLE_ACCOUNTING_SINGLETONS: readonly AccountingSingletonType[] = [
  'matching_config',
];

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

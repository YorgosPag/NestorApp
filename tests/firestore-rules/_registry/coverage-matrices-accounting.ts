/**
 * Firestore Rules Test Coverage — Accounting Matrix Builders (Phase C.1)
 *
 * Matrix functions for the accounting collections added in ADR-298 Phase C.1
 * (2026-04-13). Extracted from `coverage-matrices.ts` per the Google SRP
 * 500-line rule — the parent module hit the limit when Phase C.1 functions
 * were added.
 *
 * The four patterns here correspond to the four rule shapes found in
 * `firestore.rules` lines 3111–3177 (Pattern C/D/E/F in the accounting block):
 *   - `fiscalPeriodMatrix`        → Pattern C: Q8 SAP state-machine
 *   - `accountingSingletonMatrix` → Pattern D: settings singletons (admin-write)
 *   - `denyAllMatrix`             → Pattern E: server-only, no client access
 *   - `accountingSystemCalcMatrix`→ Pattern F: system-calculated balances
 *
 * @module tests/firestore-rules/_registry/coverage-matrices-accounting
 * @since 2026-04-13 (ADR-298 Phase C.1)
 */

import type { CoverageCell } from './coverage-manifest';
// ⚠️ Κυκλική εισαγωγή (το `coverage-matrices` επανεξάγει αυτό το αρχείο): ασφαλής, γιατί
// τα `cell`/`roleDualMatrix` καλούνται μόνο **μέσα** σε συναρτήσεις, ποτέ στη φόρτωση.
import { cell, roleDualMatrix } from './coverage-matrices';
import { defineMatrix, overrideDefinition, type CoverageDefinition } from './coverage-completeness';
import {
  anonymousUnmeasured,
  crossTenantAdminUnmeasured,
  crossTenantUserUnmeasured,
  externalUserOpenDecision,
  sameTenantUserPerCollection,
} from './coverage-exemptions';

// ---------------------------------------------------------------------------
// ADR-298 Phase C.1 — remaining accounting collections
// ---------------------------------------------------------------------------

/**
 * Matrix for `accounting_fiscal_periods` — Q8 SAP-pattern state machine.
 *
 * Key deltas from `roleDualMatrix()`:
 *   - create: `isCompanyAdminOfCompany(companyId) && companyId==getUserCompanyId()`.
 *     super_admin passes `isCompanyAdminOfCompany` (via `isSuperAdminOnly`) but
 *     fails `getUserCompanyId()=='company-a'` (their claim is 'company-root') →
 *     denied (cross_tenant). same_tenant_user fails `isCompanyAdminOfCompany`
 *     (internal_user role) → denied (insufficient_role).
 *   - update: `isInternalUserOfCompany(companyId) && companyId immutable &&
 *     state-machine gate`. Test seeds an OPEN doc and writes a same-status delta
 *     (`updatedAt`) so every internal-user persona exercises the first arm
 *     (status not changing → allow). super_admin reaches `isInternalUserOfCompany`
 *     via `isSuperAdminOnly()` → allowed.
 *   - delete: `if false` → server_only for all personas.
 *
 * See ADR-298 §4 Phase C.1 (2026-04-13).
 */
export function fiscalPeriodMatrix(): CoverageDefinition {
  return overrideDefinition(roleDualMatrix(), adminCreateNoDeleteCells(), 'fiscalPeriodMatrix');
}

/**
 * Κοινή διαφορά του `fiscalPeriodMatrix` και του `accountingSingletonMatrix` από τον
 * `roleDualMatrix` — δηλωμένη **ΜΙΑ** φορά (ADR-841 §7 Α23.6: ήταν 4 κλώνοι / 502 tokens).
 *
 *   - create: ο κανόνας ζητά **διαχειριστή** εταιρείας ⇒ `same_tenant_user` (internal_user)
 *     αρνείται με `insufficient_role`. Οι αναγνώσεις, το create των υπολοίπων και οι
 *     εξαιρέσεις είναι **ταυτόσημα** με τον `roleDualMatrix` (επαληθευμένο κελί προς κελί).
 *   - delete: `if false` ⇒ `server_only` για **όλα** τα personas.
 *
 * ⚠️ Ο singleton **δεν** χτίζεται πάνω στον fiscal: οι δύο κανόνες είναι ανεξάρτητοι, και
 * αλλαγή στον έναν δεν πρέπει να μετακινεί σιωπηλά τα κελιά του άλλου.
 */
function adminCreateNoDeleteCells(): readonly CoverageCell[] {
  // Το delete παράγεται από τα κελιά delete **της βάσης**: «κάθε persona που μετριέται» —
  // ούτε δεύτερη λίστα personas, ούτε κλώνος πέντε γραμμών (N.18).
  const forbiddenDeletes = roleDualMatrix()
    .matrix.filter((c) => c.operation === 'delete')
    .map((c) => cell(c.persona, 'delete', 'deny', 'server_only'));
  return [cell('same_tenant_user', 'create', 'deny', 'insufficient_role'), ...forbiddenDeletes];
}

/**
 * `accounting_settings` — Pattern D **plus a client-write allowlist** (ADR-841 §7 Α23 Γ3β).
 *
 * The browser may write ONLY `{companyId}__<type>` for the types in
 * `CLIENT_WRITABLE_ACCOUNTING_SINGLETONS`; everything else (the company profile above
 * all) is server-only. The harness `create` cell writes to a FRESH id
 * (`<docId>-create-<ts>`) — a document outside the allowlist — so it is now denied for
 * EVERY persona (`server_only`). That is the truth, not a gap: the browser cannot mint
 * arbitrary settings documents. Creating the allowlisted document is asserted
 * explicitly in the suite, once per allowlisted type. Read/update cells run against
 * `{companyId}__matching_config`.
 */
export function accountingSettingsMatrix(): CoverageDefinition {
  return overrideDefinition(
    accountingSingletonMatrix(),
    [cell('same_tenant_admin', 'create', 'deny', 'server_only')],
    'accountingSettingsMatrix',
  );
}

/**
 * Matrix for accounting settings singletons (`accounting_efka_config`, and the base of
 * `accountingSettingsMatrix`) — admin-only write, internal-user read.
 *
 * Rule shape (Pattern D):
 *   - read:   `isAuthenticated() && (isSuperAdminOnly() || isInternalUserOfCompany(companyId))`
 *   - create: `isCompanyAdmin() && companyId == getUserCompanyId()`
 *     super_admin: `isCompanyAdmin()`=true (role=super_admin) but getUserCompanyId()=
 *     'company-root' != 'company-a' → deny (cross_tenant). same_tenant_user:
 *     `isCompanyAdmin()`=false (internal_user) → deny (insufficient_role).
 *   - update: `canWriteAccountingSingleton(companyId)` = `isCompanyAdminOfCompany(companyId)`
 *     → same_tenant_user denied (insufficient_role), super_admin allowed via
 *     `isSuperAdminOnly()` short-circuit.
 *   - delete: `if false` → server_only for all.
 *
 * See ADR-298 §4 Phase C.1 (2026-04-13).
 */
export function accountingSingletonMatrix(): CoverageDefinition {
  return overrideDefinition(roleDualMatrix(), [
    ...adminCreateNoDeleteCells(),
    // Update: canWriteAccountingSingleton = isCompanyAdminOfCompany — role floor = company_admin
    cell('same_tenant_user', 'update', 'deny', 'insufficient_role'),
  ], 'accountingSingletonMatrix');
}

/**
 * Matrix for completely server-managed collections (`accounting_invoice_counters`).
 *
 * Rule: `allow read, write: if false` — no client access whatsoever.
 * All operations for all personas are denied with `server_only` reason.
 *
 * The distinction from `immutableMatrix()` is that **reads are also blocked**
 * (invoice counters contain internal sequencing data; only the Admin SDK
 * increments and reads them server-side).
 *
 * See ADR-298 §4 Phase C.1 (2026-04-13).
 */
export function denyAllMatrix(): CoverageDefinition {
  return defineMatrix('denyAllMatrix', [
    cell('super_admin', 'read', 'deny', 'server_only'),
    cell('super_admin', 'list', 'deny', 'server_only'),
    cell('same_tenant_admin', 'read', 'deny', 'server_only'),
    cell('same_tenant_admin', 'list', 'deny', 'server_only'),
    cell('same_tenant_user', 'read', 'deny', 'server_only'),
    cell('cross_tenant_admin', 'read', 'deny', 'server_only'),
    cell('anonymous', 'read', 'deny', 'server_only'),
    cell('super_admin', 'create', 'deny', 'server_only'),
    cell('same_tenant_admin', 'create', 'deny', 'server_only'),
    cell('same_tenant_user', 'create', 'deny', 'server_only'),
    cell('anonymous', 'create', 'deny', 'server_only'),
    cell('super_admin', 'update', 'deny', 'server_only'),
    cell('same_tenant_admin', 'update', 'deny', 'server_only'),
    cell('super_admin', 'delete', 'deny', 'server_only'),
    cell('same_tenant_admin', 'delete', 'deny', 'server_only'),
  ], [
    ...sameTenantUserPerCollection(['list', 'update', 'delete']),
    ...crossTenantAdminUnmeasured(['list', 'create', 'update', 'delete']),
    ...crossTenantUserUnmeasured(['read', 'list', 'create', 'update', 'delete']),
    ...anonymousUnmeasured(['list', 'update', 'delete']),
    ...externalUserOpenDecision(['read', 'list', 'create', 'update', 'delete']),
  ]);
}

/**
 * Matrix for system-calculated accounting collections (`accounting_customer_balances`).
 *
 * Rule shape (Pattern F):
 *   - read:   `canReadAccounting(companyId)` — identical to roleDualMatrix reads.
 *   - create: `canCreateAccountingSystem()` = `isInternalUser() && companyId==getUserCompanyId()`.
 *     No `createdBy==uid` requirement (system-generated, no human author).
 *     super_admin's companyId 'company-root' ≠ 'company-a' → denied (cross_tenant).
 *   - update: `canUpdateAccountingSystem(companyId)` = `isInternalUserOfCompany(companyId)`
 *     + companyId immutable. All internal personas allowed; super_admin via
 *     `isSuperAdminOnly()` inside `isInternalUserOfCompany`.
 *   - delete: `isCompanyAdminOfCompany(companyId)` — admin cleans up stale balances.
 *     same_tenant_user denied (insufficient_role), cross_tenant denied.
 *
 * See ADR-298 §4 Phase C.1 (2026-04-13).
 */
export function accountingSystemCalcMatrix(): CoverageDefinition {
  return overrideDefinition(roleDualMatrix(), [
    // Delete: isCompanyAdminOfCompany — admin-only cleanup (roleDual lets the author delete)
    cell('same_tenant_user', 'delete', 'deny', 'insufficient_role'),
  ], 'accountingSystemCalcMatrix');
}

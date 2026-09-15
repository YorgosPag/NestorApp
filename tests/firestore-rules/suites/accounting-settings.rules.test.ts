/**
 * Firestore Rules — `accounting_settings` collection
 *
 * Pattern: accounting_singleton (Pattern D) **+ client-write allowlist**
 * (ADR-841 §7 Α23 Γ3β, 2026-09-15).
 *
 * Read gate: `isAuthenticated() && (isSuperAdminOnly() || isInternalUserOfCompany(companyId))`.
 * All internal-user personas can read; cross_tenant_admin denied. (Unchanged.)
 *
 * Create/update gate: the Pattern D role/tenant gate **AND**
 * `isClientWritableAccountingSetting(docId, companyId)` — the doc id must be
 * `{companyId}__<type>` for a type in `CLIENT_WRITABLE_ACCOUNTING_SINGLETONS`.
 * ⇒ the company profile `{companyId}` (legal identity), the legacy global docs and the
 *   server-owned singletons are server-only (Admin SDK bypasses rules); the browser
 *   cannot squat another tenant's `{B}__matching_config` either.
 *
 * The matrix runs on `{companyId}__matching_config`. Its `create` cell targets a fresh
 * id outside the allowlist ⇒ deny for all (`accountingSettingsMatrix`). The explicit
 * blocks below iterate the TypeScript SSoT (`accounting-doc-ids.ts`) against the
 * emulator, so the rule and the constant cannot drift apart silently.
 *
 * Delete gate: `if false` — singleton lifecycle is admin-managed via Admin SDK.
 *
 * @since 2026-04-13 (ADR-298 Phase C.1) · allowlist 2026-09-15 (ADR-841 §7 Α23)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, expectAllow, expectDeny, type AssertTarget } from '../_harness/assertions';
import { seedAccountingSettings } from '../_harness/seed-helpers-accounting';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { CROSS_TENANT_COMPANY_ID, SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import {
  ACCOUNTING_SINGLETON_TYPES,
  CLIENT_WRITABLE_ACCOUNTING_SINGLETONS,
  accountingDocId,
} from '../../../src/subapps/accounting/services/repository/accounting-doc-ids';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'accounting_settings',
)!;

const COLLECTION = 'accounting_settings';

/** The document the matrix exercises — an allowlisted, same-tenant singleton. */
const MATRIX_DOC_ID = accountingDocId(SAME_TENANT_COMPANY_ID, CLIENT_WRITABLE_ACCOUNTING_SINGLETONS[0]);

/** Legacy global profile doc id (`SYSTEM_DOCS.ACCT_COMPANY_PROFILE`) — the migration source. */
const LEGACY_GLOBAL_PROFILE_DOC_ID = 'company_profile';

/**
 * Every document the browser must NOT write, derived from the SSoT: the tenant's
 * company profile, the legacy global profile, and each singleton type that is not
 * client-writable.
 */
const SERVER_ONLY_DOC_IDS: readonly string[] = [
  SAME_TENANT_COMPANY_ID,
  LEGACY_GLOBAL_PROFILE_DOC_ID,
  ...ACCOUNTING_SINGLETON_TYPES
    .filter((type) => !CLIENT_WRITABLE_ACCOUNTING_SINGLETONS.includes(type))
    .map((type) => accountingDocId(SAME_TENANT_COMPANY_ID, type)),
];

function settingsDoc(env: RulesTestEnvironment, persona: 'same_tenant_admin' | 'super_admin', docId: string) {
  return getContext(env, persona).firestore().collection(COLLECTION).doc(docId);
}

describe('accounting_settings.rules — accounting_singleton (Pattern D) + client-write allowlist', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        // Seed with companyId so the `resource.data.keys().hasAny(['companyId'])`
        // guard on update passes, and the read rule's isInternalUserOfCompany arm fires.
        await seedAccountingSettings(env, MATRIX_DOC_ID);

        const ctx = getContext(env, cell.persona);

        const target: AssertTarget = {
          collection: COLLECTION,
          docId: MATRIX_DOC_ID,
          // Update delta: companyId stays the same (immutable guard satisfied).
          data: { vatRate: 0.24, companyId: SAME_TENANT_COMPANY_ID },
          createData: {
            vatRate: 0.24,
            currency: 'EUR',
            companyId: SAME_TENANT_COMPANY_ID,
            createdAt: new Date(),
          },
          listFilter: { field: 'companyId', op: '==', value: SAME_TENANT_COMPANY_ID },
        };

        await assertCell(ctx, cell, target);
      });
    });
  }

  // ── Γ3β: default-deny — only the server writes what is not allowlisted ────────
  describe('server-only documents (company profile, legacy, server singletons)', () => {
    for (const docId of SERVER_ONLY_DOC_IDS) {
      it(`${docId} × create by same_tenant_admin → deny`, async () => {
        await expectDeny(settingsDoc(env, 'same_tenant_admin', docId).set({
          businessName: 'Παράκαμψη μάσκας',
          companyId: SAME_TENANT_COMPANY_ID,
        }));
      });

      it(`${docId} × update by same_tenant_admin and super_admin → deny`, async () => {
        await seedAccountingSettings(env, docId);
        await expectDeny(settingsDoc(env, 'same_tenant_admin', docId).update({ businessName: 'Χωρίς ίχνος' }));
        await expectDeny(settingsDoc(env, 'super_admin', docId).update({ businessName: 'Χωρίς ίχνος' }));
      });
    }

    it('company profile × read by same_tenant_user → still allow (reads unchanged)', async () => {
      await seedAccountingSettings(env, SAME_TENANT_COMPANY_ID);
      const ref = getContext(env, 'same_tenant_user').firestore().collection(COLLECTION).doc(SAME_TENANT_COMPANY_ID);
      await expectAllow(ref.get());
    });
  });

  // ── Γ3β: the allowlist keeps working exactly as the browser uses it ──────────
  describe('client-writable singletons (useMatchingConfig: setDoc merge)', () => {
    for (const type of CLIENT_WRITABLE_ACCOUNTING_SINGLETONS) {
      const docId = accountingDocId(SAME_TENANT_COMPANY_ID, type);

      it(`${docId} × first save (create via set merge) by same_tenant_admin → allow`, async () => {
        await expectAllow(settingsDoc(env, 'same_tenant_admin', docId).set(
          { autoMatchThreshold: 95, companyId: SAME_TENANT_COMPANY_ID },
          { merge: true },
        ));
      });

      it(`${docId} × later save (update via set merge) by same_tenant_admin → allow`, async () => {
        await seedAccountingSettings(env, docId);
        await expectAllow(settingsDoc(env, 'same_tenant_admin', docId).set(
          { autoMatchThreshold: 90, companyId: SAME_TENANT_COMPANY_ID },
          { merge: true },
        ));
      });
    }
  });

  // ── Γ3β: the doc id is bound to the writer's own tenant (no squatting) ────────
  describe('tenant binding of the document id', () => {
    const foreignDocId = accountingDocId(CROSS_TENANT_COMPANY_ID, CLIENT_WRITABLE_ACCOUNTING_SINGLETONS[0]);

    it(`${foreignDocId} × create by same_tenant_admin with its OWN companyId → deny (squat)`, async () => {
      await expectDeny(settingsDoc(env, 'same_tenant_admin', foreignDocId).set({
        autoMatchThreshold: 0,
        companyId: SAME_TENANT_COMPANY_ID,
      }));
    });

    it(`${foreignDocId} × create by same_tenant_admin with the FOREIGN companyId → deny`, async () => {
      await expectDeny(settingsDoc(env, 'same_tenant_admin', foreignDocId).set({
        autoMatchThreshold: 0,
        companyId: CROSS_TENANT_COMPANY_ID,
      }));
    });
  });
});

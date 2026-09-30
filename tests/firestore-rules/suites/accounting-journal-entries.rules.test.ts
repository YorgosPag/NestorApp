/**
 * Firestore Rules — `accounting_journal_entries` collection
 *
 * Pattern: role_dual — identical rule shape to `accounting_invoices`.
 * Reads via `canReadAccounting` (super_admin + internal users of same tenant);
 * creates via `canCreateAccounting` (companyId match + createdBy==uid);
 * updates via `canUpdateAccounting` (uid==createdBy OR isCompanyAdminOfCompany,
 * companyId immutable); deletes via `canDeleteAccounting`.
 *
 * Same test design as `accounting-invoices.rules.test.ts`:
 *   - Seed doc: createdBy = PERSONA_CLAIMS.same_tenant_user.uid
 *   - Per-persona createData: companyId fixed to SAME_TENANT_COMPANY_ID,
 *     createdBy = persona's own uid
 *
 * See ADR-298 §4 Phase B.2 (2026-04-13).
 *
 * @since 2026-04-13 (ADR-298 Phase B.2)
 */

import {
  initEmulator,
  teardownEmulator,
  resetData,
} from '../_harness/emulator';
import { getContext, getSignInContext } from '../_harness/auth-contexts';
import {
  assertCell,
  expectAllow,
  expectDeny,
  type AssertTarget,
} from '../_harness/assertions';
import { seedAccountingJournalEntry } from '../_harness/seed-helpers';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import {
  PERSONA_CLAIMS,
  SAME_TENANT_COMPANY_ID,
} from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'accounting_journal_entries',
)!;

describe('accounting_journal_entries.rules — role_dual (ΚΦΔ Q3/Q4)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => {
    env = await initEmulator();
  });

  afterAll(async () => {
    await teardownEmulator(env);
  });

  afterEach(async () => {
    await resetData(env);
  });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        const docId = 'journal-same-tenant';

        // Seed with same_tenant_user as createdBy so the uid==createdBy update/delete
        // leg is exercised for the same_tenant_user persona.
        await seedAccountingJournalEntry(env, docId);

        const ctx = getContext(env, cell.persona);

        // Per-persona createData: companyId fixed to SAME_TENANT_COMPANY_ID,
        // createdBy = persona's own uid (satisfies `createdBy == request.auth.uid`).
        const personaClaims =
          cell.persona !== 'anonymous' ? PERSONA_CLAIMS[cell.persona] : null;
        const createData = {
          description: `Journal entry create-${cell.persona}`,
          debit: 200,
          credit: 200,
          companyId: SAME_TENANT_COMPANY_ID,
          createdBy: personaClaims?.uid ?? 'anon-uid',
          createdAt: new Date(),
        };

        const target: AssertTarget = {
          collection: 'accounting_journal_entries',
          docId,
          data: { updatedAt: new Date() },
          createData,
          listFilter: {
            field: 'companyId',
            op: '==',
            value: SAME_TENANT_COMPANY_ID,
          },
        };

        await assertCell(ctx, cell, target);
      });
    });
  }

  // ── ADR-894 §10.7 — ο κλάδος «ο δημιουργός τα δικά του» ────────────────────
  // Ήταν σκέτο `request.auth.uid == createdBy` στα `canUpdateAccounting`/`canDeleteAccounting` (κοινά σε 13
  // συλλογές `accounting_*`): το ΜΟΝΟ σημείο του αρχείου που παρέκαμπτε τη ρίζα `isAuthenticated()` — και
  // άφηνε τον ΠΡΩΗΝ μέλος να αλλάζει/σβήνει δικές του εγγραφές μετά την αποχώρηση.
  describe('ο δημιουργός — μόνο ΟΣΟ είναι μέλος και η σύνδεσή του ζει (ADR-894 §10.7)', () => {
    const SIGN_IN = 1_790_000_000;
    const entryOf = (ctx: ReturnType<typeof getContext>) =>
      ctx.firestore().collection('accounting_journal_entries').doc('journal-creator');
    const update = { companyId: SAME_TENANT_COMPANY_ID, updatedAt: new Date() };

    it('Λ1 🔴 πρώην μέλος (δημιουργός, τώρα σε άλλη εταιρεία) ⇒ DENY ενημέρωση ΚΑΙ διαγραφή', async () => {
      await seedAccountingJournalEntry(env, 'journal-creator', { createdByUid: PERSONA_CLAIMS.cross_tenant_user.uid });
      const exMember = getContext(env, 'cross_tenant_user');
      await expectDeny(entryOf(exMember).update(update));
      await expectDeny(entryOf(exMember).delete());
    });

    it('Λ2 🔴 δημιουργός με ΑΝΑΚΛΗΜΕΝΗ σύνδεση ⇒ DENY', async () => {
      await seedAccountingJournalEntry(env, 'journal-creator');
      const revoked = getSignInContext(env, 'same_tenant_user', { authTime: SIGN_IN, revokedSignIns: [SIGN_IN] });
      await expectDeny(entryOf(revoked).update(update));
      await expectDeny(entryOf(revoked).delete());
    });

    it('Λ3 — δημιουργός, μέλος, ζωντανή σύνδεση ⇒ ALLOW (αμετάβλητη συμπεριφορά)', async () => {
      await seedAccountingJournalEntry(env, 'journal-creator');
      const live = getSignInContext(env, 'same_tenant_user', { authTime: SIGN_IN, revokedSignIns: [SIGN_IN + 1] });
      await expectAllow(entryOf(live).update(update));
    });
  });
});

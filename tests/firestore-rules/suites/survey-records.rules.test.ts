/**
 * Firestore Rules — `survey_records` collection (ADR-759 Φ2)
 *
 * Pattern: `tenant_direct` with two declared departures (see the manifest entry):
 * a plain tenant user may author and edit but not delete, and cross-tenant is
 * closed on every operation rather than only the ones the canonical matrix lists.
 *
 * 🔑 The matrix is the floor, not the ceiling. The rule that actually justifies
 * ADR-759 Q1 — *a confirmed survey record is frozen* — is not a (persona × op)
 * cell at all: it depends on document STATE, which no matrix expresses. The
 * `confirmation freeze` block below exercises it directly. Without those cases,
 * this suite would be fully green while the freeze did nothing.
 *
 * @since 2026-08-05 (ADR-759 Φ2)
 */

import {
  initEmulator,
  teardownEmulator,
  resetData,
} from '../_harness/emulator';
import { getContext, withSeedContext } from '../_harness/auth-contexts';
import {
  assertCell,
  expectAllow,
  expectDeny,
  type AssertTarget,
} from '../_harness/assertions';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import {
  SAME_TENANT_COMPANY_ID,
  CROSS_TENANT_COMPANY_ID,
} from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'survey_records',
)!;

const PROJECT_ID = 'proj_survey_seed';

/**
 * Minimal but shape-faithful record. Only the fields the RULES read are
 * meaningful here (`companyId`, `projectId`, `confirmedBy`, `createdBy`,
 * `createdAt`); `plotArea` stands in for "any transcribed content".
 */
function surveyDoc(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    companyId: SAME_TENANT_COMPANY_ID,
    projectId: PROJECT_ID,
    sourceFileName: 'G753_ergasia F.dxf',
    plotArea: { value: 1364.05, provenance: 'user' },
    reconciliations: [],
    confirmedBy: null,
    confirmedAt: null,
    createdBy: 'persona-same-user',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

async function seedSurveyRecord(
  env: RulesTestEnvironment,
  docId: string,
  overrides: Record<string, unknown> = {},
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx
      .firestore()
      .collection('survey_records')
      .doc(docId)
      .set(surveyDoc(overrides));
  });
}

describe('survey_records.rules — tenant_direct + confirmation freeze', () => {
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

  // -------------------------------------------------------------------------
  // Matrix cells — persona × operation
  // -------------------------------------------------------------------------
  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        const docId = 'srv_seed_test';
        // Seeded as a DRAFT: the freeze is state-dependent, and the matrix
        // describes the editable regime.
        await seedSurveyRecord(env, docId);

        const ctx = getContext(env, cell.persona);
        const target: AssertTarget = {
          collection: 'survey_records',
          docId,
          data: { updatedAt: new Date().toISOString() },
          createData: surveyDoc(),
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

  // -------------------------------------------------------------------------
  // Confirmation freeze — the reason this is its own collection (ADR-759 Q1)
  // -------------------------------------------------------------------------
  describe('confirmation freeze', () => {
    const CONFIRMED = {
      confirmedBy: 'persona-same-admin',
      confirmedAt: new Date().toISOString(),
    };

    it('allows content edits while the record is a draft', async () => {
      await seedSurveyRecord(env, 'srv_draft');
      const db = getContext(env, 'same_tenant_admin').firestore();
      await expectAllow(
        db.collection('survey_records').doc('srv_draft').update({
          plotArea: { value: 999, provenance: 'user' },
        }),
      );
    });

    it('denies content edits once the record is confirmed', async () => {
      await seedSurveyRecord(env, 'srv_confirmed', CONFIRMED);
      const db = getContext(env, 'same_tenant_admin').firestore();
      await expectDeny(
        db.collection('survey_records').doc('srv_confirmed').update({
          plotArea: { value: 4092.13, provenance: 'user' },
        }),
      );
    });

    it('still allows the reconciliation ledger to move on a confirmed record', async () => {
      await seedSurveyRecord(env, 'srv_confirmed_ledger', CONFIRMED);
      const db = getContext(env, 'same_tenant_admin').firestore();
      await expectAllow(
        db.collection('survey_records').doc('srv_confirmed_ledger').update({
          reconciliations: [
            {
              field: 'sd',
              action: 'kept-ours',
              surveyValueAtDecision: 1.3,
              decidedBy: 'persona-same-admin',
              decidedAt: new Date().toISOString(),
            },
          ],
          updatedAt: new Date().toISOString(),
        }),
      );
    });

    it('allows un-confirming — the documented path to fixing a typo', async () => {
      await seedSurveyRecord(env, 'srv_unconfirm', CONFIRMED);
      const db = getContext(env, 'same_tenant_admin').firestore();
      await expectAllow(
        db.collection('survey_records').doc('srv_unconfirm').update({
          confirmedBy: null,
          confirmedAt: null,
        }),
      );
    });

    it('denies a content edit smuggled alongside a ledger write', async () => {
      // The freeze is `hasOnly`, not `hasAny` — mixing an allowed key with a
      // frozen one must fail, or the ledger becomes a hole straight through it.
      await seedSurveyRecord(env, 'srv_smuggle', CONFIRMED);
      const db = getContext(env, 'same_tenant_admin').firestore();
      await expectDeny(
        db.collection('survey_records').doc('srv_smuggle').update({
          reconciliations: [],
          plotArea: { value: 1, provenance: 'user' },
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Scope immutability
  // -------------------------------------------------------------------------
  describe('scope immutability', () => {
    it('denies re-tenanting (companyId change)', async () => {
      await seedSurveyRecord(env, 'srv_retenant');
      const db = getContext(env, 'same_tenant_admin').firestore();
      await expectDeny(
        db.collection('survey_records').doc('srv_retenant').update({
          companyId: CROSS_TENANT_COMPANY_ID,
        }),
      );
    });

    it('denies re-parenting to another project (projectId change)', async () => {
      await seedSurveyRecord(env, 'srv_reparent');
      const db = getContext(env, 'same_tenant_admin').firestore();
      await expectDeny(
        db.collection('survey_records').doc('srv_reparent').update({
          projectId: 'proj_somewhere_else',
        }),
      );
    });

    it('denies create without the scope keys', async () => {
      const db = getContext(env, 'same_tenant_admin').firestore();
      await expectDeny(
        db.collection('survey_records').doc('srv_no_scope').set({
          plotArea: { value: 1, provenance: 'user' },
        }),
      );
    });
  });
});

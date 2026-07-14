/**
 * Firestore Rules — `asset_pack_config` collection (ADR-655)
 *
 * Pattern: deny_all (Pattern E — server-only via Admin SDK).
 *
 * Doc: `asset_pack_config/{packId} → { status: 'public' | 'entitled' | 'disabled' }`
 *
 * Αυτό είναι ο **διακόπτης διανομής** των πακέτων περιεχομένου. Ζει σε δεδομένα (όχι σε
 * κώδικα) ώστε το «κόψε τη βρύση» να γυρίζει σε δευτερόλεπτα, χωρίς build/deploy.
 *
 * Ο κανόνας είναι σκέτο `allow read, write: if false` — **ούτε ανάγνωση** από client:
 * η κατάσταση κάθε πακέτου είναι πληροφορία της πύλης, όχι του φυλλομετρητή. Το UI μαθαίνει
 * τι δικαιούται ΜΟΝΟ από το `/api/asset-packs`, που αποφασίζει server-side.
 *
 * Το suite κλειδώνει ότι deny παίρνει **και ο super_admin** από client context — δηλαδή ότι
 * δεν υπάρχει `isSuperAdminOnly()` παραθυράκι· η μόνη διαδρομή είναι το Admin SDK.
 *
 * See ADR-298 §4 (harness) + ADR-655 (asset packs).
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { PERSONA_CLAIMS, SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'asset_pack_config',
)!;

describe('asset_pack_config.rules — deny_all (Pattern E)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        // Doc id = packId (φυσικό κλειδί config, όχι entity id).
        const docId = 'furniture-plan-2d';

        const ctx = getContext(env, cell.persona);
        const personaClaims = cell.persona !== 'anonymous' ? PERSONA_CLAIMS[cell.persona] : null;

        const target: AssertTarget = {
          collection: 'asset_pack_config',
          docId,
          data: { status: 'entitled' },
          createData: {
            status: 'entitled',
            companyId: SAME_TENANT_COMPANY_ID,
            createdBy: personaClaims?.uid ?? 'anon-uid',
          },
          listFilter: { field: 'companyId', op: '==', value: SAME_TENANT_COMPANY_ID },
        };

        await assertCell(ctx, cell, target);
      });
    });
  }
});

/**
 * Firestore Rules — `properties` collection
 *
 * Pattern: admin_write_only with admin-update delta.
 * Reads are tenant-scoped via `projectId` crossdoc (belongsToProjectCompany).
 * Create/delete deny for all clients (Admin SDK only).
 * Update is allowed for super_admin (isSuperAdminOnly bypass) and for company
 * admins of the project's company (isCompanyAdminOfProject + isAllowedPropertyFieldUpdate
 * + propertyStructuralFieldsUnchanged). Regular users cannot update.
 *
 * seedDependencies: projects → properties.
 * Update test data uses only allowed fields (description, updatedAt) so that
 * same_tenant_admin can satisfy isAllowedPropertyFieldUpdate. The seed doc
 * carries `id: propId` so that propertyStructuralFieldsUnchanged can verify
 * the invariant is preserved in the merged document.
 *
 * See ADR-298 §4 Phase B.4 (2026-04-13).
 *
 * @since 2026-04-13 (ADR-298 Phase B.4)
 */

import {
  initEmulator,
  teardownEmulator,
  resetData,
} from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { seedProject, seedProperty } from '../_harness/seed-helpers';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import { assertFails } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'properties',
)!;

describe('properties.rules — admin_write_only + admin-update (crossdoc via projectId)', () => {
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
        const projectId = 'project-property-parent';
        const propertyId = 'property-same-tenant';

        await seedProject(env, projectId, { companyId: SAME_TENANT_COMPANY_ID });
        await seedProperty(env, propertyId, projectId);

        const ctx = getContext(env, cell.persona);
        const target: AssertTarget = {
          collection: 'properties',
          docId: propertyId,
          // Update data: only allowed fields (isAllowedPropertyFieldUpdate allowlist).
          // Firestore partial update preserves `projectId` and `id` from the seed doc
          // so propertyStructuralFieldsUnchanged passes for same_tenant_admin.
          data: {
            description: 'Updated property description',
          },
          createData: {
            projectId,
            name: 'Created Property',
          },
          listFilter: {
            field: 'projectId',
            op: '==',
            value: projectId,
          },
        };

        await assertCell(ctx, cell, target);
      });
    });
  }

  // ==========================================================================
  // 🔴 Η ΑΓΚΥΡΑ ΠΟΥ ΕΛΕΙΠΕ — ΤΟ ΣΧΗΜΑ ΠΟΥ ΠΥΡΟΔΟΤΕΙ ΤΑ ΔΗΜΟΣΙΑ ΣΚΕΛΗ
  // ==========================================================================
  //
  // Ο πίνακας από πάνω δηλώνει ήδη «anonymous × read → deny» **και περνούσε** — ενώ
  // ο κανόνας επέτρεπε ανώνυμη ανάγνωση σε κάθε δημοσιευμένο ακίνητο. Δεν ήταν
  // αντίφαση: το `seedProperty` γράφει έγγραφο **χωρίς** `commercialStatus` και
  // **χωρίς** `offerKinds`, οπότε **κανένα** από τα δύο δημόσια σκέλη δεν πυροδοτούσε
  // ποτέ. Η σουίτα ήταν πράσινη επειδή δοκίμαζε **άλλο έγγραφο** από αυτό που υπάρχει
  // στην παραγωγή — η ίδια αστοχία που το `seedProperty` πλήρωσε ήδη μία φορά
  // (2026-08-05, `project` → `projectId`, σχόλιο παραπάνω).
  //
  // ⚠️ **ΤΡΙΑ ΣΧΗΜΑΤΑ, ΟΧΙ ΕΝΑ — και δεν είναι πληρότητα.** Τα δύο σκέλη που
  // αφαιρέθηκαν ήταν ανεξάρτητα (`commercialStatus in [...]` · `offerKinds.hasAny`).
  // Ένα έγγραφο που κουβαλά **και τα δύο** πεδία θα έμενε κόκκινο ακόμη κι αν είχε
  // αφαιρεθεί μόνο το ένα — δηλαδή θα επικύρωνε **μισή** διόρθωση ως ολόκληρη. Κάθε
  // σκέλος χρειάζεται έγγραφο που πυροδοτεί **μόνο εκείνο**.
  //
  // @since 2026-08-10 (ADR-777 Β2β — αφαίρεση των δημόσιων σκελών)
  describe('🔴 ο ΑΝΩΝΥΜΟΣ δεν διαβάζει ΔΗΜΟΣΙΕΥΜΕΝΟ ακίνητο', () => {
    const PROJECT_ID = 'project-property-parent';

    /** Τα τρία σχήματα, καθένα με το σκέλος που πυροδοτούσε. */
    const PUBLISHED_SHAPES = [
      {
        label: 'παλιό λεξιλόγιο — `commercialStatus: for-sale`',
        docId: 'property-published-legacy',
        overrides: { commercialStatus: 'for-sale' },
      },
      {
        label: 'νέος άξονας (Α20) — `offerKinds: [sell]`',
        docId: 'property-published-offers',
        overrides: { offerKinds: ['sell'] },
      },
      {
        label: 'και τα δύο — το πραγματικό σχήμα μετά την Α20',
        docId: 'property-published-both',
        overrides: { commercialStatus: 'for-sale-and-rent', offerKinds: ['sell', 'leaseOut'] },
      },
    ] as const;

    for (const shape of PUBLISHED_SHAPES) {
      it(`αρνείται την ΑΝΑΓΝΩΣΗ: ${shape.label}`, async () => {
        await seedProject(env, PROJECT_ID, { companyId: SAME_TENANT_COMPANY_ID });
        await seedProperty(env, shape.docId, PROJECT_ID, { overrides: shape.overrides });

        const anon = env.unauthenticatedContext();
        await assertFails(
          anon.firestore().collection('properties').doc(shape.docId).get()
        );
      });

    }

    // ⚠️ **ΜΙΑ** δοκιμή λίστας, όχι τρεις — και ο λόγος είναι μετρημένος, όχι
    // συντομία: το Firestore εγκρίνει ένα `list` όταν οι **περιορισμοί του
    // ερωτήματος** αποδεικνύουν τον κανόνα. Αυτό ίσχυε **μόνο** για το παλιό σκέλος
    // (`commercialStatus in [...]`, που ταιριάζει ακριβώς με ένα `where … in`). Το
    // σκέλος του `offerKinds` ξεκινά με `resource.data.keys().hasAny([...])`, που
    // **κανένας** περιορισμός ερωτήματος δεν αποδεικνύει ⇒ η αντίστοιχη λίστα
    // απορρίπτεται **και σήμερα**, δηλαδή μια δοκιμή γι' αυτήν θα ήταν πράσινη πριν
    // ΚΑΙ μετά την αφαίρεση: φρουρός που δεν μπορεί να πυροδοτήσει (ADR-749 §5).
    it('αρνείται τη ΛΙΣΤΑ που έστελνε ο διαγραμμένος `usePublicProperties`', async () => {
      await seedProject(env, PROJECT_ID, { companyId: SAME_TENANT_COMPANY_ID });
      await seedProperty(env, 'property-published-legacy', PROJECT_ID, {
        overrides: { commercialStatus: 'for-sale' },
      });

      // «a list test must send the same query the production client sends» — αυτό
      // ήταν, κατά λέξη, το ερώτημα του `usePublicProperties`.
      const anon = env.unauthenticatedContext();
      await assertFails(
        anon
          .firestore()
          .collection('properties')
          .where('commercialStatus', 'in', ['for-sale', 'for-rent', 'for-sale-and-rent'])
          .get()
      );
    });
  });
});

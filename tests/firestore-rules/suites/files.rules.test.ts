/**
 * Firestore Rules — `files` collection
 *
 * Pattern: tenant_direct. Files are the most-hit storage-backed collection;
 * tests exercise full CRUD with companyId-gated list queries.
 *
 * Migrated from `tests/firestore-rules/pr-1a-files.test.ts` (2026-01-29).
 * See ADR-298 §3.3.
 *
 * @since 2026-04-11 (ADR-298 Phase A)
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
import { seedFile } from '../_harness/seed-helpers';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import {
  PERSONA_CLAIMS,
  SAME_TENANT_COMPANY_ID,
  isAuthenticatedPersona,
} from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'files',
)!;

/**
 * Derive a plausible `createdBy` for a fresh-create test. The files create
 * rule requires `request.resource.data.createdBy == request.auth.uid`, so
 * each persona's payload must reference its own synthetic uid.
 *
 * `anonymous` is never used for allow-create cells, but return a sentinel
 * for completeness so the helper is total.
 */
function createdByFor(persona: (typeof COVERAGE.matrix)[number]['persona']): string {
  if (!isAuthenticatedPersona(persona)) {
    return 'anonymous-cannot-create';
  }
  return PERSONA_CLAIMS[persona].uid;
}

describe('files.rules — tenant_state_machine pattern', () => {
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
        const docId = 'file-same-tenant';
        // Seed uses a neutral `seed-system` creator so that no persona gets
        // ownership-leg access for free. Cross-tenant personas must fail the
        // rule on the company check, not on an accidentally-matching uid —
        // super admin still passes through `isSuperAdminOnly()`, and the
        // same-tenant admin passes through `isCompanyAdminOfCompany()`.
        const seedCreatedBy = 'seed-system';
        await seedFile(env, docId, {
          companyId: SAME_TENANT_COMPANY_ID,
          createdBy: seedCreatedBy,
        });

        const ctx = getContext(env, cell.persona);
        const target: AssertTarget = {
          collection: 'files',
          docId,
          // Update payload exercises the `ready → trashed` transition of the
          // files state machine (firestore.rules:424). All immutable fields
          // are preserved verbatim from the seed.
          data: {
            id: docId,
            fileName: `seed-${docId}.pdf`,
            mimeType: 'application/pdf',
            size: 1024,
            status: 'ready',
            isDeleted: true,
            storagePath: `companies/${SAME_TENANT_COMPANY_ID}/files/${docId}`,
            createdBy: seedCreatedBy,
            companyId: SAME_TENANT_COMPANY_ID,
          },
          // Fresh-doc create payload — status MUST be 'pending', and
          // createdBy MUST match the acting persona's uid.
          createData: {
            fileName: 'created.pdf',
            mimeType: 'application/pdf',
            size: 2048,
            status: 'pending',
            isDeleted: false,
            storagePath: `companies/${SAME_TENANT_COMPANY_ID}/files/created.pdf`,
            createdBy: createdByFor(cell.persona),
            companyId: SAME_TENANT_COMPANY_ID,
          },
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

  // --- ADR-862 Φ0 (Β4) — το πάγωμα της κατάστασης CDE ----------------------
  //
  // 🔑 ΓΙΑΤΙ ΕΞΩ ΑΠΟ ΤΗ ΜΗΤΡΑ: η μήτρα ρωτά «ποιο ΠΡΟΣΩΠΟ επιτρέπεται σε ποια
  // ΠΡΑΞΗ» — 7 πρόσωπα × 5 πράξεις = 35 κελιά, κλειστό σύνολο που φρουρεί η
  // CHECK 3.16 (Validation G). Το ερώτημα εδώ είναι άλλο: «ποιο ΠΕΔΙΟ
  // επιτρέπεται να αλλάξει», και η απάντηση είναι **ίδια για κάθε πρόσωπο**.
  // Έκφρασή του ως κελιά θα απαιτούσε όγδοη `Persona` και θα υποχρέωνε **κάθε**
  // μήτρα του μητρώου να τη δηλώσει. Πρότυπο: το `crossdoc` μπλοκ του
  // `attendance-events.rules.test.ts:119`. Η μήτρα μένει **αμετάβλητη**.
  //
  // 🔴 ΤΟ ΠΡΟΣΩΠΟ ΕΙΝΑΙ ΕΠΙΛΟΓΗ, ΟΧΙ ΤΥΧΑΙΟ: ο `same_tenant_admin` περνά **όλα**
  // τα άλλα σκέλη (companyId + ρόλος μέσω `isCompanyAdminOfCompany`). Άρα κάθε
  // `expectDeny` παρακάτω αποδίδεται **μόνο** στη ρήτρα του CDE. Με
  // `cross_tenant_*` τα ίδια tests θα ήταν πράσινα για **λάθος λόγο** — θα
  // μετρούσαν απομόνωση μισθωτή, που ήδη μετρά η μήτρα από πάνω.
  describe('cde freeze — η κατάσταση δεν γράφεται από πελάτη (ADR-862 Φ0)', () => {
    const ADMIN_UID = PERSONA_CLAIMS.same_tenant_admin.uid;

    /**
     * Το **ελάχιστο** φορτίο που περνά το leg «ready → trashed». Κάθε
     * `expectDeny` παρακάτω προσθέτει σε ΑΥΤΟ ένα πεδίο CDE — ώστε η διαφορά
     * ανάμεσα στο allow και στο deny να είναι **ακριβώς** η ρήτρα που
     * δοκιμάζεται, και τίποτε άλλο. Χωρίς αυτή την πειθαρχία, ένα `expectDeny`
     * μπορεί να είναι πράσινο επειδή το φορτίο ήταν ούτως ή άλλως άκυρο.
     */
    const TRASH_UPDATE: Record<string, unknown> = { isDeleted: true };

    /** Μια πράξη όπως τη γράφει ο διακομιστής — ADR-862 §5.4.1.γ. */
    const ACT = { by: ADMIN_UID, at: new Date('2026-09-01'), revision: 1 };

    /** Έγκυρο φορτίο γέννησης· το `status` είναι ΠΑΝΤΑ 'pending' (rule:611). */
    function createPayload(extra: Record<string, unknown> = {}): Record<string, unknown> {
      return {
        fileName: 'cde-freeze.pdf',
        mimeType: 'application/pdf',
        size: 2048,
        status: 'pending',
        isDeleted: false,
        storagePath: `companies/${SAME_TENANT_COMPANY_ID}/files/cde-freeze.pdf`,
        createdBy: ADMIN_UID,
        companyId: SAME_TENANT_COMPANY_ID,
        ...extra,
      };
    }

    const fileDoc = (docId: string) =>
      getContext(env, 'same_tenant_admin').firestore().collection('files').doc(docId);

    it('⛔ δηλωμένο WIP → PUBLISHED από πελάτη: ΑΡΝΗΣΗ', async () => {
      const docId = 'cde-declared-wip';
      await seedFile(env, docId, {
        companyId: SAME_TENANT_COMPANY_ID,
        overrides: { cdeState: 'WIP', cdeTeamId: 'team-structural' },
      });

      await expectDeny(fileDoc(docId).update({ ...TRASH_UPDATE, cdeState: 'PUBLISHED' }));
    });

    it('⛔ αδήλωτο → ΠΡΟΣΘΗΚΗ `cdeState`: ΑΡΝΗΣΗ (η προσθήκη ΕΙΝΑΙ γραφή)', async () => {
      const docId = 'cde-absent-then-added';
      await seedFile(env, docId, { companyId: SAME_TENANT_COMPANY_ID });

      await expectDeny(fileDoc(docId).update({ ...TRASH_UPDATE, cdeState: 'WIP' }));
    });

    it('✅ αδήλωτο + κανονικό update: ΕΠΙΤΡΕΠΕΤΑΙ — η ρήτρα του απόντος', async () => {
      const docId = 'cde-absent-normal-update';
      await seedFile(env, docId, { companyId: SAME_TENANT_COMPANY_ID });

      // 🔑 ΜΕΤΡΗΜΕΝΟ, ΟΧΙ ΣΥΜΠΕΡΑΣΜΕΝΟ: ο σπορέας ΔΕΝ γράφει `cdeState`. Αν
      // κάποτε αρχίσει, αυτή η γραμμή κοκκινίζει **πριν** το `expectAllow`
      // προλάβει να γίνει πράσινο για λάθος λόγο — και τα 35 κελιά της μήτρας
      // από πάνω σπέρνονται από τον ΙΔΙΟ σπορέα.
      await withSeedContext(env, async (seedCtx) => {
        const snap = await seedCtx.firestore().collection('files').doc(docId).get();
        expect(snap.data()).not.toHaveProperty('cdeState');
      });

      await expectAllow(fileDoc(docId).update(TRASH_UPDATE));
    });

    it('⛔ μετακίνηση σε άλλη ομάδα (`cdeTeamId`) από πελάτη: ΑΡΝΗΣΗ', async () => {
      const docId = 'cde-team-move';
      await seedFile(env, docId, {
        companyId: SAME_TENANT_COMPANY_ID,
        overrides: { cdeState: 'WIP', cdeTeamId: 'team-structural' },
      });

      await expectDeny(fileDoc(docId).update({ ...TRASH_UPDATE, cdeTeamId: 'team-mep' }));
    });

    it('⛔ αλλοίωση υπάρχουσας σφραγίδας: ΑΡΝΗΣΗ — φρουρούνται ΚΑΙ ΤΑ ΕΞΙ πεδία', async () => {
      const docId = 'cde-seal-tamper';
      await seedFile(env, docId, {
        companyId: SAME_TENANT_COMPANY_ID,
        overrides: { cdeState: 'SHARED', cdeSeal: ACT },
      });

      await expectDeny(
        fileDoc(docId).update({
          ...TRASH_UPDATE,
          cdeSeal: { by: ADMIN_UID, at: new Date('2026-09-15'), revision: 99 },
        }),
      );
    });

    it('⛔ και οι υπόλοιπες πράξεις (share · release · withdrawal · supersession)', async () => {
      // Σε έναν βρόχο, όχι σε τρία σχεδόν ταυτόσημα tests: ο φρουρός είναι **μία**
      // λίστα σε **έναν** βοηθό, άρα τρεις αντιγραφές θα ήταν κλώνος (N.18) χωρίς
      // να προσθέτουν καμία νέα ερώτηση. Ό,τι λείπει από τη λίστα, λείπει για όλα.
      const docId = 'cde-acts-frozen';
      await seedFile(env, docId, {
        companyId: SAME_TENANT_COMPANY_ID,
        overrides: { cdeState: 'WIP' },
      });

      for (const act of ['cdeShare', 'cdeRelease', 'cdeWithdrawal', 'cdeSupersession'] as const) {
        await expectDeny(fileDoc(docId).update({ ...TRASH_UPDATE, [act]: ACT }));
      }
    });

    it('⛔ γέννηση με `cdeState: PUBLISHED`: ΑΡΝΗΣΗ', async () => {
      await expectDeny(
        fileDoc('cde-born-published').set(createPayload({ cdeState: 'PUBLISHED' })),
      );
    });

    it('⛔ γέννηση με σφραγίδα «από κούνια»: ΑΡΝΗΣΗ', async () => {
      // Χωρίς αυτό, ένα αρχείο θα γεννιόταν με σφραγίδα δημιουργού ήδη μέσα —
      // παρακάμπτοντας **και τα δύο** σκαλοπάτια του PUBLISHED (ADR-862 Ε-12).
      await expectDeny(fileDoc('cde-born-sealed').set(createPayload({ cdeSeal: ACT })));
    });

    it('✅ γέννηση χωρίς δήλωση κατάστασης: ΕΠΙΤΡΕΠΕΤΑΙ — «όπως σήμερα»', async () => {
      await expectAllow(fileDoc('cde-born-plain').set(createPayload()));
    });

    it('✅ γέννηση με ρητό `WIP`: ΕΠΙΤΡΕΠΕΤΑΙ — η κατάσταση γέννησης', async () => {
      await expectAllow(
        fileDoc('cde-born-wip').set(createPayload({ cdeState: 'WIP', cdeTeamId: 'team-mep' })),
      );
    });

    /**
     * 🔬 ADR-862 Φ0 Β10 — **το ΑΚΡΙΒΕΣ φορτίο** του `moveToTrash`
     * (`services/file-record-lifecycle.ts`), όχι το ελάχιστο `TRASH_UPDATE`.
     * Οι δύο γραμμές διαφέρουν **μόνο** στα τρία πεδία της διαδοχής — άρα αν η
     * πρώτη περνά και η δεύτερη όχι, η αιτία είναι η διαδοχή και τίποτε άλλο.
     */
    function productionTrashPayload(): Record<string, unknown> {
      const at = new Date('2026-09-17');
      return {
        lifecycleState: 'trashed',
        trashedAt: at,
        trashedBy: ADMIN_UID,
        purgeAt: '2026-10-17T00:00:00.000Z',
        isDeleted: true,
        deletedAt: at,
        deletedBy: ADMIN_UID,
        updatedAt: at,
      };
    }

    it('✅ κάδος όπως τον γράφει η παραγωγή: ΕΠΙΤΡΕΠΕΤΑΙ', async () => {
      const docId = 'cde-production-trash';
      await seedFile(env, docId, { companyId: SAME_TENANT_COMPANY_ID });

      await expectAllow(fileDoc(docId).update(productionTrashPayload()));
    });

    // 🔴 ADR-862 Φ0 Β10 — ΤΟ ΣΦΑΛΜΑ ΠΟΥ ΑΠΟΔΕΙΧΘΗΚΕ (2026-09-17): αυτό ακριβώς έστελνε ο παλιός
    //    `moveToTrash` σε κάθε αντικατάσταση, και απορριπτόταν ολόκληρο, σιωπηλά.
    it('⛔ διαδοχή που γράφει `cdeState` από πελάτη: ΑΡΝΗΣΗ — ΟΛΗ η εγγραφή', async () => {
      const docId = 'cde-production-supersede';
      await seedFile(env, docId, { companyId: SAME_TENANT_COMPANY_ID });

      await expectDeny(
        fileDoc(docId).update({
          ...productionTrashPayload(),
          supersededByFileId: 'file_successor',
          supersededAt: new Date('2026-09-17'),
          cdeState: 'SUPERSEDED',
        }),
      );
    });

    it('⛔ ισχυρισμός διαδοχής ΧΩΡΙΣ `cdeState` από πελάτη: ΑΡΝΗΣΗ — η απόδειξη είναι του διακομιστή', async () => {
      // Χωρίς αυτή τη γραμμή, ο πελάτης θα έγραφε `supersededByFileId` και ο θεματοφύλακας
      // (κληρονομιά του Μ1) θα το δεχόταν ως **απόδειξη** διαδοχής που κανείς δεν έκρινε.
      const docId = 'cde-client-succession-claim';
      await seedFile(env, docId, { companyId: SAME_TENANT_COMPANY_ID });

      for (const claim of [{ supersededByFileId: 'file_successor' }, { supersededAt: new Date('2026-09-17') }]) {
        await expectDeny(fileDoc(docId).update({ ...productionTrashPayload(), ...claim }));
      }
    });
  });
});

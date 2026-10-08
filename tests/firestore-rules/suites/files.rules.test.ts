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
import { seedFile, seedProperty } from '../_harness/seed-helpers';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import {
  PERSONA_CLAIMS,
  SAME_TENANT_COMPANY_ID,
  isAuthenticatedPersona,
} from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { FILE_HOLD_FIELDS } from '@/lib/files/file-hold';
import { LISTING_FILE_PUBLICATION_FIELDS } from '@/lib/listings/listing-file-publication-fields';
import { ARCHIVED_STATUS, TRASHED_STATUS } from '@/lib/firestore/trashed-status';

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

/**
 * Τα τέσσερα σκέλη `update` της `files` — κάθε ένα με ΔΙΚΟ του έγγραφο και το ελάχιστο φορτίο που
 * το περνά. ΜΙΑ λίστα για κάθε «πάγωμα» παρακάτω (δέσμευση · διαστάσεις · δημοσίευση): πρώτα οι
 * αρνήσεις (το έγγραφο μένει άθικτο), ΤΕΛΕΥΤΑΙΟ το allow του παρονομαστή — αν το σκέτο φορτίο δεν
 * περνούσε, κάθε `expectDeny` θα ήταν πράσινο για λάθος λόγο.
 */
const UPDATE_LEGS = [
  { leg: 'κάδος', seed: {}, base: { isDeleted: true } },
  { leg: 'επαναφορά', seed: { isDeleted: true }, base: { isDeleted: false } },
  { leg: 'σύνδεση', seed: {}, base: { linkedTo: ['property:prop_1'] } },
  { leg: 'οριστικοποίηση', seed: { status: 'pending' }, base: { status: 'ready' } },
] as const;

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
            // ADR-862 Φ0 Β11 — ό,τι γράφει ο builder (`BIRTH_READ_REACH`).
            cdeReadReach: 'tenant',
          },
          // ADR-862 Φ0 Β11 — η λίστα όπως τη συνθέτει το `firestoreQueryService`: μισθωτής
          // ΚΑΙ φράχτης γραφείου. Η μήτρα ρωτά «ποιο πρόσωπο», όχι «ποιο φίλτρο» — το
          // φίλτρο το ρωτά το μπλοκ `cde read` παρακάτω.
          listFilter: [
            { field: 'companyId', op: '==', value: SAME_TENANT_COMPANY_ID },
            { field: 'cdeReadReach', op: '==', value: 'tenant' },
          ],
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
        cdeReadReach: 'tenant',
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
        fileDoc('cde-born-wip').set(
          createPayload({ cdeState: 'WIP', cdeTeamId: 'team-mep', cdeReadReach: 'author' }),
        ),
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

    it('⛔ άνοιγμα του φράχτη ανάγνωσης (`cdeReadReach`) από πελάτη: ΑΡΝΗΣΗ', async () => {
      const docId = 'cde-reach-open';
      await seedFile(env, docId, {
        companyId: SAME_TENANT_COMPANY_ID,
        overrides: { cdeState: 'WIP', cdeReadReach: 'author' },
      });

      await expectDeny(fileDoc(docId).update({ ...TRASH_UPDATE, cdeReadReach: 'tenant' }));
    });

    it('⛔ γέννηση ΧΩΡΙΣ φράχτη, ή με φράχτη που δεν ταιριάζει στη φάση: ΑΡΝΗΣΗ', async () => {
      const { cdeReadReach: _omitted, ...withoutReach } = createPayload();
      await expectDeny(fileDoc('cde-born-no-reach').set(withoutReach));
      await expectDeny(fileDoc('cde-born-author').set(createPayload({ cdeReadReach: 'author' })));
      await expectDeny(
        fileDoc('cde-born-wip-open').set(createPayload({ cdeState: 'WIP', cdeReadReach: 'tenant' })),
      );
    });
  });

  // --- ADR-864 §21 — ΣΙΩΠΗΛΗ ΔΕΣΜΕΥΣΗ: η δέσμευση δεν γράφεται από πελάτη ---
  //
  // 🔑 Εκτός μήτρας για τον ίδιο λόγο με το `cde freeze`: ρωτά «ποιο ΠΕΔΙΟ», όχι
  // «ποιο πρόσωπο». Πρόσωπο `same_tenant_admin`: περνά ΚΑΘΕ άλλο σκέλος (και το
  // hard delete), άρα κάθε `expectDeny` αποδίδεται ΜΟΝΟ στη δέσμευση.
  //
  // 🔴 Ο ΠΑΡΟΝΟΜΑΣΤΗΣ (Δ21.1): ο κάδος σε δεσμευμένο αρχείο ΕΠΙΤΡΕΠΕΤΑΙ — Google
  // Vault · Box «silent legal hold». Χωρίς αυτό το allow, ένα λάθος «άρνηση κάδου»
  // (το σχέδιο που απορρίφθηκε) θα περνούσε πράσινο.
  describe('hold freeze — η δέσμευση δεν γράφεται από πελάτη (ADR-864 §21)', () => {
    const ADMIN_UID = PERSONA_CLAIMS.same_tenant_admin.uid;
    const HELD = {
      hold: 'legal',
      holdPlacedBy: 'uid_legal_manager',
      holdPlacedAt: '2026-09-17T09:00:00.000Z',
      holdReason: 'Δικαστική διαφορά 123/2026',
    } as const;

    /** Μία τιμή ανά κλειδί δέσμευσης — ΑΚΡΙΒΩΣ το `FILE_HOLD_FIELDS` (αναλογία ελέγχεται παρακάτω). */
    const HOLD_WRITES: Record<(typeof FILE_HOLD_FIELDS)[number], unknown> = {
      hold: 'none',
      holdPlacedBy: ADMIN_UID,
      holdPlacedAt: '2026-09-18T00:00:00.000Z',
      holdReason: 'αλλοίωση',
      holdReleasedBy: ADMIN_UID,
      holdReleasedAt: '2026-09-18T00:00:00.000Z',
      retentionUntil: '2000-01-01T00:00:00.000Z',
    };

    const fileDoc = (docId: string) =>
      getContext(env, 'same_tenant_admin').firestore().collection('files').doc(docId);

    const seedHeld = (docId: string, overrides: Record<string, unknown> = {}) =>
      seedFile(env, docId, { companyId: SAME_TENANT_COMPANY_ID, overrides: { ...HELD, ...overrides } });

    it('η λίστα του τεστ = `FILE_HOLD_FIELDS` (αλλιώς ο βρόχος θα παρέλειπε κλειδί)', () => {
      expect(Object.keys(HOLD_WRITES).sort()).toEqual([...FILE_HOLD_FIELDS].sort());
    });

    it.each(UPDATE_LEGS)('⛔ σκέλος $leg: κάθε κλειδί δέσμευσης από πελάτη ⇒ ΑΡΝΗΣΗ · το σκέτο φορτίο ⇒ ΕΠΙΤΡΕΠΕΤΑΙ', async ({ leg, seed, base }) => {
      const docId = `hold-leg-${UPDATE_LEGS.findIndex((l) => l.leg === leg)}`;
      await seedHeld(docId, seed);

      for (const [key, value] of Object.entries(HOLD_WRITES)) {
        await expectDeny(fileDoc(docId).update({ ...base, [key]: value }));
      }
      await expectAllow(fileDoc(docId).update(base));
    });

    it('⛔ ΑΦΑΙΡΕΣΗ της δέσμευσης (ολόκληρο `set` χωρίς το κλειδί): ΑΡΝΗΣΗ — η αφαίρεση ΕΙΝΑΙ γραφή', async () => {
      await seedHeld('hold-removed');
      let stored: Record<string, unknown> = {};
      await withSeedContext(env, async (seedCtx) => {
        stored = (await seedCtx.firestore().collection('files').doc('hold-removed').get()).data() ?? {};
      });
      const { hold: _released, ...withoutHold } = stored;

      await expectDeny(fileDoc('hold-removed').set({ ...withoutHold, isDeleted: true }));
      await expectAllow(fileDoc('hold-removed').set({ ...stored, isDeleted: true }));
    });

    it('✅ Δ21.1 κάδος σε ΔΕΣΜΕΥΜΕΝΟ αρχείο: ΕΠΙΤΡΕΠΕΤΑΙ — σιωπηλή δέσμευση', async () => {
      await seedHeld('hold-silent-trash');
      await expectAllow(fileDoc('hold-silent-trash').update({ isDeleted: true }));
    });

    it('⛔ οριστική διαγραφή δεσμευμένου ή υπό διατήρηση αρχείου: ΑΡΝΗΣΗ', async () => {
      await seedHeld('hold-hard-delete');
      await seedFile(env, 'retention-hard-delete', {
        companyId: SAME_TENANT_COMPANY_ID,
        overrides: { retentionUntil: '2999-01-01T00:00:00.000Z' },
      });
      await expectDeny(fileDoc('hold-hard-delete').delete());
      await expectDeny(fileDoc('retention-hard-delete').delete());
    });

    it('✅ παρονομαστής: οριστική διαγραφή με `hold: none` / `null` / χωρίς δέσμευση: ΕΠΙΤΡΕΠΕΤΑΙ', async () => {
      await seedFile(env, 'released-hard-delete', {
        companyId: SAME_TENANT_COMPANY_ID,
        overrides: { hold: 'none', holdReleasedBy: 'uid_legal_manager', retentionUntil: null },
      });
      await seedFile(env, 'plain-hard-delete', { companyId: SAME_TENANT_COMPANY_ID });
      await expectAllow(fileDoc('released-hard-delete').delete());
      await expectAllow(fileDoc('plain-hard-delete').delete());
    });

    it('⛔ γέννηση με δέσμευση ή διατήρηση «από κούνια»: ΑΡΝΗΣΗ · ✅ ρητό `hold: none`', async () => {
      const born = (docId: string, extra: Record<string, unknown>) => fileDoc(docId).set({
        fileName: `${docId}.pdf`,
        mimeType: 'application/pdf',
        size: 2048,
        status: 'pending',
        isDeleted: false,
        storagePath: `companies/${SAME_TENANT_COMPANY_ID}/files/${docId}.pdf`,
        createdBy: ADMIN_UID,
        companyId: SAME_TENANT_COMPANY_ID,
        cdeReadReach: 'tenant',
        ...extra,
      });
      await expectDeny(born('born-legal', { hold: 'legal' }));
      await expectDeny(born('born-retained', { retentionUntil: '2999-01-01T00:00:00.000Z' }));
      await expectDeny(born('born-none-with-trace', { hold: 'none', holdPlacedBy: ADMIN_UID }));
      await expectAllow(born('born-none', { hold: 'none' }));
    });
  });

  // --- ADR-899 §3.7 — οι ΜΕΤΡΗΜΕΝΕΣ διαστάσεις δεν γράφονται από πελάτη ------
  //
  // Ίδιο ιδίωμα και ίδιο πρόσωπο (`same_tenant_admin`) με το πάγωμα της δέσμευσης: κάθε `expectDeny` αποδίδεται
  // ΜΟΝΟ στη ρήτρα `measuredUnchanged`/`measuredBornAbsent`. 🔴 Η οριστικοποίηση (pending → ready) ήταν η ανοιχτή
  // πόρτα: χωρίς allowlist κλειδιών, ο πελάτης έγραφε ό,τι ήθελε μαζί με το `status`.
  describe('measured freeze — οι διαστάσεις τις μετρά ο κάδος (ADR-899 §3.7)', () => {
    const ADMIN_UID = PERSONA_CLAIMS.same_tenant_admin.uid;
    const MEASURED = { imageDimensions: { width: 3000, height: 4000 } } as const;
    const FORGED = { imageDimensions: { width: 9999, height: 1 } } as const;
    const fileDoc = (docId: string) =>
      getContext(env, 'same_tenant_admin').firestore().collection('files').doc(docId);

    it.each(UPDATE_LEGS)('⛔ σκέλος $leg: γραφή/αλλαγή διαστάσεων ⇒ ΑΡΝΗΣΗ · το σκέτο φορτίο ⇒ ΕΠΙΤΡΕΠΕΤΑΙ', async ({ leg, seed, base }) => {
      const index = UPDATE_LEGS.findIndex((l) => l.leg === leg);
      await seedFile(env, `measured-add-${index}`, { companyId: SAME_TENANT_COMPANY_ID, overrides: { ...seed } });
      await seedFile(env, `measured-change-${index}`, { companyId: SAME_TENANT_COMPANY_ID, overrides: { ...seed, ...MEASURED } });
      await expectDeny(fileDoc(`measured-add-${index}`).update({ ...base, ...FORGED }));
      await expectDeny(fileDoc(`measured-change-${index}`).update({ ...base, ...FORGED }));
      await expectAllow(fileDoc(`measured-change-${index}`).update(base));
    });

    it('⛔ ΑΦΑΙΡΕΣΗ των διαστάσεων (ολόκληρο `set` χωρίς το κλειδί): ΑΡΝΗΣΗ', async () => {
      await seedFile(env, 'measured-removed', { companyId: SAME_TENANT_COMPANY_ID, overrides: { ...MEASURED } });
      let stored: Record<string, unknown> = {};
      await withSeedContext(env, async (seedCtx) => {
        stored = (await seedCtx.firestore().collection('files').doc('measured-removed').get()).data() ?? {};
      });
      const { imageDimensions: _dropped, ...withoutDimensions } = stored;
      await expectDeny(fileDoc('measured-removed').set({ ...withoutDimensions, isDeleted: true }));
      await expectAllow(fileDoc('measured-removed').set({ ...stored, isDeleted: true }));
    });

    it('⛔ γέννηση με διαστάσεις «από κούνια»: ΑΡΝΗΣΗ · ✅ χωρίς', async () => {
      const born = (docId: string, extra: Record<string, unknown>) => fileDoc(docId).set({
        fileName: `${docId}.jpg`,
        mimeType: 'image/jpeg',
        size: 2048,
        status: 'pending',
        isDeleted: false,
        storagePath: `companies/${SAME_TENANT_COMPANY_ID}/files/${docId}.jpg`,
        createdBy: ADMIN_UID,
        companyId: SAME_TENANT_COMPANY_ID,
        cdeReadReach: 'tenant',
        ...extra,
      });
      await expectDeny(born('born-measured', { ...FORGED }));
      await expectAllow(born('born-plain', {}));
    });
  });

  // --- ADR-845 §7.17 (Α4α) — τα πεδία ΔΗΜΟΣΙΕΥΣΗΣ δεν γράφονται από πελάτη ----
  //
  // Ίδιο ιδίωμα και ίδιο πρόσωπο (`same_tenant_admin`) με τα τρία παγώματα από πάνω: κάθε `expectDeny`
  // αποδίδεται ΜΟΝΟ στη ρήτρα `publication…`. 🔴 Το σκέλος σύνδεσης ήταν η ανοιχτή πόρτα: κάθε μέλος
  // της εταιρείας, χωρίς allowlist κλειδιών ⇒ `classification: 'public'` μαζί με ένα `linkedTo`.
  describe('publication freeze — ό,τι βλέπει το κοινό το αλλάζει μόνο πράξη διακομιστή (ADR-845 §7.17)', () => {
    const ADMIN_UID = PERSONA_CLAIMS.same_tenant_admin.uid;
    const fileDoc = (docId: string) =>
      getContext(env, 'same_tenant_admin').firestore().collection('files').doc(docId);

    /** Ό,τι έχει ένα αρχείο που ήδη συμμετέχει στην αγγελία — ώστε να δοκιμαστεί ΑΛΛΑΓΗ, όχι μόνο προσθήκη. */
    const PUBLISHED = {
      classification: 'public',
      publicationIdentity: 'property-model:prop_1:as-built',
      entityType: 'property',
      entityId: 'prop_live_publication',
      category: 'photos',
      lifecycleState: 'active',
      contentType: 'image/jpeg',
      storagePlacement: { bucket: 'legacy-default' },
      purpose: 'gallery',
    } as const;

    const CUSTODY_WRITES = {
      classification: 'internal',
      publicationIdentity: 'property-model:prop_1:proposal',
    } as const;

    /**
     * Μία ψεύτικη τιμή ανά πεδίο του κατηγορήματος — ΑΚΡΙΒΩΣ το `LISTING_FILE_PUBLICATION_FIELDS`
     * (ο τύπος το επιβάλλει, και η αναλογία ελέγχεται παρακάτω).
     */
    const PREDICATE_WRITES: Record<(typeof LISTING_FILE_PUBLICATION_FIELDS)[number], unknown> = {
      companyId: 'company-forged',
      entityType: 'building',
      entityId: 'prop_other',
      category: 'floorplans',
      classification: 'internal',
      status: 'failed',
      isDeleted: true,
      lifecycleState: 'archived',
      storagePath: 'companies/forged/files/x',
      storagePlacement: { bucket: 'eu-originals' },
      contentType: 'application/pdf',
      publicationIdentity: 'property-model:prop_1:proposal',
      createdAt: '2000-01-01T00:00:00.000Z',
    };

    /**
     * 🔶 ΔΗΛΩΜΕΝΟ ΟΡΙΟ ΤΗΣ Α4α: το `isDeleted: true` μαζί με `linkedTo` ΔΕΝ περνά από το σκέλος
     * σύνδεσης — το δέχεται το σκέλος ΚΑΔΟΥ (δημιουργός/διαχειριστής), που ζει ως την Α4β. Δοκιμάζεται
     * χωριστά παρακάτω, ώστε η εξαίρεση να είναι ορατή και να κοκκινίσει όταν το σκέλος φύγει.
     */
    const OWNED_BY_TRASH_LEG = 'isDeleted';

    it('η λίστα του τεστ = `LISTING_FILE_PUBLICATION_FIELDS` (αλλιώς ο βρόχος θα παρέλειπε κλειδί)', () => {
      expect(Object.keys(PREDICATE_WRITES).sort()).toEqual([...LISTING_FILE_PUBLICATION_FIELDS].sort());
    });

    it.each(UPDATE_LEGS)('⛔ σκέλος $leg: διαβάθμιση/ταυτότητα δημοσίευσης από πελάτη ⇒ ΑΡΝΗΣΗ · το σκέτο φορτίο ⇒ ΕΠΙΤΡΕΠΕΤΑΙ', async ({ leg, seed, base }) => {
      const index = UPDATE_LEGS.findIndex((l) => l.leg === leg);
      await seedFile(env, `publication-add-${index}`, { companyId: SAME_TENANT_COMPANY_ID, overrides: { ...seed } });
      await seedFile(env, `publication-change-${index}`, { companyId: SAME_TENANT_COMPANY_ID, overrides: { ...PUBLISHED, ...seed } });

      for (const [key, value] of Object.entries(CUSTODY_WRITES)) {
        await expectDeny(fileDoc(`publication-add-${index}`).update({ ...base, [key]: value }));
        await expectDeny(fileDoc(`publication-change-${index}`).update({ ...base, [key]: value }));
      }
      await expectAllow(fileDoc(`publication-change-${index}`).update(base));
    });

    it('⛔ σκέλος σύνδεσης: ΚΑΘΕ πεδίο του κατηγορήματος + `purpose` ⇒ ΑΡΝΗΣΗ · το σκέτο `linkedTo` ⇒ ΕΠΙΤΡΕΠΕΤΑΙ', async () => {
      await seedFile(env, 'publication-link', { companyId: SAME_TENANT_COMPANY_ID, overrides: { ...PUBLISHED } });
      const link = { linkedTo: ['property:prop_1'] };

      for (const [key, value] of Object.entries(PREDICATE_WRITES)) {
        if (key === OWNED_BY_TRASH_LEG) continue;
        await expectDeny(fileDoc('publication-link').update({ ...link, [key]: value }));
      }
      await expectDeny(fileDoc('publication-link').update({ ...link, purpose: 'floorplan' }));
      await expectAllow(fileDoc('publication-link').update(link));
    });

    it('🔶 όριο Α4α: `isDeleted` μαζί με `linkedTo` περνά ακόμη — από το σκέλος ΚΑΔΟΥ, όχι της σύνδεσης', async () => {
      await seedFile(env, 'publication-trash-residue', { companyId: SAME_TENANT_COMPANY_ID, overrides: { ...PUBLISHED } });
      await expectAllow(fileDoc('publication-trash-residue').update({ linkedTo: ['property:prop_1'], isDeleted: true }));
    });

    it('⛔ ΑΦΑΙΡΕΣΗ της διαβάθμισης (ολόκληρο `set` χωρίς το κλειδί): ΑΡΝΗΣΗ — η αφαίρεση ΕΙΝΑΙ γραφή', async () => {
      await seedFile(env, 'publication-removed', { companyId: SAME_TENANT_COMPANY_ID, overrides: { ...PUBLISHED } });
      let stored: Record<string, unknown> = {};
      await withSeedContext(env, async (seedCtx) => {
        stored = (await seedCtx.firestore().collection('files').doc('publication-removed').get()).data() ?? {};
      });
      const { classification: _dropped, ...withoutClassification } = stored;

      await expectDeny(fileDoc('publication-removed').set({ ...withoutClassification, isDeleted: true }));
      await expectAllow(fileDoc('publication-removed').set({ ...stored, isDeleted: true }));
    });

    it('⛔ γέννηση με διαβάθμιση ή ταυτότητα δημοσίευσης «από κούνια»: ΑΡΝΗΣΗ · ✅ χωρίς', async () => {
      const born = (docId: string, extra: Record<string, unknown>) => fileDoc(docId).set({
        fileName: `${docId}.jpg`,
        mimeType: 'image/jpeg',
        size: 2048,
        status: 'pending',
        isDeleted: false,
        lifecycleState: 'active',
        category: 'photos',
        contentType: 'image/jpeg',
        storagePath: `companies/${SAME_TENANT_COMPANY_ID}/files/${docId}.jpg`,
        createdBy: ADMIN_UID,
        companyId: SAME_TENANT_COMPANY_ID,
        cdeReadReach: 'tenant',
        ...extra,
      });
      await expectDeny(born('born-public', { classification: 'public' }));
      await expectDeny(born('born-internal', { classification: 'internal' }));
      await expectDeny(born('born-identity', { publicationIdentity: PUBLISHED.publicationIdentity }));
      await expectAllow(born('born-unclassified', {}));
    });
  });

  // --- ADR-862 Φ0 (Β11) — Η ΑΝΑΓΝΩΣΗ ΑΚΟΛΟΥΘΕΙ ΤΗΝ ΚΑΤΑΣΤΑΣΗ -----------------
  //
  // 🔑 Εκτός μήτρας για τον ίδιο λόγο με το πάγωμα: ρωτά «ποιο ΦΙΛΤΡΟ / ποια ΦΑΣΗ»,
  // όχι «ποιο πρόσωπο». Πρόσωπο: `same_tenant_user` — περνά μισθωτή και ανάγνωση, δεν
  // είναι δημιουργός, δεν έχει παράκαμψη. Κάθε άρνηση αποδίδεται ΜΟΝΟ στον φράχτη.
  describe('cde read — η ανάγνωση ακολουθεί την κατάσταση (ADR-862 Φ0 Β11)', () => {
    const USER_UID = PERSONA_CLAIMS.same_tenant_user.uid;
    const files = () => getContext(env, 'same_tenant_user').firestore().collection('files');

    async function seedForeignWip(docId: string): Promise<void> {
      await seedFile(env, docId, {
        companyId: SAME_TENANT_COMPANY_ID,
        overrides: { createdBy: 'u-colleague', cdeState: 'WIP', cdeReadReach: 'author' },
      });
    }

    it('✅ λίστα με φράχτη γραφείου: ΕΠΙΤΡΕΠΕΤΑΙ', async () => {
      await seedFile(env, 'cde-read-tenant', { companyId: SAME_TENANT_COMPANY_ID });
      await expectAllow(
        files()
          .where('companyId', '==', SAME_TENANT_COMPANY_ID)
          .where('cdeReadReach', '==', 'tenant')
          .get(),
      );
    });

    it('🔴 λίστα ΧΩΡΙΣ φίλτρο φράχτη: ΑΡΝΗΣΗ — «rules are not filters», ακόμη και χωρίς κανένα WIP', async () => {
      await seedFile(env, 'cde-read-unfiltered', { companyId: SAME_TENANT_COMPANY_ID });
      await expectDeny(files().where('companyId', '==', SAME_TENANT_COMPANY_ID).get());
    });

    it('⛔ λίστα που ζητά τα `author` όλου του γραφείου: ΑΡΝΗΣΗ', async () => {
      await seedForeignWip('cde-read-author-list');
      await expectDeny(
        files()
          .where('companyId', '==', SAME_TENANT_COMPANY_ID)
          .where('cdeReadReach', '==', 'author')
          .get(),
      );
    });

    it('✅ λίστα «τα δικά μου» (`createdBy == uid`): ΕΠΙΤΡΕΠΕΤΑΙ — φέρνει και το WIP μου', async () => {
      await seedFile(env, 'cde-read-own-wip', {
        companyId: SAME_TENANT_COMPANY_ID,
        overrides: { createdBy: USER_UID, cdeState: 'WIP', cdeReadReach: 'author' },
      });
      await expectAllow(
        files()
          .where('companyId', '==', SAME_TENANT_COMPANY_ID)
          .where('createdBy', '==', USER_UID)
          .get(),
      );
    });

    it('⛔ get ΞΕΝΟΥ WIP με γνωστό id: ΑΡΝΗΣΗ — το όριο του ADR-373 κλείνει', async () => {
      await seedForeignWip('cde-read-foreign-wip');
      await expectDeny(files().doc('cde-read-foreign-wip').get());
    });

    it('✅ get ΔΙΚΟΥ WIP: ΕΠΙΤΡΕΠΕΤΑΙ', async () => {
      await seedFile(env, 'cde-read-get-own-wip', {
        companyId: SAME_TENANT_COMPANY_ID,
        overrides: { createdBy: USER_UID, cdeState: 'WIP', cdeReadReach: 'author' },
      });
      await expectAllow(files().doc('cde-read-get-own-wip').get());
    });

    it('✅ get εγγράφου ΠΡΙΝ τη μετανάστευση (χωρίς φράχτη): ΕΠΙΤΡΕΠΕΤΑΙ — «όπως σήμερα»', async () => {
      // Γραμμένο απευθείας, όχι με τον σπορέα: ο σπορέας βάζει πλέον φράχτη σε κάθε έγγραφο.
      await withSeedContext(env, async (seedCtx) => {
        await seedCtx.firestore().collection('files').doc('cde-read-legacy').set({
          id: 'cde-read-legacy',
          companyId: SAME_TENANT_COMPANY_ID,
          createdBy: 'u-colleague',
          status: 'ready',
        });
      });
      await expectAllow(files().doc('cde-read-legacy').get());
    });
  });
  // --- ADR-281 · ADR-329 §3.9 (Στάδιο 3β) — το αρχείο ακολουθεί το ακίνητό του -----------
  //
  // 🔑 ΓΙΑΤΙ ΕΞΩ ΑΠΟ ΤΗ ΜΗΤΡΑ: ίδιος λόγος με το `cde freeze` — η ερώτηση δεν είναι «ποιο
  // ΠΡΟΣΩΠΟ», είναι «σε ποια ΚΑΤΑΣΤΑΣΗ είναι ο γονέας», και η απάντηση είναι ίδια για όλους.
  //
  // 🔴 ΤΟ ΠΡΟΣΩΠΟ ΕΙΝΑΙ ΕΠΙΛΟΓΗ: ο `same_tenant_admin` περνά κάθε άλλο σκέλος, άρα κάθε
  // `expectDeny` αποδίδεται ΜΟΝΟ στον γονέα. Και κάθε άρνηση έχει δίπλα της το ΙΔΙΟ φορτίο
  // πάνω σε ζωντανό ακίνητο που ΠΕΡΝΑ — αλλιώς θα ήταν πράσινη επειδή το φορτίο ήταν άκυρο.
  //
  // 🔑 Οι δύο καταστάσεις διαβάζονται από το `trashed-status.ts` (ό,τι γράφει ο διακομιστής),
  // ΟΧΙ αντιγραμμένες: αν αλλάξει η τιμή εκεί και όχι στον κανόνα, αυτό το μπλοκ κοκκινίζει.
  describe('retired parent — το αρχείο αποσυρμένου ακινήτου είναι κλειδωμένο (ADR-329 §3.9)', () => {
    const ADMIN_UID = PERSONA_CLAIMS.same_tenant_admin.uid;
    const PROPERTY_ID = 'prop-parent';
    const OTHER_PROPERTY_ID = 'prop-other-live';

    const fileDoc = (docId: string) =>
      getContext(env, 'same_tenant_admin').firestore().collection('files').doc(docId);

    const seedParent = (status: string, propertyId: string = PROPERTY_ID) =>
      seedProperty(env, propertyId, 'proj-1', {
        overrides: { companyId: SAME_TENANT_COMPANY_ID, status },
      });

    const seedChild = (docId: string, overrides: Record<string, unknown> = {}) =>
      seedFile(env, docId, {
        companyId: SAME_TENANT_COMPANY_ID,
        overrides: { entityType: 'property', entityId: PROPERTY_ID, ...overrides },
      });

    function createPayload(extra: Record<string, unknown> = {}): Record<string, unknown> {
      return {
        fileName: 'retired-parent.pdf',
        mimeType: 'application/pdf',
        size: 2048,
        status: 'pending',
        isDeleted: false,
        storagePath: `companies/${SAME_TENANT_COMPANY_ID}/files/retired-parent.pdf`,
        createdBy: ADMIN_UID,
        companyId: SAME_TENANT_COMPANY_ID,
        cdeReadReach: 'tenant',
        entityType: 'property',
        entityId: PROPERTY_ID,
        ...extra,
      };
    }

    const RETIRED = [
      ['αρχείο', ARCHIVED_STATUS],
      ['κάδος', TRASHED_STATUS],
    ] as const;

    describe.each(RETIRED)('ακίνητο στο %s', (_place, status) => {
      it('⛔ νέο αρχείο (εκκρεμής εγγραφή): ΑΡΝΗΣΗ', async () => {
        await seedParent(status);
        await expectDeny(fileDoc('retired-create').set(createPayload()));
      });

      it('⛔ οριστικοποίηση pending → ready: ΑΡΝΗΣΗ', async () => {
        await seedParent(status);
        await seedChild('retired-finalize', { status: 'pending' });
        await expectDeny(fileDoc('retired-finalize').update({ status: 'ready' }));
      });

      it('⛔ κάδος αρχείου: ΑΡΝΗΣΗ', async () => {
        await seedParent(status);
        await seedChild('retired-trash');
        await expectDeny(fileDoc('retired-trash').update({ isDeleted: true }));
      });

      it('⛔ επαναφορά αρχείου από τον κάδο: ΑΡΝΗΣΗ', async () => {
        await seedParent(status);
        await seedChild('retired-restore', { isDeleted: true });
        await expectDeny(fileDoc('retired-restore').update({ isDeleted: false }));
      });

      it('⛔ σύνδεση / αποσύνδεση (`linkedTo`): ΑΡΝΗΣΗ', async () => {
        await seedParent(status);
        await seedChild('retired-link');
        await expectDeny(fileDoc('retired-link').update({ linkedTo: ['building:b1'] }));
      });

      it('⛔ οριστική διαγραφή: ΑΡΝΗΣΗ — το αρχείο υπάρχει για να ΔΙΑΤΗΡΕΙ', async () => {
        await seedParent(status);
        await seedChild('retired-delete');
        await expectDeny(fileDoc('retired-delete').delete());
      });

      it('⛔ αρχείο ΖΩΝΤΑΝΟΥ ακινήτου δεν μετακομίζει κάτω από το αποσυρμένο: ΑΡΝΗΣΗ', async () => {
        await seedParent(status);
        await seedParent('for-sale', OTHER_PROPERTY_ID);
        await seedChild('retired-move-in', { entityId: OTHER_PROPERTY_ID });
        await expectDeny(fileDoc('retired-move-in').update({ isDeleted: true, entityId: PROPERTY_ID }));
      });

      it('✅ η ΑΝΑΓΝΩΣΗ μένει: το πλαίσιο πρέπει να μπορεί να δείξει τα αρχεία του', async () => {
        await seedParent(status);
        await seedChild('retired-read');
        await expectAllow(fileDoc('retired-read').get());
      });
    });

    describe('ζωντανό ακίνητο — τα ΙΔΙΑ φορτία περνούν', () => {
      it('✅ νέο αρχείο', async () => {
        await seedParent('for-sale');
        await expectAllow(fileDoc('live-create').set(createPayload()));
      });

      it('✅ οριστικοποίηση pending → ready', async () => {
        await seedParent('for-sale');
        await seedChild('live-finalize', { status: 'pending' });
        await expectAllow(fileDoc('live-finalize').update({ status: 'ready' }));
      });

      it('✅ κάδος αρχείου', async () => {
        await seedParent('for-sale');
        await seedChild('live-trash');
        await expectAllow(fileDoc('live-trash').update({ isDeleted: true }));
      });

      it('✅ επαναφορά αρχείου', async () => {
        await seedParent('for-sale');
        await seedChild('live-restore', { isDeleted: true });
        await expectAllow(fileDoc('live-restore').update({ isDeleted: false }));
      });

      it('✅ σύνδεση / αποσύνδεση', async () => {
        await seedParent('for-sale');
        await seedChild('live-link');
        await expectAllow(fileDoc('live-link').update({ linkedTo: ['building:b1'] }));
      });

      it('✅ οριστική διαγραφή', async () => {
        await seedParent('for-sale');
        await seedChild('live-delete');
        await expectAllow(fileDoc('live-delete').delete());
      });
    });

    describe('ό,τι ΔΕΝ είναι αρχείο αποσυρμένου ακινήτου — ο φρουρός δεν το αγγίζει', () => {
      it('✅ ακίνητο που δεν υπάρχει (ακόμη): το ανύπαρκτο δεν είναι αποσυρμένο', async () => {
        await expectAllow(fileDoc('orphan-create').set(createPayload({ entityId: 'prop-not-yet' })));
      });

      it('✅ αρχείο ΑΛΛΗΣ οντότητας με το ίδιο id: ο φρουρός κρίνει μόνο `entityType == property`', async () => {
        await seedParent(ARCHIVED_STATUS);
        await expectAllow(fileDoc('other-entity').set(createPayload({ entityType: 'building' })));
      });
    });
  });
});

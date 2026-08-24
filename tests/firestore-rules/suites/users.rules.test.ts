/**
 * Firestore Rules — `users` collection
 *
 * Pattern: ownership — uid==userId || belongsToCompany read; uid==userId || companyAdmin write.
 *
 * Seed doc: docId = PERSONA_CLAIMS.same_tenant_user.uid ('persona-same-user').
 *   - same_tenant_user × read/update → allow (uid == docId)
 *   - same_tenant_admin × read/update → allow (belongsToCompany / isCompanyAdminOfCompany)
 *   - super_admin × read/update → allow (isSuperAdminOnly + isCompanyAdminOfCompany)
 *   - cross_tenant_admin × all → deny (different company, no uid match)
 *
 * Create note: harness uses fresh docId — same_tenant_user cannot create arbitrary
 * docs (not a company admin, uid != fresh docId → deny). super_admin and
 * same_tenant_admin pass via isCompanyAdminOfCompany.
 *
 * Delete: allow delete: if false — user docs are never client-deleted.
 *
 * See ADR-298 §4 Phase C.6 (2026-04-14).
 *
 * @since 2026-04-14 (ADR-298 Phase C.6)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, expectAllow, expectDeny, type AssertTarget } from '../_harness/assertions';
import { seedUser } from '../_harness/seed-helpers-users';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { PERSONA_CLAIMS, SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'users',
)!;

describe('users.rules — uid-ownership + companyAdmin write (usersMatrix)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  // Seed docId = same_tenant_user.uid so uid==userId paths are exercised
  const docId = PERSONA_CLAIMS.same_tenant_user.uid;

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        await seedUser(env, docId);
        const ctx = getContext(env, cell.persona);
        const target: AssertTarget = {
          collection: 'users',
          docId,
          data: { displayName: 'Updated User', updatedAt: new Date() },
          createData: {
            companyId: SAME_TENANT_COMPANY_ID,
            displayName: 'New User',
            email: 'new-user@test.com',
            globalRole: 'internal_user',
            createdAt: new Date(),
          },
          listFilter: { field: 'companyId', op: '==', value: SAME_TENANT_COMPANY_ID },
        };
        await assertCell(ctx, cell, target);
      });
    });
  }

  // ── Own-profile signup regression ────────────────────────────────────────
  // The create rule has an `uid == userId` leg that the matrix loop cannot
  // exercise (harness always generates a fresh docId). This block verifies
  // same_tenant_user CAN create their own profile doc (docId == their uid).
  describe('own-profile signup regression', () => {
    it('same_tenant_user × create own uid doc → allow', async () => {
      const ctx = getContext(env, 'same_tenant_user');
      const ownDocRef = ctx.firestore()
        .collection('users')
        .doc(PERSONA_CLAIMS.same_tenant_user.uid);
      await expectAllow(ownDocRef.set({
        companyId: SAME_TENANT_COMPANY_ID,
        displayName: 'Own Profile',
        email: 'own@test.com',
        globalRole: 'internal_user',
        createdAt: new Date(),
      }));
    });
  });

  // ── Ο ΚΑΘΡΕΦΤΗΣ ΠΡΕΠΕΙ ΝΑ ΑΠΟΔΕΙΚΝΥΕΤΑΙ ΚΑΘΡΕΦΤΗΣ (ADR-787 §5.3) ─────────
  //
  // 🔴 ΓΙΑΤΙ ΥΠΑΡΧΟΥΝ: μέχρι 2026-08-24 ο κανόνας ήταν `uid == userId` **χωρίς
  // allowlist πεδίων** — ο χρήστης έγραφε ΟΤΙΔΗΠΟΤΕ στο δικό του έγγραφο, και
  // **τρία** σημεία του διακομιστή το διάβαζαν ως αλήθεια (δες το σχόλιο στο
  // `firestore.rules`, match /users/{userId}).
  //
  // ⚠️ ΚΑΙ ΤΑ 26 ΥΠΑΡΧΟΝΤΑ TESTS ΗΤΑΝ ΠΡΑΣΙΝΑ ΠΡΙΝ ΚΑΙ ΜΕΤΑ τη διόρθωση:
  // **καμία** άγκυρα δεν ρωτούσε τι γράφεται, μόνο **ποιος** γράφει. Αυτό είναι
  // το σχήμα CHECK 3.36 — *ένα anchor χωρίς gate είναι σχόλιο*, εδώ στην
  // αντίστροφη μορφή του: *ένα gate χωρίς anchor είναι ευχή*.
  //
  // ⚠️ Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΕΙΝΑΙ ΥΠΟΧΡΕΩΤΙΚΟΣ (Κ5/Κ6): χωρίς αυτόν, ένας κανόνας που
  // αρνείται **τα πάντα** θα έβγαζε όλες τις αρνήσεις πράσινες — και θα έσπαγε
  // κάθε σύνδεση στην παραγωγή, με τη σουίτα να το επιβεβαιώνει.
  describe('προνομιακά πεδία — ο καθρέφτης πρέπει να αποδεικνύεται', () => {
    const ownUid = PERSONA_CLAIMS.same_tenant_user.uid;

    /** Το έγγραφο του ίδιου του καλούντος, μέσω του context του. */
    function ownDoc() {
      return getContext(env, 'same_tenant_user').firestore().collection('users').doc(ownUid);
    }

    // ── UPDATE: η βλάβη ──────────────────────────────────────────────────
    it('Κ1 — αυτο-ανύψωση globalRole ≠ claim → DENY', async () => {
      await seedUser(env, ownUid);
      await expectDeny(ownDoc().update({ globalRole: 'company_admin' }));
    });

    it('Κ2 — αυτο-γραμμένο companyId ≠ claim → DENY (παράκαμψη ADR-660)', async () => {
      await seedUser(env, ownUid);
      await expectDeny(ownDoc().update({ companyId: 'company-θύμα' }));
    });

    it('Κ3 — αυτο-γραμμένο status → DENY (το γράφει ο διακομιστής)', async () => {
      await seedUser(env, ownUid);
      await expectDeny(ownDoc().update({ status: 'active' }));
    });

    it('Κ4 — αυτο-γραμμένα permissions → DENY', async () => {
      await seedUser(env, ownUid);
      await expectDeny(ownDoc().update({ permissions: ['admin_access'] }));
    });

    it('Κ4β — αλλοίωση createdAt → DENY', async () => {
      await seedUser(env, ownUid);
      await expectDeny(ownDoc().update({ createdAt: new Date(0) }));
    });

    // ── UPDATE: ο ΠΑΡΟΝΟΜΑΣΤΗΣ ───────────────────────────────────────────
    it('Κ5 — ο ΝΟΜΙΜΟΣ συγχρονισμός claims (τιμή == claim) → ALLOW', async () => {
      // Το έγγραφο ξεκινά **αποκλίνον** από τα claims, αλλιώς η γραμμή δεν
      // αλλάζει και ο κλάδος του καθρέφτη ΔΕΝ ασκείται ποτέ.
      await seedUser(env, ownUid, { overrides: { globalRole: 'external_user' } });
      await expectAllow(ownDoc().update({
        globalRole: PERSONA_CLAIMS.same_tenant_user.globalRole,
      }));
    });

    it('Κ6 — τα ακίνδυνα πεδία του προφίλ → ALLOW', async () => {
      await seedUser(env, ownUid);
      await expectAllow(ownDoc().update({
        displayName: 'Νέο Όνομα',
        photoURL: 'https://example.test/a.png',
        loginCount: 7,
        updatedAt: new Date(),
      }));
    });

    // ── CREATE: η ίδια τρύπα, στη γέννηση ────────────────────────────────
    it('Κ7 — γέννηση με globalRole ≠ claim → DENY', async () => {
      await expectDeny(ownDoc().set({
        companyId: SAME_TENANT_COMPANY_ID,
        globalRole: 'super_admin',
        email: 'own@test.com',
        createdAt: new Date(),
      }));
    });

    it('Κ8 — γέννηση με status που ΔΕΝ παράγεται από το claim → DENY', async () => {
      // Ο καλών **έχει** tenant claim ⇒ το μόνο συνεπές status είναι 'active'.
      await expectDeny(ownDoc().set({
        companyId: SAME_TENANT_COMPANY_ID,
        globalRole: PERSONA_CLAIMS.same_tenant_user.globalRole,
        status: 'pending',
        email: 'own@test.com',
        createdAt: new Date(),
      }));
    });

    it('Κ9 — γέννηση με status ΠΑΡΑΓΟΜΕΝΟ από το claim → ALLOW (παρονομαστής του Κ8)', async () => {
      await expectAllow(ownDoc().set({
        companyId: SAME_TENANT_COMPANY_ID,
        globalRole: PERSONA_CLAIMS.same_tenant_user.globalRole,
        status: 'active',
        email: 'own@test.com',
        createdAt: new Date(),
      }));
    });
  });
});

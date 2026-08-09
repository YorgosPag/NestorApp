/**
 * Firestore Rules — συλλογή `public_lands` (ADR-777 Α1, SPEC-777A §14.4)
 *
 * Σχήμα κανόνα (firestore.rules):
 *   - read:  `if true`   ← κοινό φυσικό γεγονός, ορατό ΚΑΙ σε ανώνυμο
 *   - write: `if false`  ← γράφει ΜΟΝΟ ο διακομιστής (Admin SDK, παρακάμπτει κανόνες)
 *
 * 🔴 ΤΙ ΑΚΡΙΒΩΣ ΦΡΟΥΡΕΙ ΑΥΤΗ Η ΣΟΥΙΤΑ, ΚΑΙ ΓΙΑΤΙ ΔΕΝ ΕΙΝΑΙ ΤΥΠΙΚΟΤΗΤΑ:
 *
 * 1. **`cross_tenant_admin × read → allow`.** Σε κάθε ΑΛΛΗ συλλογή του έργου αυτό το
 *    κελί είναι `deny (cross_tenant)` — είναι ο πυρήνας της απομόνωσης πελατών. Εδώ
 *    πρέπει να είναι `allow`, και αυτό **είναι ολόκληρη η Α11**: αν δύο πελάτες δεν
 *    μπορούν να δουν την ίδια γη, η προσφορά του ενός δεν συναντά ποτέ τη ζήτηση του
 *    άλλου (§14.5). Μια «διόρθωση» αυτού του κελιού σε deny θα φαινόταν **βελτίωση
 *    ασφαλείας** και θα κατέστρεφε τον λόγο ύπαρξης του συστήματος.
 *
 * 2. **`super_admin × create/update/delete → deny (server_only)`.** Κανένας ρόλος δεν
 *    γράφει από τον πελάτη. Μέχρι σήμερα ένα λάθος έγραφε σε **έναν** πελάτη· εδώ
 *    γράφει για **όλους ταυτόχρονα** (§14.4).
 *
 * 3. **Το seed δεν έχει `companyId`** — εξ ορισμού (Α11). Ένα seed με companyId θα
 *    δοκίμαζε τους κανόνες πάνω σε έγγραφο που δεν μοιάζει με την παραγωγή.
 *
 * @since 2026-08-09 (ADR-777 Β1)
 */

import {
  initEmulator,
  teardownEmulator,
  resetData,
} from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { seedPublicLand } from '../_harness/seed-helpers';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'public_lands',
)!;

describe('public_lands.rules — public_world (ADR-777 επίπεδο Α)', () => {
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
        const docId = 'land-public-1';
        await seedPublicLand(env, docId);

        const ctx = getContext(env, cell.persona);

        const target: AssertTarget = {
          collection: 'public_lands',
          docId,
          // Το update payload είναι αδιάφορο (ο κανόνας είναι `if false`), αλλά
          // μη κενό ώστε να μη χρησιμοποιηθεί placeholder fallback.
          data: { displayAddress: 'ΟΔΟΣ ΔΟΚΙΜΗΣ 1' },
          createData: {
            position: { kind: 'unknown' },
            displayAddress: null,
            areaSqm: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          // ⚠️ ΚΑΝΕΝΑ listFilter: δεν υπάρχει `companyId` να φιλτράρει. Η ΑΦΙΛΤΡΑΡΙΣΤΗ
          // λίστα είναι εδώ **νόμιμη** — και είναι ακριβώς αυτό που πρέπει να
          // αποδειχθεί ότι επιτρέπεται.
        };

        await assertCell(ctx, cell, target);
      });
    });
  }
});

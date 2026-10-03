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

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { useDenyAllEmulator } from '../_harness/deny-all-suite';
import { definePublicWorldCell, type PublicWorldFixture } from '../_harness/public-world-suite';
import { seedPublicLand } from '../_harness/seed-helpers';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'public_lands')!;

const FIXTURE: PublicWorldFixture = {
  collection: 'public_lands',
  docId: 'land-public-1',
  seed: (env) => seedPublicLand(env, 'land-public-1'),
  data: { displayAddress: 'ΟΔΟΣ ΔΟΚΙΜΗΣ 1' },
  createData: {
    position: { kind: 'unknown' },
    displayAddress: null,
    areaSqm: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

describe('public_lands.rules — public_world (ADR-777 επίπεδο Α)', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    definePublicWorldCell(env, cell, FIXTURE);
  }
});

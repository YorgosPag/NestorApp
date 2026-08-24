/**
 * Storage Rules — Φωτογραφία προφίλ (ADR-798 §16)
 *
 * Pattern: authenticated_read_owner_write
 *
 * Path: /users/{userId}/{fileName}
 *
 * Rules:
 *   read:   `isAuthenticated()`
 *   write:  `isOwner(userId) && size < 2 MB && contentType matches image/*`
 *   delete: `isOwner(userId) || isSuperAdmin()`
 *
 * Τι κλειδώνει αυτή η σουίτα — και **γιατί κάθε γραμμή είναι απαραίτητη**:
 *
 *   - `same_tenant_user` **είναι ο ιδιοκτήτης** (uid == το `{userId}` του path)
 *     ⇒ διαβάζει, γράφει, σβήνει.
 *   - `super_admin` διαβάζει και **σβήνει** (αφαίρεση ακατάλληλης εικόνας είναι
 *     νόμιμη διαχειριστική πράξη) αλλά **ΔΕΝ γράφει**: κανείς δεν βάζει
 *     φωτογραφία σε ξένο πρόσωπο. Αυτή η γραμμή είναι ολόκληρη η διαφορά από το
 *     `owner_based`, όπου ο super_admin δεν γράφει επειδή το ξέχασε ο κανόνας —
 *     εδώ **επειδή το εννοεί**.
 *   - `same_tenant_admin` και `cross_tenant_user` **διαβάζουν**. Δεν είναι
 *     παράλειψη: τα avatar εμφανίζονται σε λίστες, σχόλια και αναθέσεις, και οι
 *     Storage rules **δεν μπορούν να διαβάσουν Firestore**, άρα «ίδια εταιρεία;»
 *     δεν είναι καν εκφράσιμο εδώ (το `companyId` δεν υπάρχει στο path).
 *     ⚠️ Παραμένει αυστηρότερο από τη σημερινή κατάσταση, όπου το `photoURL`
 *     δείχνει σε **δημόσιο** `lh3.googleusercontent.com`.
 *   - `anonymous` → τίποτα.
 *
 * ⚠️ ΤΟ `cross_tenant_user × read: allow` ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ, ΟΧΙ ΑΤΥΧΗΜΑ. Αν
 * κάποτε γίνει εκφράσιμο το «ίδια εταιρεία;», **αυτή** η γραμμή αλλάζει πρώτη.
 *
 * @since 2026-08-24 (ADR-798 Φάση 5)
 */

import {
  initStorageEmulator,
  teardownStorageEmulator,
  resetStorageData,
} from '../_harness/emulator';
import { getStorageContext } from '../_harness/auth-contexts';
import { assertStorageCell, type AssertStorageTarget } from '../_harness/assertions';
import { seedStorageFile } from '../_harness/seed-helpers';
import { STORAGE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { OWNER_USER_UID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = STORAGE_RULES_COVERAGE.find((c) => c.pathId === 'user_avatars')!;

/**
 * Το `{userId}` του path ΠΡΕΠΕΙ να ισούται με το uid της `same_tenant_user`,
 * αλλιώς η σουίτα δοκιμάζει «κανείς δεν είναι ιδιοκτήτης» — δηλαδή άλλο ερώτημα.
 */
const TEST_PATH = `users/${OWNER_USER_UID}/avatar.webp`;

describe('user-avatars.storage — authenticated_read_owner_write pattern', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => {
    env = await initStorageEmulator();
  });

  afterAll(async () => {
    await teardownStorageEmulator(env);
  });

  afterEach(async () => {
    await resetStorageData(env);
  });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        // Σπέρνουμε αρχείο για read/delete ώστε μια άρνηση να οφείλεται στον
        // ΚΑΝΟΝΑ και όχι σε `object-not-found` — αλλιώς το test θα ήταν πράσινο
        // για λάθος λόγο.
        if (cell.operation === 'read' || cell.operation === 'delete') {
          await seedStorageFile(env, TEST_PATH);
        }

        const ctx = getStorageContext(env, cell.persona);
        const target: AssertStorageTarget = { path: TEST_PATH };

        await assertStorageCell(ctx, cell, target);
      });
    });
  }
});

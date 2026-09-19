/**
 * Storage Rules — Φωτογραφία προφίλ (ADR-798 §16)
 *
 * Pattern: authenticated_read_owner_write
 *
 * Path: /users/{userId}/{fileName}
 *
 * Rules:
 *   read:   `isAuthenticated()`
 *   write:  `isOwner(userId) && size < 2 MB && contentType matches image/(webp|png)`
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
import {
  assertStorageCell,
  expectStorageAllow,
  expectStorageDeny,
  type AssertStorageTarget,
} from '../_harness/assertions';
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

/**
 * Ο κανόνας απαιτεί `contentType.matches('image/(webp|png)')`. Το προεπιλεγμένο
 * `application/octet-stream` του harness έκοβε **και το allow cell** του ιδιοκτήτη ⇒ η σουίτα
 * ήταν κόκκινη για λάθος λόγο από τη γέννησή της (941d4c56, 2026-08-24) — ίδια παγίδα με το
 * `dxf-external-references`. `image/webp` = ό,τι στέλνει πράγματι ο encoder (`avatar-upload.service`).
 */
const AVATAR_CONTENT_TYPE = 'image/webp';

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
        const target: AssertStorageTarget = { path: TEST_PATH, contentType: AVATAR_CONTENT_TYPE };

        await assertStorageCell(ctx, cell, target);
      });
    });
  }
});

/**
 * Η ρήτρα `contentType` του κανόνα **χωρίς** αυτά τα pins δεν τη φυλάει κανείς: ο πίνακας
 * ελέγχει «ΠΟΙΟΣ», όχι «ΤΙ». Ο κανόνας γράφει `image/(webp|png)` και **ΟΧΙ** `image/.*`: το
 * `image/svg+xml` σερβίρεται από το download URL ως εκτελέσιμο έγγραφο (stored-XSS, ADR-366 §12)
 * — και η επιστροφή στο `.*` είναι αλλαγή δύο χαρακτήρων, οπότε χρειάζεται pin.
 */
describe('user-avatars.storage — content-type guard (ADR-798 §16)', () => {
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

  const ownerPut = (suffix: string, contentType: string) =>
    getStorageContext(env, 'same_tenant_user')
      .storage()
      .ref(`${TEST_PATH}--${suffix}`)
      .put(new Uint8Array([0xaa]), { contentType });

  it('δέχεται PNG — το δεύτερο σκέλος του `webp|png` είναι ζωντανό (ο encoder το βγάζει)', async () => {
    await expectStorageAllow(ownerPut('png', 'image/png'));
  });

  it('απορρίπτει SVG — ο φορέας του stored-XSS', async () => {
    await expectStorageDeny(ownerPut('svg', 'image/svg+xml'));
  });

  it('απορρίπτει JPEG — ο encoder δεν το βγάζει ποτέ, άρα ο κανόνας δεν το υπόσχεται', async () => {
    await expectStorageDeny(ownerPut('jpeg', 'image/jpeg'));
  });

  it('απορρίπτει octet-stream — τίποτα αδιαφανές σε αυτό το path', async () => {
    await expectStorageDeny(ownerPut('octet', 'application/octet-stream'));
  });
});

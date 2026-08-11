/**
 * Storage Rules — τα αρχεία της **προσφοράς του ιδιώτη** (ADR-777 Α14)
 *
 * Pattern: `owner_based_no_superadmin`
 *
 * Path: `/owner_properties/{userId}/{ownerPropertyId}/{fileName}`
 *
 * Rules:
 *   read:   `isOwner(userId)`
 *   write:  `isOwner(userId) && isValidFileSize() && isAllowedContentType()`
 *   delete: `isOwner(userId)`
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΦΡΟΥΡΕΙ ΕΔΩ Ο ΠΙΝΑΚΑΣ — ΚΑΙ ΤΙ **ΔΕΝ ΜΠΟΡΕΙ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο πίνακας απαντά *«ποιος περνά;»* για **μία** διαδρομή με **ένα** αρχείο. Δύο
 * συμβόλαια αυτού του block είναι δομικά ανέκφραστα εκεί:
 *
 *   **Α1. Η ΑΠΟΜΟΝΩΣΗ ΕΙΝΑΙ ΤΟ ΙΔΙΟ ΤΟ ΜΟΝΟΠΑΤΙ.** Το `{userId}` μπαίνει **πριν** το
 *   `{ownerPropertyId}` ώστε η ερώτηση «ποιανού είναι;» να απαντιέται **χωρίς καμία
 *   ανάγνωση** — ακριβώς οι cross-service helpers που αφαιρέθηκαν το 2026-07-26 για
 *   latency. Ο πίνακας δοκιμάζει **ένα** μονοπάτι, οπότε δεν μπορεί να δείξει ότι το
 *   ίδιο `ownerPropertyId` κάτω από **ξένο** `userId` είναι απρόσιτο.
 *
 *   **Α2. Ο ΕΛΕΓΧΟΣ ΤΥΠΟΥ ΑΡΧΕΙΟΥ.** Σε αντίθεση με το `/temp/`, εδώ τα αρχεία
 *   **μένουν**, οπότε ο κανόνας απαιτεί και `isAllowedContentType()`. Ο πίνακας
 *   γράφει **ένα** φορτίο, άρα ένα «όλα πράσινα» δεν λέει τίποτα για τον τύπο.
 *
 * @since 2026-08-11 (ADR-777 Α14)
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
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = STORAGE_RULES_COVERAGE.find(
  (c) => c.pathId === 'owner_property_media',
)!;

/** Το `{userId}` της διαδρομής **πρέπει** να είναι το uid του `same_tenant_user`. */
const OWNER_UID = OWNER_USER_UID;
const LISTING_ID = 'ownp-media-1';
const FILE_NAME = 'katopsi.pdf';

const TEST_PATH = `owner_properties/${OWNER_UID}/${LISTING_ID}/${FILE_NAME}`;

describe('owner-property-media.storage — ο κάτοχος και κανείς άλλος (ADR-777 Α14)', () => {
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
        if (cell.operation === 'read' || cell.operation === 'delete') {
          await seedStorageFile(env, TEST_PATH);
        }

        const ctx = getStorageContext(env, cell.persona);
        const target: AssertStorageTarget = { path: TEST_PATH };

        await assertStorageCell(ctx, cell, target);
      });
    });
  }

  // ==========================================================================
  // Α1 — Η ΑΠΟΜΟΝΩΣΗ ΕΙΝΑΙ ΤΟ ΜΟΝΟΠΑΤΙ
  // ==========================================================================

  describe('🔴 Α1 — ίδια ταυτότητα αγγελίας, ΞΕΝΟ uid στη διαδρομή', () => {
    it('ο κάτοχος ΔΕΝ φτάνει στο αρχείο άλλου, ούτε αν ξέρει το ownerPropertyId', async () => {
      const foreignPath = `owner_properties/persona-cross-user/${LISTING_ID}/${FILE_NAME}`;
      await seedStorageFile(env, foreignPath);

      const owner = getStorageContext(env, 'same_tenant_user');

      await assertFails(owner.storage().ref(foreignPath).getDownloadURL());
    });

    it('🔑 και φτάνει κανονικά στο ΔΙΚΟ του — ο παρονομαστής της παραπάνω', async () => {
      await seedStorageFile(env, TEST_PATH);

      const owner = getStorageContext(env, 'same_tenant_user');

      await assertSucceeds(owner.storage().ref(TEST_PATH).getDownloadURL());
    });
  });
});

/**
 * Storage Rules — η **προσωπική ρίζα** της κανονικής διαδρομής (ADR-866 §5.2)
 *
 * Pattern: `owner_based_no_superadmin`
 *
 * Path: `/people/{userId}/entities/{entityType}/{entityId}/domains/{domain}/categories/{category}/files/{fileName}`
 *
 * Rules:
 *   read:   `isOwner(userId)`
 *   write:  `isOwner(userId) && isValidFileSize() && isAllowedContentType()`
 *   delete: `isOwner(userId)`
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΦΡΟΥΡΕΙ Ο ΠΙΝΑΚΑΣ — ΚΑΙ ΤΙ **ΔΕΝ ΜΠΟΡΕΙ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο πίνακας (ίδιος με `temp` και `owner_property_media`, `ownerOnlyMatrix()`) απαντά
 * *«ποιος περνά;»* για **μία** διαδρομή. Δύο συμβόλαια είναι ανέκφραστα εκεί:
 *
 *   **Π1. Η ΑΠΟΜΟΝΩΣΗ ΕΙΝΑΙ Η ΡΙΖΑ.** Η **ίδια** οντότητα κάτω από **ξένο** `userId` είναι
 *   απρόσιτη — αλλιώς ένας άνθρωπος που ξέρει το `entityId` του φακέλου κάποιου άλλου θα
 *   έφτανε στους τίτλους του σπιτιού του.
 *
 *   **Π2. Ο ΤΥΠΟΣ ΑΡΧΕΙΟΥ.** Τα αρχεία **μένουν** (φάκελος ακινήτου), άρα ο κανόνας
 *   απαιτεί `isAllowedContentType()`. Ο πίνακας γράφει ένα φορτίο επιτρεπτού τύπου.
 *
 * ⚠️ Η διαδρομή γράφεται **literal** επειδή η config του storage-rules δεν λύνει `@/`· η
 * συμφωνία της με τον builder (`buildStoragePath({ userId, … })`) αποδεικνύεται στο
 * `src/services/upload/utils/__tests__/storage-path.test.ts` με την **ίδια** συμβολοσειρά.
 *
 * @since 2026-09-17 (ADR-866 Φ0)
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
  (c) => c.pathId === 'canonical_personal',
)!;

/** Το υπόλοιπο σχήμα μετά τη ρίζα — ΙΔΙΟ με την εταιρική κανονική διαδρομή. */
const ENTITY_TAIL = 'entities/owner_property/ownp_1/domains/legal/categories/contracts/files/file_1.pdf';

/** Το `{userId}` της ρίζας **πρέπει** να είναι το uid του `same_tenant_user`. */
const TEST_PATH = `people/${OWNER_USER_UID}/${ENTITY_TAIL}`;

describe('canonical-path-personal.storage — ο κάτοχος και κανείς άλλος (ADR-866 §5.2)', () => {
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

  describe('🔴 Π1 — ίδια οντότητα, ΞΕΝΟ uid στη ρίζα', () => {
    it('ο κάτοχος ΔΕΝ φτάνει στο αρχείο άλλου ανθρώπου, ούτε αν ξέρει το entityId', async () => {
      const foreignPath = `people/persona-cross-user/${ENTITY_TAIL}`;
      await seedStorageFile(env, foreignPath);

      const owner = getStorageContext(env, 'same_tenant_user');

      await assertFails(owner.storage().ref(foreignPath).getMetadata());
    });

    it('🔑 και φτάνει κανονικά στο ΔΙΚΟ του — ο παρονομαστής της παραπάνω', async () => {
      await seedStorageFile(env, TEST_PATH);

      const owner = getStorageContext(env, 'same_tenant_user');

      await assertSucceeds(owner.storage().ref(TEST_PATH).getMetadata());
    });
  });

  describe('🔴 Π2 — ο τύπος αρχείου ελέγχεται, γιατί τα αρχεία ΜΕΝΟΥΝ', () => {
    it('ο κάτοχος ΔΕΝ ανεβάζει τύπο εκτός λίστας (text/html)', async () => {
      const owner = getStorageContext(env, 'same_tenant_user');
      const ref = owner.storage().ref(`${TEST_PATH}--html`);

      await assertFails(ref.put(new Uint8Array([0x3c, 0x68]), { contentType: 'text/html' }));
    });

    it('🔑 και ανεβάζει PDF — ο παρονομαστής της παραπάνω', async () => {
      const owner = getStorageContext(env, 'same_tenant_user');
      const ref = owner.storage().ref(`${TEST_PATH}--pdf`);

      await assertSucceeds(ref.put(new Uint8Array([0x25, 0x50]), { contentType: 'application/pdf' }));
    });
  });
});

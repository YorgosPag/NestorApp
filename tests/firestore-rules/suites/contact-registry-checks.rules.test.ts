/**
 * Firestore Rules — συλλογή `contact_registry_checks` (ADR-948 §8 «Έλεγχος στο ΓΕΜΗ»)
 *
 * Σχήμα κανόνα: `read: if false` · `write: if false` — **και οι δύο πλευρές** ανήκουν αποκλειστικά στον διακομιστή.
 *
 * 🔴 **ΤΟ ΚΕΛΙ ΠΟΥ ΕΧΕΙ ΣΗΜΑΣΙΑ ΕΙΝΑΙ Η ΓΡΑΦΗ ΤΟΥ ΙΔΙΟΥ ΤΟΥ ΓΡΑΦΕΙΟΥ**: το έγγραφο είναι η απάντηση του **ΓΕΜΗ** για
 * μια επαφή-εταιρεία. Αν το γραφείο μπορούσε να το γράψει, η επαφή θα έδειχνε «Επαληθευμένο από ΓΕΜΗ» χωρίς να
 * ρωτηθεί ποτέ το ΓΕΜΗ — ακριβώς γι' αυτό η απάντηση ΔΕΝ ζει μέσα στην επαφή.
 * ⚠️ **Και η ανάγνωση κλειστή**: ο πελάτης παίρνει μόνο την **κρίση** (route), ποτέ το ωμό αντίγραφο.
 *
 * @since 2026-11-22 (ADR-948 §8 Βήμα 6)
 */

import { assertFails } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';
import { getContext, withSeedContext } from '../_harness/auth-contexts';

const COLLECTION = 'contact_registry_checks';
const CONTACT_ID = 'cont_seed';

// ⚠️ Κυριολεκτικό, όχι `COLLECTION`: η πύλη CHECK 3.16 (Validation C) διαβάζει το όνομα από το AST.
export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'contact_registry_checks',
)!;

/** Το έγγραφο **του ίδιου** μισθωτή — χωρίς αυτό, η μετάλλαξη «το γραφείο βλέπει το δικό του» δεν κοκκινίζει. */
async function seedContactRegistryCheck(env: RulesTestEnvironment): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection(COLLECTION).doc(CONTACT_ID).set({
      companyId: SAME_TENANT_COMPANY_ID,
      contactId: CONTACT_ID,
      checkedAt: '2026-11-22T10:00:00.000Z',
      checkedBy: 'uid_seed',
      record: {
        source: 'gemi-opendata',
        registrationNumber: '123456789000',
        legalName: 'ΔΟΚΙΜΑΣΤΙΚΗ ΑΝΩΝΥΜΗ ΕΤΑΙΡΕΙΑ',
        legalForm: { id: '1', label: 'ΑΕ' },
        isBranch: false,
        selfRegistered: true,
      },
    });
  });
}

describe('contact_registry_checks.rules — η απάντηση του ΓΕΜΗ για την επαφή γράφεται μόνο από τον διακομιστή', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }

  describe('🔴 ούτε το ΙΔΙΟ το γραφείο', () => {
    it('το γραφείο ΔΕΝ γράφει «επαληθευμένο από ΓΕΜΗ» μόνο του', async () => {
      const owner = getContext(env(), 'same_tenant_admin');

      await assertFails(
        owner
          .firestore()
          .collection(COLLECTION)
          .doc(CONTACT_ID)
          .set({ companyId: SAME_TENANT_COMPANY_ID, contactId: CONTACT_ID, record: { registrationNumber: '1' } }),
      );
    });

    it('το γραφείο ΔΕΝ διαβάζει το ωμό αντίγραφο — μόνο την κρίση, από τον διακομιστή', async () => {
      await seedContactRegistryCheck(env());
      const owner = getContext(env(), 'same_tenant_admin');

      await assertFails(owner.firestore().collection(COLLECTION).doc(CONTACT_ID).get());
    });

    it('ούτε ανώνυμος', async () => {
      await seedContactRegistryCheck(env());
      const anonymous = getContext(env(), 'anonymous');

      await assertFails(anonymous.firestore().collection(COLLECTION).doc(CONTACT_ID).get());
    });
  });
});

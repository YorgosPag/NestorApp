/**
 * Firestore Rules — συλλογή `professional_registry_checks` (ADR-915 §40.7 Φ2)
 *
 * Σχήμα κανόνα: `read: if false` · `write: if false` — **και οι δύο πλευρές** ανήκουν αποκλειστικά στον διακομιστή.
 *
 * 🔴 **ΤΟ ΚΕΛΙ ΠΟΥ ΕΧΕΙ ΣΗΜΑΣΙΑ ΕΙΝΑΙ Η ΓΡΑΦΗ ΤΟΥ ΙΔΙΟΥ ΤΟΥ ΓΡΑΦΕΙΟΥ**: το έγγραφο είναι η απάντηση της **αρχής**
 * (Μητρώο Ενεργειακών Επιθεωρητών). Αν το γραφείο μπορούσε να το γράψει, η επαφή θα έλεγε «Επαληθεύτηκε στο μητρώο,
 * Β΄ τάξη Κτιρίων» χωρίς να ρωτηθεί ποτέ το μητρώο — ακριβώς γι' αυτό η απάντηση ΔΕΝ ζει μέσα στην επαφή.
 * ⚠️ **Και η ανάγνωση κλειστή**: ο πελάτης παίρνει μόνο την **κρίση** (route), ποτέ το ωμό αντίγραφο.
 *
 * @since 2026-11-15 (ADR-915 §40.7 Φ2)
 */

import { assertFails } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';
import { getContext, withSeedContext } from '../_harness/auth-contexts';

const COLLECTION = 'professional_registry_checks';
const CHECK_ID = 'cont_seed__energy-inspector';

// ⚠️ Κυριολεκτικό, όχι `COLLECTION`: η πύλη CHECK 3.16 (Validation C) διαβάζει το όνομα από το AST.
export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'professional_registry_checks',
)!;

/** Το έγγραφο **του ίδιου** μισθωτή — χωρίς αυτό, η μετάλλαξη «το γραφείο βλέπει το δικό του» δεν κοκκινίζει. */
async function seedRegistryCheck(env: RulesTestEnvironment): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection(COLLECTION).doc(CHECK_ID).set({
      companyId: SAME_TENANT_COMPANY_ID,
      contactId: 'cont_seed',
      licence: 'energy-inspector',
      number: '2600',
      surname: 'ΔΟΚΙΜΑΣΤΙΚΟΣ',
      grades: { buildings: 'A', heating: 'none', cooling: 'none' },
      rowSha256: '0'.repeat(64),
      checkedAt: '2026-11-15T10:00:00.000Z',
      checkedBy: 'uid_seed',
    });
  });
}

describe('professional_registry_checks.rules — η απάντηση του μητρώου γράφεται μόνο από τον διακομιστή', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }

  describe('🔴 ούτε το ΙΔΙΟ το γραφείο', () => {
    it('το γραφείο ΔΕΝ γράφει «επαληθευμένο στο μητρώο» μόνο του', async () => {
      const owner = getContext(env(), 'same_tenant_admin');

      await assertFails(
        owner
          .firestore()
          .collection(COLLECTION)
          .doc(CHECK_ID)
          .set({ companyId: SAME_TENANT_COMPANY_ID, licence: 'energy-inspector', grades: { buildings: 'B' } }),
      );
    });

    it('το γραφείο ΔΕΝ διαβάζει το ωμό αντίγραφο — μόνο την κρίση, από τον διακομιστή', async () => {
      await seedRegistryCheck(env());
      const owner = getContext(env(), 'same_tenant_admin');

      await assertFails(owner.firestore().collection(COLLECTION).doc(CHECK_ID).get());
    });

    it('ούτε ανώνυμος', async () => {
      await seedRegistryCheck(env());
      const anonymous = getContext(env(), 'anonymous');

      await assertFails(anonymous.firestore().collection(COLLECTION).doc(CHECK_ID).get());
    });
  });
});

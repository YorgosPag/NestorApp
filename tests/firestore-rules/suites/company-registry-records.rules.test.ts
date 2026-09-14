/**
 * Firestore Rules — συλλογή `company_registry_records` (ADR-841 §7 Α23)
 *
 * Σχήμα κανόνα: `read: if false` · `write: if false` — **και οι δύο πλευρές** ανήκουν
 * αποκλειστικά στον διακομιστή.
 *
 * 🔴 **ΤΟ ΚΕΛΙ ΠΟΥ ΕΧΕΙ ΣΗΜΑΣΙΑ ΕΙΝΑΙ Η ΓΡΑΦΗ ΤΟΥ ΙΔΙΟΚΤΗΤΗ**: το έγγραφο είναι η απάντηση της
 * **αρχής**. Αν ο company admin μπορούσε να το γράψει, η βιτρίνα θα έγραφε «επωνυμία επαληθευμένη
 * από ΓΕΜΗ» χωρίς να ρωτηθεί ποτέ το ΓΕΜΗ — ακριβώς γι' αυτό η απάντηση ΔΕΝ ζει στο
 * `accounting_settings`, που το γράφει ο ίδιος.
 *
 * ⚠️ **Και η ανάγνωση κλειστή**: κρατά την έδρα από το μητρώο (σε ατομική, συχνά η κατοικία)·
 * δημόσια φεύγει μόνο ό,τι επέλεξε ο επαγγελματίας (GDPR άρθ. 25(2)).
 *
 * 🔑 Ο σπόρος ζει **εδώ** και όχι στο κοινό `seed-helpers-mandate.ts`: είναι ο μόνος καταναλωτής.
 *
 * @since 2026-09-14 (ADR-841 §7 Α23)
 */

import { assertFails } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';
import { getContext, withSeedContext } from '../_harness/auth-contexts';

const COLLECTION = 'company_registry_records';

// ⚠️ Κυριολεκτικό, όχι `COLLECTION`: η πύλη CHECK 3.16 (Validation C) διαβάζει το όνομα από το AST.
export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'company_registry_records',
)!;

/** Το έγγραφο **του ίδιου** μισθωτή — χωρίς αυτό, η μετάλλαξη «ο ιδιοκτήτης βλέπει το δικό του» δεν κοκκινίζει. */
async function seedRegistryRecord(env: RulesTestEnvironment): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection(COLLECTION).doc(SAME_TENANT_COMPANY_ID).set({
      companyId: SAME_TENANT_COMPANY_ID,
      checkedAt: '2026-09-14T10:00:00.000Z',
      record: {
        source: 'gemi-opendata',
        registrationNumber: '123456789000',
        legalName: 'ΔΟΚΙΜΑΣΤΙΚΗ ΑΝΩΝΥΜΗ ΕΤΑΙΡΕΙΑ',
        legalNamesLatin: [],
        distinctiveTitles: [],
        distinctiveTitlesLatin: [],
        legalForm: null,
        status: { code: null, activity: 'unknown' },
        seat: { street: null, streetNumber: null, postalCode: null, city: null, municipality: null },
        isBranch: false,
        selfRegistered: true,
      },
    });
  });
}

describe('company_registry_records.rules — η απάντηση της αρχής γράφεται μόνο από τον διακομιστή', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }

  describe('🔴 ούτε ο ΙΔΙΟΣ ο οργανισμός', () => {
    it('ο ιδιοκτήτης ΔΕΝ γράφει «επαληθευμένο» μόνος του', async () => {
      const owner = getContext(env(), 'same_tenant_admin');

      await assertFails(
        owner
          .firestore()
          .collection(COLLECTION)
          .doc(SAME_TENANT_COMPANY_ID)
          .set({ companyId: SAME_TENANT_COMPANY_ID, record: { source: 'gemi-opendata' } }),
      );
    });

    it('ο ιδιοκτήτης ΔΕΝ διαβάζει το αντίγραφο απευθείας', async () => {
      await seedRegistryRecord(env());
      const owner = getContext(env(), 'same_tenant_admin');

      await assertFails(owner.firestore().collection(COLLECTION).doc(SAME_TENANT_COMPANY_ID).get());
    });

    it('🔑 ούτε ανώνυμος — η έδρα μιας ατομικής είναι συχνά η κατοικία', async () => {
      await seedRegistryRecord(env());
      const anonymous = getContext(env(), 'unauthenticated');

      await assertFails(anonymous.firestore().collection(COLLECTION).doc(SAME_TENANT_COMPANY_ID).get());
    });
  });
});

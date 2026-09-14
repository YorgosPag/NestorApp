/**
 * Firestore Rules — συλλογή `showcase_card_channels` (ADR-841 §7 Α21.16)
 *
 * Σχήμα κανόνα: `read: if false` · `write: if false` — **και οι δύο πλευρές** ανήκουν
 * αποκλειστικά στον διακομιστή.
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ Η ΣΥΛΛΟΓΗ**: τα κανάλια (τηλέφωνα · email) επιτρέπονται πλέον στη
 * βιτρίνα, αλλά το `agency_profiles` είναι `read: if true` και ο κατάλογος το κατεβάζει
 * **ολόκληρο** σε κάθε ανώνυμο. Ένα `read` εδώ = **όλα τα τηλέφωνα όλων** με μία κλήση SDK.
 *
 * 🔴 **ΤΟ ΚΕΛΙ ΠΟΥ ΕΧΕΙ ΣΗΜΑΣΙΑ ΕΙΝΑΙ ΤΟΥ ΙΔΙΟΚΤΗΤΗ**: ο `denyAllMatrix` αρνείται σε όλους,
 * οπότε χωρίς έγγραφο **του ίδιου** η μετάλλαξη `allow read: if companyId == getUserCompanyId()`
 * — *«μα είναι τα ΔΙΚΑ του τηλέφωνα»* — δεν θα κοκκίνιζε. Ο ιδιοκτήτης τα παίρνει από το
 * `GET /api/agency-profile/card`, ποτέ απευθείας.
 *
 * @since 2026-09-14 (ADR-841 §7 Α21.16)
 */

import { assertFails } from '@firebase/rules-unit-testing';

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';
import { getContext } from '../_harness/auth-contexts';
import { seedShowcaseCardChannels } from '../_harness/seed-helpers-mandate';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'showcase_card_channels',
)!;

describe('showcase_card_channels.rules — τα κανάλια φεύγουν μόνο από τον διακομιστή', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }

  describe('🔴 ούτε ο ΙΔΙΟΣ ο επαγγελματίας', () => {
    it('ο ιδιοκτήτης ΔΕΝ διαβάζει τα κανάλια του απευθείας', async () => {
      await seedShowcaseCardChannels(env(), SAME_TENANT_COMPANY_ID);

      const owner = getContext(env(), 'same_tenant_admin');

      await assertFails(
        owner.firestore().collection('showcase_card_channels').doc(SAME_TENANT_COMPANY_ID).get(),
      );
    });

    it('🔑 ούτε ανώνυμος — η απουσία ορίου ρυθμού θα ήταν η συγκομιδή', async () => {
      await seedShowcaseCardChannels(env(), SAME_TENANT_COMPANY_ID);

      const anonymous = getContext(env(), 'unauthenticated');

      await assertFails(
        anonymous.firestore().collection('showcase_card_channels').doc(SAME_TENANT_COMPANY_ID).get(),
      );
    });

    it('🔴 ούτε ΓΡΑΦΕΙ — αλλιώς τα `channelKinds` του δημόσιου εγγράφου διαφωνούν με την αλήθεια', async () => {
      const owner = getContext(env(), 'same_tenant_admin');

      await assertFails(
        owner
          .firestore()
          .collection('showcase_card_channels')
          .doc(SAME_TENANT_COMPANY_ID)
          .set({ locations: { sloc_x: { phones: [{ e164: '+300000000000', extension: null }], emails: [] } } }),
      );
    });
  });
});

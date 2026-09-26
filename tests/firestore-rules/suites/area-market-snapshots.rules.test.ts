/**
 * Firestore Rules — συλλογή `area_market_snapshots` (ADR-890 §5.2)
 *
 * Σχήμα κανόνα: `read: if false` · `write: if false`.
 *
 * 🔴 **Ο ΠΕΙΡΑΣΜΟΣ ΕΙΝΑΙ «ΔΗΜΟΣΙΑ ΔΕΔΟΜΕΝΑ ⇒ `read: if true`»**. Η σελίδα περιοχής είναι δημόσια, αλλά
 * αποδίδεται στον **διακομιστή** (SEO, ADR-890 §5.5), άρα κανένας πελάτης δεν χρειάζεται τη συλλογή. Και
 * **γραφή** πελάτη θα ήταν πλαστογράφηση της «διάμεσης τιμής της περιοχής» — ακριβώς ο αριθμός που
 * διαβάζει ένας αγοραστής πριν κάνει προσφορά.
 *
 * @since 2026-09-26 (ADR-890 Φ1)
 */

import { assertFails } from '@firebase/rules-unit-testing';

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';
import { getContext } from '../_harness/auth-contexts';
import { seedAreaMarketSnapshot } from '../_harness/seed-helpers-area-market';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'area_market_snapshots')!;

describe('area_market_snapshots.rules — τη σύνοψη περιοχής τη γράφει μόνο το cron', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }

  describe('🔴 ούτε μεσίτης της περιοχής', () => {
    it('ΔΕΝ «διορθώνει» τη διάμεσο της περιοχής του', async () => {
      const id = await seedAreaMarketSnapshot(env());
      const agent = getContext(env(), 'external_user');
      await assertFails(agent.firestore().collection('area_market_snapshots').doc(id).update({ listingCount: 999 }));
    });
  });
});

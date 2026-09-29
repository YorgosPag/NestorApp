/**
 * Firestore Rules — συλλογή `area_market_maps` (ADR-890 §14.4)
 *
 * Σχήμα κανόνα: `read: if false` · `write: if false`.
 *
 * 🔴 Ο χάρτης τιμών βάφει **ολόκληρη** την Ελλάδα από ένα έγγραφο ανά νύχτα. Μια εγγραφή πελάτη εκεί θα έβαφε μια
 * γειτονιά ακριβότερη για κάθε επισκέπτη της αναζήτησης. Και ανάγνωση δεν χρειάζεται κανείς: το σερβίρει το δημόσιο
 * endpoint (διακομιστής + CDN).
 *
 * @since 2026-09-28 (ADR-890 Φ3 Δ)
 */

import { assertFails } from '@firebase/rules-unit-testing';

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';
import { getContext } from '../_harness/auth-contexts';
import { seedAreaMarketMap } from '../_harness/seed-helpers-area-market';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'area_market_maps')!;

describe('area_market_maps.rules — τον χάρτη τιμών τον γράφει μόνο το cron', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }

  it('🔴 κανείς δεν βάφει τη γειτονιά του ακριβότερη', async () => {
    const id = await seedAreaMarketMap(env());
    const agent = getContext(env(), 'external_user');
    await assertFails(
      agent.firestore().collection('area_market_maps').doc(id).update({ 'offers.sale.municipality:0701.apartment': [99, 9999] }),
    );
  });
});

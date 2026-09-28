/**
 * Firestore Rules — συλλογή `area_market_series` (ADR-890 §13)
 *
 * Σχήμα κανόνα: `read: if false` · `write: if false`.
 *
 * 🔴 Η σειρά κρατά το **βιβλίο** του μήνα (`αγγελία → ζητούμενη €/τ.μ.`). Μια εγγραφή πελάτη εκεί θα «σήκωνε» τη
 * μηνιαία διάμεσο και την τάση της περιοχής — ακριβώς τα νούμερα που διαβάζει ένας αγοραστής πριν κάνει προσφορά.
 * Και ανάγνωση δεν χρειάζεται κανείς: η σελίδα αποδίδεται στον διακομιστή.
 *
 * @since 2026-09-28 (ADR-890 Φ3)
 */

import { assertFails } from '@firebase/rules-unit-testing';

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';
import { getContext } from '../_harness/auth-contexts';
import { seedAreaMarketSeries } from '../_harness/seed-helpers-area-market';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'area_market_series')!;

describe('area_market_series.rules — τη μηνιαία σειρά τη γράφει μόνο το cron', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }

  it('🔴 κανείς δεν φουσκώνει το βιβλίο του μήνα', async () => {
    const id = await seedAreaMarketSeries(env());
    const agent = getContext(env(), 'external_user');
    await assertFails(
      agent.firestore().collection('area_market_series').doc(id).update({ 'book.offers.sale.prop_x': { segment: 'apartment', unitPrice: 99999 } }),
    );
  });
});

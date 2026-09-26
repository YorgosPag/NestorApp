/**
 * Firestore Rules — συλλογή `area_market_runs` (ADR-890 §5.2)
 *
 * Σχήμα κανόνα: `read: if false` · `write: if false`.
 *
 * 🔴 Το σημάδι ολοκλήρωσης λέει στη σελίδα **ποια ημέρα** να διαβάσει. Ένα πλαστό σημάδι από πελάτη θα
 * έστελνε κάθε σελίδα περιοχής σε ημέρα που δεν υπολογίστηκε ποτέ ⇒ «καμία αγγελία» παντού.
 *
 * @since 2026-09-26 (ADR-890 Φ1)
 */

import { assertFails } from '@firebase/rules-unit-testing';

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';
import { getContext } from '../_harness/auth-contexts';
import { seedAreaMarketRun } from '../_harness/seed-helpers-area-market';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'area_market_runs')!;

describe('area_market_runs.rules — το σημάδι εκτέλεσης το γράφει μόνο το cron', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }

  it('🔴 κανείς δεν πλαστογραφεί σημάδι ημέρας', async () => {
    await seedAreaMarketRun(env());
    const anyone = getContext(env(), 'external_user');
    await assertFails(anyone.firestore().collection('area_market_runs').doc('amkr_forged').set({ day: '2099-01-01' }));
  });
});

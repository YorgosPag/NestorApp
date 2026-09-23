/**
 * Firestore Rules — συλλογή `listing_view_salts` (ADR-777 §8.72)
 *
 * Σχήμα κανόνα: `read: if false` · `write: if false`.
 *
 * 🔴 **ΤΟ ΑΛΑΤΙ ΕΙΝΑΙ ΟΛΗ Η ΑΝΩΝΥΜΙΑ**: το σημάδι επισκέπτη είναι `sha256(αλάτι ‖ … ‖ IP ‖ UA)`. Όποιος
 * διαβάζει το αλάτι της ημέρας ξαναϋπολογίζει το hash για κάθε IP και λέει «αυτή η διεύθυνση είδε
 * αυτό το σπίτι» — δηλαδή το σημάδι γίνεται ξανά προσωπικό δεδομένο. Κανείς δεν το διαβάζει, **ούτε
 * ο διαχειριστής της πλατφόρμας** μέσω πελάτη.
 *
 * @since 2026-09-23 (ADR-777 §8.72)
 */

import { assertFails } from '@firebase/rules-unit-testing';

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';
import { getContext } from '../_harness/auth-contexts';
import { seedListingViewSalt } from '../_harness/seed-helpers-listing-stats';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'listing_view_salts')!;

describe('listing_view_salts.rules — το αλάτι δεν το βλέπει κανείς', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }

  it('🔴 ούτε ο super admin διαβάζει το αλάτι της ημέρας', async () => {
    const id = await seedListingViewSalt(env());
    const superAdmin = getContext(env(), 'super_admin');
    await assertFails(superAdmin.firestore().collection('listing_view_salts').doc(id).get());
  });
});

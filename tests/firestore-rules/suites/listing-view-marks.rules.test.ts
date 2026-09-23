/**
 * Firestore Rules — συλλογή `listing_view_marks` (ADR-777 §8.72)
 *
 * Σχήμα κανόνα: `read: if false` · `write: if false`.
 *
 * 🔴 **Το κελί που έχει σημασία είναι η ΔΙΑΓΡΑΦΗ**: το σημάδι είναι ο λόγος που ο ίδιος άνθρωπος
 * μετράει **μία** φορά την ημέρα. Όποιος το σβήνει, ξαναμετριέται — φούσκωμα με ανανέωση σελίδας.
 *
 * @since 2026-09-23 (ADR-777 §8.72)
 */

import { assertFails } from '@firebase/rules-unit-testing';

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';
import { getContext } from '../_harness/auth-contexts';
import { seedListingViewMark } from '../_harness/seed-helpers-listing-stats';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'listing_view_marks')!;

describe('listing_view_marks.rules — ο αποδυπλασιασμός δεν παρακάμπτεται από πελάτη', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }

  it('🔴 ο κάτοχος ΔΕΝ σβήνει σημάδι για να ξαναμετρηθεί', async () => {
    const id = await seedListingViewMark(env());
    const owner = getContext(env(), 'external_user');
    await assertFails(owner.firestore().collection('listing_view_marks').doc(id).delete());
  });
});

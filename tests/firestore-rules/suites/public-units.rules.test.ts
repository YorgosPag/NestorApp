/**
 * Firestore Rules — συλλογή `public_units` (ADR-900 §8 #2, 2β.4 · SPEC-777A §14.4)
 *
 * Σχήμα κανόνα (firestore.rules):
 *   - read:  `if true`   ← η μονάδα του κόσμου (UPRN-παιδί του κτιρίου), ορατή ΚΑΙ σε ανώνυμο
 *   - write: `if false`  ← γράφει ΜΟΝΟ ο κριτής κατοχής, μέσα στη συναλλαγή του (Admin SDK)
 *
 * 🔑 Η δημόσια ανάγνωση είναι ακίνδυνη **επειδή** το έγγραφο δεν έχει τίποτα ιδιωτικό: κανέναν κάτοχο,
 * ΚΑΕΚ ή πόρτα — και το id `punit_*` είναι HMAC, όχι αντιστρέψιμο σε ΚΑΕΚ. Το seed είναι το συμβόλαιο
 * (`seedPublicUnit`).
 *
 * @since 2026-10-03 (ADR-900 §8 #2, 2β.4)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { useDenyAllEmulator } from '../_harness/deny-all-suite';
import { definePublicWorldCell, type PublicWorldFixture } from '../_harness/public-world-suite';
import { seedPublicBuilding, seedPublicLand, seedPublicUnit } from '../_harness/seed-helpers';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'public_units')!;

const LAND_ID = 'land-public-1';
const BUILDING_ID = 'pbld-public-1';

const FIXTURE: PublicWorldFixture = {
  collection: 'public_units',
  docId: 'punit-public-1',
  // Η μονάδα κρέμεται από κτίριο, το κτίριο από γη (Α1) — ρεαλιστική αλυσίδα, όχι ορφανό έγγραφο.
  seed: async (env) => {
    await seedPublicLand(env, LAND_ID);
    await seedPublicBuilding(env, BUILDING_ID, LAND_ID);
    await seedPublicUnit(env, 'punit-public-1', LAND_ID, BUILDING_ID);
  },
  data: { status: 'historical' },
  createData: {
    landId: LAND_ID,
    buildingId: BUILDING_ID,
    level: null,
    existence: { source: 'cadastre', firstAttestedAt: '2026-10-03T00:00:00.000Z', lastAttestedAt: '2026-10-03T00:00:00.000Z' },
    status: 'approved',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

describe('public_units.rules — public_world (ADR-900 §8 #2, επίπεδο Α)', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    definePublicWorldCell(env, cell, FIXTURE);
  }
});

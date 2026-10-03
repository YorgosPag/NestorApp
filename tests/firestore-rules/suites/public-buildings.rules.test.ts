/**
 * Firestore Rules — συλλογή `public_buildings` (ADR-777 Α11, SPEC-777A §14.4)
 *
 * Σχήμα κανόνα (firestore.rules):
 *   - read:  `if true`   ← «το κτίριο του κόσμου», ορατό ΚΑΙ σε ανώνυμο
 *   - write: `if false`  ← γράφει ΜΟΝΟ ο διακομιστής
 *
 * 🔑 **Η ΔΙΑΦΟΡΑ ΑΠΟ ΤΗ ΣΥΛΛΟΓΗ `buildings` ΕΙΝΑΙ ΟΛΟΚΛΗΡΗ Η Α11.** Η `buildings`
 * είναι tenant-scoped: κτίριο **μέσα σε έργο ενός πελάτη** (επίπεδο Β). Αυτή εδώ
 * είναι το **φυσικό γεγονός** — το ίδιο κτίριο που βλέπουν όλοι, ακόμη κι αν κανείς
 * δεν το πουλά. Οι δύο συλλογές έχουν **αντίθετα** πρότυπα κανόνων, και αυτό είναι
 * σχεδίαση: αν κάποιος τις ενοποιήσει «για απλότητα», είτε θα διαρρεύσει εμπορικό
 * δεδομένο στον κόσμο, είτε θα κάνει το κοινό κτίριο αόρατο σε άλλον πελάτη.
 *
 * ⚠️ Ίδιες τρεις άγκυρες με το `public-lands.rules.test.ts` — δες εκεί το πλήρες
 * σκεπτικό. Οι δύο σουίτες είναι **ξεχωριστές επίτηδες**: το μητρώο δηλώνει κάλυψη
 * **ανά συλλογή**, και μια κοινή σουίτα θα σήμαινε ότι η διαγραφή ενός κανόνα αφήνει
 * την άλλη συλλογή να δείχνει πράσινη.
 *
 * @since 2026-08-09 (ADR-777 Β1)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { useDenyAllEmulator } from '../_harness/deny-all-suite';
import { definePublicWorldCell, type PublicWorldFixture } from '../_harness/public-world-suite';
import { seedPublicLand, seedPublicBuilding } from '../_harness/seed-helpers';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'public_buildings')!;

const LAND_ID = 'land-public-1';

const FIXTURE: PublicWorldFixture = {
  collection: 'public_buildings',
  docId: 'pbld-public-1',
  // Η γη σπέρνεται πρώτη: το κτίριο ΚΛΗΡΟΝΟΜΕΙ τη θέση από εκεί (Α1), οπότε
  // ένα κτίριο με `landId` που δεν δείχνει πουθενά δεν είναι ρεαλιστικό seed.
  seed: async (env) => {
    await seedPublicLand(env, LAND_ID);
    await seedPublicBuilding(env, 'pbld-public-1', LAND_ID);
  },
  data: { useCode: null },
  createData: {
    landId: LAND_ID,
    footprint: { kind: 'unknown' },
    floorsAboveGround: null,
    constructionYear: null,
    useCode: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

describe('public_buildings.rules — public_world (ADR-777 επίπεδο Α)', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    definePublicWorldCell(env, cell, FIXTURE);
  }
});

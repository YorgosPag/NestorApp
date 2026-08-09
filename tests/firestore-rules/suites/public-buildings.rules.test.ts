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

import {
  initEmulator,
  teardownEmulator,
  resetData,
} from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { seedPublicLand, seedPublicBuilding } from '../_harness/seed-helpers';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'public_buildings',
)!;

describe('public_buildings.rules — public_world (ADR-777 επίπεδο Α)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => {
    env = await initEmulator();
  });

  afterAll(async () => {
    await teardownEmulator(env);
  });

  afterEach(async () => {
    await resetData(env);
  });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        const landId = 'land-public-1';
        const docId = 'pbld-public-1';

        // Η γη σπέρνεται πρώτη: το κτίριο ΚΛΗΡΟΝΟΜΕΙ τη θέση από εκεί (Α1), οπότε
        // ένα κτίριο με `landId` που δεν δείχνει πουθενά δεν είναι ρεαλιστικό seed.
        await seedPublicLand(env, landId);
        await seedPublicBuilding(env, docId, landId);

        const ctx = getContext(env, cell.persona);

        const target: AssertTarget = {
          collection: 'public_buildings',
          docId,
          data: { useCode: null },
          createData: {
            landId,
            footprint: { kind: 'unknown' },
            floorsAboveGround: null,
            constructionYear: null,
            useCode: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          // ⚠️ ΚΑΝΕΝΑ listFilter — βλ. public-lands.rules.test.ts.
        };

        await assertCell(ctx, cell, target);
      });
    });
  }
});

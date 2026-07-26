/**
 * ADR-712 — cross-level έδραση κολώνας→πεδίλου για την επιμέτρηση.
 *
 * Δύο επίπεδα ελέγχου:
 *   · **pure** (`buildColumnBaseDropMapFrom`) — η αλυσίδα organism-scene → graph →
 *     continuity παράγει σωστό `baseDropMm` σε absolute Z.
 *   · **store adapter** (`buildColumnBaseDropMap`) — το §7.1 guard: χωρίς
 *     `activeLevelBearsOnFoundation` ΚΑΜΙΑ χρέωση, όσο κι αν «στηρίζει» το πέδιλο
 *     γεωμετρικά. Αυτό είναι το ακριβό λάθος που αποτρέπεται: μια κολώνα 1ου ορόφου
 *     πάνω από πέδιλο θα χρεωνόταν κοντόστυλο 4m.
 *
 * Reuse των fixtures του ADR-489 (`minimal-bim-entities`) — ίδιο πέδιλο/κολώνα με το
 * `BimSceneLayer-column-continuity.test.ts`, ώστε επιμέτρηση και render να ελέγχονται
 * πάνω στην ίδια γεωμετρία.
 */

import {
  buildColumnBaseDropMap,
  buildColumnBaseDropMapFrom,
} from '../column-continuity-boq-source';
import { useFoundationLevelStore } from '../../../state/foundation-level-store';
import { bearingColumn, padFooting } from '../../../bim-3d/scene/__tests__/minimal-bim-entities';
import type { Entity } from '../../../types/entities';
import type { FoundationLevelTarget } from '../../../systems/levels/building-foundation-level';

/** Ισόγειο (FFL 0) με μία κολώνα· Θεμελίωση (FFL −1000) με πέδιλο άνω παρειάς −1000. */
const GROUND_COLUMN = bearingColumn('c1') as unknown as Entity;
const FOUNDATION_PAD = padFooting('f1', -1000) as unknown as Entity;

const TARGET: FoundationLevelTarget = {
  levelId: 'L-foundation', floorId: 'F-foundation', sceneFileId: null, floorElevationMm: -1000,
};

beforeEach(() => useFoundationLevelStore.getState().clear());

describe('buildColumnBaseDropMapFrom — pure cross-level αλυσίδα', () => {
  it('κολώνα Ισογείου πάνω από πέδιλο −1000 → drop 1000mm', () => {
    const drops = buildColumnBaseDropMapFrom({
      activeEntities: [GROUND_COLUMN],
      activeFloorElevationMm: 0,
      foundationEntities: [FOUNDATION_PAD],
      foundationFloorElevationMm: -1000,
    });
    expect(drops.get('c1')).toBe(1000);
  });

  it('χωρίς πέδιλα → κενός χάρτης (κάθε κολώνα κρατά τη nominal βάση)', () => {
    const drops = buildColumnBaseDropMapFrom({
      activeEntities: [GROUND_COLUMN],
      activeFloorElevationMm: 0,
      foundationEntities: [],
      foundationFloorElevationMm: -1000,
    });
    expect(drops.size).toBe(0);
  });

  it('πέδιλο στο ΙΔΙΟ επίπεδο με τη βάση → κανένα drop (μόνο προς τα κάτω)', () => {
    const drops = buildColumnBaseDropMapFrom({
      activeEntities: [GROUND_COLUMN],
      activeFloorElevationMm: 0,
      foundationEntities: [padFooting('f1', 0) as unknown as Entity],
      foundationFloorElevationMm: 0,
    });
    expect(drops.size).toBe(0);
  });
});

describe('buildColumnBaseDropMap — §7.1 guard (store adapter)', () => {
  it('χωρίς όροφο Θεμελίωσης (single-level) → κενός χάρτης', () => {
    useFoundationLevelStore.getState().setActiveLevelBearsOnFoundation(true);
    expect(buildColumnBaseDropMap([GROUND_COLUMN]).size).toBe(0);
  });

  it('ο ενεργός όροφος ΕΔΡΑΖΕΤΑΙ στα πέδιλα → drop 1000mm', () => {
    const s = useFoundationLevelStore.getState();
    s.setFoundationLevel(TARGET, [FOUNDATION_PAD], 0);
    s.setActiveLevelBearsOnFoundation(true);
    expect(buildColumnBaseDropMap([GROUND_COLUMN]).get('c1')).toBe(1000);
  });

  it('ΤΟ ΑΚΡΙΒΟ ΛΑΘΟΣ: υπερκείμενος όροφος (FFL 3000) ΔΕΝ χρεώνεται κοντόστυλο 4m', () => {
    const s = useFoundationLevelStore.getState();
    // Ο ενεργός είναι ο 1ος όροφος → ο owner δηλώνει ότι ΔΕΝ πατά στα πέδιλα.
    s.setFoundationLevel(TARGET, [FOUNDATION_PAD], 3000);
    s.setActiveLevelBearsOnFoundation(false);
    const drops = buildColumnBaseDropMap([bearingColumn('c2') as unknown as Entity]);
    expect(drops.size).toBe(0);

    // Χωρίς το guard ο ίδιος graph ΘΑ έδινε 4000mm — αυτό ακριβώς αποτρέπεται.
    const unguarded = buildColumnBaseDropMapFrom({
      activeEntities: [bearingColumn('c2') as unknown as Entity],
      activeFloorElevationMm: 3000,
      foundationEntities: [FOUNDATION_PAD],
      foundationFloorElevationMm: -1000,
    });
    expect(unguarded.get('c2')).toBe(4000);
  });

  it('fail-closed: flag ποτέ δεν τέθηκε (default) → καμία χρέωση', () => {
    useFoundationLevelStore.getState().setFoundationLevel(TARGET, [FOUNDATION_PAD], 0);
    expect(buildColumnBaseDropMap([GROUND_COLUMN]).size).toBe(0);
  });
});

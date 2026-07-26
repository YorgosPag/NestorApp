/**
 * ADR-459 Phase 0 — building-foundation-level SSoT resolver.
 */

import {
  activeLevelBearsOnFoundation,
  resolveBuildingFoundationLevel,
  resolveBuildingIdForLevel,
  resolveFloorElevationMm,
  type FoundationLevelRef,
} from '../building-foundation-level';
import type { StoreyFloorRef } from '../active-storey-context';

const levels: FoundationLevelRef[] = [
  { id: 'lvl-ground', floorId: 'flr-ground', buildingId: 'bld-1', sceneFileId: 'scene-ground' },
  { id: 'lvl-found', floorId: 'flr-found', buildingId: 'bld-1', sceneFileId: 'scene-found' },
  { id: 'lvl-other-bld', floorId: 'flr-x', buildingId: 'bld-2', sceneFileId: 'scene-x' },
];

const floors: StoreyFloorRef[] = [
  { id: 'flr-found', number: -1, elevation: -1, kind: 'foundation' },
  { id: 'flr-ground', number: 0, elevation: 0, kind: 'ground' },
  { id: 'flr-1', number: 1, elevation: 3, kind: 'standard' },
];

describe('resolveBuildingIdForLevel', () => {
  it('returns the building of the active level', () => {
    expect(resolveBuildingIdForLevel(levels, 'lvl-ground')).toBe('bld-1');
  });
  it('returns null for unknown / null level', () => {
    expect(resolveBuildingIdForLevel(levels, 'nope')).toBeNull();
    expect(resolveBuildingIdForLevel(levels, null)).toBeNull();
  });
});

describe('resolveFloorElevationMm', () => {
  it('derives datum-relative FFL in mm (ground = 0 when datum is ground)', () => {
    // datum = ground (0m) → ground FFL = 0mm.
    expect(resolveFloorElevationMm(floors, 'flr-ground')).toBe(0);
  });
  it('foundation sits below the ground datum', () => {
    // foundation at −1m relative to ground datum → −1000mm.
    expect(resolveFloorElevationMm(floors, 'flr-found')).toBe(-1000);
  });
  it('returns 0 for null floor (degenerate → single-level)', () => {
    expect(resolveFloorElevationMm(floors, null)).toBe(0);
  });
});

describe('resolveBuildingFoundationLevel', () => {
  it('finds the foundation level + datum-relative FFL for the active building', () => {
    const t = resolveBuildingFoundationLevel(levels, 'lvl-ground', floors);
    expect(t).toEqual({
      levelId: 'lvl-found',
      floorId: 'flr-found',
      sceneFileId: 'scene-found',
      floorElevationMm: -1000,
    });
  });

  it('returns null when no foundation floor exists', () => {
    const noFoundation = floors.filter((f) => f.kind !== 'foundation');
    expect(resolveBuildingFoundationLevel(levels, 'lvl-ground', noFoundation)).toBeNull();
  });

  it('returns null when the active level has no building', () => {
    const orphan: FoundationLevelRef[] = [{ id: 'lvl-x', floorId: 'flr-ground' }];
    expect(resolveBuildingFoundationLevel(orphan, 'lvl-x', floors)).toBeNull();
  });

  it('returns null when the foundation floor has no linked DXF level', () => {
    const noFoundationLevel = levels.filter((l) => l.id !== 'lvl-found');
    expect(resolveBuildingFoundationLevel(noFoundationLevel, 'lvl-ground', floors)).toBeNull();
  });
});

/**
 * ADR-712 — το κριτήριο ADR-489 §7.1 σε επίπεδο ΟΡΟΦΩΝ. Οι επιμετρητικοί καταναλωτές
 * βλέπουν έναν όροφο τη φορά, οπότε δεν μπορούν να αποκλείσουν μια υπερκείμενη κολώνα
 * βλέποντας τη στοίβα (όπως ο 3Δ). Το ισοδύναμο ερώτημα: παρεμβάλλεται όροφος;
 */
describe('activeLevelBearsOnFoundation (ADR-712)', () => {
  // floors: Θεμελίωση −1000 · Ισόγειο 0 · 1ος 3000 (mm, datum = ground).
  it('Ισόγειο (ο αμέσως επόμενος πάνω από τη Θεμελίωση) → true', () => {
    expect(activeLevelBearsOnFoundation(floors, -1000, 0)).toBe(true);
  });

  it('1ος όροφος → false: παρεμβάλλεται το Ισόγειο, άρα και η κολώνα του', () => {
    expect(activeLevelBearsOnFoundation(floors, -1000, 3000)).toBe(false);
  });

  it('ενεργός = ο ίδιος ο όροφος Θεμελίωσης → false (καμία προέκταση προς τα κάτω)', () => {
    expect(activeLevelBearsOnFoundation(floors, -1000, -1000)).toBe(false);
  });

  it('fail-closed: άγνωστη λίστα ορόφων → false (καμία χρέωση κοντόστυλου)', () => {
    expect(activeLevelBearsOnFoundation([], -1000, 0)).toBe(false);
  });

  it('ημιώροφος ανάμεσα σε Θεμελίωση και ενεργό → false', () => {
    const withMezzanine: StoreyFloorRef[] = [
      ...floors,
      { id: 'flr-mezz', number: 0.5, elevation: -0.5, kind: 'standard' },
    ];
    expect(activeLevelBearsOnFoundation(withMezzanine, -1000, 0)).toBe(false);
  });
});

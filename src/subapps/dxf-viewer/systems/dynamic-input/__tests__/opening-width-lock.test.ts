/**
 * ADR-513 §opening-width — tests για το `resolveOpeningWidthLockedDelta` (dynamic-input πλάτος
 * κουφώματος). Επιβεβαιώνει: φορά/μέγεθος κατά τον **άξονα ΤΟΙΧΟΥ** (μέσω `projectPointToWallOffsetMm`,
 * mocked), τη διόρθωση **αντιπαράλληλου** τοίχου (opening rotation ≠ wall start→end), signed τιμή, και τα
 * no-op gates (no lock / όχι λαβή παρειάς / χωρίς host τοίχο). Χρησιμοποιεί το ΠΡΑΓΜΑΤΙΚΟ
 * `DynamicInputLockStore`· mock ΜΟΝΟ την προβολή τοίχου (καθαρή γεωμετρία, καμία εξάρτηση WallEntity).
 */

jest.mock('../../../bim/geometry/opening-geometry', () => ({
  projectPointToWallOffsetMm: jest.fn(),
}));

import {
  resolveOpeningWidthLockedDelta,
  isOpeningCornerGripKind,
} from '../opening-width-lock';
import { DynamicInputLockStore } from '../DynamicInputLockStore';
import { projectPointToWallOffsetMm } from '../../../bim/geometry/opening-geometry';
import type { OpeningGripKind } from '../../../hooks/grip-kinds';
import type { WallEntity } from '../../../bim/types/wall-types';

const mockProject = projectPointToWallOffsetMm as jest.MockedFunction<typeof projectPointToWallOffsetMm>;
const WALL = {} as WallEntity; // dummy — η προβολή είναι mocked

/** Τοίχος με +axial = +x (κανονικός). */
const forwardWall = () => mockProject.mockImplementation((p) => p.x);
/** Τοίχος με +axial = −x (start→end αντίθετο του opening rotation). */
const reversedWall = () => mockProject.mockImplementation((p) => -p.x);

const END_GRIP = { x: 5, y: 0 };

describe('ADR-513 §opening-width — resolveOpeningWidthLockedDelta', () => {
  afterEach(() => {
    DynamicInputLockStore.unlock();
    mockProject.mockReset();
  });

  it('επιστρέφει null όταν ΔΕΝ υπάρχει ενεργό lock', () => {
    forwardWall();
    expect(resolveOpeningWidthLockedDelta(WALL, 'opening-corner-ne', END_GRIP, { x: 9, y: 0 })).toBeNull();
  });

  it('επιστρέφει null για μη-λαβή-παρειάς (move/rotation/facing)', () => {
    forwardWall();
    DynamicInputLockStore.lockLength(100);
    for (const kind of ['opening-move', 'opening-rotation', 'opening-facing'] as OpeningGripKind[]) {
      expect(resolveOpeningWidthLockedDelta(WALL, kind, END_GRIP, { x: 9, y: 0 })).toBeNull();
    }
  });

  it('επιστρέφει null χωρίς host τοίχο', () => {
    DynamicInputLockStore.lockLength(100);
    expect(resolveOpeningWidthLockedDelta(null, 'opening-corner-ne', END_GRIP, { x: 9, y: 0 })).toBeNull();
    expect(resolveOpeningWidthLockedDelta(undefined, 'opening-corner-ne', END_GRIP, { x: 9, y: 0 })).toBeNull();
  });

  it('κανονικός τοίχος (+axial=+x): κέρσορας έξω → delta +100 κατά +x (μεγαλώνει)', () => {
    forwardWall();
    DynamicInputLockStore.lockLength(100);
    const delta = resolveOpeningWidthLockedDelta(WALL, 'opening-corner-se', END_GRIP, { x: 20, y: 0 });
    expect(delta).not.toBeNull();
    expect(delta!.x).toBeCloseTo(100);
    expect(delta!.y).toBeCloseTo(0);
  });

  it('κανονικός τοίχος: κέρσορας μέσα → delta −100 (μικραίνει)', () => {
    forwardWall();
    DynamicInputLockStore.lockLength(100);
    const delta = resolveOpeningWidthLockedDelta(WALL, 'opening-corner-se', END_GRIP, { x: 1, y: 0 });
    expect(delta!.x).toBeCloseTo(-100);
  });

  it('ΑΝΤΙΠΑΡΑΛΛΗΛΟΣ τοίχος (+axial=−x): το delta ακολουθεί τον ΑΞΟΝΑ ΤΟΙΧΟΥ, όχι το world +x', () => {
    reversedWall();
    DynamicInputLockStore.lockLength(100);
    // Κέρσορας στο world −x = προς +axial (έξω) → dirSign +1· η σωστή world κατεύθυνση είναι −x.
    const delta = resolveOpeningWidthLockedDelta(WALL, 'opening-corner-se', END_GRIP, { x: -20, y: 0 });
    expect(delta!.x).toBeCloseTo(-100); // κατά −x world = +axial (μεγαλώνει σωστά)
  });

  it('αρνητική πληκτρολογημένη τιμή ΑΝΤΙΣΤΡΕΦΕΙ τη φορά', () => {
    forwardWall();
    DynamicInputLockStore.lockLength(-100);
    const delta = resolveOpeningWidthLockedDelta(WALL, 'opening-corner-se', END_GRIP, { x: 20, y: 0 });
    expect(delta!.x).toBeCloseTo(-100);
  });

  it('isOpeningCornerGripKind: true ΜΟΝΟ για τις 4 λαβές παρειάς', () => {
    for (const k of ['opening-corner-ne', 'opening-corner-nw', 'opening-corner-sw', 'opening-corner-se'] as OpeningGripKind[]) {
      expect(isOpeningCornerGripKind(k)).toBe(true);
    }
    for (const k of ['opening-move', 'opening-rotation', 'opening-facing'] as OpeningGripKind[]) {
      expect(isOpeningCornerGripKind(k)).toBe(false);
    }
    expect(isOpeningCornerGripKind(null)).toBe(false);
    expect(isOpeningCornerGripKind(undefined)).toBe(false);
  });
});

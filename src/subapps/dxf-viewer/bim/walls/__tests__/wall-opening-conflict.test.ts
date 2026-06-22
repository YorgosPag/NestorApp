/**
 * wall-opening-conflict tests — ο τοίχος-φάντασμα 🔴 ΜΠΛΟΚΑΡΕΙ μπροστά από άνοιγμα (3D).
 * Ένας κανόνας πόρτα/παράθυρο (sillHeight): οριζόντια ΚΑΙ κατακόρυφη τομή με το κενό.
 */

import { wallGhostBlocksOpening, resolveWallStartOpeningConflict } from '../wall-opening-conflict';
import type { WallEntity } from '../../types/wall-types';
import type { OpeningEntity } from '../../types/opening-types';

/** Minimal straight wall fixture (mm scene) — μόνο τα πεδία που διαβάζουν οι functions. */
function makeWall(
  id: string,
  opts: { lengthMm?: number; thickness?: number; height?: number; baseOffset?: number } = {},
): WallEntity {
  const { lengthMm = 2000, thickness = 200, height = 3000, baseOffset = 0 } = opts;
  return {
    id,
    type: 'wall',
    kind: 'straight',
    params: {
      start: { x: 0, y: 0, z: 0 },
      end: { x: lengthMm, y: 0, z: 0 },
      thickness,
      height,
      baseOffset,
      sceneUnits: 'mm',
    },
  } as unknown as WallEntity;
}

/** Minimal opening fixture — door (sill 0) / window (sill>0) μέσω params. */
function makeOpening(
  id: string,
  wallId: string,
  opts: { offsetFromStart?: number; width?: number; sillHeight?: number; height?: number } = {},
): OpeningEntity {
  const { offsetFromStart = 1000, width = 900, sillHeight = 0, height = 2100 } = opts;
  return {
    id,
    type: 'opening',
    kind: sillHeight > 0 ? 'window' : 'door',
    params: { wallId, offsetFromStart, width, sillHeight, height },
  } as unknown as OpeningEntity;
}

describe('wallGhostBlocksOpening — 2-interval rule (πάχος ghost × ύψος)', () => {
  const door = makeOpening('o1', 'w1', { offsetFromStart: 1000, width: 900, sillHeight: 0, height: 2100 }); // [1000,1900] × [0,2100]

  it('🔴 πόρτα full-height: τοίχος [0,3000] μπροστά στο κενό', () => {
    const ghost = makeWall('g', { height: 3000, baseOffset: 0 });
    const c = wallGhostBlocksOpening(ghost, 1450, 200, [door]);
    expect(c).not.toBeNull();
    expect(c!.opening.id).toBe('o1');
    expect(c!.bandMm).toEqual([0, 2100]);
  });

  it('🟢 πόρτα: τοίχος πάνω από το πρέκι ([2100,3000]) δεν κόβει', () => {
    const ghost = makeWall('g', { baseOffset: 2100, height: 900 }); // [2100,3000] ∩ [0,2100] = ∅
    expect(wallGhostBlocksOpening(ghost, 1450, 200, [door])).toBeNull();
  });

  describe('παράθυρο ποδιά 1m → κενό [1000,2000]', () => {
    const win = makeOpening('o2', 'w1', { offsetFromStart: 1000, width: 900, sillHeight: 1000, height: 1000 });

    it('🟢 τοίχος ύψους 1m ([0,1000]) — άγγιγμα κάτω από την ποδιά', () => {
      const ghost = makeWall('g', { baseOffset: 0, height: 1000 }); // [0,1000] ∩ [1000,2000] = ∅ (άγγιγμα)
      expect(wallGhostBlocksOpening(ghost, 1450, 200, [win])).toBeNull();
    });

    it('🔴 τοίχος ύψους 1.5m ([0,1500]) — μερική επικάλυψη', () => {
      const ghost = makeWall('g', { baseOffset: 0, height: 1500 });
      const c = wallGhostBlocksOpening(ghost, 1450, 200, [win]);
      expect(c).not.toBeNull();
      expect(c!.bandMm).toEqual([1000, 1500]);
    });

    it('🟢 τοίχος πάνω από το πρέκι ([2000,3000])', () => {
      const ghost = makeWall('g', { baseOffset: 2000, height: 1000 });
      expect(wallGhostBlocksOpening(ghost, 1450, 200, [win])).toBeNull();
    });
  });

  it('🟢 οριζόντια εκτός span (abut μακριά από το άνοιγμα)', () => {
    const ghost = makeWall('g');
    expect(wallGhostBlocksOpening(ghost, 200, 200, [door])).toBeNull(); // [100,300] ∩ [1000,1900] = ∅
  });

  it('🔴 πάχος ghost ακουμπά την ΑΚΡΗ του ανοίγματος (band rule)', () => {
    const ghost = makeWall('g');
    // abut=920, t=200 → [820,1020] ∩ [1000,1900] = [1000,1020] → 🔴
    expect(wallGhostBlocksOpening(ghost, 920, 200, [door])).not.toBeNull();
  });

  it('επιστρέφει το ΣΥΓΚΡΟΥΟΜΕΝΟ μεταξύ πολλαπλών ανοιγμάτων', () => {
    const a = makeOpening('a', 'w1', { offsetFromStart: 0, width: 500 });   // [0,500]
    const b = makeOpening('b', 'w1', { offsetFromStart: 1800, width: 700 }); // [1800,2500]
    const c = wallGhostBlocksOpening(makeWall('g'), 2000, 200, [a, b]);      // [1900,2100] → b
    expect(c!.opening.id).toBe('b');
  });

  it('🟢 χωρίς ανοίγματα', () => {
    expect(wallGhostBlocksOpening(makeWall('g'), 1000, 200, [])).toBeNull();
  });
});

describe('resolveWallStartOpeningConflict — host detection + abut (preview === commit)', () => {
  const host = makeWall('w1', { lengthMm: 2000, thickness: 200 });
  const door = makeOpening('o1', 'w1', { offsetFromStart: 1000, width: 900, sillHeight: 0, height: 2100 });

  it('🔴 σημείο επαφής στην παρειά, μπροστά στο κενό', () => {
    const ghost = makeWall('g', { height: 3000 });
    // contact στην +y παρειά (y=100=halfHost), abut=1450 (κέντρο ανοίγματος)
    const c = resolveWallStartOpeningConflict({ x: 1450, y: 100 }, ghost, 200, [host], [door], 'mm');
    expect(c).not.toBeNull();
    expect(c!.opening.id).toBe('o1');
  });

  it('🟢 σημείο μακριά από κάθε τοίχο → καμία false-positive', () => {
    const ghost = makeWall('g', { height: 3000 });
    expect(resolveWallStartOpeningConflict({ x: 1450, y: 5000 }, ghost, 200, [host], [door], 'mm')).toBeNull();
  });

  it('🟢 επαφή στην παρειά αλλά εκτός του span ανοίγματος (δίπλα στο συμπαγές)', () => {
    const ghost = makeWall('g', { height: 3000 });
    expect(resolveWallStartOpeningConflict({ x: 200, y: 100 }, ghost, 200, [host], [door], 'mm')).toBeNull();
  });
});

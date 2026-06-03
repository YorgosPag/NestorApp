/**
 * ADR-413 — per-layer wall 3D split math (`wall-layer-geometry.ts`).
 *
 * A multi-layer DNA wall renders one sub-solid per layer. These tests pin the
 * thickness-fraction math and the per-piece quad subdivision (outer→inner
 * interpolation), independent of THREE.
 */

import {
  isMultiLayerWall,
  layerBoundaryFractions,
  splitPieceByLayers,
} from '../wall-layer-geometry';
import type { WallDna } from '../../../bim/types/wall-dna-types';
import type { WallOpeningPiece } from '../wall-opening-pieces';
import type { Point3D } from '../../../bim/types/bim-base';

function makeDna(thicknesses: number[]): WallDna {
  const layers = thicknesses.map((t, i) => ({
    id: `l${i}`,
    name: `Layer ${i}`,
    thickness: t,
    materialId: `mat-${i}`,
    side: (i === 0 ? 'exterior' : i === thicknesses.length - 1 ? 'interior' : 'core') as
      'exterior' | 'core' | 'interior',
  }));
  return { layers, totalThickness: thicknesses.reduce((a, b) => a + b, 0) };
}

/** A 1×1 plan piece: outer face at y=0, inner face at y=1 (quad [Ao,Bo,Bi,Ai]). */
function makePiece(): WallOpeningPiece {
  const Ao: Point3D = { x: 0, y: 0, z: 0 };
  const Bo: Point3D = { x: 1, y: 0, z: 0 };
  const Bi: Point3D = { x: 1, y: 1, z: 0 };
  const Ai: Point3D = { x: 0, y: 1, z: 0 };
  return { quad: [Ao, Bo, Bi, Ai], zBotAM: 0, zBotBM: 0, zTopAM: 3, zTopBM: 3 };
}

describe('isMultiLayerWall', () => {
  it('false for undefined / single layer / zero thickness', () => {
    expect(isMultiLayerWall(undefined)).toBe(false);
    expect(isMultiLayerWall(makeDna([200]))).toBe(false);
    expect(isMultiLayerWall({ layers: [], totalThickness: 0 })).toBe(false);
  });

  it('true for ≥2 positive-thickness layers', () => {
    expect(isMultiLayerWall(makeDna([20, 210, 20]))).toBe(true);
  });
});

describe('layerBoundaryFractions', () => {
  it('returns cumulative fractions [0..1] from the outer face', () => {
    const fr = layerBoundaryFractions(makeDna([20, 210, 20])); // total 250
    expect(fr.length).toBe(4);
    expect(fr[0]).toBe(0);
    expect(fr[1]).toBeCloseTo(20 / 250, 6);
    expect(fr[2]).toBeCloseTo(230 / 250, 6);
    expect(fr[3]).toBeCloseTo(1, 6);
  });
});

describe('splitPieceByLayers', () => {
  it('produces one sub-quad per layer, contiguous outer→inner', () => {
    const dna = makeDna([20, 210, 20]); // total 250
    const out = splitPieceByLayers(makePiece(), dna);
    expect(out.length).toBe(3);

    // Layer 0 (exterior) at the OUTER face: y from 0 → 20/250.
    expect(out[0].materialId).toBe('mat-0');
    expect(out[0].layerId).toBe('l0');
    expect(out[0].quad[0].y).toBeCloseTo(0, 6); // outer@a
    expect(out[0].quad[3].y).toBeCloseTo(20 / 250, 6); // inner@a of layer 0

    // Layer 2 (interior) reaches the INNER face (y=1).
    expect(out[2].quad[2].y).toBeCloseTo(1, 6); // inner@b
    expect(out[2].quad[3].y).toBeCloseTo(1, 6); // inner@a

    // Adjacent layers share a boundary (layer0 inner == layer1 outer).
    expect(out[1].quad[0].y).toBeCloseTo(out[0].quad[3].y, 6);
  });

  it('skips zero-thickness layers without throwing', () => {
    const dna = makeDna([100, 0, 100]);
    const out = splitPieceByLayers(makePiece(), dna);
    expect(out.length).toBe(2);
  });

  it('carries the source piece z-range to every layer (shared slope)', () => {
    const piece = makePiece();
    const out = splitPieceByLayers(piece, makeDna([20, 80]));
    for (const lp of out) {
      expect(lp.piece.zTopAM).toBe(piece.zTopAM);
      expect(lp.piece.zBotAM).toBe(piece.zBotAM);
    }
  });
});

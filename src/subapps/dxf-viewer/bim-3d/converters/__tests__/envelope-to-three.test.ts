/**
 * ADR-396 Phase P5 — EnvelopeToThree unit tests.
 *
 * ⚠️ jest globals (describe/it/expect injected) — ΟΧΙ `import from 'vitest'`
 * (το repo είναι jest· το vitest import σπάει σιωπηλά το suite — P4 παγίδα).
 */

import * as THREE from 'three';
import {
  envelopeChainToMesh,
  slabFlatLayerToMesh,
  revealLiningToMesh,
} from '../EnvelopeToThree';
import type { EnvelopeChain } from '../../../bim/geometry/envelope-perimeter';
import type { Point3D } from '../../../bim/types/bim-base';
import { GRAPHITE_EPS_MATERIAL_ID } from '../../../bim/types/thermal-envelope-types';

function pt(x: number, y: number) {
  return { x, y, z: 0 };
}

/** Τετράγωνο 10×10 με μόνωση 0.1 προς τα έξω (closed). */
function squareChain(): EnvelopeChain {
  return {
    exteriorFaceLoop: {
      points: [pt(0, 0), pt(10, 0), pt(10, 10), pt(0, 10)],
      closed: true,
    },
    insulationOuterLoop: {
      points: [pt(-0.1, -0.1), pt(10.1, -0.1), pt(10.1, 10.1), pt(-0.1, 10.1)],
      closed: true,
    },
    closed: true,
    perimeterM: 40.8,
    wallIds: ['w1', 'w2', 'w3', 'w4'],
  };
}

describe('envelopeChainToMesh (ADR-396 P5)', () => {
  it('builds an extruded band mesh από closed chain', () => {
    const mesh = envelopeChainToMesh(squareChain(), 3, 0, GRAPHITE_EPS_MATERIAL_ID, 'lvl-1');
    expect(mesh).not.toBeNull();
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh!.geometry).toBeInstanceOf(THREE.BufferGeometry);
    expect(mesh!.geometry.getAttribute('position').count).toBeGreaterThan(0);
  });

  it('tags το mesh με bimType=envelope + levelId + matId', () => {
    const mesh = envelopeChainToMesh(squareChain(), 3, 0, GRAPHITE_EPS_MATERIAL_ID, 'lvl-1');
    expect(mesh!.userData['bimType']).toBe('envelope');
    expect(mesh!.userData['levelId']).toBe('lvl-1');
    expect(mesh!.userData['matId']).toBe('elem-envelope');
  });

  it('extrude depth = ύψος ορόφου (bbox height σε world Y μετά rotation)', () => {
    const mesh = envelopeChainToMesh(squareChain(), 3, 0, GRAPHITE_EPS_MATERIAL_ID);
    mesh!.geometry.computeBoundingBox();
    const bb = mesh!.geometry.boundingBox!;
    // Μετά το ROT_X_NEG_90, το extrude (local Z) γίνεται world Y → ύψος ≈ 3.
    expect(bb.max.y - bb.min.y).toBeCloseTo(3, 5);
  });

  it('position.y = floorElevationMm*0.001 + buildingBaseElevationM (ίδια base με walls)', () => {
    const mesh = envelopeChainToMesh(squareChain(), 3, 3000, GRAPHITE_EPS_MATERIAL_ID, 'lvl-2', 10);
    expect(mesh!.position.y).toBeCloseTo(3 + 10, 5);
  });

  it('επιστρέφει null όταν heightM <= 0', () => {
    expect(envelopeChainToMesh(squareChain(), 0, 0, GRAPHITE_EPS_MATERIAL_ID)).toBeNull();
    expect(envelopeChainToMesh(squareChain(), -1, 0, GRAPHITE_EPS_MATERIAL_ID)).toBeNull();
  });

  it('επιστρέφει null για degenerate chain (< 2 vertices)', () => {
    const degenerate: EnvelopeChain = {
      exteriorFaceLoop: { points: [pt(0, 0)], closed: false },
      insulationOuterLoop: { points: [pt(0, 0)], closed: false },
      closed: false,
      perimeterM: 0,
      wallIds: [],
    };
    expect(envelopeChainToMesh(degenerate, 3, 0, GRAPHITE_EPS_MATERIAL_ID)).toBeNull();
  });
});

const SQUARE: Point3D[] = [pt(0, 0), pt(2, 0), pt(2, 2), pt(0, 2)];

describe('slabFlatLayerToMesh (ADR-396 Z2/Z3)', () => {
  it('Z3 (δώμα): η στρώση κάθεται ΠΑΝΩ από την άνω παρειά (posY = slabTop)', () => {
    // slabTopMm=3000 → 3m· base 0 → posY = 3.
    const mesh = slabFlatLayerToMesh(SQUARE, 'Z3', 3000, 200, 0.1, GRAPHITE_EPS_MATERIAL_ID, 'lvl-1');
    expect(mesh).not.toBeNull();
    expect(mesh!.userData['bimType']).toBe('envelope');
    expect(mesh!.userData['matId']).toBe('elem-envelope');
    expect(mesh!.position.y).toBeCloseTo(3, 5);
  });

  it('Z2 (πιλοτή): η στρώση κάθεται ΚΑΤΩ από την κάτω παρειά (posY = bottom − layer)', () => {
    // slabTop 3m, thickness 0.2m → bottom 2.8m· layer 0.1m → posY = 2.7.
    const mesh = slabFlatLayerToMesh(SQUARE, 'Z2', 3000, 200, 0.1, GRAPHITE_EPS_MATERIAL_ID);
    expect(mesh!.position.y).toBeCloseTo(2.7, 5);
  });

  it('εφαρμόζει το buildingBaseElevationM στη βάση', () => {
    const mesh = slabFlatLayerToMesh(SQUARE, 'Z3', 3000, 200, 0.1, GRAPHITE_EPS_MATERIAL_ID, 'lvl-1', 10);
    expect(mesh!.position.y).toBeCloseTo(13, 5);
  });

  it('επιστρέφει null για degenerate footprint ή layerThicknessM <= 0', () => {
    expect(slabFlatLayerToMesh([pt(0, 0), pt(1, 1)], 'Z3', 3000, 200, 0.1, GRAPHITE_EPS_MATERIAL_ID)).toBeNull();
    expect(slabFlatLayerToMesh(SQUARE, 'Z3', 3000, 200, 0, GRAPHITE_EPS_MATERIAL_ID)).toBeNull();
  });
});

describe('revealLiningToMesh (ADR-396 Z4)', () => {
  const OUTLINE: Point3D[] = [pt(0, 0), pt(1, 0), pt(1, 0.25), pt(0, 0.25)];

  it('χτίζει lining frame extruded καθ’ ύψος ανοίγματος', () => {
    const mesh = revealLiningToMesh(OUTLINE, 0.05, 900, 1100, 0, 0, GRAPHITE_EPS_MATERIAL_ID, 'lvl-1');
    expect(mesh).not.toBeNull();
    expect(mesh!.userData['bimType']).toBe('envelope');
    mesh!.geometry.computeBoundingBox();
    const bb = mesh!.geometry.boundingBox!;
    expect(bb.max.y - bb.min.y).toBeCloseTo(1.1, 5); // openingHeight
  });

  it('position.y = floorElev + base + sillHeight (ποδιά ανοίγματος)', () => {
    const mesh = revealLiningToMesh(OUTLINE, 0.05, 900, 1100, 0, 0, GRAPHITE_EPS_MATERIAL_ID);
    expect(mesh!.position.y).toBeCloseTo(0.9, 5);
  });

  it('επιστρέφει null για ύψος ≤ 0 ή πάχος ≤ 0', () => {
    expect(revealLiningToMesh(OUTLINE, 0.05, 900, 0, 0, 0, GRAPHITE_EPS_MATERIAL_ID)).toBeNull();
    expect(revealLiningToMesh(OUTLINE, 0, 900, 1100, 0, 0, GRAPHITE_EPS_MATERIAL_ID)).toBeNull();
  });
});

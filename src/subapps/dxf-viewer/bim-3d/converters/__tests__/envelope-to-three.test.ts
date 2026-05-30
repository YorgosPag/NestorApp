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

/** Πρώτο child mesh του group κελύφους (per-edge prisms — ADR-396 cutouts). */
function firstMesh(obj: THREE.Object3D | null): THREE.Mesh {
  let found: THREE.Mesh | null = null;
  obj?.traverse((c) => { if (!found && (c as THREE.Mesh).isMesh) found = c as THREE.Mesh; });
  if (!found) throw new Error('no child mesh');
  return found;
}

describe('envelopeChainToMesh (ADR-396 P5)', () => {
  it('builds a per-edge prism group από closed chain', () => {
    const grp = envelopeChainToMesh(squareChain(), 3, 0, GRAPHITE_EPS_MATERIAL_ID, 'lvl-1');
    expect(grp).not.toBeNull();
    expect(grp).toBeInstanceOf(THREE.Group);
    // 4 ακμές (closed square, no opening cuts) → 4 prism meshes.
    expect(grp!.children.length).toBe(4);
    const mesh = firstMesh(grp);
    expect(mesh.geometry).toBeInstanceOf(THREE.BufferGeometry);
    expect(mesh.geometry.getAttribute('position').count).toBeGreaterThan(0);
  });

  it('tags group με bimType=envelope + levelId· child meshes με matId', () => {
    const grp = envelopeChainToMesh(squareChain(), 3, 0, GRAPHITE_EPS_MATERIAL_ID, 'lvl-1');
    expect(grp!.userData['bimType']).toBe('envelope');
    expect(grp!.userData['levelId']).toBe('lvl-1');
    expect(firstMesh(grp).userData['matId']).toBe('elem-envelope');
  });

  it('extrude depth = ύψος ορόφου (world bbox height μετά rotation)', () => {
    const grp = envelopeChainToMesh(squareChain(), 3, 0, GRAPHITE_EPS_MATERIAL_ID);
    const bb = new THREE.Box3().setFromObject(grp!);
    // Μετά το ROT_X_NEG_90, το extrude (local Z) γίνεται world Y → ύψος ≈ 3.
    expect(bb.max.y - bb.min.y).toBeCloseTo(3, 5);
  });

  it('base = floorElevationMm*0.001 + buildingBaseElevationM (ίδια με walls)', () => {
    const grp = envelopeChainToMesh(squareChain(), 3, 3000, GRAPHITE_EPS_MATERIAL_ID, 'lvl-2', 10);
    const bb = new THREE.Box3().setFromObject(grp!);
    // base = 3000mm→3 + 10 = 13· κορυφή = 13 + ύψος 3 = 16.
    expect(bb.min.y).toBeCloseTo(13, 5);
    expect(bb.max.y).toBeCloseTo(16, 5);
  });

  it('cuts τρυπάνε το κέλυφος (ανοιχτό κουφώμα → επιπλέον prisms)', () => {
    const chain = squareChain();
    // Παράθυρο στο μέσο της ακμής 0: span [0.4,0.6], sill 0.9, head 2.3 (m).
    const grp = envelopeChainToMesh(
      chain, 3, 0, GRAPHITE_EPS_MATERIAL_ID, 'lvl-1', 0,
      [{ edgeIndex: 0, tStart: 0.4, tEnd: 0.6, sillM: 0.9, headM: 2.3,
         bandQuad: [pt(-0.1, -0.1), pt(-0.1, -0.1), pt(0, 0), pt(0, 0)] }],
    );
    // Ακμή 0 → 4 prisms (left solid + under-sill + above-head + right solid)·
    // ακμές 1,2,3 → 1 prism έκαστη. Σύνολο 7 > 4 (baseline χωρίς cuts).
    expect(grp!.children.length).toBeGreaterThan(4);
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

describe('revealLiningToMesh (ADR-396 Z4 — λωρίδες περβαζιού, structural)', () => {
  // free outline (width 1m άξονας x, depth 0.25m)· structural = +0.05 σε κάθε άκρο
  // (η μόνωση τρώει τον τοίχο, ΕΞΩ από το ελεύθερο άνοιγμα).
  const FREE: Point3D[] = [pt(0, 0), pt(1, 0), pt(1, 0.25), pt(0, 0.25)];
  const STRUCT: Point3D[] = [pt(-0.05, 0), pt(1.05, 0), pt(1.05, 0.25), pt(-0.05, 0.25)];

  it('παράθυρο (sill>0) → 4 λωρίδες (2 παραστάδες + πρέκι + ποδιά)', () => {
    const grp = revealLiningToMesh(FREE, STRUCT, 0.05, 900, 1100, 0, 0, GRAPHITE_EPS_MATERIAL_ID, 'lvl-1');
    expect(grp).not.toBeNull();
    expect(grp).toBeInstanceOf(THREE.Group);
    expect(grp!.children.length).toBe(4);
    expect(grp!.userData['bimType']).toBe('envelope');
    expect(grp!.userData['levelId']).toBe('lvl-1');
    expect(firstMesh(grp).userData['matId']).toBe('elem-envelope');
  });

  it('πόρτα (sill=0) → 3 λωρίδες (παραστάδες + πρέκι, ΧΩΡΙΣ ποδιά)', () => {
    const grp = revealLiningToMesh(FREE, STRUCT, 0.05, 0, 2100, 0, 0, GRAPHITE_EPS_MATERIAL_ID);
    expect(grp!.children.length).toBe(3);
  });

  it('structural ύψος: βάση = sill−t (0.85)· κορυφή = head+t (2.05)', () => {
    // sill 0.9, head 2.0, t 0.05 → structBottom 0.85, structTop 2.05 (η μόνωση τρώει πρέκι/ποδιά).
    const grp = revealLiningToMesh(FREE, STRUCT, 0.05, 900, 1100, 0, 0, GRAPHITE_EPS_MATERIAL_ID);
    const bb = new THREE.Box3().setFromObject(grp!);
    expect(bb.min.y).toBeCloseTo(0.85, 5);
    expect(bb.max.y).toBeCloseTo(2.05, 5);
  });

  it('εφαρμόζει floorElevationMm + buildingBaseElevationM στη βάση (sill−t)', () => {
    // floorElev 3000mm→3 + base 10 + (sill 0.9 − t 0.05) = 13.85.
    const grp = revealLiningToMesh(FREE, STRUCT, 0.05, 900, 1100, 3000, 10, GRAPHITE_EPS_MATERIAL_ID);
    const bb = new THREE.Box3().setFromObject(grp!);
    expect(bb.min.y).toBeCloseTo(13.85, 5);
  });

  it('επιστρέφει null για ύψος ≤ 0, πάχος ≤ 0, ή free outline < 4 κορυφές', () => {
    expect(revealLiningToMesh(FREE, STRUCT, 0.05, 900, 0, 0, 0, GRAPHITE_EPS_MATERIAL_ID)).toBeNull();
    expect(revealLiningToMesh(FREE, STRUCT, 0, 900, 1100, 0, 0, GRAPHITE_EPS_MATERIAL_ID)).toBeNull();
    expect(revealLiningToMesh([pt(0, 0), pt(1, 0)], STRUCT, 0.05, 900, 1100, 0, 0, GRAPHITE_EPS_MATERIAL_ID)).toBeNull();
  });
});

/**
 * ADR-684 Φ4-C / ADR-539 — genericSolidToObject3D faced (per-face appearance) tests.
 *
 * Το `generic-solid` γίνεται faced (multi-material, pickable/paintable ανά έδρα) όταν φέρει
 * `faceAppearance` Ή το Polygon Mode είναι ενεργό· αλλιώς legacy single-material (byte-for-byte).
 * Σε αντίθεση με τα δομικά πρίσματα, οι faceKeys παράγονται ανά σχήμα (`genericSolidFaceKeys`) και
 * πρέπει να πέφτουν στο `userData.faceKeyByMaterialIndex` ώστε ο raycaster να βρίσκει την έδρα.
 */

import * as THREE from 'three';
import { genericSolidToObject3D } from '../generic-solid-to-three';
import {
  buildDefaultGenericSolidParams,
  buildGenericSolidEntity,
} from '../../../hooks/drawing/generic-solid-completion';
import { usePolygonMode3DStore } from '../../stores/PolygonMode3DStore';
import type { GenericSolidEntity } from '../../../bim/entities/generic-solid/generic-solid-types';
import type { GenericSolidShape } from '../../../bim/entities/generic-solid/generic-solid-types';

function solid(shape?: GenericSolidShape): GenericSolidEntity {
  const res = buildGenericSolidEntity(buildDefaultGenericSolidParams({ x: 0, y: 0 }, { shape }), '0');
  if (!res.ok) throw new Error('generic-solid fixture invalid');
  return res.entity;
}

/** Βάφει μία έδρα → αναγκάζει faced render. */
function painted(shape?: GenericSolidShape): GenericSolidEntity {
  return { ...solid(shape), faceAppearance: { 'side:0': { colorHex: '#C0392B' } } };
}

function mesh(entity: GenericSolidEntity): THREE.Mesh {
  return genericSolidToObject3D(entity) as THREE.Mesh;
}

afterEach(() => usePolygonMode3DStore.getState().reset());

describe('genericSolidToObject3D — ADR-684 Φ4-C faced (per-face appearance)', () => {
  it('box → 6-material faced mesh με σταθερούς faceKeys στο userData', () => {
    const m = mesh(painted({ kind: 'box', widthMm: 500, depthMm: 500, heightMm: 500 }));
    expect(Array.isArray(m.material)).toBe(true);
    expect((m.material as THREE.Material[]).length).toBe(6);
    expect(m.userData['faceKeyByMaterialIndex']).toEqual([
      'side:0',
      'side:1',
      'top',
      'bottom',
      'side:2',
      'side:3',
    ]);
  });

  it('cylinder → 3 έδρες (πλευρά/πάνω/κάτω)', () => {
    const m = mesh(painted({ kind: 'cylinder', radiusMm: 300, heightMm: 800 }));
    expect((m.material as THREE.Material[]).length).toBe(3);
    expect(m.userData['faceKeyByMaterialIndex']).toEqual(['side:0', 'top', 'bottom']);
  });

  it('sphere → ΜΙΑ έδρα (geometry χωρίς groups → material[0])', () => {
    const m = mesh(painted({ kind: 'sphere', radiusMm: 400 }));
    expect((m.material as THREE.Material[]).length).toBe(1);
    expect(m.userData['faceKeyByMaterialIndex']).toEqual(['side:0']);
  });

  it('pyramid → 5 geometry groups ευθυγραμμισμένα με τους faceKeys [bottom, side:0..3]', () => {
    const m = mesh(painted({ kind: 'pyramid', baseWidthMm: 600, baseDepthMm: 400, heightMm: 700 }));
    expect(m.geometry.groups).toHaveLength(5);
    expect(m.geometry.groups.map((g) => g.materialIndex)).toEqual([0, 1, 2, 3, 4]);
    expect((m.material as THREE.Material[]).length).toBe(5);
    expect(m.userData['faceKeyByMaterialIndex']).toEqual([
      'bottom',
      'side:0',
      'side:1',
      'side:2',
      'side:3',
    ]);
  });

  it('άβαφο + Polygon Mode κλειστό → legacy single-material (μηδέν παλινδρόμηση)', () => {
    const m = mesh(solid());
    expect(Array.isArray(m.material)).toBe(false);
    expect(m.userData['faceKeyByMaterialIndex']).toBeUndefined();
  });

  it('κενός χάρτης faceAppearance → παραμένει legacy (byte-for-byte)', () => {
    const m = mesh({ ...solid(), faceAppearance: {} });
    expect(Array.isArray(m.material)).toBe(false);
  });

  it('Polygon Mode ενεργό → faced ακόμη κι άβαφο (cross-entity pickability)', () => {
    usePolygonMode3DStore.getState().setActive(true, 'some-other-id');
    expect(Array.isArray(mesh(solid()).material)).toBe(true);
  });
});

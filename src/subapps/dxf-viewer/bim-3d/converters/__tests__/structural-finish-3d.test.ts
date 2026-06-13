/**
 * ADR-449 Slice 2 — structural-finish-3d (3D band skin κολόνας) tests.
 *
 * Καλύπτει: ανά εκτεθειμένη παρειά → ένα band mesh (REUSE resolver SSoT)· σωστό
 * πλήθος· σοβάς μετατοπισμένος ΠΡΟΣ ΤΑ ΕΞΩ (CCW outward normal — όχι μέσα στον
 * πυρήνα)· material pass-through (plaster)· tags (structuralFinish)· null όταν ο
 * σοβάς είναι ανενεργός· και integration με `columnToMesh` (Group vs Mesh).
 */

import * as THREE from 'three';
import { buildColumnFinishSkin } from '../structural-finish-3d';
import { columnToMesh } from '../BimToThreeConverter';
import { buildDefaultColumnParams, buildColumnEntity } from '../../../hooks/drawing/column-completion';
import type { ColumnEntity } from '../../../bim/types/column-types';
import type { StructuralFinishSpec } from '../../../bim/finishes/structural-finish-types';

const PLASTER_HEX = 0xe8e0d0; // MATERIAL_DEFS['mat-plaster'] — όπου resolve τα mat-plaster-int/ext.

const FINISH: StructuralFinishSpec = {
  enabled: true,
  interiorMaterialId: 'mat-plaster-int',
  exteriorMaterialId: 'mat-plaster-ext',
  thickness: 15,
};

function column(finish?: StructuralFinishSpec): ColumnEntity {
  // ADR-449 Slice 5 — ο factory πλέον δίνει default finish· ρητό override (undefined
  // χωρίς arg) ώστε τα «απών σοβάς» fixtures να παραμένουν έγκυρα.
  const params = { ...buildDefaultColumnParams({ x: 0, y: 0 }, 'rectangular'), finish };
  const res = buildColumnEntity(params, '0');
  if (!res.ok) throw new Error('column fixture invalid');
  return res.entity;
}

const matHex = (mesh: THREE.Mesh): number => (mesh.material as THREE.MeshStandardMaterial).color.getHex();

describe('buildColumnFinishSkin (ADR-449 Slice 2)', () => {
  it('ενεργός σοβάς, μηδέν walls → ένα mitered band ανά παρειά (γωνίες κλείνουν χωρίς overlap)', () => {
    const col = column(FINISH);
    const group = buildColumnFinishSkin(col, [], [],0);
    expect(group).not.toBeNull();
    const edges = col.geometry.footprint.vertices.length;
    // ADR-449 Slice 5 — οι γωνίες κλείνουν με 45° miter (extend στο miter point)·
    // ΚΑΝΕΝΑ ξεχωριστό corner mesh → ένα band ανά παρειά, μηδέν επικάλυψη.
    expect(group!.children).toHaveLength(edges);
  });

  it('κάθε band = Mesh με plaster material + structuralFinish tags', () => {
    const col = column(FINISH);
    const group = buildColumnFinishSkin(col, [], [],0)!;
    for (const child of group.children) {
      expect(child).toBeInstanceOf(THREE.Mesh);
      const mesh = child as THREE.Mesh;
      expect(matHex(mesh)).toBe(PLASTER_HEX);
      expect(mesh.userData['structuralFinish']).toBe(true);
      expect(mesh.userData['bimType']).toBe('column');
      expect(mesh.userData['bimId']).toBe(col.id);
      expect(mesh.userData['matId']).toBe('mat-plaster-int'); // μεμονωμένη → interior
    }
    expect(group.userData['structuralFinish']).toBe(true);
  });

  it('ο σοβάς μετατοπίζεται ΠΡΟΣ ΤΑ ΕΞΩ (CCW outward normal, όχι μέσα στον πυρήνα)', () => {
    const core = columnToMesh(column(), 0, '0', 0); // χωρίς finish → καθαρός πυρήνας Mesh
    const skin = buildColumnFinishSkin(column(FINISH), [], [],0)!;
    const coreBox = new THREE.Box3().setFromObject(core as THREE.Object3D);
    const skinBox = new THREE.Box3().setFromObject(skin);
    // Το «δέρμα» πρέπει να ξεπερνά τον πυρήνα προς τα έξω σε X και Z (περιμετρικά).
    expect(skinBox.max.x).toBeGreaterThan(coreBox.max.x);
    expect(skinBox.min.x).toBeLessThan(coreBox.min.x);
    expect(skinBox.max.z).toBeGreaterThan(coreBox.max.z);
    expect(skinBox.min.z).toBeLessThan(coreBox.min.z);
  });

  it('μεγαλύτερο πάχος → πιο εξωτερικό δέρμα', () => {
    const thin = buildColumnFinishSkin(column({ ...FINISH, thickness: 15 }), [], [],0)!;
    const thick = buildColumnFinishSkin(column({ ...FINISH, thickness: 60 }), [], [],0)!;
    const thinBox = new THREE.Box3().setFromObject(thin);
    const thickBox = new THREE.Box3().setFromObject(thick);
    expect(thickBox.max.x).toBeGreaterThan(thinBox.max.x);
  });

  it('baseY → κατακόρυφη θέση κάθε band', () => {
    const group = buildColumnFinishSkin(column(FINISH), [], [],5)!;
    for (const child of group.children) {
      expect((child as THREE.Mesh).position.y).toBeCloseTo(5, 6);
    }
  });

  it('ανενεργός σοβάς (enabled:false) → null', () => {
    expect(buildColumnFinishSkin(column({ ...FINISH, enabled: false }), [], [],0)).toBeNull();
  });

  it('απών σοβάς → null', () => {
    expect(buildColumnFinishSkin(column(), [], [],0)).toBeNull();
  });

  it('πάχος 0 → null (isFinishActive false)', () => {
    expect(buildColumnFinishSkin(column({ ...FINISH, thickness: 0 }), [], [],0)).toBeNull();
  });
});

describe('columnToMesh integration (ADR-449 Slice 2)', () => {
  it('ενεργός σοβάς + walls → Group { πυρήνας + σοβάς }', () => {
    const out = columnToMesh(column(FINISH), 0, '0', 0, undefined, undefined, undefined, []);
    expect(out).toBeInstanceOf(THREE.Group);
    expect((out as THREE.Group).children).toHaveLength(2); // core mesh + finish group
  });

  it('ανενεργός σοβάς → απλό Mesh (regression: ghost/χωρίς-finish path)', () => {
    const out = columnToMesh(column(), 0, '0', 0);
    expect(out).toBeInstanceOf(THREE.Mesh);
  });
});

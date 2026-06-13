/**
 * ADR-449 Slice 4 — structural-finish-3d (3D band skin δοκαριού) tests.
 *
 * Καλύπτει: 2 πλάγιες όψεις → 2 band meshes (REUSE resolver SSoT)· plaster material +
 * `structuralFinish`/`bimType:'beam'` tags· `baseY` κατακόρυφη θέση· null όταν ο σοβάς
 * είναι ανενεργός· integration με `beamToMesh` (Group{πυρήνας+σοβάς} vs Mesh).
 */

import * as THREE from 'three';
import { buildBeamFinishSkin, computeMiteredOuter } from '../structural-finish-3d';
import { beamToMesh } from '../BimToThreeConverter';
import { buildDefaultBeamParams, buildBeamEntity } from '../../../hooks/drawing/beam-completion';
import type { BeamEntity } from '../../../bim/types/beam-types';
import type { StructuralFinishSpec, FinishFaceSegment } from '../../../bim/finishes/structural-finish-types';

const PLASTER_HEX = 0xe8e0d0;

const FINISH: StructuralFinishSpec = {
  enabled: true,
  interiorMaterialId: 'mat-plaster-int',
  exteriorMaterialId: 'mat-plaster-ext',
  thickness: 15,
};

function beam(finish?: StructuralFinishSpec): BeamEntity {
  const params = {
    ...buildDefaultBeamParams({ x: 0, y: 0 }, { x: 3000, y: 0 }, 'straight', { width: 250, depth: 500 }),
    // ADR-449 Slice 5 — ρητό override του factory default finish (undefined χωρίς arg).
    finish,
  };
  const res = buildBeamEntity(params, '0');
  if (!res.ok) throw new Error('beam fixture invalid');
  return res.entity;
}

const matHex = (mesh: THREE.Mesh): number => (mesh.material as THREE.MeshStandardMaterial).color.getHex();

describe('buildBeamFinishSkin (ADR-449 Slice 4)', () => {
  it('ενεργός σοβάς → 2 bands (2 πλάγιες όψεις, άκρα εκτός)', () => {
    const group = buildBeamFinishSkin(beam(FINISH), [], [],0);
    expect(group).not.toBeNull();
    expect(group!.children).toHaveLength(2);
  });

  it('ο σοβάς βγαίνει ΕΞΩ από το σώμα του δοκαριού (CW outline → resolver normalize CCW)', () => {
    // ADR-449 Slice 5 regression #3: το beam outline είναι CW → χωρίς normalization
    // ο σοβάς θα έβγαινε ΜΕΣΑ. Άξονας ∥ X → πλάγιες όψεις offset σε Z (perpendicular).
    const core = beamToMesh(beam(), '0', 0) as THREE.Object3D; // χωρίς finish → καθαρός πυρήνας
    const skin = buildBeamFinishSkin(beam(FINISH), [], [],0)!;
    const coreBox = new THREE.Box3().setFromObject(core);
    const skinBox = new THREE.Box3().setFromObject(skin);
    expect(skinBox.max.z).toBeGreaterThan(coreBox.max.z);
    expect(skinBox.min.z).toBeLessThan(coreBox.min.z);
  });

  it('κάθε band = Mesh με plaster material + bimType beam tags', () => {
    const b = beam(FINISH);
    const group = buildBeamFinishSkin(b, [], [],0)!;
    for (const child of group.children) {
      expect(child).toBeInstanceOf(THREE.Mesh);
      const mesh = child as THREE.Mesh;
      expect(matHex(mesh)).toBe(PLASTER_HEX);
      expect(mesh.userData['structuralFinish']).toBe(true);
      expect(mesh.userData['bimType']).toBe('beam');
      expect(mesh.userData['bimId']).toBe(b.id);
    }
    expect(group.userData['bimType']).toBe('beam');
    expect(group.userData['structuralFinish']).toBe(true);
  });

  it('baseY → κατακόρυφη θέση κάθε band', () => {
    const group = buildBeamFinishSkin(beam(FINISH), [], [],7)!;
    for (const child of group.children) {
      expect((child as THREE.Mesh).position.y).toBeCloseTo(7, 6);
    }
  });

  it('ανενεργός σοβάς → null', () => {
    expect(buildBeamFinishSkin(beam({ ...FINISH, enabled: false }), [], [],0)).toBeNull();
  });

  it('απών σοβάς → null', () => {
    expect(buildBeamFinishSkin(beam(), [], [],0)).toBeNull();
  });
});

describe('computeMiteredOuter — chamfer open ends (ADR-449 Slice 6 fix)', () => {
  // 2 παράλληλες πλάγιες όψεις δοκαριού (μήκος 1000), ΧΩΡΙΣ κοινή κορυφή → ανοιχτά άκρα.
  const seg = (ax: number, ay: number, bx: number, by: number): FinishFaceSegment => ({
    a: { x: ax, y: ay }, b: { x: bx, y: by },
    classification: 'interior', materialId: 'mat-plaster-int', thickness: 15, lengthM: 1,
  });
  const segs = [seg(0, 125, 1000, 125), seg(1000, -125, 0, -125)];
  const offsets = [{ x: 0, y: 15 }, { x: 0, y: -15 }]; // outward

  it('chamferOpenEnds=true → οι εξωτερικές γωνίες τραβιούνται μέσα κατά το πάχος (όχι πτερύγιο)', () => {
    const { aOuter, bOuter } = computeMiteredOuter(segs, offsets, true);
    expect(aOuter[0].x).toBeCloseTo(15, 6); // αρχή: 0 → +15 (inset)
    expect(bOuter[0].x).toBeCloseTo(985, 6); // τέλος: 1000 → −15 (inset)
  });

  // ADR-449 Slice 9 — το `false` branch κρατιέται ως pure-function option (generic),
  // αλλά ΚΑΝΕΝΑ structural element δεν το χρησιμοποιεί πλέον: κολόνα + δοκάρι περνούν `true`
  // (ενιαία 45° μεταχείριση στις συμβολές). Unit guard ότι το branch παραμένει square.
  it('chamferOpenEnds=false (generic) → τετράγωνα άκρα στις θέσεις των κορυφών', () => {
    const { aOuter, bOuter } = computeMiteredOuter(segs, offsets, false);
    expect(aOuter[0].x).toBeCloseTo(0, 6);
    expect(bOuter[0].x).toBeCloseTo(1000, 6);
  });
});

describe('beamToMesh integration (ADR-449 Slice 4)', () => {
  it('ενεργός σοβάς + walls → Group { πυρήνας + σοβάς }', () => {
    const out = beamToMesh(beam(FINISH), '0', 0, []);
    expect(out).toBeInstanceOf(THREE.Group);
    expect((out as THREE.Group).children).toHaveLength(2);
  });

  it('ανενεργός σοβάς → απλό Mesh (regression: ghost/χωρίς-finish path)', () => {
    const out = beamToMesh(beam(), '0', 0);
    expect(out).toBeInstanceOf(THREE.Mesh);
  });
});

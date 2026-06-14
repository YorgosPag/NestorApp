/**
 * ADR-449 Slice 4 — structural-finish-3d (3D band skin δοκαριού) tests.
 *
 * Καλύπτει: 2 πλάγιες όψεις → 2 band meshes (REUSE resolver SSoT)· plaster material +
 * `structuralFinish`/`bimType:'beam'` tags· `baseY` κατακόρυφη θέση· null όταν ο σοβάς
 * είναι ανενεργός· integration με `beamToMesh` (Group{πυρήνας+σοβάς} vs Mesh).
 */

import * as THREE from 'three';
import { buildBeamFinishSkin, computeMiteredOuter } from '../structural-finish-3d';
import { buildStructuralSilhouetteSkin } from '../structural-finish-silhouette-3d';
import { beamToMesh } from '../BimToThreeConverter';
import { buildDefaultBeamParams, buildBeamEntity } from '../../../hooks/drawing/beam-completion';
import type { BeamEntity } from '../../../bim/types/beam-types';
import type { SilhouetteBand } from '../../../bim/finishes/structural-finish-silhouette';
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

  // ADR-449 Slice 10 — junction άκρο (ακουμπά γείτονα) → **ορθογώνια EXTEND** (core+outer μαζί
  // έξω → κάθετη τομή, corner-fill, ο σοβάς κλείνει flush χωρίς λοξή ακμή)· ελεύθερο άκρο →
  // chamfer 45° (μόνο outer μέσα → λοξό end-cap). Giorgio 2026-06-14: v2 outer-only έκανε λοξό
  // end-cap που διείσδυε στον διπλανό· v3 core+outer = ορθογωνική τομή.
  it('junction άκρο → ορθογώνια extend (core+outer)· ελεύθερο → chamfer (outer-only)', () => {
    // seg[0]: a ελεύθερο, b junction.
    const segsJ: FinishFaceSegment[] = [
      { ...seg(0, 125, 1000, 125), aJunction: false, bJunction: true },
      seg(1000, -125, 0, -125),
    ];
    const { aOuter, bOuter, aCore, bCore } = computeMiteredOuter(segsJ, offsets, true);
    // Junction b: core ΚΑΙ outer extended → x=1015 και τα δύο → end-cap κάθετο (ίδιο x).
    expect(bCore[0].x).toBeCloseTo(1015, 6);
    expect(bOuter[0].x).toBeCloseTo(1015, 6);
    // Ελεύθερο a: core αμετάβλητο (0), μόνο outer chamfered (+15) → λοξό end-cap.
    expect(aCore[0].x).toBeCloseTo(0, 6);
    expect(aOuter[0].x).toBeCloseTo(15, 6);
  });

  // ADR-449 Δρόμος Β (#A) — square end (ακουμπά ΤΟΙΧΟ): καθαρό τετράγωνο σταμάτημα — ούτε
  // chamfer ούτε extend → core ΚΑΙ outer μένουν στη θέση της κορυφής (μηδέν over-reach).
  it('square άκρο (wall butt) → ούτε chamfer ούτε extend (core+outer αμετάβλητα)', () => {
    const segsS: FinishFaceSegment[] = [
      { ...seg(0, 125, 1000, 125), aSquareEnd: false, bSquareEnd: true },
      seg(1000, -125, 0, -125),
    ];
    const { bOuter, bCore } = computeMiteredOuter(segsS, offsets, true);
    // Square b: ΟΥΤΕ extend (όχι 1015) ΟΥΤΕ chamfer (όχι 985) → μένει 1000.
    expect(bCore[0].x).toBeCloseTo(1000, 6);
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

describe('buildStructuralSilhouetteSkin — μη-pickable (ADR-449 Slice X1)', () => {
  // Ενιαίο silhouette skin = παράγωγη διακόσμηση με synthetic bimId ανά κτίριο → ΟΧΙ
  // ανεξάρτητα επιλέξιμο (αλλιώς κλικ σε μία όψη επιλέγει ΟΛΟ τον σοβά). Μη-pickable →
  // το ray περνά μέσα του και χτυπά τον δομικό πυρήνα → επιλέγεται το σωστό στοιχείο.
  const band: SilhouetteBand = {
    zBottomMm: 0,
    zTopMm: 3000,
    faces: {
      heightM: 3,
      interiorAreaM2: 0,
      exteriorAreaM2: 0,
      segments: [
        { a: { x: 0, y: 0 }, b: { x: 400, y: 0 }, classification: 'interior', materialId: 'mat-plaster-int', thickness: 15, lengthM: 0.4 },
        { a: { x: 400, y: 0 }, b: { x: 400, y: 400 }, classification: 'interior', materialId: 'mat-plaster-int', thickness: 15, lengthM: 0.4 },
      ],
    },
  };

  it('κάθε mesh του skin έχει raycast παρακαμμένο (non-pickable, ≠ default Mesh.raycast)', () => {
    const skin = buildStructuralSilhouetteSkin([band], 'm', 0);
    expect(skin).not.toBeNull();
    let meshCount = 0;
    skin!.traverse((obj) => {
      if (!(obj as THREE.Mesh).isMesh) return;
      meshCount++;
      // Παρακαμμένο raycast (no-op) → δεν παράγει τομή· κλικ περνά στον πυρήνα πίσω.
      expect((obj as THREE.Mesh).raycast).not.toBe(THREE.Mesh.prototype.raycast);
      const intersects: THREE.Intersection[] = [];
      (obj as THREE.Mesh).raycast(new THREE.Raycaster(), intersects);
      expect(intersects).toHaveLength(0);
    });
    expect(meshCount).toBeGreaterThan(0);
  });
});

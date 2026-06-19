/**
 * Tests — beam-diagram-3d-mesh (ADR-483 Slice 6).
 *
 * Structural tests: null για κενό set· ΕΝΑ pivot group ανά δοκάρι στο 3D μέσο (xM_mid,
 * zM_mid, −yM_mid) με fill + line· **fixed κάθετο επίπεδο** (pivot quaternion: τοπικό
 * +X → κατεύθυνση ανοίγματος world, +Y → world up — ΟΧΙ billboard)· signed δίχρωμη ροπή /
 * μονόχρωμη N· always-on-top (depthTest:false + renderOrder fill<outline). Οι ετικέτες
 * (sprite) παραλείπονται σε node (χωρίς DOM) — by design.
 */

import * as THREE from 'three';
import {
  buildBeamDiagram3DGroup,
  BEAM_DIAGRAM_3D_GROUP_NAME,
} from '../beam-diagram-3d-mesh';
import { MEMBER_DIAGRAM_3D_COLORS } from '../member-diagram-3d-shared';
import type { BeamDiagram3DSet } from '../beam-diagram-3d-geometry';

/** Default: οριζόντιο δοκάρι (2,5,3)→(8,5,3), L=6, signed ροπή profile. */
function set(over: Partial<BeamDiagram3DSet> = {}): BeamDiagram3DSet {
  return {
    component: 'moment',
    paths: [{
      memberId: 'beam-1',
      start: { xM: 2, yM: 5, zM: 3 },
      end: { xM: 8, yM: 5, zM: 3 },
      samples: [{ f: 0, value: 8 }, { f: 0.5, value: -60 }, { f: 1, value: 8 }],
      extremum: { f: 0.5, value: -60 },
    }],
    globalMaxAbs: 60,
    referenceLengthM: 6,
    reliable: true,
    combinationKind: 'ULS-1',
    ...over,
  };
}

/** Τα pivot sub-groups (ένα ανά δοκάρι) του diagram group. */
function pivots(group: THREE.Group): THREE.Object3D[] {
  return group.children.filter((c) => (c as THREE.Group).isGroup);
}

describe('buildBeamDiagram3DGroup (ADR-483 Slice 6)', () => {
  it('κενό set → null', () => {
    expect(buildBeamDiagram3DGroup(set({ paths: [], globalMaxAbs: 0, referenceLengthM: 0 }))).toBeNull();
    expect(buildBeamDiagram3DGroup(set({ globalMaxAbs: 0 }))).toBeNull();
    expect(buildBeamDiagram3DGroup(set({ referenceLengthM: 0 }))).toBeNull();
  });

  it('έγκυρο set → non-pickable group με 1 pivot/δοκάρι στο 3D μέσο (xM_mid, zM_mid, −yM_mid)', () => {
    const group = buildBeamDiagram3DGroup(set());
    expect(group).not.toBeNull();
    if (!group) return;
    expect(group.name).toBe(BEAM_DIAGRAM_3D_GROUP_NAME);
    expect(typeof group.raycast).toBe('function');
    const ps = pivots(group);
    expect(ps).toHaveLength(1);
    expect(ps[0]!.position.x).toBeCloseTo(5, 6); // (2+8)/2
    expect(ps[0]!.position.y).toBeCloseTo(3, 6); // (3+3)/2 = zM mid
    expect(ps[0]!.position.z).toBeCloseTo(-5, 6); // −(5+5)/2
    const kids = ps[0]!.children;
    expect(kids.some((c) => (c as THREE.Mesh).isMesh)).toBe(true);
    expect(kids.some((c) => (c as THREE.Line).isLine)).toBe(true);
  });

  it('fixed κάθετο επίπεδο — τοπικό +X → κατεύθυνση ανοίγματος, +Y → world up (διαγώνιο δοκάρι)', () => {
    const group = buildBeamDiagram3DGroup(set({ paths: [{
      memberId: 'b', start: { xM: 0, yM: 0, zM: 3 }, end: { xM: 10, yM: 10, zM: 3 },
      samples: [{ f: 0, value: 8 }, { f: 1, value: -8 }], extremum: { f: 0, value: 8 },
    }] }));
    if (!group) return;
    const q = pivots(group)[0]!.quaternion;
    const localX = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    const localY = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    // span world = normalize(Δx, 0, −Δy) = normalize(10,0,−10)
    const expectSpan = new THREE.Vector3(10, 0, -10).normalize();
    expect(localX.dot(expectSpan)).toBeGreaterThan(0.999); // +X κατά μήκος ανοίγματος
    expect(localY.dot(new THREE.Vector3(0, 1, 0))).toBeGreaterThan(0.999); // +Y = world up
  });

  it('ροπή με αλλαγή προσήμου → ΔΥΟ ζώνες (μπλε θετική + κόκκινη αρνητική)', () => {
    const group = buildBeamDiagram3DGroup(set({ component: 'moment' }));
    if (!group) return;
    const fillColors = pivots(group)[0]!.children
      .filter((c) => (c as THREE.Mesh).isMesh)
      .map((m) => ((m as THREE.Mesh).material as THREE.MeshBasicMaterial).color.getHex());
    const unique = new Set(fillColors);
    expect(fillColors.length).toBeGreaterThanOrEqual(2);
    expect(unique.has(MEMBER_DIAGRAM_3D_COLORS.momentPos)).toBe(true); // μπλε (θετική/hogging)
    expect(unique.has(MEMBER_DIAGRAM_3D_COLORS.momentNeg)).toBe(true); // κόκκινο (αρνητική/sagging)
  });

  it('αξονική (N) → μονόχρωμο γέμισμα (καμία T/C ζώνη)', () => {
    const group = buildBeamDiagram3DGroup(set({ component: 'axial', paths: [{
      memberId: 'b', start: { xM: 2, yM: 5, zM: 3 }, end: { xM: 8, yM: 5, zM: 3 },
      samples: [{ f: 0, value: -120 }, { f: 1, value: -130 }], extremum: { f: 1, value: -130 },
    }] }));
    if (!group) return;
    const colors = new Set(pivots(group)[0]!.children.filter((c) => (c as THREE.Mesh).isMesh)
      .map((m) => ((m as THREE.Mesh).material as THREE.MeshBasicMaterial).color.getHex()));
    expect(colors).toEqual(new Set([MEMBER_DIAGRAM_3D_COLORS.axial])); // μόνο μπλε (axial monochrome)
  });

  it('always-on-top — γέμισμα+outline depthTest:false/depthWrite:false + renderOrder (fill < outline)', () => {
    const group = buildBeamDiagram3DGroup(set());
    if (!group) return;
    const kids = pivots(group)[0]!.children;
    const meshes = kids.filter((c) => (c as THREE.Mesh).isMesh) as THREE.Mesh[];
    const line = kids.find((c) => (c as THREE.Line).isLine) as THREE.Line;
    for (const m of meshes) {
      const mat = m.material as THREE.MeshBasicMaterial;
      expect(mat.depthTest).toBe(false);
      expect(mat.depthWrite).toBe(false);
      expect(m.renderOrder).toBe(9990);
    }
    const lineMat = line.material as THREE.LineBasicMaterial;
    expect(lineMat.depthTest).toBe(false);
    expect(lineMat.depthWrite).toBe(false);
    expect(line.renderOrder).toBe(9991);
    expect(meshes[0]!.renderOrder).toBeLessThan(line.renderOrder);
  });

  it('εκφυλισμένο plan μήκος (μηδενικό άνοιγμα) → παραλείπεται', () => {
    const group = buildBeamDiagram3DGroup(set({ paths: [{
      memberId: 'b', start: { xM: 4, yM: 4, zM: 3 }, end: { xM: 4, yM: 4, zM: 3 },
      samples: [{ f: 0, value: 8 }, { f: 1, value: -8 }], extremum: { f: 0, value: 8 },
    }] }));
    expect(group).toBeNull(); // καμία έγκυρη pivot → group null
  });
});

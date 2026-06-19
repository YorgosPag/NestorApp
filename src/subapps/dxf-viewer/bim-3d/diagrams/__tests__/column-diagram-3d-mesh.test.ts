/**
 * Tests — column-diagram-3d-mesh (ADR-483 Slice 5).
 *
 * Structural tests: null για κενό set· ΕΝΑ pivot group ανά κολώνα (plan-σημείο, μέσο ύψος)
 * με fill + line· signed δίχρωμη ροπή / μονόχρωμη N· τοπικές συντεταγμένες κεντραρισμένες
 * κατακόρυφα (axis base στο τοπικό (0, zM−centerY, 0))· always-on-top (depthTest:false +
 * renderOrder)· full-billboard (quaternion κάμερας → ορατό ακόμα κι από nadir).
 * Οι ετικέτες (sprite) παραλείπονται σε node (χωρίς DOM) — by design.
 */

import * as THREE from 'three';
import {
  buildColumnDiagram3DGroup,
  billboardColumnDiagrams,
  COLUMN_DIAGRAM_3D_GROUP_NAME,
  COLUMN_DIAGRAM_PIVOT_FLAG,
  COLUMN_DIAGRAM_COLORS,
} from '../column-diagram-3d-mesh';
import type { ColumnDiagram3DSet } from '../column-diagram-3d-geometry';

function set(over: Partial<ColumnDiagram3DSet> = {}): ColumnDiagram3DSet {
  return {
    component: 'moment',
    paths: [{
      memberId: 'col-1',
      base: { xM: 2, yM: 5, zM: 0 },
      top: { xM: 2, yM: 5, zM: 3 },
      offsetDir: { dxM: 1, dyM: 0 },
      samples: [{ f: 0, value: 10 }, { f: 0.5, value: -40 }, { f: 1, value: 5 }],
      extremum: { f: 0.5, value: -40 },
    }],
    globalMaxAbs: 40,
    referenceLengthM: 3,
    reliable: true,
    combinationKind: 'ULS-1',
    ...over,
  };
}

/** Τα pivot sub-groups (ένα ανά κολώνα) του diagram group. */
function pivots(group: THREE.Group): THREE.Object3D[] {
  return group.children.filter((c) => c.userData[COLUMN_DIAGRAM_PIVOT_FLAG]);
}

describe('buildColumnDiagram3DGroup (ADR-483 Slice 5)', () => {
  it('κενό set → null', () => {
    expect(buildColumnDiagram3DGroup(set({ paths: [], globalMaxAbs: 0, referenceLengthM: 0 }))).toBeNull();
    expect(buildColumnDiagram3DGroup(set({ globalMaxAbs: 0 }))).toBeNull();
    expect(buildColumnDiagram3DGroup(set({ referenceLengthM: 0 }))).toBeNull();
  });

  it('έγκυρο set → non-pickable group με 1 pivot/κολώνα στο plan-σημείο, μέσο ύψος (xM,centerY,−yM)', () => {
    const group = buildColumnDiagram3DGroup(set());
    expect(group).not.toBeNull();
    if (!group) return;
    expect(group.name).toBe(COLUMN_DIAGRAM_3D_GROUP_NAME);
    expect(typeof group.raycast).toBe('function');
    const ps = pivots(group);
    expect(ps).toHaveLength(1);
    expect(ps[0]!.position.x).toBeCloseTo(2, 6);
    expect(ps[0]!.position.y).toBeCloseTo(1.5, 6); // centerY = (zM_base 0 + zM_top 3)/2 → full-billboard origin
    expect(ps[0]!.position.z).toBeCloseTo(-5, 6); // −yM
    // Μέσα στο pivot: fill (Mesh) + outline (Line) (sprite μόνο σε DOM).
    const kids = ps[0]!.children;
    expect(kids.some((c) => (c as THREE.Mesh).isMesh)).toBe(true);
    expect(kids.some((c) => (c as THREE.Line).isLine)).toBe(true);
  });

  it('ροπή με αλλαγή προσήμου → ΔΥΟ ζώνες (μπλε θετική + κόκκινη αρνητική)', () => {
    const group = buildColumnDiagram3DGroup(set({ component: 'moment' }));
    if (!group) return;
    const fillColors = pivots(group)[0]!.children
      .filter((c) => (c as THREE.Mesh).isMesh)
      .map((m) => ((m as THREE.Mesh).material as THREE.MeshBasicMaterial).color.getHex());
    const unique = new Set(fillColors);
    expect(fillColors.length).toBeGreaterThanOrEqual(2);
    expect(unique.has(COLUMN_DIAGRAM_COLORS.momentPos)).toBe(true); // μπλε (θετική/hogging)
    expect(unique.has(COLUMN_DIAGRAM_COLORS.momentNeg)).toBe(true); // κόκκινο (αρνητική/sagging)
  });

  it('αξονική (N) → μονόχρωμο γέμισμα (καμία T/C ζώνη)', () => {
    const group = buildColumnDiagram3DGroup(set({ component: 'axial', paths: [{
      memberId: 'c', base: { xM: 0, yM: 0, zM: 0 }, top: { xM: 0, yM: 0, zM: 3 },
      offsetDir: { dxM: 1, dyM: 0 },
      samples: [{ f: 0, value: -500 }, { f: 1, value: -540 }], extremum: { f: 1, value: -540 },
    }] }));
    if (!group) return;
    const colors = new Set(pivots(group)[0]!.children.filter((c) => (c as THREE.Mesh).isMesh)
      .map((m) => ((m as THREE.Mesh).material as THREE.MeshBasicMaterial).color.getHex()));
    expect(colors).toEqual(new Set([COLUMN_DIAGRAM_COLORS.axial])); // μόνο μπλε (axial monochrome)
  });

  it('τοπικές συντεταγμένες κεντραρισμένες — axis base στο τοπικό (0, zM−centerY, 0)', () => {
    const group = buildColumnDiagram3DGroup(set());
    if (!group) return;
    const line = pivots(group)[0]!.children.find((c) => (c as THREE.Line).isLine) as THREE.Line;
    const pos = line.geometry.getAttribute('position');
    // Πρώτο σημείο outline = axis base ΤΟΠΙΚΑ: (0, zM_base 0 − centerY 1.5 = −1.5, 0).
    // Η world θέση = pivot.position(.y=centerY) + local → επανέρχεται στο σωστό υψόμετρο.
    expect(pos.getX(0)).toBeCloseTo(0, 6);
    expect(pos.getY(0)).toBeCloseTo(-1.5, 6);
    expect(pos.getZ(0)).toBeCloseTo(0, 6);
  });

  it('always-on-top — γέμισμα+outline depthTest:false/depthWrite:false + renderOrder (fill < outline < label)', () => {
    const group = buildColumnDiagram3DGroup(set());
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
    // fill (9990) < outline (9991) < label (10000) — σειρά σχεδίασης overlay.
    expect(meshes[0]!.renderOrder).toBeLessThan(line.renderOrder);
  });
});

describe('billboardColumnDiagrams (ADR-483 Slice 5 — full-billboard)', () => {
  function lookCamera(x: number, y: number, z: number, target: THREE.Vector3): THREE.PerspectiveCamera {
    const cam = new THREE.PerspectiveCamera();
    cam.position.set(x, y, z);
    cam.lookAt(target);
    cam.updateMatrixWorld(true);
    return cam;
  }
  /** Κανονικοποιημένη normal (local +Z) του pivot σε world. */
  function pivotNormal(pivot: THREE.Object3D): THREE.Vector3 {
    return new THREE.Vector3(0, 0, 1).applyQuaternion(pivot.quaternion).normalize();
  }

  it('αντιγράφει το world quaternion της κάμερας στο pivot', () => {
    const group = buildColumnDiagram3DGroup(set());
    if (!group) return;
    const pivot = pivots(group)[0]!;
    const cam = lookCamera(12, 1.5, -5, pivot.position);
    billboardColumnDiagrams(group, cam);
    const camQ = new THREE.Quaternion();
    cam.getWorldQuaternion(camQ);
    expect(pivot.quaternion.angleTo(camQ)).toBeCloseTo(0, 5);
  });

  it('πλάγια όψη — το επίπεδο (local +Z normal) κοιτά πλήρως την κάμερα', () => {
    const group = buildColumnDiagram3DGroup(set());
    if (!group) return;
    const pivot = pivots(group)[0]!;
    const cam = lookCamera(12, 1.5, -5, pivot.position);
    billboardColumnDiagrams(group, cam);
    const toCam = cam.position.clone().sub(pivot.position).normalize();
    expect(pivotNormal(pivot).dot(toCam)).toBeGreaterThan(0.99);
  });

  it('nadir — κάμερα ακριβώς από πάνω → κοιτά πάνω (ορατό, ΟΧΙ edge-on)', () => {
    const group = buildColumnDiagram3DGroup(set());
    if (!group) return;
    const pivot = pivots(group)[0]!;
    const cam = lookCamera(2, 50, -5, pivot.position); // ακριβώς πάνω από το pivot
    billboardColumnDiagrams(group, cam);
    const toCam = cam.position.clone().sub(pivot.position).normalize();
    const normal = pivotNormal(pivot);
    expect(normal.dot(toCam)).toBeGreaterThan(0.99); // κοιτά την κάμερα ακόμα κι από nadir
    expect(normal.y).toBeGreaterThan(0.9); // normal προς τα πάνω → ορατή επιφάνεια, όχι λεπτή γραμμή
  });
});

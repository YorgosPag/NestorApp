/**
 * Tests — column-diagram-3d-mesh (ADR-483 Slice 5).
 *
 * Structural tests: null για κενό set· ΕΝΑ pivot group ανά κολώνα (στο plan-σημείο)
 * με fill + line· signed δίχρωμη ροπή / μονόχρωμη N· τοπικές συντεταγμένες (axis base
 * στο τοπικό (0, zM, 0))· billboard (rotation.y γύρω από κατακόρυφο άξονα προς κάμερα).
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

  it('έγκυρο set → non-pickable group με 1 pivot/κολώνα στο plan-σημείο (xM,0,−yM)', () => {
    const group = buildColumnDiagram3DGroup(set());
    expect(group).not.toBeNull();
    if (!group) return;
    expect(group.name).toBe(COLUMN_DIAGRAM_3D_GROUP_NAME);
    expect(typeof group.raycast).toBe('function');
    const ps = pivots(group);
    expect(ps).toHaveLength(1);
    expect(ps[0]!.position.x).toBeCloseTo(2, 6);
    expect(ps[0]!.position.y).toBeCloseTo(0, 6);
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

  it('τοπικές συντεταγμένες — axis base στο τοπικό (0, zM, 0)', () => {
    const group = buildColumnDiagram3DGroup(set());
    if (!group) return;
    const line = pivots(group)[0]!.children.find((c) => (c as THREE.Line).isLine) as THREE.Line;
    const pos = line.geometry.getAttribute('position');
    // Πρώτο σημείο outline = axis base ΤΟΠΙΚΑ: (0, zM=0, 0). Η world θέση δίνεται από το pivot.
    expect(pos.getX(0)).toBeCloseTo(0, 6);
    expect(pos.getY(0)).toBeCloseTo(0, 6);
    expect(pos.getZ(0)).toBeCloseTo(0, 6);
  });
});

describe('billboardColumnDiagrams (ADR-483 Slice 5 — rotation)', () => {
  function cameraAt(x: number, y: number, z: number): THREE.Camera {
    return { position: new THREE.Vector3(x, y, z) } as THREE.Camera;
  }

  it('στρέφει το pivot γύρω από τον κατακόρυφο άξονα προς την κάμερα (θ=atan2(dx,dz))', () => {
    const group = buildColumnDiagram3DGroup(set());
    if (!group) return;
    // pivot @ (2,0,−5)· κάμερα @ (12,0,−5) → dx=10, dz=0 → θ=atan2(10,0)=π/2.
    billboardColumnDiagrams(group, cameraAt(12, 0, -5));
    expect(pivots(group)[0]!.rotation.y).toBeCloseTo(Math.PI / 2, 5);
    // κάμερα @ (2,0,5) → dx=0, dz=10 → θ=atan2(0,10)=0.
    billboardColumnDiagrams(group, cameraAt(2, 0, 5));
    expect(pivots(group)[0]!.rotation.y).toBeCloseTo(0, 5);
  });

  it('κάμερα πάνω από το pivot (dx=dz=0) → no-op (διατηρεί προηγούμενη γωνία)', () => {
    const group = buildColumnDiagram3DGroup(set());
    if (!group) return;
    pivots(group)[0]!.rotation.y = 1.23;
    billboardColumnDiagrams(group, cameraAt(2, 50, -5)); // ακριβώς πάνω
    expect(pivots(group)[0]!.rotation.y).toBeCloseTo(1.23, 5);
  });
});

/**
 * Tests — column-diagram-3d-mesh (ADR-483 Slice 5).
 *
 * Light structural tests: null για κενό set, group με children + non-pickable + σωστό
 * όνομα για έγκυρο set, world mapping (analytical xM,yM,zM → three x,y,z = East,Up,−North).
 * Οι ετικέτες (sprite) παραλείπονται σε node (χωρίς DOM) — by design.
 */

import * as THREE from 'three';
import { buildColumnDiagram3DGroup, COLUMN_DIAGRAM_3D_GROUP_NAME, COLUMN_DIAGRAM_COLORS } from '../column-diagram-3d-mesh';
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

describe('buildColumnDiagram3DGroup (ADR-483 Slice 5)', () => {
  it('κενό set → null', () => {
    expect(buildColumnDiagram3DGroup(set({ paths: [], globalMaxAbs: 0, referenceLengthM: 0 }))).toBeNull();
    expect(buildColumnDiagram3DGroup(set({ globalMaxAbs: 0 }))).toBeNull();
    expect(buildColumnDiagram3DGroup(set({ referenceLengthM: 0 }))).toBeNull();
  });

  it('έγκυρο set → non-pickable group με fill + line (sprite μόνο σε DOM)', () => {
    const group = buildColumnDiagram3DGroup(set());
    expect(group).not.toBeNull();
    if (!group) return;
    expect(group.name).toBe(COLUMN_DIAGRAM_3D_GROUP_NAME);
    expect(typeof group.raycast).toBe('function');
    // fill (Mesh) + outline (Line) ανά κολώνα (χωρίς sprite σε node).
    expect(group.children.some((c) => (c as THREE.Mesh).isMesh)).toBe(true);
    expect(group.children.some((c) => (c as THREE.Line).isLine)).toBe(true);
  });

  it('ροπή με αλλαγή προσήμου → ΔΥΟ ζώνες (μπλε θετική + κόκκινη αρνητική), όχι μονόχρωμο', () => {
    // samples 10 → −40 → 5: θετική + αρνητική ζώνη → 2 fill meshes διαφορετικού χρώματος.
    const group = buildColumnDiagram3DGroup(set({ component: 'moment' }));
    if (!group) return;
    const fillColors = group.children
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
    const colors = new Set(group.children.filter((c) => (c as THREE.Mesh).isMesh)
      .map((m) => ((m as THREE.Mesh).material as THREE.MeshBasicMaterial).color.getHex()));
    expect(colors).toEqual(new Set([COLUMN_DIAGRAM_COLORS.axial])); // μόνο μπλε (axial monochrome)
  });

  it('world mapping — base κορυφή στο (xM, zM, −yM)', () => {
    const group = buildColumnDiagram3DGroup(set());
    if (!group) return;
    const line = group.children.find((c) => (c as THREE.Line).isLine) as THREE.Line;
    const pos = line.geometry.getAttribute('position');
    // Πρώτο σημείο outline = axis base: world (x=xM=2, y=zM=0, z=−yM=−5).
    expect(pos.getX(0)).toBeCloseTo(2, 6);
    expect(pos.getY(0)).toBeCloseTo(0, 6);
    expect(pos.getZ(0)).toBeCloseTo(-5, 6);
  });
});

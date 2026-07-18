/**
 * ADR-668 §4.7 — regression lock: το OBJ/mesh3d export δεν κουβαλά screen-space σκουπίδια.
 *
 * Bug (C4D R15): κάθε τοίχος/κολώνα βγήκε ΔΥΟ φορές — το σώμα + ένα εκφυλισμένο συμπίπτον δίδυμο
 * (`…_2`, Size Z=0). Ρίζα: `LineSegments2 extends Mesh`, οπότε τα BIM edge overlays (ADR-375,
 * `mesh.add(overlay)`, tagged `userData.bimEdgeOverlay`) περνούν το `isMesh` φίλτρο ΚΑΙ στους three
 * serialisers. Το `stripExportDecorations` τα αφαιρεί πριν τη σειριοποίηση.
 */

import * as THREE from 'three';
import { stripExportDecorations } from '../mesh3d-decorations';

/** A real BIM body mesh (kept). */
function solid(bimId: string): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
  m.userData = { bimId, bimType: 'wall' };
  return m;
}

/** A BIM edge overlay — LineSegments2 in production; here a mesh carrying the same marker. */
function edgeOverlay(): THREE.Mesh {
  const o = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
  o.userData = { bimEdgeOverlay: true };
  return o;
}

describe('stripExportDecorations — ADR-668 §4.7', () => {
  it('removes the edge overlay attached to a solid, keeps the solid body', () => {
    const root = new THREE.Group();
    const wall = solid('w-1');
    wall.add(edgeOverlay());
    root.add(wall);

    const removed = stripExportDecorations(root);

    expect(removed).toBe(1);
    expect(root.children).toContain(wall);   // body survives
    expect(wall.children).toHaveLength(0);   // its decoration twin is gone
  });

  it('removes line-primitive decorations by their three flag (isLineSegments2)', () => {
    const root = new THREE.Group();
    const line = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
    (line as unknown as { isLineSegments2: boolean }).isLineSegments2 = true;
    root.add(solid('w-1'), line);

    expect(stripExportDecorations(root)).toBe(1);
    expect(root.children.some((c) => (c as { isLineSegments2?: boolean }).isLineSegments2)).toBe(false);
  });

  it('leaves a clean solid-only tree untouched', () => {
    const root = new THREE.Group();
    root.add(solid('w-1'), solid('c-1'));

    expect(stripExportDecorations(root)).toBe(0);
    expect(root.children).toHaveLength(2);
  });

  it('disposes removed decoration geometry (releases the resolution-store subscription)', () => {
    const root = new THREE.Group();
    const overlay = edgeOverlay();
    const disposeSpy = jest.spyOn(overlay.geometry, 'dispose');
    root.add(overlay);

    stripExportDecorations(root);

    expect(disposeSpy).toHaveBeenCalledTimes(1);
  });
});

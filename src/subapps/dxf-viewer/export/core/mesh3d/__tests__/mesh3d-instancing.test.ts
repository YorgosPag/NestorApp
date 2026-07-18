/**
 * ADR-668 §4.8 — ο οπλισμός (InstancedMesh) εξάγεται σωστά, όχι ως ένας κύλινδρος στο origin.
 *
 * Ρίζα: ο three `OBJExporter` δεν επεκτείνει instances. Ο `buildRods` (ADR-463) χτίζει τον κλωβό
 * ως `InstancedMesh` (N ράβδοι = N instance matrices). `bakeInstancedMeshesForExport` τον ψήνει σε
 * ΕΝΑ merged `Mesh` πριν τη σειριοποίηση, κρατώντας ταυτότητα + υλικό + τοπικό transform.
 */

import * as THREE from 'three';
import { bakeInstancedMeshesForExport } from '../mesh3d-instancing';

/** N instances ενός unit box, μετατοπισμένα κατά x=i·10 (crimson = χρώμα οπλισμού). */
function makeInstanced(count: number, userData: Record<string, unknown>): THREE.InstancedMesh {
  const inst = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ color: 0xdc143c }),
    count,
  );
  const m = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    m.makeTranslation(i * 10, 0, 0);
    inst.setMatrixAt(i, m);
  }
  inst.instanceMatrix.needsUpdate = true;
  inst.userData = userData;
  return inst;
}

describe('bakeInstancedMeshesForExport — ADR-668 §4.8', () => {
  it('replaces an InstancedMesh with a single plain Mesh carrying every instance', () => {
    const root = new THREE.Group();
    root.add(makeInstanced(3, { bimId: 'col-1', bimType: 'column' }));

    const baked = bakeInstancedMeshesForExport(root);

    expect(baked).toBe(1);
    expect(root.children).toHaveLength(1);
    const mesh = root.children[0] as THREE.Mesh;
    expect(mesh.isMesh).toBe(true);
    expect((mesh as THREE.InstancedMesh).isInstancedMesh).not.toBe(true);
    // Η merged γεωμετρία κουβαλά 3× τα vertices της base (όλες οι ράβδοι, όχι μία).
    const baseCount = new THREE.BoxGeometry(1, 1, 1).attributes['position']!.count;
    expect(mesh.geometry.attributes['position']!.count).toBe(baseCount * 3);
  });

  it('preserves identity userData + material so naming/colour survive downstream', () => {
    const root = new THREE.Group();
    root.add(makeInstanced(2, { bimId: 'col-1', bimType: 'column' }));

    bakeInstancedMeshesForExport(root);

    const mesh = root.children[0] as THREE.Mesh;
    expect(mesh.userData).toEqual({ bimId: 'col-1', bimType: 'column' });
    expect((mesh.material as THREE.MeshBasicMaterial).color.getHex()).toBe(0xdc143c);
  });

  it('bakes the instance transforms into the geometry (real spread, not one bar at origin)', () => {
    const root = new THREE.Group();
    root.add(makeInstanced(2, {})); // instance 0 @ x=0, instance 1 @ x=10

    bakeInstancedMeshesForExport(root);

    const mesh = root.children[0] as THREE.Mesh;
    mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox!;
    expect(bb.min.x).toBeCloseTo(-0.5); // αριστερή παρειά του instance 0
    expect(bb.max.x).toBeCloseTo(10.5); // δεξιά παρειά του instance 1
  });

  it('leaves a tree with no InstancedMesh untouched', () => {
    const root = new THREE.Group();
    const plain = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
    root.add(plain);

    expect(bakeInstancedMeshesForExport(root)).toBe(0);
    expect(root.children[0]).toBe(plain);
  });
});

/**
 * ADR-686 — mesh-normals-ensure: lit υλικό σε partner mesh χωρίς normals απέδιδε ΜΑΥΡΟ.
 * Ο helper υπολογίζει normals if-missing, σεβόμενος authored normals.
 */

import * as THREE from 'three';
import { ensureMeshVertexNormals } from '../mesh-normals-ensure';

/** Non-indexed triangle geometry ΧΩΡΙΣ normal attribute (μιμείται glTF χωρίς NORMAL). */
function triangleWithoutNormals(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3),
  );
  return g;
}

describe('ensureMeshVertexNormals', () => {
  it('computes normals for a mesh that has none', () => {
    const mesh = new THREE.Mesh(triangleWithoutNormals(), new THREE.MeshStandardMaterial());
    expect(mesh.geometry.getAttribute('normal')).toBeUndefined();

    ensureMeshVertexNormals(mesh);

    const normal = mesh.geometry.getAttribute('normal');
    expect(normal).toBeDefined();
    // Επίπεδο τρίγωνο στο z=0 → normal κάθετη στον άξονα Z (μη-μηδενική → φωτίζεται).
    expect(normal!.count).toBe(3);
    expect(Math.abs(normal!.getZ(0))).toBeCloseTo(1);
  });

  it('leaves authored normals untouched (same attribute reference)', () => {
    const geometry = triangleWithoutNormals();
    geometry.setAttribute(
      'normal',
      new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3),
    );
    const authored = geometry.getAttribute('normal');
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());

    ensureMeshVertexNormals(mesh);

    expect(mesh.geometry.getAttribute('normal')).toBe(authored);
  });

  it('traverses nested children and skips non-mesh / geometry-less nodes', () => {
    const root = new THREE.Group();
    root.add(new THREE.Object3D()); // non-mesh — αγνοείται
    const nested = new THREE.Group();
    const mesh = new THREE.Mesh(triangleWithoutNormals(), new THREE.MeshStandardMaterial());
    nested.add(mesh);
    root.add(nested);

    expect(() => ensureMeshVertexNormals(root)).not.toThrow();
    expect(mesh.geometry.getAttribute('normal')).toBeDefined();
  });

  it('is idempotent — a second pass is a no-op on the computed normals', () => {
    const mesh = new THREE.Mesh(triangleWithoutNormals(), new THREE.MeshStandardMaterial());
    ensureMeshVertexNormals(mesh);
    const first = mesh.geometry.getAttribute('normal');

    ensureMeshVertexNormals(mesh);

    expect(mesh.geometry.getAttribute('normal')).toBe(first);
  });
});

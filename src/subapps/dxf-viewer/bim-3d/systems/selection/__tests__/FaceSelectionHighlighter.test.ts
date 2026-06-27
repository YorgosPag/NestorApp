/**
 * ADR-539 Φ4b — FaceSelectionHighlighter multi-face overlays.
 * `setTargets` attaches ONE translucent overlay sub-mesh per selected face (slice of the
 * faced mesh group range), `setTarget` is the single-face convenience, and dispose/clear
 * release every overlay (no leak). Reuses the faced-mesh shape
 * (`faceKeyByMaterialIndex` + geometry groups) the converters produce.
 */

import * as THREE from 'three';
import { FaceSelectionHighlighter } from '../FaceSelectionHighlighter';

/** A faced mesh: one geometry group (3 verts) per faceKey, mirror the prism converter. */
function facedMesh(bimId: string, faceKeys: readonly string[]): THREE.Mesh {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(faceKeys.length * 3 * 3); // 3 verts × 3 comps per face
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  faceKeys.forEach((_, i) => geo.addGroup(i * 3, 3, i));
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
  mesh.userData['bimId'] = bimId;
  mesh.userData['faceKeyByMaterialIndex'] = faceKeys;
  return mesh;
}

/** Overlays are added as children of the faced mesh → count them there. */
const overlayCount = (mesh: THREE.Mesh) => mesh.children.length;

describe('FaceSelectionHighlighter — multi-face overlays', () => {
  it('setTargets attaches one overlay per face, cross-entity', () => {
    const group = new THREE.Group();
    const a = facedMesh('a', ['top', 'bottom']);
    const b = facedMesh('b', ['top']);
    group.add(a, b);
    const h = new FaceSelectionHighlighter(group);

    h.setTargets([{ bimId: 'a', faceKey: 'top' }, { bimId: 'b', faceKey: 'top' }]);

    expect(overlayCount(a)).toBe(1);
    expect(overlayCount(b)).toBe(1);
  });

  it('setTargets attaches multiple overlays on the same entity', () => {
    const group = new THREE.Group();
    const a = facedMesh('a', ['top', 'bottom']);
    group.add(a);
    const h = new FaceSelectionHighlighter(group);

    h.setTargets([{ bimId: 'a', faceKey: 'top' }, { bimId: 'a', faceKey: 'bottom' }]);

    expect(overlayCount(a)).toBe(2);
  });

  it('setTargets([]) clears every overlay', () => {
    const group = new THREE.Group();
    const a = facedMesh('a', ['top']);
    group.add(a);
    const h = new FaceSelectionHighlighter(group);

    h.setTargets([{ bimId: 'a', faceKey: 'top' }]);
    h.setTargets([]);

    expect(overlayCount(a)).toBe(0);
  });

  it('overlays are non-pickable (raycast suppressed)', () => {
    const group = new THREE.Group();
    const a = facedMesh('a', ['top']);
    group.add(a);
    const h = new FaceSelectionHighlighter(group);

    h.setTargets([{ bimId: 'a', faceKey: 'top' }]);
    const overlay = a.children[0] as THREE.Mesh;
    const hits: THREE.Intersection[] = [];
    overlay.raycast(new THREE.Raycaster(), hits);
    expect(hits).toHaveLength(0);
  });

  it('ignores unknown faces and missing meshes (no overlay, no throw)', () => {
    const group = new THREE.Group();
    const a = facedMesh('a', ['top']);
    group.add(a);
    const h = new FaceSelectionHighlighter(group);

    h.setTargets([{ bimId: 'a', faceKey: 'ghost' }, { bimId: 'missing', faceKey: 'top' }]);

    expect(overlayCount(a)).toBe(0);
  });

  it('setTarget is the single-face convenience; null clears', () => {
    const group = new THREE.Group();
    const a = facedMesh('a', ['top']);
    group.add(a);
    const h = new FaceSelectionHighlighter(group);

    h.setTarget('a', 'top');
    expect(overlayCount(a)).toBe(1);
    h.setTarget(null, null);
    expect(overlayCount(a)).toBe(0);
  });

  it('dispose releases all overlays', () => {
    const group = new THREE.Group();
    const a = facedMesh('a', ['top', 'bottom']);
    group.add(a);
    const h = new FaceSelectionHighlighter(group);

    h.setTargets([{ bimId: 'a', faceKey: 'top' }, { bimId: 'a', faceKey: 'bottom' }]);
    h.dispose();

    expect(overlayCount(a)).toBe(0);
  });
});

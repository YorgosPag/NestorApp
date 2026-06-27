/**
 * FaceSelectionHighlighter — ADR-539 (Cinema 4D «Polygon Mode» face highlight).
 *
 * Translucent overlay πάνω στην ΕΠΙΛΕΓΜΕΝΗ όψη ενός faced solid. Το `SelectionOutlinePass`
 * είναι per-object silhouette → δεν κάνει για μία όψη· εδώ χτίζουμε ένα μικρό overlay
 * sub-mesh από το vertex range του αντίστοιχου geometry group (`materialIndex` ↔ `FaceKey`).
 *
 * Το overlay προσαρτάται ΩΣ ΠΑΙΔΙ του target mesh → κληρονομεί αυτόματα το transform του
 * (position.y κ.λπ.), είναι non-pickable, και με `polygonOffset` αποφεύγει το z-fighting.
 * Στο rebuild της σκηνής το mesh ξαναφτιάχνεται, οπότε ο caller καλεί `refresh()` (μετά το
 * sync) για να ξαναδέσει το overlay στο νέο mesh — ο highlighter κρατά το δικό του target.
 *
 * @see bim-3d/converters/bim-three-faced-prism.ts — groups + faceKeyByMaterialIndex
 * @see docs/centralized-systems/reference/adrs/ADR-539-cinema4d-polygon-mode-per-face-appearance.md
 */

import * as THREE from 'three';

/** Vertex range (non-indexed) του group που αντιστοιχεί στο faceKey, ή null. */
function faceGroupRange(mesh: THREE.Mesh, faceKey: string): { start: number; count: number } | null {
  const faceKeys = mesh.userData['faceKeyByMaterialIndex'] as readonly string[] | undefined;
  if (!faceKeys) return null;
  const materialIndex = faceKeys.indexOf(faceKey);
  if (materialIndex < 0) return null;
  const group = mesh.geometry.groups.find((g) => g.materialIndex === materialIndex);
  return group ? { start: group.start, count: group.count } : null;
}

/** Νέο BufferGeometry με τα positions του [start, start+count) (non-indexed). */
function sliceFaceGeometry(geometry: THREE.BufferGeometry, start: number, count: number): THREE.BufferGeometry | null {
  const pos = geometry.getAttribute('position');
  if (!pos || start + count > pos.count) return null;
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    out[i * 3] = pos.getX(start + i);
    out[i * 3 + 1] = pos.getY(start + i);
    out[i * 3 + 2] = pos.getZ(start + i);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(out, 3));
  return geo;
}

export class FaceSelectionHighlighter {
  private readonly bimGroup: THREE.Group;
  private readonly material: THREE.MeshBasicMaterial;
  private overlay: THREE.Mesh | null = null;
  private targetBimId: string | null = null;
  private targetFaceKey: string | null = null;

  /**
   * @param color overlay χρώμα — default μπλε `0x2ea1ff` (selection)· ADR-539 Φ2 hover
   *   instance περνά κίτρινο `0xffd400` (mirror ADR-538 hover) με χαμηλότερο opacity.
   * @param opacity overlay opacity (default 0.4).
   */
  constructor(bimGroup: THREE.Group, color = 0x2ea1ff, opacity = 0.4) {
    this.bimGroup = bimGroup;
    this.material = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity, depthWrite: false,
      side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    });
  }

  /** Set/clear the highlighted face. `null` bimId or faceKey clears the overlay. */
  setTarget(bimId: string | null, faceKey: string | null): void {
    this.targetBimId = bimId;
    this.targetFaceKey = faceKey;
    this.rebuild();
  }

  /** Re-attach the overlay after a scene rebuild (the faced mesh was recreated). */
  refresh(): void {
    if (this.targetBimId && this.targetFaceKey) this.rebuild();
  }

  private clearOverlay(): void {
    if (!this.overlay) return;
    this.overlay.parent?.remove(this.overlay);
    this.overlay.geometry.dispose();
    this.overlay = null;
  }

  private rebuild(): void {
    this.clearOverlay();
    if (!this.targetBimId || !this.targetFaceKey) return;
    const mesh = this.findFacedMesh(this.targetBimId);
    if (!mesh) return;
    const range = faceGroupRange(mesh, this.targetFaceKey);
    if (!range) return;
    const geo = sliceFaceGeometry(mesh.geometry, range.start, range.count);
    if (!geo) return;
    const overlay = new THREE.Mesh(geo, this.material);
    overlay.raycast = () => undefined; // non-pickable
    overlay.renderOrder = 999;
    mesh.add(overlay); // inherit the target mesh transform (position.y etc.)
    this.overlay = overlay;
  }

  private findFacedMesh(bimId: string): THREE.Mesh | null {
    let found: THREE.Mesh | null = null;
    this.bimGroup.traverse((o) => {
      if (found) return;
      const m = o as THREE.Mesh;
      if (m.isMesh && o.userData['bimId'] === bimId && o.userData['faceKeyByMaterialIndex']) found = m;
    });
    return found;
  }

  dispose(): void {
    this.clearOverlay();
    this.material.dispose();
  }
}

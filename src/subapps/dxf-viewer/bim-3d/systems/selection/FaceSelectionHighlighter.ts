/**
 * FaceSelectionHighlighter — ADR-539 (Cinema 4D «Polygon Mode» face highlight).
 *
 * Translucent overlays πάνω στις ΕΠΙΛΕΓΜΕΝΕΣ όψεις faced solids. Το `SelectionOutlinePass`
 * είναι per-object silhouette → δεν κάνει για μία όψη· εδώ χτίζουμε ένα μικρό overlay
 * sub-mesh ανά όψη από το vertex range του αντίστοιχου geometry group (`materialIndex` ↔ `FaceKey`).
 *
 * Φ4b — multi-face select (Cinema 4D Polygon Mode): ο selection highlighter κρατά **N**
 * overlays (`setTargets`)· ο hover highlighter μένει single (`setTarget` = convenience).
 *
 * Κάθε overlay προσαρτάται ΩΣ ΠΑΙΔΙ του target mesh → κληρονομεί αυτόματα το transform του
 * (position.y κ.λπ.), είναι non-pickable, και με `polygonOffset` αποφεύγει το z-fighting.
 * Στο rebuild της σκηνής τα meshes ξαναφτιάχνονται, οπότε ο caller καλεί `refresh()` (μετά το
 * sync) για να ξαναδέσει τα overlays στα νέα meshes — ο highlighter κρατά τα δικά του targets.
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

/** Στόχος όψης highlight: ποιο solid + ποια όψη. */
interface FaceTarget {
  readonly bimId: string;
  readonly faceKey: string;
}

export class FaceSelectionHighlighter {
  private readonly bimGroup: THREE.Group;
  private readonly material: THREE.MeshBasicMaterial;
  private overlays: THREE.Mesh[] = [];
  private targets: readonly FaceTarget[] = [];

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

  /**
   * Set/clear ΟΛΕΣ τις highlighted όψεις (Φ4b multi-face). Άκυρα targets (κενό bimId/faceKey)
   * αγνοούνται· κενό array καθαρίζει όλα τα overlays.
   */
  setTargets(faces: readonly FaceTarget[]): void {
    this.targets = faces.filter((f) => f.bimId && f.faceKey);
    this.rebuild();
  }

  /** Convenience single-face set (hover + context-menu/drag-drop). `null` καθαρίζει. */
  setTarget(bimId: string | null, faceKey: string | null): void {
    this.setTargets(bimId && faceKey ? [{ bimId, faceKey }] : []);
  }

  /** Re-attach τα overlays μετά από scene rebuild (τα faced meshes ξαναφτιάχτηκαν). */
  refresh(): void {
    if (this.targets.length > 0) this.rebuild();
  }

  private clearOverlays(): void {
    for (const overlay of this.overlays) {
      overlay.parent?.remove(overlay);
      overlay.geometry.dispose();
    }
    this.overlays = [];
  }

  private rebuild(): void {
    this.clearOverlays();
    for (const target of this.targets) {
      const overlay = this.buildOverlay(target);
      if (overlay) this.overlays.push(overlay);
    }
  }

  /** Χτίζει ΕΝΑ overlay sub-mesh για μία όψη (slice του group range), ή null αν δεν βρεθεί. */
  private buildOverlay(target: FaceTarget): THREE.Mesh | null {
    const mesh = this.findFacedMesh(target.bimId);
    if (!mesh) return null;
    const range = faceGroupRange(mesh, target.faceKey);
    if (!range) return null;
    const geo = sliceFaceGeometry(mesh.geometry, range.start, range.count);
    if (!geo) return null;
    const overlay = new THREE.Mesh(geo, this.material);
    overlay.raycast = () => undefined; // non-pickable
    overlay.renderOrder = 999;
    mesh.add(overlay); // inherit the target mesh transform (position.y etc.)
    return overlay;
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
    this.clearOverlays();
    this.material.dispose();
  }
}

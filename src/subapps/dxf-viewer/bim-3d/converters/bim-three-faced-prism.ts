/**
 * bim-three-faced-prism — ADR-539. Shared per-face prism builder (Cinema 4D
 * «Polygon Mode»). Γενίκευση του ρητού roof index (`roof-to-three.ts buildPrismIndex`):
 * χτίζει ΕΝΑ `BufferGeometry` με `addGroup()` ανά όψη + multi-material support, ώστε
 * κάθε παρειά (πάνω/κάτω/κάθε περιμετρική πλευρά) να μπορεί να βαφεί ξεχωριστά με δικό
 * της material — ΟΧΙ ξεχωριστά meshes (ένα mesh, ένα draw-call ανά material group,
 * trivial raycast με `face.materialIndex`).
 *
 * materialIndex ↔ FaceKey (ντετερμινιστικό SSoT, κοινό για raycast + highlight + paint):
 *   0 = `bottom`, 1 = `top`, 2+i = `side:i` (ακμή i του outline, `j=(i+1)%n`).
 *
 * Trade-off (ADR-539 Φ1): καθαρό prism ΧΩΡΙΣ holes/openings — `triangulateShape(contour, [])`.
 * Slab-openings/holes = Φ2. Ένα prism = ένα solid, μηδέν UV (flat-colour faces).
 *
 * @see roof-to-three.ts `buildPrismIndex` — το πρότυπο (proven winding· migration Φ3)
 * @see bim/types/face-appearance-types.ts — FaceKey SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-539-cinema4d-polygon-mode-per-face-appearance.md
 */

import * as THREE from 'three';
import type { FaceKey } from '../../bim/types/face-appearance-types';

/** Αποτέλεσμα: geometry με per-face groups + ο πίνακας materialIndex → FaceKey. */
export interface FacedPrism {
  readonly geometry: THREE.BufferGeometry;
  /** index `m` = ο FaceKey της όψης που ζωγραφίζεται με `material[m]`. */
  readonly faceKeyByMaterialIndex: readonly FaceKey[];
}

/** Pack 2n θέσεις: [0..n) top ring, [n..2n) bottom ring (mirror `roof-to-three`). */
function packRingPositions(top: readonly THREE.Vector3[], bot: readonly THREE.Vector3[]): Float32Array {
  const n = top.length;
  const positions = new Float32Array(2 * n * 3);
  for (let i = 0; i < n; i++) {
    positions[i * 3] = top[i].x; positions[i * 3 + 1] = top[i].y; positions[i * 3 + 2] = top[i].z;
    positions[(n + i) * 3] = bot[i].x; positions[(n + i) * 3 + 1] = bot[i].y; positions[(n + i) * 3 + 2] = bot[i].z;
  }
  return positions;
}

/**
 * Δείκτες τριγώνων + per-face group ranges. Σειρά (ώστε τα group offsets να είναι
 * ντετερμινιστικά): ΟΛΑ τα bottom-cap τρίγωνα → top-cap → ανά πλευρά 2 τρίγωνα.
 * Winding: mirror του proven `roof-to-three.ts` (bottom reversed, top direct).
 */
function buildFacedIndex(n: number, contour2d: readonly THREE.Vector2[]): {
  index: number[];
  groups: readonly { start: number; count: number; materialIndex: number }[];
  faceKeyByMaterialIndex: FaceKey[];
} {
  const tris = THREE.ShapeUtils.triangulateShape([...contour2d], []);
  const index: number[] = [];
  for (const [a, b, c] of tris) index.push(n + a, n + c, n + b); // bottom cap (reversed)
  for (const [a, b, c] of tris) index.push(a, b, c); // top cap (direct)
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    index.push(n + i, n + j, j);
    index.push(n + i, j, i);
  }
  const capLen = tris.length * 3;
  const faceKeyByMaterialIndex: FaceKey[] = ['bottom', 'top'];
  const groups = [
    { start: 0, count: capLen, materialIndex: 0 },        // bottom
    { start: capLen, count: capLen, materialIndex: 1 },   // top
  ];
  for (let i = 0; i < n; i++) {
    groups.push({ start: 2 * capLen + i * 6, count: 6, materialIndex: 2 + i });
    faceKeyByMaterialIndex.push(`side:${i}`);
  }
  return { index, groups, faceKeyByMaterialIndex };
}

/**
 * Χτίζει το faced prism από ένα top ring (world-space Vector3, +Y cap) με κατακόρυφο
 * πάχος `depthM` (το bottom ring = top μετατοπισμένο κατά −depthM στον Y). Επιστρέφει
 * non-indexed geometry (per-face flat normals) με groups + `faceKeyByMaterialIndex`.
 * Επιστρέφει `null` για degenerate outline (<3 vertices).
 *
 * Το contour τριγωνοποιείται στο (x, z) plan-plane (όπως roof-to-three: world z = −North).
 */
export function buildFacedPrism(topRing: readonly THREE.Vector3[], depthM: number): FacedPrism | null {
  const n = topRing.length;
  if (n < 3) return null;

  const bot = topRing.map((p) => new THREE.Vector3(p.x, p.y - depthM, p.z));
  const contour2d = topRing.map((p) => new THREE.Vector2(p.x, p.z));
  const { index, groups, faceKeyByMaterialIndex } = buildFacedIndex(n, contour2d);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(packRingPositions(topRing, bot), 3));
  geo.setIndex(index);
  for (const g of groups) geo.addGroup(g.start, g.count, g.materialIndex);

  // toNonIndexed → per-face flat normals (mirror column-piece-geometry / roof). Groups
  // are preserved (start/count map 1:1 from index-space to the expanded vertex array).
  const flat = geo.toNonIndexed();
  flat.computeVertexNormals();
  geo.dispose();
  return { geometry: flat, faceKeyByMaterialIndex };
}

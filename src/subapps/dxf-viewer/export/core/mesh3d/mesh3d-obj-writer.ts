/**
 * mesh3d-obj-writer — ADR-668/678 Φ3.1. **Group-aware** Wavefront OBJ writer.
 *
 * **Γιατί δικός μας, ΟΧΙ ο stock `OBJExporter`:** ο three `OBJExporter.parseMesh`
 * (`node_modules/.../OBJExporter.js`) διαβάζει **ΜΟΝΟ** `mesh.material.name` (μία γραμμή) — όταν το
 * `mesh.material` είναι **array** (per-face βαφή, ADR-539: ένα material group ανά όψη), το `.name`
 * είναι `undefined` ⇒ γράφει **κανένα** `usemtl` και **αγνοεί εντελώς** τα `geometry.groups`. Το
 * OBJ έβγαινε άχρωμο-ανά-όψη.
 *
 * Οι μεγάλοι (Blender / Cinema 4D / Maya) γράφουν **ΕΝΑ `o <object>`** με **πολλά `usemtl` blocks**
 * — ένα ανά material group, πριν τα `f` του group (το Wavefront format το υποστηρίζει). Αυτός ο
 * writer αναπαράγει **ακριβώς** αυτό το σχήμα: το στοιχείο μένει ΕΝΑ αντικείμενο (ο import κρατά
 * το «ένα object = ένα στοιχείο» συμβόλαιο, ADR-678), αλλά κάθε όψη παίρνει το δικό της `usemtl`.
 *
 * **Ταυτότητα εξόδου με τον stock:** για **single-material** mesh η έξοδος είναι byte-for-byte ίδια
 * με τον `OBJExporter` (ίδια σειρά `o`/`usemtl`/`v`/`vt`/`vn`/`f`, ίδιο face-token format) — μηδέν
 * regression στα υπάρχοντα OBJ exports. Η μόνη διαφορά είναι στο multi-material, όπου ο stock δεν
 * έγραφε τίποτα ούτως ή άλλως.
 *
 * **Το δέντρο export = meshes-only** στο serialise time (τα decorations αφαιρούνται —
 * `mesh3d-decorations.ts`· τα `InstancedMesh` ψήνονται σε meshes — `mesh3d-instancing.ts`). Άρα ο
 * writer χειρίζεται `Mesh` κόμβους· `Line`/`Points` δεν φτάνουν ποτέ εδώ.
 *
 * @see ./mesh3d-materials — `assignExportMaterials` (ονοματίζει τα per-face array υλικά, ADR-678 Φ3)
 * @see ../../../bim-3d/converters/bim-three-faced-prism — `buildFacedIndex` (σειρά groups = σειρά όψεων)
 * @see docs/centralized-systems/reference/adrs/ADR-668-mesh3d-export-obj-gltf.md
 */

import * as THREE from 'three';

/** Παγκόσμιοι running δείκτες κορυφών/uv/normals (τα `f` δείχνουν σε θέσεις ΟΛΟΥ του αρχείου). */
interface ObjIndexBase {
  v: number;
  vt: number;
  vn: number;
}

/**
 * Το token μιας κορυφής μέσα σε `f` — ίδιο format με `OBJExporter.js`:
 * `v` (μόνο) · `v/vt` (uv) · `v//vn` (normals) · `v/vt/vn` (και τα δύο).
 */
function faceVertexToken(v: number, vt: number, vn: number, hasUv: boolean, hasNormal: boolean): string {
  if (!hasUv && !hasNormal) return `${v}`;
  const uvPart = hasUv ? `${vt}` : '';
  const normalPart = hasNormal ? `/${vn}` : '';
  return `${v}/${uvPart}${normalPart}`;
}

/**
 * Γράφει τα `f` ενός εύρους τριγώνων `[triStart, triEnd)`. Χειρίζεται indexed **και** non-indexed
 * γεωμετρία (τα faced prisms είναι non-indexed — `toNonIndexed()`). Οι δείκτες είναι 1-based και
 * μετατοπισμένοι κατά τους παγκόσμιους `base` (κάθε `f` δείχνει σε θέση όλου του αρχείου).
 */
function writeFaceRange(
  geometry: THREE.BufferGeometry,
  base: ObjIndexBase,
  hasUv: boolean,
  hasNormal: boolean,
  triStart: number,
  triEnd: number,
  out: string[],
): void {
  const index = geometry.getIndex();
  for (let t = triStart; t < triEnd; t += 1) {
    const tokens: string[] = [];
    for (let m = 0; m < 3; m += 1) {
      const local = index !== null ? index.getX(t * 3 + m) : t * 3 + m;
      const j = local + 1;
      tokens.push(faceVertexToken(base.v + j, base.vt + j, base.vn + j, hasUv, hasNormal));
    }
    out.push(`f ${tokens.join(' ')}`);
  }
}

/** Πλήθος τριγώνων: index length / 3 (indexed) ή position count / 3 (non-indexed). */
function triangleCount(geometry: THREE.BufferGeometry): number {
  const index = geometry.getIndex();
  if (index !== null) return Math.floor(index.count / 3);
  const positions = geometry.getAttribute('position');
  return positions !== undefined ? Math.floor(positions.count / 3) : 0;
}

/**
 * Ένα mesh → OBJ. **Multi-material + groups** (per-face): ΕΝΑ `usemtl` ανά group, στη σειρά των
 * `geometry.groups` (= σειρά όψεων του `buildFacedIndex`: bottom, top, side:i, hole:h:k) — έτσι το
 * χρώμα κάθε όψης ταξιδεύει σωστά. **Single-material**: `usemtl` αμέσως μετά το `o` (byte-identical
 * με τον stock). Άβαφο/ανώνυμο υλικό → κανένα `usemtl` (η όψη κληρονομεί το τρέχον, όπως ο stock).
 */
function writeMesh(mesh: THREE.Mesh, base: ObjIndexBase, out: string[]): void {
  const geometry = mesh.geometry;
  const material = mesh.material;
  const isMultiMaterial = Array.isArray(material) && geometry.groups.length > 0;

  out.push(`o ${mesh.name}`);
  // Single-material: usemtl πριν τις κορυφές (ίδια σειρά με τον stock OBJExporter).
  if (!isMultiMaterial) {
    const single = Array.isArray(material) ? material[0] : material;
    const name = single?.name;
    if (typeof name === 'string' && name.length > 0) out.push(`usemtl ${name}`);
  }

  const { nV, nVt, nVn } = writeVertexBlocks(mesh, out);
  const hasUv = geometry.getAttribute('uv') !== undefined;
  const hasNormal = geometry.getAttribute('normal') !== undefined;

  if (isMultiMaterial) {
    const materials = material as THREE.Material[];
    for (const group of geometry.groups) {
      const name = materials[group.materialIndex]?.name;
      if (typeof name === 'string' && name.length > 0) out.push(`usemtl ${name}`);
      writeFaceRange(geometry, base, hasUv, hasNormal, group.start / 3, (group.start + group.count) / 3, out);
    }
  } else {
    writeFaceRange(geometry, base, hasUv, hasNormal, 0, triangleCount(geometry), out);
  }

  base.v += nV;
  base.vt += nVt;
  base.vn += nVn;
}

/**
 * Γράφει μόνο τα `v`/`vt`/`vn` blocks (world-space) — χωρίς το `o`, που το έγραψε ήδη ο
 * `writeMesh` (ώστε το single-material `usemtl` να μπει ανάμεσα σε `o` και κορυφές, όπως ο stock).
 */
function writeVertexBlocks(mesh: THREE.Mesh, out: string[]): { nV: number; nVt: number; nVn: number } {
  const geometry = mesh.geometry;
  const positions = geometry.getAttribute('position');
  const uvs = geometry.getAttribute('uv');
  const normals = geometry.getAttribute('normal');

  let nV = 0;
  if (positions !== undefined) {
    const v = new THREE.Vector3();
    for (let i = 0; i < positions.count; i += 1, nV += 1) {
      v.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
      out.push(`v ${v.x} ${v.y} ${v.z}`);
    }
  }

  let nVt = 0;
  if (uvs !== undefined) {
    const uv = new THREE.Vector2();
    for (let i = 0; i < uvs.count; i += 1, nVt += 1) {
      uv.fromBufferAttribute(uvs, i);
      out.push(`vt ${uv.x} ${uv.y}`);
    }
  }

  let nVn = 0;
  if (normals !== undefined) {
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
    const n = new THREE.Vector3();
    for (let i = 0; i < normals.count; i += 1, nVn += 1) {
      n.fromBufferAttribute(normals, i).applyMatrix3(normalMatrix).normalize();
      out.push(`vn ${n.x} ${n.y} ${n.z}`);
    }
  }

  return { nV, nVt, nVn };
}

/**
 * Group-aware Wavefront OBJ σειριοποίηση ολόκληρου δέντρου. Drop-in αντικαταστάτης του
 * `new OBJExporter().parse(root)` — ίδια έξοδος για single-material, per-group `usemtl` για
 * per-face. Ο caller έχει ήδη ενημερώσει τα world matrices (`applyExportUnit` →
 * `updateMatrixWorld(true)`)· το επιβάλλουμε ξανά εδώ ώστε ο writer να είναι αυτοτελής/testable.
 */
export function serialiseObjGroupAware(root: THREE.Object3D): string {
  root.updateMatrixWorld(true);
  const out: string[] = [];
  const base: ObjIndexBase = { v: 0, vt: 0, vn: 0 };
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.isMesh === true) writeMesh(mesh, base, out);
  });
  return `${out.join('\n')}\n`;
}

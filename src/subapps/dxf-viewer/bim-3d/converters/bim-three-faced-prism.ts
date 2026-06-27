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
import type { FaceKey, FaceAppearanceMap } from '../../bim/types/face-appearance-types';
import { resolveFaceMaterial } from '../materials/face-appearance-material';

/** Αποτέλεσμα: geometry με per-face groups + ο πίνακας materialIndex → FaceKey. */
export interface FacedPrism {
  readonly geometry: THREE.BufferGeometry;
  /** index `m` = ο FaceKey της όψης που ζωγραφίζεται με `material[m]`. */
  readonly faceKeyByMaterialIndex: readonly FaceKey[];
}

/** Pack 2N θέσεις: [0..N) top ring, [N..2N) bottom ring (mirror `roof-to-three`). */
function packRingPositions(top: readonly THREE.Vector3[], bot: readonly THREE.Vector3[]): Float32Array {
  const N = top.length;
  const positions = new Float32Array(2 * N * 3);
  for (let i = 0; i < N; i++) {
    positions[i * 3] = top[i].x; positions[i * 3 + 1] = top[i].y; positions[i * 3 + 2] = top[i].z;
    positions[(N + i) * 3] = bot[i].x; positions[(N + i) * 3 + 1] = bot[i].y; positions[(N + i) * 3 + 2] = bot[i].z;
  }
  return positions;
}

/**
 * Δείκτες τριγώνων + per-face group ranges για ΕΝΑ prism με προαιρετικά holes (Φ2).
 * Vertex layout (κοινό top+bottom): `[contour(n)] [hole₀] [hole₁] …` με συνολικά `N`
 * περιμετρικές κορυφές· οι top βρίσκονται στο `[0..N)` και οι bottom στο `[N..2N)`.
 *
 * Σειρά (ντετερμινιστικά group offsets): ΟΛΑ τα bottom-cap τρίγωνα → top-cap → outer
 * side quads → hole-wall quads. Winding: mirror του proven `roof-to-three.ts` (bottom
 * reversed, top direct, outer side outward). Τα hole-walls παίρνουν ΑΝΤΙΣΤΡΟΦΟ winding
 * ώστε τα flat normals να δείχνουν ΜΕΣΑ στο κενό (ορατά από το άνοιγμα — όπως ExtrudeGeometry).
 */
function buildFacedIndex(
  contour2d: readonly THREE.Vector2[],
  holes2d: readonly (readonly THREE.Vector2[])[],
): {
  index: number[];
  groups: readonly { start: number; count: number; materialIndex: number }[];
  faceKeyByMaterialIndex: FaceKey[];
} {
  const n = contour2d.length;
  // Vertex offsets per hole within the combined perimeter list + total N.
  const holeStart: number[] = [];
  let N = n;
  for (const h of holes2d) { holeStart.push(N); N += h.length; }

  const tris = THREE.ShapeUtils.triangulateShape([...contour2d], holes2d.map((h) => [...h]));
  const index: number[] = [];
  for (const [a, b, c] of tris) index.push(N + a, N + c, N + b); // bottom cap (reversed)
  for (const [a, b, c] of tris) index.push(a, b, c); // top cap (direct)

  const capLen = tris.length * 3;
  const faceKeyByMaterialIndex: FaceKey[] = ['bottom', 'top'];
  const groups: { start: number; count: number; materialIndex: number }[] = [
    { start: 0, count: capLen, materialIndex: 0 },        // bottom
    { start: capLen, count: capLen, materialIndex: 1 },   // top
  ];
  let cursor = 2 * capLen;
  let mat = 2;

  // Outer perimeter side quads (outward normals).
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    index.push(N + i, N + j, j);
    index.push(N + i, j, i);
    groups.push({ start: cursor, count: 6, materialIndex: mat });
    faceKeyByMaterialIndex.push(`side:${i}`);
    cursor += 6; mat++;
  }

  // Hole-wall side quads. The holes are pre-normalised to the OPPOSITE winding of the
  // contour (see buildFacedPrism), so the SAME wall formula as the outer perimeter yields
  // normals pointing INTO the void — exactly how ExtrudeGeometry builds hole walls.
  for (let h = 0; h < holes2d.length; h++) {
    const m = holes2d[h].length;
    const off = holeStart[h];
    for (let k = 0; k < m; k++) {
      const a = off + k;
      const b = off + ((k + 1) % m);
      index.push(N + a, N + b, b);
      index.push(N + a, b, a);
      groups.push({ start: cursor, count: 6, materialIndex: mat });
      faceKeyByMaterialIndex.push(`hole:${h}:${k}`);
      cursor += 6; mat++;
    }
  }

  return { index, groups, faceKeyByMaterialIndex };
}

/**
 * Χτίζει το faced prism από ένα top ring (world-space Vector3, +Y cap) με κατακόρυφο
 * πάχος `depthM` (το bottom ring = top μετατοπισμένο κατά −depthM στον Y). Προαιρετικά
 * `holes` (Φ2): δαχτυλίδια στο cap-plane (plan `(x, z)` ως `Vector2`, ίδιο επίπεδο με το
 * contour) → cap cut-outs + περιμετρικά τοιχώματα. Επιστρέφει non-indexed geometry
 * (per-face flat normals) με groups + `faceKeyByMaterialIndex`, ή `null` (<3 κορυφές).
 *
 * Το contour τριγωνοποιείται στο (x, z) plan-plane (όπως roof-to-three: world z = −North).
 */
export function buildFacedPrism(
  topRing: readonly THREE.Vector3[],
  depthM: number,
  holes?: readonly (readonly THREE.Vector2[])[],
): FacedPrism | null {
  const n = topRing.length;
  if (n < 3) return null;

  const contour2d = topRing.map((p) => new THREE.Vector2(p.x, p.z));
  // Normalise each hole to the OPPOSITE winding of the contour — `triangulateShape` cuts the
  // cap correctly and the shared wall formula yields inward-facing hole walls (ExtrudeGeometry
  // pattern). A degenerate hole (<3 verts) is dropped.
  const contourCW = THREE.ShapeUtils.isClockWise(contour2d);
  const holeRings = (holes ?? [])
    .filter((h) => h.length >= 3)
    .map((h) => {
      const ring = [...h];
      if (THREE.ShapeUtils.isClockWise(ring) === contourCW) ring.reverse();
      return ring;
    });

  // Holes live in the (planar) top-cap plane; lift each hole vertex to that Y.
  const capY = topRing[0].y;
  const topVerts: THREE.Vector3[] = [...topRing];
  for (const h of holeRings) for (const p of h) topVerts.push(new THREE.Vector3(p.x, capY, p.y));
  const botVerts = topVerts.map((p) => new THREE.Vector3(p.x, p.y - depthM, p.z));

  const { index, groups, faceKeyByMaterialIndex } = buildFacedIndex(contour2d, holeRings);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(packRingPositions(topVerts, botVerts), 3));
  geo.setIndex(index);
  for (const g of groups) geo.addGroup(g.start, g.count, g.materialIndex);

  // toNonIndexed → per-face flat normals (mirror column-piece-geometry / roof). Groups
  // are preserved (start/count map 1:1 from index-space to the expanded vertex array).
  const flat = geo.toNonIndexed();
  flat.computeVertexNormals();
  geo.dispose();
  return { geometry: flat, faceKeyByMaterialIndex };
}

/**
 * ADR-539 — shared per-face solid body (SSoT για ΚΑΘΕ faced solid: slab, foundation, …).
 * Δέχεται ένα canonical outline (plan XY σε world metres· `x` = East, `y` = North), το
 * vertical πάχος `thicknessM` και το per-face `appearance`. Χτίζει το top ring στο +Y cap
 * (`y = thicknessM`, world z = −plan y, ώστε το bottom ring να πέφτει στο `y = 0` — IDENTICAL
 * local span [0, thicknessM] με το legacy `extrudeAndRotate`, άρα ο caller κρατά την ΙΔΙΑ
 * `mesh.position.y`). Κάθε όψη παίρνει `resolveFaceMaterial`· αβαφής όψη → `baseMat`
 * (ίδιο instance, byte-for-byte legacy look). Αποθηκεύει `userData.faceKeyByMaterialIndex`
 * για raycast + face highlight. Επιστρέφει `null` για degenerate outline (<3 κορυφές).
 *
 * Boy-Scout (N.0.2): εξήχθη όταν το foundation έγινε ο 2ος caller — ΕΝΑ faced-body SSoT,
 * μηδέν copy-paste ανά kind.
 */
export function buildFacedSolidBody(
  verts: readonly { readonly x: number; readonly y: number }[],
  thicknessM: number,
  appearance: FaceAppearanceMap,
  baseMat: THREE.Material,
  holes?: readonly (readonly THREE.Vector2[])[],
): THREE.Mesh | null {
  const topRing = verts.map((v) => new THREE.Vector3(v.x, thicknessM, -v.y));
  const prism = buildFacedPrism(topRing, thicknessM, holes);
  if (!prism) return null;
  const materials = prism.faceKeyByMaterialIndex.map((fk) => resolveFaceMaterial(fk, appearance, baseMat));
  const mesh = new THREE.Mesh(prism.geometry, materials);
  mesh.userData['faceKeyByMaterialIndex'] = [...prism.faceKeyByMaterialIndex];
  return mesh;
}

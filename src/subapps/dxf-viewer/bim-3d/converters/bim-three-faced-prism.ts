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
 * Slab-openings/holes = Φ2. Κάθε όψη παίρνει box-projected world-meter UVs (uv+uv2) ώστε
 * TEXTURED materials να κάνουν σωστό tiling ανά παρειά (ADR-679 Φ2b).
 *
 * @see roof-to-three.ts `buildPrismIndex` — το πρότυπο (proven winding· migration Φ3)
 * @see bim/types/face-appearance-types.ts — FaceKey SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-539-cinema4d-polygon-mode-per-face-appearance.md
 */

import * as THREE from 'three';
import { buriedFaceKey, type FaceKey, type FaceAppearanceMap } from '../../bim/types/face-appearance-types';
import { resolveFaceMaterial } from '../materials/face-appearance-material';
import { ensureDoubleSided } from '../materials/ensure-double-sided';
import { setBoxWorldUvs } from './bim-uv-helpers';

/** Αποτέλεσμα: geometry με per-face groups + ο πίνακας materialIndex → FaceKey. */
export interface FacedPrism {
  readonly geometry: THREE.BufferGeometry;
  /** index `m` = ο FaceKey της όψης που ζωγραφίζεται με `material[m]`. */
  readonly faceKeyByMaterialIndex: readonly FaceKey[];
}

/**
 * Pack `rings.length × N` θέσεις, ring-major: το ring `r` καταλαμβάνει `[r·N, (r+1)·N)`.
 * Σειρά ΠΑΝΩ→ΚΑΤΩ (ring 0 = top, τελευταίο = bottom), mirror `roof-to-three`. Χωρίς
 * ενδιάμεσο ring δίνει ακριβώς το προηγούμενο 2N layout (top, bottom) — μηδέν μετατόπιση.
 */
function packRingPositions(rings: readonly (readonly THREE.Vector3[])[]): Float32Array {
  const N = rings[0].length;
  const positions = new Float32Array(rings.length * N * 3);
  for (let r = 0; r < rings.length; r++) {
    const ring = rings[r];
    for (let i = 0; i < N; i++) {
      const o = (r * N + i) * 3;
      positions[o] = ring[i].x; positions[o + 1] = ring[i].y; positions[o + 2] = ring[i].z;
    }
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
  // ADR-713 — true όταν παρεμβάλλεται ring στάθμης εδάφους: κάθε περιμετρική πλευρά σπάει
  // σε `side:i` (πάνω από τη στάθμη) + `buried:i` (κάτω). false → ακριβώς το προηγούμενο.
  split: boolean,
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

  // Ring bases (ring-major layout, ΠΑΝΩ→ΚΑΤΩ: [top, (mid,) bottom]).
  //
  // `EXPOSED_LO` = το ΚΑΤΩ όριο της εκτεθειμένης ζώνης, δηλαδή το **δεύτερο** ring — που
  // είναι η στάθμη εδάφους όταν υπάρχει split, αλλιώς η ίδια η βάση του στερεού. Είναι `N`
  // και στις δύο περιπτώσεις, γι' αυτό ο τύπος της εκτεθειμένης πλευράς είναι **ο ίδιος**
  // με τον προηγούμενο (`pushWall(N, 0, …)`) χωρίς branch (N.18). Μόνο το `BOT` μετακινείται.
  const TOP = 0;
  const EXPOSED_LO = N;
  const BOT = split ? 2 * N : N;

  const tris = THREE.ShapeUtils.triangulateShape([...contour2d], holes2d.map((h) => [...h]));
  const index: number[] = [];
  // Cap winding verified by `DIAG` test: the bottom ring cap must wind a→b→c for a
  // DOWN-facing normal (faces the ground), and the top ring a→c→b for an UP-facing normal
  // (faces the sky). The earlier a/b/c order was inverted (top normal pointed down) → clicking
  // the visible top cap was back-face-culled and the click fell through to the bottom cap.
  for (const [a, b, c] of tris) index.push(BOT + a, BOT + b, BOT + c); // bottom cap → normal −Y (ground)
  for (const [a, b, c] of tris) index.push(TOP + a, TOP + c, TOP + b); // top cap → normal +Y (sky)

  const capLen = tris.length * 3;
  const faceKeyByMaterialIndex: FaceKey[] = ['bottom', 'top'];
  const groups: { start: number; count: number; materialIndex: number }[] = [
    { start: 0, count: capLen, materialIndex: 0 },        // bottom
    { start: capLen, count: capLen, materialIndex: 1 },   // top
  ];
  let cursor = 2 * capLen;
  let mat = 2;

  /** Ένα περιμετρικό quad ανάμεσα σε δύο rings (`lo` κάτω, `up` πάνω) με outward normal. */
  const pushWall = (lo: number, up: number, a: number, b: number, faceKey: FaceKey): void => {
    index.push(lo + a, lo + b, up + b);
    index.push(lo + a, up + b, up + a);
    groups.push({ start: cursor, count: 6, materialIndex: mat });
    faceKeyByMaterialIndex.push(faceKey);
    cursor += 6; mat++;
  };

  // Outer perimeter — ΕΚΤΕΘΕΙΜΕΝΗ ζώνη (στάθμη εδάφους → κορυφή). Χωρίς split είναι η
  // πλήρης πλευρά· τα materialIndex μένουν `2+i` (συμβόλαιο ADR-539, byte-for-byte).
  for (let i = 0; i < n; i++) pushWall(EXPOSED_LO, TOP, i, (i + 1) % n, `side:${i}`);

  // ADR-713 — ΘΑΜΜΕΝΗ ζώνη (πέδιλο → στάθμη εδάφους). Μπαίνει ΜΕΤΑ όλες τις `side:i` ώστε
  // η υπάρχουσα αρίθμηση των εκτεθειμένων όψεων να μείνει ανέγγιχτη.
  if (split) for (let i = 0; i < n; i++) pushWall(BOT, EXPOSED_LO, i, (i + 1) % n, buriedFaceKey(i));

  // Hole-wall side quads (πλήρες ύψος — τα ανοίγματα δεν αφορούν τη ζώνη εδάφους). The holes
  // are pre-normalised to the OPPOSITE winding of the contour (see buildFacedPrism), so the
  // SAME wall formula as the outer perimeter yields normals pointing INTO the void — exactly
  // how ExtrudeGeometry builds hole walls.
  for (let h = 0; h < holes2d.length; h++) {
    const m = holes2d[h].length;
    const off = holeStart[h];
    for (let k = 0; k < m; k++) {
      pushWall(BOT, TOP, off + k, off + ((k + 1) % m), `hole:${h}:${k}`);
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
  // ADR-713 — ύψος (m) της ΘΑΜΜΕΝΗΣ ζώνης, μετρημένο από την **κάτω** παρειά προς τα πάνω.
  // Όταν είναι μέσα στο (0, depthM), παρεμβάλλεται ring στη στάθμη εδάφους και κάθε
  // περιμετρική πλευρά δίνει `side:i` (πάνω) + `buried:i` (κάτω). Εκτός εύρους / απόν →
  // ΚΑΝΕΝΑ split (byte-for-byte το προηγούμενο prism — κάθε άλλος caller μένει ανέγγιχτος).
  buriedDepthM?: number,
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

  // ADR-713 — το ring στάθμης εδάφους μπαίνει ΜΟΝΟ για γνήσιο split: μια ζώνη 0 ή πλήρους
  // ύψους δεν σπάει τίποτα, απλώς θα άφηνε εκφυλισμένα (μηδενικού εμβαδού) quads.
  const split = buriedDepthM !== undefined && Number.isFinite(buriedDepthM)
    && buriedDepthM > 0 && buriedDepthM < depthM;
  const rings: THREE.Vector3[][] = split
    ? [topVerts, botVerts.map((p) => new THREE.Vector3(p.x, p.y + buriedDepthM!, p.z)), botVerts]
    : [topVerts, botVerts];

  const { index, groups, faceKeyByMaterialIndex } = buildFacedIndex(contour2d, holeRings, split);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(packRingPositions(rings), 3));
  geo.setIndex(index);
  for (const g of groups) geo.addGroup(g.start, g.count, g.materialIndex);

  // toNonIndexed → per-face flat normals (mirror column-piece-geometry / roof). Groups
  // are preserved (start/count map 1:1 from index-space to the expanded vertex array).
  const flat = geo.toNonIndexed();
  flat.computeVertexNormals();
  // Box-projected world-meter UVs (uv+uv2) ανά όψη, βάσει των flat normals μόλις
  // υπολογισμένων παραπάνω — ίδιο helper με τα preview bands του Edit-Type (bim-uv-helpers,
  // ADR-413), ΟΧΙ νέο UV scheme. Χωρίς αυτό οι faced solids (slab/foundation) είχαν
  // degenerate/απούσα UV → TEXTURED materials σε βαμμένη όψη δεν έκαναν tile (ADR-679 Φ2b).
  setBoxWorldUvs(flat);
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
  // ADR-713 — ύψος θαμμένης ζώνης (m) από την κάτω παρειά· βλ. {@link buildFacedPrism}.
  // Ο caller ΠΡΕΠΕΙ να δηλώσει ρητά τα `buried:i` στο `appearance` (βλ. `buriedFaceAppearance`),
  // αλλιώς ο cascade `appearance[key] ?? appearance['*']` θα έβαφε το θαμμένο με την όψη.
  buriedDepthM?: number,
): THREE.Mesh | null {
  const topRing = verts.map((v) => new THREE.Vector3(v.x, thicknessM, -v.y));
  const prism = buildFacedPrism(topRing, thicknessM, holes, buriedDepthM);
  if (!prism) return null;
  // ADR-539 Φ2 — faced solids render + RAYCAST double-sided so the interior hole-wall faces
  // are both visible and pickable from inside the opening. With FrontSide, a hole wall whose
  // flat normal faces away from the cursor is back-face-culled → invisible AND un-pickable
  // (THREE.Mesh.raycast honours `material.side`). One shared double-sided body material covers
  // every unpainted face (incl. hole walls); painted faces get their own double-sided material.
  const bodyMat = ensureDoubleSided(baseMat);
  const materials = prism.faceKeyByMaterialIndex.map((fk) => resolveFaceMaterial(fk, appearance, bodyMat));
  const mesh = new THREE.Mesh(prism.geometry, materials);
  mesh.userData['faceKeyByMaterialIndex'] = [...prism.faceKeyByMaterialIndex];
  return mesh;
}

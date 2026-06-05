/**
 * roof-ridge-cap — ADR-417 Φ2a. Rounded **εφαπτόμενος** κορφιάς/hip («κορφιάς»).
 *
 * Revit-true: το κεραμίδι κορυφής δράπει πάνω από τα ΔΥΟ γειτονικά «νερά» — τα
 * δύο κάτω άκρα του ΚΑΘΟΝΤΑΙ ΠΑΝΩ στις δύο κεκλιμένες επιφάνειες (αντί για τον
 * παλιό βυθισμένο dome που «πετούσε»). Για κάθε ridge/hip γραμμή:
 *   1. βρίσκει τα 2 γειτονικά faces (μοιράζονται την ακμή a→b),
 *   2. υπολογίζει το slope-plane καθενός (world),
 *   3. χτίζει ημικυκλική διατομή της οποίας τα 2 άκρα = σημεία επαφής στα 2
 *      slope planes σε οριζόντιο half-width, και τη σαρώνει κατά μήκος a→b.
 *
 * Συμμετρικό gable ⇒ καθαρός half-cylinder astride· hip (κεκλιμένος άξονας,
 * πιθανώς διαφορετικές κλίσεις) ⇒ ασύμμετρη χορδή — δουλεύει γενικά.
 *
 * Pure (THREE math μόνο). UNITS-SAFE μέσω `roof-world-transform`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-417-bim-roof-element.md §10
 * @see bim-3d/converters/roof-to-three.ts — consumer (addRidgeCaps)
 */

import * as THREE from 'three';
import type { RoofFace, RoofRidgeLine } from '../../bim/types/roof-types';
import { setBoxWorldUvs } from './bim-uv-helpers';
import { toWorld } from './roof-world-transform';

/** Οριζόντιο half-width (m) του κορφιά → ολικό πλάτος κεραμιδιού ~12 cm. */
const RIDGE_CAP_HALF_WIDTH_M = 0.06;
/** Ανάλυση ημικυκλίου διατομής. */
const RIDGE_CAP_SEGMENTS = 8;
const UP = new THREE.Vector3(0, 1, 0);

// ─── Face adjacency (canvas-space xy match) ───────────────────────────────────

/** True όταν το face έχει κορυφές ≈ a ΚΑΙ ≈ b (μοιράζεται την ακμή). */
function faceHasEdge(face: RoofFace, a: RoofRidgeLine['a'], b: RoofRidgeLine['b'], eps: number): boolean {
  let hasA = false;
  let hasB = false;
  for (const v of face.outline) {
    if (Math.hypot(v.x - a.x, v.y - a.y) <= eps) hasA = true;
    if (Math.hypot(v.x - b.x, v.y - b.y) <= eps) hasB = true;
  }
  return hasA && hasB;
}

/** Τα ≤2 faces που μοιράζονται την ακμή a→b της ridge γραμμής. */
export function findAdjacentFaces(ridge: RoofRidgeLine, faces: readonly RoofFace[]): RoofFace[] {
  const len = Math.hypot(ridge.b.x - ridge.a.x, ridge.b.y - ridge.a.y);
  const eps = Math.max(1e-6, 1e-3 * len);
  const out: RoofFace[] = [];
  for (const f of faces) {
    if (faceHasEdge(f, ridge.a, ridge.b, eps)) out.push(f);
    if (out.length === 2) break;
  }
  return out;
}

// ─── Face plane (world) ───────────────────────────────────────────────────────

interface WorldPlane {
  /** Μοναδιαίο κάθετο (y-component > 0 — δείχνει πάνω). */
  readonly normal: THREE.Vector3;
  /** Σημείο του επιπέδου (μία world κορυφή). */
  readonly point: THREE.Vector3;
  /** Centroid (world) — για επιλογή πλευράς. */
  readonly centroid: THREE.Vector3;
}

/** World κορυφές του face (canvas xy + mm z → m, + baseY). */
function faceWorldVertices(face: RoofFace, sceneToM: number, baseY: number): THREE.Vector3[] {
  return face.outline.map((v) => {
    const p = toWorld(v.x, v.y, v.z ?? 0, sceneToM);
    p.y += baseY;
    return p;
  });
}

/** Επίπεδο του face από 3 μη-συγγραμμικές world κορυφές. Null αν degenerate/κάθετο. */
function facePlane(verts: readonly THREE.Vector3[]): WorldPlane | null {
  if (verts.length < 3) return null;
  const v0 = verts[0];
  const e1 = new THREE.Vector3().subVectors(verts[1], v0);
  let normal: THREE.Vector3 | null = null;
  for (let i = 2; i < verts.length; i++) {
    const e2 = new THREE.Vector3().subVectors(verts[i], v0);
    const cross = new THREE.Vector3().crossVectors(e1, e2);
    if (cross.lengthSq() > 1e-12) { normal = cross.normalize(); break; }
  }
  if (!normal || Math.abs(normal.y) < 1e-6) return null; // κάθετο → no roof plane
  if (normal.y < 0) normal.negate(); // δείχνει πάνω
  const centroid = verts.reduce((acc, v) => acc.add(v), new THREE.Vector3()).multiplyScalar(1 / verts.length);
  return { normal, point: v0.clone(), centroid };
}

/** Ύψος (world y) του επιπέδου στη θέση (x, z). */
function planeYAt(plane: WorldPlane, x: number, z: number): number {
  const { normal: n, point: p } = plane;
  const d = n.x * p.x + n.y * p.y + n.z * p.z;
  return (d - n.x * x - n.z * z) / n.y;
}

// ─── Cross-section ring + sweep ───────────────────────────────────────────────

/** Σημείο επαφής: από το apex `P` οριζόντια κατά `dir·w`, μετά πέφτει στο `plane`. */
function contactPoint(P: THREE.Vector3, dir: THREE.Vector3, w: number, plane: WorldPlane): THREE.Vector3 {
  const x = P.x + dir.x * w;
  const z = P.z + dir.z * w;
  return new THREE.Vector3(x, planeYAt(plane, x, z), z);
}

/** Ημικυκλική διατομή από `c1` σε `c2` με bulge προς τα πάνω. Null αν degenerate. */
function buildArc(c1: THREE.Vector3, c2: THREE.Vector3): THREE.Vector3[] | null {
  const center = new THREE.Vector3().addVectors(c1, c2).multiplyScalar(0.5);
  const half = new THREE.Vector3().subVectors(c1, center);
  const r = half.length();
  if (r < 1e-6) return null;
  const chordHat = half.clone().multiplyScalar(1 / r);
  const perpUp = UP.clone().addScaledVector(chordHat, -UP.dot(chordHat));
  if (perpUp.lengthSq() < 1e-9) return null; // χορδή κατακόρυφη
  perpUp.normalize();
  const ring: THREE.Vector3[] = [];
  for (let k = 0; k <= RIDGE_CAP_SEGMENTS; k++) {
    const theta = (Math.PI * k) / RIDGE_CAP_SEGMENTS;
    ring.push(
      center.clone()
        .addScaledVector(half, Math.cos(theta))
        .addScaledVector(perpUp, r * Math.sin(theta)),
    );
  }
  return ring;
}

/** Pack ringA(m) μετά ringB(m) → Float32 positions. */
function packCapPositions(ringA: readonly THREE.Vector3[], ringB: readonly THREE.Vector3[]): Float32Array {
  const m = ringA.length;
  const pos = new Float32Array(2 * m * 3);
  for (let k = 0; k < m; k++) {
    pos[k * 3] = ringA[k].x; pos[k * 3 + 1] = ringA[k].y; pos[k * 3 + 2] = ringA[k].z;
    pos[(m + k) * 3] = ringB[k].x; pos[(m + k) * 3 + 1] = ringB[k].y; pos[(m + k) * 3 + 2] = ringB[k].z;
  }
  return pos;
}

/** Strip index μεταξύ ringA[0..segments] και ringB[0..segments]. */
function buildCapIndex(segments: number): number[] {
  const m = segments + 1;
  const index: number[] = [];
  for (let k = 0; k < segments; k++) {
    index.push(k, k + 1, m + k + 1);
    index.push(k, m + k + 1, m + k);
  }
  return index;
}

/** Επιλέγει το οριζόντιο μοναδιαίο `dir` (⊥ στον άξονα) προς την πλευρά του face. */
function sideDir(axisHat: THREE.Vector3, midR: THREE.Vector3, plane: WorldPlane): THREE.Vector3 | null {
  const u = new THREE.Vector3().crossVectors(axisHat, UP);
  if (u.lengthSq() < 1e-9) return null; // (σχεδόν) κατακόρυφος άξονας
  u.normalize();
  const toFace = new THREE.Vector3().subVectors(plane.centroid, midR);
  return u.dot(toFace) >= 0 ? u : u.negate();
}

/**
 * Rounded εφαπτόμενος κορφιάς/hip cap κατά μήκος της `ridge` γραμμής, με τα δύο
 * άκρα στις 2 γειτονικές κλίσεις. Null αν <2 adjacent faces ή degenerate.
 */
export function buildRoundedRidgeCap(
  ridge: RoofRidgeLine,
  adjFaces: readonly RoofFace[],
  sceneToM: number,
  baseY: number,
): THREE.BufferGeometry | null {
  if (adjFaces.length < 2) return null;
  const planeA = facePlane(faceWorldVertices(adjFaces[0], sceneToM, baseY));
  const planeB = facePlane(faceWorldVertices(adjFaces[1], sceneToM, baseY));
  if (!planeA || !planeB) return null;

  const A = toWorld(ridge.a.x, ridge.a.y, ridge.a.z ?? 0, sceneToM); A.y += baseY;
  const B = toWorld(ridge.b.x, ridge.b.y, ridge.b.z ?? 0, sceneToM); B.y += baseY;
  const axis = new THREE.Vector3().subVectors(B, A);
  if (axis.lengthSq() < 1e-8) return null;
  const axisHat = axis.clone().normalize();
  const midR = new THREE.Vector3().addVectors(A, B).multiplyScalar(0.5);

  const dirA = sideDir(axisHat, midR, planeA);
  if (!dirA) return null;
  const dirB = dirA.clone().negate();
  const w = RIDGE_CAP_HALF_WIDTH_M;

  const ringA = buildArc(contactPoint(A, dirA, w, planeA), contactPoint(A, dirB, w, planeB));
  const ringB = buildArc(contactPoint(B, dirA, w, planeA), contactPoint(B, dirB, w, planeB));
  if (!ringA || !ringB) return null;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(packCapPositions(ringA, ringB), 3));
  geo.setIndex(buildCapIndex(RIDGE_CAP_SEGMENTS));
  const flat = geo.toNonIndexed();
  flat.computeVertexNormals();
  setBoxWorldUvs(flat);
  return flat;
}

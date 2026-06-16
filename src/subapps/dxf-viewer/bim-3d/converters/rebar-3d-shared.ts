/**
 * ADR-463 — Shared 3Δ rebar primitives (SSoT, κολώνα + θεμελίωση).
 *
 * Τα low-level building blocks του rebar cage που μοιράζονται `column-rebar-3d` και
 * `footing-rebar-3d`: ΕΝΑ άφωτο υλικό (singleton), ο InstancedMesh-από-segments
 * αγωγός (`buildRods`), η σύμβαση plan→three (`toThree`, AXIS_FLIP), και οι σταθερές.
 *
 * **Pure** (μόνο `three` + τύπος `Point2D`) — ZERO store/Firestore import, ώστε οι
 * converter jest suites να μη σέρνουν την αλυσίδα του settings store (`fetch is not
 * defined`). Πρώην ζούσαν inline στο `column-rebar-3d.ts`· εξήχθησαν εδώ (N.0.2).
 *
 * @see ./column-rebar-3d.ts · ./footing-rebar-3d.ts
 */

import * as THREE from 'three';
import type { Point2D } from '../../rendering/types/Types';

export const MM_TO_M = 0.001;
/** Χρώμα οπλισμού (crimson — αντίθεση με το δομικό μπλε, ίδιο με το 2Δ). */
const REBAR_COLOR = 0xc0392b;
/**
 * ΚΟΙΝΟ άφωτο υλικό (module singleton). `MeshBasicMaterial` (ΟΧΙ Standard) ⇒
 * ζωγραφίζεται αξιόπιστα στο πρώτο frame (μηδέν async shader compile) + compiled
 * μία φορά, reused σε όλες τις κολώνες ΚΑΙ θεμελιώσεις (μηδέν per-element shader).
 */
export const REBAR_MATERIAL = new THREE.MeshBasicMaterial({ color: REBAR_COLOR });
/** Πλευρές κυλίνδρου ράβδου (χαμηλό — λεπτή ράβδος, ελάχιστο geometry). */
const ROD_RADIAL_SEGMENTS = 6;
/** Ελάχιστη ακτίνα (scene units) ώστε εκφυλισμένο Ø να μη δίνει μηδενικό geometry. */
export const MIN_RADIUS = 1e-4;

export interface Seg { a: THREE.Vector3; b: THREE.Vector3 }

const UP = new THREE.Vector3(0, 1, 0);

/**
 * InstancedMesh από unit κύλινδρο (ύψος 1, άξονας +Y), τοποθετημένος ανά segment:
 * κάθε instance = translate στο μέσο + rotate (Y→διεύθυνση) + scale.y = μήκος.
 * `frustumCulled=false`: το bounding sphere βγαίνει από το unit geometry στο origin
 * (ΟΧΙ από τα instance matrices) → αλλιώς το culling έκοβε τον κλωβό μακριά από το origin.
 */
export function buildRods(
  segments: readonly Seg[],
  radius: number,
  material: THREE.Material,
): THREE.InstancedMesh | null {
  if (segments.length === 0 || radius <= 0) return null;
  const geo = new THREE.CylinderGeometry(radius, radius, 1, ROD_RADIAL_SEGMENTS);
  const mesh = new THREE.InstancedMesh(geo, material, segments.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const dir = new THREE.Vector3();
  for (let i = 0; i < segments.length; i++) {
    const { a, b } = segments[i];
    const len = a.distanceTo(b);
    pos.addVectors(a, b).multiplyScalar(0.5);
    dir.subVectors(b, a);
    if (len > 1e-9) dir.divideScalar(len);
    q.setFromUnitVectors(UP, len > 1e-9 ? dir : UP);
    scl.set(1, Math.max(len, 1e-6), 1);
    m.compose(pos, q, scl);
    mesh.setMatrixAt(i, m);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}

/** plan point (scene units) → three.js διάνυσμα σε στάθμη y (AXIS_FLIP: Z = −sy). */
export function toThree(p: Point2D, y: number): THREE.Vector3 {
  return new THREE.Vector3(p.x, y, -p.y);
}

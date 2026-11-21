/**
 * @fileoverview **ΠΟΥ ΜΠΟΡΕΙ ΝΑ ΣΤΑΘΕΙ Η ΚΑΜΕΡΑ ΠΑΝΩ ΑΠΟ ΤΟ ΟΙΚΟΠΕΔΟ** — καθαρά μαθηματικά, χωρίς DOM (ADR-920 §14.5).
 * @related `terrain-3d-engine.ts` (ο καταναλωτής) · `@/lib/three/camera/viewport-framing` (η ΙΔΙΑ πλαισίωση με τον viewer)
 * @module components/listing-detail/terrain/3d/terrain-3d-camera
 *
 * 🔑 **Ποτέ κάτω από το έδαφος** (Cesium `maximumTiltAngle`): η πολική γωνία από τον κατακόρυφο άξονα σταματά στις 85°.
 *   Βλέπεις τα τοιχώματα από το πλάι, ποτέ τον πάτο. Ό,τι ζητήσει ο κύβος πιο χαμηλά («Κάτω») κλαδεύεται εδώ, από την
 *   **ίδια** συνάρτηση που ορίζει και το όριο του `OrbitControls`.
 * 🔑 **«Πάνω» σημαίνει «ο βορράς πάνω στην οθόνη»**: μια κάμερα ακριβώς από πάνω δεν έχει προσανατολισμό (`lookAt`
 *   εκφυλίζεται). Της δίνουμε μια ελάχιστη κλίση **από τον νότο**, ώστε η όψη να ταιριάζει με την κάτοψη.
 * 📐 Σύμβαση: `toCamera` = μοναδιαίο διάνυσμα **από τον στόχο προς την κάμερα**. Το `lookDir` του κύβου είναι το
 *   αντίθετο (κάμερα → στόχος).
 */

import * as THREE from 'three';

import { computePerspectiveFraming } from '@/lib/three/camera/viewport-framing';
import type { Terrain3dGeometry } from '@/lib/terrain/publication/terrain-3d-geometry';

export type Terrain3dBounds = Terrain3dGeometry['bounds'];

/** Οπτικό πεδίο: στενότερο από τα 50° του viewer ⇒ λιγότερη παραμόρφωση στις άκρες ενός μικρού οικοπέδου. */
export const TERRAIN_3D_FOV_DEG = 45;
/** Η κάμερα δεν κατεβαίνει χαμηλότερα από 5° πάνω από τον ορίζοντα. */
export const TERRAIN_3D_MAX_POLAR_RAD = THREE.MathUtils.degToRad(85);
/** Ελάχιστη κλίση της όψης «Πάνω» (ώστε το `lookAt` να έχει «πάνω» = βορράς). */
export const TERRAIN_3D_MIN_POLAR_RAD = THREE.MathUtils.degToRad(0.5);

/** Νότος: από εκεί κοιτάζει μια κάμερα που βλέπει τον βορρά πάνω στην οθόνη (−Z = βορράς). */
const SOUTH = new THREE.Vector3(0, 0, 1);

export interface Terrain3dBox {
  readonly min: THREE.Vector3;
  readonly max: THREE.Vector3;
}

export interface TerrainOrbitLimits {
  /** Κέντρο του όγκου — ο `cursor` του `OrbitControls`. */
  readonly centre: THREE.Vector3;
  /** Ο στόχος δεν απομακρύνεται από το κέντρο πέρα από τη μισή διαγώνιο. */
  readonly maxTargetRadius: number;
  readonly minDistance: number;
  readonly maxDistance: number;
  readonly near: number;
  readonly far: number;
}

export interface TerrainPose {
  readonly position: THREE.Vector3;
  readonly target: THREE.Vector3;
}

/** Το κουτί του όγκου εδάφους (επιφάνεια + χώμα). */
export function terrainBox(bounds: Terrain3dBounds): Terrain3dBox {
  return {
    min: new THREE.Vector3(bounds.minX, bounds.baseY, bounds.minZ),
    max: new THREE.Vector3(bounds.maxX, bounds.topY, bounds.maxZ),
  };
}

/** Όρια τροχιάς από το μέγεθος του οικοπέδου — ίδια αναλογία σε οικόπεδο 300 m² και σε αγρό 3 ha. */
export function terrainOrbitLimits(bounds: Terrain3dBounds): TerrainOrbitLimits {
  const { min, max } = terrainBox(bounds);
  const halfDiagonal = Math.max(min.distanceTo(max) / 2, 1);
  const minDistance = halfDiagonal * 0.15;
  const maxDistance = halfDiagonal * 8;
  return {
    centre: min.clone().add(max).multiplyScalar(0.5),
    maxTargetRadius: halfDiagonal,
    minDistance,
    maxDistance,
    near: minDistance * 0.05,
    far: maxDistance + halfDiagonal * 2,
  };
}

/**
 * Το `toCamera` μέσα στη ζώνη πολικής γωνίας `[MIN, MAX]`. Μη πεπερασμένο ή μηδενικό διάνυσμα ⇒ `null` (ο καλών δεν
 * κινείται). Κατακόρυφο διάνυσμα (Πάνω/Κάτω) παίρνει οριζόντια συνιστώσα **από τον νότο**.
 */
export function clampAboveHorizon(toCamera: THREE.Vector3): THREE.Vector3 | null {
  const dir = toCamera.clone();
  if (!Number.isFinite(dir.lengthSq()) || dir.lengthSq() < 1e-12) return null;
  dir.normalize();
  const horizontal = new THREE.Vector3(dir.x, 0, dir.z);
  if (horizontal.lengthSq() < 1e-12) horizontal.copy(SOUTH);
  horizontal.normalize();
  const polar = THREE.MathUtils.clamp(Math.acos(THREE.MathUtils.clamp(dir.y, -1, 1)), TERRAIN_3D_MIN_POLAR_RAD, TERRAIN_3D_MAX_POLAR_RAD);
  return horizontal.multiplyScalar(Math.sin(polar)).setY(Math.cos(polar));
}

/** Θέση που χωρά **όλο** τον όγκο, κοιτώντας από την κατεύθυνση `toCamera` (κλαδεμένη). */
export function terrainPoseFor(toCamera: THREE.Vector3, bounds: Terrain3dBounds, aspect: number): TerrainPose | null {
  const dir = clampAboveHorizon(toCamera);
  if (dir === null) return null;
  const { min, max } = terrainBox(bounds);
  const framing = computePerspectiveFraming(min, max, dir.negate(), aspect, TERRAIN_3D_FOV_DEG);
  return { position: framing.position, target: framing.target };
}

/**
 * Περιστροφή της κάμερας γύρω από τον στόχο (σύρση του κύβου): `dTheta` γύρω από τον κατακόρυφο άξονα, `dPhi` προς τα
 * πάνω/κάτω, με τα **ίδια** όρια πολικής γωνίας.
 */
export function orbitAround(position: THREE.Vector3, target: THREE.Vector3, dTheta: number, dPhi: number): THREE.Vector3 {
  const spherical = new THREE.Spherical().setFromVector3(position.clone().sub(target));
  spherical.theta -= dTheta;
  spherical.phi = THREE.MathUtils.clamp(spherical.phi - dPhi, TERRAIN_3D_MIN_POLAR_RAD, TERRAIN_3D_MAX_POLAR_RAD);
  return new THREE.Vector3().setFromSpherical(spherical).add(target);
}

/**
 * ADR-668 — μετατροπή της headless BIM σκηνής σε «εξαγώγιμη»: ονόματα + μονάδα.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-668-mesh3d-export-obj-gltf.md
 */

import type * as THREE from 'three';
import type { ExportLengthUnit } from '../../types';
import { resolveBimMeshIdentity } from './mesh3d-identity';
import { buildMeshName, type MeshNameCharset } from './mesh3d-naming';

/**
 * Ο three κόσμος είναι **σε μέτρα** by construction (`sceneUnitsToMeters`, ADR-462). Άρα ο
 * συντελεστής είναι «μέτρα → μονάδα-στόχος».
 */
const SCALE_FROM_METERS: Readonly<Record<ExportLengthUnit, number>> = {
  meters: 1,
  centimeters: 100,
  millimeters: 1000,
};

export function unitScaleFromMeters(unit: ExportLengthUnit): number {
  return SCALE_FROM_METERS[unit];
}

export interface MeshNamingPlan {
  /**
   * `levelId → εμφανιζόμενο όνομα ορόφου`. Κάθε mesh παίρνει το πρόθεμα **του δικού του**
   * ορόφου (το `levelId` ζει στο `userData`), γι' αυτό map και όχι ένα string: στο `all-single`
   * συνυπάρχουν πολλοί όροφοι στο ΙΔΙΟ αρχείο. **Κενό map ⇒ κανένα πρόθεμα ορόφου** — αυτό
   * θέλουν τα `active` / `all-zip`, όπου ο όροφος είναι ήδη στο όνομα του αρχείου.
   */
  readonly floorNameByLevelId: ReadonlyMap<string, string>;
  /** ADR-668 — ids που η οθόνη έκρυβε· παίρνουν πρόθεμα `HIDDEN_`. */
  readonly hiddenEntityIds: ReadonlySet<string>;
  readonly charset: MeshNameCharset;
}

/**
 * Ονοματίζει **κάθε** mesh — η θεραπεία του «στο C4D είναι μία ενιαία οντότητα».
 *
 * Δύο meshes μπορούν νόμιμα να μοιράζονται `bimId` (π.χ. ένας τοίχος με ανοίγματα σπάει σε
 * κομμάτια κάτω από ένα group). Διπλά `o` ονόματα κάνουν κάποιους importers να τα συγχωνεύσουν,
 * οπότε τα διπλά παίρνουν αριθμητικό επίθεμα: `…_Wall_w-42`, `…_Wall_w-42_2`.
 *
 * @returns πλήθος meshes που ονομάστηκαν
 */
export function nameMeshesForExport(root: THREE.Object3D, plan: MeshNamingPlan): number {
  const used = new Map<string, number>();
  let index = 0;
  let named = 0;

  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.isMesh !== true) return;

    index += 1;
    const identity = resolveBimMeshIdentity(mesh);
    const base = buildMeshName(identity, index, {
      floorName: (identity.levelId !== null ? plan.floorNameByLevelId.get(identity.levelId) : undefined) ?? '',
      hidden: identity.bimId !== null && plan.hiddenEntityIds.has(identity.bimId),
      charset: plan.charset,
    });
    const seen = used.get(base) ?? 0;
    used.set(base, seen + 1);
    mesh.name = seen === 0 ? base : `${base}_${seen + 1}`;
    named += 1;
  });

  return named;
}

/**
 * Εφαρμόζει τη μονάδα στη ρίζα. **Μόνο για OBJ** — το glTF είναι spec-locked σε μέτρα.
 *
 * Γιατί στη ρίζα και όχι bake στα vertices: ο `OBJExporter` κάνει ήδη `applyMatrix4(matrixWorld)`
 * ανά vertex, οπότε ένα `scale` στη ρίζα ψήνεται σωστά στις εξαγόμενες συντεταγμένες, χωρίς να
 * αγγίξουμε geometry buffers (που είναι κοινά/cached).
 */
export function applyExportUnit(root: THREE.Object3D, unit: ExportLengthUnit): void {
  const s = unitScaleFromMeters(unit);
  root.scale.setScalar(s);
  root.updateMatrixWorld(true);
}

/**
 * ADR-449 Slice 7 — Merged Structural Silhouette 3D: bands → THREE.Group (σοβάς).
 *
 * Ο pure `computeStructuralSilhouetteBands` δίνει, ανά κατακόρυφη ζώνη, τις
 * ΕΝΙΑΙΕΣ finish faces (union δομικών cores − τοίχοι ως obstacles). Εδώ τις χτίζουμε
 * σε mitered band prisms μέσω του ΥΠΑΡΧΟΝΤΟΣ `buildFinishSkinFromFaces` (ίδιο SSoT
 * με το per-element 3D· `bimType:'column'` → καθαρά miters, μηδέν chamfer αφού το
 * outline είναι ήδη ενιαίο). Κάθε ζώνη στοιβάζεται στο σωστό `baseY` (building base +
 * z-bottom). ΕΝΑ scene-level group αντικαθιστά τα per-element skins (Slice 7).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-449-structural-finish-skin.md §3.septies
 */

import * as THREE from 'three';
import type { SceneUnits } from '../../utils/scene-units';
import type { SilhouetteBand } from '../../bim/finishes/structural-finish-silhouette';
import { buildFinishSkinFromFaces } from './structural-finish-3d';

const MM_TO_M = 0.001;

/** Σταθερό id για το ενιαίο silhouette skin group (visibility gate = global). */
const SILHOUETTE_ID = 'structural-finish-silhouette';

/**
 * ADR-449 Slice X1 — no-op raycast: το merged silhouette skin είναι **παράγωγη
 * διακόσμηση**, ΟΧΙ ανεξάρτητα επιλέξιμο. Επειδή η ενιαία γεωμετρία μοιράζεται ΕΝΑ
 * synthetic `bimId` ανά κτίριο (δεν αποδίδεται σε μεμονωμένο στοιχείο), αν ήταν pickable
 * το κλικ σε οποιαδήποτε σοβατισμένη όψη θα επέλεγε ΟΛΟ τον σοβά του κτιρίου. Κάνοντάς το
 * μη-pickable, το ray **περνά μέσα του** και χτυπά τον δομικό πυρήνα από πίσω → το κλικ
 * επιλέγει το σωστό δοκάρι/κολόνα (όπως το per-element). Mirror THREE «non-raycastable mesh».
 */
const NOOP_RAYCAST: THREE.Mesh['raycast'] = () => {};

/** Κάνει ΟΛΑ τα meshes του silhouette skin μη-pickable (το ray τα προσπερνά). */
function makeSkinNonPickable(group: THREE.Group): void {
  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) (obj as THREE.Mesh).raycast = NOOP_RAYCAST;
  });
}

/**
 * Χτίζει ΕΝΑ `THREE.Group` με τα mitered band prisms του ενιαίου σοβά, ή `null` όταν
 * δεν υπάρχει καμία ζώνη. `buildingBaseElevationM` = world datum (το z-bottom κάθε
 * ζώνης προστίθεται από πάνω). `id` (προαιρετικό) επιτρέπει per-building tagging.
 */
export function buildStructuralSilhouetteSkin(
  bands: readonly SilhouetteBand[],
  sceneUnits: SceneUnits,
  buildingBaseElevationM: number,
  levelId?: string,
  id: string = SILHOUETTE_ID,
): THREE.Group | null {
  if (bands.length === 0) return null;
  const group = new THREE.Group();
  for (const band of bands) {
    const heightM = (band.zTopMm - band.zBottomMm) * MM_TO_M;
    if (heightM <= 0) continue;
    const baseY = buildingBaseElevationM + band.zBottomMm * MM_TO_M;
    const sub = buildFinishSkinFromFaces(band.faces, sceneUnits, heightM, baseY, id, 'column', levelId);
    if (sub) while (sub.children.length) group.add(sub.children[0]);
  }
  if (group.children.length === 0) return null;
  group.userData['bimId'] = id;
  group.userData['bimType'] = 'column';
  group.userData['structuralFinish'] = true;
  // ADR-449 Slice X1 — μη-pickable: κλικ σε σοβατισμένη όψη επιλέγει τον δομικό πυρήνα
  // από πίσω (όχι ολόκληρο τον merged σοβά του κτιρίου, που μοιράζεται synthetic bimId).
  makeSkinNonPickable(group);
  return group;
}

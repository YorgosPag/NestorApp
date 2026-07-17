/**
 * ADR-449 Slice 7 — Merged Structural Silhouette 3D: bands → THREE.Group (σοβάς).
 *
 * Ο pure `computeStructuralSilhouetteBands` δίνει, ανά κατακόρυφη ζώνη, τις ΕΝΙΑΙΕΣ finish
 * faces (union δομικών cores − τοίχοι ως obstacles). ADR-449 Slice X6: τις περνάμε από τον
 * κάθετο band-merge (`mergeSilhouetteBandsToStrips`) → τα z-γειτονικά ταυτόσημα quads (ελεύθερες
 * παρειές) ενώνονται σε ΕΝΑ `FinishStrip` δάπεδο→κορυφή, και ο `buildFinishSkinFromStrips` εξωθεί
 * **ένα prism ανά strip** → μηδέν οριζόντια ραφή στο soffit (ήταν: ένα prism ανά band → στοιβαγμένα
 * prisms/ραφή). ΕΝΑ scene-level group αντικαθιστά τα per-element skins (Slice 7).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-449-structural-finish-skin.md §3.septies
 */

import * as THREE from 'three';
import type { SceneUnits } from '../../utils/scene-units';
import type { SilhouetteBand } from '../../bim/finishes/structural-finish-silhouette';
import { mergeSilhouetteBandsToStrips } from '../../bim/finishes/structural-finish-vertical-merge';
import { buildFinishSkinFromStrips } from './structural-finish-3d';
import { stampBimIdentity } from './bim-three-shape-helpers';

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
  // ADR-449 Slice X6 — κάθετος band-merge: τα z-γειτονικά ταυτόσημα quads (ελεύθερες παρειές)
  // ενώνονται σε ΕΝΑ strip δάπεδο→κορυφή → μηδέν οριζόντια ραφή στο soffit. Παρειά που την κόβει
  // δοκάρι → το quad διαφέρει πάνω από το soffit → δεν ενώνεται → καθαρό τέλος (καπάκι) στο soffit.
  const strips = mergeSilhouetteBandsToStrips(bands, sceneUnits);
  const group = buildFinishSkinFromStrips(strips, sceneUnits, buildingBaseElevationM, id, 'column', levelId);
  if (!group) return null;
  stampBimIdentity(group, { bimId: id, bimType: 'column' });
  group.userData['structuralFinish'] = true;
  // ADR-449 Slice X1 — μη-pickable: κλικ σε σοβατισμένη όψη επιλέγει τον δομικό πυρήνα
  // από πίσω (όχι ολόκληρο τον merged σοβά του κτιρίου, που μοιράζεται synthetic bimId).
  makeSkinNonPickable(group);
  return group;
}

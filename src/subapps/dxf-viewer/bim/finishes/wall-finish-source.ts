/**
 * ADR-449 Slice X3 — Ο ΤΟΙΧΟΣ ως finish-member της ενιαίας σιλουέτας σοβά.
 *
 * Πρόβλημα (Giorgio): ο τοίχος δεν δείχνει σοβά να **τυλίγει** περιμετρικά ούτε να
 * **σβήνει στις επαφές**· έδειχνε μόνο τις διαχωριστικές γραμμές των DNA layers
 * (`wall-layer-lines-2d.ts`), που δεν ενώνονται στις συμβολές. Οι κολόνες/δοκάρια έχουν
 * ήδη τέτοιο σοβά μέσω ADR-449 (merged silhouette + contact subtraction)· ο τοίχος ήταν
 * ο ΜΟΝΟΣ δομικός τύπος που έλειπε — και μάλιστα μπαίνει μόνο ως **obstacle**.
 *
 * Λύση (FULL SSoT, big-player/Revit-superior): κάνε τον τοίχο **`SilhouetteMember`** της
 * ΙΔΙΑΣ `computeStructuralSilhouetteBands` με κολόνες/δοκάρια. Το `safeUnion` ανά z-band
 * ενώνει το core του τοίχου με τα γειτονικά μέλη → ο σοβάς τυλίγει το ΕΝΙΑΙΟ περίγραμμα
 * (έξω) + κάθε δωμάτιο (τρύπες) και **εξαφανίζεται αυτόματα στις συμβολές** (η εσωτερική
 * ακμή χάνεται στο union — αυτό είναι το «σβήνει στις επαφές»). Το Revit ΔΕΝ ενώνει
 * finish faces στην κάτοψη· εμείς ναι.
 *
 * SSoT πηγή πάχους/υλικού = το **DNA του τοίχου** (ADR-447), ΟΧΙ νέο `finish` spec (που θα
 * ήταν διπλό). Slice X3 (αυτή η φάση): το core footprint = `inset(full footprint, skin)`
 * ώστε ο resolver να προσθέσει `skin` και ο σοβάς να φτάσει **ακριβώς** στην επιφάνεια του
 * τοίχου — ενιαίο πάχος (default 15mm), συνεπές με κολόνα/δοκάρι. Ακριβές ασύμμετρο
 * exterior/interior πάχος από τα DNA layers = επόμενο slice.
 *
 * Pure: μηδέν globals/React/THREE/scene. REUSE-only (`wallFootprintPolygon` +
 * `insetPolygonMiter`) — μηδέν νέα boolean/offset λογική.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-449-structural-finish-skin.md
 * @see ./structural-finish-scene-silhouette.ts — ο μοναδικός consumer (adapter)
 */

import type { WallDna } from '../types/wall-dna-types';
import { insetPolygonMiter } from '../geometry/shared/polygon-offset-utils';
import { mmToSceneUnits } from '../../utils/scene-units';
import { wallFootprintPolygon, type WallFinishObstacle } from './structural-finish-scene';
import type { SilhouetteMember } from './structural-finish-silhouette';

/**
 * True όταν ο τοίχος φέρει στρώση σοβά/φινιρίσματος (DNA layer με `side !== 'core'`) →
 * δικαιούται finish skin (γίνεται member). Μονόστρωτοι core-only τοίχοι (parapet RC,
 * fence stone) → `false` → παραμένουν obstacles (κόβουν τον σοβά γειτόνων, δεν παίρνουν).
 */
export function wallHasPlasterSkin(dna: WallDna | undefined): boolean {
  return !!dna && dna.layers.some((l) => l.side !== 'core');
}

/**
 * Ο τοίχος → `SilhouetteMember`. Το core footprint = `inset(full footprint, skinMm)`,
 * ώστε ο resolver (που προσθέτει `skinMm` σοβά outward) να φτάσει ακριβώς στην εξωτερική
 * επιφάνεια του τοίχου → ο σοβάς-ζώνη ταυτίζεται με τα DNA plaster layers, τυλίγει, και
 * σβήνει στις συμβολές μέσω union. `null` όταν: ο τοίχος δεν έχει σοβά (parapet/fence/bare),
 * `skinMm ≤ 0`, ή το inset καταρρέει (τοίχος λεπτότερος από 2× σοβά).
 *
 * Το `zExtent` (building-relative mm, height-aware) δίνεται από τον adapter (που ξέρει τα
 * beam undersides για attached-top στηρίγματα) → εδώ μένει pure geometry.
 */
export function wallToSilhouetteMember(
  wall: WallFinishObstacle,
  skinMm: number,
  zExtent: { readonly zBotMm: number; readonly zTopMm: number },
): SilhouetteMember | null {
  if (skinMm <= 0 || !wallHasPlasterSkin(wall.params.dna)) return null;
  const full = wallFootprintPolygon(wall);
  if (full.length < 3) return null;
  const s = mmToSceneUnits(wall.params.sceneUnits ?? 'mm');
  const core = insetPolygonMiter(full, skinMm * s);
  if (!core || core.length < 3) return null;
  return { footprint: core, zBotMm: zExtent.zBotMm, zTopMm: zExtent.zTopMm };
}

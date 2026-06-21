/**
 * ADR-449 Slice X3/X4 — Ο ΤΟΙΧΟΣ ως finish-member της ενιαίας σιλουέτας σοβά.
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
 * (έξω) + κάθε δωμάτιο (τρύπες) και **εξαφανίζεται αυτόματα στις συμβολές**.
 *
 * ADR-449 Slice X4 (Giorgio 2026-06-21, «όπως οι μεγάλοι παίκτες / Revit»): ο σοβάς **ΔΕΝ**
 * είναι DNA layer πια. Πηγή πάχους/υλικού = το **`WallParams.finish`** spec (mirror
 * `ColumnParams.finish`/`BeamParams.finish`), ΟΧΙ το DNA. Το core footprint = το **πλήρες
 * δομικό** footprint (πλέον καθαρός πυρήνας, αφού το DNA δεν έχει σοβά) **χωρίς inset** →
 * ο resolver προσθέτει τον σοβά **outward → ΠΡΟΕΞΕΧΕΙ** ακριβώς όπως κολόνα/δοκάρι.
 *
 * Migration (runtime-tolerate, μηδέν data loss): παλιός persisted τοίχος έχει DNA με σοβά
 * ΑΛΛΑ ΟΧΙ `finish` spec → **legacy**: ΔΕΝ γίνεται member (μένει obstacle + DNA σοβά-γραμμές,
 * παλιά συμπεριφορά) → μηδέν διπλός σοβάς. Νέος τοίχος (DNA χωρίς σοβά + `finish`) → member.
 *
 * Pure: μηδέν globals/React/THREE/scene. REUSE-only (`wallFootprintPolygon`).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-449-structural-finish-skin.md
 * @see ./structural-finish-scene-silhouette.ts — ο μοναδικός consumer (adapter)
 */

import type { WallDna } from '../types/wall-dna-types';
import { isFinishActive } from './structural-finish-types';
import { wallFootprintPolygon, type WallFinishObstacle } from './structural-finish-scene';
import type { SilhouetteMember } from './structural-finish-silhouette';

/** Prefix υλικού σοβά (εσωτ./εξωτ. Knauf/θερμοπρόσοψη) — legacy DNA plaster detection. */
const PLASTER_MATERIAL_PREFIX = 'mat-plaster';

/**
 * ADR-449 Slice X4 — `true` όταν το DNA φέρει **σοβά ως layer** (legacy composition, ADR-447
 * pre-X4): στρώση με υλικό `mat-plaster-*` σε μη-`core` παρειά. Τέτοιος τοίχος (αν δεν έχει
 * ΚΑΙ `finish` spec) είναι **legacy** → κρατά τον DNA σοβά (γραμμές) και ΔΕΝ γίνεται finish-
 * member → μηδέν διπλός σοβάς. Η μόνωση (EPS, `mat-eps`) ΔΕΝ είναι σοβάς → δεν μετράει εδώ.
 */
export function wallDnaHasPlaster(dna: WallDna | undefined): boolean {
  return !!dna && dna.layers.some((l) => l.side !== 'core' && l.materialId.startsWith(PLASTER_MATERIAL_PREFIX));
}

/**
 * ADR-449 Slice X4 — **ΤΟ** SSoT predicate «ο τοίχος δικαιούται additive σοβά» (finish-member).
 * `true` ΜΟΝΟ όταν: (1) έχει ενεργό `finish` spec (νέος X4 τοίχος) ΚΑΙ (2) το DNA του ΔΕΝ φέρει
 * legacy σοβά-layer (αλλιώς = legacy → obstacle + DNA γραμμές, μηδέν διπλό). Το διαβάζουν **και**
 * ο κάθετος σοβάς (`wallToSilhouetteMember`) **και** το horizontal top-cap (scene-horizontal) →
 * ΕΝΑ σημείο αλήθειας για το «είναι σοβατισμένος τοίχος;» (περιμετρικό ↔ κορυφή συνεπή).
 */
export function wallIsFinishMember(wall: WallFinishObstacle): boolean {
  return isFinishActive(wall.params.finish) && !wallDnaHasPlaster(wall.params.dna);
}

/**
 * Ο τοίχος → `SilhouetteMember` (X4: core = **πλήρες** footprint, χωρίς inset → ο σοβάς
 * προεξέχει). Γίνεται member ΜΟΝΟ όταν {@link wallIsFinishMember}· `null` αλλιώς (legacy /
 * bare parapet-fence / εκφυλισμένο footprint).
 *
 * Το `zExtent` (building-relative mm, height-aware) δίνεται από τον adapter (που ξέρει τα
 * beam undersides για attached-top στηρίγματα) → εδώ μένει pure geometry. Το πάχος/υλικό
 * του σοβά παράγεται downstream από το ΕΝΙΑΙΟ spec της σιλουέτας (ομοιόμορφο κέλυφος).
 */
export function wallToSilhouetteMember(
  wall: WallFinishObstacle,
  zExtent: { readonly zBotMm: number; readonly zTopMm: number },
): SilhouetteMember | null {
  if (!wallIsFinishMember(wall)) return null;
  const full = wallFootprintPolygon(wall);
  if (full.length < 3) return null;
  return { footprint: full, zBotMm: zExtent.zBotMm, zTopMm: zExtent.zTopMm };
}

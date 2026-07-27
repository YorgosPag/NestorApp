/**
 * entity-area-facts — SSoT για **ΕΝΑ** ερώτημα: «τι εμβαδόν δίνει αυτή η οντότητα;»
 *
 * Το εργαλείο «Ετικέτα Εμβαδού» (ADR-649) ήταν δεμένο στη γραμμοσκίαση σε **πέντε**
 * σημεία (pick, hover-highlight, FSM, κείμενο, entity builder). Προσθέτοντας δεύτερο
 * τύπο με `isTopoSurfaceEntity` σε καθένα, θα γεννιόνταν πέντε sibling clones (N.18).
 * Εδώ απαντιέται **μία φορά** ποιοι τύποι έχουν μετρήσιμο εμβαδόν και πόσο είναι — και
 * οι πέντε καταναλωτές ρωτούν αυτό. Νέος τύπος ⇒ αλλαγή **μόνο** σε αυτό το αρχείο.
 *
 * ΔΥΟ ΑΡΙΘΜΟΙ, ΟΧΙ ΕΝΑΣ (απόφαση Giorgio 2026-07-27, Civil 3D «2D Area» / «3D Area»):
 * μια επίπεδη οντότητα (γραμμοσκίαση) έχει **μόνο** εμβαδόν προβολής ⇒ `surface3DMm2 = null`
 * («δεν υπάρχει η έννοια», ΟΧΙ 0 — το 0 θα σήμαινε «μηδενική επιφάνεια»). Μια τοπογραφική
 * επιφάνεια έχει και τα δύο, και η διαφορά τους είναι πληροφορία που πληρώνεται.
 *
 * ΠΟΙΑ ΓΕΩΜΕΤΡΙΑ ΡΩΤΑΕΙ Ο ΚΑΘΕ ΤΥΠΟΣ — **σκόπιμα διαφορετική**, μην τα ενοποιήσεις:
 *   - γραμμοσκίαση → `computeHatchAreaMm2` = outer **−** islands (even-odd, ίδιο με το
 *     hit-test της· τα boundaryPaths ΕΙΝΑΙ outer-minus-holes εξ ορισμού).
 *   - τοπογραφική  → `topoSurfaceAreas(getTopoSurface(id))` = άθροισμα **τριγώνων**, ΟΧΙ
 *     rings. Τα footprint rings είναι «outer + hole loops» χωρίς αξιόπιστο προσανατολισμό
 *     ⇒ κάθε πράξη πάνω τους δίνει λάθος αριθμό (βλ. `topo-surface-area.ts`).
 *
 * ΔΕΝ είναι pure: το `getTopoSurface` διαβάζει το cached TIN store. Καλείται σε **event
 * time** (κλικ/hover), ποτέ σε render path — ίδιο μοτίβο με τους υπόλοιπους event-time
 * readers (ADR-040). Ο υπολογιστικός πυρήνας (`topoSurfaceAreas`) είναι pure και εκεί
 * ζουν τα tests των αριθμών.
 *
 * @see ../topography/topo-surface-area.ts — ο pure πυρήνας των δύο εμβαδών
 * @see ./area-label.ts — ο καταναλωτής που τα μετατρέπει σε κείμενο ετικέτας
 * @see docs/centralized-systems/reference/adrs/ADR-649-hatch-area-label-tool.md
 */

import type { Entity } from '../../types/entities';
import { isHatchEntity, isTopoSurfaceEntity } from '../../types/entities';
import { computeHatchAreaMm2 } from '../../bim/hatch/hatch-completion';
import { getTopoSurface } from '../topography/topo-surface';
import { topoSurfaceAreas } from '../topography/topo-surface-area';

/** Τα μετρήσιμα εμβαδά μιας οντότητας, σε canonical mm² (ADR-462). */
export interface EntityAreaFacts {
  /** Εμβαδόν προβολής σε κάτοψη — υπάρχει πάντα όταν η οντότητα έχει εμβαδόν. */
  readonly plan2DMm2: number;
  /**
   * Πραγματική επιφάνεια στον χώρο, ή `null` όταν η οντότητα είναι **επίπεδη** και η
   * έννοια δεν υφίσταται. `null` ≠ `0`: το 0 θα ήταν ισχυρισμός για μηδενική επιφάνεια.
   */
  readonly surface3DMm2: number | null;
}

/**
 * Τα εμβαδά της οντότητας, ή `null` αν ο τύπος **δεν** έχει έννοια εμβαδού (γραμμή,
 * κείμενο, BIM, …). Το `null` είναι η απάντηση «δεν μετριέται», όχι σφάλμα.
 */
export function entityAreaFacts(entity: Entity): EntityAreaFacts | null {
  if (isHatchEntity(entity)) {
    return { plan2DMm2: computeHatchAreaMm2(entity), surface3DMm2: null };
  }
  if (isTopoSurfaceEntity(entity)) {
    const areas = topoSurfaceAreas(getTopoSurface(entity.surfaceId));
    if (areas.triangleCount === 0) return null; // καμία τριγωνοποιήσιμη επιφάνεια
    return { plan2DMm2: areas.plan2DMm2, surface3DMm2: areas.surface3DMm2 };
  }
  return null;
}

/**
 * Το predicate του pick/hover: «μπορεί αυτή η οντότητα να δώσει ετικέτα εμβαδού;».
 * Περνά στο `pickTopEntityAt`, το οποίο εφαρμόζει το **σωστό ανά τύπο** hit-test
 * (γραμμοσκίαση = even-odd, τοπογραφική = οποιοδήποτε ring) — γι' αυτό ΔΕΝ χρειάζεται
 * ξεχωριστός picker ανά τύπο.
 */
export function hasMeasurableArea(entity: Entity): boolean {
  return entityAreaFacts(entity) !== null;
}

/**
 * resolve-dxf-marquee-selection — SSoT για το «πώς ένα MARQUEE πάνω σε raw DXF οντότητες
 * μεταλλάσσει την ενιαία επιλογή» (ADR-692 Φ2).
 *
 * Αδελφός του {@link ./resolve-dxf-entity-click} (single-click, PICKADD=1) για τη μαζική
 * διαδρομή: εδώ ο συνδυασμός δεν προκύπτει από «υπάρχει ήδη επιλογή;» αλλά από το modifier
 * που πάγωσε στο mousedown — γι' αυτό delegate-άρει στο κοινό {@link combineMarqueeSelection}
 * (το ίδιο που χρησιμοποιεί και το BIM marquee) και δεν ξαναγράφει add/subtract math.
 *
 * ΓΙΑΤΙ ΠΕΡΝΑΕΙ ΡΗΤΑ ΤΟ `previousIds` ΑΝΤΙ ΝΑ ΔΙΑΒΑΣΕΙ ΤΟ STORE:
 * στην 3D διαδρομή η BIM επιλογή γράφεται ΠΡΩΤΗ και ο 3D→universal bridge κάνει
 * `replaceEntitySelection([bimIds])` — που καθαρίζει ΟΛΟ τον `dxf-entity` κουβά (BIM και raw
 * DXF ζουν εκεί με τον ΙΔΙΟ τύπο). Άρα το «τι ήταν επιλεγμένο πριν» πρέπει να έχει
 * φωτογραφηθεί ΠΡΙΝ από εκείνη την εγγραφή· ένα read εδώ θα διάβαζε ήδη-σβησμένη κατάσταση
 * και το Shift+drag (add) θα έχανε την προηγούμενη επιλογή.
 *
 * Pure routing — καμία δική του κατάσταση, Jest-friendly.
 */

import { combineMarqueeSelection, type MarqueeCombineMode } from './marquee-combine';

export interface DxfMarqueeSelectionOps {
  /** Πρόσθεσε τα ids στην επιλογή (χωρίς να πειράξεις ό,τι άλλο υπάρχει). Idempotent. */
  add(entityIds: readonly string[]): void;
  /** Βγάλε ΕΝΑ id από την επιλογή. No-op αν δεν είναι επιλεγμένο. */
  remove(entityId: string): void;
}

/**
 * Εφάρμοσε το αποτέλεσμα ενός marquee πάνω στα raw DXF ids.
 *
 * @param previousIds τα raw-DXF ids που ήταν επιλεγμένα ΠΡΙΝ τη χειρονομία (βλ. σχόλιο module)
 * @param hitIds      τα ids που έπιασε το ορθογώνιο
 * @param mode        replace / add / subtract (παγωμένο στο mousedown)
 */
export function applyDxfMarqueeSelection(
  previousIds: readonly string[],
  hitIds: readonly string[],
  mode: MarqueeCombineMode,
  ops: DxfMarqueeSelectionOps,
): void {
  const finalIds = combineMarqueeSelection(previousIds, hitIds, mode);
  const finalSet = new Set(finalIds);
  // Πρώτα οι αφαιρέσεις: ό,τι ήταν επιλεγμένο και δεν επιβιώνει (replace/subtract).
  for (const id of previousIds) {
    if (!finalSet.has(id)) ops.remove(id);
  }
  if (finalIds.length > 0) ops.add(finalIds);
}

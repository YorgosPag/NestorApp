'use client';

/**
 * ADR-739 §40.8 — **Ο ΕΝΑΣ ΤΡΟΠΟΣ ΠΟΥ Η ΛΕΙΤΟΥΡΓΙΑ ΠΙΝΑΚΑ ΠΙΑΝΕΙ ΤΟ `mousedown` ΤΟΥ ΚΑΜΒΑ.**
 *
 * ## Γιατί υπάρχει — το CHECK 3.28 το ονόμασε, και είχε δίκιο
 * Δύο ακροατές της λειτουργίας πίνακα ζητούν **ακριβώς** το ίδιο πράγμα: «όσο είμαι ενεργός,
 * άκου `mousedown` στο δοχείο του καμβά σε **σύλληψη**, και ξεγράψου καθαρά». Ο pointer
 * (§26.15) και το ⊕ της εισαγωγής (§40). Γράφτηκαν χωριστά, σε διαφορετικές μέρες, με το
 * ίδιο σχήμα — και το jscpd τους χαρακτήρισε sibling clones τη στιγμή που το §40.8 άγγιξε
 * και τα δύο (N.18).
 *
 * 🔑 **Η κοινή γνώση δεν είναι ο κώδικας — είναι η ΦΑΣΗ.** Και οι δύο πρέπει να προλάβουν
 * τον χειριστή επιλογής/σύρσης του καμβά, που ζει στο **ίδιο** δοχείο· η σειρά εγγραφής
 * ακροατών δεν είναι συμβόλαιο, η φάση είναι. Δύο αντίγραφα σημαίνουν ότι μια μελλοντική
 * αλλαγή (άλλη φάση, άλλος κόμβος) θα εφαρμοζόταν στο ένα και όχι στο άλλο — δηλαδή ο ένας
 * χειριστής θα άκουγε μετά τον καμβά, σιωπηλά, και μόνο σε ορισμένες χειρονομίες.
 *
 * ## Τι ΔΕΝ αναλαμβάνει
 * Καμία απόφαση για το συμβάν. Δεν καταναλώνει, δεν αναιρεί προεπιλογή, δεν ρωτά γεωμετρία —
 * αυτά ανήκουν στους δύο καλούντες και **διαφέρουν ουσιωδώς** (ο pointer δεν καταναλώνει
 * ποτέ· το ⊕ καταναλώνει πάντα όταν είναι οπλισμένο). Η εξαγωγή είναι της **προσάρτησης**,
 * όχι της πολιτικής.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/use-table-container-mousedown
 * @see ui/table-cell-editor/use-table-cell-pointer.ts — ο ένας καλών (§26.15)
 * @see ui/table-cell-editor/use-table-insert-control-click.ts — ο άλλος (§40)
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §40.8
 */

import { useEffect, type RefObject } from 'react';
import { useEventCallback } from '@/hooks/useEventCallback';

export interface UseTableContainerMouseDownParams {
  /** Προσαρτάται ο ακροατής; Η συνθήκη ζωής του καλούντος, αυτούσια. */
  readonly active: boolean;
  readonly containerRef: RefObject<HTMLDivElement | null>;
  /** Ο χειριστής. Η ταυτότητά του **οφείλει** να είναι σταθερή (`useEventCallback`). */
  readonly onMouseDown: (event: MouseEvent) => void;
  /**
   * Ό,τι άλλο οφείλει να τελειώσει μαζί με τον ακροατή — χειρονομίες που ζουν στο `document`
   * και **δεν** θα έφευγαν μόνες τους (§27.15/§31.9).
   *
   * Τυλίγεται εδώ σε σταθερή ταυτότητα **επίτηδες**: αν το κουβαλούσε ο καλών, η πρώτη φορά
   * που κάποιος έγραφε inline συνάρτηση θα ξανάγραφε τον ακροατή σε **κάθε απόδοση** — δηλαδή
   * σε κάθε πάτημα πλήκτρου μέσα στον πίνακα, με το cleanup να σκοτώνει τη σύρση στη γέννα
   * (το ακριβές σφάλμα του §27.16 Ε6). Ο κανόνας δεν αφήνεται σε σύμβαση που πρέπει να
   * θυμάται κανείς.
   */
  readonly onDetach?: () => void;
}

/** Προσαρτά έναν ακροατή `mousedown` **σύλληψης** στο δοχείο του καμβά, όσο ζει το `active`. */
export function useTableContainerMouseDown(params: UseTableContainerMouseDownParams): void {
  const { active, containerRef, onMouseDown, onDetach } = params;

  const detach = useEventCallback((): void => {
    onDetach?.();
  });

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('mousedown', onMouseDown, { capture: true });
    return () => {
      container.removeEventListener('mousedown', onMouseDown, { capture: true });
      detach();
    };
  }, [active, containerRef, onMouseDown, detach]);
}

'use client';
/**
 * @fileoverview **Η θυρίδα ενεργειών του φύλλου κινητού** — πού αποδίδει τις ενέργειές της μια κεφαλίδα οντότητας όταν
 *   ζει μέσα σε `MobileDetailsSlideIn`.
 * @related ADR-912 §12 · `MobileDetailsSlideIn.tsx` (ο πάροχος) · `core/entity-headers/UnifiedEntityHeaderSystem.tsx` (ο καταναλωτής)
 * @module core/layouts/details-sheet-actions
 *
 * 🔴 **Η αφορμή, μετρημένη 2026-10-11 στα 390px**: οι κεφαλίδες οντότητας ήταν τυλιγμένες σε `hidden md:block` για να
 *   μη φαίνεται ο τίτλος δύο φορές — και μαζί του χάθηκαν **οι ενέργειες**. Η φόρμα κτιρίου δεν ξεκλείδωνε από κινητό.
 * 🔑 **Η μπάρα του φύλλου ΕΙΝΑΙ η μπάρα ενεργειών** (Material full-screen dialog · iOS navigation bar): ο τίτλος
 *   λέγεται εκεί μία φορά, και οι ενέργειες που **δήλωσε η κεφαλίδα** αποδίδονται εκεί — καμία σελίδα δεν γράφει
 *   κουμπιά για το κινητό.
 * 🔑 **`null` = εκτός φύλλου· αντικείμενο με `host: null` = μέσα σε φύλλο που δεν έχει ζωγραφιστεί ακόμη.** Η διάκριση
 *   κρατά την κεφαλίδα από το να ζωγραφίσει τη desktop όψη της για ένα καρέ πριν βρεθεί ο ξενιστής.
 */
import { createContext, useContext } from 'react';

export interface DetailsSheetActionsSlot {
  /** Το στοιχείο της μπάρας όπου μπαίνουν οι ενέργειες· `null` ώσπου να στηθεί η μπάρα. */
  readonly host: HTMLElement | null;
}

const DetailsSheetActionsContext = createContext<DetailsSheetActionsSlot | null>(null);

export const DetailsSheetActionsProvider = DetailsSheetActionsContext.Provider;

/** `null` ⇒ η κεφαλίδα δεν ζει μέσα σε φύλλο κινητού και αποδίδει τις ενέργειές της επιτόπου. */
export function useDetailsSheetActions(): DetailsSheetActionsSlot | null {
  return useContext(DetailsSheetActionsContext);
}

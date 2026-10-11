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
import { createContext, useContext, type ReactNode } from 'react';

/**
 * **Η «Ακύρωση» της επεξεργασίας, όπως την αναλαμβάνει ο ✕ της μπάρας** (ADR-912 §12.5).
 *
 * 🔴 **Η αφορμή, μετρημένη 2026-10-11 στα 390px**: «Αποθήκευση» 130px + «Ακύρωση» 110px + 8 = 248px σε θυρίδα
 *   147–239px ⇒ η «Ακύρωση» έπεφτε στο «⋯» (στα ακίνητα: μενού **ενός** στοιχείου), ενώ ο ✕ δίπλα της έκλεινε το
 *   φύλλο **χωρίς ερώτηση** και μαζί του χάνονταν οι αλλαγές.
 * 🔑 Όσο τρέχει επεξεργασία, ο ✕ **είναι** η Ακύρωση (Επαφές του iOS: «Άκυρο» στη θέση του «Πίσω» · Material
 *   full-screen dialog: ✕ = απόρριψη, επιβεβαίωση μόνο αν υπάρχουν αλλαγές). Η μπάρα κρατά μόνο την «Αποθήκευση».
 */
export interface DetailsSheetDismissal {
  /** Το όνομα προσβασιμότητας του ✕ όσο τρέχει η επεξεργασία (η ετικέτα της ίδιας της ενέργειας). */
  readonly label: string;
  readonly onDismiss: () => void;
  /** Π.χ. όσο τρέχει η αποθήκευση: ο ✕ δεν εγκαταλείπει πράξη που εκτελείται. */
  readonly disabled?: boolean;
  /**
   * Θα χαθούν αλλαγές; `false` = η φόρμα **δήλωσε** ότι δεν έχει τίποτα να χάσει ⇒ χωρίς ερώτηση.
   * ⚠️ `undefined` = η φόρμα **δεν ξέρει** ⇒ ρωτάμε: το άγνωστο δεν δηλώνει ποτέ «καθαρό».
   */
  readonly discards?: boolean;
}

export interface DetailsSheetActionsSlot {
  /** Το στοιχείο της μπάρας όπου μπαίνουν οι ενέργειες· `null` ώσπου να στηθεί η μπάρα. */
  readonly host: HTMLElement | null;
  /**
   * Ο τίτλος της μπάρας **κόβεται** αυτή τη στιγμή (μετρημένο, όχι εικασία από το μήκος) ⇒ η κεφαλίδα γράφει το πλήρες
   * όνομα στη λωρίδα της (HIG large title · Material medium app bar: το όνομα ολόκληρο **κάτω** από την μπάρα).
   */
  readonly titleTruncated: boolean;
  /** Η κεφαλίδα δηλώνει (ή αποσύρει με `null`) την Ακύρωση της επεξεργασίας. Σταθερή ταυτότητα. */
  readonly claimDismissal: (dismissal: DetailsSheetDismissal | null) => void;
}

const DetailsSheetActionsContext = createContext<DetailsSheetActionsSlot | null>(null);

export const DetailsSheetActionsProvider = DetailsSheetActionsContext.Provider;

/**
 * **Σύνορο**: ό,τι ζει εδώ μέσα ΔΕΝ ανήκει στο φύλλο κινητού, ακόμη κι αν **ανοίχτηκε** από αυτό.
 *
 * 🔴 Το context της React **περνά μέσα από portal**: συρτάρι ή διάλογος που ανοίγει από το περιεχόμενο του φύλλου
 *   (επεξεργαστής προμέτρησης · γρήγορη δημιουργία χώρου) κληρονομούσε τη θυρίδα, και η κεφαλίδα του έστελνε
 *   «Αποθήκευση/Ακύρωση» στην μπάρα του φύλλου — **κάτω** από το ίδιο το συρτάρι, όπου κανείς δεν τις βλέπει.
 * 🔑 Το δηλώνουν οι ίδιες οι επιφάνειες (`ui/sheet` · `ui/dialog`), μία φορά — όχι κάθε καλών.
 */
export function OutsideDetailsSheet({ children }: { readonly children: ReactNode }) {
  return <DetailsSheetActionsContext.Provider value={null}>{children}</DetailsSheetActionsContext.Provider>;
}

/** `null` ⇒ η κεφαλίδα δεν ζει μέσα σε φύλλο κινητού και αποδίδει τις ενέργειές της επιτόπου. */
export function useDetailsSheetActions(): DetailsSheetActionsSlot | null {
  return useContext(DetailsSheetActionsContext);
}

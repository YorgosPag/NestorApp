'use client';

/**
 * 🔴 ADR-739 §66 — **Ο ΕΝΑΣ ΚΥΚΛΟΣ ΖΩΗΣ ΧΕΙΡΟΝΟΜΙΑΣ ΤΟΥ ΠΙΝΑΚΑ.**
 *
 * ## Γιατί υπάρχει: το μέτρησε η πύλη, όχι η αίσθηση
 * Οι χειρονομίες του πίνακα (σύρση επιλογής, μέγεθος άξονα, μεταφορά περιοχής, λαβή
 * συμπλήρωσης, μετακίνηση) μοιράζονται **ταυτόσημο** σκελετό: δύο ακροατές σε **σύλληψη** στο
 * `document`, «ένας ενεργός κύκλος τη φορά», ρητός τερματισμός που πρέπει να είναι ιδεμποτής
 * γιατί τον καλεί και το cleanup ενός effect. Όταν η μετακίνηση (§66) έγινε η **πέμπτη**, το
 * CHECK 3.28 (jscpd, N.18) ανέφερε **19 γραμμές / 79 tokens** κοινές με τη σύρση μεγέθους —
 * μέσα στο ίδιο commit, ακριβώς όπως προβλέπει ο κανόνας.
 *
 * ## 🔑 Το σοβαρό δεν είναι οι γραμμές — είναι ο κανόνας που πρέπει να θυμάται ο καθένας
 * Δύο αντίγραφα του σκελετού σημαίνουν δύο σημεία που πρέπει να θυμούνται ότι:
 *
 *  - οι ακροατές μπαίνουν σε **σύλληψη** (`capture: true`) και στα δύο συμβάντα — αλλιώς μια
 *    χειρονομία που σέρνεται πάνω από στοιχείο που σταματά τη διάδοση χάνει το `mouseup` και
 *    ζει για πάντα·
 *  - το `end()` είναι **ιδεμποτής**, γιατί καλείται και από το `mouseup` και από την
 *    αποπροσάρτηση της συνεδρίας — μπορεί δηλαδή να τρέξει δύο φορές για την ίδια σύρση·
 *  - μια **νέα** χειρονομία κλείνει την προηγούμενη αντί να προστεθεί: το χέρι είναι ένα.
 *
 * Ο τρίτος που θα αντέγραφε το σχήμα δεν θα αντέγραφε και τους τρεις κανόνες.
 *
 * ## Γιατί **εργοστάσιο** και όχι ένα καθολικό store
 * Το «ένας ενεργός κύκλος τη φορά» είναι κανόνας **ανά χειρονομία**, όχι ανά εφαρμογή: ο
 * `use-table-cell-pointer` τερματίζει ονομαστικά **και τις τέσσερις** στην αποπροσάρτηση, και
 * ένα κοινό slot θα σήμαινε ότι το `endTableMoveDrag()` σκοτώνει τη σύρση μεγέθους. Κάθε
 * module κρατά **τη δική του** συνεδρία· κοινός είναι ο **μηχανισμός**, όχι η κατάσταση.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/table-pointer-drag-session
 * @see ui/table-cell-editor/table-axis-resize-drag.ts — ο πρώτος καταναλωτής (§31.9)
 * @see ui/table-cell-editor/table-move-drag.ts — ο δεύτερος (§66)
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §66
 */

export interface TablePointerDragHandlers {
  /** Κάθε κίνηση του χεριού, όσο κρατιέται το κουμπί. */
  readonly onMove: (event: MouseEvent) => void;
  /**
   * Το άφημα. ⚠️ **Ο καλών οφείλει να τερματίσει ο ίδιος πριν γράψει τον κόσμο**: η σειρά
   * είναι το συμβόλαιο (πρώτα φεύγουν οι ακροατές, μετά γίνεται το commit), γιατί η εγγραφή
   * αλλάζει τη σκηνή και μπορεί να παραγάγει συμβάντα που ένας ζωντανός ακροατής θα έβλεπε ως
   * συνέχεια της σύρσης που μόλις τελείωσε.
   */
  readonly onUp: () => void;
}

export interface TablePointerDragSession {
  /** Ξεκινά κύκλο· ιδεμποτής ως προς τον προηγούμενο (τον **κλείνει**, δεν προστίθεται). */
  readonly start: (handlers: TablePointerDragHandlers) => void;
  /** Τερματίζει **χωρίς** commit. Ιδεμποτής — γι' αυτό μπορεί να κληθεί από cleanup effect. */
  readonly end: () => void;
  /** «Σέρνεται κάτι τώρα;» — χωρίς να εκτεθεί ο ίδιος ο κύκλος ζωής. */
  readonly isActive: () => boolean;
}

/** Μία ανεξάρτητη συνεδρία σύρσης. Ένα module = μία κλήση, στο επίπεδο του module. */
export function createTablePointerDragSession(): TablePointerDragSession {
  let activeTeardown: (() => void) | null = null;

  const end = (): void => {
    activeTeardown?.();
  };

  return {
    start: (handlers) => {
      if (typeof document === 'undefined') return;
      end();
      const onMove = (event: MouseEvent): void => { handlers.onMove(event); };
      const onUp = (): void => { handlers.onUp(); };
      document.addEventListener('mousemove', onMove, { capture: true });
      document.addEventListener('mouseup', onUp, { capture: true });
      activeTeardown = () => {
        document.removeEventListener('mousemove', onMove, { capture: true });
        document.removeEventListener('mouseup', onUp, { capture: true });
        activeTeardown = null;
      };
    },
    end,
    isActive: () => activeTeardown !== null,
  };
}

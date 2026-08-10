'use client';

/**
 * 🔴 ADR-739 §67.10 — **η εφήμερη επιφάνεια φεύγει μόνη της**: το mini toolbar όταν στέκεται
 * **χωρίς μενού** από κάτω του.
 *
 * ## Γιατί γεννήθηκε (και γιατί δεν χρειαζόταν μέχρι σήμερα)
 * Στις δύο πρώτες υποδοχές (ζώνες δείκτη · περιοχή) η γραμμή κάθεται **πάνω από μενού Radix**,
 * και το κλείσιμό της είναι δωρεάν: το `DismissableLayer` ακούει `Escape` και κλικ έξω, και ο
 * ένας δρόμος εξόδου σβήνει τον στόχο — άρα και τη γραμμή. Στη λειτουργία **γραφής** όμως ο
 * ιδιοκτήτης ζήτησε **μόνο τη γραμμή, χωρίς μενού** (§67.10, μετρημένο στο Excel): δεν υπάρχει
 * `DismissableLayer`, άρα δεν υπάρχει τίποτα που να την κλείνει.
 *
 * ## 🔬 Ο ΚΑΝΟΝΑΣ ΕΙΝΑΙ ΤΟΥ EXCEL, ΚΑΙ ΗΤΑΝ ΗΔΗ ΓΡΑΜΜΕΝΟΣ
 * Το ADR-739 §64 τον κατέγραψε ερευνώντας **άλλο** ελάττωμα: *«if you move the mouse elsewhere,
 * the Mini toolbar disappears so that it doesn't get in the way of your work»* · *«if you use the
 * scroll wheel or **press any key** then the toolbar automatically disappears»*. Το Fluent 2
 * ονομάζει την κατηγορία **transient / light-dismiss**. Δεν επινοείται πολιτική εδώ — εφαρμόζεται
 * η ήδη τεκμηριωμένη.
 *
 * ## 🔴 ΚΑΜΙΑ ΕΓΓΡΑΦΗ ΣΤΟΝ ESCAPE-BUS — και είναι απόφαση, όχι παράλειψη
 * Ο πειρασμός είναι ένα σκαλί πάνω από το `MODAL_DIALOG` (όπως έκανε το πινέλο, `P1025`), ώστε
 * το `Escape` να «ανήκει» στη γραμμή. Θα ήταν **λάθος**: στο Excel το `Escape` σε κατάσταση
 * Επεξεργασίας **ακυρώνει τη γραφή**, και η γραμμή φεύγει σαν παρενέργεια — δεν το διεκδικεί.
 * Ένα σκαλί P1025+ θα έτρωγε το `Escape` του χρήστη και θα τον άφηνε μέσα στο κελί με το
 * πρόχειρό του άθικτο, ενώ πάτησε «άκυρο».
 *
 * ⇒ Ο ακροατής είναι **παθητικός**: ποτέ `preventDefault`, ποτέ `stopPropagation`. Παρατηρεί και
 * υποχωρεί. Το `Escape` κάνει τη δουλειά του και η γραμμή φεύγει μαζί, δωρεάν.
 *
 * ## ⚠️ ΤΡΕΙΣ ΦΥΛΑΚΕΣ, ΚΑΙ Ο ΚΑΘΕΝΑΣ ΚΛΕΙΝΕΙ ΠΡΑΓΜΑΤΙΚΟ ΕΛΑΤΤΩΜΑ
 *  1. **Πληκτρολόγιο μέσα στη γραμμή δεν τη σβήνει.** Το combobox μεγέθους δέχεται
 *     πληκτρολόγηση· χωρίς τον φύλακα, ο πρώτος χαρακτήρας θα εξαφάνιζε το πεδίο που γράφει.
 *  2. **Πάτημα μέσα στη γραμμή δεν τη σβήνει.** Αλλιώς το πρώτο «Β» θα την έκλεινε στο
 *     `pointerdown`, δηλαδή **πριν** εκδοθεί το `click` — η ίδια ακριβώς παγίδα που φυλάει το
 *     `useKeepOpenOnSurface` στα δύο μενού.
 *  3. **Φάση σύλληψης στο `document`.** Ο ακροατής πρέπει να δει το πάτημα ό,τι κι αν κάνει
 *     οποιοσδήποτε άλλος με αυτό — και ο καμβάς είναι γεμάτος ακροατές που καταναλώνουν.
 *
 * @module subapps/dxf-viewer/ui/components/table-format-toolbar/use-transient-surface-dismiss
 * @see ui/components/table-format-toolbar/use-yield-to-persistent-surface.ts — η αδελφή αιτία
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §64, §67
 */

import { useEffect, type RefObject } from 'react';

export interface TransientSurfaceDismissParams {
  /** `false` ⇒ κανένας ακροατής δεν προσαρτάται καθόλου. */
  readonly active: boolean;
  readonly surfaceRef: RefObject<HTMLElement | null>;
  /**
   * Η αποχώρηση. **Πρέπει** να είναι σταθερή (`useCallback`/`useEventCallback`): με αστάθεια οι
   * τρεις ακροατές θα ξαναπροσαρτώνταν σε κάθε απόδοση.
   */
  readonly dismiss: () => void;
}

export function useTransientSurfaceDismiss(params: TransientSurfaceDismissParams): void {
  const { active, surfaceRef, dismiss } = params;

  useEffect(() => {
    if (!active || typeof document === 'undefined') return;

    /** Είναι αυτό το συμβάν **δικό** της γραμμής; Τότε δεν είναι λόγος να φύγει. */
    const inside = (node: EventTarget | null): boolean =>
      node instanceof Node && surfaceRef.current?.contains(node) === true;

    const onPointerDown = (event: PointerEvent): void => {
      if (!inside(event.target)) dismiss();
    };
    // «press any key» — αλλά όχι όταν το πλήκτρο γράφεται **μέσα** στη γραμμή (φύλακας 1).
    const onKeyDown = (): void => {
      if (!inside(document.activeElement)) dismiss();
    };
    // «use the scroll wheel»: το σχέδιο κύλησε κάτω από τη γραμμή, άρα η άγκυρά της δεν ισχύει.
    const onWheel = (): void => { dismiss(); };

    document.addEventListener('pointerdown', onPointerDown, { capture: true });
    document.addEventListener('keydown', onKeyDown, { capture: true });
    document.addEventListener('wheel', onWheel, { capture: true, passive: true });

    return () => {
      document.removeEventListener('pointerdown', onPointerDown, { capture: true });
      document.removeEventListener('keydown', onKeyDown, { capture: true });
      document.removeEventListener('wheel', onWheel, { capture: true });
    };
  }, [active, surfaceRef, dismiss]);
}

'use client';

/**
 * 🔴 ADR-739 §67 — **πού κάθεται η γραμμή εργαλείων σε σχέση με το δεξί κλικ**, και **πότε ζει**.
 *
 * ## Γιατί εξήχθη (CHECK 3.28, μετρημένο 2026-08-10)
 * Οι πέντε πρώτες γραμμές του {@link TableFormatToolbar} — άγκυρα, εμβέλεια, ετικέτα, επιφάνεια
 * — μαζί με τον φρουρό `target && anchor ?` ήταν **κατά λέξη** ίδιες σε δύο μενού (26 γραμμές /
 * 61 tokens). Είναι μικρές· δεν είναι όμως ασήμαντες, γιατί κωδικοποιούν **δύο αποφάσεις** που
 * πρέπει να ισχύουν παντού το ίδιο:
 *
 *  1. **Η γραμμή κρέμεται από τον ΣΤΟΧΟ, όχι από το `isOpen`.** Επιβιώνει του μενού για την
 *     **επόμενη** εντολή — η μορφοποίηση είναι κατεξοχήν επαναλαμβανόμενη πράξη (έντονα, μετά
 *     πλάγια, μετά ένα μέγεθος πάνω) — και φεύγει μόνο με `Escape` / κλικ έξω / νέο δεξί κλικ.
 *     Ένα από τα δύο μενού που θα κρεμόταν από το `isOpen` θα έσβηνε τη γραμμή στο **πρώτο**
 *     πάτημα, και η διαφορά θα φαινόταν μόνο με το μάτι.
 *  2. **Η θέση είναι το σημείο του δεξιού κλικ**, με τη γραμμή **από πάνω** (απόφαση Α7).
 *
 * ## 🔴 Τι ΔΕΝ ξέρει
 * **Ποια** διαμερίσματα δείχνονται. Το μενού περιοχής δίνει μορφοποίηση + τυπογραφία + αριθμό +
 * στοίχιση + ξεχείλισμα + συγχώνευση + περιγράμματα· το μενού κειμένου δίνει **μόνο**
 * τυπογραφία, γιατί ο χρήστης εκεί δείχνει γράμματα και όχι κελιά. Αυτή η διαφορά **είναι** το
 * περιεχόμενο και ταξιδεύει ως {@link sections} — κοινή είναι μόνο η αγκύρωση.
 *
 * @module subapps/dxf-viewer/ui/components/table-format-toolbar/AnchoredFormatToolbar
 * @see ui/components/table-format-toolbar/TableFormatToolbar.tsx — η ίδια η γραμμή
 * @see ui/components/dxf-context-menu/AnchoredMenuShell.tsx — το αδελφό κέλυφος, από κάτω
 */

import React from 'react';
import {
  TableFormatToolbar,
  type TableFormatToolbarProps,
} from './TableFormatToolbar';

/** Τα διαμερίσματα — ό,τι διαφέρει ανά υποδοχή. Όλα προαιρετικά, όπως στη γραμμή. */
export type AnchoredFormatToolbarSections = Omit<
  TableFormatToolbarProps,
  'anchorX' | 'anchorY' | 'scope' | 'label' | 'surfaceRef'
>;

export interface AnchoredFormatToolbarProps {
  /** Το σημείο του δεξιού κλικ· `null` ⇒ **δεν αποδίδεται τίποτα**. */
  readonly anchor: { readonly x: number; readonly y: number } | null;
  /**
   * `C3` / `B2:D4` — η ονομασία του στόχου, για το προσβάσιμο όνομα.
   *
   * `null` ⇒ δεν αποδίδεται: είναι ο **δεύτερος μισός** του φρουρού «υπάρχει στόχος;». Οι δύο
   * ερωτήσεις μένουν χωριστές γιατί αλλάζουν σε διαφορετικές στιγμές — η άγκυρα στο άνοιγμα, ο
   * στόχος και σε κάθε ανανέωση μετά από εντολή.
   */
  readonly label: string | null;
  /** Το δοχείο, ώστε το μενού από κάτω να αναγνωρίζει «κλικ πάνω μου» στο `onInteractOutside`. */
  readonly surfaceRef: React.RefObject<HTMLDivElement | null>;
  readonly sections: AnchoredFormatToolbarSections;
}

export function AnchoredFormatToolbar({
  anchor, label, surfaceRef, sections,
}: AnchoredFormatToolbarProps): React.ReactElement | null {
  if (!anchor || label === null) return null;

  return (
    <TableFormatToolbar
      anchorX={anchor.x}
      anchorY={anchor.y}
      // Και οι δύο υποδοχές δεξιού κλικ σε **κελιά** δηλώνουν `range`: η εμβέλεια αφορά μόνο το
      // προσβάσιμο όνομα, και ο στόχος τους είναι κελιά — όχι άξονας. Το μενού των ζωνών δείκτη
      // (`row`/`column`) στήνει τη γραμμή μόνο του, γιατί εκεί η εμβέλεια είναι πραγματικά άλλη.
      scope="range"
      label={label}
      surfaceRef={surfaceRef}
      {...sections}
    />
  );
}

'use client';

/**
 * 🔴 **Η ένδειξη μεγέθους της σύρσης** (Giorgio 2026-08-04) — «Πλάτος: 14,14 (104 pixel)».
 *
 * Το πρότυπο είναι το Excel: μια μικρή πινακίδα δίπλα στον δείκτη, **μόνο** όσο σέρνεται το
 * διαχωριστικό, που λέει το νέο μέγεθος στη μονάδα του χρήστη **και** σε pixel οθόνης.
 *
 * ## 🔴 Γιατί είναι ΦΥΛΛΟ (ADR-040)
 * Αυτό το component συνδέεται σε store που γράφεται σε **κάθε κίνηση ποντικιού**. Ο κανόνας
 * του ADR-040 δεν είναι «απόφυγε τα re-render» — είναι «*το re-render υψηλής συχνότητας
 * επιτρέπεται μόνο σε φύλλο*». Εδώ το φύλλο είναι **ένα `<output>` με κείμενο**: δεν έχει
 * παιδιά, δεν κρατά καμβά, δεν διαβάζει τίποτα άλλο. Το ίδιο μοτίβο με τα micro-leaves του
 * `canvas-layer-stack-leaves`.
 *
 * ⚠️ Ο `CanvasSectionOverlays` **δεν** μαθαίνει τίποτα: το component δεν παίρνει props και
 * διαβάζει μόνο του. Ένα prop θα ανέβαζε τη συνδρομή στον orchestrator — ακριβώς αυτό που ο
 * ADR-040 απαγορεύει (ίδια λύση με το `OpeningInfoTagEditorOverlay`, ADR-612).
 *
 * ## Η θέση ακολουθεί το ΧΕΡΙ, όχι τον πίνακα
 * Είναι πινακίδα **χειρονομίας**, όχι σημείωση σχεδίου: δεν αγκυρώνεται στην οντότητα, δεν
 * γέρνει με τον πίνακα, δεν κλιμακώνεται με το zoom. Ίδια απόφαση με τη γραμμή τύπων («η
 * γραμμή τύπων είναι **εργαλείο**») και με κάθε tooltip σύρσης του Excel/Figma. Η μικρή
 * μετατόπιση από τον δείκτη υπάρχει ώστε η πινακίδα να μην κάθεται **κάτω** από το ίδιο το
 * χέρι που τη γέννησε.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/TableResizeReadoutOverlay
 * @see state/table-resize-readout-store.ts — ο γραφέας (η χειρονομία, εκτός React)
 */

import type React from 'react';
import { useTableResizeReadoutStore } from '../../state/table-resize-readout-store';

/** Μετατόπιση από τον δείκτη, σε CSS px: δεξιά και λίγο πάνω, όπως το Excel. */
const READOUT_OFFSET_X_PX = 16;
const READOUT_OFFSET_Y_PX = -28;

/**
 * Τα ονόματα των custom properties — ο ΕΝΑΣ ορισμός τους, ίδια σύμβαση με το
 * `table-cell-editor-vars`: η θέση είναι το **μόνο** που υπολογίζεται σε χρόνο εκτέλεσης
 * (δεν εκφράζεται ως κλάση), οπότε περνά ως μεταβλητή και η κλάση την καταναλώνει με `var()`.
 * Έτσι καμία στιλιστική δήλωση δεν γράφεται inline (N.3).
 */
const READOUT_VARS = { x: '--trr-x', y: '--trr-y' } as const;

export function TableResizeReadoutOverlay(): React.ReactElement | null {
  const text = useTableResizeReadoutStore((s) => s.text);
  const x = useTableResizeReadoutStore((s) => s.x);
  const y = useTableResizeReadoutStore((s) => s.y);

  if (text === null) return null;

  return (
    <output
      // `output` και όχι `div`: είναι κυριολεκτικά «αποτέλεσμα υπολογισμού που προκύπτει από
      // ενέργεια του χρήστη» — η σημασιολογία που ορίζει η προδιαγραφή HTML γι' αυτό ακριβώς
      // το στοιχείο, και ταυτόχρονα live region για αναγνώστες οθόνης χωρίς `aria-*`.
      aria-live="polite"
      className="pointer-events-none absolute left-[var(--trr-x)] top-[var(--trr-y)] z-50 whitespace-nowrap rounded-sm border border-border bg-background/95 px-2 py-0.5 text-xs text-foreground shadow-sm backdrop-blur-sm"
      style={{
        [READOUT_VARS.x]: `${x + READOUT_OFFSET_X_PX}px`,
        [READOUT_VARS.y]: `${y + READOUT_OFFSET_Y_PX}px`,
      } as React.CSSProperties}
    >
      {text}
    </output>
  );
}

/**
 * @fileoverview Τα props της επιφάνειας «εργαλεία γραμμής» (ADR-923 §5.5.2 Β3) — **μόνο τύποι**.
 * @module components/catalog/imports/line-tool-props
 *
 * ⚠️ Ζουν σε δικό τους αρχείο γιατί ο περιπατητής του CHECK 3.34 ακολουθεί και τα `import type`: αν η λίστα γραμμών ή το μητρώο
 *    επιφανειών εισήγαγαν τον τύπο από το `LineAttributeTools`, η επιφάνεια δεν θα ήταν όριο (ίδιο σχήμα με το `edition-surface-props.ts`).
 */

import type { ImportPageUnmappedLine } from '@/subapps/catalog/types/catalog-import';
import type { ImportProposalWire } from '@/subapps/catalog/types/catalog-import-requests';
import type { ImportLineBindLevel } from '@/subapps/catalog/vocabulary/catalog-import';

export type LineToolMode = 'map' | 'new';

/** §5.5.2 Β4 Δ2: «αυτή η γραμμή είναι η τιμή», με τη μονάδα που δηλώνει ο άνθρωπος. */
export interface PriceLineDialogProps {
  readonly line: ImportPageUnmappedLine;
  readonly onClose: () => void;
  readonly onDecide: (unitCode: string) => void;
}

/** Η πηγή μιας πρότασης τιμών: ποια γραμμή του πίνακα, ανά ποια μονάδα, και η αναίρεση. */
export interface PriceLineNoteProps {
  readonly line: number;
  readonly unitCode: string;
  readonly disabled: boolean;
  readonly onUndo: () => void;
}

/** Η ΜΙΑ επιφάνεια της γραμμής τιμής: διάλογος ή σημείωση, ώστε να μετρά ένα όριο κλειστότητας, όχι δύο (ADR-744 §27). */
export type PriceLineToolsProps = ({ readonly kind: 'dialog' } & PriceLineDialogProps) | ({ readonly kind: 'note' } & PriceLineNoteProps);

export interface LineAttributeToolsProps {
  readonly proposal: ImportProposalWire;
  readonly line: ImportPageUnmappedLine;
  readonly mode: LineToolMode;
  readonly onClose: () => void;
  readonly onDecide: (attributeId: string, bind: ImportLineBindLevel | null) => void;
}

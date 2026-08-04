/**
 * ADR-750 Φ6 — **η αντιστοίχιση ταυτότητας → κλειδί i18n** για τον διάλογο «Μορφοποίηση κελιών».
 *
 * Καθαρά δεδομένα: μηδέν React, μηδέν κατάσταση.
 *
 * ## 🔴 Γιατί ΡΗΤΟΣ χάρτης για τις ακμές, και δυναμικό κλειδί για τα υπόλοιπα
 * Οι ταυτότητες θέσης είναι του **μοντέλου** (`insideH`, `diagonal:down`) και οι ετικέτες είναι
 * του **χρήστη** («Οριζόντιο περίγραμμα στο μέσο»). Τα δύο λεξιλόγια δεν συμπίπτουν — και δεν
 * επιτρέπεται να συμπέσουν: το `diagonal:down` έχει άνω-κάτω τελεία, δηλαδή δεν είναι καν
 * νόμιμο τμήμα κλειδιού i18n. Ένα `t(\`edges.${id}\`)` θα έβαφε **ωμό κλειδί** στην οθόνη με
 * όλες τις πύλες πράσινες (το σχήμα του CHECK 3.36 / ADR-752).
 *
 * Ο `Record` είναι **εξαντλητικός**: νέα θέση χωρίς ετικέτα δεν μεταγλωττίζεται.
 *
 * Αντίθετα οι **καρτέλες**, τα **υποδείγματα** και τα **14 στυλ** έχουν ταυτότητες που είναι
 * ήδη, κατά γράμμα, τα ονόματα των κλειδιών τους — και γι' αυτό υπάρχει ήδη άγκυρα που το
 * επιβάλλει (`table-border-style-catalog.test.ts`: ίδια ταυτότητα, **ίδια σειρά**, και στις δύο
 * γλώσσες). Εκεί ένας δεύτερος χάρτης θα ήταν τρίτη δήλωση της ίδιας λίστας.
 *
 * @module subapps/dxf-viewer/ui/components/table-format-toolbar/border-dialog/table-border-dialog-labels
 * @see bim/table/table-border-dialog-positions.ts — οι οκτώ θέσεις
 * @see docs/centralized-systems/reference/adrs/ADR-750-table-cell-borders.md §9.2
 */

import type { TableBorderDialogPositionId } from '../../../../bim/table/table-border-dialog-positions';

/** Το κοινό πρόθεμα κάθε κλειδιού του διαλόγου — γραμμένο **μία** φορά. */
export const TABLE_BORDER_DIALOG_KEY = 'table.borders.dialog';

/**
 * Οι έξι καρτέλες του Excel, **στη σειρά του**. Μόνο η `border` είναι υλοποιημένη· οι άλλες
 * πέντε υπάρχουν ως **δήλωση εμβέλειας** (απόφαση ιδιοκτήτη 2026-08-05): ο χρήστης βλέπει πού
 * θα ζήσουν οι επόμενες φάσεις αντί να ανακαλύψει αργότερα ότι ο διάλογος «άλλαξε σχήμα».
 */
export const TABLE_BORDER_DIALOG_TABS = [
  'number',
  'alignment',
  'font',
  'border',
  'fill',
  'protection',
] as const;

export type TableBorderDialogTabId = (typeof TABLE_BORDER_DIALOG_TABS)[number];

/** Η **μόνη** ενεργή καρτέλα της Φ6. */
export const TABLE_BORDER_DIALOG_ACTIVE_TAB: TableBorderDialogTabId = 'border';

/**
 * Ταυτότητα θέσης → κλειδί ετικέτας. Εξαντλητικός επίτηδες (δες την κεφαλίδα).
 *
 * ⚠️ Τα ονόματα του χρήστη είναι του **Excel** («στο μέσο»), όχι του μοντέλου («εσωτερικό»):
 * ο χρήστης δεν μαθαίνει ποτέ τη λέξη «ακμή» (Α5).
 */
export const TABLE_BORDER_DIALOG_EDGE_KEY: Readonly<
  Record<TableBorderDialogPositionId, string>
> = {
  top: `${TABLE_BORDER_DIALOG_KEY}.edges.top`,
  bottom: `${TABLE_BORDER_DIALOG_KEY}.edges.bottom`,
  left: `${TABLE_BORDER_DIALOG_KEY}.edges.left`,
  right: `${TABLE_BORDER_DIALOG_KEY}.edges.right`,
  insideH: `${TABLE_BORDER_DIALOG_KEY}.edges.middleHorizontal`,
  insideV: `${TABLE_BORDER_DIALOG_KEY}.edges.middleVertical`,
  'diagonal:down': `${TABLE_BORDER_DIALOG_KEY}.edges.diagonalDown`,
  'diagonal:up': `${TABLE_BORDER_DIALOG_KEY}.edges.diagonalUp`,
};

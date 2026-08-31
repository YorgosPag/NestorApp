/**
 * ADR-739 / ADR-750 — **οι ταυτότητες του πίνακα**, στο κάτω στρώμα των τύπων.
 *
 * Καθαρό type module: μηδέν runtime, μηδέν εξαρτήσεις. Οι τρεις δηλώσεις ήταν μέχρι τώρα
 * η ενότητα «Ταυτότητες» του `types/table.ts` και μετακόμισαν **αυτούσιες** εδώ.
 *
 * ## Γιατί χωριστό αρχείο — δεν είναι καλλωπισμός, είναι ο κύκλος
 * Το ADR-750 προσθέτει τις **ακμές** (`types/table-edges.ts`), και οι δύο πλευρές
 * χρειάζονται η μία την άλλη: το μοντέλο κρατά ακολουθία ακμών (`PersistedTableModel.edges`)
 * ενώ η ακμή αγκυρώνεται σε `TableRowId`/`TableColumnId`. Με τις ταυτότητες μέσα στο
 * μοντέλο η εξάρτηση θα ήταν **κύκλος** (`table → table-edges → table`)· εδώ είναι αλυσίδα:
 *
 * ```
 *   table-ids  →  table-edges  →  table
 *   (ποιος)       (ποια ακμή)      (το μοντέλο)
 * ```
 *
 * Ο κύκλος θα ήταν μόνο σε επίπεδο τύπων (σβήνεται στη μεταγλώττιση) και **θα δούλευε** —
 * γι' αυτό ακριβώς είναι επικίνδυνος: θα περνούσε αθόρυβα και θα ήταν το προηγούμενο για
 * τον επόμενο, μέχρι κάποιος να χρειαστεί runtime τιμή στον ίδιο κύκλο (ADR-746).
 *
 * Κανένας υπάρχων καλών δεν αλλάζει διαδρομή εισαγωγής: το `types/table.ts` **επανεξάγει**
 * και τους τρεις τύπους, όπως ήδη κάνει το `table-style.ts` για το `TableBorderSpec`.
 *
 * @module subapps/dxf-viewer/types/table-ids
 * @see docs/centralized-systems/reference/adrs/ADR-750-table-cell-borders.md §6.1
 */

/**
 * Σταθερή ταυτότητα στήλης. Τα merges, οι τύποι, τα overrides **και οι ακμές** δείχνουν
 * εδώ, ποτέ σε θέση πίνακα: εισαγωγή στήλης στη μέση δεν επιτρέπεται να τα σπάσει.
 * (Το AutoCAD τα κρατά με index — γι' αυτό εκεί οι τύποι σπάνε.)
 */
export type TableColumnId = string;

/** Σταθερή ταυτότητα γραμμής — ίδιο σκεπτικό με το {@link TableColumnId}. */
export type TableRowId = string;

/**
 * Κλειδί κελιού στον αραιό χάρτη `TableModel.cells`. **Branded**: η ΜΟΝΗ νόμιμη πηγή
 * είναι το `cellKey(rowId, colId)` του `table-model-helpers.ts`, ώστε να μην μπορεί
 * ποτέ να μπει γυμνό string με λάθος σειρά σκελών.
 */
export type CellKey = string & { readonly __cellKeyBrand: unique symbol };

/**
 * Σταθερή ταυτότητα **φύλλου εργασίας** — branded, ίδιο ιδίωμα με το {@link CellKey}.
 *
 * ## 🔴 ADR-833 Φάση 7 — ΓΙΑΤΙ ΜΕΤΑΚΟΜΙΣΕ ΕΔΩ: είναι **ο ίδιος κύκλος** που γέννησε το αρχείο
 * Η Φάση 2 τη δήλωσε στο `types/table-worksheet.ts`, που εισάγει `PersistedTableModel` από το
 * `types/table.ts`. Η Φάση 7 όμως βάζει **φύλλο μέσα στη διεύθυνση** ενός τύπου
 * (`TableFormulaCellRef.worksheetId`), και το `types/table.ts` εισάγει ήδη το
 * `types/table-formula.ts` (γρ. 45). Δηλαδή:
 *
 * ```
 *   table-formula → table-worksheet → table → table-formula      ← ΚΥΚΛΟΣ
 *   table-ids     → table-formula   → table → table-worksheet    ← αλυσίδα
 * ```
 *
 * Είναι **κατά λέξη** το σενάριο που τεκμηριώνει η κεφαλίδα αυτού του αρχείου για τις ακμές
 * (ADR-750): κύκλος **μόνο σε επίπεδο τύπων**, που θα **δούλευε** και γι' αυτό θα περνούσε
 * αθόρυβα — μέχρι κάποιος να χρειαστεί runtime τιμή στον ίδιο κύκλο (ADR-746).
 *
 * 🔑 Μετακόμισε **μόνο ο τύπος**. Η runtime βεβαίωση (`tableWorksheetId`) και η σταθερά
 * `FIRST_TABLE_WORKSHEET_ID` μένουν στο `types/table-worksheet.ts`, ώστε αυτό το module να
 * παραμείνει **μηδέν runtime** — ακριβώς ο διαχωρισμός που έχει ήδη το {@link CellKey}, του
 * οποίου η μόνη νόμιμη πηγή (`cellKey`) ζει στο `table-model-helpers.ts`.
 *
 * ⚠️ Καμία διαδρομή εισαγωγής δεν άλλαξε: το `types/table-worksheet.ts` **επανεξάγει** τον
 * τύπο, όπως το `types/table.ts` επανεξάγει το `CellKey` (γρ. 53) — και για τον ίδιο λόγο.
 */
export type TableWorksheetId = string & { readonly __tableWorksheetIdBrand: unique symbol };

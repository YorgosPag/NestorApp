/**
 * ADR-739 Φάση Α — τα built-in `TableStyle` (§5).
 *
 * Δύο στυλ, με ρητά διαφορετικό σκοπό:
 *
 * - **`standard`** — ο γενικός πίνακας του χρήστη: πλήρες πλέγμα, ζώνη τίτλου, γκρι
 *   κεφαλίδα. Το ανάλογο του AutoCAD «Standard» TABLESTYLE.
 * - **`detailSheet`** — **ακριβώς** οι σημερινές τιμές του `buildScheduleTable`
 *   (ADR-622): `ROW_H_MM 7.5`, `TEXT_MM 2.6`, κείμενο `#222222`, γραμμές `#999999`
 *   στα `0.15mm`, περιθώριο `4mm`. Καμία κάθετη γραμμή, κανένα πλαίσιο, κανένα γέμισμα
 *   — ο σημερινός πίνακας των φύλλων οπλισμού **δεν έχει** τίποτα από αυτά.
 *
 * ## Γιατί υπάρχει το `detailSheet` από τη Φάση Α
 * Είναι η **προϋπόθεση** της απορρόφησης του ADR-622 (§3 Αρχή 2, Φ.Β): για να γίνει το
 * `buildScheduleTable` thin adapter πάνω σε αυτή τη μηχανή **χωρίς οπτική μεταβολή**,
 * πρέπει να υπάρχει στυλ που αναπαράγει τη σημερινή εμφάνιση. Οι τιμές δεν είναι
 * «περίπου» — είναι αντιγραμμένες από το `detail-sheet-schedule-table.ts`.
 *
 * ⚠️ **Ό,τι ΔΕΝ υπόσχεται αυτό το preset**: byte-identical έξοδο. Ο σημερινός ADR-622
 * τοποθετεί τις δύο οριζόντιες γραμμές του **baseline-relative** (`y - ROW_H_MM * 0.2`),
 * όχι στις ακμές των κελιών· η γενική μηχανή τις βάζει στις ακμές (σωστό και συμβατό με
 * DXF). Η γεφύρωση είναι δουλειά του **adapter της Φ.Β**, με το δίχτυ χαρακτηρισμού στο
 * χέρι — όχι εικασία εδώ. Τα ονόματα των στυλ είναι i18n ΚΛΕΙΔΙΑ (N.11).
 *
 * @module subapps/dxf-viewer/bim/table/table-style-presets
 * @see ../structural/detail-sheet/detail-sheet-schedule-table.ts — η πηγή των τιμών
 */

import type { TableBorderSpec, TableRowClass } from '../../types/table';
import type { TableBorders, TableRowClassStyle, TableStyle } from './table-style';

// ──────────────────────────────────────────────────────────────────────────────
// Σταθερά built-in ids (σταθερά slugs — τα αποθηκευμένα `styleId` πρέπει να επιλύονται
// μετά από κάθε reload· τα custom παίρνουν `generateTableStyleId()`, βλ. registry)
// ──────────────────────────────────────────────────────────────────────────────

export const BUILTIN_TABLE_STYLE_IDS = {
  STANDARD: 'tblstyle_standard',
  DETAIL_SHEET: 'tblstyle_detail_sheet',
} as const;

export type BuiltInTableStyleId =
  (typeof BUILTIN_TABLE_STYLE_IDS)[keyof typeof BUILTIN_TABLE_STYLE_IDS];

/** Πρόθεμα i18n κλειδιών για τα ονόματα των built-in — βλ. `dxf-viewer-shell.json`. */
const NAME_KEY_PREFIX = 'ribbon.commands.tableStyleNames';

// ──────────────────────────────────────────────────────────────────────────────
// Βοηθοί κατασκευής
// ──────────────────────────────────────────────────────────────────────────────

const NO_BORDER: TableBorderSpec = { visible: false, colorHex: '#000000', widthMm: 0 };

function border(colorHex: string, widthMm: number): TableBorderSpec {
  return { visible: true, colorHex, widthMm };
}

/** Και οι έξι ακμές αόρατες — η βάση του `detailSheet` (ο ADR-622 δεν έχει πλέγμα). */
function noBorders(): TableBorders {
  return {
    top: NO_BORDER,
    bottom: NO_BORDER,
    left: NO_BORDER,
    right: NO_BORDER,
    insideH: NO_BORDER,
    insideV: NO_BORDER,
  };
}

/** Και οι έξι ακμές ορατές με το ίδιο μολύβι — η βάση του `standard` (πλήρες πλέγμα). */
function uniformBorders(colorHex: string, widthMm: number): TableBorders {
  const edge = border(colorHex, widthMm);
  return { top: edge, bottom: edge, left: edge, right: edge, insideH: edge, insideV: edge };
}

// ──────────────────────────────────────────────────────────────────────────────
// `standard` — γενικός πίνακας, πλήρες πλέγμα
// ──────────────────────────────────────────────────────────────────────────────

const STANDARD_GRID_HEX = '#666666';
const STANDARD_GRID_MM = 0.25;
/** Το εξωτερικό περίγραμμα είναι χοντρότερο από τους εσωτερικούς διαχωριστές (ISO 128). */
const STANDARD_FRAME_MM = 0.5;
const STANDARD_TEXT_HEX = '#111111';
const STANDARD_MARGINS = { hMm: 2, vMm: 1.5 } as const;

function standardRowClass(
  textHeightMm: number,
  bold: boolean,
  fillColorHex: string | undefined,
): TableRowClassStyle {
  const grid = uniformBorders(STANDARD_GRID_HEX, STANDARD_GRID_MM);
  return {
    textHeightMm,
    textColorHex: STANDARD_TEXT_HEX,
    fillColorHex,
    bold,
    align: 'MC',
    margins: STANDARD_MARGINS,
    borders: {
      ...grid,
      top: border(STANDARD_GRID_HEX, STANDARD_FRAME_MM),
      bottom: border(STANDARD_GRID_HEX, STANDARD_FRAME_MM),
      left: border(STANDARD_GRID_HEX, STANDARD_FRAME_MM),
      right: border(STANDARD_GRID_HEX, STANDARD_FRAME_MM),
    },
  };
}

const STANDARD_STYLE: TableStyle = {
  id: BUILTIN_TABLE_STYLE_IDS.STANDARD,
  name: `${NAME_KEY_PREFIX}.standard`,
  isBuiltIn: true,
  defaultRowHeightMm: 8,
  minColumnWidthMm: 6,
  rowClasses: {
    // Ο τίτλος καταλαμβάνει όλο το πλάτος (μία συγχώνευση) — μεγαλύτερος, χωρίς γέμισμα.
    title: standardRowClass(4, true, undefined),
    header: standardRowClass(3, true, '#EDEDED'),
    data: { ...standardRowClass(2.8, false, undefined), align: 'ML' },
  },
};

// ──────────────────────────────────────────────────────────────────────────────
// `detailSheet` — οι ΑΚΡΙΒΕΙΣ τιμές του ADR-622 (`detail-sheet-schedule-table.ts`)
// ──────────────────────────────────────────────────────────────────────────────

/** `ROW_H_MM` του `detail-sheet-schedule-table.ts`. */
export const DETAIL_SHEET_ROW_HEIGHT_MM = 7.5;
/** `TEXT_MM` — ύψος κεφαλαίου, κοινό σε header / data / total. */
export const DETAIL_SHEET_TEXT_HEIGHT_MM = 2.6;
/** `TEXT_HEX` — το χρώμα κάθε κελιού του σημερινού πίνακα. */
export const DETAIL_SHEET_TEXT_HEX = '#222222';
/** `RULE_HEX` — το αχνό γκρι των δύο οριζόντιων γραμμών. */
export const DETAIL_SHEET_RULE_HEX = '#999999';
/** `RULE_WIDTH_MM` — το πάχος τους. */
export const DETAIL_SHEET_RULE_WIDTH_MM = 0.15;
/** `SIDE_PAD_MM` — το πλευρικό περιθώριο της ζώνης του πίνακα. */
export const DETAIL_SHEET_SIDE_PAD_MM = 4;
/** `TOP_PAD_MM` — καθαρίζει την επικεφαλίδα της περιοχής πάνω από τον πίνακα. */
export const DETAIL_SHEET_TOP_PAD_MM = 11;

/**
 * **Το κλειδί της απορρόφησης (ADR-739 Φ.Β).**
 *
 * Ο ADR-622 ζωγραφίζει τις δύο οριζόντιες γραμμές στο `y - ROW_H_MM * 0.2`, δηλαδή 1,5mm
 * **πάνω** από την ακμή της γραμμής. Αυτό έμοιαζε με baseline-relative quirk που δεν
 * εκφράζεται με ακμές κελιών. **Δεν είναι.** Η μέτρηση (Φ.Β) έδειξε ότι το ίδιο σχήμα
 * προκύπτει ακριβώς από δύο συνηθισμένες ιδιότητες πίνακα:
 *
 * - η γραμμή **κεφαλίδας** είναι κοντύτερη: `7.5 - 1.5 = 6mm`
 * - το κείμενο των **δεδομένων** κάθεται 1,5mm χαμηλότερα μέσα στη γραμμή του
 *   (κατακόρυφο περιθώριο κελιού)
 *
 * Αλγεβρική ταύτιση για κάθε γραμμή N:
 * ```
 *   ADR-622 : 7.5 + 7.5(N-1) + 2.6           = 7.5N + 2.6
 *   μοντέλο : 6   + 7.5(N-1) + 1.5 + 2.6     = 7.5N + 2.6   ✓
 *   rule #2 : 7.5 + 7.5n - 1.5 = 6 + 7.5n    = ακμή μετά από header(6) + n×7.5  ✓
 * ```
 * Άρα η γενική μηχανή **δεν χρειάστηκε καμία παραχώρηση** — ούτε offset, ούτε ειδική
 * περίπτωση. Το «quirk» ήταν λάθος ανάγνωση της γεωμετρίας.
 */
export const DETAIL_SHEET_BASELINE_INSET_MM = DETAIL_SHEET_ROW_HEIGHT_MM * 0.2; // 1.5
/** Ύψος της γραμμής κεφαλίδας — κοντύτερο, ώστε η γραμμή της να πέσει στο σωστό y. */
export const DETAIL_SHEET_HEADER_HEIGHT_MM =
  DETAIL_SHEET_ROW_HEIGHT_MM - DETAIL_SHEET_BASELINE_INSET_MM; // 6

/**
 * Η γραμμή που ο ADR-622 ζωγραφίζει κάτω από την κεφαλίδα και πάνω από το σύνολο.
 * Εκτεθειμένη ώστε ο adapter της Φ.Β (και η γραμμή-σύνολο κάθε πίνακα ποσοτήτων) να
 * χρησιμοποιεί το ΙΔΙΟ μολύβι, χωρίς δεύτερη δήλωση των τιμών.
 */
export const DETAIL_SHEET_RULE: TableBorderSpec = border(
  DETAIL_SHEET_RULE_HEX,
  DETAIL_SHEET_RULE_WIDTH_MM,
);

function detailSheetRowClass(
  bold: boolean,
  borders: TableBorders,
  marginVMm: number,
): TableRowClassStyle {
  return {
    textHeightMm: DETAIL_SHEET_TEXT_HEIGHT_MM,
    textColorHex: DETAIL_SHEET_TEXT_HEX,
    bold,
    // Το κείμενο κρέμεται από την ΚΟΡΥΦΗ της γραμμής (`rowTop + margin + TEXT_MM`), όχι
    // κεντραρισμένο — ακριβώς η σύμβαση του ADR-622. Οριζόντιο περιθώριο μηδέν: το κείμενο
    // αγκυρώνεται πάνω στην ίδια την ακμή της στήλης.
    align: 'TL',
    margins: { hMm: 0, vMm: marginVMm },
    borders,
  };
}

const DETAIL_SHEET_STYLE: TableStyle = {
  id: BUILTIN_TABLE_STYLE_IDS.DETAIL_SHEET,
  name: `${NAME_KEY_PREFIX}.detailSheet`,
  isBuiltIn: true,
  defaultRowHeightMm: DETAIL_SHEET_ROW_HEIGHT_MM,
  minColumnWidthMm: 0,
  rowClasses: {
    // Τα φύλλα οπλισμού δεν έχουν ζώνη τίτλου μέσα στον πίνακα (η επικεφαλίδα της
    // περιοχής ζωγραφίζεται έξω από αυτόν) — παρόν για πληρότητα του συμβολαίου.
    title: detailSheetRowClass(true, noBorders(), DETAIL_SHEET_BASELINE_INSET_MM),
    // Η κεφαλίδα: μηδενικό κατακόρυφο περιθώριο (το κείμενό της κάθεται στην κορυφή) και η
    // ΜΟΝΗ ορατή ακμή όλου του στυλ — η γραμμή από κάτω της. Μαζί με το κοντύτερο ύψος
    // γραμμής (`DETAIL_SHEET_HEADER_HEIGHT_MM`) αναπαράγει το σχήμα του ADR-622.
    header: detailSheetRowClass(true, { ...noBorders(), bottom: DETAIL_SHEET_RULE }, 0),
    data: detailSheetRowClass(false, noBorders(), DETAIL_SHEET_BASELINE_INSET_MM),
  },
};

// ──────────────────────────────────────────────────────────────────────────────
// Ο κατάλογος
// ──────────────────────────────────────────────────────────────────────────────

export const BUILTIN_TABLE_STYLES: readonly TableStyle[] = [STANDARD_STYLE, DETAIL_SHEET_STYLE];

/** Το στυλ που παίρνει ένας νέος πίνακας όταν ο χρήστης δεν διάλεξε άλλο. */
export const DEFAULT_ACTIVE_TABLE_STYLE_ID: BuiltInTableStyleId =
  BUILTIN_TABLE_STYLE_IDS.STANDARD;

/** Οι τρεις κλάσεις γραμμής, σε σειρά εμφάνισης — για UI επιλογείς και για tests. */
export const TABLE_ROW_CLASSES: readonly TableRowClass[] = ['title', 'header', 'data'];

/**
 * ADR-739 Φάση Α — τα built-in `TableStyle` (§5).
 *
 * Δύο στυλ, με ρητά διαφορετικό σκοπό:
 *
 * - **`standard`** — ο γενικός πίνακας του χρήστη: πλήρες πλέγμα και **τίποτα άλλο**. Από
 *   την 2026-08-04 είναι **ουδέτερο**: όλα τα κελιά ισάξια, χωρίς γέμισμα, χωρίς έντονα,
 *   ένα ύψος κειμένου, μία στοίχιση (βλ. `standardRowClass`) — και **αυτόματο μελάνι**
 *   (ADR-739 §38, βλ. {@link STANDARD_TEXT_HEX}).
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
import { AUTOMATIC_TABLE_INK } from './table-ink';
import { HIDDEN_TABLE_EDGE } from './table-edge-model';
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

/**
 * ADR-750 Φ2 — **μία** απάντηση στο «ακμή που δεν ζωγραφίζεται», κοινή με τη ρητή παράκαμψη.
 *
 * Ήταν ιδιωτική σταθερά εδώ· η Φ2 χρειάστηκε την ίδια ακριβώς τιμή για το «Χωρίς περίγραμμα»
 * και δύο ταυτόσημα literals θα ήταν σιωπηλά αποκλίνον διπλότυπο **κάτω** από το κατώφλι του
 * jscpd (N.18). Με ένα αντικείμενο, το `sameBorderSpec` απαντά «ίδιο» για το αόρατο της
 * κλάσης και το αόρατο του χρήστη — δηλαδή η ένωση συνεχόμενων τμημάτων δεν σπάει άσκοπα.
 */
const NO_BORDER: TableBorderSpec = HIDDEN_TABLE_EDGE;

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
/**
 * **Ένα πάχος για κάθε ακμή** — πλαίσιο και εσωτερικοί διαχωριστές ίδιοι (Giorgio,
 * 2026-08-04). Ήταν 0,25mm πλέγμα με 0,5mm πλαίσιο (ιεραρχία ISO 128, το ίδιο σκεπτικό με
 * την τυπογραφική ιεραρχία που έφυγε λίγο νωρίτερα).
 *
 * Το **0,13mm** δεν είναι αυθαίρετο «πολύ λεπτό»: είναι η **λεπτότερη πένα της σειράς
 * ISO 128** — κάτω από αυτό, ένα plot 1:1 σε χαρτί δεν εγγυάται συνεχή γραμμή και ένας
 * εκτυπωτής μπορεί να την ισοπεδώσει σε τίποτα. Λεπτότερο θα ήταν λεπτότερο μόνο στην
 * οθόνη, όχι στο σχέδιο.
 */
const STANDARD_GRID_MM = 0.13;
/**
 * 🔴 ADR-739 §38 — **αυτόματο μελάνι**: λευκό σε σκούρο, μαύρο σε φωτεινό, μαύρο στο χαρτί.
 *
 * Ήταν `#111111`, δηλαδή «σχεδόν μαύρο» — σωστό μόνο αν ο καμβάς ήταν λευκός. **Δεν είναι**: το
 * `--canvas-background-dxf` έχει **9 θέματα + custom**, και στο προεπιλεγμένο `nestorApp1`
 * (`#1d283a`) η αντίθεση μετρήθηκε **1,27:1** — κάτω και από το `MIN_ENTITY_CONTRAST = 3.0` που
 * το ίδιο το έργο επιβάλλει σε **κάθε άλλη** οντότητα. Σε **6 από τα 9** θέματα το κείμενο ήταν
 * πρακτικά αόρατο.
 *
 * Ένα ωμό `#ffffff` θα διόρθωνε τα έξι και θα έσπαγε **τρία**: το θέμα `light` (1,00:1), το
 * `cinema4d` και **κάθε εξαγωγή σε χαρτί** (1,00:1). Το πρόβλημα δεν είναι «οθόνη vs χαρτί» —
 * είναι «**επιφάνεια vs επιφάνεια**», και έχει μία τίμια απάντηση: το ACI 7 του AutoCAD, το
 * «Automatic» του Word/Excel.
 *
 * ⚠️ **Δεν είναι `#rrggbb` και δεν πρέπει να γίνει.** Το σεντινέλι ζει **μόνο** στο στυλ και
 * επιλύεται στη διάταξη (`placeCells`), με την επιφάνεια ως ρητό όρισμα — δες `table-ink.ts`
 * για το γιατί ο εγκλωβισμός εκεί είναι ο μόνος τρόπος: καμία από τις πέντε εξόδους (καμβάς,
 * CSS, DXF, PDF, δίσκος) **δεν πετάει σφάλμα** αν το δει ανεπίλυτο.
 */
const STANDARD_TEXT_HEX: string = AUTOMATIC_TABLE_INK;
const STANDARD_MARGINS = { hMm: 2, vMm: 1.5 } as const;
/** Ένα ύψος για όλα τα κελιά — ό,τι ήταν το ύψος των δεδομένων. */
const STANDARD_TEXT_MM = 2.8;

/**
 * **Ουδέτερο κελί — καμία παράμετρος** (απόφαση Giorgio, 2026-08-04).
 *
 * Ήταν `standardRowClass(textHeightMm, bold, fillColorHex)` και παρήγαγε τρία διαφορετικά
 * κελιά: τίτλος 4mm έντονος, κεφαλίδα 3mm έντονη με γέμισμα `#EDEDED`, δεδομένα 2.8mm
 * κανονικά. Η ιεραρχία αυτή είναι σωστή για πίνακα **που ξέρεις τι περιέχει** — και ο νέος
 * πίνακας του καμβά δεν ξέρει: υπόμνημα, ποσότητες, καρτέλα έργου, τυχαία λίστα. Κάθε
 * προκαθορισμένη έμφαση ήταν εικασία που ο χρήστης έπρεπε πρώτα να αναιρέσει.
 *
 * Οι **τρεις κλάσεις παραμένουν** στο συμβόλαιο (`title` / `header` / `data`) και δίνουν
 * την ίδια απάντηση. Το `detailSheet` ΔΕΝ αγγίζεται: εκεί η ιεραρχία είναι δεδομένη
 * (φύλλα οπλισμού, ADR-622) — ουδετερότητα εκεί θα ήταν οπτική παλινδρόμηση.
 *
 * Και οι **έξι** ακμές έχουν το ίδιο μολύβι: το πλαίσιο έπαψε να ξεχωρίζει από τους
 * εσωτερικούς διαχωριστές — γι' αυτό το `uniformBorders` επιστρέφεται πλέον **ως έχει**,
 * χωρίς παρακάμψεις πλαισίου από πάνω.
 */
function standardRowClass(): TableRowClassStyle {
  return {
    textHeightMm: STANDARD_TEXT_MM,
    textColorHex: STANDARD_TEXT_HEX,
    fillColorHex: undefined,
    bold: false,
    italic: false,
    underline: false,
    align: 'ML',
    margins: STANDARD_MARGINS,
    borders: uniformBorders(STANDARD_GRID_HEX, STANDARD_GRID_MM),
  };
}

const STANDARD_STYLE: TableStyle = {
  id: BUILTIN_TABLE_STYLE_IDS.STANDARD,
  name: `${NAME_KEY_PREFIX}.standard`,
  isBuiltIn: true,
  defaultRowHeightMm: 8,
  minColumnWidthMm: 6,
  // Τρεις κλάσεις, μία εμφάνιση: κάθε κελί ισάξιο, καμία έμφαση, κανένα γέμισμα.
  rowClasses: {
    title: standardRowClass(),
    header: standardRowClass(),
    data: standardRowClass(),
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
    italic: false,
    underline: false,
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

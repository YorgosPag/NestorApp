/**
 * ADR-739 Φάση Α — `TableStyle`: named object **σαν DIMSTYLE, όχι σαν CSS** (§5).
 *
 * Ένα `TableStyle` είναι επαναχρησιμοποιήσιμο, ονοματισμένο πακέτο τυπογραφίας +
 * περιθωρίων + περιγραμμάτων, με **τρεις κλάσεις γραμμής** (`title` / `header` / `data`)
 * — ακριβώς η δομή του AutoCAD `TABLESTYLE`. Οι πίνακες δείχνουν σε ένα style μέσω id·
 * αλλαγή του style αλλάζει **όλους** τους πίνακες που το χρησιμοποιούν (το νόημα του
 * named object: μία αλλαγή, N σχέδια).
 *
 * ## Γιατί 1:1 με τα DXF group codes
 * Τα πεδία εδώ αντιστοιχούν πεδίο-προς-πεδίο στα group codes 7/140/170/64/63/69/65/66/
 * 68/279/275/276/278/289/285/286/288 του `ACAD_TABLE`/`TABLESTYLE`. Έτσι το DXF
 * round-trip (Φ.Ε) γίνεται **αντιστοίχιση πεδίων**, όχι μετάφραση με απώλειες — η ίδια
 * αρχή που κάνει το `ExportableTable` να τρέφει τρεις exporters χωρίς μεταφραστή.
 *
 * ## Μονάδες
 * **Όλα** τα μεγέθη είναι **sheet-mm** (χαρτί). Καμία μετατροπή δεν ζει εδώ· η μοναδική
 * γέφυρα προς τη σκηνή είναι ο `scaleFactor` του `detail-primitives-to-entities.ts`
 * (§4.1 — το μάθημα των ADR-462/716).
 *
 * @module subapps/dxf-viewer/bim/table/table-style
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §5
 * @see ./table-style-presets.ts — τα built-in στυλ
 * @see ../../systems/line-styles/line-style-types.ts — το πρότυπο named-style μοντέλο
 */

import type {
  TableBorderSpec,
  TableCellAlign,
  TableCellStyleOverride,
  TableRowClass,
} from '../../types/table';

// Ο ορισμός ζει στο μοντέλο (το χρειάζεται και η γραμμή-σύνολο, `TableRow.borderTop`)·
// επανεξάγεται από εδώ ώστε οι καταναλωτές στυλ να μην χρειάζεται να ξέρουν πού γεννήθηκε.
export type { TableBorderSpec };

/**
 * Τα έξι περιγράμματα μιας κλάσης γραμμής, με τη σημασιολογία του AutoCAD:
 * `top`/`bottom`/`left`/`right` = τα **εξωτερικά** όρια της ζώνης αυτής της κλάσης·
 * `insideH`/`insideV` = οι **εσωτερικοί** διαχωριστές ανάμεσα σε γειτονικά κελιά της.
 */
export interface TableBorders {
  readonly top: TableBorderSpec;
  readonly bottom: TableBorderSpec;
  readonly left: TableBorderSpec;
  readonly right: TableBorderSpec;
  readonly insideH: TableBorderSpec;
  readonly insideV: TableBorderSpec;
}

// ──────────────────────────────────────────────────────────────────────────────
// Στυλ ανά κλάση γραμμής
// ──────────────────────────────────────────────────────────────────────────────

/** Οριζόντιο + κατακόρυφο περιθώριο κελιού (sheet-mm) — DXF group codes 40 / 41. */
export interface TableCellMargins {
  readonly hMm: number;
  readonly vMm: number;
}

export interface TableRowClassStyle {
  /** Ύψος κεφαλαίου γράμματος σε sheet-mm — DXF group code 140. */
  readonly textHeightMm: number;
  readonly textColorHex: string;
  /** Γέμισμα φόντου κελιού· απόν ⇒ διαφανές (DXF 63/283 `fillColor` off). */
  readonly fillColorHex?: string;
  readonly bold: boolean;
  /**
   * Οικογένεια γραμματοσειράς για **μέτρηση και ζωγραφική** — περνά αυτούσια στο
   * `measureTextAdvanceWorld` (`TextAdvanceStyle.fontFamily`), ώστε το πλάτος που
   * μετρά η μηχανή διάταξης να είναι το πλάτος που ζωγραφίζει ο renderer. Απούσα ⇒
   * το default του measurer. **Ποτέ δεύτερος measurer** (N.18).
   */
  readonly fontFamily?: string;
  /** Στοίχιση περιεχομένου στο κελί, 9 θέσεις — DXF group code 170. */
  readonly align: TableCellAlign;
  readonly margins: TableCellMargins;
  readonly borders: TableBorders;
}

// ──────────────────────────────────────────────────────────────────────────────
// Το style
// ──────────────────────────────────────────────────────────────────────────────

export interface TableStyle {
  /** Σταθερό slug για τα built-in· `generateTableStyleId()` για τα custom (N.6). */
  readonly id: string;
  /**
   * Built-in (`isBuiltIn: true`) ⇒ **i18n ΚΛΕΙΔΙ**, που επιλύεται με `t()` τη στιγμή
   * της εμφάνισης (N.11 — μηδέν ωμά ελληνικά στον κώδικα). Custom ⇒ το όνομα που
   * πληκτρολόγησε ο χρήστης.
   */
  readonly name: string;
  readonly isBuiltIn: boolean;
  /** Ένα υποστυλ ανά κλάση γραμμής — και οι τρεις πάντα παρούσες. */
  readonly rowClasses: Readonly<Record<TableRowClass, TableRowClassStyle>>;
  /**
   * Προεπιλεγμένο ύψος γραμμής σε sheet-mm — DXF group code 141. Χρησιμοποιείται όταν
   * η `TableRow` δεν δηλώνει δικό της `heightMm`.
   */
  readonly defaultRowHeightMm: number;
  /**
   * Ελάχιστο πλάτος στήλης σε sheet-mm. Φράγμα ασφαλείας για `hug` στήλες με κενό
   * περιεχόμενο — μια στήλη μηδενικού πλάτους δεν είναι στήλη, είναι γραμμή.
   */
  readonly minColumnWidthMm: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Επίλυση: κλάση γραμμής → (προαιρετική) παράκαμψη κελιού
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Το **τελικό** στυλ ενός συγκεκριμένου κελιού, αφού η παράκαμψη (αν υπάρχει) πέσει
 * πάνω στην κλάση της γραμμής του. Ό,τι χρειάζεται ο ζωγράφος και ο measurer, τίποτα
 * παραπάνω — τα περιγράμματα ΔΕΝ είναι εδώ γιατί ανήκουν στις **ακμές**, όχι στα κελιά
 * (δύο γειτονικά κελιά μοιράζονται μία ακμή· αν κάθε κελί κρατούσε τα δικά του, η ίδια
 * γραμμή θα ζωγραφιζόταν δύο φορές με πιθανώς διαφορετικό πάχος).
 */
export interface TableCellStyle {
  readonly textHeightMm: number;
  readonly textColorHex: string;
  readonly fillColorHex?: string;
  readonly bold: boolean;
  readonly fontFamily?: string;
  readonly align: TableCellAlign;
  readonly margins: TableCellMargins;
}

/** Το στυλ μιας κλάσης γραμμής, χωρίς τα περιγράμματα (βλ. {@link TableCellStyle}). */
export function baseCellStyle(rowStyle: TableRowClassStyle): TableCellStyle {
  return {
    textHeightMm: rowStyle.textHeightMm,
    textColorHex: rowStyle.textColorHex,
    fillColorHex: rowStyle.fillColorHex,
    bold: rowStyle.bold,
    fontFamily: rowStyle.fontFamily,
    align: rowStyle.align,
    margins: rowStyle.margins,
  };
}

/**
 * Κλάση γραμμής + παράκαμψη κελιού → τελικό στυλ. Η παράκαμψη είναι **αραιή**: κάθε
 * απόν πεδίο κληρονομείται. Ένα ρητό `fillColorHex: undefined` ΔΕΝ σβήνει το γέμισμα
 * της κλάσης (`in` έλεγχος θα το επέτρεπε, αλλά τότε το «απών» και το «ρητά κενό» θα
 * ήταν δυσδιάκριτα σε JSON round-trip· η αφαίρεση γεμίσματος γίνεται στο style, όχι
 * με μια τρύπα στο override).
 */
export function resolveCellStyle(
  rowStyle: TableRowClassStyle,
  override?: TableCellStyleOverride,
): TableCellStyle {
  const base = baseCellStyle(rowStyle);
  if (!override) return base;
  return {
    textHeightMm: override.textHeightMm ?? base.textHeightMm,
    textColorHex: override.textColorHex ?? base.textColorHex,
    fillColorHex: override.fillColorHex ?? base.fillColorHex,
    bold: override.bold ?? base.bold,
    fontFamily: base.fontFamily,
    align: override.align ?? base.align,
    margins: base.margins,
  };
}

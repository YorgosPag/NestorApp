/**
 * ADR-739 Φάση Α — Γενικός πίνακας (Table): **το μοντέλο δεδομένων**.
 *
 * Καθαρό type module (μηδέν runtime, μηδέν React/canvas) που περιγράφει ΕΝΑΝ πίνακα
 * ανεξάρτητα από το πού ζωγραφίζεται. Το ίδιο `TableModel` τροφοδοτεί και τα τέσσερα
 * backends του §3 (canvas 2D preview / PDF / σκηνή / DXF `ACAD_TABLE`) μέσω της ΜΙΑΣ
 * μηχανής διάταξης (`bim/table/table-layout.ts`) — «οθόνη === PDF === DXF === σκηνή».
 *
 * ## Πού ζει το `TableEntity` (Φάση Γ) — και γιατί ΟΧΙ εδώ
 * Στο αδελφό `types/table-entity.ts`. Αυτό το module μένει **καθαρό μοντέλο**: μηδέν
 * runtime, καμία εξάρτηση από `BaseEntity` / σκηνή / καμβά, ώστε να το διαβάζουν και τα
 * τέσσερα backends (και το PDF, που δεν ξέρει τι είναι οντότητα σκηνής). Το entity
 * προσθέτει τα σκηνικά (θέση, γωνία, στυλ, παράγωγη γεωμετρία) **γύρω** από το μοντέλο —
 * η εξάρτηση δείχνει προς τα εδώ, ποτέ αντίστροφα.
 *
 * ## Δύο χώροι μονάδων — ΠΟΤΕ ανάμεικτοι (§4.1, το μάθημα των ADR-462/716)
 * - **sheet-mm** (χαρτί): πλάτη στηλών, ύψη γραμμών, ύψος κειμένου, περιθώρια, πάχη.
 *   ΟΛΑ τα μεγέθη αυτού του αρχείου είναι sheet-mm.
 * - **model units** (σκηνή): μόνο η θέση της άγκυρας — ζει στο `TableEntity` (Φ.Γ).
 * Η γέφυρα είναι **αποκλειστικά** ο `scaleFactor` του `detail-primitives-to-entities.ts`.
 * Καμία άλλη πολλαπλασιαστική μετατροπή, πουθενά.
 *
 * ## Γιατί επαναχρησιμοποιούνται οι τύποι του ADR-363
 * `ScheduleCellValue` / `ScheduleColumnValueType` / `ScheduleColumnAlign` έρχονται
 * αυτούσιοι από `bim/schedule/types`. Τα τρία υπάρχοντα συστήματα (BIM schedules,
 * τοπογραφικά παραδοτέα, detail sheets) μιλούν ήδη αυτή τη γλώσσα· νέο λεξιλόγιο =
 * τέταρτο λεξιλόγιο = μεταφραστές παντού (η παγίδα «2 λεξιλόγια ρόλων» του ADR-694).
 *
 * @module subapps/dxf-viewer/types/table
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §4
 * @see bim/table/table-layout.ts — η μοναδική μηχανή διάταξης
 * @see bim/table/table-style.ts — το named style (AutoCAD TABLESTYLE)
 */

import type {
  ScheduleCellValue,
  ScheduleColumnAlign,
  ScheduleColumnValueType,
} from '../bim/schedule/types';

// ──────────────────────────────────────────────────────────────────────────────
// Ταυτότητες — γιατί id και ΟΧΙ index
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Σταθερή ταυτότητα στήλης. Τα merges, οι τύποι και τα overrides δείχνουν **εδώ**,
 * ποτέ σε θέση πίνακα: εισαγωγή στήλης στη μέση δεν επιτρέπεται να τα σπάσει.
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

// ──────────────────────────────────────────────────────────────────────────────
// Στήλες — Figma Auto Layout αντί για χειροκίνητα πλάτη
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Πώς αποφασίζεται το πλάτος μιας στήλης (§2.1 εύρημα 5 — το μοντέλο της Figma):
 * - `fixed` — ρητό πλάτος σε sheet-mm· ο χρήστης το κλείδωσε (drag λαβής ορίου).
 * - `hug`   — όσο χρειάζεται το **πλατύτερο περιεχόμενο** της στήλης (+ περιθώρια).
 * - `fill`  — μοιράζεται το υπόλοιπο πλάτος κατ' αναλογία `weight` προς τις άλλες `fill`.
 *
 * Το `frac` του ADR-622 είναι η φτωχή εκδοχή αυτού: εκφράζει **σημείο αγκύρωσης**, όχι
 * πλάτος — γι' αυτό ο σημερινός πίνακας δεν μπορεί να έχει κάθετες γραμμές.
 */
export type TableColumnSizing =
  | { readonly kind: 'fixed'; readonly widthMm: number }
  | { readonly kind: 'hug' }
  | { readonly kind: 'fill'; readonly weight: number };

export interface TableColumn {
  readonly id: TableColumnId;
  readonly sizing: TableColumnSizing;
  /** ΕΠΑΝΑΧΡΗΣΗ ADR-363 — οδηγεί μορφοποίηση αριθμών + στοίχιση εξαγωγής. */
  readonly valueType: ScheduleColumnValueType;
  readonly align: ScheduleColumnAlign;
  /**
   * Κλειδί ανάγνωσης από `ExportableTableRow.cells` όταν ο πίνακας τρέφεται από
   * `ExportableTable` (`bound` / `live` mode). Σχεδιασμένο από τώρα κατά την
   * Απόφαση §14.2 («σχεδιάζεται στο μοντέλο, υλοποιείται στη φάση του»)· απών σε
   * `static` πίνακες που ο χρήστης πληκτρολογεί.
   */
  readonly sourceKey?: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Γραμμές
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Οι τρεις κλάσεις γραμμής του AutoCAD TABLESTYLE. Καθορίζουν ΠΟΙΟ υποστυλ ισχύει
 * (γραμματοσειρά, γέμισμα, περιγράμματα) — δεν είναι διακοσμητική ετικέτα.
 */
export type TableRowClass = 'title' | 'header' | 'data';

/**
 * Μία ακμή περιγράμματος. `visible: false` ⇒ δεν ζωγραφίζεται καθόλου (DXF: group code
 * 288 `borderVisible`), που είναι διαφορετικό από «ζωγραφίζεται με μηδενικό πάχος» — το
 * δεύτερο θα άφηνε hairline σε κάποια backends.
 *
 * Ζει στο μοντέλο (και όχι μόνο στο στυλ) επειδή το χρειάζονται **και τα δύο**: το στυλ
 * για τις κλάσεις γραμμής, το μοντέλο για τη γραμμή-σύνολο ({@link TableRow.borderTop}).
 * Ένας ορισμός· το `table-style.ts` τον επανεξάγει.
 */
export interface TableBorderSpec {
  readonly visible: boolean;
  readonly colorHex: string;
  /** Πάχος γραμμής σε sheet-mm (ISO πένες: 0.13 / 0.15 / 0.25 / 0.50). */
  readonly widthMm: number;
  /** Μοτίβο διακεκομμένης σε sheet-mm· απόν ⇒ συνεχής. */
  readonly dashMm?: readonly number[];
}

export interface TableRow {
  readonly id: TableRowId;
  readonly rowClass: TableRowClass;
  /**
   * Ρητό ύψος σε sheet-mm. Απών ⇒ το ύψος προκύπτει από την κλάση γραμμής του στυλ
   * (και, όταν το κελί αναδιπλώνεται, από το περιεχόμενο).
   */
  readonly heightMm?: number;
  /**
   * Παράκαμψη της **πάνω** ακμής αυτής της γραμμής, σε όλο το πλάτος του πίνακα.
   *
   * Υπάρχει επειδή το row-class μοντέλο του AutoCAD δομικά **δεν μπορεί** να εκφράσει
   * «γραμμή πάνω από μία συγκεκριμένη γραμμή δεδομένων» — και αυτό ακριβώς είναι η
   * γραμμή-σύνολο, καθολικό μοτίβο κάθε πίνακα ποσοτήτων (το AutoCAD το λύνει με
   * per-cell border overrides· μία παράκαμψη ανά γραμμή είναι απλούστερη και αρκεί).
   * Απούσα ⇒ ισχύει ό,τι λέει η κλάση γραμμής.
   */
  readonly borderTop?: TableBorderSpec;
}

// ──────────────────────────────────────────────────────────────────────────────
// Κελιά — αραιά
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Τι περιέχει ένα κελί. Στη Φάση Α **μόνο το `'text'` αξιολογείται**· τα υπόλοιπα
 * δηλώνονται από τώρα (το μοντέλο δεν αλλάζει σχήμα ανά φάση — αλλιώς κάθε φάση θα
 * ήταν breaking change για ό,τι έχει ήδη αποθηκευτεί) και η μηχανή τα περνά ως τιμή
 * χωρίς αξιολόγηση μέχρι να ανοίξει η φάση τους:
 * - `formula` → Φ.Ζ (`fast-formula-parser` πίσω από adapter, §9)
 * - `field`   → placeholders του text engine (ADR-344)
 * - `block` / `image` → DXF group codes 171=2 / 340 (§10)
 */
export type CellKind = 'text' | 'formula' | 'field' | 'block' | 'image';

export interface TableCell {
  readonly kind: CellKind;
  /** ΕΠΑΝΑΧΡΗΣΗ ADR-363 — `string | number | null`. */
  readonly value: ScheduleCellValue;
  /** Πηγαίο κείμενο τύπου, π.χ. `'=SUM(C2:C9)'`. Μόνο όταν `kind === 'formula'` (Φ.Ζ). */
  readonly formula?: string;
  /**
   * Παράκαμψη στυλ **αυτού** του κελιού πάνω από την κλάση γραμμής. Ο τύπος ζει στο
   * `bim/table/table-style.ts` και εισάγεται εκεί ως `Partial<TableCellStyle>` — εδώ
   * κρατιέται αδιαφανής ώστε το μοντέλο να μην εξαρτάται από το στυλ (το στυλ εξαρτάται
   * από το μοντέλο, όχι το αντίστροφο).
   */
  readonly styleOverride?: TableCellStyleOverride;
  /**
   * `live` mode (Φ.Η): κελί που **δεν** δέχεται write-back προς το μοντέλο της σκηνής
   * (π.χ. υπολογισμένο σύνολο). Ο χρήστης το βλέπει, δεν το γράφει.
   */
  readonly locked?: boolean;
}

/**
 * Δομικά ίδιο με `Partial<TableCellStyle>` (βλ. `bim/table/table-style.ts`), δηλωμένο
 * εδώ ώστε `types/table.ts` → `bim/table/table-style.ts` να μην γίνει κύκλος εισαγωγών.
 * Το στυλ αναφέρεται στο μοντέλο· το μοντέλο δεν αναφέρεται στο στυλ.
 */
export interface TableCellStyleOverride {
  readonly textHeightMm?: number;
  readonly textColorHex?: string;
  readonly fillColorHex?: string;
  readonly bold?: boolean;
  /** 9 θέσεις (TL..BR) — DXF group code 170. */
  readonly align?: TableCellAlign;
}

/** Οι 9 θέσεις στοίχισης κελιού του `ACAD_TABLE` (group code 170). */
export type TableCellAlign =
  | 'TL' | 'TC' | 'TR'
  | 'ML' | 'MC' | 'MR'
  | 'BL' | 'BC' | 'BR';

// ──────────────────────────────────────────────────────────────────────────────
// Συγχωνεύσεις
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Μια συγχώνευση κελιών. Η **άγκυρα** (πάνω-αριστερά κελί) κρατά το περιεχόμενο· τα
 * καλυμμένα κελιά δεν ζωγραφίζονται και τα εσωτερικά τους περιγράμματα παραλείπονται.
 * DXF: group codes 175 (πλάτος) / 176 (ύψος) στο κελί-άγκυρα.
 */
export interface CellSpan {
  readonly anchorRowId: TableRowId;
  readonly anchorColId: TableColumnId;
  /** Πλήθος γραμμών που καλύπτει, **μαζί** με την άγκυρα (≥1). */
  readonly rowSpan: number;
  /** Πλήθος στηλών που καλύπτει, **μαζί** με την άγκυρα (≥1). */
  readonly colSpan: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Το μοντέλο
// ──────────────────────────────────────────────────────────────────────────────

export interface TableModel {
  readonly columns: readonly TableColumn[];
  readonly rows: readonly TableRow[];
  /**
   * **Αραιός** χάρτης: μόνο τα μη-κενά / overridden κελιά. Ένας πίνακας 500×8 έχει
   * 4.000 θέσεις και σχεδόν όλες κενές· πυκνή αναπαράσταση θα σήμαινε 4.000
   * αντικείμενα σε **κάθε** στιγμιότυπο undo.
   */
  readonly cells: ReadonlyMap<CellKey, TableCell>;
  readonly merges: readonly CellSpan[];
}

// ──────────────────────────────────────────────────────────────────────────────
// Δεσμός με τη σκηνή (σχεδιασμένος τώρα, υλοποιείται Φ.ΣΤ/Η — Απόφαση §14.2)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Πόσο «ζωντανός» είναι ο πίνακας (§3 Αρχή 1):
 * - `static` — τα κελιά τα πληκτρολόγησε ο χρήστης (ανάλογο: AutoCAD TABLE).
 * - `bound`  — στιγμιότυπο από `ExportableTable`, με revision stamp ώστε να **δηλώνει**
 *   πότε είναι μπαγιάτικος (ανάλογο: AutoCAD Data Link — αλλά ο δικός μας δεσμός δείχνει
 *   στη ΣΚΗΝΗ, όχι σε εξωτερικό αρχείο Excel που μπορεί να μετακομίσει).
 * - `live`   — αναπαράγεται σε κάθε regen, με write-back (ανάλογο: Revit Schedule).
 */
export type TableBindingMode = 'static' | 'bound' | 'live';

export interface TableBinding {
  readonly mode: Exclude<TableBindingMode, 'static'>;
  /**
   * Τι παράγει τα δεδομένα: ο τύπος schedule ή το τοπογραφικό παραδοτέο. Αδιαφανές
   * αναγνωριστικό — ο resolver ζει στη φάση του (Φ.ΣΤ), όχι εδώ.
   */
  readonly sourceRef: string;
  /**
   * Αποτύπωμα της κατάστασης της σκηνής όταν παρήχθησαν τα κελιά. Διαφορά με το τρέχον
   * ⇒ ο πίνακας δείχνει «μπαγιάτικος». Το ADR-720 έχει ήδη διδάξει ότι **ένα
   * κατασκευασμένο νούμερο σε παραδοτέο είναι μέτρηση που κανείς δεν πήρε** — παλιά
   * νούμερα χωρίς ένδειξη είναι σφάλμα **τιμής**, όχι εμφάνισης.
   */
  readonly revision: string;
}

/**
 * AutoCAD table breaking: όταν ο πίνακας ξεπερνά το `maxHeightMm`, σπάει σε τμήματα
 * δίπλα-δίπλα με επανάληψη κεφαλίδας. Δηλώνεται στο μοντέλο· υλοποιείται στη Φ.Γ μαζί
 * με τον renderer (εκεί υπάρχει ο καταναλωτής — όχι προληπτικά).
 */
export interface TableBreaking {
  readonly maxHeightMm: number;
  /** Οριζόντιο κενό ανάμεσα στα τμήματα (sheet-mm). */
  readonly gapMm: number;
  /** Επανάληψη των γραμμών `title`/`header` σε κάθε τμήμα (AutoCAD parity). */
  readonly repeatHeader: boolean;
}

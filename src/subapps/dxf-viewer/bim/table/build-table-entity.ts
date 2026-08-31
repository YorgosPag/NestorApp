/**
 * ADR-739 Φάση Δ — **το εργοστάσιο του νέου πίνακα**: ένα κλικ, ένας πίνακας.
 *
 * Αδελφός του `bim/opening-info-tag/build-opening-info-tag-entity.ts` (ADR-612): καθαρός
 * builder ενός σημείου, με το mapping «ζωντανές επιλογές → επιλογές κατασκευής» να ζει
 * στο module του store (`state/table-options-store.ts`) — ίδια μονόδρομη κατεύθυνση
 * εισαγωγών, μηδέν κύκλος, **ένα** mapping για commit και φάντασμα (N.18).
 *
 * ## Το σημείο του κλικ είναι η **πάνω-αριστερή** γωνία
 * Σύμβαση `ACAD_TABLE` (βλ. doc του {@link TableEntity.position}): ο πίνακας μεγαλώνει
 * προς τα κάτω-δεξιά καθώς προστίθενται γραμμές, οπότε άγκυρα στο κέντρο θα τον
 * μετακινούσε σε **κάθε** νέα γραμμή — ακριβώς ό,τι δεν κάνει κανένα CAD.
 *
 * ## Ο νέος πίνακας γεννιέται ΕΝΤΕΛΩΣ ΚΕΝΟΣ και ΟΥΔΕΤΕΡΟΣ (απόφαση Giorgio, 2026-08-04)
 * Προηγουμένως σπέρναμε 4 κελιά (τίτλος + 3 κεφαλίδες) με το επιχείρημα «Excel/Sheets/Revit
 * δίνουν πάντα κεφαλίδες». Το επιχείρημα ήταν λάθος για **αυτόν** τον καμβά: εδώ ο πίνακας
 * δεν είναι φύλλο εργασίας, είναι **σχεδιαστικό αντικείμενο**, και ο χρήστης φτιάχνει τον
 * δικό του πίνακα με τα δικά του δεδομένα — υπόμνημα, ποσότητες, στοιχεία έργου, καρτέλα.
 * Κάθε προσυμπληρωμένο κελί ήταν **δουλειά σβησίματος** πριν την πρώτη πραγματική εγγραφή.
 *
 * Τρεις συνέπειες, όλες σκόπιμες:
 * - **Κανένα κείμενο** (`cells: []`) — δεν μαντεύουμε τι πίνακα θέλει ο χρήστης.
 * - **Καμία συγχώνευση** (`merges: []`) — ο τίτλος-σε-όλο-το-πλάτος ήταν απόφαση για
 *   λογαριασμό του χρήστη· η συγχώνευση είναι πια δική **του** πράξη, όποτε τη θέλει.
 * - **Καμία οπτική διαφοροποίηση κελιού** — το γκρι γέμισμα / τα έντονα / τα μεγέθη της
 *   κεφαλίδας έφυγαν από το ίδιο το στυλ `standard` (βλ. `table-style-presets.ts`).
 *
 * Η δομή γραμμών (`title` / `header` / `data`) **μένει**: είναι το συμβόλαιο του μοντέλου
 * και η λαβή με την οποία ένα άλλο στυλ (π.χ. `detailSheet`) ξαναδίνει ιεραρχία. Ουδέτερος
 * σημαίνει «καμία διαφορά στην οθόνη», όχι «πέταξε τη σημασιολογία».
 *
 * ## Το `model` είναι απλό JSON — ΠΟΤΕ `Map` (Λύση Α, §4)
 * Χτίζεται μέσω `createTableModel` (η **μόνη** νόμιμη πηγή `CellKey`) και σειριοποιείται
 * με `toPersistedTableModel` (ντετερμινιστική σειρά γραμμής→στήλης). Χειροποίητος `Map`
 * εδώ θα εξαφανιζόταν σιωπηλά στο πρώτο `JSON.stringify` (αποθήκευση / undo / πρόχειρο).
 *
 * Το `geometry` **δεν** γράφεται: είναι παράγωγο του `computeTableEntityGeometry`.
 *
 * @module subapps/dxf-viewer/bim/table/build-table-entity
 * @see state/table-options-store.ts — `buildTableEntityFromLiveOptions` (το ΕΝΑ mapping)
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §4, §4.1, §18
 */

import type { Point2D } from '../../rendering/types/Types';
import type {
  PersistedTableModel,
  TableColumn,
  TableRow,
} from '../../types/table';
import type { TableEntity } from '../../types/table-entity';
import { MIN_TABLE_COLUMN_WIDTH_MM } from '../../types/table-entity';
import { FIRST_TABLE_WORKSHEET_ID } from '../../types/table-worksheet';
import { createTableModel, toPersistedTableModel } from './table-model-helpers';
import { BUILTIN_TABLE_STYLE_IDS } from './table-style-presets';
import { MAX_TABLE_COLUMN_COUNT, MAX_TABLE_TOTAL_ROW_COUNT } from './table-ooxml-limits';
import { fitTableGrid } from './table-capacity';


// ──────────────────────────────────────────────────────────────────────────────
// Προεπιλογές — AutoCAD parity (1 γραμμή Title, 1 Header, οι υπόλοιπες Data)
// ──────────────────────────────────────────────────────────────────────────────

export const DEFAULT_TABLE_COLUMN_COUNT = 3;
export const DEFAULT_TABLE_DATA_ROW_COUNT = 3;

/**
 * Οι γραμμές που ο builder προσθέτει **πάντα**, πάνω από τις γραμμές δεδομένων: 1 `title` +
 * 1 `header` (βλ. {@link buildRows}). Άρα οι **συνολικές** γραμμές ενός νέου πίνακα είναι
 * `TABLE_FIXED_ROW_COUNT + dataRowCount`, και ποτέ λιγότερες από 2.
 *
 * **Γιατί εξάγεται**: ο επιλογέας μεγέθους της κορδέλας (ADR-739 §39) μιλά **σύνολα** —
 * «Πίνακας 5×2» σημαίνει 2 γραμμές στην οθόνη, όπως στο Word. Ο μετασχηματισμός
 * «σύνολο ⇄ δεδομένα» χρειάζεται αυτόν τον αριθμό, και το «+1+1» είναι γεγονός **αυτού**
 * του module: αν το UI τον ξαναδήλωνε, θα υπήρχαν δύο αλήθειες για την ίδια δομή.
 *
 * @see ui/ribbon/components/table/table-size-menu-model.ts — ο μοναδικός καταναλωτής
 */
export const TABLE_FIXED_ROW_COUNT = 2;
/** Πλάτος στήλης σε **sheet-mm** (§4.1: ό,τι είναι διάταξη είναι χαρτί, ποτέ κόσμος). */
export const DEFAULT_TABLE_COLUMN_WIDTH_MM = 40;

/**
 * 🔴 ADR-833 Φ5Β — **ΤΑ ΑΝΩ ΟΡΙΑ ΑΛΛΑΞΑΝ ΙΔΙΟΚΤΗΤΗ.**
 *
 * Μέχρι τη Φάση 5Β εδώ ζούσαν δύο αριθμοί (**256 στήλες / 1.000 γραμμές**) με αιτιολόγηση
 * το **χαρτί**. Η αιτιολόγηση δεν επιβίωσε — δες `table-ooxml-limits.ts` για το γιατί
 * (ίσχυε μόνο στο ελάχιστο πλάτος στήλης· και ο πίνακας έπαψε να είναι μόνο σχέδιο από τη
 * στιγμή που διαβάζει και γράφει `.xlsx`). Πλέον υπάρχουν **δύο ερωτήσεις με δύο
 * ιδιοκτήτες**, και καμία από τις δύο δεν είναι ζεύγος διαστάσεων:
 *
 * ```
 *   «γράφεται σε .xlsx;»          → table-ooxml-limits   (ράγες του προτύπου)
 *   «μένει ζωντανή η επιφάνεια;»  → table-capacity       (ΠΥΚΝΟ γινόμενο, μετρημένο)
 *   «χωράει στο έγγραφο;»         → table-capacity       (bytes, μετρημένα)
 * ```
 *
 * Το `MAX_TABLE_DATA_ROW_COUNT` **παράγεται** από τη ράγα του προτύπου μείον τις σταθερές
 * γραμμές: το πρότυπο μετρά **συνολικές** γραμμές, αυτό το module μιλά **δεδομένων**, και
 * μια δεύτερη χειρόγραφη τιμή θα ήταν δύο απαντήσεις στο ίδιο ερώτημα.
 *
 * ⚠️ Το `MAX_TABLE_COLUMN_WIDTH_MM` **μένει**: εκεί το επιχείρημα του χαρτιού είναι
 * ακέραιο — μια **στήλη** φαρδύτερη από τη μεγάλη πλευρά ενός A0 δεν είναι στήλη.
 *
 * Το όριο **κόβει** (clamp), δεν πετά εξαίρεση: όποιος γράψει έναν τεράστιο αριθμό παίρνει
 * τον μεγαλύτερο πίνακα που έχει νόημα, όχι σφάλμα.
 */
export const MAX_TABLE_DATA_ROW_COUNT = MAX_TABLE_TOTAL_ROW_COUNT - TABLE_FIXED_ROW_COUNT;
export const MAX_TABLE_COLUMN_WIDTH_MM = 1189;

const TITLE_ROW_INDEX = 0;
const HEADER_ROW_INDEX = 1;

/**
 * Ταυτότητες **τοπικές στον πίνακα** — ίδια σύμβαση με τον adapter του ADR-622
 * (`detail-sheet-schedule-table.ts`: `c0`, `d0`). Ο N.6 αφορά έγγραφα Firestore και την
 * ταυτότητα της **οντότητας** (`generateEntityId`)· μια γραμμή δεν είναι έγγραφο, και
 * enterprise id ανά κελί θα φούσκωνε κάθε στιγμιότυπο undo χωρίς κανένα όφελος.
 */
const columnId = (i: number): string => `c${i}`;
const rowId = (i: number): string => `r${i}`;

/** Ό,τι μπορεί να ρυθμίσει η ribbon πριν το κλικ· όλα προαιρετικά (έχουν προεπιλογή). */
export interface BuildTableOptions {
  readonly columnCount?: number;
  /** Γραμμές **δεδομένων** — ο τίτλος και η κεφαλίδα δεν μετριούνται εδώ. */
  readonly dataRowCount?: number;
  readonly columnWidthMm?: number;
  readonly name?: string;
}

interface TableShape {
  readonly columnCount: number;
  readonly dataRowCount: number;
  readonly columnWidthMm: number;
}

/**
 * 🔴 **Το φράγμα** — μία συνάρτηση ανά μέγεθος, και γι' αυτό **εξάγονται**.
 *
 * ## Γιατί το `NaN` δεν είναι εξωτικό
 * `parseFloat('')` **είναι** `NaN`: αυτό ακριβώς παράγει ένα αριθμητικό πεδίο της ribbon
 * που ο χρήστης άδειασε με backspace. Δεν είναι σενάριο επίθεσης, είναι η Τρίτη το πρωί.
 * Μέχρι σήμερα και τα τρία μεγέθη περνούσαν άθικτα, με τρεις διαφορετικές συνέπειες:
 *
 * - `columnWidthMm: NaN` → `layout.widthMm` NaN → `worldCorners` NaN → **bbox NaN**. Και
 *   επειδή το `entity-bounds-ssot` **ενώνει** bboxes, ένα NaN δηλητηριάζει τα όρια
 *   ΟΛΟΚΛΗΡΗΣ της σκηνής: zoom-extents και marquee σπάνε **καθολικά**, όχι στον πίνακα.
 * - `columnCount: NaN` → `i < NaN` ψευδές από την πρώτη επανάληψη → μηδέν στήλες →
 *   **αόρατη οντότητα**, ακριβώς αυτό που το φράγμα υποσχόταν ότι εμποδίζει.
 * - `columnCount: Infinity` → `for (i = 0; i < Infinity; i++) columns.push(...)` →
 *   **πάγωμα καρτέλας + OOM**.
 *
 * ## Η απόφαση: μη-πεπερασμένο ⇒ **προεπιλογή**
 * Όχι 0 (αυτό είναι ο αόρατος πίνακας), όχι `throw` (όποιος σβήνει ένα πεδίο δεν πρέπει να
 * χάσει τον πίνακά του, και μια εξαίρεση εδώ ζει μέσα στο render pass του φαντάσματος).
 * Πεπερασμένο αλλά εκτός εύρους **κόβεται** στα άκρα — 0 στήλες γίνονται 1, 10.000 στήλες
 * γίνονται {@link MAX_TABLE_COLUMN_COUNT}.
 */
function sanitizeCount(
  raw: number | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const value = raw ?? fallback;
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

/** Τουλάχιστον μία στήλη: μηδέν στήλες = πίνακας χωρίς πλάτος = αόρατη οντότητα. */
export function sanitizeTableColumnCount(value: number | undefined): number {
  return sanitizeCount(value, DEFAULT_TABLE_COLUMN_COUNT, 1, MAX_TABLE_COLUMN_COUNT);
}

/** Μηδέν γραμμές δεδομένων είναι νόμιμο: μένουν ο τίτλος και η κεφαλίδα. */
export function sanitizeTableDataRowCount(value: number | undefined): number {
  return sanitizeCount(value, DEFAULT_TABLE_DATA_ROW_COUNT, 0, MAX_TABLE_DATA_ROW_COUNT);
}

/**
 * Το πλάτος **δεν** στρογγυλοποιείται (39,5mm είναι απολύτως νόμιμο πλάτος στήλης), μόνο
 * φράσσεται: κάτω από το `MIN_TABLE_COLUMN_WIDTH_MM` δεν χωρά ούτε ένας χαρακτήρας.
 */
export function sanitizeTableColumnWidthMm(value: number | undefined): number {
  const width = value ?? DEFAULT_TABLE_COLUMN_WIDTH_MM;
  if (!Number.isFinite(width)) return DEFAULT_TABLE_COLUMN_WIDTH_MM;
  return Math.min(MAX_TABLE_COLUMN_WIDTH_MM, Math.max(MIN_TABLE_COLUMN_WIDTH_MM, width));
}

/**
 * Οι επιλογές σε **έγκυρο** σχήμα — η τελευταία πύλη πριν την κατασκευή.
 *
 * ## Γιατί το φράγμα μπαίνει ΚΑΙ εδώ ΚΑΙ στους setters του store
 * Δεν είναι διπλή δουλειά, είναι δύο διαφορετικές ερωτήσεις με τον **ίδιο** κανόνα (μία
 * υλοποίηση, τρεις εξαγόμενες συναρτήσεις — N.18):
 * - Ο **store** καθαρίζει ό,τι γράφεται, ώστε η ribbon να μη δείχνει ποτέ `NaN` ενώ ο
 *   πίνακας γεννιέται με 3 στήλες. Ένα UI που λέει άλλα από αυτά που κάνει είναι ψέμα.
 * - Το **`resolveShape`** καθαρίζει ό,τι φτάνει στον builder, επειδή ο store **δεν είναι**
 *   η μόνη πόρτα: το `buildTableEntity` είναι δημόσιο και το καλούν ήδη ο builder της
 *   ολοκλήρωσης, το φάντασμα και τα tests. Φράγμα μόνο στον store θα ήταν φράγμα που ο
 *   επόμενος καλών παρακάμπτει χωρίς να το ξέρει.
 */
function resolveShape(opts: BuildTableOptions): TableShape {
  const columnWidthMm = sanitizeTableColumnWidthMm(opts.columnWidthMm);
  // 🔴 ADR-833 Φ5Β — **το ΓΙΝΟΜΕΝΟ επιβάλλεται εδώ, όχι στους δύο καθαριστές.**
  // Οι `sanitizeTableColumnCount` / `sanitizeTableDataRowCount` βλέπουν **έναν** άξονα ο
  // καθένας, άρα κανένας τους δεν μπορεί να απαντήσει «χωράει το πλέγμα;» — δύο νόμιμοι
  // αριθμοί (16.000 στήλες, 16.000 γραμμές) δίνουν πλέγμα 256 εκατομμυρίων κελιών. Το
  // `fitTableGrid` είναι ο **ίδιος** κανόνας που κόβει και την εισαγωγή `.xlsx`: μία
  // διατύπωση του «τι χωράει», δύο καλούντες.
  const fitted = fitTableGrid(
    TABLE_FIXED_ROW_COUNT + sanitizeTableDataRowCount(opts.dataRowCount),
    sanitizeTableColumnCount(opts.columnCount),
    // Ο τίτλος και η κεφαλίδα γεννιούνται **πάντα** ({@link buildRows}), άρα οι στήλες
    // οφείλουν να κοπούν απέναντι σε αυτές — αλλιώς ένα αίτημα «500.000 στήλες» παρήγαγε
    // πίνακα 16.384 × 2 = 32.768 πυκνά κελιά, πάνω από το ίδιο το όριο.
    TABLE_FIXED_ROW_COUNT,
  );
  return {
    columnCount: fitted.columnCount,
    dataRowCount: Math.max(0, fitted.rowCount - TABLE_FIXED_ROW_COUNT),
    columnWidthMm,
  };
}

/**
 * Όλες οι στήλες `fixed`. **Όχι `hug`**: το `hug` μετρά το πλατύτερο περιεχόμενο, οπότε
 * ένας κενός πίνακας θα γεννιόταν με στήλες πλάτους περιθωρίου και θα «πηδούσε» σε πλάτος
 * με το πρώτο κείμενο που θα έγραφε ο χρήστης.
 */
function buildColumns(shape: TableShape): TableColumn[] {
  const columns: TableColumn[] = [];
  for (let i = 0; i < shape.columnCount; i++) {
    columns.push({
      id: columnId(i),
      sizing: { kind: 'fixed', widthMm: shape.columnWidthMm },
      valueType: 'text',
      align: 'left',
    });
  }
  return columns;
}

/** 1 `title` + 1 `header` + N `data` — η τεκμηρίωση της Autodesk για το ACAD_TABLE. */
function buildRows(shape: TableShape): TableRow[] {
  const rows: TableRow[] = [
    { id: rowId(TITLE_ROW_INDEX), rowClass: 'title' },
    { id: rowId(HEADER_ROW_INDEX), rowClass: 'header' },
  ];
  // Οι γραμμές δεδομένων ξεκινούν ακριβώς μετά τις σταθερές — ο ίδιος αριθμός με τον οποίο
  // η κορδέλα μετατρέπει «σύνολο» σε «δεδομένα» (TABLE_FIXED_ROW_COUNT), όχι δεύτερο «+1+1».
  for (let i = 0; i < shape.dataRowCount; i++) {
    rows.push({ id: rowId(TABLE_FIXED_ROW_COUNT + i), rowClass: 'data' });
  }
  return rows;
}

// ──────────────────────────────────────────────────────────────────────────────
// Το μοντέλο — απομνημονευμένο ανά σχήμα
// ──────────────────────────────────────────────────────────────────────────────

let memoKey = '';
let memoModel: PersistedTableModel | null = null;

/**
 * Το `PersistedTableModel` ενός νέου πίνακα. **Μονοθέσια μνήμη επίτηδες**: το φάντασμα
 * του εργαλείου ξαναχτίζει την οντότητα σε **κάθε** κίνηση ποντικιού, και ένα νέο
 * αντικείμενο μοντέλου ανά καρέ θα αστοχούσε και στις δύο `WeakMap` της Φ.Γ
 * (`resolveTableModel` → `resolveTableLayout`) ⇒ πλήρης διάταξη ανά καρέ, δηλαδή ακριβώς
 * το σχήμα που ο **ADR-735** πλήρωσε σε παραγωγή. Ίδιο σχήμα + ίδια γλώσσα ⇒ **η ίδια
 * αναφορά** ⇒ η αλυσίδα των μνημών κρατά.
 *
 * Η κοινή αναφορά είναι ασφαλής επειδή το `PersistedTableModel` είναι `readonly` σε κάθε
 * πεδίο: κάθε επεξεργασία κελιού (Φ.Δ βήμα 2) παράγει **νέο** αντικείμενο, οπότε δύο
 * πίνακες δεν μπορούν ποτέ να «μοιραστούν» μια αλλαγή.
 */
export function buildTableModel(opts: BuildTableOptions = {}): PersistedTableModel {
  const shape = resolveShape(opts);
  // Το κλειδί είναι **μόνο** το σχήμα. Η γλώσσα έφυγε από εδώ μαζί με τα σπαρμένα κελιά:
  // ένας πίνακας χωρίς κείμενο δεν έχει τίποτα να μεταφραστεί, οπότε αλλαγή γλώσσας δεν
  // παράγει διαφορετικό μοντέλο — και ένα κλειδί που κουβαλά κάτι που δεν επηρεάζει το
  // αποτέλεσμα είναι απλώς αστοχία μνήμης χωρίς αντάλλαγμα.
  const key = `${shape.columnCount}|${shape.dataRowCount}|${shape.columnWidthMm}`;
  if (memoModel && memoKey === key) return memoModel;

  const model = toPersistedTableModel(createTableModel({
    columns: buildColumns(shape),
    rows: buildRows(shape),
    // Κενός και ασυγχώνευτος — βλ. την επικεφαλίδα του module.
    cells: [],
    merges: [],
  }));
  memoKey = key;
  memoModel = model;
  return model;
}

// ──────────────────────────────────────────────────────────────────────────────
// Η οντότητα
// ──────────────────────────────────────────────────────────────────────────────

/**
 * `TableEntity` με **πάνω-αριστερή γωνία** στο `position` (μονάδες σκηνής). `angleRad = 0`
 * πάντα: η περιστροφή είναι μεταγενέστερη πράξη λαβής, ποτέ βαθμός ελευθερίας της
 * κατασκευής (ίδια σύμβαση με scale-bar / opening-info-tag).
 *
 * Καθαρή — καμία παρενέργεια πέρα από τα `id` / `layerId` που δίνει ο καλών.
 */
export function buildTableEntity(
  position: Point2D,
  opts: BuildTableOptions,
  id: string,
  layerId: string,
): TableEntity {
  return {
    id,
    type: 'table',
    layerId,
    name: opts.name,
    position: { x: position.x, y: position.y },
    angleRad: 0,
    styleId: BUILTIN_TABLE_STYLE_IDS.STANDARD,
    // ADR-833 Φάση 2 — **ένα** φύλλο, χωρίς όνομα. Το όνομα είναι δεδομένο **χρήστη** και ο
    // χρήστης δεν έγραψε κανένα· η προεπιλογή («Φύλλο1») ανήκει στην παρουσίαση και ακολουθεί τη
    // ζωντανή γλώσσα. Δες `types/table-worksheet.ts` §3 για το γιατί αυτό δεν είναι παράλειψη.
    worksheets: [{ id: FIRST_TABLE_WORKSHEET_ID, model: buildTableModel(opts) }],
    activeWorksheetId: FIRST_TABLE_WORKSHEET_ID,
  };
}

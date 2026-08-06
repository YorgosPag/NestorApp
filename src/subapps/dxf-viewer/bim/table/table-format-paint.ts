/**
 * 🔴 ADR-768 Φ3 — **Η ΠΡΑΞΗ ΤΟΥ ΠΙΝΕΛΟΥ**: φόρτωμα από την πηγή, βάψιμο στον στόχο.
 * Καθαρή, αμετάβλητη: μηδέν React, μηδέν DOM, μηδέν store.
 *
 * ## 🏆 «ΕΛΑΧΙΣΤΗ ΥΛΟΠΟΙΗΣΗ» — εδώ το εργαλείο ξεπερνά και τους πέντε μεγάλους
 *
 * Το ερώτημα είναι ένα και είναι όλη η ποιότητα του εργαλείου: **τι γράφεται στον στόχο**,
 * όταν αυτό που βλέπεις στην πηγή δεν το λέει η πηγή αλλά η γραμμή ή η στήλη της;
 *
 * | εργαλείο | τι γράφει | το ελάττωμα |
 * |---|---|---|
 * | **Excel** | την **επιλυμένη** μορφή, πάντα καρφωτά | δεν *έχει* επίπεδα· ο στόχος γίνεται **άτρωτος** σε κάθε μελλοντική αλλαγή γραμμής/στήλης |
 * | **AutoCAD** MATCHPROP | τη **δήλωση** (`ByLayer` μένει `ByLayer`) | ο στόχος μπορεί να **φαίνεται διαφορετικός** από την πηγή — δηλαδή το «match» δεν κάνει match |
 * | **Word** Format Painter | το **στυλ** παραγράφου, όταν η πηγή είναι ολόκληρη παράγραφος | η ίδια η Microsoft προτιμά την κληρονομιά **όταν μπορεί** — το Excel δεν μπορεί |
 * | **InDesign** | — | τα τοπικά overrides είναι **αναγνωρισμένο πρόβλημα** (το `+` δίπλα στο στυλ, τρεις συντομεύσεις για να σβήνονται) |
 * | **ΝΕΣΤΩΡ** `table-range-transfer` §26 | μόνο το **επίπεδο 1** | σωστό για **μετακίνηση** (δεν υπόσχεται ομοιότητα)· θανάσιμο για **πινέλο**: το βάψιμο δεν θα άλλαζε τίποτα στην οθόνη |
 *
 * **Ο κανόνας εδώ, ανά πεδίο:**
 * ```
 *   Vs  = η ΕΠΙΛΥΜΕΝΗ τιμή της πηγής            (τι βλέπει ο χρήστης)
 *   Vt⁰ = τι θα έλυνε ο ΣΤΟΧΟΣ ΧΩΡΙΣ δική του παράκαμψη  (η κληρονομιά του)
 *
 *   Vs === Vt⁰  →  γράψε undefined  ⇒ σβήσε την παράκαμψη· ο στόχος μένει ΖΩΝΤΑΝΟΣ
 *   αλλιώς      →  γράψε ρητά Vs
 * ```
 *
 * **Τρία μετρήσιμα κέρδη**, κανένα από τα οποία δεν έχει κανένα από τα πέντε μαζί:
 * 1. **Ισοδυναμία με Excel, αποδείξιμη**: μετά την πράξη ισχύει `resolved(στόχος) ===
 *    resolved(πηγή)` για **κάθε** βαμμένο πεδίο. Είναι test, όχι ισχυρισμός.
 * 2. **Η κληρονομιά επιβιώνει όπου μπορεί** — βάψιμο μέσα στην ίδια γραμμή γράφει **μηδέν**.
 * 3. **Σωστό undo δωρεάν**: μηδέν εγγραφές ⇒ ίδιο μοντέλο by-reference ⇒ καμία εντολή, κανένα
 *    βήμα `Ctrl+Z` για το τίποτα (ADR-739 §6.6). Το Excel εδώ έχει **τεκμηριωμένο** παράπονο
 *    χρηστών ότι το undo του πινέλου δεν επαναφέρει σωστά.
 *
 * ## Δύο κανάλια, ένα undo
 * Οι παρακάμψεις κελιών και οι ρητές ακμές είναι δύο διαφορετικοί γραφείς (ADR-750). Και οι
 * δύο είναι **καθαροί**, οπότε αλυσιδώνονται στη μνήμη και φτάνουν στον καλούντα ως **ένα**
 * μοντέλο: η ατομικότητα βγαίνει δωρεάν από την καθαρότητα αντί να χτιστεί από πάνω της —
 * ίδιο σκεπτικό και ίδια λόγια με το `applyTableRangeTransfer`.
 *
 * ⚠️ **Καμία επανάληψη υπολογισμού τύπων.** Το πινέλο **δεν** αγγίζει `value` / `formula`, άρα
 * κανένας τύπος δεν γίνεται μπαγιάτικος — γι' αυτό ο γραφέας είναι ο
 * {@link writePersistedCellStyles} («η όψη ΜΟΡΦΟΠΟΙΗΣΗΣ», ADR-739 §50) και όχι ο
 * {@link writePersistedCells}: ο τύπος επιστροφής **επιβάλλει** ότι δεν χρωστάμε τίποτα.
 *
 * @module subapps/dxf-viewer/bim/table/table-format-paint
 * @see bim/table/table-format-payload.ts — ο ΕΝΑΣ ορισμός του «τι είναι μορφή»
 * @see bim/table/table-format-read.ts — η ανάγνωση
 * @see bim/table/table-range-tiling.ts — το άπλωμα του μοτίβου
 * @see docs/centralized-systems/reference/adrs/ADR-768-table-format-painter.md
 */

import { forEachResolvedCellStyle, type TableResolvedCell } from './table-cell-style-scan';
import { tableCellFormatOf, tableCellEdgePosition } from './table-format-read';
import { resolveCellNumberFormat } from './table-cell-format';
import { resolveCellOverflow } from './table-cell-overflow';
import { isTableCellFormatEqual } from './table-number-format-ops';
import { inheritedTableEdgeSpec } from './table-edge-resolve';
import { sameBorderSpec, setTableEdges, tableEdgeKeyAt } from './table-edge-model';
import { resolveCellStyle, type TableCellStyle } from './table-style';
import { writePersistedCellStyles } from './table-cell-content';
import { runsWithoutField } from './table-range-style-ops';
import { resolveTableModel } from './table-model-helpers';
import { tableRangeCellRefs } from './table-cell-range';
import { tileTableTarget, type TableTiledSlot } from './table-range-tiling';
import {
  TABLE_CELL_BORDER_SIDES,
  tableFormatBrushCellAt,
  tableFormatStyleKeysOfFacet,
  type TableCellFormatPayload,
  type TableFormatBrush,
  type TableFormatFacetSet,
} from './table-format-payload';
import type { TableCellStyleKey } from './table-cell-style-scan';
import type { TableCellRangeBounds } from './table-cell-range';
import type { TableStyle } from './table-style';
import type {
  PersistedTableModel,
  TableBorderSpec,
  TableCell,
  TableCellStyleOverride,
} from '../../types/table';
import type { TableEdgeKey } from '../../types/table-edges';

// ──────────────────────────────────────────────────────────────────────────────
// 1. Φόρτωμα — «ρούφα»
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Φορτώνει το πινέλο από μια περιοχή. `null` όταν **κανένα** κελί της δεν υπάρχει (μπαγιάτικα
 * όρια μετά από undo) — ο καλών σβήνει το πινέλο, δεν μαντεύει.
 *
 * ⚠️ Ο πίνακας `cells` είναι **row-major και πλήρης** εκ κατασκευής: γεμίζει σε δύο εμφωλευμένους
 * βρόχους πάνω στο ορθογώνιο, όχι από τη σειρά επίσκεψης του σαρωτή. Η σειρά του σαρωτή
 * ακολουθεί τη λίστα `refs` και θα ήταν σωστή σήμερα **κατά σύμπτωση** — και θα έσπαγε σιωπηλά
 * την ημέρα που το {@link tableRangeCellRefs} αλλάξει σειρά για οποιονδήποτε λόγο.
 */
export function captureTableFormatBrush(
  model: PersistedTableModel,
  style: TableStyle,
  source: TableCellRangeBounds,
  facets: TableFormatFacetSet,
): TableFormatBrush | null {
  const resolved = resolveTableModel(model);
  const rows = source.lastRow - source.firstRow + 1;
  const columns = source.lastCol - source.firstCol + 1;
  if (rows <= 0 || columns <= 0) return null;

  const byPosition = new Map<string, TableCellFormatPayload>();
  const visited = forEachResolvedCellStyle(
    model,
    style,
    tableRangeCellRefs(model, source),
    (cell) => {
      byPosition.set(`${cell.rowIndex} ${cell.colIndex}`, tableCellFormatOf(resolved, style, cell));
    },
  );
  if (!visited) return null;

  const cells: TableCellFormatPayload[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      const payload = byPosition.get(`${source.firstRow + r} ${source.firstCol + c}`);
      // Τρύπα στο ορθογώνιο σημαίνει μπαγιάτικα όρια. Ένα μισό μοτίβο θα έβαφε σιωπηλά
      // κάτι που ο χρήστης δεν μάρκαρε ποτέ· η άρνηση είναι η μόνη τίμια απάντηση.
      if (payload === undefined) return null;
      cells.push(payload);
    }
  }

  return { facets, rows, columns, cells };
}

// ──────────────────────────────────────────────────────────────────────────────
// 2. Βάψιμο — «ένεσε»
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Βάφει τον στόχο με το φορτωμένο πινέλο. Επιστρέφει το **ίδιο** μοντέλο by-reference όταν
 * τίποτα δεν άλλαξε — καμία εντολή, κανένα βήμα undo για το τίποτα.
 *
 * Η αφετηρία του μοτίβου είναι το **πάνω-αριστερά του στόχου**: η πηγή μπορεί να βρίσκεται
 * οπουδήποτε αλλού (ή να έχει σβηστεί), οπότε δεν έχει καμία γεωμετρική σχέση με τον στόχο.
 * Διαφέρει εδώ από τη λαβή συμπλήρωσης, όπου η πηγή είναι γειτονική εξ ορισμού.
 */
export function paintTableFormat(
  model: PersistedTableModel,
  style: TableStyle,
  brush: TableFormatBrush,
  target: TableCellRangeBounds,
): PersistedTableModel {
  const resolved = resolveTableModel(model);
  const slots = tileTableTarget(resolved, target, {
    rows: brush.rows,
    columns: brush.columns,
    originRow: target.firstRow,
    originCol: target.firstCol,
  });
  if (slots.length === 0) return model;

  const byTarget = new Map<string, TableTiledSlot>();
  for (const slot of slots) byTarget.set(`${slot.rowIndex} ${slot.colIndex}`, slot);

  const withCells = paintCellOverrides(model, style, brush, slots, byTarget);
  return brush.facets.has('borders')
    ? paintEdges(withCells, style, brush, slots)
    : withCells;
}

// ──────────────────────────────────────────────────────────────────────────────
// 2α. Παρακάμψεις κελιού
// ──────────────────────────────────────────────────────────────────────────────

/** Ό,τι αλλάζει σε **ένα** κελί: η νέα παράκαμψη, τα ισοπεδωμένα runs, οι διαγώνιοι. */
interface PaintedCell {
  readonly styleOverride: TableCellStyleOverride | undefined;
  readonly runs: TableCell['runs'];
  readonly diagonal: TableCell['diagonal'];
}

function paintCellOverrides(
  model: PersistedTableModel,
  style: TableStyle,
  brush: TableFormatBrush,
  slots: readonly TableTiledSlot[],
  byTarget: ReadonlyMap<string, TableTiledSlot>,
): PersistedTableModel {
  const painted = new Map<string, PaintedCell>();

  forEachResolvedCellStyle(
    model,
    style,
    slots.map((slot) => slot.at),
    (cell) => {
      const slot = byTarget.get(`${cell.rowIndex} ${cell.colIndex}`);
      if (slot === undefined) return;
      const source = tableFormatBrushCellAt(brush, slot.patternRow, slot.patternCol);
      painted.set(`${cell.ref.rowId} ${cell.ref.colId}`, paintedCellOf(style, brush, source, cell));
    },
  );

  return writePersistedCellStyles(
    model,
    slots.map((slot) => slot.at),
    {
      update: (existing, at) => {
        const next = painted.get(`${at.rowId} ${at.colId}`);
        return next === undefined ? null : mergedCell(existing, next);
      },
      // Κελί που δεν υπάρχει στον αραιό χάρτη αποκτά εγγραφή **μόνο** αν το βάψιμο έχει κάτι
      // να πει. Η «ελάχιστη υλοποίηση» το κάνει συχνά: βάφοντας μέσα στην ίδια γραμμή, κάθε
      // πεδίο ισούται με την κληρονομιά ⇒ καμία παράκαμψη ⇒ καμία εγγραφή-φάντασμα.
      create: (at) => {
        const next = painted.get(`${at.rowId} ${at.colId}`);
        if (next === undefined || next.styleOverride === undefined) return null;
        return { kind: 'text', value: '', styleOverride: next.styleOverride };
      },
    },
  );
}

/**
 * 🔴 **Ο ΚΑΝΟΝΑΣ, ΑΝΑ ΚΕΛΙ.** Τι παράκαμψη προκύπτει για αυτό το κελί.
 *
 * Τα πεδία **εκτός** των επιλεγμένων όψεων μένουν **ακριβώς** όπως ήταν: το πινέλο δεν είναι
 * «καθάρισε και ξαναγράψε». Ένα βάψιμο μόνο-περιγραμμάτων δεν επιτρέπεται να αγγίξει τα
 * έντονα που έβαλε ο χρήστης με το χέρι.
 */
function paintedCellOf(
  style: TableStyle,
  brush: TableFormatBrush,
  source: TableCellFormatPayload,
  target: TableResolvedCell,
): PaintedCell {
  // Τι θα έδειχνε ο στόχος **χωρίς** δική του παράκαμψη — ο ΕΝΑΣ επιλυτής, με το `cell` έξω.
  const inherited = resolveCellStyle(style.rowClasses[target.rowClass], {
    column: target.overrides.column,
    row: target.overrides.row,
  });

  let override = target.overrides.cell;
  let runs = target.cell?.runs;

  for (const key of paintedStyleKeys(brush.facets)) {
    const value = minimalStyle(source.style[key], inherited[key]);
    override = patched(override, key, value);
    // Τα runs νικούν το κελί στην επίλυση· χωρίς ισοπέδωση, το βαμμένο πεδίο θα ήταν αόρατο
    // ακριβώς εκεί που ο χρήστης είχε μορφοποιήσει γράμματα. Ο ΕΝΑΣ ισοπεδωτής.
    if (target.cell !== undefined) runs = runsWithoutField({ ...target.cell, runs }, key);
  }

  if (brush.facets.has('numberFormat')) {
    const base = resolveCellNumberFormat(
      { column: target.overrides.column, row: target.overrides.row },
      target.column.valueType,
    );
    override = patched(
      override,
      'numberFormat',
      isTableCellFormatEqual(source.numberFormat, base) ? undefined : source.numberFormat,
    );
  }

  if (brush.facets.has('alignment')) {
    const base = resolveCellOverflow(undefined, target.column.overflow);
    override = patched(override, 'overflow', minimal(source.overflow, base));
  }

  return {
    styleOverride: normalized(override),
    runs,
    // Οι διαγώνιοι δεν κληρονομούνται από πουθενά, άρα δεν υπάρχει «ελάχιστη υλοποίηση» να
    // κάνει: ή αυτές της πηγής, ή καμία.
    diagonal: brush.facets.has('borders') ? source.diagonal : target.cell?.diagonal,
  };
}

/** Τα πεδία στυλ που αγγίζουν οι επιλεγμένες όψεις — παράγονται από τον ΕΝΑ χάρτη. */
function paintedStyleKeys(facets: TableFormatFacetSet): readonly TableCellStyleKey[] {
  const keys: TableCellStyleKey[] = [];
  for (const facet of facets) keys.push(...tableFormatStyleKeysOfFacet(facet));
  return keys;
}

/**
 * 🏆 **Η ελάχιστη υλοποίηση**: ίδιο με την κληρονομιά ⇒ καμία παράκαμψη.
 *
 * Γενική ως προς τον τύπο ώστε να μην υπάρχει δεύτερη έκφραση του κανόνα ανά πεδίο — μία
 * αντεστραμμένη σύγκριση κάπου θα ήταν αόρατη και θα κάρφωνε τα πάντα.
 */
function minimal<T>(source: T, inherited: T): T | undefined {
  return source === inherited ? undefined : source;
}

/**
 * 🔴 Η ίδια ελάχιστη υλοποίηση **με την ΤΡΙΤΗ ΚΑΤΑΣΤΑΣΗ** — για τα πεδία στυλ, όπου το
 * «τίποτα» έχει δύο διαφορετικές σημασίες.
 *
 * ## Το σφάλμα που έπιασε η άγκυρα «δεδομένα → κεφαλίδα»
 * Το {@link minimal} επέστρεφε τη σκέτη τιμή της πηγής. Όταν όμως η πηγή δείχνει **χωρίς
 * γέμισμα** (`undefined`) και ο στόχος θα κληρονομούσε το γκρι της κεφαλίδας, το `undefined`
 * στην παράκαμψη σημαίνει **«κληρονόμησε»** — δηλαδή το γέμισμα της κεφαλίδας **επιβίωνε του
 * βαψίματος** και ο στόχος δεν έμοιαζε ποτέ με την πηγή. Η υπόσχεση 1 έσπαγε σιωπηλά, και
 * **μόνο** προς τη μία φορά (κεφαλίδα → δεδομένα δούλευε μια χαρά).
 *
 * Η σωστή απάντηση είναι το `null` — «**ρητά κανένα**, ακόμη κι όταν η κλάση γραμμής βάφει»,
 * όπως το γράφει ο ίδιος ο {@link TableAxisStyleOverride}. Είναι η δοκτρίνα `BYLAYER` /
 * group code 62 του AutoCAD: **ένα** πεδίο, τρεις απαντήσεις.
 *
 * ⚠️ Ο τυποθέτης είναι **αποδείξιμα ασφαλής, μη αποδείξιμα στον μεταγλωττιστή**: `source ===
 * undefined` μπορεί να συμβεί **μόνο** για τα κλειδιά που το {@link TableCellStyle} δηλώνει
 * προαιρετικά (`fillColorHex`, `fontFamily`) — και είναι ακριβώς εκείνα που η παράκαμψη
 * δηλώνει `| null`. Τα υπόλοιπα έξι είναι ολικά και στα δύο. Η TS δεν συσχετίζει τα δύο
 * γενικευμένα ευρετήρια· μια χειρόγραφη λίστα «ποια πεδία δέχονται null» θα ήταν **δεύτερη**
 * απάντηση δίπλα στους δύο τύπους, δηλαδή αυτό ακριβώς που το αρχείο αποφεύγει παντού αλλού.
 */
function minimalStyle<K extends TableCellStyleKey>(
  source: TableCellStyle[K],
  inherited: TableCellStyle[K],
): TableCellStyleOverride[K] | undefined {
  if (source === inherited) return undefined;
  return (source === undefined ? null : source) as TableCellStyleOverride[K];
}

/** Η παράκαμψη με **ένα** πεδίο αλλαγμένο· `undefined` το αφαιρεί αντί να το γράψει κενό. */
function patched<K extends keyof TableCellStyleOverride>(
  override: TableCellStyleOverride | undefined,
  key: K,
  value: TableCellStyleOverride[K] | undefined,
): TableCellStyleOverride {
  const next = { ...override };
  if (value === undefined) delete next[key];
  else next[key] = value;
  return next;
}

/** Κενή παράκαμψη ⇒ `undefined`: ο αραιός χάρτης σημαίνει ήδη «τίποτα ρητό». */
function normalized(
  override: TableCellStyleOverride | undefined,
): TableCellStyleOverride | undefined {
  return override !== undefined && Object.keys(override).length > 0 ? override : undefined;
}

/**
 * Το τελικό κελί, ή `null` όταν **τίποτα** δεν άλλαξε — η τέταρτη εγγύηση του γραφέα.
 *
 * Η σύγκριση των σύνθετων πεδίων γίνεται με `JSON`, **όπως ακριβώς** το `sameTransferredCell`
 * και για τον ίδιο λόγο: είναι απλά δεδομένα, φτιαγμένα πάντα από τον ίδιο παραγωγό, άρα με
 * ίδια σειρά κλειδιών. Ο έλεγχος ταυτότητας **πρώτα** κόβει τη συνηθισμένη διαδρομή χωρίς να
 * σειριοποιηθεί τίποτα.
 */
function mergedCell(existing: TableCell, painted: PaintedCell): TableCell | null {
  if (
    sameJson(existing.styleOverride, painted.styleOverride)
    && existing.runs === painted.runs
    && sameJson(existing.diagonal, painted.diagonal)
  ) {
    return null;
  }

  // Τα τρία πεδία αφαιρούνται και ξαναμπαίνουν **μόνο αν έχουν τιμή**: ρητό `undefined` σε
  // πεδίο είναι διαφορετικό από απόν πεδίο για το Firestore (το απορρίπτει) και για κάθε
  // `JSON.stringify` σύγκριση. Ίδιο ιδίωμα με το `transferredCell`.
  const { styleOverride: _style, runs: _runs, diagonal: _diagonal, ...rest } = existing;
  return {
    ...rest,
    ...(painted.styleOverride === undefined ? {} : { styleOverride: painted.styleOverride }),
    ...(painted.runs === undefined ? {} : { runs: painted.runs }),
    ...(painted.diagonal === undefined ? {} : { diagonal: painted.diagonal }),
  };
}

function sameJson(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

// ──────────────────────────────────────────────────────────────────────────────
// 2β. Ρητές ακμές
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Οι τέσσερις πλευρές κάθε βαμμένου κελιού, με τον **ίδιο** κανόνα ελάχιστης υλοποίησης:
 * ίδια με ό,τι θα κληρονομούσε ο στόχος ⇒ `null`, δηλαδή «ξέχνα ό,τι όρισα εδώ» και επιστροφή
 * στο στυλ — **όχι** `HIDDEN_TABLE_EDGE`, που σημαίνει «εδώ ρητά δεν υπάρχει γραμμή»
 * (ADR-750 Α14).
 *
 * ⚠️ **Μετρημένο όριο, δηλωμένο**: μια ακμή είναι **μοιρασμένη** ανάμεσα σε δύο γειτονικά
 * κελιά (ADR-750 §6). Όταν το μοτίβο λέει άλλο πράγμα για την κάτω πλευρά του πάνω κελιού και
 * άλλο για την πάνω του κάτω, το ίδιο κλειδί γράφεται δύο φορές και **κερδίζει το τελευταίο**.
 * Η σειρά είναι ντετερμινιστική (row-major, `bottom` πριν από το `top` του επόμενου), όχι
 * τυχαία — και είναι η ίδια αμφισημία που έχει το Excel, όπου το πλέγμα ανήκει επίσης στο
 * φύλλο και όχι στο κελί. Δηλώνεται εδώ αντί να ανακαλυφθεί στην οθόνη.
 */
function paintEdges(
  model: PersistedTableModel,
  style: TableStyle,
  brush: TableFormatBrush,
  slots: readonly TableTiledSlot[],
): PersistedTableModel {
  const resolved = resolveTableModel(model);
  const patches = new Map<TableEdgeKey, TableBorderSpec | null>();

  for (const slot of slots) {
    const source = tableFormatBrushCellAt(brush, slot.patternRow, slot.patternCol);
    for (const side of TABLE_CELL_BORDER_SIDES) {
      const at = tableCellEdgePosition(side, slot.rowIndex, slot.colIndex);
      const key = tableEdgeKeyAt(resolved, at.orientation, at.r, at.c);
      if (key === undefined) continue;
      const base = inheritedTableEdgeSpec(resolved, style, at.orientation, at.r, at.c);
      const wanted = source.borders[side];
      patches.set(key, sameBorderSpec(wanted, base) ? null : wanted);
    }
  }

  return setTableEdges(model, patches);
}

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
 * ## Γιατί ο νέος πίνακας ΔΕΝ γεννιέται εντελώς κενός (διαφορά από το AutoCAD)
 * Το AutoCAD δίνει κενό πλέγμα και ζητά από τον χρήστη να γράψει ο ίδιος τίτλο και
 * κεφαλίδες πριν κάνει οτιδήποτε άλλο — περιττό βήμα σε **κάθε** εισαγωγή. Excel, Google
 * Sheets και Revit δίνουν πάντα κεφαλίδες. Σπέρνουμε λοιπόν **4 κελιά από τα 15**
 * (τίτλος + 3 κεφαλίδες): αρκετά για να είναι ο πίνακας αμέσως χρήσιμος, αρκετά αραιά
 * ώστε να μένει ειλικρινές δείγμα του §4 («μόνο τα μη-κενά κελιά ταξιδεύουν»).
 *
 * Το περιεχόμενο είναι **παγωμένο κείμενο σχεδίου** τη στιγμή της δημιουργίας, όχι
 * ζωντανή ετικέτα UI: μεταφράζεται **μία** φορά εδώ (`i18n.t`, το ίδιο event-time
 * μοτίβο με το `bim/mep-boilers/mep-boiler-tag.ts`) και μετά ανήκει στο σχέδιο. Αλλαγή
 * γλώσσας δεν ξαναγράφει σχέδια που ήδη σώθηκαν — όπως ακριβώς σε κάθε CAD.
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

import { i18n } from '@/i18n';
import type { Point2D } from '../../rendering/types/Types';
import type {
  CellSpan,
  PersistedTableModel,
  TableCell,
  TableCellEntry,
  TableColumn,
  TableRow,
} from '../../types/table';
import type { TableEntity } from '../../types/table-entity';
import { MIN_TABLE_COLUMN_WIDTH_MM } from '../../types/table-entity';
import { createTableModel, toPersistedTableModel } from './table-model-helpers';
import { BUILTIN_TABLE_STYLE_IDS } from './table-style-presets';

const NS = 'dxf-viewer-shell';

// ──────────────────────────────────────────────────────────────────────────────
// Προεπιλογές — AutoCAD parity (1 γραμμή Title, 1 Header, οι υπόλοιπες Data)
// ──────────────────────────────────────────────────────────────────────────────

export const DEFAULT_TABLE_COLUMN_COUNT = 3;
export const DEFAULT_TABLE_DATA_ROW_COUNT = 3;
/** Πλάτος στήλης σε **sheet-mm** (§4.1: ό,τι είναι διάταξη είναι χαρτί, ποτέ κόσμος). */
export const DEFAULT_TABLE_COLUMN_WIDTH_MM = 40;

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
 * Οι επιλογές σε **έγκυρο** σχήμα. Τα φράγματα δεν είναι διακοσμητικά: μηδέν στήλες
 * παράγει πίνακα χωρίς πλάτος (αόρατη οντότητα που όμως πιάνει θέση), και πλάτος κάτω
 * από το `MIN_TABLE_COLUMN_WIDTH_MM` παράγει στήλη που δεν χωρά ούτε έναν χαρακτήρα.
 */
function resolveShape(opts: BuildTableOptions): TableShape {
  return {
    columnCount: Math.max(1, Math.trunc(opts.columnCount ?? DEFAULT_TABLE_COLUMN_COUNT)),
    dataRowCount: Math.max(0, Math.trunc(opts.dataRowCount ?? DEFAULT_TABLE_DATA_ROW_COUNT)),
    columnWidthMm: Math.max(
      MIN_TABLE_COLUMN_WIDTH_MM,
      opts.columnWidthMm ?? DEFAULT_TABLE_COLUMN_WIDTH_MM,
    ),
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
  for (let i = 0; i < shape.dataRowCount; i++) {
    rows.push({ id: rowId(HEADER_ROW_INDEX + 1 + i), rowClass: 'data' });
  }
  return rows;
}

function textCell(value: string): TableCell {
  return { kind: 'text', value };
}

/**
 * Τα 4 σπαρμένα κελιά. Οι ετικέτες κεφαλίδας είναι **τρεις** — όσες και οι προεπιλεγμένες
 * στήλες. Αν ο χρήστης ζητήσει περισσότερες, οι επιπλέον κεφαλίδες μένουν **κενές**: δεν
 * υπάρχει γενικό όνομα για μια τέταρτη στήλη, και μια αυτόματη «Στήλη 4» θα ήταν θόρυβος
 * που ο χρήστης θα έπρεπε να σβήσει.
 */
function seedCells(shape: TableShape): TableCellEntry[] {
  const headers = [
    i18n.t('table.defaults.columnNo', { ns: NS }),
    i18n.t('table.defaults.columnDesc', { ns: NS }),
    i18n.t('table.defaults.columnQty', { ns: NS }),
  ];
  const cells: TableCellEntry[] = [
    [
      rowId(TITLE_ROW_INDEX),
      columnId(0),
      textCell(i18n.t('table.defaults.title', { ns: NS })),
    ],
  ];
  for (let i = 0; i < Math.min(shape.columnCount, headers.length); i++) {
    cells.push([rowId(HEADER_ROW_INDEX), columnId(i), textCell(headers[i])]);
  }
  return cells;
}

/**
 * Η γραμμή τίτλου καταλαμβάνει **όλο** το πλάτος — μία συγχώνευση, ακριβώς όπως το
 * περιγράφει το ίδιο το `standard` preset («ο τίτλος καταλαμβάνει όλο το πλάτος»). Χωρίς
 * αυτήν, το πλέγμα θα έκοβε τον τίτλο σε N κομμάτια και η ζώνη τίτλου θα ήταν οπτικά
 * ανύπαρκτη. Μονόστηλος πίνακας ⇒ καμία συγχώνευση (το 1×1 δεν είναι συγχώνευση).
 */
function buildTitleMerge(shape: TableShape): CellSpan[] {
  if (shape.columnCount < 2) return [];
  return [{
    anchorRowId: rowId(TITLE_ROW_INDEX),
    anchorColId: columnId(0),
    rowSpan: 1,
    colSpan: shape.columnCount,
  }];
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
  // Η γλώσσα μπαίνει στο κλειδί: τα σπαρμένα κελιά είναι μεταφρασμένο κείμενο, άρα ένας
  // πίνακας που δημιουργείται μετά από αλλαγή γλώσσας πρέπει να γεννηθεί στη νέα γλώσσα.
  const key = `${shape.columnCount}|${shape.dataRowCount}|${shape.columnWidthMm}|${i18n.language}`;
  if (memoModel && memoKey === key) return memoModel;

  const model = toPersistedTableModel(createTableModel({
    columns: buildColumns(shape),
    rows: buildRows(shape),
    cells: seedCells(shape),
    merges: buildTitleMerge(shape),
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
    model: buildTableModel(opts),
  };
}

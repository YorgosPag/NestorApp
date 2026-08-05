/**
 * ADR-739 Φάση Α — καθαροί βοηθοί πάνω στο `TableModel`.
 *
 * Εδώ ζει η **μοναδική** νόμιμη κατασκευή `CellKey` και η ανάλυση των συγχωνεύσεων.
 * Κάθε άλλο module (μέτρηση, τοποθέτηση, περιγράμματα, μελλοντικός renderer / adapter)
 * ρωτά αυτούς τους βοηθούς — έτσι το «ποιο κελί καλύπτεται από ποια συγχώνευση»
 * απαντιέται σε ΕΝΑ σημείο. Δύο ανεξάρτητες απαντήσεις στην ίδια ερώτηση είναι ακριβώς
 * το σχήμα που ο ADR-739 §15 ονομάζει «τέταρτη μηχανή πίνακα».
 *
 * Τα πάντα ντετερμινιστικά και συγκρίσιμα. Η **μόνη** εξάρτηση πέρα από τους τύπους είναι
 * ο κεντρικός logger, και υπάρχει για έναν λόγο: η ανάνηψη παλιού σχήματος κελιών
 * (§ «Ανάνηψη» παρακάτω) δεν επιτρέπεται να γίνεται σιωπηλά.
 *
 * @module subapps/dxf-viewer/bim/table/table-model-helpers
 */

import { createModuleLogger } from '@/lib/telemetry';
import { createCellRanker, indexById, insertionIndexFor } from './table-cell-order';
import { buildTableEdgeIndex, toPersistedTableEdges } from './table-edge-model';
import { buildTableRowLinkIndex, toPersistedTableRowLinks } from './table-row-link-model';
import type { TableEdgeEntry } from '../../types/table-edges';
import type { TableRowLinkEntry } from '../../types/table-row-link';
import type { TableFormula } from '../../types/table-formula';
import type {
  CellKey,
  CellSpan,
  PersistedTableModel,
  TableCell,
  TableCellEntry,
  TableColumn,
  TableColumnId,
  TableModel,
  TableRow,
  TableRowId,
} from '../../types/table';

const logger = createModuleLogger('TableModel');

/**
 * Διαχωριστικό κλειδιού. Οι ταυτότητες παράγονται από `enterprise-id.service`
 * (`<prefix>_<UUID-v4>`), οπότε δεν περιέχουν ποτέ `\u0000`· ένα non-printable byte
 * αποκλείει και τη σύγκρουση με χειροποίητα ids σε tests/fixtures.
 */
const KEY_SEPARATOR = '\u0000';

/**
 * Η ΜΟΝΗ πηγή `CellKey`. Το branded type του μοντέλου κάνει το cast εδώ τη μοναδική
 * τοποθεσία όπου γυμνό string γίνεται κλειδί — άρα λάθος σειρά σκελών (`col, row`
 * αντί για `row, col`) αποκλείεται από τον compiler σε κάθε άλλο σημείο.
 */
export function cellKey(rowId: TableRowId, colId: TableColumnId): CellKey {
  return `${rowId}${KEY_SEPARATOR}${colId}` as CellKey;
}

/**
 * Το αντίστροφο του {@link cellKey}. **Ιδιωτικό επίτηδες**: η μορφή του κλειδιού είναι
 * μυστικό αυτού του module, οπότε το μόνο σημείο που επιτρέπεται να την αποσυνθέσει
 * είναι το ίδιο που τη συνθέτει. Το χρειάζεται μόνο η σειριοποίηση
 * ({@link toPersistedTableModel}), που πρέπει να ξαναβρεί τα δύο σκέλη για να τα γράψει
 * ως τριάδα, και η ανάνηψη παλιού σχήματος, που παραλαμβάνει έτοιμα κλειδιά.
 *
 * Δέχεται γυμνό `string` (όχι `CellKey`) ακριβώς επειδή η ανάνηψη διαβάζει κλειδιά από
 * σκηνή που ήρθε από `JSON.parse`: εκεί το brand δεν έχει επιβιώσει, το κλειδί όμως ναι.
 */
function splitCellKey(key: string): readonly [TableRowId, TableColumnId] {
  const at = key.indexOf(KEY_SEPARATOR);
  return at < 0 ? [key, ''] : [key.slice(0, at), key.slice(at + KEY_SEPARATOR.length)];
}

/** Το κελί σε αυτή τη θέση, ή `undefined` αν είναι κενό (ο χάρτης είναι αραιός). */
export function getCell(
  model: TableModel,
  rowId: TableRowId,
  colId: TableColumnId,
): TableCell | undefined {
  return model.cells.get(cellKey(rowId, colId));
}

/**
 * ADR-739 Φ.Ζ — το {@link cellText} μετακόμισε στο `table-cell-content.ts` μαζί με τους
 * γραφείς, ώστε το αρχείο να μείνει κάτω από τις 500 γραμμές (N.7.1) **χωρίς κύκλο
 * εισαγωγών**: ο γραφέας το χρειάζεται, οπότε αν έμενε εδώ η εξάρτηση θα ήταν αμφίδρομη.
 * Επανεξάγεται αυτούσιο — καμία υπάρχουσα διαδρομή εισαγωγής δεν αλλάζει.
 */
export { cellText } from './table-cell-content';

// ──────────────────────────────────────────────────────────────────────────────
// Συγχωνεύσεις
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Προϋπολογισμένη εικόνα των συγχωνεύσεων ενός μοντέλου.
 *
 * Χωρίς αυτό, κάθε ερώτηση «είναι αυτό το κελί καλυμμένο;» θα ήταν γραμμική σάρωση
 * όλων των merges — δηλαδή O(κελιά × merges) σε κάθε διάταξη. Χτίζεται μία φορά.
 */
export interface MergeIndex {
  /** Κλειδί άγκυρας → η συγχώνευσή της (το κελί που κρατά το περιεχόμενο). */
  readonly anchors: ReadonlyMap<CellKey, CellSpan>;
  /** Κλειδιά κελιών που **καλύπτονται** από άγκυρα άλλου κελιού (δεν ζωγραφίζονται). */
  readonly covered: ReadonlySet<CellKey>;
  /**
   * Κελί → η άγκυρα της συγχώνευσης στην οποία ανήκει (η άγκυρα δείχνει στον εαυτό της).
   * Απόν κλειδί ⇒ ελεύθερο κελί.
   *
   * Το χρειάζεται το στάδιο περιγραμμάτων: μια ακμή ανάμεσα σε δύο κελιά **της ίδιας**
   * συγχώνευσης είναι εσωτερική και δεν ζωγραφίζεται — αλλιώς το πλέγμα θα φαινόταν
   * μέσα από ένα συγχωνευμένο κελί και η συγχώνευση θα ήταν οπτικά ανύπαρκτη.
   */
  readonly ownerByCell: ReadonlyMap<CellKey, CellKey>;
}

/**
 * Χτίζει το ευρετήριο συγχωνεύσεων. Συγχωνεύσεις με άγνωστη άγκυρα ή `span < 1`
 * **αγνοούνται σιωπηρά**: ένα εκτός εύρους merge δεν πρέπει να ρίχνει τη διάταξη
 * ολόκληρου του σχεδίου, και το `cells` είναι ούτως ή άλλως αραιό (μια αναφορά σε
 * σβησμένη γραμμή είναι φυσιολογικό ενδιάμεσο στάδιο μιας επεξεργασίας, όχι σφάλμα).
 */
export function buildMergeIndex(model: TableModel): MergeIndex {
  const rowIndexById = indexById(model.rows);
  const colIndexById = indexById(model.columns);
  const anchors = new Map<CellKey, CellSpan>();
  const covered = new Set<CellKey>();
  const ownerByCell = new Map<CellKey, CellKey>();

  for (const span of model.merges) {
    const r0 = rowIndexById.get(span.anchorRowId);
    const c0 = colIndexById.get(span.anchorColId);
    if (r0 === undefined || c0 === undefined) continue;
    if (span.rowSpan < 1 || span.colSpan < 1) continue;
    if (span.rowSpan === 1 && span.colSpan === 1) continue; // 1×1 δεν είναι συγχώνευση

    const anchorKey = cellKey(span.anchorRowId, span.anchorColId);
    anchors.set(anchorKey, span);

    const rEnd = Math.min(r0 + span.rowSpan, model.rows.length);
    const cEnd = Math.min(c0 + span.colSpan, model.columns.length);
    for (let r = r0; r < rEnd; r++) {
      for (let c = c0; c < cEnd; c++) {
        const key = cellKey(model.rows[r].id, model.columns[c].id);
        ownerByCell.set(key, anchorKey);
        if (r === r0 && c === c0) continue; // η άγκυρα δεν καλύπτεται από τον εαυτό της
        covered.add(key);
      }
    }
  }

  return { anchors, covered, ownerByCell };
}

/**
 * Θέση → ταυτότητα (ADR-739 Φ.Δ βήμα 2). **Ζει πλέον στο `table-cell-order`**, μαζί με την
 * υπόλοιπη γνώση της σειράς γραμμή × στήλη· επανεξάγεται από εδώ επειδή τη ζητούν ήδη
 * τέσσερις καλούντες (πλοήγηση, αναφορά κελιού, περιοχή, πρόχειρο) και μια μετακόμιση των
 * import τους δεν θα πρόσθετε τίποτα — θα μετακινούσε την ίδια γραμμή σε τέσσερα αρχεία.
 * Η κατεύθυνση της εισαγωγής είναι **μία** (helpers → order), άρα κανένας κύκλος (ADR-746).
 */
export { indexById };

// ──────────────────────────────────────────────────────────────────────────────
// Κατασκευή
// ──────────────────────────────────────────────────────────────────────────────

/** Ό,τι χρειάζεται ένα μοντέλο· `cells` ως ζεύγη ώστε ο καλών να μη χτίζει `Map` ο ίδιος. */
export interface CreateTableModelInput {
  readonly columns: readonly TableColumn[];
  readonly rows: readonly TableRow[];
  /** Μόνο τα μη-κενά κελιά — ο χάρτης μένει αραιός (§4). */
  readonly cells?: readonly TableCellEntry[];
  readonly merges?: readonly CellSpan[];
  /** ADR-750 Φ1 — μόνο οι **ρητές** ακμές· ίδια αραιή σύμβαση με τα κελιά. */
  readonly edges?: readonly TableEdgeEntry[];
  /** ADR-739 Επίπεδο Β — μόνο οι γραμμές που δείχνουν κάπου· ίδια αραιή σύμβαση. */
  readonly rowLinks?: readonly TableRowLinkEntry[];
}

/**
 * Κατασκευή μοντέλου με σωστά κλειδιά — ο καλών δεν συνθέτει ποτέ `CellKey` (ούτε
 * `TableEdgeKey`) μόνος του.
 */
export function createTableModel(input: CreateTableModelInput): TableModel {
  const cells = new Map<CellKey, TableCell>();
  for (const [rowId, colId, cell] of normalizeCellEntries(input.cells)) {
    cells.set(cellKey(rowId, colId), cell);
  }
  return {
    columns: asSequence<TableColumn>(input.columns, 'columns'),
    rows: asSequence<TableRow>(input.rows, 'rows'),
    cells,
    merges: asSequence<CellSpan>(input.merges, 'merges'),
    // Το δίχτυ ζει στο `table-edge-model`: εκεί είναι η μόνη γνώση του σχήματος ακμής.
    edges: buildTableEdgeIndex(input.edges),
    // Ομοίως το δίχτυ των δεσμών ζει στο `table-row-link-model`.
    rowLinks: buildTableRowLinkIndex(input.rowLinks),
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Ανάνηψη παλιού σχήματος — «είτε σωστά, είτε φωναχτά· ποτέ σιωπηλά άδειος»
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Το `cells` του {@link CreateTableModelInput} είναι *τυπωμένο* ως ακολουθία τριάδων, αλλά
 * ο τύπος δεν φυλάει την πόρτα: το μοντέλο φτάνει εδώ από `JSON.parse` παλιάς σκηνής, από
 * μπαγιάτικο fixture ή από κώδικα γραμμένο πριν τη Λύση Α. Δύο **πραγματικά** σχήματα
 * περνούσαν χωρίς να πιαστούν:
 *
 * - `{}` — το πτώμα ενός `Map` μετά από `JSON.stringify`. Πετούσε `TypeError` («not
 *   iterable») **μέσα στο render pass** (`computeTableEntityGeometry`): μία χαλασμένη
 *   οντότητα έριχνε ΟΛΟΚΛΗΡΟ το καρέ, όχι μόνο τον πίνακά της.
 * - πραγματικός `Map` — δεν πετούσε **τίποτα**. Ο iterator του δίνει ζεύγη μήκους 2, οπότε
 *   η αποδόμηση της τριάδας έβγαζε `cell === undefined` και **όλα τα κελιά εξαφανίζονταν
 *   σιωπηλά**. Ο κώδικας που γράφτηκε για να σκοτώσει τη σιωπηλή απώλεια την αναπαρήγαγε.
 *
 * ## Η απόφαση: ΑΝΑΚΤΗΣΗ ή ΚΡΑΥΓΗ — ποτέ σιωπηλά άδειος
 * «Σιωπηλά κενός πίνακας» είναι ακριβώς το σφάλμα που όλη η Φ.Δ υπάρχει για να σκοτώσει,
 * άρα δεν επιτρέπεται να επιστρέψει με άλλο όνομα. Κάθε μη-κανονικό σχήμα είτε ανακτάται
 * **ρητά** (και το λέει), είτε καταγράφεται με `logger.error` μαζί με το τι χάθηκε.
 * **Ποτέ `throw`**: μία χαλασμένη οντότητα δεν ρίχνει το καρέ των υπόλοιπων.
 */
function normalizeCellEntries(raw: CreateTableModelInput['cells']): readonly TableCellEntry[] {
  const value: unknown = raw;
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return keepValidEntries(value);
  if (value instanceof Map) return recoverFromLegacyMap(value);
  if (typeof value === 'object') return recoverFromLegacyDict(value as Record<string, unknown>);
  logger.error('Το `cells` του πίνακα δεν είναι ακολουθία κελιών — ο πίνακας μένει κενός', {
    received: typeof value,
  });
  return [];
}

/** Κελί είναι ό,τι έχει `kind` και `value` — βαθύτερος έλεγχος θα ήταν δεύτερο σχήμα. */
function isTableCell(value: unknown): value is TableCell {
  return typeof value === 'object' && value !== null && 'kind' in value && 'value' in value;
}

/** Τριάδα **ακριβώς** τριών σκελών με σωστούς τύπους· ό,τι άλλο δεν είναι εγγραφή κελιού. */
function isCellEntry(entry: unknown): entry is TableCellEntry {
  if (!Array.isArray(entry) || entry.length !== 3) return false;
  const [rowId, colId, cell]: readonly unknown[] = entry;
  return typeof rowId === 'string' && typeof colId === 'string' && isTableCell(cell);
}

/** Ο κανονικός δρόμος. Ό,τι πέσει έξω καταγράφεται — δεν εξαφανίζεται. */
function keepValidEntries(entries: readonly unknown[]): readonly TableCellEntry[] {
  const kept: TableCellEntry[] = [];
  for (const entry of entries) {
    if (isCellEntry(entry)) kept.push(entry);
  }
  if (kept.length !== entries.length) {
    logger.error('Εγγραφές κελιών με άκυρο σχήμα — παραλείπονται', {
      dropped: entries.length - kept.length,
      total: entries.length,
    });
  }
  return kept;
}

/**
 * Πραγματικός `Map` σε μνήμη (μπαγιάτικο fixture ή κώδικας πριν τη Λύση Α).
 *
 * **Ανακτάται**, και αξίζει: τα κλειδιά του είναι `CellKey` **αυτού** του module, άρα
 * ξέρουμε ακριβώς πώς λύνονται — και η εναλλακτική δεν είναι «τίποτα χαμένο», είναι
 * ολική απώλεια στο επόμενο `JSON.stringify`. Καταγράφεται ως **σφάλμα** παρότι σώθηκε:
 * κάποιος καλών παραβιάζει ακόμα τη Λύση Α και πρέπει να διορθωθεί, όχι να παρηγορηθεί.
 */
function recoverFromLegacyMap(map: ReadonlyMap<unknown, unknown>): readonly TableCellEntry[] {
  const kept: TableCellEntry[] = [];
  for (const [key, cell] of map) {
    if (typeof key !== 'string' || !isTableCell(cell)) continue;
    const [rowId, colId] = splitCellKey(key);
    kept.push([rowId, colId, cell]);
  }
  logger.error('Κελιά πίνακα ως `Map` — ανάκτηση παλιού σχήματος (Λύση Α: ακολουθία τριάδων)', {
    recovered: kept.length,
    size: map.size,
  });
  return kept;
}

/**
 * Απλό αντικείμενο — το πτώμα ενός `Map` μετά από `JSON.stringify`.
 *
 * Αν έχει κλειδιά (κάποιος το σειριοποίησε με replacer) ανακτώνται. Αν είναι `{}`, τα
 * κελιά **είχαν ήδη χαθεί την ώρα της αποθήκευσης** και κανείς δεν μπορεί να τα εφεύρει —
 * το μόνο τίμιο είναι να ουρλιάξει, ώστε ο άδειος πίνακας να έχει επιτέλους ίχνος.
 */
function recoverFromLegacyDict(dict: Record<string, unknown>): readonly TableCellEntry[] {
  const kept: TableCellEntry[] = [];
  for (const [key, cell] of Object.entries(dict)) {
    if (!isTableCell(cell)) continue;
    const [rowId, colId] = splitCellKey(key);
    kept.push([rowId, colId, cell]);
  }
  logger.error('Κελιά πίνακα ως αντικείμενο — σκηνή γραμμένη πριν τη Φ.Δ', {
    recovered: kept.length,
    keys: Object.keys(dict).length,
  });
  return kept;
}

/**
 * `columns` / `rows` / `merges`: το μόνο σχήμα που τα σπάει είναι «δεν είναι καν
 * ακολουθία» — και αυτό ρίχνει το καρέ στο πρώτο `.length`. Ο έλεγχος **ανά στοιχείο**
 * δεν γίνεται εδώ επίτηδες: μια χαλασμένη στήλη εκφυλίζει μία στήλη, δεν σκοτώνει καρέ,
 * ενώ ένας deep validator θα ήταν δεύτερη —και αναπόφευκτα αποκλίνουσα— γνώση του
 * σχήματος (η «τέταρτη μηχανή πίνακα» του §15).
 */
function asSequence<T>(value: unknown, field: string): readonly T[] {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  logger.error('Πεδίο μοντέλου πίνακα που δεν είναι ακολουθία — αγνοείται', {
    field,
    received: typeof value,
  });
  return [];
}

// ──────────────────────────────────────────────────────────────────────────────
// Ταξίδι ↔ μνήμη (ADR-739 Φ.Δ — Λύση Α)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * `PersistedTableModel` → το ΙΔΙΟ `TableModel` σε κάθε κλήση.
 *
 * ## Γιατί `WeakMap` και όχι χειροκίνητη ακύρωση
 * Το `PersistedTableModel` είναι `readonly` σε κάθε πεδίο, άρα **κάθε** αλλαγή παράγει
 * νέο αντικείμενο ⇒ η ταυτότητα ΕΙΝΑΙ η έκδοση και η ακύρωση είναι φυσική. Ένα
 * `invalidate()` θα ήταν κάτι που κάποιος, κάποτε, θα ξεχνούσε να καλέσει — και η
 * συνέπεια θα ήταν πίνακας που δείχνει παλιά κελιά χωρίς κανένα ίχνος.
 *
 * Είναι το ΙΔΙΟ μοτίβο με το `resolveTableLayout`, και οι δύο μνήμες **αλυσιδώνονται**
 * σωστά: σταθερό `TableModel` ανά persisted ⇒ σταθερή διάταξη ⇒ «διάταξη ποτέ ανά
 * καρέ» (§6) εξακολουθεί να ισχύει, παρότι το entity κρατά πλέον απλό JSON.
 */
const RESOLVED_MODEL_CACHE = new WeakMap<PersistedTableModel, TableModel>();

export function resolveTableModel(persisted: PersistedTableModel): TableModel {
  const cached = RESOLVED_MODEL_CACHE.get(persisted);
  if (cached) return cached;
  // ΠΑΝΤΑ μέσω `createTableModel`: είναι η μόνη νόμιμη πηγή `CellKey`.
  const model = createTableModel({
    columns: persisted.columns,
    rows: persisted.rows,
    cells: persisted.cells,
    merges: persisted.merges,
    edges: persisted.edges,
    rowLinks: persisted.rowLinks,
  });
  RESOLVED_MODEL_CACHE.set(persisted, model);
  return model;
}

/**
 * `TableModel` → το σχήμα που ταξιδεύει. Τη χρειάζεται όποιος **παράγει** μοντέλο (π.χ.
 * ο adapter του ADR-622) και θέλει να το κάνει οντότητα σκηνής.
 *
 * 🔴 **Ντετερμινιστική σειρά**: τα κελιά γράφονται κατά σειρά γραμμής, μετά στήλης — όπως
 * τις ορίζουν τα `rows` / `columns`, όχι όπως έτυχε να μπουν στον `Map`. Η σειρά
 * εισαγωγής θα έδινε διαφορετικό JSON για ταυτόσημο περιεχόμενο: άχρηστα diffs, ασταθή
 * snapshots και — το χειρότερο — ψευδείς «αλλαγές» που θα πυροδοτούσαν auto-save.
 *
 * Κελιά που δείχνουν σε ανύπαρκτη γραμμή/στήλη παραλείπονται σιωπηλά, ίδια σύμβαση
 * ανοχής με το {@link buildMergeIndex}: μια αναφορά σε σβησμένη γραμμή είναι φυσιολογικό
 * ενδιάμεσο στάδιο επεξεργασίας, όχι λόγος να χαθεί ολόκληρος ο πίνακας.
 */
export function toPersistedTableModel(model: TableModel): PersistedTableModel {
  const rank = createCellRanker(model);
  const ordered: { readonly rank: number; readonly entry: TableCellEntry }[] = [];

  for (const [key, cell] of model.cells) {
    const [rowId, colId] = splitCellKey(key);
    const cellRank = rank(rowId, colId);
    if (cellRank === undefined) continue;
    ordered.push({ rank: cellRank, entry: [rowId, colId, cell] });
  }
  ordered.sort((a, b) => a.rank - b.rank);
  const edges = toPersistedTableEdges(model, model.edges);
  const rowLinks = toPersistedTableRowLinks(model, model.rowLinks);

  return {
    columns: model.columns,
    rows: model.rows,
    cells: ordered.map((o) => o.entry),
    merges: model.merges,
    // ADR-750 Φ1 — **παραλείπεται όταν είναι κενό**, όχι `edges: []`. Ένα κενό πεδίο θα
    // ταξίδευε σε κάθε αποθηκευμένο πίνακα του κόσμου και θα εμφανιζόταν σε κάθε diff ως
    // «αλλαγή» — και, χειρότερα, θα έσπαγε το `persisted → runtime → persisted ταυτοτικό`
    // για κάθε πίνακα γραμμένο πριν από αυτή τη φάση.
    ...(edges.length > 0 ? { edges } : {}),
    // ADR-739 Επίπεδο Β — ίδια σύμβαση παράλειψης με τις ακμές, και για τον ίδιο λόγο: ένα
    // `rowLinks: []` θα έσπαγε το `persisted → runtime → persisted` ταυτοτικό για κάθε
    // πίνακα γραμμένο πριν από αυτή τη φάση.
    ...(rowLinks.length > 0 ? { rowLinks } : {}),
  };
}

/**
 * ADR-739 Φ.Ζ — ο **γραφέας** μετακόμισε στο `table-cell-writer.ts` όταν ο δεύτερος γραφέας
 * (τύποι) πέρασε το αρχείο τις 500 γραμμές (N.7.1). Επανεξάγεται αυτούσιος: **καμία** από τις
 * υπάρχουσες διαδρομές εισαγωγής δεν αλλάζει — ίδιο μοτίβο με το `types/table.ts`, που
 * επανεξάγει τις ταυτότητες του `table-ids.ts`.
 *
 * Η τομή είναι σημασιολογική, όχι μετρική: εδώ ζει «**τι λέει** αυτό το μοντέλο» (κλειδιά,
 * συγχωνεύσεις, ανάλυση, σειριοποίηση), εκεί «**πώς αλλάζει**».
 */
export {
  clearPersistedCells,
  getPersistedCellText,
  setPersistedCellFormula,
  setPersistedCellText,
} from './table-cell-content';
export type { CellWriteTarget, PendingCellWrites } from './table-cell-content';

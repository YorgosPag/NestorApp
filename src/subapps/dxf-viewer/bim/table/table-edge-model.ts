/**
 * ADR-750 Φάση 1 — **η μηχανή των ρητών ακμών**: ταυτότητα, ευρετήριο, ταξίδι, επιβίωση.
 * Καθαρές συναρτήσεις· μηδέν React, μηδέν canvas, μηδέν UI.
 *
 * Εδώ ζει η **μοναδική** νόμιμη κατασκευή `TableEdgeKey`, ακριβώς όπως το
 * `table-model-helpers.ts` κρατά τη μοναδική κατασκευή `CellKey`. Κάθε άλλο module
 * (περιγράμματα, μελλοντικές πράξεις των 13 εντολών, dropdown, εξαγωγή) **ρωτά** — ποτέ δεν
 * συνενώνει αλφαριθμητικό μόνο του. Δύο ανεξάρτητοι κατασκευαστές κλειδιού είναι δύο
 * ανεξάρτητες απαντήσεις στο «ποια ακμή είναι αυτή», δηλαδή η «τέταρτη μηχανή πίνακα» του
 * ADR-739 §15 με άλλο όνομα.
 *
 * ## Γιατί ΔΕΝ επαναχρησιμοποιεί το `cellKey()`
 * Το κλειδί ακμής **πρέπει** να αποσυντίθεται (η σειριοποίηση ξαναβρίσκει τα τρία σκέλη για
 * να γράψει τετράδα), ενώ το `splitCellKey` είναι «ιδιωτικό επίτηδες»: η μορφή του κλειδιού
 * κελιού είναι μυστικό εκείνου του module. Δύο **διαφορετικά ερωτήματα** («ποιο κελί;» /
 * «ποια ακμή;») με διαφορετικές απαιτήσεις ορατότητας — όχι δύο απαντήσεις στο ίδιο.
 *
 * ## Πού ζει τι
 * ```
 *   types/table-edges.ts        →  το σχήμα (τι ΕΙΝΑΙ μια ακμή)
 *   ΕΔΩ                          →  η ταυτότητα + το ταξίδι + η επιβίωση σε διαγραφή
 *   table-layout-borders.ts     →  ποιο μολύβι κερδίζει (επίπεδο 1 από 4)
 * ```
 *
 * @module subapps/dxf-viewer/bim/table/table-edge-model
 * @see bim/table/table-model-helpers.ts — το ίδιο μοτίβο για τα κελιά
 * @see docs/centralized-systems/reference/adrs/ADR-750-table-cell-borders.md §6
 */

import { createModuleLogger } from '@/lib/telemetry';
import type { PersistedTableModel } from '../../types/table';
import type { CellOrderSource } from './table-cell-order';
import { indexById } from './table-cell-order';
import type {
  TableBorderSpec,
  TableEdgeColAnchor,
  TableEdgeEnd,
  TableEdgeEntry,
  TableEdgeIndex,
  TableEdgeKey,
  TableEdgeOrientation,
  TableEdgeRowAnchor,
} from '../../types/table-edges';

const logger = createModuleLogger('TableEdges');

/**
 * Διαχωριστικό σκελών. Ίδιος συλλογισμός με το `KEY_SEPARATOR` των κελιών: οι ταυτότητες
 * παράγονται από `enterprise-id.service` (`<prefix>_<UUID-v4>`) ή από τον γεννήτορα του
 * `table-row-column-ops` (`r0…rN`), οπότε δεν περιέχουν ποτέ μη εκτυπώσιμο byte.
 */
const EDGE_KEY_SEPARATOR = '\u0000';

/**
 * Το sentinel του τελευταίου συνόρου. **Ο τύπος είναι η αυθεντία** ({@link TableEdgeEnd},
 * `types/table-edges.ts`) και η σταθερά τον υλοποιεί με ρητή δήλωση: αν οι δύο αποκλίνουν,
 * το λέει ο μεταγλωττιστής εδώ — δεν είναι δεύτερη πηγή αλήθειας, είναι η ίδια, ελεγμένη.
 */
export const TABLE_EDGE_END: TableEdgeEnd = '$end';

// ──────────────────────────────────────────────────────────────────────────────
// Ταυτότητα
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Η ΜΟΝΗ πηγή `TableEdgeKey`. Το branded type κάνει το cast εδώ τη μοναδική τοποθεσία όπου
 * γυμνό string γίνεται κλειδί ακμής — άρα λάθος σειρά σκελών (`col, row`) ή sentinel στη
 * λάθος πλευρά αποκλείονται από τον compiler σε κάθε άλλο σημείο.
 *
 * Ο προσανατολισμός μπαίνει **πρόθεμα**: η ίδια θέση πλέγματος γεννά δύο διαφορετικές ακμές
 * (η πάνω και η αριστερή του ίδιου κελιού), οπότε χωρίς αυτόν το κλειδί θα ήταν διφορούμενο.
 */
export function tableEdgeKey(
  orientation: TableEdgeOrientation,
  rowAnchor: TableEdgeRowAnchor,
  colAnchor: TableEdgeColAnchor,
): TableEdgeKey {
  return [orientation, rowAnchor, colAnchor].join(EDGE_KEY_SEPARATOR) as TableEdgeKey;
}

/**
 * Το αντίστροφο του {@link tableEdgeKey}. **Ιδιωτικό**: η μορφή του κλειδιού είναι μυστικό
 * αυτού του module, οπότε το μόνο σημείο που την αποσυνθέτει είναι το ίδιο που τη συνθέτει.
 * Το χρειάζεται μόνο η σειριοποίηση, που πρέπει να ξαναβρεί τα σκέλη για να γράψει τετράδα.
 *
 * Δέχεται γυμνό `string` επειδή διατρέχει τα κλειδιά ενός `Map` — εκεί το brand υπάρχει,
 * αλλά η υπογραφή δεν κερδίζει τίποτα απαιτώντας το. `undefined` ⇒ κλειδί που δεν φτιάχτηκε
 * ποτέ από τον κατασκευαστή.
 */
function splitTableEdgeKey(
  key: string,
): readonly [TableEdgeOrientation, TableEdgeRowAnchor, TableEdgeColAnchor] | undefined {
  const parts = key.split(EDGE_KEY_SEPARATOR);
  if (parts.length !== 3) return undefined;
  const [orientation, rowAnchor, colAnchor] = parts;
  if (!isOrientation(orientation)) return undefined;
  return [orientation, rowAnchor, colAnchor];
}

function isOrientation(value: unknown): value is TableEdgeOrientation {
  return value === 'H' || value === 'V';
}

/**
 * **Θέση πλέγματος → ταυτότητα ακμής** — η συνάρτηση που κρύβει το sentinel από κάθε καλούντα.
 *
 * Η μηχανή περιγραμμάτων και οι πράξεις των 13 εντολών σκέφτονται σε δείκτες (`r` από 0 έως
 * `rows.length`, `c` από 0 έως `columns.length`)· το μοντέλο όμως αγκυρώνεται σε ταυτότητες.
 * Η μετάφραση γίνεται **εδώ, μία φορά**. Αν την έκανε ο κάθε καλών, ο καθένας θα έπρεπε να
 * θυμάται σε ποια πλευρά πάει το `$end` — και η μέρα που ένας το ξεχνούσε δεν θα έδινε
 * σφάλμα, θα έδινε **σιωπηλά αόρατη γραμμή**.
 *
 * `undefined` όταν η θέση δεν αντιστοιχεί σε ακμή: μια οριζόντια ακμή ζει μέσα σε υπαρκτή
 * στήλη (`c < columns.length`) και μπορεί να είναι στη βάση (`r === rows.length`)· η
 * κατακόρυφη το ανάποδο.
 */
export function tableEdgeKeyAt(
  axes: CellOrderSource,
  orientation: TableEdgeOrientation,
  r: number,
  c: number,
): TableEdgeKey | undefined {
  const rowCount = axes.rows.length;
  const colCount = axes.columns.length;

  if (orientation === 'H') {
    if (r < 0 || r > rowCount || c < 0 || c >= colCount) return undefined;
    const rowAnchor = r === rowCount ? TABLE_EDGE_END : axes.rows[r].id;
    return tableEdgeKey('H', rowAnchor, axes.columns[c].id);
  }

  if (r < 0 || r >= rowCount || c < 0 || c > colCount) return undefined;
  const colAnchor = c === colCount ? TABLE_EDGE_END : axes.columns[c].id;
  return tableEdgeKey('V', axes.rows[r].id, colAnchor);
}

/**
 * Ίδιο μολύβι; Το χρειάζονται **δύο** ανεξάρτητοι αναγνώστες: η ένωση συνεχόμενων τμημάτων
 * (`table-layout-borders.ts`) και — από τη Φάση 2 — η εγγύηση ταυτότητας by-reference των
 * πράξεων («βάζω το ίδιο περίγραμμα δύο φορές ⇒ κανένα βήμα undo»). Ζει εδώ ώστε να μη
 * γεννηθεί δεύτερο, ελαφρώς διαφορετικό, «είναι ίδια;».
 *
 * Το `dashMm` συγκρίνεται στοιχείο-προς-στοιχείο: δύο ίσοι πίνακες είναι διαφορετικές
 * αναφορές, και μια σύγκριση αναφοράς θα έλεγε «διαφορετικά» για ταυτόσημα μολύβια.
 *
 * ⚠️ ADR-750 Φ5 — το `doubleGapMm` μπαίνει στη σύγκριση **επειδή** η ένωση τρέχει **πριν** την
 * αποσύνθεση της διπλής (`table-layout-borders.ts`). Χωρίς αυτό, μια μονή και μια διπλή γραμμή
 * με ίδιο χρώμα/πάχος θα ενώνονταν σε ένα τμήμα και η διπλή θα **εξαφανιζόταν** στο μισό της
 * διαδρομής — σιωπηλά, γιατί το αποτέλεσμα θα ήταν ακόμη μια νόμιμη γραμμή.
 */
export function sameBorderSpec(a: TableBorderSpec, b: TableBorderSpec): boolean {
  if (a === b) return true;
  if (a.visible !== b.visible || a.colorHex !== b.colorHex || a.widthMm !== b.widthMm) return false;
  if (a.doubleGapMm !== b.doubleGapMm) return false;
  const da = a.dashMm ?? [];
  const db = b.dashMm ?? [];
  return da.length === db.length && da.every((v, i) => v === db[i]);
}

/**
 * Το **κανονικό** μολύβι της ακμής που δεν ζωγραφίζεται — η ρητή απάντηση «εδώ **δεν** υπάρχει
 * γραμμή», σε αντιδιαστολή με την **απουσία** εγγραφής, που σημαίνει «κληρονόμησε».
 *
 * ## Γιατί σταθερά και όχι `{ ...μολύβι, visible: false }` (ADR-750 Α14)
 * Το σβήσιμο **δεν έχει μολύβι**. Αν κρατούσε το χρώμα και το πάχος του τρέχοντος, δύο
 * ταυτόσημα «Χωρίς περίγραμμα» με διαφορετικό επιλεγμένο μολύβι θα παρήγαν **διαφορετικές**
 * εγγραφές: βήμα undo, diff στο αρχείο και σπασμένη ένωση τμημάτων, για μηδενική οπτική
 * διαφορά. Μία κανονική μορφή ⇒ το `sameBorderSpec` απαντά «ίδιο» και η πράξη είναι πράγματι
 * ταυτοδύναμη.
 *
 * Το `widthMm: 0` είναι επίσης η **ειλικρινής** τιμή προς τα έξω: το
 * `nearestIsoLineweight(0)` επιστρέφει `undefined`, οπότε η εξαγωγή παραλείπει τελείως το
 * group 370 αντί να εφεύρει μια τριχοειδή γραμμή εκεί που ο συντάκτης ζήτησε καμία.
 */
export const HIDDEN_TABLE_EDGE: TableBorderSpec = {
  visible: false,
  colorHex: '#000000',
  widthMm: 0,
};

// ──────────────────────────────────────────────────────────────────────────────
// Ταξίδι ↔ μνήμη (Λύση Α του ADR-739 §19.2, όπως ήδη τα κελιά)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Ακολουθία τετράδων → ευρετήριο. Το `edges` είναι **προαιρετικό**, άρα η συνηθέστερη
 * είσοδος είναι `undefined` και η σωστή απάντηση κενός χάρτης — όχι κραυγή.
 *
 * ## Γιατί το δίχτυ εδώ είναι μικρότερο από των κελιών
 * Τα κελιά χρειάζονται **ανάνηψη** (πραγματικός `Map`, λεξικό-πτώμα) επειδή ταξίδεψαν με
 * λάθος σχήμα σε παλιές σκηνές. Το `edges` γεννιέται σήμερα: **δεν υπάρχει παλιό σχήμα να
 * ανακτηθεί**, άρα ένα αντίστοιχο δίχτυ θα ήταν κώδικας που δεν μπορεί να εκτελεστεί ποτέ.
 * Ό,τι δεν είναι κανονικό εδώ είναι **φθορά**, όχι κληρονομιά — και η στάση απέναντί της
 * παραμένει η ίδια: παραλείπεται **με ίχνος**, ποτέ σιωπηλά.
 */
export function buildTableEdgeIndex(entries: unknown): TableEdgeIndex {
  const index = new Map<TableEdgeKey, TableBorderSpec>();
  if (entries === null || entries === undefined) return index;

  if (!Array.isArray(entries)) {
    logger.error('Το `edges` του πίνακα δεν είναι ακολουθία ακμών — καμία ρητή ακμή', {
      received: typeof entries,
    });
    return index;
  }

  let dropped = 0;
  for (const entry of entries) {
    if (!isEdgeEntry(entry)) {
      dropped++;
      continue;
    }
    index.set(tableEdgeKey(entry[0], entry[1], entry[2]), entry[3]);
  }
  if (dropped > 0) {
    logger.error('Εγγραφές ακμών με άκυρο σχήμα — παραλείπονται', {
      dropped,
      total: entries.length,
    });
  }
  return index;
}

/** Μολύβι είναι ό,τι έχει τα τρία υποχρεωτικά πεδία με τους σωστούς τύπους. */
function isBorderSpec(value: unknown): value is TableBorderSpec {
  if (typeof value !== 'object' || value === null) return false;
  const spec = value as Record<string, unknown>;
  return (
    typeof spec.visible === 'boolean' &&
    typeof spec.colorHex === 'string' &&
    typeof spec.widthMm === 'number'
  );
}

/** Τετράδα **ακριβώς** τεσσάρων σκελών με σωστούς τύπους· ό,τι άλλο δεν είναι ακμή. */
function isEdgeEntry(entry: unknown): entry is TableEdgeEntry {
  if (!Array.isArray(entry) || entry.length !== 4) return false;
  const [orientation, rowAnchor, colAnchor, spec]: readonly unknown[] = entry;
  return (
    isOrientation(orientation) &&
    typeof rowAnchor === 'string' &&
    typeof colAnchor === 'string' &&
    isBorderSpec(spec)
  );
}

/**
 * Ευρετήριο → ακολουθία τετράδων, σε **ντετερμινιστική** σειρά.
 *
 * Ίδιος λόγος με τα κελιά: η σειρά με την οποία έτυχε να μπουν οι ακμές στον `Map` θα έδινε
 * διαφορετικό JSON για ταυτόσημο περιεχόμενο — άχρηστα diffs, ασταθή snapshots και ψευδείς
 * «αλλαγές» που πυροδοτούν auto-save σε πίνακα που κανείς δεν άγγιξε.
 */
export function toPersistedTableEdges(
  axes: CellOrderSource,
  edges: TableEdgeIndex,
): readonly TableEdgeEntry[] {
  if (edges.size === 0) return [];

  const decomposed: TableEdgeEntry[] = [];
  for (const [key, spec] of edges) {
    const parts = splitTableEdgeKey(key);
    if (parts) decomposed.push([parts[0], parts[1], parts[2], spec]);
  }
  return orderTableEdges(axes, decomposed);
}

/**
 * Η **μία** ταξινόμηση ακμών, μαζί με το κλάδεμα των ορφανών.
 *
 * Ακμή που δείχνει σε σβησμένη γραμμή/στήλη δεν έχει θέση στο πλέγμα, άρα δεν έχει και
 * σειρά· παραλείπεται σιωπηλά — ίδια σύμβαση ανοχής με τα κελιά του `toPersistedTableModel`
 * και με το `buildMergeIndex`: μια αναφορά σε σβησμένη γραμμή είναι φυσιολογικό ενδιάμεσο
 * στάδιο μιας επεξεργασίας, όχι λόγος να χαθεί ολόκληρος ο πίνακας.
 */
function orderTableEdges(
  axes: CellOrderSource,
  entries: readonly TableEdgeEntry[],
): readonly TableEdgeEntry[] {
  const rank = createEdgeRanker(axes);
  const ordered: { readonly rank: number; readonly entry: TableEdgeEntry }[] = [];

  for (const entry of entries) {
    const edgeRank = rank(entry[0], entry[1], entry[2]);
    if (edgeRank === undefined) continue;
    ordered.push({ rank: edgeRank, entry });
  }
  ordered.sort((a, b) => a.rank - b.rank);
  return ordered.map((o) => o.entry);
}

/**
 * Κατάταξη ακμής σε **έναν** αριθμό: γραμμή → στήλη → προσανατολισμός. Ίδιο σκεπτικό με τον
 * `createCellRanker`: ένα κριτήριο που δεν μπορεί να ξεχαστεί σε κανέναν καλούντα.
 *
 * Το sentinel κατατάσσεται **μετά** την τελευταία πραγματική θέση του άξονά του — εκεί
 * ακριβώς που βρίσκεται και γεωμετρικά. Γι' αυτό οι θέσεις στήλης είναι `columns.length + 1`:
 * το `$end` είναι υπαρκτή θέση πλέγματος, όχι απουσία.
 */
type EdgeRanker = (
  orientation: TableEdgeOrientation,
  rowAnchor: TableEdgeRowAnchor,
  colAnchor: TableEdgeColAnchor,
) => number | undefined;

function createEdgeRanker(axes: CellOrderSource): EdgeRanker {
  const rowOrder = indexById(axes.rows);
  const colOrder = indexById(axes.columns);
  const rowCount = axes.rows.length;
  const colCount = axes.columns.length;
  const colSlots = colCount + 1;

  return (orientation, rowAnchor, colAnchor) => {
    const r = rowAnchor === TABLE_EDGE_END ? rowCount : rowOrder.get(rowAnchor);
    const c = colAnchor === TABLE_EDGE_END ? colCount : colOrder.get(colAnchor);
    if (r === undefined || c === undefined) return undefined;
    return (r * colSlots + c) * 2 + (orientation === 'H' ? 0 : 1);
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Μαζική εγγραφή (ADR-750 Φ2)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Μια δέσμη αλλαγών ακμών. Δύο νοήματα, ρητά διακριτά στον τύπο:
 *
 * ```
 *   TableBorderSpec  →  ρητό μολύβι (και το {@link HIDDEN_TABLE_EDGE} είναι μολύβι:
 *                       «ρητά καμία γραμμή», που ΝΙΚΑ τα επίπεδα 2–4)
 *   null             →  ΔΙΑΓΡΑΦΗ της εγγραφής — επιστροφή στην κληρονομιά
 * ```
 *
 * Η διάκριση **είναι** ολόκληρη η απόφαση Α14: χωρίς αυτήν, «σβήσε τη γραμμή» και «ξέχνα ό,τι
 * όρισα εδώ» θα ήταν η ίδια πράξη — και η πρώτη θα αναγεννούσε το πλέγμα της κλάσης, δηλαδή
 * θα αναπαρήγαγε ακριβώς το παράπονο Π3 («η γραμμή δεν φεύγει») που ήρθαμε να σκοτώσουμε.
 */
export type TableEdgePatchMap = ReadonlyMap<TableEdgeKey, TableBorderSpec | null>;

/**
 * Εφαρμόζει **όλα** τα patches σε ένα πέρασμα και επιστρέφει νέο μοντέλο.
 *
 * ## Γιατί μαζικά και όχι μία-μία
 * Μια εντολή «Όλα τα περιγράμματα» σε περιοχή 20×10 αγγίζει **430 ακμές**. Ένας εγγραφέας
 * μιας ακμής θα ξανάχτιζε και θα ξανα-ταξινομούσε την ακολουθία 430 φορές — O(N²) — και,
 * χειρότερα, ο καλών θα χρειαζόταν **δική του** γνώση της σειράς για να παρεμβάλει: δηλαδή
 * δεύτερη ταξινόμηση ακμών, η «τέταρτη μηχανή πίνακα» του ADR-739 §15 με άλλο όνομα. Εδώ η
 * σειρά παραμένει **μία**, ιδιωτική, και οι πράξεις των 13 εντολών είναι απλώς **παραγωγοί
 * patch map**: μηδέν γνώση σειριοποίησης.
 *
 * ## 🔴 Η εγγύηση by-reference δεν είναι βελτιστοποίηση
 * Όταν κανένα patch δεν αλλάζει τιμή (σύγκριση με {@link sameBorderSpec}) επιστρέφεται το
 * **ίδιο** αντικείμενο. Η αλυσίδα `PersistedTableModel → RESOLVED_MODEL_CACHE → TableModel →
 * LAYOUT_CACHE` κλειδώνει σε **ταυτότητα αντικειμένου**: νέο αντικείμενο χωρίς λόγο σημαίνει
 * ακυρωμένη μνήμη **και** βήμα undo που δεν αναιρεί τίποτα (πατάς δεύτερη φορά το ίδιο
 * κουμπί). Το αντίστροφο λάθος — επιτόπια μεταβολή — είναι τεκμηριωμένο και **έχει ήδη
 * συμβεί**: `table-axis-style-ops.ts:16-19`.
 *
 * Ορφανές ακμές (σε σβησμένη γραμμή/στήλη) κλαδεύονται στο πέρασμα, ίδια σύμβαση ανοχής με
 * το `toPersistedTableModel` — αλλά **μόνο όταν η δέσμη αλλάζει κάτι**: χωρίς αλλαγή δεν
 * ξαναγράφεται τίποτα, άρα ένα άνοιγμα μενού δεν «καθαρίζει» σιωπηλά το αρχείο.
 */
export function setTableEdges(
  model: PersistedTableModel,
  patches: TableEdgePatchMap,
): PersistedTableModel {
  if (patches.size === 0) return model;

  const index = new Map<TableEdgeKey, TableBorderSpec>(buildTableEdgeIndex(model.edges));
  let changed = false;

  for (const [key, spec] of patches) {
    if (spec === null) {
      if (index.delete(key)) changed = true;
      continue;
    }
    const current = index.get(key);
    if (current !== undefined && sameBorderSpec(current, spec)) continue;
    index.set(key, spec);
    changed = true;
  }
  if (!changed) return model;

  // Άδειο ⇒ `undefined`, ποτέ `[]`: το `JSON.stringify` πετά τα `undefined` πεδία, οπότε ο
  // πίνακας που έμεινε χωρίς ρητές ακμές ξαναγράφει **byte-ταυτόσημο** JSON με πριν — ίδιο
  // μοτίβο με το `writeAxisOverride` του `table-axis-style-ops.ts`.
  const edges = toPersistedTableEdges(model, index);
  return { ...model, edges: edges.length > 0 ? edges : undefined };
}

// ──────────────────────────────────────────────────────────────────────────────
// Επιβίωση σε διαγραφή άξονα
// ──────────────────────────────────────────────────────────────────────────────

/** Ο άξονας που σβήνεται — μία υλοποίηση, δύο όψεις (N.18). */
export type TableEdgeAxis = 'row' | 'column';

/**
 * Οι ακμές μετά τη διαγραφή μιας γραμμής/στήλης.
 *
 * ## Ο κανόνας, σε μία πρόταση
 * **Όταν σβήνεται γραμμή, οι πάνω ακμές της μετακομίζουν στην επόμενη επιζώσα — εκτός αν
 * εκείνη δηλώνει ήδη δική της· οι αριστερές της φεύγουν μαζί της.**
 *
 * ## Γιατί μετακόμιση και όχι σβήσιμο
 * Είναι **ακριβώς** η Απόφαση 4 του `table-row-column-ops.ts` («η διαγραφή άγκυρας
 * ΜΕΤΑΦΕΡΕΙ το περιεχόμενο, δεν το σβήνει»), εφαρμοσμένη σε γεωμετρία αντί για κείμενο. Η
 * εναλλακτική είναι σιωπηλή απώλεια που ο χρήστης δεν είχε τρόπο να προβλέψει: το πάνω
 * περίγραμμα του πίνακα είναι αγκυρωμένο στην **πρώτη** γραμμή, οπότε σκέτο σβήσιμο θα
 * εξαφάνιζε το πλαίσιο του πίνακα επειδή ο χρήστης έσβησε μια γραμμή δεδομένων.
 *
 * ## Γιατί η κάθετη φεύγει
 * Η οριζόντια ακμή μιας γραμμής είναι **σύνορο**: μετά τη διαγραφή, το ίδιο φυσικό σύνορο
 * εξακολουθεί να υπάρχει, ανάμεσα σε άλλα δύο κελιά. Η κατακόρυφη ακμή μιας γραμμής είναι
 * **τμήμα μέσα** στο ύψος της: μαζί με τη γραμμή παύει να υπάρχει και το τμήμα. Ίδια
 * συμμετρία, ανεστραμμένη, για τη διαγραφή στήλης.
 *
 * Το κάτω/δεξί σύνορο (`$end`) δεν επηρεάζεται ποτέ — δεν ανήκε σε γραμμή εξ αρχής.
 *
 * @param nextAxes οι άξονες **μετά** τη διαγραφή — από αυτούς προκύπτει και το κλάδεμα των
 *   ορφανών και η τελική σειρά.
 * @param heirId η ταυτότητα που κληρονομεί το σύνορο· `undefined` όταν σβήνεται η τελευταία
 *   γραμμή/στήλη (τότε το σύνορο πράγματι παύει να υπάρχει — το εξωτερικό το κρατά το `$end`).
 */
export function rebuildTableEdgesOnDelete(
  nextAxes: CellOrderSource,
  edges: readonly TableEdgeEntry[] | undefined,
  axis: TableEdgeAxis,
  removedId: string,
  heirId: string | undefined,
): readonly TableEdgeEntry[] | undefined {
  if (edges === undefined || edges.length === 0) return edges;

  const kept: TableEdgeEntry[] = [];
  const touched: TableEdgeEntry[] = [];
  for (const entry of edges) {
    if (anchorOn(entry, axis) === removedId) touched.push(entry);
    else kept.push(entry);
  }
  // Καμία ακμή δεν ζούσε στον σβησμένο άξονα ⇒ το ίδιο αντικείμενο by-reference: καμία
  // ψεύτικη αλλαγή στο JSON, καμία περιττή ακύρωση μνήμης (ίδια εγγύηση με τα κελιά).
  if (touched.length === 0) return edges;

  if (heirId !== undefined) {
    // Ο προσανατολισμός που τρέχει **παράλληλα** στον σβησμένο άξονα είναι το σύνορό του.
    const boundary: TableEdgeOrientation = axis === 'row' ? 'H' : 'V';
    const declared = new Set<TableEdgeKey>(
      kept.map((entry) => tableEdgeKey(entry[0], entry[1], entry[2])),
    );
    for (const entry of touched) {
      if (entry[0] !== boundary) continue;
      const moved = withAnchor(entry, axis, heirId);
      const key = tableEdgeKey(moved[0], moved[1], moved[2]);
      if (declared.has(key)) continue; // ο κληρονόμος δηλώνει ήδη δική του — νικά
      declared.add(key);
      kept.push(moved);
    }
  }

  return orderTableEdges(nextAxes, kept);
}

function anchorOn(entry: TableEdgeEntry, axis: TableEdgeAxis): string {
  return axis === 'row' ? entry[1] : entry[2];
}

function withAnchor(entry: TableEdgeEntry, axis: TableEdgeAxis, anchorId: string): TableEdgeEntry {
  return axis === 'row'
    ? [entry[0], anchorId, entry[2], entry[3]]
    : [entry[0], entry[1], anchorId, entry[3]];
}

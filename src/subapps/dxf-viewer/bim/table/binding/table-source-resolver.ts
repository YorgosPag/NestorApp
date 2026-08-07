/**
 * 🔴 ADR-767 Δ7 — **`sourceRef` → δεδομένα**: το ΕΞΑΝΤΛΗΤΙΚΟ μητρώο πηγών ενός δεμένου πίνακα.
 *
 * Καθαρή συνάρτηση: παίρνει τον δεσμό και ένα **context δεδομένων** (ό,τι έχει ήδη διαβάσει ο
 * καλών από τη σκηνή) και επιστρέφει το {@link ExportableTable} που ήδη ξέρουν να παράγουν οι
 * υπάρχοντες παραγωγοί. Μηδέν store, μηδέν I/O, μηδέν React — ακριβώς όπως ο αδελφός του
 * `buildSurveyDeliverables`, και για τον ίδιο λόγο: το ίδιο αποτέλεσμα πρέπει να τροφοδοτεί
 * ΚΑΙ τον πίνακα στο σχέδιο ΚΑΙ τον έλεγχο φρεσκάδας, χωρίς να τρέξει τίποτα δύο φορές.
 *
 * ## ⛔ Μηδέν νέα παραγωγή δεδομένων
 * Υπάρχουν **τρεις** παραγωγοί που μιλούν **μία** γλώσσα (`ExportableTable`): το
 * `buildSchedule` των ποσοτήτων BIM και οι τέσσερις τοπογραφικοί του `survey-tables.ts`. Το
 * ADR-766 §10 απαγορεύει ρητά τέταρτο. Αυτό το αρχείο **καλεί**, δεν χτίζει.
 *
 * ## 🔑 Γιατί το μητρώο είναι `Record<TableSourceKind, …>` και όχι `switch`
 * Ο μεταγλωττιστής γίνεται η πύλη: προσθέτεις κλάδο στην ένωση ⇒ **δεν χτίζει** μέχρι να
 * δηλώσεις τι τον επιλύει. Ένα `switch` με `default` θα δεχόταν σιωπηλά τον νέο κλάδο και θα
 * τον έστελνε στην περίπτωση «άγνωστο» — δηλαδή θα γεννούσε ακριβώς τη σιωπή που το ADR-767
 * §8 #7 απαγορεύει. Οι μη-συνδεδεμένοι κλάδοι **δηλώνονται ονομαστικά**, δεν λείπουν.
 *
 * @module subapps/dxf-viewer/bim/table/binding/table-source-resolver
 * @see systems/topography/deliverables/survey-tables.ts — ο ΥΠΑΡΧΩΝ παραγωγός
 * @see docs/centralized-systems/reference/adrs/ADR-767-table-bound-mode.md §4 Δ7
 */

import {
  buildCoordinateTable,
  COORDINATE_COLUMNS,
  COORDINATE_WRITE_BACK,
} from '../../../systems/topography/deliverables/survey-tables';
import type { ExportableTable, ScheduleColumnDef } from '../../schedule/types';
import type { TableColumnWriteBack } from '../write-back/table-write-back-plan';
import type { TopoPoint } from '../../../systems/topography/topo-types';
import type { TableSourceKind, TableSourceRef } from '../../../types/table-source-ref';

/**
 * Ό,τι έχει ήδη διαβάσει ο καλών από τη σκηνή — **δεδομένα, ποτέ store**.
 *
 * Κάθε πεδίο είναι προαιρετικό γιατί η απουσία του είναι **πραγματική κατάσταση** («δεν έχει
 * φορτωθεί τοπογραφία»), όχι σφάλμα προγραμματισμού· ο resolver τη μετατρέπει σε
 * `'source-unavailable'` αντί να πετάξει.
 */
export interface TableSourceContext {
  /**
   * Τα σημεία της αποτύπωσης σε world canonical mm.
   *
   * 🔴 `undefined` ≠ `[]`. Το πρώτο σημαίνει «κανείς δεν ρώτησε τη σκηνή» (άγνοια), το
   * δεύτερο «η αποτύπωση δεν έχει σημεία» (γεγονός, που ο πίνακας οφείλει να δείξει άδειος).
   * Ένα σχήμα που τα ισοπεδώνει θα έδειχνε άδειο πίνακα σε καθαρό έργο και θα τον δήλωνε
   * ενημερωμένο.
   */
  readonly topoPoints?: readonly TopoPoint[];
}

/** Η επίλυση πέτυχε — τα δεδομένα είναι εδώ. */
export interface TableSourceResolved {
  readonly status: 'resolved';
  readonly table: ExportableTable;
}

/**
 * Ο κλάδος υπάρχει στο σχήμα αλλά **δεν έχει συνδεθεί με παραγωγό** (Δ7: το σχήμα καλύπτει και
 * τους τρεις παραγωγούς από την πρώτη μέρα· ο resolver υλοποιείται ένας). Ρητό, ονομαστικό,
 * ποτέ σιωπηλό «τίποτα».
 */
export interface TableSourceNotWired {
  readonly status: 'source-not-wired';
  readonly kind: TableSourceKind;
}

/** Ο παραγωγός υπάρχει, αλλά το context δεν κουβαλά τα δεδομένα που χρειάζεται. */
export interface TableSourceUnavailable {
  readonly status: 'source-unavailable';
  readonly kind: TableSourceKind;
}

export type TableSourceResolution =
  | TableSourceResolved
  | TableSourceNotWired
  | TableSourceUnavailable;

/** Η υπογραφή κάθε καταχώρησης του μητρώου. */
type SourceResolver = (ref: TableSourceRef, context: TableSourceContext) => TableSourceResolution;

/**
 * Ο **μοναδικός συνδεδεμένος** παραγωγός (Δ7): ο πίνακας συντεταγμένων ΕΓΣΑ'87.
 *
 * Επιλέχθηκε πρώτος γιατί είναι ο απλούστερος, είναι το ίδιο «κουτί» που γέννησε το ADR-766,
 * και είναι ο μόνος που οδηγεί φυσικά στη Φ.Η (εκεί ο πίνακας θα **μετακινεί** κορυφή).
 */
function resolveSurveyCoordinates(
  _ref: TableSourceRef,
  context: TableSourceContext,
): TableSourceResolution {
  const points = context.topoPoints;
  if (points === undefined) return { status: 'source-unavailable', kind: 'survey-coordinates' };
  return { status: 'resolved', table: buildCoordinateTable(points) };
}

/**
 * Κλάδος **δηλωμένος στο σχήμα, ασύνδετος με παραγωγό** — και το λέει.
 *
 * Δεν είναι κενή θέση: είναι εκτελούμενη καταχώρηση με ρητή απάντηση. Η διαφορά μετράει, γιατί
 * το `TableBinding` έζησε ολόκληρες φάσεις **δηλωμένο και χωρίς έναν αναγνώστη**, και το
 * `TitleBlockBinding.snapshotValue` του ADR-745 ζει έτσι ακόμη.
 */
function notWired(kind: TableSourceKind): SourceResolver {
  return () => ({ status: 'source-not-wired', kind });
}

/**
 * 🔴 ADR-769 Δ2 — **μία καταχώρηση ανά πηγή, τρεις ερωτήσεις**.
 *
 * Οι τρεις ταξιδεύουν μαζί επειδή απαντούν για το **ίδιο** πράγμα και οι δύο τελευταίες
 * κλειδώνονται στην πρώτη από τον τύπο (το `CoordinateColumnKey` **παράγεται** από το
 * `COORDINATE_COLUMNS`). Χωριστά μητρώα θα ήταν **δύο χειρόγραφες λίστες** — το σχήμα που το
 * repo πλήρωσε τέσσερις φορές (CHECK 3.34: δύο λίστες namespace με απόκλιση **63**·
 * CHECK 3.37: συγκεντρωτής με **18** ενώ το δέντρο είχε **26**).
 */
interface TableSourceEntry {
  /** «Δώσε μου τα δεδομένα» — η μόνη ερώτηση που χρειάζεται τη σκηνή. */
  readonly resolve: SourceResolver;
  /**
   * Τι στήλες **παράγει** αυτή η πηγή — για το `valueType` της μετατροπής μονάδων, χωρίς να
   * χρειαστεί να επιλυθούν δεδομένα. Ο φρουρός γραφής κρίνει τη **δομή** πριν από την τιμή
   * (ADR-769 §4), οπότε δεν επιτρέπεται να εξαρτάται από το αν η πηγή απάντησε.
   */
  readonly columns: readonly ScheduleColumnDef[];
  /** Ποια στήλη γράφεται και σε ποιο πεδίο του ιδιοκτήτη — ή **γιατί όχι** (Δ2). */
  readonly writeBack: Readonly<Record<string, TableColumnWriteBack>>;
}

/**
 * 🔴 **Το μητρώο.** `Record<TableSourceKind, …>` ⇒ νέος κλάδος στην ένωση **δεν μεταγλωττίζεται**
 * μέχρι να δηλωθεί εδώ τι τον επιλύει. Η πύλη είναι ο μεταγλωττιστής, όχι σαρωτής.
 */
const SOURCE_ENTRIES: Readonly<Record<TableSourceKind, TableSourceEntry>> = {
  'survey-coordinates': {
    resolve: resolveSurveyCoordinates,
    columns: COORDINATE_COLUMNS,
    writeBack: COORDINATE_WRITE_BACK,
  },
  'survey-plot-boundary': { resolve: notWired('survey-plot-boundary'), columns: [], writeBack: {} },
  'survey-volumes': { resolve: notWired('survey-volumes'), columns: [], writeBack: {} },
  'survey-tolerance': { resolve: notWired('survey-tolerance'), columns: [], writeBack: {} },
  'bim-schedule': { resolve: notWired('bim-schedule'), columns: [], writeBack: {} },
};

/** Επιλύει τον δεσμό σε δεδομένα — ή λέει **ονομαστικά** γιατί δεν μπόρεσε. */
export function resolveTableSource(
  ref: TableSourceRef,
  context: TableSourceContext,
): TableSourceResolution {
  return SOURCE_ENTRIES[ref.kind].resolve(ref, context);
}

/**
 * 🔴 ADR-769 Δ2 — **γράφεται αυτή η στήλη, και πού;**
 *
 * Άγνωστο `sourceKey` (πηγή χωρίς παραγωγό, στήλη που η πηγή δεν έχει, χειρόγραφο κλειδί που
 * απέκλινε) απαντά **`no-owner`** και όχι σιωπή: «κανείς δεν κατέχει αυτή τη στήλη» είναι
 * ακριβώς η αλήθεια και στις τρεις περιπτώσεις, και ο χρήστης παίρνει λόγο αντί για τίποτα.
 *
 * ⚠️ Το προεπιλεγμένο **δεν** είναι `computed`: αυτό θα ήταν ισχυρισμός ότι η τιμή παράγεται
 * από κάτι — ψέμα που θα επιβίωνε (ADR-769 §4 Δ2).
 */
export function tableSourceColumnWriteBack(
  kind: TableSourceKind,
  sourceKey: string,
): TableColumnWriteBack {
  return SOURCE_ENTRIES[kind].writeBack[sourceKey] ?? { kind: 'unwritable', reason: 'no-owner' };
}

/**
 * Ο ορισμός στήλης της πηγής — `undefined` όταν η πηγή δεν παράγει τέτοια στήλη.
 *
 * Ο μόνος καταναλωτής είναι η μετατροπή μονάδων (`valueType`), και **δεν** μαντεύει: στήλη
 * που η πηγή δεν έχει έχει ήδη απαντηθεί `no-owner` από πάνω.
 */
export function tableSourceColumn(
  kind: TableSourceKind,
  sourceKey: string,
): ScheduleColumnDef | undefined {
  return SOURCE_ENTRIES[kind].columns.find((column) => column.key === sourceKey);
}

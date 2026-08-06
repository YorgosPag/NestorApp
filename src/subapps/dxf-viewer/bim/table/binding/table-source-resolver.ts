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

import { buildCoordinateTable } from '../../../systems/topography/deliverables/survey-tables';
import type { ExportableTable } from '../../schedule/types';
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
 * 🔴 **Το μητρώο.** `Record<TableSourceKind, …>` ⇒ νέος κλάδος στην ένωση **δεν μεταγλωττίζεται**
 * μέχρι να δηλωθεί εδώ τι τον επιλύει. Η πύλη είναι ο μεταγλωττιστής, όχι σαρωτής.
 */
const SOURCE_RESOLVERS: Readonly<Record<TableSourceKind, SourceResolver>> = {
  'survey-coordinates': resolveSurveyCoordinates,
  'survey-plot-boundary': notWired('survey-plot-boundary'),
  'survey-volumes': notWired('survey-volumes'),
  'survey-tolerance': notWired('survey-tolerance'),
  'bim-schedule': notWired('bim-schedule'),
};

/** Επιλύει τον δεσμό σε δεδομένα — ή λέει **ονομαστικά** γιατί δεν μπόρεσε. */
export function resolveTableSource(
  ref: TableSourceRef,
  context: TableSourceContext,
): TableSourceResolution {
  return SOURCE_RESOLVERS[ref.kind](ref, context);
}

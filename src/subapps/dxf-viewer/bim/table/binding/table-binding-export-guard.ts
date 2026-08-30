/**
 * 🔴 ADR-767 Δ4 — **«δεμένο» είναι διακόσμηση· «μπαγιάτικο» είναι ισχυρισμός ορθότητας.**
 *
 * Οι μεγάλοι ξεχωρίζουν δύο πράγματα που είναι εύκολο να μπερδευτούν:
 *
 * | Τι δηλώνεται | Πού φαίνεται | Πρότυπο |
 * |---|---|---|
 * | «αυτό το κελί είναι **δεμένο** / **παρακαμμένο**» | **μόνο οθόνη** | `FIELDDISPLAY` — *«The background is **not plotted**.»* |
 * | «αυτά τα νούμερα είναι **μπαγιάτικα**» | οθόνη **+ ΦΡΑΓΜΟΣ στην εξαγωγή** | `DXEVAL` — διάλογος «Outdated Table» σε `PLOT` / `ETRANSMIT` |
 *
 * ## Γιατί ΦΡΑΓΜΟΣ και όχι τυπωμένο σήμα
 * ⚠️ Αυτό **δεν** ήταν η πρώτη επιλογή του Giorgio — είχε ζητήσει έντονη ένδειξη που να φαίνεται
 * και σε εκτύπωση/DXF. Η έρευνα έδειξε ότι οι μεγάλοι κάνουν το αντίθετο με **ρητή** τεκμηρίωση,
 * αλλά **συμφωνούν στην ουσία**: μπαγιάτικο νούμερο δεν φτάνει σιωπηλά στο παραδοτέο· απλώς το
 * επιβάλλουν με φραγμό, όχι με μελάνι. Το τεκμήριο παρουσιάστηκε και εγκρίθηκε ρητά (06/08).
 *
 * Ο λόγος, σε μία πρόταση: **τυπωμένο σήμα «μπαγιάτικο» πάνω σε τοπογραφικό που υπογράφεται το
 * μετατρέπει σε προσχέδιο**· ο φραγμός εγγυάται το ίδιο χωρίς να λερώσει το παραδοτέο.
 *
 * ## 🔴 Ο «άγνωστος» δεν είναι «ενημερωμένος»
 * Πίνακας που δεν μπόρεσε να ελεγχθεί (η πηγή δεν επιλύθηκε) **δεν** περνά σιωπηλά. Δηλώνεται
 * ξεχωριστά, γιατί η ισοπέδωση «δεν ξέρω» με «όλα καλά» είναι ακριβώς το ψεύτικο πράσινο που το
 * `0 = κανείς δεν κοίταξε` των N.11/N.12 τεκμηριώνει τέσσερις φορές.
 *
 * ## Τι ΔΕΝ κάνει αυτό το αρχείο
 * Δεν δείχνει διάλογο και δεν μπλοκάρει τίποτα μόνο του: είναι **η κρίση**, καθαρή και
 * ελέγξιμη. Η σύνδεσή της με τον διάλογο εξαγωγής (μαζί με το λεκτικό — ADR-767 §10.3, ρητά
 * ανοιχτό) είναι το επόμενο βήμα, και το §8 #6 του ADR ορίζει ήδη τον κανόνα του: **ρητή
 * επιλογή, ποτέ προεπιλεγμένο κουμπί** — αλλιώς ο φραγμός γίνεται παρακάμψιμος με `Enter` και
 * κανείς δεν τον διαβάζει.
 *
 * @module subapps/dxf-viewer/bim/table/binding/table-binding-export-guard
 * @see docs/centralized-systems/reference/adrs/ADR-767-table-bound-mode.md §4 Δ4
 */

import { assessTableFreshness } from './table-binding-state';
import type { TableSourceContext } from './table-source-resolver';
import type { TableFreshnessUnknown } from './table-binding-state';
import type { Entity } from '../../../types/entities';
import type { TableEntity } from '../../../types/table-entity';
import { activeTableBinding } from '../table-worksheet-resolve';

/** Ένας πίνακας του οποίου τα νούμερα **δεν** είναι αυτά της πηγής του. */
export interface StaleBoundTable {
  readonly entityId: string;
  /** Το αποτύπωμα που θα είχε μετά από ανανέωση — ώστε το UI να μη χρειάζεται δεύτερη επίλυση. */
  readonly freshRevision: string;
}

/** Ένας πίνακας που **δεν μπόρεσε να ελεγχθεί** — αβέβαιος, όχι εντάξει. */
export interface UncheckedBoundTable {
  readonly entityId: string;
  readonly reason: TableFreshnessUnknown['reason'];
}

/**
 * Η ετυμηγορία πριν την εξαγωγή. `blocked === false` σημαίνει *«κανένας δεμένος πίνακας δεν
 * είναι μπαγιάτικος και κανένας δεν έμεινε ανέλεγκτος»* — δηλαδή **ελέγχθηκαν**, όχι «δεν
 * βρέθηκε τίποτα επειδή δεν κοίταξε κανείς».
 */
export interface BoundTableExportVerdict {
  readonly blocked: boolean;
  readonly stale: readonly StaleBoundTable[];
  readonly unchecked: readonly UncheckedBoundTable[];
  /** Πόσοι δεμένοι πίνακες εξετάστηκαν — ο αριθμός που κάνει το «0 μπαγιάτικοι» να σημαίνει κάτι. */
  readonly examined: number;
}

/** Δεμένος πίνακας = οντότητα `table` **με** `binding`. Ο `static` δεν αφορά αυτόν τον έλεγχο. */
function boundTables(entities: readonly Entity[]): TableEntity[] {
  // 🔴 ADR-833 Φάση 2 — «δεμένος» σημαίνει **το ενεργό φύλλο** είναι δεμένο: ο δεσμός μετακόμισε
  // μέσα στο φύλλο, γιατί ό,τι αναγεννά **γραμμές** ανήκει στο φύλλο που τις κρατά.
  return entities.filter(
    (entity): entity is TableEntity =>
      entity.type === 'table' && activeTableBinding(entity as TableEntity) !== undefined,
  );
}

/**
 * Εξετάζει **κάθε** δεμένο πίνακα της εξαγωγής και λέει αν κάτι πρέπει να σταματήσει τον χρήστη.
 *
 * Καθαρή συνάρτηση: το context το συναρμολογεί ο καλών από ό,τι έχει ήδη διαβάσει, ακριβώς όπως
 * στην ανανέωση — ίδια διαδρομή, ίδια σημασία του «άλλαξε», κανένα σημείο όπου οι δύο να
 * διαφωνήσουν.
 */
export function assessBoundTablesForExport(
  entities: readonly Entity[],
  context: TableSourceContext,
): BoundTableExportVerdict {
  const stale: StaleBoundTable[] = [];
  const unchecked: UncheckedBoundTable[] = [];

  const tables = boundTables(entities);
  for (const table of tables) {
    const binding = activeTableBinding(table);
    if (binding === undefined) continue;
    const verdict = assessTableFreshness(binding, context);
    if (verdict.status === 'stale') {
      stale.push({ entityId: table.id, freshRevision: verdict.freshRevision });
    } else if (verdict.status === 'unknown') {
      unchecked.push({ entityId: table.id, reason: verdict.reason });
    }
  }

  return {
    blocked: stale.length > 0 || unchecked.length > 0,
    stale,
    unchecked,
    examined: tables.length,
  };
}

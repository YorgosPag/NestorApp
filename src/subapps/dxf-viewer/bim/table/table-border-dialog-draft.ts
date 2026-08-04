/**
 * ADR-750 Φ6 — **η μηχανή του προσχεδίου** του διαλόγου «Περισσότερα περιγράμματα…».
 *
 * Καθαρές συναρτήσεις: μηδέν React, μηδέν canvas, μηδέν i18n, μηδέν store. Το μεταλλακτικό
 * μισό· το ερωτηματικό ζει στο `table-border-dialog-positions.ts`.
 *
 * ## 🔑 Το προσχέδιο ΕΙΝΑΙ ένα `PersistedTableModel` — και είναι δωρεάν
 * Ο διάλογος έχει «ΟΚ / Άκυρο», άρα **τίποτα** δεν επιτρέπεται να αγγίξει το ζωντανό μοντέλο
 * πριν το ΟΚ. Ο πειρασμός είναι μια δεύτερη, ελαφριά αναπαράσταση («ποιες θέσεις άναψαν») που
 * μεταφράζεται σε ακμές στο τέλος. Θα ήταν **δεύτερο μοντέλο περιγραμμάτων** — δηλαδή δύο
 * απαντήσεις στο «τι σημαίνει αυτό το κλικ», και η μετάφραση θα ήταν το σημείο όπου
 * αποκλίνουν (η «τέταρτη μηχανή πίνακα» του ADR-739 §15 με άλλο όνομα).
 *
 * Δεν χρειάζεται: **όλες** οι πράξεις ακμών και διαγωνίων είναι ήδη καθαρές και επιστρέφουν το
 * **ίδιο** αντικείμενο by-reference όταν τίποτα δεν αλλάζει. Άρα ο γονέας κρατά ένα τοπικό
 * `PersistedTableModel`, το μεταλλάσσει λειτουργικά σε κάθε κλικ, δείχνει τη ζωντανή
 * προεπισκόπηση διαβάζοντάς το, και στο ΟΚ κάνει **ένα** commit. Το «Άκυρο» είναι σκέτη
 * απόρριψη μιας τοπικής μεταβλητής.
 *
 * ## ⚠️ Το μολύβι είναι κατάσταση ΤΟΥ ΔΙΑΛΟΓΟΥ, όχι ιδιότητα των ακμών
 * Αλλαγή στυλ/χρώματος/πάχους **δεν** πειράζει ό,τι έχει ήδη τοποθετηθεί — αφορά τις
 * **επόμενες** θέσεις που θα πατηθούν. Γι' αυτό το `pencil` είναι **παράμετρος κάθε πράξης**
 * (Α15) και δεν υπάρχει πουθενά εδώ συνάρτηση «άλλαξε το μολύβι όλων». Το αντίθετο μοντέλο
 * είναι εύκολο να γραφτεί κατά λάθος και αδύνατο να ξεγραφτεί: ο χρήστης που βάζει λεπτές
 * εσωτερικές και μετά διαλέγει παχύ για το εξωτερικό θα έχανε σιωπηλά τις εσωτερικές του.
 *
 * ## Η by-reference εγγύηση δεν είναι βελτιστοποίηση
 * Η αλυσίδα `PersistedTableModel → RESOLVED_MODEL_CACHE → TableModel → LAYOUT_CACHE` (§9.3)
 * κλειδώνει σε **ταυτότητα αντικειμένου**. Νέο αντικείμενο χωρίς λόγο = ακυρωμένη μνήμη σε
 * κάθε κίνηση του ποντικιού μέσα στον διάλογο, **και** ένα βήμα undo που δεν αναιρεί τίποτα.
 * Κάθε πράξη εδώ την κληρονομεί από τους δύο εγγραφείς (`setTableEdges`,
 * `setTableRangeDiagonals`) — δεν την ξαναϋλοποιεί.
 *
 * @module subapps/dxf-viewer/bim/table/table-border-dialog-draft
 * @see bim/table/table-border-dialog-positions.ts — διαθεσιμότητα + τρέχουσα κατάσταση
 * @see bim/table/table-border-style-catalog.ts — τα 13 στυλ του listbox
 * @see docs/centralized-systems/reference/adrs/ADR-750-table-cell-borders.md §8.2 · §6.7 · §13
 */

import type { TableBorderSpec, TableEdgeKey } from '../../types/table-edges';
import type { PersistedTableModel } from '../../types/table';
import type { TableCellRangeBounds } from './table-cell-range';
import { HIDDEN_TABLE_EDGE, sameBorderSpec, setTableEdges } from './table-edge-model';
import { tableRangeSideEdges } from './table-range-border-ops';
import { setTableRangeDiagonals, type TableDiagonalPatch } from './table-cell-diagonal-ops';
import {
  TABLE_BORDER_DIALOG_POSITIONS,
  isTableBorderDialogPositionAvailable,
  isTableBorderSidePosition,
  tableBorderDialogPositionState,
  tableDiagonalDirectionOf,
  type TableBorderDialogPositionId,
} from './table-border-dialog-positions';

// ──────────────────────────────────────────────────────────────────────────────
// Μία θέση
// ──────────────────────────────────────────────────────────────────────────────

/**
 * **Η σημασιολογία του Excel**, με τα τρία μονοπάτια της γραμμένα ρητά:
 *
 * ```
 *   absent            →  βάλε το τρέχον μολύβι
 *   uniform, ΙΔΙΟ     →  σβήσε  (δεύτερο πάτημα του ίδιου κουμπιού = αναίρεση)
 *   uniform άλλο/mixed→  βάλε το τρέχον μολύβι  (μία κίνηση, όχι δύο)
 * ```
 *
 * 🔑 Το τρίτο σκέλος είναι η ουσία: αν το «άλλο μολύβι» έσβηνε πρώτα, ο χρήστης που θέλει να
 * **αλλάξει** ένα υπάρχον περίγραμμα θα χρειαζόταν δύο πατήματα και θα έβλεπε τη γραμμή να
 * εξαφανίζεται στο ενδιάμεσο. Το ίδιο για τη `mixed`: ο σκοπός του κλικ πάνω σε μεικτή
 * κατάσταση είναι προφανώς η **ομογενοποίηση**.
 *
 * ## 🔴 Το «σβήσε» εδώ σημαίνει ΔΙΑΓΡΑΦΗ, όχι αόρατο μολύβι — και είναι απόφαση
 * Το μοντέλο έχει **τρεις** καταστάσεις (Α14) και ο διάλογος οφείλει να φτάνει και στις τρεις:
 *
 * ```
 *   ρητό ορατό     →  πάτησε μια θέση με κανονικό στυλ
 *   ρητό ΑΟΡΑΤΟ    →  διάλεξε «Καμία» στο listbox, μετά πάτησε τη θέση  (Α14, «δεν θέλω γραμμή»)
 *   κληρονομιά     →  ΕΔΩ: δεύτερο πάτημα του ίδιου = «ξέχνα ό,τι όρισα»
 * ```
 *
 * Αν η εναλλαγή έγραφε αόρατο μολύβι, η **κληρονομιά** θα ήταν απρόσιτη από τον διάλογο και
 * το «Καμία» του listbox θα ήταν διπλότυπη χειρονομία. Έτσι κάθε κατάσταση έχει **μία**
 * χειρονομία, και καμία δεν έχει δύο.
 */
export function toggleTableBorderDialogPosition(
  model: PersistedTableModel,
  bounds: TableCellRangeBounds,
  id: TableBorderDialogPositionId,
  pencil: TableBorderSpec,
): PersistedTableModel {
  if (!isTableBorderDialogPositionAvailable(id, bounds)) return model;

  const state = tableBorderDialogPositionState(model, bounds, id);
  const erase = state.kind === 'uniform' && sameBorderSpec(state.spec, pencil);
  return setTableBorderDialogPositions(model, bounds, [id], erase ? null : pencil);
}

/**
 * Γράφει **την ίδια** απόφαση σε πολλές θέσεις, με ένα πέρασμα ανά μέρος του μοντέλου.
 *
 * `null` ⇒ διαγραφή (επιστροφή στην κληρονομιά)· μολύβι ⇒ ρητή τιμή — η **ίδια** διάκριση με
 * το `TableEdgePatchMap`, μεταφερμένη αυτούσια αντί να εφευρεθεί δεύτερη.
 *
 * ## Γιατί ΕΝΑ σώμα για ακμές και διαγωνίους
 * Οι δύο οικογένειες γράφουν σε διαφορετικά μέρη, αλλά η **απόφαση** είναι ίδια. Δύο
 * παράλληλα σώματα («εφάρμοσε σε πλευρές» / «εφάρμοσε σε διαγωνίους») θα ήταν sibling clone
 * (CHECK 3.28, N.18) και θα ανάγκαζαν κάθε καλούντα — εναλλαγή, υποδείγματα, αποφάσεις — να
 * κάνει **ο ίδιος** τη διακλάδωση, δηλαδή τρία αντίγραφα της ίδιας ερώτησης.
 *
 * Οι ακμές συγκεντρώνονται σε **μία** δέσμη: το `setTableEdges` ξαναχτίζει και ξανα-ταξινομεί
 * ολόκληρη την ακολουθία ανά κλήση, οπότε τέσσερις κλήσεις για το υπόδειγμα «Περίγραμμα» θα
 * ήταν τέσσερις πλήρεις ανακατασκευές για μία λογική πράξη.
 *
 * Μη διαθέσιμες θέσεις **παραλείπονται σιωπηλά**: είναι νόμιμη είσοδος (τα υποδείγματα
 * ονομάζουν πάντα το πλήρες σύνολό τους), όχι σφάλμα καλωδίωσης.
 */
export function setTableBorderDialogPositions(
  model: PersistedTableModel,
  bounds: TableCellRangeBounds,
  ids: readonly TableBorderDialogPositionId[],
  spec: TableBorderSpec | null,
): PersistedTableModel {
  const patches = new Map<TableEdgeKey, TableBorderSpec | null>();
  let next = model;

  for (const id of ids) {
    if (!isTableBorderDialogPositionAvailable(id, bounds)) continue;
    if (isTableBorderSidePosition(id)) {
      for (const key of tableRangeSideEdges(next, bounds, id)) patches.set(key, spec);
      continue;
    }
    next = setTableRangeDiagonals(next, bounds, diagonalPatch(id, spec));
  }
  return setTableEdges(next, patches);
}

// ──────────────────────────────────────────────────────────────────────────────
// Τα τρία υποδείγματα
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Τα κουμπιά **«Προεπιλογές»** του διαλόγου, με τα ονόματα του Excel. Τρία, όχι τέσσερα: το
 * «Πλέγμα» δεν υπάρχει σε αυτόν τον διάλογο — είναι το «Όλα τα περιγράμματα» του dropdown
 * (`all` του μητρώου των 13), και προκύπτει εδώ ως «Περίγραμμα» + «Εσωτερικά».
 */
export type TableBorderDialogPresetId = 'none' | 'outline' | 'inside';

const PERIMETER_POSITIONS: readonly TableBorderDialogPositionId[] = [
  'top',
  'bottom',
  'left',
  'right',
];

const INSIDE_POSITIONS: readonly TableBorderDialogPositionId[] = ['insideH', 'insideV'];

/** Οι έξι πλευρές του πλέγματος ως θέσεις — το «Κανένα» τις σβήνει όλες. */
const ALL_SIDE_POSITIONS: readonly TableBorderDialogPositionId[] = [
  ...PERIMETER_POSITIONS,
  ...INSIDE_POSITIONS,
];

/**
 * Έχει νόημα το υπόδειγμα; Μόνο το «Εσωτερικά» μπορεί να μην έχει — σε **ένα** κελί δεν
 * υπάρχει τίποτα ανάμεσα, και το Excel το γκριζάρει εκεί ακριβώς.
 *
 * Η απάντηση **παράγεται** από τη διαθεσιμότητα των θέσεών του: ένα χειρόγραφο
 * `rows > 1 || cols > 1` θα ήταν δεύτερος κανόνας δίπλα σε αυτόν που πράγματι εκτελείται —
 * και σε επιλογή 1×3 (όπου το `insideV` **υπάρχει**) οι δύο μπορούν να διαφωνήσουν.
 */
export function isTableBorderDialogPresetAvailable(
  preset: TableBorderDialogPresetId,
  bounds: TableCellRangeBounds,
): boolean {
  return presetPositions(preset).some((id) =>
    isTableBorderDialogPositionAvailable(id, bounds),
  );
}

/**
 * Εφαρμόζει ένα υπόδειγμα στο προσχέδιο.
 *
 * ## 🔴 Το «Κανένα» γράφει ΑΟΡΑΤΟ μολύβι στις ακμές — δεν διαγράφει
 * Είναι η **ίδια** πράξη με το «Χωρίς περίγραμμα» των 13 εντολών (Α14): ο χρήστης που πατά
 * «Κανένα» θέλει να μη βλέπει γραμμές, και η διαγραφή θα ξαναζωντάνευε το πλέγμα της κλάσης
 * (επίπεδα 2–4 του §6.5) — δηλαδή θα αναπαρήγαγε **ακριβώς** το παράπονο Π3 μέσα στο εργαλείο
 * που το λύνει. Η επιστροφή στην κληρονομιά έχει τη δική της χειρονομία (εναλλαγή θέσης).
 *
 * ⚠️ **Οι διαγώνιοι όμως ΔΙΑΓΡΑΦΟΝΤΑΙ**, και η ασυμμετρία είναι του **μοντέλου**, όχι επιλογή
 * μας: το `TableCellDiagonals` δεν έχει τρίτη κατάσταση — μια διαγώνιος υπάρχει ή δεν υπάρχει.
 * Δεν κληρονομείται από πουθενά (καμία κλάση γραμμής δεν ορίζει διαγωνίους), οπότε «δεν
 * υπάρχει» **είναι** ήδη «δεν φαίνεται». Ένα αόρατο μολύβι εκεί θα ήταν εγγραφή που δεν
 * ζωγραφίζει τίποτα και δεν εμποδίζει τίποτα: σκέτο βάρος στο αρχείο.
 */
export function applyTableBorderDialogPreset(
  model: PersistedTableModel,
  bounds: TableCellRangeBounds,
  preset: TableBorderDialogPresetId,
  pencil: TableBorderSpec,
): PersistedTableModel {
  if (preset !== 'none') {
    return setTableBorderDialogPositions(model, bounds, presetPositions(preset), pencil);
  }
  const hidden = setTableBorderDialogPositions(model, bounds, ALL_SIDE_POSITIONS, HIDDEN_TABLE_EDGE);
  return setTableRangeDiagonals(hidden, bounds, { down: null, up: null });
}

// ──────────────────────────────────────────────────────────────────────────────
// Το τελικό μοντέλο
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Μία απόφαση του χρήστη μέσα στον διάλογο: **ποια θέση** και **τι** μπαίνει εκεί.
 *
 * `null` ⇒ επιστροφή στην κληρονομιά. Το μολύβι ταξιδεύει **μαζί με την απόφαση** και δεν
 * ζητιέται στο τέλος: μια λίστα θέσεων + ένα τελικό μολύβι θα σήμαινε ότι η αλλαγή στυλ
 * αναδρομικά ξαναβάφει ό,τι μπήκε νωρίτερα — ακριβώς το μοντέλο που η κεφαλίδα απαγορεύει.
 */
export interface TableBorderDialogDecision {
  readonly position: TableBorderDialogPositionId;
  readonly spec: TableBorderSpec | null;
}

/**
 * **Αρχικό μοντέλο + αποφάσεις ⇒ τελικό μοντέλο** — ό,τι κάνει το «ΟΚ» όταν ο γονέας
 * προτίμησε να κρατήσει αποφάσεις αντί για ζωντανό προσχέδιο.
 *
 * Οι αποφάσεις εφαρμόζονται **με τη σειρά** και η τελευταία για την ίδια θέση νικά — η ίδια
 * σύμβαση με ένα ημερολόγιο συμβάντων, ώστε «πάτησα, ξαναπάτησα, ξαναπάτησα» να δίνει το
 * αποτέλεσμα του τρίτου πατήματος χωρίς ο καλών να χρειάζεται να συμπτύξει τίποτα.
 *
 * Επιστρέφει το **ίδιο** μοντέλο by-reference όταν καμία απόφαση δεν αλλάζει τιμή — δηλαδή
 * «άνοιξα τον διάλογο, πείραξα, το ξαναέφερα όπως ήταν, ΟΚ» **δεν** γεννά βήμα undo.
 */
export function applyTableBorderDialogDecisions(
  model: PersistedTableModel,
  bounds: TableCellRangeBounds,
  decisions: readonly TableBorderDialogDecision[],
): PersistedTableModel {
  let next = model;
  for (const decision of decisions) {
    next = setTableBorderDialogPositions(next, bounds, [decision.position], decision.spec);
  }
  return next;
}

/**
 * Οι αποφάσεις που **λείπουν** για να γίνει το τρέχον προσχέδιο πραγματικότητα — το αντίστροφο
 * ερώτημα, για όποιον γονέα κρατά προσχέδιο-μοντέλο και θέλει να το εξηγήσει (π.χ. σε ένα
 * μήνυμα αναίρεσης ή σε ένα test).
 *
 * Παράγεται από τις **ίδιες** αναγνώσεις που τροφοδοτούν το widget, οπότε δεν μπορεί να
 * διαφωνήσει μαζί του. Θέση σε κατάσταση `mixed` **παραλείπεται**: δεν υπάρχει μία απόφαση
 * που να την περιγράφει, και μια αυθαίρετη («πάρε την πρώτη») θα ισοπέδωνε σιωπηλά διαφορές
 * που ο χρήστης δεν ζήτησε να ισοπεδωθούν.
 */
export function tableBorderDialogDecisions(
  model: PersistedTableModel,
  bounds: TableCellRangeBounds,
): readonly TableBorderDialogDecision[] {
  const decisions: TableBorderDialogDecision[] = [];
  for (const position of TABLE_BORDER_DIALOG_POSITIONS) {
    if (!isTableBorderDialogPositionAvailable(position, bounds)) continue;
    const state = tableBorderDialogPositionState(model, bounds, position);
    if (state.kind === 'mixed') continue;
    decisions.push({ position, spec: state.kind === 'uniform' ? state.spec : null });
  }
  return decisions;
}

// ──────────────────────────────────────────────────────────────────────────────
// Ιδιωτικά
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Ποιες **πλευρές πλέγματος** ονομάζει κάθε υπόδειγμα — η μία λίστα που διαβάζουν τόσο η
 * διαθεσιμότητα όσο και η εφαρμογή, ώστε ένα γκριζαρισμένο κουμπί να μην μπορεί ποτέ να
 * γράψει κάτι που δεν δήλωσε.
 */
function presetPositions(
  preset: TableBorderDialogPresetId,
): readonly TableBorderDialogPositionId[] {
  switch (preset) {
    case 'none':
      return ALL_SIDE_POSITIONS;
    case 'outline':
      return PERIMETER_POSITIONS;
    case 'inside':
      return INSIDE_POSITIONS;
  }
}

/**
 * Η δέσμη μιας **και μόνο** διαγωνίου. Το άλλο σκέλος μένει **απόν** — όχι `null`: αυτή
 * ακριβώς είναι η τρίτη τιμή του {@link TableDiagonalPatch}, και χωρίς αυτήν το άναμμα της ↗
 * θα έσβηνε τη ↘ που ο χρήστης είχε ήδη βάλει.
 */
function diagonalPatch(
  id: TableBorderDialogPositionId,
  spec: TableBorderSpec | null,
): TableDiagonalPatch {
  return tableDiagonalDirectionOf(id) === 'down' ? { down: spec } : { up: spec };
}

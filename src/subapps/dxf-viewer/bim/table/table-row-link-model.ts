/**
 * ADR-739 Επίπεδο Β — **η μηχανή των δεσμών γραμμής→οντότητες**: ταξίδι, σειρά, επιβίωση.
 * Καθαρές συναρτήσεις· μηδέν React, μηδέν canvas, μηδέν UI.
 *
 * Αδελφό module του `table-edge-model.ts`, με **ακριβώς** την ίδια δομή ευθυνών — όχι από
 * συμμετρία, αλλά επειδή απαντά το ίδιο ερώτημα («πώς ταξιδεύει ένα κλειδωμένο σε ταυτότητες
 * αντικείμενο;») και μια δεύτερη απάντηση θα ήταν δεύτερο λεξιλόγιο.
 *
 * ## Πού ζει τι
 * ```
 *   types/table-row-link.ts     →  το σχήμα (τι ΕΙΝΑΙ ένας δεσμός)
 *   ΕΔΩ                          →  το ταξίδι + η σειρά + η επιβίωση σε διαγραφή
 *   table-row-link-resolver.ts  →  τι ΒΡΙΣΚΕΙ ο δεσμός στη σκηνή, τώρα (Φ.Β2)
 * ```
 *
 * ## 🔴 Γιατί ΔΕΝ υπάρχει branded κλειδί εδώ (σε αντίθεση με τις ακμές)
 * Η ακμή χρειάζεται σύνθετο κλειδί επειδή η ταυτότητά της είναι **τριάδα** (προσανατολισμός,
 * γραμμή, στήλη) και μια λάθος σειρά σκελών θα περνούσε αθόρυβα. Ο δεσμός αγκυρώνεται σε
 * **μία** γραμμή: το `TableRowId` **είναι** ήδη το κλειδί. Ένα brand εδώ θα ήταν τελετουργία
 * χωρίς λάθος να αποτρέψει — και θα υποχρέωνε κάθε καλούντα σε μετατροπή για να ρωτήσει
 * «έχει δεσμό αυτή η γραμμή;».
 *
 * @module subapps/dxf-viewer/bim/table/table-row-link-model
 * @see bim/table/table-edge-model.ts — το ίδιο μοτίβο για τις ακμές
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §7 επίπεδο Β
 */

import { dequal } from 'dequal';
import { createModuleLogger } from '@/lib/telemetry';
import type { PersistedTableModel } from '../../types/table';
import type { TableRowId } from '../../types/table-ids';
import type {
  TableRowLink,
  TableRowLinkEntry,
  TableRowLinkIndex,
  TableRowLinkOrigin,
  TableRowLinkTarget,
} from '../../types/table-row-link';
import type { CellOrderSource } from './table-cell-order';
import { indexById } from './table-cell-order';

const logger = createModuleLogger('TableRowLinks');

// ──────────────────────────────────────────────────────────────────────────────
// Ταυτοδυναμία
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Ίδιος δεσμός;
 *
 * Το χρειάζεται η **εγγύηση by-reference** του {@link setTableRowLinks}: «δένω τα ίδια
 * αντικείμενα στην ίδια γραμμή δεύτερη φορά» πρέπει να είναι μηδέν βήματα undo και μηδέν
 * ακύρωση μνήμης. Χωρίς αυτό, ένα δεύτερο πάτημα της ίδιας εντολής θα γεννούσε νέο
 * αντικείμενο μοντέλου, δηλαδή βήμα undo που δεν αναιρεί τίποτα — το τεκμηριωμένο λάθος του
 * `table-axis-style-ops.ts:16-19`.
 *
 * ## Γιατί `dequal` και όχι χειρόγραφη σύγκριση
 * Ο ένας κλάδος κρατά **πίνακα** ταυτοτήτων, ο άλλος **αντικείμενο κριτηρίων με πέντε
 * προαιρετικούς άξονες, δύο από τους οποίους είναι πίνακες**. Χειρόγραφη σύγκριση εδώ θα
 * σήμαινε ότι κάθε νέος άξονας κριτηρίου του ADR-363 πρέπει να θυμηθεί να ενημερώσει **αυτό**
 * το αρχείο — και η μέρα που θα το ξεχνούσε δεν θα έδινε σφάλμα, θα έδινε **σιωπηλά χαμένη
 * αλλαγή**: ο χρήστης αλλάζει τον όροφο στο κριτήριο και ο πίνακας δεν το γράφει ποτέ.
 * Η `dequal` είναι ήδη εξάρτηση του subapp (MIT) — δες `BimSelectionHighlighter.ts`.
 *
 * ⚠️ Η σειρά μέσα στο `entityIds` **μετράει** ως διαφορά. Είναι σωστό: η σειρά είναι η σειρά
 * επιλογής του χρήστη, και θα είναι η σειρά που τα δείχνει το UI. Κανονικοποίηση εδώ θα
 * ήταν απόφαση παρουσίασης παρμένη στο στρώμα του μοντέλου.
 */
export function sameRowLink(a: TableRowLink, b: TableRowLink): boolean {
  if (a === b) return true;
  if (a.origin !== b.origin) return false;
  return dequal(a.target, b.target);
}

// ──────────────────────────────────────────────────────────────────────────────
// Ταξίδι ↔ μνήμη (Λύση Α του ADR-739 §19.2, όπως ήδη τα κελιά και οι ακμές)
// ──────────────────────────────────────────────────────────────────────────────

function isOrigin(value: unknown): value is TableRowLinkOrigin {
  return value === 'manual' || value === 'bound';
}

/**
 * Στόχος είναι ρητή λίστα ταυτοτήτων **ή** κριτήριο — τίποτα άλλο.
 *
 * ## 🔴 Το συνειδητό όριο: το κριτήριο ελέγχεται ως **σχήμα**, όχι ως **περιεχόμενο**
 * Δεν επικυρώνεται εδώ ότι το `criteria.floorIds` είναι πίνακας αλφαριθμητικών, ούτε ότι οι
 * άξονες είναι οι πέντε γνωστοί. Αυτό **θα ήταν διπλότυπο** της γνώσης που κατέχει το
 * `bim/schedule/filters.ts` (N.0.2), και θα αποσυγχρονιζόταν την πρώτη φορά που το ADR-363
 * προσθέτει έκτο άξονα — γεννώντας τη χειρότερη μορφή σφάλματος: **σιωπηλή απόρριψη έγκυρου
 * δεδομένου**. Ο εκτελεστής του κριτηρίου είναι ο μόνος που ξέρει τι είναι έγκυρο κριτήριο,
 * και αγνοεί ό,τι δεν αναγνωρίζει (κάθε άξονας `undefined` ⇒ pass-through).
 */
function isRowLinkTarget(value: unknown): value is TableRowLinkTarget {
  if (typeof value !== 'object' || value === null) return false;
  const target = value as Record<string, unknown>;
  if (target.kind === 'ids') {
    return Array.isArray(target.entityIds) && target.entityIds.every((id) => typeof id === 'string');
  }
  if (target.kind === 'query') {
    return typeof target.criteria === 'object' && target.criteria !== null;
  }
  return false;
}

function isRowLink(value: unknown): value is TableRowLink {
  if (typeof value !== 'object' || value === null) return false;
  const link = value as Record<string, unknown>;
  return isOrigin(link.origin) && isRowLinkTarget(link.target);
}

/** Δυάδα **ακριβώς** δύο σκελών με σωστούς τύπους· ό,τι άλλο δεν είναι δεσμός. */
function isRowLinkEntry(entry: unknown): entry is TableRowLinkEntry {
  if (!Array.isArray(entry) || entry.length !== 2) return false;
  const [rowId, link]: readonly unknown[] = entry;
  return typeof rowId === 'string' && isRowLink(link);
}

/**
 * Ακολουθία δυάδων → ευρετήριο. Το `rowLinks` είναι **προαιρετικό**, άρα η συνηθέστερη
 * είσοδος είναι `undefined` και η σωστή απάντηση κενός χάρτης — όχι κραυγή.
 *
 * Ίδιο μέγεθος διχτυού με τις ακμές και για τον ίδιο λόγο: το `rowLinks` γεννιέται σήμερα,
 * **δεν υπάρχει παλιό σχήμα να ανακτηθεί**. Ό,τι δεν είναι κανονικό εδώ είναι φθορά, όχι
 * κληρονομιά — και παραλείπεται **με ίχνος**, ποτέ σιωπηλά.
 */
export function buildTableRowLinkIndex(entries: unknown): TableRowLinkIndex {
  const index = new Map<TableRowId, TableRowLink>();
  if (entries === null || entries === undefined) return index;

  if (!Array.isArray(entries)) {
    logger.error('Το `rowLinks` του πίνακα δεν είναι ακολουθία δεσμών — κανένας δεσμός', {
      received: typeof entries,
    });
    return index;
  }

  let dropped = 0;
  for (const entry of entries) {
    if (!isRowLinkEntry(entry)) {
      dropped++;
      continue;
    }
    index.set(entry[0], entry[1]);
  }
  if (dropped > 0) {
    logger.error('Εγγραφές δεσμών με άκυρο σχήμα — παραλείπονται', {
      dropped,
      total: entries.length,
    });
  }
  return index;
}

/**
 * Ευρετήριο → ακολουθία δυάδων, σε **ντετερμινιστική** σειρά γραμμής.
 *
 * Ίδιος λόγος με τα κελιά και τις ακμές: η σειρά με την οποία έτυχε να μπουν οι δεσμοί στον
 * `Map` θα έδινε διαφορετικό JSON για ταυτόσημο περιεχόμενο — άχρηστα diffs, ασταθή snapshots
 * και ψευδείς «αλλαγές» που πυροδοτούν auto-save σε πίνακα που κανείς δεν άγγιξε.
 *
 * Δεσμός σε σβησμένη γραμμή κλαδεύεται εδώ — αλλά αυτό **δεν** αρκεί ως επιβίωση σε διαγραφή:
 * δες {@link dropTableRowLink}.
 */
export function toPersistedTableRowLinks(
  axes: CellOrderSource,
  rowLinks: TableRowLinkIndex,
): readonly TableRowLinkEntry[] {
  if (rowLinks.size === 0) return [];

  const rowOrder = indexById(axes.rows);
  const ordered: { readonly rank: number; readonly entry: TableRowLinkEntry }[] = [];

  for (const [rowId, link] of rowLinks) {
    const rank = rowOrder.get(rowId);
    if (rank === undefined) continue;
    ordered.push({ rank, entry: [rowId, link] });
  }
  ordered.sort((a, b) => a.rank - b.rank);
  return ordered.map((o) => o.entry);
}

// ──────────────────────────────────────────────────────────────────────────────
// Επιβίωση σε διαγραφή γραμμής
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Οι δεσμοί μετά τη διαγραφή μιας γραμμής: **ο δεσμός της φεύγει μαζί της, χωρίς κληρονόμο.**
 *
 * ## Γιατί ΟΧΙ μετακόμιση (σε αντίθεση με το `rebuildTableEdgesOnDelete`)
 * Η οριζόντια ακμή είναι **σύνορο**: μετά τη διαγραφή το ίδιο φυσικό σύνορο εξακολουθεί να
 * υπάρχει, ανάμεσα σε άλλα δύο κελιά — γι' αυτό μετακομίζει στην επιζώσα. Ο δεσμός είναι
 * ιδιότητα **της ίδιας της εγγραφής**: σβήνεις τη γραμμή «Εκσκαφή θεμελίων», έσβησες την
 * εκσκαφή· η επόμενη γραμμή δεν κληρονομεί τα θεμέλια. Κληρονομιά εδώ θα ήταν σιωπηλή
 * αλλοίωση **ποσοτήτων**, δηλαδή σφάλμα τιμής — η κλάση ADR-720.
 *
 * ## 🔴 Γιατί δεν αρκεί το κλάδεμα του {@link toPersistedTableRowLinks}
 * Το `deleteTableRow` επιστρέφει `PersistedTableModel` — **ήδη σε σχήμα αρχείου**, που
 * αποθηκεύεται χωρίς να ξαναπεράσει απαραίτητα από τη σειριοποίηση. Ο νεκρός δεσμός θα
 * γραφόταν στο αρχείο, και εκεί γίνεται επικίνδυνος: το `nextAxisId` δίνει **μέγιστο των
 * υπαρχόντων + 1**, οπότε σβήνοντας την τελευταία γραμμή (`r5`) και προσθέτοντας νέα, εκείνη
 * παίρνει **ξανά** `r5` — και κληρονομεί σιωπηλά τον δεσμό της σβησμένης. Δεν είναι θεωρητικό:
 * είναι η **προεπιλεγμένη** συμπεριφορά του γεννήτορα ταυτοτήτων του ίδιου module.
 *
 * Επιστρέφει το **ίδιο** αντικείμενο όταν η γραμμή δεν είχε δεσμό: καμία ψεύτικη αλλαγή στο
 * JSON, καμία περιττή ακύρωση μνήμης — ίδια εγγύηση με τα κελιά και τις ακμές.
 */
export function dropTableRowLink(
  rowLinks: readonly TableRowLinkEntry[] | undefined,
  removedId: TableRowId,
): readonly TableRowLinkEntry[] | undefined {
  if (rowLinks === undefined || rowLinks.length === 0) return rowLinks;
  const kept = rowLinks.filter((entry) => entry[0] !== removedId);
  if (kept.length === rowLinks.length) return rowLinks;
  // Άδειο ⇒ `undefined`, ποτέ `[]` — ίδια σύμβαση με το `setTableRowLinks`.
  return kept.length > 0 ? kept : undefined;
}

// ──────────────────────────────────────────────────────────────────────────────
// Μαζική εγγραφή
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Μια δέσμη αλλαγών δεσμών. Δύο νοήματα, ρητά διακριτά στον τύπο:
 *
 * ```
 *   TableRowLink  →  δέσε αυτή τη γραμμή εδώ (αντικαθιστά ό,τι υπήρχε)
 *   null          →  ΛΥΣΕ τον δεσμό της γραμμής
 * ```
 *
 * Η διάκριση χρειάζεται για τον ίδιο λόγο με το {@link TableEdgePatchMap}: «δέσε σε κανένα
 * αντικείμενο» (`{kind:'ids', entityIds:[]}`) και «λύσε τον δεσμό» **δεν** είναι το ίδιο. Το
 * πρώτο είναι γραμμή που δηλώνει ρητά «δεν αντιστοιχώ σε τίποτα ακόμη» — κατάσταση που ο
 * resolver θα δείξει ως κενή· το δεύτερο είναι γραμμή που δεν συμμετέχει καθόλου στο δέσιμο.
 * Χωρίς τη διάκριση, το «καθάρισε» θα ήταν αδύνατο να εκφραστεί.
 */
export type TableRowLinkPatchMap = ReadonlyMap<TableRowId, TableRowLink | null>;

/**
 * Εφαρμόζει **όλα** τα patches σε ένα πέρασμα και επιστρέφει νέο μοντέλο.
 *
 * Μαζικά, για τον ίδιο λόγο με τις ακμές: η εντολή «ανάθεσε την επιλογή στις επιλεγμένες
 * γραμμές» αγγίζει Ν γραμμές, και ένας εγγραφέας-ενός-δεσμού θα ξανάχτιζε και θα ξανα-
 * ταξινομούσε την ακολουθία Ν φορές, ενώ ο καλών θα χρειαζόταν **δική του** γνώση της σειράς
 * για να παρεμβάλει.
 *
 * ## 🔴 Η εγγύηση by-reference δεν είναι βελτιστοποίηση
 * Όταν κανένα patch δεν αλλάζει τιμή (σύγκριση με {@link sameRowLink}) επιστρέφεται το **ίδιο**
 * αντικείμενο. Η αλυσίδα `PersistedTableModel → RESOLVED_MODEL_CACHE → TableModel →
 * LAYOUT_CACHE` κλειδώνει σε **ταυτότητα αντικειμένου**.
 */
export function setTableRowLinks(
  model: PersistedTableModel,
  patches: TableRowLinkPatchMap,
): PersistedTableModel {
  if (patches.size === 0) return model;

  const index = new Map<TableRowId, TableRowLink>(buildTableRowLinkIndex(model.rowLinks));
  let changed = false;

  for (const [rowId, link] of patches) {
    if (link === null) {
      if (index.delete(rowId)) changed = true;
      continue;
    }
    const current = index.get(rowId);
    if (current !== undefined && sameRowLink(current, link)) continue;
    index.set(rowId, link);
    changed = true;
  }
  if (!changed) return model;

  // Άδειο ⇒ `undefined`, ποτέ `[]`: το `JSON.stringify` πετά τα `undefined` πεδία, οπότε ο
  // πίνακας που έμεινε χωρίς δεσμούς ξαναγράφει **byte-ταυτόσημο** JSON με πριν.
  const rowLinks = toPersistedTableRowLinks(model, index);
  return { ...model, rowLinks: rowLinks.length > 0 ? rowLinks : undefined };
}

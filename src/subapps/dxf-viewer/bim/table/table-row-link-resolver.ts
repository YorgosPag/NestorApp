/**
 * ADR-739 Επίπεδο Β — **τι βρίσκει ο δεσμός στη σκηνή, τώρα**.
 *
 * Καθαρή συνάρτηση: παίρνει τον δεσμό και τις οντότητες, επιστρέφει **ρητή κατάσταση**.
 * Μηδέν store, μηδέν React, μηδέν three — ώστε η απάντηση να είναι δοκιμάσιμη χωρίς σκηνή
 * και να μην μπορεί ποτέ να διαφέρει ανάμεσα στον τονισμό, στο UI και στην εξαγωγή.
 *
 * ## 🔑 Καμία νέα μηχανή ερωτημάτων
 * Ο κλάδος του κριτηρίου **καλεί** το `applyScheduleFilters` του ADR-363 — 5 συνθετοί άξονες
 * με λογικό ΚΑΙ, ήδη γραμμένοι και τεσταρισμένοι. Δεύτερη γλώσσα ερωτημάτων εδώ θα ήταν
 * δεύτερο λεξιλόγιο με μεταφραστές παντού (η παγίδα «2 λεξιλόγια ρόλων» του ADR-694).
 *
 * ## 🔴 Γιατί ΠΕΝΤΕ ρητές καταστάσεις και όχι «βρήκε / δεν βρήκε»
 * Οι τέσσερις τρόποι να μη βρει κανείς τίποτα **δεν είναι ο ίδιος**, και ο χρήστης πρέπει να
 * τους ξεχωρίζει: «δεν έδεσα ακόμη» ≠ «τα έσβησαν όλα» ≠ «το κριτήριο δεν πιάνει τίποτα σε
 * αυτόν τον όροφο» ≠ «το κριτήριο είναι άδειο, άρα δεν ρωτά τίποτα». Μια δυαδική απάντηση θα
 * τα ισοπέδωνε σε «κενό», και ο χρήστης θα έψαχνε σφάλμα εκεί που δεν υπάρχει — ή, χειρότερα,
 * δεν θα έψαχνε εκεί που υπάρχει. Ίδια αρχή με τις ρητές καταστάσεις του CHECK 3.35: **καμία
 * σιωπηλή απόρριψη**.
 *
 * @module subapps/dxf-viewer/bim/table/table-row-link-resolver
 * @see bim/schedule/filters.ts — ο ΥΠΑΡΧΩΝ εκτελεστής του κριτηρίου
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §7 επίπεδο Β
 */

import { applyScheduleFilters } from '../schedule/filters';
import type { FilterableBimEntity } from '../schedule/filters';
import type { ScheduleFilterCriteria } from '../schedule/types';
import type { TableRowLink } from '../../types/table-row-link';

/**
 * Πώς στέκεται ο δεσμός **αυτή τη στιγμή**, απέναντι σε **αυτή** τη σκηνή.
 *
 * - `resolved`     — δείχνει σε οντότητες που υπάρχουν όλες.
 * - `partial`      — 🔴 μερικές ταυτότητες δεν υπάρχουν πια. Το Navisworks το καταγράφει σε
 *   **στήλη κατάστασης** και ζητά από τον χρήστη να δεχθεί ή να απορρίψει — δεν διορθώνει
 *   μόνο του. Το ίδιο κάνουμε: **δείχνουμε**, δεν σβήνουμε.
 * - `orphan`       — καμία από τις ταυτότητες δεν υπάρχει πια, αλλά ο δεσμός ζητούσε κάτι.
 * - `empty`        — ο δεσμός είναι έγκυρος και ρητά δεν βρίσκει τίποτα: λίστα χωρίς
 *   ταυτότητες («δεν έδεσα ακόμη»), ή κριτήριο που δεν ταιριάζει σε καμία οντότητα.
 * - `unresolvable` — 🔴 κριτήριο **χωρίς κανέναν ορισμένο άξονα**. Δες {@link isAskingSomething}.
 */
export type TableRowLinkStatus = 'resolved' | 'partial' | 'orphan' | 'empty' | 'unresolvable';

export interface TableRowLinkResolution {
  readonly status: TableRowLinkStatus;
  /** Οι ταυτότητες που **υπάρχουν** — ό,τι επιτρέπεται να τονιστεί στο 3Δ. */
  readonly entityIds: readonly string[];
  /**
   * Οι ταυτότητες που ζητήθηκαν και **δεν βρέθηκαν**. Μόνο ο κλάδος της ρητής λίστας τις
   * γεννά: ένα κριτήριο που δεν πιάνει τίποτα δεν έχει «χαμένες» ταυτότητες — δεν ζήτησε
   * ποτέ συγκεκριμένες.
   */
  readonly missingIds: readonly string[];
}

/**
 * 🔴 **Ρωτά κάτι αυτό το κριτήριο;**
 *
 * Η επικίνδυνη λεπτομέρεια: στο `passesAllFilters` κάθε άξονας `undefined` είναι
 * **pass-through**. Άρα κριτήριο `{}` δεν σημαίνει «τίποτα» — σημαίνει **«τα πάντα»**. Μια
 * γραμμή με κενό κριτήριο θα τόνιζε **ολόκληρο το κτίριο** και θα ανέφερε ποσότητες που
 * κανείς δεν ζήτησε· και επειδή το αποτέλεσμα θα ήταν μια απολύτως νόμιμη, γεμάτη λίστα,
 * **καμία πύλη δεν θα το έπιανε**.
 *
 * Δεν «διορθώνεται» γυρίζοντας κενή λίστα — αυτό θα ήταν η δεύτερη σιωπηλή απάντηση στο ίδιο
 * ερώτημα. Ονομάζεται: `unresolvable`.
 *
 * ⚠️ Ο έλεγχος είναι **δομικός** (υπάρχει έστω ένας ορισμένος άξονας;), όχι απαρίθμηση των
 * πέντε ονομάτων. Απαρίθμηση εδώ θα ξεχνούσε τον έκτο άξονα την ημέρα που θα προστίθετο, και
 * η αστοχία θα ήταν πάλι «σιωπηλά τα πάντα».
 */
function isAskingSomething(criteria: ScheduleFilterCriteria): boolean {
  return Object.values(criteria).some((axis) => axis !== undefined);
}

/**
 * Ο δεσμός → τι δείχνει τώρα.
 *
 * @param entities οι υποψήφιες οντότητες της σκηνής. Ο καλών τις δίνει· ο resolver δεν
 *   διαβάζει store, ώστε η ίδια ερώτηση να έχει την ίδια απάντηση σε τονισμό, UI και εξαγωγή.
 */
export function resolveTableRowLink(
  link: TableRowLink,
  entities: readonly FilterableBimEntity[],
): TableRowLinkResolution {
  if (link.target.kind === 'query') {
    if (!isAskingSomething(link.target.criteria)) {
      return { status: 'unresolvable', entityIds: [], missingIds: [] };
    }
    const matched = applyScheduleFilters(entities, link.target.criteria).map((e) => e.id);
    return {
      status: matched.length > 0 ? 'resolved' : 'empty',
      entityIds: matched,
      missingIds: [],
    };
  }

  const requested = link.target.entityIds;
  if (requested.length === 0) {
    return { status: 'empty', entityIds: [], missingIds: [] };
  }

  const alive = new Set(entities.map((e) => e.id));
  const entityIds: string[] = [];
  const missingIds: string[] = [];
  // Η σειρά διατηρείται: είναι η σειρά επιλογής του χρήστη, και θα είναι η σειρά που τα
  // δείχνει το UI (δες τη σημείωση σειράς στο `sameRowLink`).
  for (const id of requested) {
    if (alive.has(id)) entityIds.push(id);
    else missingIds.push(id);
  }

  if (missingIds.length === 0) return { status: 'resolved', entityIds, missingIds };
  if (entityIds.length === 0) return { status: 'orphan', entityIds, missingIds };
  return { status: 'partial', entityIds, missingIds };
}

/**
 * Χρειάζεται προσοχή του χρήστη;
 *
 * Ζει εδώ ώστε ο κανόνας «τι θεωρείται πρόβλημα» να μην ξαναγραφτεί ελαφρώς διαφορετικά στον
 * ζωγράφο, στο πάνελ και στην εξαγωγή — τρεις καταναλωτές, μία απάντηση.
 *
 * Το `empty` **δεν** είναι πρόβλημα: γραμμή που δεν έδεσε ακόμη είναι φυσιολογικό ενδιάμεσο
 * στάδιο, και ένα προειδοποιητικό σήμα εκεί θα ήταν θόρυβος σε κάθε νέο πίνακα — δηλαδή ο
 * γρηγορότερος δρόμος να μάθει ο χρήστης να αγνοεί το σήμα.
 */
export function needsAttention(status: TableRowLinkStatus): boolean {
  return status === 'partial' || status === 'orphan' || status === 'unresolvable';
}

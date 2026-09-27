/**
 * @fileoverview **Η ΑΝΑΙΡΕΣΗ ΜΙΑΣ ΑΛΛΑΓΗΣ ΤΟΥ ΓΡΑΦΟΥ** — οι εντολές που επαναφέρουν τον γράφο όπως ήταν **πριν** (ADR-884
 * Φ2δ · §4.10). Καθαρό.
 * @related `tour-graph-edit.ts` (`TourGraphCommand` — οι ίδιες εντολές, ο ίδιος γραφέας) ·
 *   `components/spatial-tour/editor/useTourEditor.ts` (η «Αναίρεση» της ειδοποίησης, πρότυπο Gmail)
 * @module lib/spatial-tour/tour-graph-inverse
 *
 * 🔑 **Αναίρεση = νέα εντολή μέσα από τον ΕΝΑ γραφέα**, όχι στοίβα καταστάσεων: ο διακομιστής ξανακρίνει (υπεύθυνος,
 * αναλλοίωτα, όριο), και η αναίρεση επιβιώνει ανανέωση σελίδας. Καμία δεύτερη πόρτα προς τον γράφο.
 * 🔑 **Ό,τι δεν αντιστρέφεται πιστά, δεν προσφέρει αναίρεση** (`null`): η αφαίρεση της τελευταίας λήψης ενός σημείου
 * σβήνει το σημείο **και** τους συνδέσμους του — μια «ξανατοποθέτηση» θα γεννούσε **άλλο** σημείο χωρίς βελάκια. Εκεί η
 * οθόνη ζητά **επιβεβαίωση πριν**, όχι αναίρεση μετά.
 */

import type { SpatialTour, TourLink } from '@/types/spatial-tour';

import type { TourGraphCommand } from './tour-graph-edit';

type Graph = Pick<SpatialTour, 'nodes'>;

function linkOf(graph: Graph, from: string, to: string): TourLink | null {
  return graph.nodes.find((node) => node.id === from)?.links.find((link) => link.toNodeId === to) ?? null;
}

/** Επαναφορά ενός ζεύγους όπως ήταν: και τα δύο βελάκια, ή κανένας σύνδεσμος. */
function restorePair(graph: Graph, a: string, b: string): readonly TourGraphCommand[] {
  const ab = linkOf(graph, a, b);
  const ba = linkOf(graph, b, a);
  if (ab === null && ba === null) return [{ op: 'unlink', fromNodeId: a, toNodeId: b }];
  // Ο γράφος είναι αμφίδρομος (`linkBoth`): το πρώτο `link` ξαναφτιάχνει και τις δύο κατευθύνσεις, το δεύτερο
  // ξαναβάζει το βελάκι της επιστροφής — ποτέ δεν μαντεύεται (§4.10).
  const commands: TourGraphCommand[] = [{ op: 'link', fromNodeId: a, toNodeId: b, bearingRad: ab?.bearingRad ?? null }];
  if (ba?.bearingRad !== null && ba?.bearingRad !== undefined) {
    commands.push({ op: 'link', fromNodeId: b, toNodeId: a, bearingRad: ba.bearingRad });
  }
  return commands;
}

/**
 * **Οι εντολές που ακυρώνουν το `command`**, δεδομένου του γράφου **πριν** εκτελεστεί — `null` όταν δεν υπάρχει πιστή
 * αντιστροφή (αφαίρεση λήψης). Κενός πίνακας δεν επιστρέφεται ποτέ: «τίποτα να αναιρεθεί» είναι ευθύνη του καλούντος
 * (απάντηση `changed: false`).
 */
export function inverseOf(command: TourGraphCommand, before: Graph): readonly TourGraphCommand[] | null {
  switch (command.op) {
    case 'place': return [{ op: 'unplace', captureId: command.captureId }];
    case 'unplace': return null;
    case 'link':
    case 'unlink': return restorePair(before, command.fromNodeId, command.toNodeId);
  }
}

/**
 * @fileoverview **Η ΑΙΣΙΟΔΟΞΗ ΕΙΚΟΝΑ ΤΟΥ ΕΠΕΞΕΡΓΑΣΤΗ** — τι δείχνει η οθόνη **πριν** απαντήσει ο διακομιστής, για κάθε εντολή
 * του γράφου (ADR-884 Φ2δ · §4.10 · Φ2στ-γ Γ3γ-1 · §4.14). Καθαρό.
 * @related `tour-graph-edit.ts` · `tour-plan-edit.ts` · `tour-space-edit.ts` (οι **ΙΔΙΕΣ** καθαρές συναρτήσεις με τον γραφέα) ·
 *   `components/spatial-tour/editor/useTourEditorActions.ts` (ο ΕΝΑΣ καλών)
 * @module lib/spatial-tour/tour-editor-optimistic
 *
 * 🔑 **Μία αλήθεια, δύο εκτελέσεις** (πρότυπο Figma/Linear): ο πελάτης τρέχει τον **ίδιο** κώδικα με τον διακομιστή — άρα και
 *   την κρίση επικάλυψης χώρων (`polygonsOverlap`). Άρνηση εδώ ⇒ καμία αισιόδοξη εικόνα· ο διακομιστής ξανακρίνει **πάντα**.
 * 🔑 **Νέος χώρος / νέα γραμμή ΔΕΝ είναι αισιόδοξα**: το id το κόβει ο διακομιστής (N.6) — ένα προσωρινό id εδώ θα ήταν δεύτερη
 *   ταυτότητα για το ίδιο σχήμα. Ομοίως τοποθέτηση · αφαίρεση · κάτοψη · κλίμακα (εικόνα/ξανακλιμάκωση του διακομιστή).
 */

import type { SpatialTour, TourCapture } from '@/types/spatial-tour';

import { linkNodes, nameNode, unlinkNodes, type TourGraphCommand, type TourGraphEditResult } from './tour-graph-edit';
import { orientNode, positionNode, type TourEditStamp } from './tour-plan-edit';
import { removeSeparation, removeSpace, upsertSeparation, upsertSpace } from './tour-space-edit';

type Graph = Pick<SpatialTour, 'levels' | 'nodes'>;
export type OptimisticCaptureOf = (captureId: string) => Pick<TourCapture, 'headingRad' | 'nodeId'> | undefined;

/** Η σφραγίδα της αισιόδοξης εικόνας — κενή: το «ποιος/πότε» το γράφει ο διακομιστής, και η οθόνη δεν το δείχνει. */
const SCREEN_STAMP: TourEditStamp = { uid: '', at: '' };

function orientResult(graph: Graph, command: Extract<TourGraphCommand, { op: 'orient' }>, captureOf: OptimisticCaptureOf) {
  const capture = captureOf(command.captureId);
  if (capture === undefined || capture.nodeId === null) return null;
  return orientNode(graph, capture.nodeId, command.headingRad - capture.headingRad);
}

/** Σχήματα: μόνο αλλαγή/αφαίρεση **υπάρχοντος** — νέο (`id === null`) ⇒ `null`. */
function shapeResult(graph: Graph, command: TourGraphCommand): TourGraphEditResult | null {
  switch (command.op) {
    case 'space':
      return command.spaceId === null ? null : upsertSpace(graph, command, command.spaceId, SCREEN_STAMP);
    case 'unspace':
      return removeSpace(graph, command.levelKey, command.spaceId);
    case 'separate':
      return command.separationId === null ? null : upsertSeparation(graph, command, command.separationId, SCREEN_STAMP);
    case 'unseparate':
      return removeSeparation(graph, command.levelKey, command.separationId);
    default:
      return null;
  }
}

function resultOf(command: TourGraphCommand, graph: Graph, captureOf: OptimisticCaptureOf): TourGraphEditResult | null {
  switch (command.op) {
    case 'link': return linkNodes(graph, command.fromNodeId, command.toNodeId, command.bearingRad);
    case 'unlink': return unlinkNodes(graph, command.fromNodeId, command.toNodeId);
    case 'name': return nameNode(graph, command.nodeId, command.room);
    case 'position': return positionNode(graph, command.nodeId, command.point);
    case 'orient': return orientResult(graph, command, captureOf);
    default: return shapeResult(graph, command);
  }
}

/**
 * **Η αισιόδοξη εικόνα μιας εντολής** — ο γράφος όπως θα είναι αν ο διακομιστής συμφωνήσει, ή `null` για ό,τι δεν εφαρμόζεται
 * αισιόδοξα (κλειδωμένες εντολές, άρνηση του ίδιου κριτή, ή «καμία αλλαγή»).
 */
export function optimisticGraph(command: TourGraphCommand, graph: Graph, captureOf: OptimisticCaptureOf): Graph | null {
  const result = resultOf(command, graph, captureOf);
  return result?.kind === 'edited' ? result.graph : null;
}

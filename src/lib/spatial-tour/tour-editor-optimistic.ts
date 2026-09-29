/**
 * @fileoverview **Η ΑΙΣΙΟΔΟΞΗ ΕΙΚΟΝΑ ΤΟΥ ΕΠΕΞΕΡΓΑΣΤΗ** — τι δείχνει η οθόνη **πριν** απαντήσει ο διακομιστής, για κάθε εντολή
 * του γράφου (ADR-884 Φ2δ · §4.10 · Φ2στ-γ Γ3γ-1 · §4.14). Καθαρό.
 * @related `tour-graph-edit.ts` · `tour-plan-edit.ts` · `tour-space-edit.ts` (οι **ΙΔΙΕΣ** καθαρές συναρτήσεις με τον γραφέα) ·
 *   `components/spatial-tour/editor/useTourEditorActions.ts` (ο ΕΝΑΣ καλών)
 * @module lib/spatial-tour/tour-editor-optimistic
 *
 * 🔑 **Μία αλήθεια, δύο εκτελέσεις** (πρότυπο Figma/Linear): ο πελάτης τρέχει τον **ίδιο** κώδικα με τον διακομιστή — άρα και
 *   την κρίση επικάλυψης χώρων (`polygonsOverlap`). Άρνηση εδώ ⇒ καμία αισιόδοξη εικόνα· ο διακομιστής ξανακρίνει **πάντα**.
 * 🔑 **Και ο ΝΕΟΣ χώρος / η νέα γραμμή είναι αισιόδοξα** (Γ3γ-2α): το **οριστικό** id το κόβει ο πελάτης (Figma/Linear, N.6 μέσω
 *   `enterpriseIdService`) — καμία προσωρινή ταυτότητα, καμία αναμονή. **Μη** αισιόδοξα μένουν τοποθέτηση · αφαίρεση · κάτοψη ·
 *   κλίμακα (εικόνα/ξανακλιμάκωση/νέο σημείο του διακομιστή).
 */

import type { SpatialTour, TourCapture } from '@/types/spatial-tour';

import {
  linkNodes,
  nameNode,
  unlinkNodes,
  type TourGraphCommand,
  type TourGraphEditRefusal,
  type TourGraphEditResult,
} from './tour-graph-edit';
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

/** Σχήματα: δημιουργία, αλλαγή και αφαίρεση — με τον ΙΔΙΟ κριτή (και επικάλυψης) που θα τρέξει ο διακομιστής. */
function shapeResult(graph: Graph, command: TourGraphCommand): TourGraphEditResult | null {
  switch (command.op) {
    case 'space':
      return upsertSpace(graph, command, SCREEN_STAMP);
    case 'unspace':
      return removeSpace(graph, command.levelKey, command.spaceId);
    case 'separate':
      return upsertSeparation(graph, command, SCREEN_STAMP);
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

/**
 * **Η κρίση του γραφέα ΠΡΙΝ σταλεί** (Γ3γ-2β · Δ9.6) — ο **ίδιος** κριτής σχημάτων με την αισιόδοξη εικόνα και τον διακομιστή. Η
 * οθόνη δεν προσφέρει ποτέ «Έγκριση» για σχήμα που θα απορριφθεί, και λέει **γιατί**. `null` ⇒ θα γίνει δεκτό (ή δεν αλλάζει
 * τίποτα). Μόνο εντολές σχημάτων — οι άλλες δεν προκρίνονται εδώ.
 */
export function judgeShapeCommand(command: TourGraphCommand, graph: Graph): TourGraphEditRefusal | null {
  const result = shapeResult(graph, command);
  return result?.kind === 'refused' ? result.reason : null;
}

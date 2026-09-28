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

import { isFloorPlanDeclarableSource } from '@/constants/spatial-tour-vocabulary';
import type { SpatialTour, TourLevelKey, TourLink } from '@/types/spatial-tour';

import { levelKeyId } from './spatial-tour-graph';
import type { TourGraphCommand } from './tour-graph-edit';
import { activeFloorPlan } from './tour-plan-frame';

type Graph = Pick<SpatialTour, 'nodes'> & Partial<Pick<SpatialTour, 'levels'>>;

/** Ό,τι δεν ζει στον γράφο αλλά χρειάζεται μια αναίρεση — η κατεύθυνση μιας λήψης **πριν** την εντολή `orient`. */
export interface TourInverseContext {
  readonly headingOf?: (captureId: string) => number | undefined;
}

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
export function inverseOf(command: TourGraphCommand, before: Graph, context: TourInverseContext = {}): readonly TourGraphCommand[] | null {
  switch (command.op) {
    case 'place': return [{ op: 'unplace', captureId: command.captureId }];
    case 'unplace': return null;
    case 'link':
    case 'unlink': return restorePair(before, command.fromNodeId, command.toNodeId);
    case 'name': {
      // Επαναφορά του προηγούμενου χώρου — πιστή: ο χώρος είναι ΕΝΑ πεδίο του σημείου.
      const room = before.nodes.find((node) => node.id === command.nodeId)?.room ?? null;
      return [{ op: 'name', nodeId: command.nodeId, room: room === null ? null : { types: room.types, label: room.label } }];
    }
    case 'position': {
      const position = before.nodes.find((node) => node.id === command.nodeId)?.position ?? null;
      return [{ op: 'position', nodeId: command.nodeId, point: position === null ? null : { x: position.x, y: position.y } }];
    }
    case 'calibrate': return restoreCalibration(before, command.levelKey);
    case 'floorplan': return restoreFloorPlan(before, command.levelKey);
    case 'orient': {
      const heading = context.headingOf?.(command.captureId);
      return heading === undefined ? null : [{ op: 'orient', captureId: command.captureId, headingRad: heading }];
    }
  }
}

/** Οι θέσεις του ορόφου όπως ήταν — μία εντολή ανά τοποθετημένο σημείο. */
function restorePositions(before: Graph, key: TourLevelKey): TourGraphCommand[] {
  return before.nodes.flatMap((node) => (levelKeyId(node.levelKey) !== levelKeyId(key) || node.position === null ? [] : [{
    op: 'position' as const, nodeId: node.id, point: { x: node.position.x, y: node.position.y },
  }]));
}

function scaleBefore(before: Graph, key: TourLevelKey): number | null | undefined {
  const level = before.levels?.find((l) => levelKeyId(l.key) === levelKeyId(key));
  return level === undefined ? undefined : activeFloorPlan(level)?.scale?.metresPerPixel ?? null;
}

/**
 * Η κλίμακα όπως ήταν. Αρκεί **μία** εντολή: η ξανακλιμάκωση είναι αντιστρέψιμη (οι τελείες ξαναγυρίζουν στο ίδιο pixel),
 * και χωρίς προηγούμενη κλίμακα θέσεις δεν υπήρχαν.
 */
function restoreCalibration(before: Graph, key: TourLevelKey): readonly TourGraphCommand[] | null {
  const metresPerPixel = scaleBefore(before, key);
  return metresPerPixel === undefined ? null : [{ op: 'calibrate', levelKey: key, metresPerPixel }];
}

/**
 * Η κάτοψη όπως ήταν, **με** την κλίμακα και τις θέσεις της (η αλλαγή κάτοψης τις έσβησε). Κάτοψη που δεν τη διαλέγει
 * άνθρωπος (σάρωση · εκτίμηση) δεν ξαναδιαλέγεται από φόρμα ⇒ καμία πιστή αναίρεση (`null`).
 */
function restoreFloorPlan(before: Graph, key: TourLevelKey): readonly TourGraphCommand[] | null {
  const level = before.levels?.find((l) => levelKeyId(l.key) === levelKeyId(key));
  const active = level === undefined ? null : activeFloorPlan(level);
  if (active === null) return null;
  if (active.source === 'none' || active.fileId === null) return [{ op: 'floorplan', levelKey: key, plan: null }];
  if (!isFloorPlanDeclarableSource(active.source)) return null;
  const commands: TourGraphCommand[] = [{ op: 'floorplan', levelKey: key, plan: { fileId: active.fileId, source: active.source } }];
  if (active.scale != null) commands.push({ op: 'calibrate', levelKey: key, metresPerPixel: active.scale.metresPerPixel });
  return [...commands, ...restorePositions(before, key)];
}

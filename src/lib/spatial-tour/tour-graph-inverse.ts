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
 * 🔑 **Χώροι και νοητές γραμμές (Γ3γ-2α)**: το id το κόβει ο πελάτης, άρα κάθε αναίρεση είναι **πιστή στο ίδιο id** και γνωστή
 * **πριν** απαντήσει ο διακομιστής: δημιουργία ⇒ αφαίρεση του ίδιου id · αλλαγή ⇒ το προηγούμενο σχήμα · αφαίρεση ⇒
 * ξαναγέννηση (`create`) με το **ίδιο** id — ό,τι δείχνει σε αυτό (επιλογή, ιστορικό) μένει αληθινό.
 */

import { isFloorPlanDeclarableSource } from '@/constants/spatial-tour-vocabulary';
import type { SpatialTour, TourLevel, TourLevelKey, TourLink, TourSeparationLine, TourSpaceOutline } from '@/types/spatial-tour';

import { findTourLevel, levelKeyId } from './spatial-tour-graph';
import type { TourGraphCommand, TourSpaceDraft } from './tour-graph-edit';
import { activeFloorPlan } from './tour-plan-frame';

type Graph = Pick<SpatialTour, 'nodes'> & Partial<Pick<SpatialTour, 'levels'>>;

/** Ό,τι δεν ζει στον γράφο αλλά χρειάζεται μια αναίρεση. */
export interface TourInverseContext {
  /** Η κατεύθυνση μιας λήψης **πριν** την εντολή `orient`. */
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
    case 'calibrate': return restoreCalibration(before, command.levelKey, command.metresPerPixel);
    case 'floorplan': return restoreFloorPlan(before, command.levelKey);
    case 'orient': {
      const heading = context.headingOf?.(command.captureId);
      return heading === undefined ? null : [{ op: 'orient', captureId: command.captureId, headingRad: heading }];
    }
    case 'space':
    case 'unspace': return inverseOfSpace(command, before);
    case 'separate':
    case 'unseparate': return inverseOfSeparation(command, before);
  }
}

// ── Χώροι και νοητές γραμμές (Γ3β) ─────────────────────────────────────────

/** Ο χώρος ως εντολή της οθόνης — ό,τι χρειάζεται για να ξαναγεννηθεί ίδιος. */
function draftOf(space: TourSpaceOutline): TourSpaceDraft {
  return {
    points: space.points.map((p) => ({ x: p.x, y: p.y })),
    source: space.source,
    room: space.room == null ? null : { types: space.room.types, label: space.room.label },
    declaredArea: space.declaredArea == null ? null : { areaM2: space.declaredArea.areaM2, source: space.declaredArea.source },
  };
}

const levelOf = (before: Graph, key: TourLevelKey): TourLevel | undefined => findTourLevel(before.levels, key);

function inverseOfSpace(
  command: Extract<TourGraphCommand, { op: 'space' | 'unspace' }>,
  before: Graph,
): readonly TourGraphCommand[] | null {
  const { levelKey, spaceId } = command;
  const previous = levelOf(before, levelKey)?.spaces?.find((space) => space.id === spaceId);
  // Δεν υπήρχε ⇒ η εντολή τον γέννησε: αναίρεση = αφαίρεση του ΙΔΙΟΥ id (αφαίρεση ανύπαρκτου = τίποτα να αναιρεθεί).
  if (previous === undefined) return command.op === 'space' ? [{ op: 'unspace', levelKey, spaceId }] : null;
  // Αλλαγή ⇒ το προηγούμενο σχήμα· αφαίρεση ⇒ ξαναγέννηση — και τα δύο στο ΙΔΙΟ id.
  return [{ op: 'space', levelKey, spaceId, mode: command.op === 'space' ? 'replace' : 'create', space: draftOf(previous) }];
}

function inverseOfSeparation(
  command: Extract<TourGraphCommand, { op: 'separate' | 'unseparate' }>,
  before: Graph,
): readonly TourGraphCommand[] | null {
  const { levelKey, separationId } = command;
  const previous = levelOf(before, levelKey)?.separations?.find((line) => line.id === separationId);
  if (previous === undefined) return command.op === 'separate' ? [{ op: 'unseparate', levelKey, separationId }] : null;
  const mode = command.op === 'separate' ? 'replace' : 'create';
  return [{ op: 'separate', levelKey, separationId, mode, a: xy(previous.a), b: xy(previous.b) }];
}

const xy = (p: TourSeparationLine['a']) => ({ x: p.x, y: p.y });

/** Οι χώροι και οι γραμμές του ορόφου όπως ήταν — ξαναγεννιούνται (μια αλλαγή κάτοψης/κλίμακας τα έσβησε). */
function restoreShapes(level: TourLevel | undefined): TourGraphCommand[] {
  if (level === undefined) return [];
  // Στα ΙΔΙΑ id (Γ3γ-2α): η επαναφορά είναι ό,τι ήταν, όχι αντίγραφό του.
  const spaces = (level.spaces ?? []).map((space): TourGraphCommand => ({
    op: 'space', levelKey: level.key, spaceId: space.id, mode: 'create', space: draftOf(space),
  }));
  const lines = (level.separations ?? []).map((line): TourGraphCommand => ({
    op: 'separate', levelKey: level.key, separationId: line.id, mode: 'create', a: xy(line.a), b: xy(line.b),
  }));
  return [...lines, ...spaces];
}

// ── Η κάτοψη ─────────────────────────────────────────────────────────────────

/** Οι θέσεις του ορόφου όπως ήταν — μία εντολή ανά τοποθετημένο σημείο. */
function restorePositions(before: Graph, key: TourLevelKey): TourGraphCommand[] {
  return before.nodes.flatMap((node) => (levelKeyId(node.levelKey) !== levelKeyId(key) || node.position === null ? [] : [{
    op: 'position' as const, nodeId: node.id, point: { x: node.position.x, y: node.position.y },
  }]));
}

function scaleBefore(before: Graph, key: TourLevelKey): number | null | undefined {
  const level = levelOf(before, key);
  return level === undefined ? undefined : activeFloorPlan(level)?.scale?.metresPerPixel ?? null;
}

/**
 * Η κλίμακα όπως ήταν. Νέα κλίμακα πάνω σε παλιά: αρκεί **μία** εντολή (η ξανακλιμάκωση αντιστρέφεται — θέσεις και σχήματα
 * ξαναγυρίζουν στο ίδιο pixel)· χωρίς προηγούμενη κλίμακα θέσεις δεν υπήρχαν. 🔴 Όμως **σβήσιμο** της κλίμακας (X → `null`)
 * σβήνει θέσεις και σχήματα ⇒ η αναίρεση τα ξαναβάζει (ως τη Γ3β εδώ επέστρεφε μόνο την κλίμακα — οι θέσεις χάνονταν).
 */
function restoreCalibration(before: Graph, key: TourLevelKey, after: number | null): readonly TourGraphCommand[] | null {
  const metresPerPixel = scaleBefore(before, key);
  if (metresPerPixel === undefined) return null;
  const commands: TourGraphCommand[] = [{ op: 'calibrate', levelKey: key, metresPerPixel }];
  if (after !== null || metresPerPixel === null) return commands;
  return [...commands, ...restorePositions(before, key), ...restoreShapes(levelOf(before, key))];
}

/**
 * Η κάτοψη όπως ήταν, **με** την κλίμακα, τις θέσεις και τα σχήματά της (η αλλαγή κάτοψης τα έσβησε). Κάτοψη που δεν τη
 * διαλέγει άνθρωπος (σάρωση · εκτίμηση) δεν ξαναδιαλέγεται από φόρμα ⇒ καμία πιστή αναίρεση (`null`).
 */
function restoreFloorPlan(before: Graph, key: TourLevelKey): readonly TourGraphCommand[] | null {
  const level = levelOf(before, key);
  const active = level === undefined ? null : activeFloorPlan(level);
  if (active === null) return null;
  if (active.source === 'none' || active.fileId === null) return [{ op: 'floorplan', levelKey: key, plan: null }];
  if (!isFloorPlanDeclarableSource(active.source)) return null;
  const commands: TourGraphCommand[] = [{ op: 'floorplan', levelKey: key, plan: { fileId: active.fileId, source: active.source } }];
  if (active.scale != null) commands.push({ op: 'calibrate', levelKey: key, metresPerPixel: active.scale.metresPerPixel });
  return [...commands, ...restorePositions(before, key), ...restoreShapes(level)];
}

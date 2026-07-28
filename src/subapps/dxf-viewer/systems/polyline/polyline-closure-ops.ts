/**
 * POLYLINE CLOSURE OPS — ADR-718 §Β (pure SSoT: «τι επιτρέπεται» + «ποιος command»)
 *
 * Το `PEDIT → Close / Open` του AutoCAD φτάνει στον χρήστη από **δύο** χειρονομίες:
 *
 *   1. **Δεξί κλικ σε επιλεγμένη πολυγραμμή** → «Κλείσιμο / Άνοιγμα πολυγραμμής»
 *      (`EntityContextMenu`, μέσω `usePolylineClosureCommands`) — η εντολή σε επίπεδο οντότητας.
 *   2. **Δεξί κλικ σε λαβή μέσου ακμής** → «Άνοιγμα εδώ» (`GripContextMenu`, μέσω
 *      `buildPolylineVertexOpCommand`) — η ίδια εντολή, αλλά με **ακμή**.
 *
 * Οι δύο χειρονομίες μοιράζονται **αυτό** το αρχείο: ένα κατηγόρημα ανά ερώτηση, ένας builder.
 * Χωρίς αυτό θα υπήρχαν δύο αντίγραφα του «είναι κλειστή και έχει ≥3 κορυφές;» — και το πρώτο
 * που θα διορθωνόταν θα άφηνε το άλλο να προσφέρει μια εντολή που ο command αρνείται (η κλασική
 * απόκλιση pick-tool ↔ builder που το `topo-boundary-pick` περιγράφει στον σχολιασμό του).
 *
 * **Γιατί η ακμή έρχεται από λαβή και όχι από hit-test του δεξιού κλικ:** η λαβή μέσου ακμής
 * **είναι** η ακμή — ορατή πριν το κλικ, χωρίς ανοχή, χωρίς αμφισημία, και ο δείκτης της
 * ταυτίζεται ήδη με το `edgeIndex` (`grip-computation-producers.buildPolylineGrips`: σε κλειστή
 * πολυγραμμή παράγονται **N** λαβές ακμών, άρα **και η ακμή κλεισίματος**). Ένα κρυφό
 * «δεξί κλικ κάπου κοντά σε ακμή» θα ήταν και λιγότερο προβλέψιμο και νέος μηχανισμός.
 *
 * @see core/commands/entity-commands/SetPolylineClosureCommand — ο ΕΝΑΣ undoable command
 * @see systems/grip/polyline-grip-ops — η grip διαδρομή (op `'open-at-edge'`)
 * @see hooks/canvas/usePolylineClosureCommands — η διαδρομή του μενού οντότητας
 */

import type { Entity } from '../../types/entities';
import { isPolylineEntity, isLWPolylineEntity } from '../../types/entities';
import type { ICommand, ISceneManager } from '../../core/commands/interfaces';
import {
  SetPolylineClosureCommand,
  type PolylineClosureOp,
} from '../../core/commands/entity-commands/SetPolylineClosureCommand';

/**
 * Το ελάχιστο πλήθος κορυφών που κάνει έναν δακτύλιο **περιοχή**. Κάτω από αυτό το «κλειστό»
 * είναι ένα τμήμα διπλωμένο στον εαυτό του: μηδέν εσωτερικό, μηδέν εμβαδόν, και κάθε
 * καταναλωτής του `closed` (όριο οικοπέδου, εμβαδόν, γραμμοσκίαση) θα διάβαζε ψέμα.
 */
const MIN_RING_VERTICES = 3;

/** Πολυγραμμή (`polyline` ή `lwpolyline`) με τουλάχιστον τρεις κορυφές — αλλιώς `null`. */
function ringOf(entity: Entity | null | undefined): { closed: boolean; vertexCount: number } | null {
  if (!entity) return null;
  if (!isPolylineEntity(entity) && !isLWPolylineEntity(entity)) return null;
  if (entity.vertices.length < MIN_RING_VERTICES) return null;
  return { closed: entity.closed === true, vertexCount: entity.vertices.length };
}

/** Μπορεί να **κλείσει**; (ανοιχτή πολυγραμμή με ≥3 κορυφές) */
export function canClosePolyline(entity: Entity | null | undefined): boolean {
  const ring = ringOf(entity);
  return ring !== null && !ring.closed;
}

/** Μπορεί να **ανοίξει**; (κλειστή πολυγραμμή με ≥3 κορυφές) — ισχύει και για το «Άνοιγμα εδώ». */
export function canOpenPolyline(entity: Entity | null | undefined): boolean {
  const ring = ringOf(entity);
  return ring !== null && ring.closed;
}

/**
 * Ο undoable command για την πράξη, ή `null` όταν η οντότητα δεν τη δέχεται. Καθαρό: ο καλών
 * τρέχει το `history.execute` (ίδια σύμβαση με το {@link buildPolylineVertexOpCommand}).
 */
export function buildPolylineClosureCommand(
  entityId: string,
  op: PolylineClosureOp,
  sceneManager: ISceneManager,
): ICommand | null {
  const entity = sceneManager.getEntity(entityId) as Entity | undefined;
  const allowed = op.kind === 'close' ? canClosePolyline(entity) : canOpenPolyline(entity);
  if (!allowed) return null;
  const command = new SetPolylineClosureCommand({ entityId, op }, sceneManager);
  return command.validate() === null ? command : null;
}

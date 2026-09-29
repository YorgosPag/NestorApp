/**
 * @fileoverview **ΟΙ ΑΛΛΑΓΕΣ ΤΗΣ ΚΑΤΟΨΗΣ** — κάτοψη ορόφου, κλίμακα, θέση σημείου, προσανατολισμός: καθαρές συναρτήσεις που
 * παίρνουν τον γράφο και επιστρέφουν τον νέο, ή ονομασμένη άρνηση (ADR-884 Φ2στ-β · §4.13).
 * @related `tour-graph-edit.ts` (`TourGraphCommand`, `TourGraphEditResult` — ίδιος γραφέας, ίδιο συμβόλαιο) ·
 *   `tour-plan-frame.ts` (pixel ⟷ μέτρα) · `server/spatial-tour/tour-graph-write.ts` (ο ΕΝΑΣ γραφέας)
 * @module lib/spatial-tour/tour-plan-edit
 *
 * 🔑 **Οι τελείες ανήκουν στην ΕΙΚΟΝΑ**: ο άνθρωπος έδειξε ένα pixel της κάτοψης. Άρα (α) αλλαγή κλίμακας ⇒ οι θέσεις του
 *   ορόφου **ξανακλιμακώνονται** (μένουν στο ίδιο pixel) · (β) αλλαγή κάτοψης ⇒ οι θέσεις του ορόφου **σβήνουν** (το pixel
 *   μιας άλλης εικόνας δεν σημαίνει τίποτα) — ρητά, με «Αναίρεση» στην οθόνη (Δ5: «οι κόμβοι ξανατοποθετούνται»). Το ίδιο και
 *   για τα **σχήματα χώρων** και τις νοητές γραμμές του ορόφου (Γ3β — `tour-space-edit.ts`).
 * 🔑 **Καμία θέση χωρίς κλίμακα** (`plan-uncalibrated`): τα «μέτρα» μιας αβαθμονόμητης εικόνας θα ήταν μαντεψιά.
 * 🔑 **Προσανατολισμός = στροφή ΚΑΙ των βελακιών**: ένα βελάκι είναι διόπτευση κόσμου = heading + yaw. Αν αλλάξει το heading
 *   και όχι το βελάκι, το βελάκι **μετακινείται μέσα στη φωτογραφία** — από την πόρτα στον τοίχο. Άρα ίδια Δ και στα δύο.
 */

import type { FloorPlanDeclarableSource } from '@/constants/spatial-tour-vocabulary';
import { normalizeAngleDiff, normalizeAngleRad } from '@/lib/geometry/angle';
import type { FloorPlanImage, FloorPlanRecord, SpatialTour, TourLevel, TourLevelKey, TourNode } from '@/types/spatial-tour';

import { findTourLevel, levelKeyId } from './spatial-tour-graph';
import type { TourGraphEditResult, TourGraphEditRefusal } from './tour-graph-edit';
import { activeFloorPlan, calibratedPlan, isOnPlan, rescalePoint } from './tour-plan-frame';
import { clearLevelShapes, rescaleLevelShapes } from './tour-space-edit';

type Graph = Pick<SpatialTour, 'levels' | 'nodes'>;

/** Ποιος και πότε — τα γράφει ο διακομιστής, ποτέ ο πελάτης. */
export interface TourEditStamp {
  readonly uid: string;
  readonly at: string;
}

/** Η κάτοψη που διάλεξε ο άνθρωπος, **με** την εικόνα που ετοίμασε ο διακομιστής (διαστάσεις + αποτύπωμα). */
export interface FloorPlanChoice {
  readonly fileId: string;
  readonly source: FloorPlanDeclarableSource;
  readonly image: FloorPlanImage;
}

/** Κάτω από αυτό, δύο γωνίες/κλίμακες θεωρούνται ίδιες — ιδεμποτία χωρίς ψεύτικη «αλλαγή» από στρογγύλευση. */
const EPSILON = 1e-9;

const refused = (reason: TourGraphEditRefusal): TourGraphEditResult => ({ kind: 'refused', reason });
const UNCHANGED: TourGraphEditResult = { kind: 'unchanged' };

const onLevel = (node: TourNode, key: TourLevelKey) => levelKeyId(node.levelKey) === levelKeyId(key);

const findLevel = (graph: Graph, key: TourLevelKey): TourLevel | undefined => findTourLevel(graph.levels, key);

/** Ο όροφος με νέες κατόψεις — και τα **σχήματα** του (Γ3β) όπως τα θέλει η αλλαγή (`shapes`). */
function replaceLevel(
  levels: readonly TourLevel[],
  key: TourLevelKey,
  floorPlans: readonly FloorPlanRecord[],
  shapes: (level: TourLevel) => TourLevel,
): TourLevel[] {
  return levels.map((level) => (levelKeyId(level.key) === levelKeyId(key) ? shapes({ ...level, floorPlans }) : level));
}

/** Η ενεργή γίνεται `superseded`, η νέα μπαίνει `active` — η ιστορία δεν σβήνεται ποτέ (Δ5). */
function supersedeWith(level: TourLevel, next: FloorPlanRecord): FloorPlanRecord[] {
  return [...level.floorPlans.map((plan) => (plan.state === 'active' ? { ...plan, state: 'superseded' as const } : plan)), next];
}

function recordOf(choice: FloorPlanChoice | null, stamp: TourEditStamp): FloorPlanRecord {
  if (choice === null) return { source: 'none', state: 'active', fileId: null, approvedBy: null, approvedAt: null };
  return { source: choice.source, state: 'active', fileId: choice.fileId, approvedBy: stamp.uid, approvedAt: stamp.at, image: choice.image };
}

/**
 * **Διάλεξε (ή βγάλε, `null`) την κάτοψη ενός ορόφου.** Ίδιο αρχείο και ίδια πηγή ⇒ `unchanged`. Αλλιώς η προηγούμενη
 * γίνεται `superseded` και οι θέσεις του ορόφου σβήνουν.
 */
export function setLevelFloorPlan(graph: Graph, key: TourLevelKey, choice: FloorPlanChoice | null, stamp: TourEditStamp): TourGraphEditResult {
  const level = findLevel(graph, key);
  if (level === undefined) return refused('level-absent');
  const active = activeFloorPlan(level);
  if (choice === null ? active?.source === 'none' : active?.fileId === choice.fileId && active.source === choice.source) return UNCHANGED;
  const levels = replaceLevel(graph.levels, key, supersedeWith(level, recordOf(choice, stamp)), clearLevelShapes);
  const nodes = graph.nodes.map((node) => (onLevel(node, key) && node.position !== null ? { ...node, position: null } : node));
  return { kind: 'edited', graph: { levels, nodes } };
}

function scaledPlans(level: TourLevel, metresPerPixel: number | null, stamp: TourEditStamp): FloorPlanRecord[] {
  return level.floorPlans.map((plan) => {
    if (plan.state !== 'active') return plan;
    const { scale: _previous, ...rest } = plan;
    return metresPerPixel === null ? rest : { ...rest, scale: { metresPerPixel, calibratedBy: stamp.uid, calibratedAt: stamp.at } };
  });
}

/**
 * **Όρισε (ή σβήσε, `null`) την κλίμακα της ενεργής κάτοψης.** Οι τελείες μένουν στο ίδιο pixel: ξανακλιμακώνονται με
 * τον λόγο των κλιμάκων· χωρίς νέα κλίμακα, σβήνουν (θέση χωρίς κλίμακα δεν υπάρχει).
 */
export function calibrateLevel(graph: Graph, key: TourLevelKey, metresPerPixel: number | null, stamp: TourEditStamp): TourGraphEditResult {
  if (metresPerPixel !== null && !(Number.isFinite(metresPerPixel) && metresPerPixel > 0)) return refused('scale-invalid');
  const level = findLevel(graph, key);
  if (level === undefined) return refused('level-absent');
  const active = activeFloorPlan(level);
  if (active?.image == null) return refused('plan-absent');
  const before = active.scale?.metresPerPixel ?? null;
  if (before === metresPerPixel || (before !== null && metresPerPixel !== null && Math.abs(before - metresPerPixel) < EPSILON)) return UNCHANGED;
  const levels = replaceLevel(graph.levels, key, scaledPlans(level, metresPerPixel, stamp), (l) => rescaleLevelShapes(l, before, metresPerPixel));
  const nodes = graph.nodes.map((node) => {
    if (!onLevel(node, key) || node.position === null) return node;
    const position = before === null || metresPerPixel === null ? null : rescalePoint(node.position, before, metresPerPixel);
    return { ...node, position };
  });
  return { kind: 'edited', graph: { levels, nodes } };
}

/** **Βάλε (ή βγάλε, `null`) ένα σημείο πάνω στην κάτοψη** του ορόφου του — σε μέτρα, από το pixel που έδειξε ο άνθρωπος. */
export function positionNode(graph: Graph, nodeId: string, point: { readonly x: number; readonly y: number } | null): TourGraphEditResult {
  const node = graph.nodes.find((n) => n.id === nodeId);
  if (node === undefined) return refused('node-absent');
  if (point === null) {
    return node.position === null ? UNCHANGED : { kind: 'edited', graph: { levels: graph.levels, nodes: withPosition(graph, nodeId, null) } };
  }
  const level = findLevel(graph, node.levelKey);
  const plan = calibratedPlan(level === undefined ? null : activeFloorPlan(level));
  if (plan === null) return refused('plan-uncalibrated');
  const position = { x: point.x, y: point.y, z: 0 };
  if (!isOnPlan(position, plan)) return refused('position-outside-plan');
  const current = node.position;
  if (current !== null && Math.abs(current.x - position.x) < EPSILON && Math.abs(current.y - position.y) < EPSILON) return UNCHANGED;
  return { kind: 'edited', graph: { levels: graph.levels, nodes: withPosition(graph, nodeId, position) } };
}

function withPosition(graph: Graph, nodeId: string, position: TourNode['position']): TourNode[] {
  return graph.nodes.map((node) => (node.id === nodeId ? { ...node, position } : node));
}

/**
 * **Στρέψε τα βελάκια ενός σημείου κατά `deltaRad`** — το σκέλος γράφου της εντολής `orient` (το heading της λήψης το
 * γράφει ο γραφέας στην ίδια συναλλαγή). Βελάκι χωρίς κατεύθυνση (`null`) μένει χωρίς. Δ ≈ 0 ⇒ `unchanged`.
 */
export function orientNode(graph: Graph, nodeId: string, deltaRad: number): TourGraphEditResult {
  if (!graph.nodes.some((node) => node.id === nodeId)) return refused('node-absent');
  if (Math.abs(normalizeAngleDiff(deltaRad)) < EPSILON) return UNCHANGED;
  const nodes = graph.nodes.map((node) => node.id !== nodeId ? node : {
    ...node,
    links: node.links.map((link) => (link.bearingRad === null ? link : { ...link, bearingRad: normalizeAngleRad(link.bearingRad + deltaRad) })),
  });
  return { kind: 'edited', graph: { levels: graph.levels, nodes } };
}

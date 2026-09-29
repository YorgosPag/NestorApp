/**
 * @fileoverview **ΤΑ ΣΧΗΜΑΤΑ ΤΩΝ ΧΩΡΩΝ** — περιγράμματα χώρων και νοητές διαχωριστικές γραμμές ενός ορόφου: καθαρές συναρτήσεις
 * που παίρνουν τον γράφο και επιστρέφουν τον νέο, ή ονομασμένη άρνηση (ADR-884 Φ2στ-γ Γ3β · §4.14 · §12 Δ8).
 * @related `tour-graph-edit.ts` (`TourGraphCommand`, `TourSpaceDraft` — ίδιος γραφέας, ίδιο συμβόλαιο) · `tour-plan-frame.ts`
 *   (`isOnPlan`, `rescalePoint`) · `lib/geometry/planar-polygon{,-overlap}.ts` (η γεωμετρία) · `tour-room.ts` (το όνομα)
 * @module lib/spatial-tour/tour-space-edit
 *
 * 🔑 **Ο διακομιστής ξανακρίνει ΠΑΝΤΑ** (πρότυπο Revit «Room is not in a properly enclosed region»): κορυφές πάνω στην κάτοψη,
 *   χωρίς αυτοτομή, εμβαδόν ≥ ελάχιστο, **καμία επικάλυψη** με άλλον χώρο του ορόφου. Η πρόταση της ανίχνευσης (Γ3α) ή το
 *   σύρσιμο στην οθόνη δεν είναι ποτέ τεκμήριο.
 * 🔑 **Χωρίς σημείο λήψης, δεκτός** (Γ3β-1): η αποθήκη που δεν φωτογραφήθηκε είναι χώρος — γι' αυτό φέρει δικό της όνομα.
 * 🔑 **Η δήλωση εμβαδού επιβιώνει την αλλαγή σχήματος** (Δ8.4): η οθόνη την ξαναστέλνει, και όταν τιμή + πηγή δεν άλλαξαν μένει
 *   **η αρχική** σφραγίδα «ποιος/πότε».
 * 🔑 **Τα σχήματα ανήκουν στην ΕΙΚΟΝΑ**, όπως οι θέσεις: `rescaleLevelShapes` (νέα κλίμακα) · `clearLevelShapes` (νέα κάτοψη).
 */

import {
  isTourDeclaredAreaSource,
  isTourSpaceSource,
  TOUR_DECLARED_AREA_MAX_M2,
  TOUR_SEPARATION_MIN_LENGTH_M,
  TOUR_SPACE_MAX_VERTICES,
  TOUR_SPACE_MIN_AREA_M2,
  TOUR_SPACE_MIN_VERTICES,
  TOUR_SPACE_OVERLAP_TOLERANCE_M,
} from '@/constants/spatial-tour-vocabulary';
import { isPolygonSelfIntersecting, polygonArea, type PlanarPoint } from '@/lib/geometry/planar-polygon';
import { polygonsOverlap } from '@/lib/geometry/planar-polygon-overlap';
import type { SpatialTour, TourDeclaredArea, TourLevel, TourLevelKey, TourSeparationLine, TourSpaceOutline } from '@/types/spatial-tour';

import { findTourLevel, levelKeyId } from './spatial-tour-graph';
import type { TourGraphEditRefusal, TourGraphEditResult, TourPlanXY, TourSpaceDraft } from './tour-graph-edit';
import type { TourEditStamp } from './tour-plan-edit';
import { activeFloorPlan, calibratedPlan, isOnPlan, rescalePoint, type CalibratedPlan } from './tour-plan-frame';
import { normalizeTourRoom, sameTourRoom } from './tour-room';

type Graph = Pick<SpatialTour, 'levels' | 'nodes'>;

/** Κάτω από αυτό (μέτρα), δύο κορυφές είναι ίδιες — ιδεμποτία χωρίς ψεύτικη «αλλαγή» από στρογγύλευση. */
const EPSILON = 1e-9;

const refused = (reason: TourGraphEditRefusal): TourGraphEditResult => ({ kind: 'refused', reason });
const UNCHANGED: TourGraphEditResult = { kind: 'unchanged' };

// ── Ο όροφος και τα σχήματά του ──────────────────────────────────────────────

/** Ο όροφος με **αυτά** τα σχήματα — κενή λίστα ⇒ το πεδίο λείπει (το έγγραφο μένει όπως ήταν πριν τη Γ3β). */
function levelWithShapes(level: TourLevel, spaces: readonly TourSpaceOutline[], separations: readonly TourSeparationLine[]): TourLevel {
  const { spaces: _s, separations: _l, ...rest } = level;
  return {
    ...rest,
    ...(spaces.length > 0 ? { spaces } : {}),
    ...(separations.length > 0 ? { separations } : {}),
  };
}

function replaceLevel(graph: Graph, next: TourLevel): Graph {
  const id = levelKeyId(next.key);
  return { levels: graph.levels.map((level) => (levelKeyId(level.key) === id ? next : level)), nodes: graph.nodes };
}

/** **Νέα κάτοψη** ⇒ τα σχήματα σβήνουν (το pixel μιας άλλης εικόνας δεν σημαίνει τίποτα — ίδιο με τις θέσεις). */
export function clearLevelShapes(level: TourLevel): TourLevel {
  return levelWithShapes(level, [], []);
}

/** **Νέα κλίμακα** ⇒ κορυφές και άκρα ξανακλιμακώνονται (μένουν στο ίδιο pixel)· χωρίς κλίμακα (`null` πριν ή μετά) σβήνουν. */
export function rescaleLevelShapes(level: TourLevel, before: number | null, after: number | null): TourLevel {
  if (before === null || after === null) return clearLevelShapes(level);
  const spaces = (level.spaces ?? []).map((space) => ({ ...space, points: space.points.map((p) => rescalePoint(p, before, after)) }));
  const separations = (level.separations ?? []).map((line) => ({
    ...line, a: rescalePoint(line.a, before, after), b: rescalePoint(line.b, before, after),
  }));
  return levelWithShapes(level, spaces, separations);
}

/** Ο όροφος **με** βαθμονομημένη κάτοψη — χωρίς κλίμακα, κανένα σχήμα (τα «μέτρα» θα ήταν μαντεψιά). */
function locateCalibrated(graph: Graph, key: TourLevelKey): { readonly level: TourLevel; readonly plan: CalibratedPlan } | TourGraphEditRefusal {
  const level = findTourLevel(graph.levels, key);
  if (level === undefined) return 'level-absent';
  const plan = calibratedPlan(activeFloorPlan(level));
  return plan === null ? 'plan-uncalibrated' : { level, plan };
}

const planar = (p: TourPlanXY): PlanarPoint => ({ x: p.x, y: p.y });
const samePoint = (a: PlanarPoint, b: PlanarPoint) => Math.abs(a.x - b.x) < EPSILON && Math.abs(a.y - b.y) < EPSILON;
const finitePoint = (p: TourPlanXY) => Number.isFinite(p.x) && Number.isFinite(p.y);

// ── Ο κριτής του περιγράμματος ───────────────────────────────────────────────

/** Σχήμα: πλήθος, πεπερασμένα, πάνω στην κάτοψη, χωρίς αυτοτομή, όχι μουτζούρα. */
function judgeOutline(points: readonly TourPlanXY[], plan: CalibratedPlan): readonly PlanarPoint[] | TourGraphEditRefusal {
  if (points.length < TOUR_SPACE_MIN_VERTICES || points.length > TOUR_SPACE_MAX_VERTICES || !points.every(finitePoint)) return 'space-invalid';
  const ring = points.map(planar);
  if (!ring.every((p) => isOnPlan(p, plan))) return 'space-outside-plan';
  if (isPolygonSelfIntersecting(ring) || polygonArea(ring) < TOUR_SPACE_MIN_AREA_M2) return 'space-invalid';
  return ring;
}

type DeclaredDraft = TourSpaceDraft['declaredArea'];

/** Δήλωση: θετική, πεπερασμένη, ≤ όριο, γνωστή πηγή· ίδια τιμή + πηγή ⇒ **η αρχική** σφραγίδα (Δ8.4). */
function judgeDeclared(draft: DeclaredDraft, previous: TourDeclaredArea | null | undefined, stamp: TourEditStamp): TourDeclaredArea | null | 'area-invalid' {
  if (draft === null) return null;
  const { areaM2, source } = draft;
  if (!Number.isFinite(areaM2) || areaM2 <= 0 || areaM2 > TOUR_DECLARED_AREA_MAX_M2 || !isTourDeclaredAreaSource(source)) return 'area-invalid';
  if (previous != null && Math.abs(previous.areaM2 - areaM2) < EPSILON && previous.source === source) return previous;
  return { areaM2, source, declaredBy: stamp.uid, declaredAt: stamp.at };
}

function overlapsAnother(ring: readonly PlanarPoint[], level: TourLevel, ownId: string | null): boolean {
  return (level.spaces ?? []).some((other) => other.id !== ownId && polygonsOverlap(ring, other.points, TOUR_SPACE_OVERLAP_TOLERANCE_M));
}

function sameDeclared(a: TourDeclaredArea | null | undefined, b: TourDeclaredArea | null | undefined): boolean {
  if (a == null || b == null) return (a ?? null) === (b ?? null);
  return Math.abs(a.areaM2 - b.areaM2) < EPSILON && a.source === b.source;
}

function sameSpace(a: TourSpaceOutline, b: TourSpaceOutline): boolean {
  return a.source === b.source
    && a.points.length === b.points.length && a.points.every((p, i) => samePoint(p, b.points[i]))
    && sameTourRoom(a.room, b.room)
    && sameDeclared(a.declaredArea, b.declaredArea);
}

interface SpaceInput {
  readonly levelKey: TourLevelKey;
  readonly spaceId: string | null;
  readonly space: TourSpaceDraft;
}

/** Ο χώρος όπως θα γραφτεί — ή η άρνηση. Η έγκριση (`approvedBy/At`) = η σφραγίδα αυτής της εντολής. */
function buildSpace(input: SpaceInput, level: TourLevel, plan: CalibratedPlan, id: string, stamp: TourEditStamp): TourSpaceOutline | TourGraphEditRefusal {
  const previous = input.spaceId === null ? undefined : (level.spaces ?? []).find((space) => space.id === input.spaceId);
  if (input.spaceId !== null && previous === undefined) return 'space-absent';
  if (!isTourSpaceSource(input.space.source)) return 'space-invalid';
  const ring = judgeOutline(input.space.points, plan);
  if (typeof ring === 'string') return ring;
  const room = input.space.room === null ? null : normalizeTourRoom(input.space.room);
  if (input.space.room !== null && room === null) return 'room-invalid';
  const declaredArea = judgeDeclared(input.space.declaredArea, previous?.declaredArea, stamp);
  if (declaredArea === 'area-invalid') return declaredArea;
  if (overlapsAnother(ring, level, input.spaceId)) return 'space-overlap';
  return {
    id, points: ring, source: input.space.source, approvedBy: stamp.uid, approvedAt: stamp.at,
    ...(room === null ? {} : { room }),
    ...(declaredArea === null ? {} : { declaredArea }),
  };
}

// ── Οι εντολές ──────────────────────────────────────────────────────────────

/**
 * **Έγκρινε περίγραμμα χώρου** — νέο (`spaceId === null`, id = `newId`, ήδη κομμένο από τον διακομιστής, N.6) ή αντικατάσταση
 * υπάρχοντος. Ίδια δεδομένα ⇒ `unchanged` (και η προηγούμενη έγκριση μένει).
 */
export function upsertSpace(graph: Graph, input: SpaceInput, newId: string, stamp: TourEditStamp): TourGraphEditResult {
  const located = locateCalibrated(graph, input.levelKey);
  if (typeof located === 'string') return refused(located);
  const { level, plan } = located;
  const next = buildSpace(input, level, plan, input.spaceId ?? newId, stamp);
  if (typeof next === 'string') return refused(next);
  const spaces = level.spaces ?? [];
  const previous = spaces.find((space) => space.id === next.id);
  if (previous !== undefined && sameSpace(previous, next)) return UNCHANGED;
  const nextSpaces = previous === undefined ? [...spaces, next] : spaces.map((space) => (space.id === next.id ? next : space));
  const graphAfter = replaceLevel(graph, levelWithShapes(level, nextSpaces, level.separations ?? []));
  return previous === undefined ? { kind: 'edited', graph: graphAfter, createdId: next.id } : { kind: 'edited', graph: graphAfter };
}

/** **Βγάλε** ένα περίγραμμα χώρου — ανύπαρκτο ⇒ ίδιος γράφος (όπως το `unlink`). */
export function removeSpace(graph: Graph, levelKey: TourLevelKey, spaceId: string): TourGraphEditResult {
  const level = findTourLevel(graph.levels, levelKey);
  if (level === undefined) return refused('level-absent');
  const spaces = level.spaces ?? [];
  if (!spaces.some((space) => space.id === spaceId)) return UNCHANGED;
  return { kind: 'edited', graph: replaceLevel(graph, levelWithShapes(level, spaces.filter((s) => s.id !== spaceId), level.separations ?? [])) };
}

interface SeparationInput {
  readonly levelKey: TourLevelKey;
  readonly separationId: string | null;
  readonly a: TourPlanXY;
  readonly b: TourPlanXY;
}

function judgeSeparation(input: SeparationInput, plan: CalibratedPlan): readonly [PlanarPoint, PlanarPoint] | null {
  if (!finitePoint(input.a) || !finitePoint(input.b)) return null;
  const [a, b] = [planar(input.a), planar(input.b)];
  if (!isOnPlan(a, plan) || !isOnPlan(b, plan)) return null;
  return Math.hypot(b.x - a.x, b.y - a.y) < TOUR_SEPARATION_MIN_LENGTH_M ? null : [a, b];
}

/** **Βάλε (ή μετακίνησε) νοητή διαχωριστική γραμμή** (Δ8.2) — και τα δύο άκρα πάνω στην κάτοψη, μήκος ≥ ελάχιστο. */
export function upsertSeparation(graph: Graph, input: SeparationInput, newId: string, stamp: TourEditStamp): TourGraphEditResult {
  const located = locateCalibrated(graph, input.levelKey);
  if (typeof located === 'string') return refused(located);
  const { level, plan } = located;
  const lines = level.separations ?? [];
  const previous = input.separationId === null ? undefined : lines.find((line) => line.id === input.separationId);
  if (input.separationId !== null && previous === undefined) return refused('separation-absent');
  const ends = judgeSeparation(input, plan);
  if (ends === null) return refused('separation-invalid');
  const [a, b] = ends;
  if (previous !== undefined && samePoint(previous.a, a) && samePoint(previous.b, b)) return UNCHANGED;
  const next: TourSeparationLine = { id: previous?.id ?? newId, a, b, approvedBy: stamp.uid, approvedAt: stamp.at };
  const nextLines = previous === undefined ? [...lines, next] : lines.map((line) => (line.id === next.id ? next : line));
  const graphAfter = replaceLevel(graph, levelWithShapes(level, level.spaces ?? [], nextLines));
  return previous === undefined ? { kind: 'edited', graph: graphAfter, createdId: next.id } : { kind: 'edited', graph: graphAfter };
}

/** **Σβήσε** νοητή γραμμή — ανύπαρκτη ⇒ ίδιος γράφος. Οι δύο χώροι της **δεν** ενώνονται μόνοι τους: είναι εγκεκριμένα σχήματα. */
export function removeSeparation(graph: Graph, levelKey: TourLevelKey, separationId: string): TourGraphEditResult {
  const level = findTourLevel(graph.levels, levelKey);
  if (level === undefined) return refused('level-absent');
  const lines = level.separations ?? [];
  if (!lines.some((line) => line.id === separationId)) return UNCHANGED;
  return { kind: 'edited', graph: replaceLevel(graph, levelWithShapes(level, level.spaces ?? [], lines.filter((l) => l.id !== separationId))) };
}

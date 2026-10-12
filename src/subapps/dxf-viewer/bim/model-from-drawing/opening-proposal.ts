/**
 * ADR-911 Φ4-1 — ο καθαρός πυρήνας της πρότασης ανοιγμάτων. Χωρίς UI, χωρίς εγγραφή.
 *
 * Είσοδος: η σκηνή ΟΠΩΣ ΕΙΝΑΙ (τοίχοι BIM που ήδη γράφτηκαν από τη Φ3, κολώνες, υπάρχοντα
 * ανοίγματα) και οι οντότητες με τον ρόλο «κούφωμα». Έξοδος: ένα στοιχείο ανά σύμβολο, σε μία από
 * τέσσερις καταστάσεις — πόρτα · παράθυρο · προς απόφαση · υπάρχει ήδη.
 *
 * Άγκυρες:
 *   Α-7  Ο αναγνωριστής δεν λαμβάνει ΠΟΤΕ οντότητα άλλου ρόλου: το φίλτρο ρόλου είναι το πρώτο βήμα
 *        και τίποτα μετά από αυτό δεν βλέπει τη σκηνή ως σύμβολα.
 *   Α-8  Ένα τόξο ⇒ το πολύ ένα κούφωμα· μία συστάδα γραμμών σε έναν τοίχο ⇒ το πολύ ένα παράθυρο.
 *   Ιδεμποτία: κριτής είναι ο ξενιστής (`opening.params.wallId`) + η θέση πάνω στον άξονά του —
 *        όχι ο καθρέφτης του ανοίγματος. Δεύτερη εκτέλεση πάνω στη γραμμένη σκηνή ⇒ μηδέν νέα.
 *
 * Σώμα τοίχου ΜΟΝΟ από το `wall-painted-body` (ό,τι ζωγραφίζεται είναι ό,τι χτυπά η ακτίνα).
 */

import type { AnySceneEntity, ArcEntity, Entity } from '../../types/entities';
import { isArcEntity, isLineEntity, isOpeningEntity, isWallEntity } from '../../types/entities';
import type { Point2D } from '../../rendering/types/Types';
import type { SceneUnits } from '../../hooks/drawing/wall-completion';
import { MODEL_FROM_DRAWING_LIMITS as LIMITS } from '../../config/tolerance-config';
import { mmToSceneUnits } from '../../utils/scene-units';
import { calculateDistance, calculateMidpoint } from '../../rendering/entities/shared/geometry-vector-utils';
import {
  DEFAULT_FRAME_WIDTH_MM, MIN_OPENING_WIDTH_MM, isWallHostedOpening, type OpeningParams,
} from '../types/opening-types';
import type { EntityColorResolver } from '../walls/same-color-rects';
import { resolveWallPaintedBodies } from '../walls/wall-painted-body';
import { collectColumnFootprints } from '../walls/wall-trims';
import { solveDoorSymbol, type DoorObstacle, type DoorSymbolSolution } from './door-symbol-axis';
import { resolveDoorHost, type HostWalls, type OpeningHostPlan, type OpeningSpan } from './opening-host-plan';
import { clusterWindowSymbols, type WindowCluster, type WindowSymbolLine } from './window-symbol-clusters';
import { frameCoords, isInsideFrameBand, pointOnFrame, wallHostFrame, type WallHostFrame } from './wall-host-frame';
import { findWallRunGaps, type WallRunGap } from './wall-run-gaps';

export type OpeningProposalStatus = 'door' | 'window' | 'needs-decision' | 'existing';

export type OpeningDecisionReason =
  | 'not-a-door-arc'
  | 'no-jamb'
  | 'jambs-not-drawn'
  | 'frame-implausible'
  | 'host-undetermined'
  | 'sparse-symbol'
  /** Φ4-3α/Δ6 — κενό ομοαξονικής διαδρομής χωρίς κανένα σύμβολο πάνω του. */
  | 'no-symbol';

/** Ό,τι μπορεί να αποφασίσει ο άνθρωπος για ένα στοιχείο «προς απόφαση»: τι κούφωμα είναι. */
export type OpeningDecision = 'door' | 'window';

export interface OpeningProposalItem {
  /** Σταθερό κλειδί από τη γεωμετρία του συμβόλου (mm) — ίδιο σε κάθε υπολογισμό. */
  readonly key: string;
  /** Τι θα ΓΡΑΦΤΕΙ: `door` / `window` γράφονται, τα άλλα δύο ποτέ. */
  readonly status: OpeningProposalStatus;
  /** Τι ΔΕΙΧΝΕΙ το σχέδιο. `none` = κενό χωρίς σύμβολο (Δ6). */
  readonly symbol: 'door' | 'window' | 'none';
  readonly sourceIds: readonly string[];
  readonly host?: OpeningHostPlan;
  readonly span?: OpeningSpan;
  /** Κενό λαμπά–λαμπά = `OpeningParams.width` (Δ6). */
  readonly widthMm?: number;
  readonly leafMm?: number;
  readonly frameWidthMm?: number;
  /** Μοναδιαίο προς την πλευρά που ανοίγει το φύλλο. */
  readonly swing?: Point2D;
  readonly reason?: OpeningDecisionReason;
  readonly existingOpeningId?: string;
  /** Μόνο σε κενό χωρίς σύμβολο: γραμμές ΑΛΛΟΥ ρόλου ζωγραφισμένες μέσα του (π.χ. κολώνα). */
  readonly occupantIds?: readonly string[];
  /** Η κατάσταση είναι απόφαση ανθρώπου, όχι ανάγνωση του σχεδίου· το `reason` λέει γιατί ρωτήθηκε. */
  readonly decided?: true;
}

export interface OpeningProposal {
  readonly items: readonly OpeningProposalItem[];
  /** Οντότητες του ρόλου που ΔΕΝ εξηγεί κανένα κούφωμα — φωτίζονται, δεν κρύβονται (όπως στη Φ3). */
  readonly unexplainedIds: readonly string[];
}

export interface OpeningProposalInput {
  readonly entities: readonly Entity[];
  /** Το χρώμα του ρόλου «κούφωμα» — ό,τι άλλο δεν φτάνει ποτέ στον αναγνωριστή (Α-7). */
  readonly openingColorHex: string;
  readonly colorOf: EntityColorResolver;
  readonly sceneUnits: SceneUnits;
  /** Κλειδί στοιχείου → απόφαση ανθρώπου. Ισχύει ΜΟΝΟ σε στοιχείο «προς απόφαση» που μπορεί να γραφτεί. */
  readonly decisions?: ReadonlyMap<string, OpeningDecision>;
}

interface HostedOpening { readonly id: string; readonly params: OpeningParams & { readonly wallId: string } }

interface Context extends HostWalls {
  readonly scale: number;
  readonly tol: number;
  readonly frameList: readonly WallHostFrame[];
  readonly obstacles: readonly DoorObstacle[];
  readonly openings: readonly HostedOpening[];
}

const mmKey = (prefix: string, p: Point2D, scale: number): string =>
  `${prefix}:${Math.round(p.x / scale)}:${Math.round(p.y / scale)}`;

function buildContext(entities: readonly Entity[], sceneUnits: SceneUnits): Context {
  const scale = mmToSceneUnits(sceneUnits);
  const wallList = entities.filter(isWallEntity);
  const columns = collectColumnFootprints(entities as readonly AnySceneEntity[]);
  const bodies = resolveWallPaintedBodies(wallList, columns);
  const frameList = wallList.flatMap((w) => wallHostFrame(w, scale) ?? []);
  const obstacles: DoorObstacle[] = [
    ...wallList.flatMap((w) => (bodies.get(w.id) ?? []).map((ring) => ({ ring, wallId: w.id }))),
    ...columns.map((ring) => ({ ring })),
  ];
  return {
    scale,
    tol: LIMITS.NODE_MERGE_TOLERANCE_MM * scale,
    frameList,
    frames: new Map(frameList.map((f) => [f.id, f] as const)),
    walls: new Map(wallList.map((w) => [w.id, w] as const)),
    obstacles,
    openings: entities.filter(isOpeningEntity).filter(isWallHostedOpening),
  };
}

/** Ο κριτής ιδεμποτίας: άνοιγμα με αυτόν τον ξενιστή που καλύπτει αυτή τη θέση του άξονά του. */
function openingAt(frame: WallHostFrame, along: number, ctx: Context): HostedOpening | null {
  const mm = along / ctx.scale;
  const tolMm = LIMITS.NODE_MERGE_TOLERANCE_MM;
  return ctx.openings.find((o) => o.params.wallId === frame.id
    && mm >= o.params.offsetFromStart - tolMm
    && mm <= o.params.offsetFromStart + o.params.width + tolMm) ?? null;
}

function existingDoorItem(arc: ArcEntity, key: string, ctx: Context): OpeningProposalItem | null {
  for (const frame of ctx.frameList) {
    if (!isInsideFrameBand(frame, arc.center, ctx.tol)) continue;
    const opening = openingAt(frame, frameCoords(frame, arc.center).along, ctx);
    if (!opening) continue;
    return {
      key, status: 'existing', symbol: 'door', sourceIds: [arc.id],
      host: { kind: 'existing-wall', wallId: frame.id }, existingOpeningId: opening.id,
    };
  }
  return null;
}

function solvedDoorItem(arc: ArcEntity, key: string, door: DoorSymbolSolution, ctx: Context): OpeningProposalItem {
  const host = resolveDoorHost(door, ctx, ctx.scale);
  const frameWidthMm = (door.gap - door.leaf) / 2 / ctx.scale;
  const plausible = frameWidthMm >= LIMITS.DOOR_FRAME_MIN_MM && frameWidthMm <= LIMITS.DOOR_FRAME_MAX_MM;
  const reason: OpeningDecisionReason | undefined = !plausible ? 'frame-implausible' : !host ? 'host-undetermined' : undefined;
  return {
    key, status: reason ? 'needs-decision' : 'door', symbol: 'door', sourceIds: [arc.id],
    host: host?.plan, span: host?.span,
    widthMm: door.gap / ctx.scale, leafMm: door.leaf / ctx.scale, frameWidthMm, swing: door.swing, reason,
  };
}

function proposeDoor(arc: ArcEntity, ctx: Context): OpeningProposalItem {
  const key = mmKey('door', arc.center, ctx.scale);
  const existing = existingDoorItem(arc, key, ctx);
  if (existing) return existing;
  const base = { key, status: 'needs-decision', symbol: 'door', sourceIds: [arc.id] } as const;
  const result = solveDoorSymbol(arc, ctx.obstacles, ctx.scale);
  if (result.kind === 'solved') return solvedDoorItem(arc, key, result.solution, ctx);
  if (result.kind === 'not-a-door') return { ...base, reason: 'not-a-door-arc' };
  if (result.kind === 'no-jamb') return { ...base, reason: 'no-jamb' };
  const leafMm = arc.radius / ctx.scale;
  const wallId = result.obstacle.wallId;
  return {
    ...base, reason: 'jambs-not-drawn', leafMm, widthMm: leafMm + 2 * DEFAULT_FRAME_WIDTH_MM,
    host: wallId ? { kind: 'existing-wall', wallId } : undefined,
  };
}

/**
 * Γραμμή που ανήκει στο σύμβολο μιας πόρτας (φύλλο, κάσες) — δεν είναι παράθυρο. Κριτής είναι ο
 * δίσκος του φύλλου γύρω από τον μεντεσέ, ΟΧΙ η λύση της πόρτας: το ίδιο σύμβολο πρέπει να
 * δεσμεύει τις ίδιες γραμμές και όταν ο τοίχος έχει πια γεφυρωθεί και η ακτίνα δεν βρίσκει λαμπάδα.
 */
function isClaimedByDoor(line: WindowSymbolLine, arc: ArcEntity, ctx: Context): boolean {
  const radius = arc.radius + LIMITS.DOOR_FRAME_MAX_MM * ctx.scale + ctx.tol;
  return calculateDistance(line.start, arc.center) <= radius && calculateDistance(line.end, arc.center) <= radius;
}

function proposeWindow(cluster: WindowCluster, ctx: Context): OpeningProposalItem | null {
  const frame = ctx.frames.get(cluster.wallId);
  if (!frame) return null;
  const lo = Math.max(0, cluster.lo);
  const hi = Math.min(frame.length, cluster.hi);
  const span = { start: pointOnFrame(frame, lo), end: pointOnFrame(frame, hi) };
  const base = {
    key: mmKey('window', calculateMidpoint(span.start, span.end), ctx.scale), symbol: 'window',
    sourceIds: cluster.sourceIds, host: { kind: 'existing-wall', wallId: frame.id }, span,
    widthMm: (hi - lo) / ctx.scale,
  } as const;
  const opening = openingAt(frame, (lo + hi) / 2, ctx);
  // Ο κριτής δεν ρωτά ΤΙ άνοιγμα είναι: η θέση αυτή του ξενιστή είναι ήδη κατειλημμένη.
  if (opening) return { ...base, status: 'existing', existingOpeningId: opening.id };
  // Στενότερο από το ελάχιστο άνοιγμα δεν είναι κούφωμα· οι γραμμές του μένουν ανεξήγητες.
  if (base.widthMm < MIN_OPENING_WIDTH_MM) return null;
  return cluster.sourceIds.length < LIMITS.WINDOW_MIN_LINES
    ? { ...base, status: 'needs-decision', reason: 'sparse-symbol' }
    : { ...base, status: 'window' };
}

/**
 * Οι γραμμές ΑΛΛΟΥ ρόλου που έχουν το μέσο τους μέσα στο κενό. Δεν κρίνουν τίποτα — το κενό μένει
 * «προς απόφαση» — αλλά λένε στον άνθρωπο ότι εκεί είναι ζωγραφισμένο κάτι που ο βοηθός δεν
 * διαβάζει (μετρημένο: τα δύο κενά του σχεδίου δοκιμής κρατούν ζωγραφισμένη κολώνα).
 */
function gapOccupants(gap: WallRunGap, foreign: readonly WindowSymbolLine[], ctx: Context): string[] {
  const frame = ctx.frames.get(gap.wallIds[0]);
  if (!frame) return [];
  const ends = [frameCoords(frame, gap.span.start).along, frameCoords(frame, gap.span.end).along];
  return foreign.filter((line) => {
    const { along, across } = frameCoords(frame, calculateMidpoint(line.start, line.end));
    return along > Math.min(...ends) + ctx.tol && along < Math.max(...ends) - ctx.tol
      && Math.abs(across) <= frame.halfThickness + ctx.tol;
  }).map((line) => line.id);
}

function proposeGap(gap: WallRunGap, foreign: readonly WindowSymbolLine[], ctx: Context): OpeningProposalItem {
  return {
    key: mmKey('gap', calculateMidpoint(gap.span.start, gap.span.end), ctx.scale),
    status: 'needs-decision', reason: 'no-symbol', symbol: 'none', sourceIds: [],
    host: { kind: 'bridge', wallIds: gap.wallIds }, span: gap.span, widthMm: gap.widthMm,
    occupantIds: gapOccupants(gap, foreign, ctx),
  };
}

/**
 * Στοιχείο «προς απόφαση» που ο άνθρωπος ΜΠΟΡΕΙ να κάνει κούφωμα: το σχέδιο έδωσε ξενιστή, θέση
 * και πλάτος — λείπει μόνο το τι είναι. Χωρίς ξενιστή ή θέση δεν υπάρχει τι να γραφτεί.
 */
export function isDecidableOpening(item: OpeningProposalItem): boolean {
  return item.status === 'needs-decision'
    && item.host !== undefined && item.span !== undefined && item.widthMm !== undefined;
}

function applyDecision(item: OpeningProposalItem, decisions: OpeningProposalInput['decisions']): OpeningProposalItem {
  const decision = decisions?.get(item.key);
  return decision && isDecidableOpening(item) ? { ...item, status: decision, decided: true } : item;
}

export function computeOpeningProposal(input: OpeningProposalInput): OpeningProposal {
  const role = input.openingColorHex.toLowerCase();
  // Α-7: από εδώ και κάτω ΜΟΝΟ τα σύμβολα του ρόλου. Η σκηνή δίνει μόνο σώματα και ξενιστές.
  const symbols = input.entities.filter((e) => input.colorOf(e)?.toLowerCase() === role);
  const ctx = buildContext(input.entities, input.sceneUnits);
  const arcs = symbols.filter(isArcEntity);
  const doors = arcs.map((arc) => proposeDoor(arc, ctx));
  const doorArcs = arcs.filter((_, i) => doors[i].reason !== 'not-a-door-arc');
  const symbolLines: readonly WindowSymbolLine[] = symbols.filter(isLineEntity);
  const free = symbolLines.filter((line) => !doorArcs.some((arc) => isClaimedByDoor(line, arc, ctx)));
  const clusters = clusterWindowSymbols(free, ctx.frameList, ctx.scale);
  const windows = clusters.flatMap((c) => proposeWindow(c, ctx) ?? []);
  // Δ6 — κενό με σύμβολο πάνω του είναι ήδη στοιχείο· τα υπόλοιπα κενά ρωτούν τον άνθρωπο.
  const claims = [...doorArcs.map((arc) => arc.center), ...windows.flatMap((w) => (w.span ? [w.span.start, w.span.end] : []))];
  const foreign: readonly WindowSymbolLine[] = input.entities.filter(isLineEntity)
    .filter((e) => input.colorOf(e)?.toLowerCase() !== role);
  const gaps = findWallRunGaps({ ...ctx, claims }).map((gap) => proposeGap(gap, foreign, ctx));
  const items = [...doors, ...windows, ...gaps]
    .map((item) => applyDecision(item, input.decisions))
    .sort((a, b) => a.key.localeCompare(b.key));
  const explained = new Set(items.flatMap((i) => i.sourceIds));
  const unexplainedIds = free.map((l) => l.id).filter((id) => !explained.has(id));
  return { items, unexplainedIds };
}

/** Πλήθη ανά κατάσταση, με παρούσες και τις μηδενικές. */
export function countOpeningsByStatus(proposal: OpeningProposal): Record<OpeningProposalStatus, number> {
  const counts: Record<OpeningProposalStatus, number> = { door: 0, window: 0, 'needs-decision': 0, existing: 0 };
  for (const item of proposal.items) counts[item.status] += 1;
  return counts;
}

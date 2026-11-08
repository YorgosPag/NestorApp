/**
 * ADR-911 Φ4-2 — από τα ΣΧΕΔΙΑ ξενιστή της πρότασης στους ΤΕΛΙΚΟΥΣ τοίχους-ξενιστές. Καθαρό.
 *
 * Κάθε σχέδιο (`OpeningHostPlan`) αναφέρει ids της ΤΡΕΧΟΥΣΑΣ σκηνής και μιλά για ένα κούφωμα. Εδώ
 * διαβάζονται ΟΛΑ μαζί, γιατί δύο κουφώματα μπορεί να θέλουν τον ίδιο τοίχο:
 *
 *   Α ─ πόρτα ─ Β ─ πόρτα ─ Γ      δύο `bridge` (Α,Β) και (Β,Γ)  ⇒  ΕΝΑΣ τοίχος Α…Γ
 *   Α ─ πόρτα ─ Β ─ πόρτα ─┤       `bridge` (Α,Β) και `extend` του Β  ⇒  ΕΝΑΣ τοίχος ως τη λαμπάδα
 *
 * Ένωση-εύρεση πάνω στα ids ⇒ μία «διαδρομή» ανά συνεκτική συνιστώσα· κάθε διαδρομή λύνεται με ΜΙΑ
 * κλήση του `buildRunWallParams` (το ζεύγος του εργαλείου ένωσης είναι η διαδρομή των δύο). Η σειρά
 * των κουφωμάτων δεν αλλάζει τη γεωμετρία (ADR-911 §4.7)· αλλάζει η φορά του άξονα, γι' αυτό τα
 * offsets υπολογίζονται ΜΕΤΑ, από σημεία κόσμου.
 *
 * Τρεις εκβάσεις ανά διαδρομή:
 *   · ανέγγιχτη   — ο τοίχος υπάρχει ήδη συνεχής (ίδιο αντικείμενο, ίδιο id)·
 *   · reshaped    — ένας τοίχος που ΕΠΕΚΤΑΘΗΚΕ: ίδιο id, νέος άξονας (Revit: το στοιχείο επιζεί)·
 *   · merged      — Ν τοίχοι που έγιναν ένας: νέο id, οι Ν αφαιρούνται.
 * Και, εκτός διαδρομών, τα ΝΕΑ ΚΟΜΜΑΤΙΑ λαμπά–λαμπά: καθαροί τοίχοι, χτισμένοι από την αρχή.
 */

import { createKeyedDisjointSets } from '@/lib/algorithms/disjoint-sets';
import { generateWallId } from '@/services/enterprise-id.service';
import type { Point2D } from '../../rendering/types/Types';
import type { SceneUnits } from '../../utils/scene-units';
import { buildDefaultWallParams, buildWallEntity } from '../../hooks/drawing/wall-completion';
import { computeWallGeometry } from '../geometry/wall-geometry';
import type { WallEntity, WallParams } from '../types/wall-types';
import { buildRunWallParams, canMergeWalls } from '../walls/wall-merge';
import type { OpeningHostPlan } from './opening-host-plan';

export type OpeningHostRefusal = 'missing-host-wall' | 'unmergeable-run' | 'invalid-host-wall';

/** Ό,τι χρειάζεται η επίλυση από ένα στοιχείο της πρότασης. */
export interface HostedItem {
  readonly key: string;
  readonly host: OpeningHostPlan;
}

/** Τελικός ξενιστής του οποίου ο άξονας άλλαξε, με τους τοίχους από τους οποίους προήλθε. */
export interface ChangedHost {
  readonly hostId: string;
  readonly sources: readonly WallEntity[];
}

export interface ResolvedOpeningHosts {
  /** Κλειδί στοιχείου → id του ΤΕΛΙΚΟΥ ξενιστή του. */
  readonly hostIdByItemKey: ReadonlyMap<string, string>;
  /** Τοίχοι που απορροφήθηκαν σε ενωμένο. */
  readonly removed: readonly WallEntity[];
  /** Ενωμένοι τοίχοι + νέα κομμάτια — ΧΩΡΙΣ ενώσεις ακόμη. */
  readonly added: readonly WallEntity[];
  /** Υπάρχοντες τοίχοι με νέο άξονα (επέκταση), ίδιο id — ΧΩΡΙΣ ενώσεις ακόμη. */
  readonly reshaped: readonly WallEntity[];
  /** Ενωμένοι + reshaped: εκεί τα ΥΠΑΡΧΟΝΤΑ ανοίγματα θέλουν νέο offset / ξενιστή. */
  readonly changed: readonly ChangedHost[];
}

export interface OpeningHostContext {
  readonly layerId: string;
  readonly sceneUnits: SceneUnits;
  /** Γεννήτρια id ενωμένου τοίχου — εγχύσιμη για ντετερμινιστικά tests. */
  readonly newWallId?: () => string;
}

const AXIS_EPS = 1e-9;

const hostWallIds = (plan: OpeningHostPlan): readonly string[] =>
  plan.kind === 'bridge' ? plan.wallIds : plan.kind === 'new-piece' ? [] : [plan.wallId];

interface RunOutcome {
  readonly host: WallEntity;
  readonly change: 'none' | 'reshaped' | 'merged';
}

const sameAxis = (a: WallParams, b: WallParams): boolean =>
  Math.hypot(a.start.x - b.start.x, a.start.y - b.start.y) <= AXIS_EPS
  && Math.hypot(a.end.x - b.end.x, a.end.y - b.end.y) <= AXIS_EPS;

/** Μία διαδρομή ⇒ ο τελικός της τοίχος. `members[0]` = ο πρωτεύων (τα params και η φορά του κερδίζουν). */
function resolveRun(
  members: readonly WallEntity[],
  extendTo: readonly Point2D[],
  newWallId: () => string,
): RunOutcome | 'unmergeable-run' {
  const [primary, ...rest] = members;
  if (rest.length === 0 && extendTo.length === 0) return { host: primary, change: 'none' };
  // Ο άξονας ξαναγράφεται ως ευθεία ⇒ μόνο ευθύγραμμοι, και κάθε μέλος ομοαξονικό με τον πρωτεύοντα.
  if (primary.kind !== 'straight' || rest.some((w) => !canMergeWalls(primary, w).ok)) return 'unmergeable-run';
  const params = buildRunWallParams(members, extendTo);
  const geometry = computeWallGeometry(params, primary.kind);
  if (rest.length > 0) {
    return { host: { ...primary, id: newWallId(), params, geometry, hostedOpeningIds: [] }, change: 'merged' };
  }
  // Ο στόχος της επέκτασης ήταν ήδη μέσα στον τοίχο: τίποτα δεν αλλάζει, ούτε οι ενώσεις του.
  if (sameAxis(params, primary.params)) return { host: primary, change: 'none' };
  return { host: { ...primary, params, geometry }, change: 'reshaped' };
}

/**
 * Νέο κομμάτι = ΚΑΘΑΡΟΣ τοίχος: χτίζεται από τα εργοστάσια, ποτέ από `{...άλλος.params}` — αλλιώς
 * κληρονομεί `startMiter/endMiter/…` και το σώμα του βγαίνει κομμένο στο άκρο (μετρημένο, Φ4-1).
 * Από τον τοίχο-πρότυπο παίρνει ΜΟΝΟ ό,τι δεν λέει η κάτοψη: λειτουργία, ύψος, δεσίματα.
 */
function buildNewPiece(
  plan: Extract<OpeningHostPlan, { kind: 'new-piece' }>,
  walls: ReadonlyMap<string, WallEntity>,
  ctx: OpeningHostContext,
): WallEntity | OpeningHostRefusal {
  const like = walls.get(plan.likeWallId);
  if (!like) return 'missing-host-wall';
  const base = buildDefaultWallParams(
    plan.start, plan.end,
    { category: like.params.category, height: like.params.height, thickness: plan.thicknessMm },
    ctx.sceneUnits,
  );
  const params: WallParams = {
    ...base,
    baseBinding: like.params.baseBinding,
    topBinding: like.params.topBinding,
    baseOffset: like.params.baseOffset,
    topOffset: like.params.topOffset,
  };
  const built = buildWallEntity(params, like.layerId ?? ctx.layerId, 'straight', ctx.sceneUnits);
  return built.ok ? built.entity : 'invalid-host-wall';
}

interface Runs {
  /** Οι διαδρομές: τοίχοι με σειρά πρώτης εμφάνισης στα σχέδια (`[0]` = ο πρωτεύων). */
  readonly groups: readonly (readonly string[])[];
  readonly extendToByWall: ReadonlyMap<string, readonly Point2D[]>;
}

/**
 * Ένωση-εύρεση πάνω στα σχέδια (SSoT union-find, ADR-929 §6.9 #20). `null` = σχέδιο που δείχνει τοίχο
 * ο οποίος δεν υπάρχει πια.
 */
function collectRuns(items: readonly HostedItem[], walls: ReadonlyMap<string, WallEntity>): Runs | null {
  const ids: string[] = [];
  const extendToByWall = new Map<string, Point2D[]>();
  for (const { host } of items) {
    const hostIds = hostWallIds(host);
    if (hostIds.some((id) => !walls.has(id))) return null;
    ids.push(...hostIds);
    if (host.kind === 'extend') extendToByWall.set(host.wallId, [...(extendToByWall.get(host.wallId) ?? []), host.to]);
  }
  const sets = createKeyedDisjointSets(ids);
  for (const { host } of items) if (host.kind === 'bridge') sets.union(host.wallIds[0], host.wallIds[1]);
  return { groups: sets.groups(), extendToByWall };
}

interface Accumulator {
  /** Τοίχος-πηγή → ο τελικός τοίχος-φορέας της διαδρομής του. */
  readonly hostIdByWall: Map<string, string>;
  readonly removed: WallEntity[];
  readonly added: WallEntity[];
  readonly reshaped: WallEntity[];
  readonly changed: ChangedHost[];
}

function resolveRuns(
  runs: Runs,
  walls: ReadonlyMap<string, WallEntity>,
  newWallId: () => string,
): Accumulator | 'unmergeable-run' {
  const acc: Accumulator = { hostIdByWall: new Map(), removed: [], added: [], reshaped: [], changed: [] };
  for (const group of runs.groups) {
    const members = group.map((id) => walls.get(id)!);
    const extendTo = members.flatMap((w) => runs.extendToByWall.get(w.id) ?? []);
    const outcome = resolveRun(members, extendTo, newWallId);
    if (outcome === 'unmergeable-run') return outcome;
    for (const id of group) acc.hostIdByWall.set(id, outcome.host.id);
    if (outcome.change === 'none') continue;
    acc.changed.push({ hostId: outcome.host.id, sources: members });
    if (outcome.change === 'reshaped') acc.reshaped.push(outcome.host);
    else {
      acc.added.push(outcome.host);
      acc.removed.push(...members);
    }
  }
  return acc;
}

export function resolveOpeningHosts(
  items: readonly HostedItem[],
  walls: ReadonlyMap<string, WallEntity>,
  ctx: OpeningHostContext,
): ResolvedOpeningHosts | OpeningHostRefusal {
  const runs = collectRuns(items, walls);
  if (!runs) return 'missing-host-wall';
  const acc = resolveRuns(runs, walls, ctx.newWallId ?? generateWallId);
  if (acc === 'unmergeable-run') return acc;

  const hostIdByItemKey = new Map<string, string>();
  for (const item of items) {
    if (item.host.kind !== 'new-piece') {
      hostIdByItemKey.set(item.key, acc.hostIdByWall.get(hostWallIds(item.host)[0])!);
      continue;
    }
    const piece = buildNewPiece(item.host, walls, ctx);
    if (typeof piece === 'string') return piece;
    acc.added.push(piece);
    hostIdByItemKey.set(item.key, piece.id);
  }
  return { hostIdByItemKey, removed: acc.removed, added: acc.added, reshaped: acc.reshaped, changed: acc.changed };
}

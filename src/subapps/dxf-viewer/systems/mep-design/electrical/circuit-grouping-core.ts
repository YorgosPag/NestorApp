/**
 * ADR-431 — Discipline-agnostic circuit-grouping CORE (the shared electrical "brain").
 *
 * Generalised out of the ADR-430 electrical-strong grouping so BOTH electrical
 * disciplines reuse ONE bin-packing engine (Boy-Scout N.0.2 — no copy-paste of the
 * brain). The algorithm is identical for ισχυρά (power/lighting) and ασθενή
 * (data/controls); only the *service union* `S`, the per-service *rule* `R`, and the
 * meaning of "load" differ:
 *
 *   - strong: service ∈ {lighting, power}, load = VA, cap = breaker-load + points,
 *   - weak:   service ∈ {data, controls},  load = ports, cap = switch port budget.
 *
 * The core only needs each rule to expose a `{ maxLoad, maxPoints }` cap; the full
 * discipline rule (`R`) is carried through opaquely so the sizing stage can read its
 * own fields (conductor/breaker for strong, cable-type for weak). Pure — no store /
 * React / Date / Math.random (survives workflow replay).
 *
 * Grouping rules (both disciplines):
 *   1. Split by service — never mix two services on one circuit/channel.
 *   2. Group by zone   — keep a circuit within one Stage-0 space (Revit "by area").
 *   3. Bin-pack        — fill until the next load would exceed `maxLoad` OR `maxPoints`.
 *   4. (Phase balance is strong-only — see `balancePhases`, opt-in per discipline.)
 *
 * @see ./electrical-circuit-grouping.ts (strong rules + standard that consume this)
 * @see ./electrical-weak-grouping.ts (weak rules + standard that consume this)
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { MepSystemMember } from '../../../bim/types/mep-system-types';

/** A balanced-distribution phase label (single-phase circuit on one pole of a 3-phase panel). */
export type PhaseLabel = 'L1' | 'L2' | 'L3';

/** The minimal grouping cap every discipline rule must expose (the two bin-pack limits). */
export interface CircuitCap {
  /** Max connected load before a new circuit/channel opens (VA for strong, ports for weak). */
  readonly maxLoad: number;
  /** Max points (devices) per circuit/channel. */
  readonly maxPoints: number;
}

/**
 * One terminal's demand, generic over the discipline service union `S`. `load` is the
 * abstract demand unit (VA for strong, ports for weak); `point` feeds the home-run
 * wire length; `spaceId` (Stage-0) lets grouping keep a circuit within one zone.
 */
export interface TerminalDemand<S extends string> {
  /** `RecognizedTerminal.elementId`. */
  readonly terminalId: string;
  readonly entityId: string;
  /** The host connector id that joins the circuit (the circuit member). */
  readonly connectorId: string;
  /** Host kind (`'light-fixture'`, `'socket'`, `'data-outlet'`, …). */
  readonly terminalKind: string;
  /** Which service this load belongs to (lighting/power, or data/controls). */
  readonly service: S;
  /** Abstract demand unit — VA (strong) or ports (weak). */
  readonly load: number;
  /** Plan point (scene units) — for the daisy-chain wire-length. */
  readonly point: Point2D;
  /** The Stage-0 space this terminal binds to (zone grouping); absent ⇒ unzoned. */
  readonly spaceId?: string;
}

/** A bin-packed group BEFORE sizing/phase: its members + their points + load, carrying its rule `R`. */
export interface CircuitGroup<S extends string, R extends CircuitCap> {
  readonly service: S;
  readonly rule: R;
  readonly members: readonly MepSystemMember[];
  /** Parallel to `members` — the member plan points (for the wire length). */
  readonly points: readonly Point2D[];
  readonly connectedLoad: number;
  readonly spaceId?: string;
}

/** A grouping standard: per-service rule (≥ the cap) + the panel's phase set (empty ⇒ no balancing). */
export interface GroupingStandard<S extends string, R extends CircuitCap> {
  readonly id: string;
  readonly rules: Readonly<Record<S, R>>;
  /** Phases available for balancing (3-phase strong panel → L1/L2/L3; weak ⇒ []). */
  readonly phases: readonly PhaseLabel[];
}

/** Bucket key — one bucket per (service, zone); unzoned loads share the `∅` zone. */
function bucketKey<S extends string>(d: TerminalDemand<S>): string {
  return `${d.service}::${d.spaceId ?? '∅'}`;
}

/** Build a `CircuitGroup` from a packed run of demands sharing a service + zone. */
function toGroup<S extends string, R extends CircuitCap>(
  run: readonly TerminalDemand<S>[],
  rule: R,
): CircuitGroup<S, R> {
  return {
    service: run[0].service,
    rule,
    members: run.map((d) => ({ entityId: d.entityId, connectorId: d.connectorId })),
    points: run.map((d) => d.point),
    connectedLoad: run.reduce((s, d) => s + d.load, 0),
    ...(run[0].spaceId ? { spaceId: run[0].spaceId } : {}),
  };
}

/**
 * Group demands into circuits/channels: split by service, then by zone, then bin-pack
 * each bucket under the rule's load + point caps. Deterministic (preserves input order).
 * Generic over the service union `S` and the discipline rule `R` (which carries the cap).
 */
export function groupIntoCircuits<S extends string, R extends CircuitCap>(
  demands: readonly TerminalDemand<S>[],
  standard: GroupingStandard<S, R>,
): CircuitGroup<S, R>[] {
  const buckets = new Map<string, TerminalDemand<S>[]>();
  for (const d of demands) {
    const arr = buckets.get(bucketKey(d)) ?? [];
    arr.push(d);
    buckets.set(bucketKey(d), arr);
  }
  const groups: CircuitGroup<S, R>[] = [];
  for (const arr of buckets.values()) {
    const rule = standard.rules[arr[0].service];
    let run: TerminalDemand<S>[] = [];
    let load = 0;
    for (const d of arr) {
      const overPoints = run.length >= rule.maxPoints;
      const overLoad = run.length > 0 && load + d.load > rule.maxLoad;
      if (overPoints || overLoad) {
        groups.push(toGroup(run, rule));
        run = [];
        load = 0;
      }
      run.push(d);
      load += d.load;
    }
    if (run.length > 0) groups.push(toGroup(run, rule));
  }
  return groups;
}

/**
 * Assign each group a phase by a least-loaded (LPT) greedy: process groups in
 * descending load order, put each on the currently-lightest phase. Returns a phase per
 * group ALIGNED to the input `groups` order. Deterministic (stable tiebreak by index).
 * Strong-only — weak passes no phases and never calls this.
 */
export function balancePhases<S extends string, R extends CircuitCap>(
  groups: readonly CircuitGroup<S, R>[],
  phases: readonly PhaseLabel[],
): PhaseLabel[] {
  const result: PhaseLabel[] = new Array(groups.length);
  const phaseLoad = new Map<PhaseLabel, number>(phases.map((p) => [p, 0]));
  const order = groups
    .map((_, i) => i)
    .sort((a, b) => groups[b].connectedLoad - groups[a].connectedLoad || a - b);
  for (const i of order) {
    let best = phases[0];
    for (const p of phases) {
      if (phaseLoad.get(p)! < phaseLoad.get(best)!) best = p;
    }
    result[i] = best;
    phaseLoad.set(best, phaseLoad.get(best)! + groups[i].connectedLoad);
  }
  return result;
}

/** Euclidean distance between two plan points (scene units). */
function dist(a: Point2D, b: Point2D): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Home-run wire length (m) to the electrically-farthest member: greedy nearest-neighbour
 * chain from the source through the member points (the topology the renderer draws), the
 * cumulative length to the last hop. `sceneToM` converts scene units → meters. Shared by
 * both disciplines' sizing (voltage drop for strong, channel length for weak).
 */
export function daisyChainLengthM(
  source: Point2D,
  points: readonly Point2D[],
  sceneToM: number,
): number {
  let cursor = source;
  let cumulative = 0;
  const remaining = [...points];
  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = dist(cursor, remaining[i]);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    cumulative += bestDist;
    cursor = remaining[bestIdx];
    remaining.splice(bestIdx, 1);
  }
  return cumulative * sceneToM;
}

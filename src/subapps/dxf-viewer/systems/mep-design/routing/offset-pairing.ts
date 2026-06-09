/**
 * ADR-429 — Parallel offset pairing: the discipline-agnostic geometric core (pure, headless).
 *
 * Revit/MagiCAD/4M-FINE-grade twin-pipe routing: a second pipe network runs as a constant
 * lateral **offset** of an already-routed reference spine, so the two pipes are guaranteed
 * parallel "twins" instead of overlapping. This is the shared geometry behind BOTH the heating
 * supply/return pairing (ADR-429 Slice 3B) and the water cold/hot pairing (ADR-426) — extracted
 * here as a single SSoT (Boy-Scout N.0.2: zero copy-paste across disciplines).
 *
 * It speaks ONLY geometry — no heating/water types. The caller passes its trunk runs (already
 * role-filtered, in order), the reference network's source, the offset network's root, the
 * per-terminal re-tap targets, and the offset distance; it gets back the offset trunks, the root
 * stub(s), and the re-tap branches — each TAGGED with an index back into the caller's arrays so
 * the caller can copy its own per-run metadata (flow/LU/DN) without the core knowing about it.
 *
 * **Wall-aware repair (ADR-429 Slice 3C):** when `opts.obstacles` are supplied, the reference
 * spine is already an A\* detour (a chain of collinear runs the core reconstructs verbatim), and
 * its lateral offset can land ON a wall — the offset twin doesn't know about walls. So every
 * emitted run (trunk / stub / branch) is checked against the obstacles and any wall-crossing run
 * is **locally repaired** with the SAME `findOrthogonalPath` A\* used by `route-wall-aware.ts`,
 * splitting it into detour sub-runs that keep their index tag. With no obstacles the repair is a
 * no-op ⇒ byte-identical to the pre-3C geometry. The "pipe rack" model: the pair detours together,
 * and only where the offset would hit a wall does the twin nudge locally around it.
 *
 * FULL SSoT: the offset is `offsetPolyline` (ADR-358, +offset = left of travel), each branch
 * re-tap is `getNearestPointOnLine` (ADR-065), and the repair reuses `findOrthogonalPath` (the
 * router's own A\*) — no bespoke geometry.
 *
 * Residual (v1): (a) on very tight U-turn detours the miter offset can self-intersect (cosmetic);
 * (b) if a branch's re-tap point lands INSIDE a wall band (the offset spine pokes deeper into a
 * wall than the reference's standoff), that branch can't be cleanly detoured and degrades to the
 * straight `findOrthogonalPath` fallback (may clip) — same graceful fallback as `route-wall-aware`.
 * Both are wall-crossing-by-fallback, never a crash. Documented, deferred.
 *
 * Pure + deterministic.
 *
 * @see ../heating/pair-supply-return.ts (heating wrapper — DN-aware offset)
 * @see ../water/pair-cold-hot.ts (water wrapper — fixed `hotSpineOffsetMm`)
 * @see ./route-wall-aware.ts (the same A\* detour machinery, applied to the reference spine)
 * @see ../../../rendering/entities/shared/geometry-offset-utils.ts (offsetPolyline)
 * @see ../../../rendering/entities/shared/geometry-utils.ts (getNearestPointOnLine)
 */

import type { Point2D, Point3D } from '../../../rendering/types/Types';
import { offsetPolyline } from '../../../rendering/entities/shared/geometry-offset-utils';
import { getNearestPointOnLine } from '../../../rendering/entities/shared/geometry-utils';
import { findOrthogonalPath, type AStarOptions } from './astar-grid';
import { segmentHitsObstacles } from './wall-obstacles';
import type { Rect2D } from './routing-constants';

const COINCIDENT_EPS = 1e-6;

/** A single axis-aligned run (the caller maps it to its own typed segment). */
export interface OffsetRun {
  readonly start: Point2D;
  readonly end: Point2D;
}

/** An offset trunk run, tagged with the `referenceTrunks` index it parallels. */
export interface OffsetTrunkRun extends OffsetRun {
  readonly sourceTrunkIndex: number;
}

/** The root stub bridging `root` → an offset arm start, tagged with that arm's first trunk index. */
export interface OffsetStubRun extends OffsetRun {
  readonly armFirstTrunkIndex: number;
}

/** A re-tap branch, tagged with the `retapTargets` index it reaches. */
export interface OffsetBranchRun extends OffsetRun {
  readonly targetIndex: number;
}

/** The geometric result: offset trunks + root stub(s) + re-tap branches (all index-tagged). */
export interface OffsetPairing {
  readonly trunks: readonly OffsetTrunkRun[];
  readonly stubs: readonly OffsetStubRun[];
  readonly branches: readonly OffsetBranchRun[];
}

/** Optional wall-aware repair: detour any offset run that lands on a wall (Slice 3C). */
export interface OffsetPairingOptions {
  readonly obstacles?: readonly Rect2D[];
  readonly astar?: AStarOptions;
}

function near(a: Point2D, b: Point2D): boolean {
  return Math.abs(a.x - b.x) < COINCIDENT_EPS && Math.abs(a.y - b.y) < COINCIDENT_EPS;
}

const to3d = (p: Point2D): Point3D => ({ x: p.x, y: p.y, z: 0 });

/**
 * Chain the trunk runs head-to-tail from `sourcePoint` outward into ≤2 arms (the Manhattan
 * router splits at most into a left + right arm; an A\* detour is just extra collinear runs in
 * the chain). Each arm is the ordered list of its trunk INDICES into `trunks` — kept (not the
 * runs) so the caller copies each run's metadata by index.
 */
function reconstructArms(trunks: readonly OffsetRun[], sourcePoint: Point2D): number[][] {
  const used = new Set<number>();
  const arms: number[][] = [];
  for (let i = 0; i < trunks.length; i++) {
    if (used.has(i) || !near(trunks[i].start, sourcePoint)) continue;
    const chain: number[] = [i];
    used.add(i);
    let cur = trunks[i];
    for (let guard = 0; guard < trunks.length; guard++) {
      const nextIdx = trunks.findIndex((t, j) => !used.has(j) && near(t.start, cur.end));
      if (nextIdx < 0) break;
      used.add(nextIdx);
      cur = trunks[nextIdx];
      chain.push(nextIdx);
    }
    arms.push(chain);
  }
  return arms;
}

/**
 * Offset one arm: lateral-offset its polyline (each run tagged with its source index) plus the
 * root stub bridging `root` to the offset arm's start (tagged with the arm's first trunk index).
 */
function buildArmOffset(
  armIndices: readonly number[],
  referenceTrunks: readonly OffsetRun[],
  offsetMm: number,
  root: Point2D,
): { readonly stub: OffsetStubRun | null; readonly armTrunks: readonly OffsetTrunkRun[] } {
  const arm = armIndices.map((idx) => referenceTrunks[idx]);
  const pts: Point2D[] = [arm[0].start, ...arm.map((s) => s.end)];
  // offsetPolyline returns Point3D (z preserved); drop z back to clean Point2D for the runs.
  const offsetPts: Point2D[] = offsetPolyline(pts.map(to3d), offsetMm, { join: 'miter' }).map(
    (p) => ({ x: p.x, y: p.y }),
  );
  if (offsetPts.length < 2) return { stub: null, armTrunks: [] };
  const stub: OffsetStubRun | null = near(root, offsetPts[0])
    ? null
    : { start: root, end: offsetPts[0], armFirstTrunkIndex: armIndices[0] };
  const armTrunks: OffsetTrunkRun[] = arm.map((_, i) => ({
    start: offsetPts[i],
    end: offsetPts[i + 1],
    sourceTrunkIndex: armIndices[i],
  }));
  return { stub, armTrunks };
}

/**
 * Split one run into wall-avoiding sub-runs: pass-through when no obstacles / no hit / no path,
 * else the A\* detour as consecutive [start,end] pairs (same machinery as `route-wall-aware.ts`).
 */
function repairPath(
  start: Point2D,
  end: Point2D,
  obstacles: readonly Rect2D[] | undefined,
  astar: AStarOptions,
): Array<{ readonly start: Point2D; readonly end: Point2D }> {
  if (!obstacles || obstacles.length === 0 || !segmentHitsObstacles(start, end, obstacles)) {
    return [{ start, end }];
  }
  const path = findOrthogonalPath(start, end, obstacles, astar);
  if (!path || path.length < 2) return [{ start, end }];
  const segs: Array<{ start: Point2D; end: Point2D }> = [];
  for (let i = 0; i < path.length - 1; i++) segs.push({ start: path[i], end: path[i + 1] });
  return segs;
}

/** Re-tap one target: nearest point on any offset run (stub or trunk) → the target. */
function retapBranch(
  target: Point2D,
  targetIndex: number,
  lines: readonly OffsetRun[],
): OffsetBranchRun | null {
  let best: { point: Point2D; dist: number } | null = null;
  for (const t of lines) {
    const p = getNearestPointOnLine(target, t.start, t.end, true);
    const dist = Math.hypot(p.x - target.x, p.y - target.y);
    if (!best || dist < best.dist) best = { point: p, dist };
  }
  if (!best || near(best.point, target)) return null;
  return { start: best.point, end: target, targetIndex };
}

interface PairingAcc {
  readonly trunks: OffsetTrunkRun[];
  readonly stubs: OffsetStubRun[];
  /** Re-tap order matches the legacy pass (per arm: stub then trunks) ⇒ tie-break unchanged. */
  readonly retapLines: OffsetRun[];
}

/** Build one arm's offset runs (stub + trunks), wall-repairing each, into the accumulator. */
function emitArm(
  armIndices: readonly number[],
  referenceTrunks: readonly OffsetRun[],
  offsetMm: number,
  root: Point2D,
  obstacles: readonly Rect2D[] | undefined,
  astar: AStarOptions,
  acc: PairingAcc,
): void {
  const { stub, armTrunks } = buildArmOffset(armIndices, referenceTrunks, offsetMm, root);
  if (stub) {
    for (const seg of repairPath(stub.start, stub.end, obstacles, astar)) {
      const piece: OffsetStubRun = { ...seg, armFirstTrunkIndex: stub.armFirstTrunkIndex };
      acc.stubs.push(piece);
      acc.retapLines.push(piece);
    }
  }
  for (const t of armTrunks) {
    for (const seg of repairPath(t.start, t.end, obstacles, astar)) {
      const piece: OffsetTrunkRun = { ...seg, sourceTrunkIndex: t.sourceTrunkIndex };
      acc.trunks.push(piece);
      acc.retapLines.push(piece);
    }
  }
}

/**
 * Build the offset (twin) network geometry of `referenceTrunks`. The result is pure index-tagged
 * geometry — the caller maps each run to its own typed segment, copying flow/LU/DN by index.
 *
 * @param referenceTrunks      the reference spine's trunk runs (role-filtered, in order).
 * @param referenceSourcePoint the reference network's source (where its arms chain from).
 * @param root                 the offset network's root (where each arm's stub starts).
 * @param retapTargets         each terminal the offset network must reach (one branch each).
 * @param offsetMm             lateral offset distance (+ = left of travel).
 * @param opts                 optional `{ obstacles, astar }` for wall-aware repair (Slice 3C).
 */
export function buildOffsetPairing(
  referenceTrunks: readonly OffsetRun[],
  referenceSourcePoint: Point2D,
  root: Point2D,
  retapTargets: readonly Point2D[],
  offsetMm: number,
  opts: OffsetPairingOptions = {},
): OffsetPairing {
  const { obstacles, astar = {} } = opts;
  const arms = reconstructArms(referenceTrunks, referenceSourcePoint);
  const acc: PairingAcc = { trunks: [], stubs: [], retapLines: [] };
  for (const armIndices of arms) {
    emitArm(armIndices, referenceTrunks, offsetMm, root, obstacles, astar, acc);
  }
  const branches: OffsetBranchRun[] = [];
  retapTargets.forEach((target, i) => {
    const branch = retapBranch(target, i, acc.retapLines);
    if (!branch) return;
    for (const seg of repairPath(branch.start, branch.end, obstacles, astar)) {
      branches.push({ ...seg, targetIndex: i });
    }
  });
  return { trunks: acc.trunks, stubs: acc.stubs, branches };
}

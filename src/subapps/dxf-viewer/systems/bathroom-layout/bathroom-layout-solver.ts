/**
 * Bathroom Auto-Layout **solver** (rule-based generative space planner) · ADR-638.
 *
 * `solveBathroomLayout(room)` returns up to N ranked candidate arrangements. It
 * enumerates a small set of deterministic placement STRATEGIES (which walls carry
 * which fixtures, in which order), packs each fixture wall-hugging via a scan that
 * steps past the door keep-clear zone, validates every placement (inside room, no
 * footprint collision, no intrusion into another fixture's approach zone or the
 * door swing), then scores + dedupes + sorts. Pure, headless, millimetres.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-638-bathroom-auto-layout-generator.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Point3D } from '../../bim/types/bim-base';
import type {
  BathroomLayoutSolution,
  FixtureFootprintSpec,
  FixturePlacement,
  LayoutFixtureKind,
  RoomInput,
  SolveOptions,
} from './bathroom-layout-types';
import { resolveFixtureSpecs } from './sanitary-clearance-spec';
import { buildFixtureRects, segmentRoomWalls, type PlacedRects, type RoomWall } from './room-walls';
import { allCornersInside, areaOf, lift, rectOverlapMm2 } from './layout-geometry';
import { scoreLayout } from './bathroom-layout-scoring';

/** Resolved defaults (all mm except counts). */
interface ResolvedOpts {
  readonly maxSolutions: number;
  readonly gapMm: number;
  readonly wallMarginMm: number;
}

/** One placement strategy: a wall visiting order + whether the door wall is off-limits. */
interface PackParams {
  readonly wallOrder: readonly number[];
  readonly excludeDoorWallIndex: number; // -1 ⇒ nothing excluded
  readonly label: string;
}

/** Scan resolution (mm) when sliding a fixture along a wall past obstacles. */
const SCAN_STEP_MM = 50;

/** The wall whose midpoint is nearest the door keep-clear centroid (-1 if none). */
function deriveDoorWallIndex(
  walls: readonly RoomWall[],
  keep: readonly Point2D[] | undefined,
): number {
  if (!keep || keep.length < 3) return -1;
  const cx = keep.reduce((s, p) => s + p.x, 0) / keep.length;
  const cy = keep.reduce((s, p) => s + p.y, 0) / keep.length;
  let best = -1;
  let bestD = Infinity;
  for (const w of walls) {
    const mx = (w.a.x + w.b.x) / 2;
    const my = (w.a.y + w.b.y) / 2;
    const d = Math.hypot(mx - cx, my - cy);
    if (d < bestD) { bestD = d; best = w.index; }
  }
  return best;
}

/** True when a candidate rectangle set is a legal placement given what's already down. */
function isPlacementValid(
  rects: PlacedRects,
  placed: readonly FixturePlacement[],
  roomLifted: readonly Point3D[],
  doorKeepClear: readonly Point2D[] | undefined,
  fixtureAreaMm2: number,
): boolean {
  if (!allCornersInside(rects.footprint, roomLifted)) return false;
  const tol = 0.02 * fixtureAreaMm2;
  for (const p of placed) {
    if (rectOverlapMm2(rects.footprint, p.footprint) > tol) return false;
    if (rectOverlapMm2(rects.footprint, p.useZone) > tol) return false;
  }
  if (doorKeepClear && doorKeepClear.length >= 3) {
    if (rectOverlapMm2(rects.footprint, doorKeepClear) > tol) return false;
  }
  return true;
}

/** Try to slide `spec` along `wall` from `cursor`; return the placement + advanced cursor, or null. */
function tryPlaceOnWall(
  wall: RoomWall,
  spec: FixtureFootprintSpec,
  cursor: number,
  placed: readonly FixturePlacement[],
  roomLifted: readonly Point3D[],
  doorKeepClear: readonly Point2D[] | undefined,
  opts: ResolvedOpts,
): { placement: FixturePlacement; nextCursor: number } | null {
  const area = spec.widthMm * spec.depthMm;
  const maxS = wall.lengthMm - spec.widthMm / 2 - opts.wallMarginMm;
  let s = cursor + spec.widthMm / 2;
  while (s <= maxS) {
    const rects = buildFixtureRects(wall, s, spec.widthMm, spec.depthMm, spec.frontClearanceMm);
    if (isPlacementValid(rects, placed, roomLifted, doorKeepClear, area)) {
      const gap = Math.max(opts.gapMm, spec.sideClearanceMm);
      return {
        placement: {
          kind: spec.kind,
          center: rects.center,
          rotationDeg: rects.rotationDeg,
          widthMm: spec.widthMm,
          depthMm: spec.depthMm,
          footprint: rects.footprint,
          useZone: rects.useZone,
          wallIndex: wall.index,
        },
        nextCursor: s + spec.widthMm / 2 + gap,
      };
    }
    s += SCAN_STEP_MM;
  }
  return null;
}

/** Pack all fixtures for one strategy; returns placements + any that didn't fit. */
function packLayout(
  walls: readonly RoomWall[],
  specs: readonly FixtureFootprintSpec[],
  roomLifted: readonly Point3D[],
  doorKeepClear: readonly Point2D[] | undefined,
  params: PackParams,
  opts: ResolvedOpts,
): { placements: FixturePlacement[]; unplaced: LayoutFixtureKind[] } {
  const cursors = new Map<number, number>(walls.map((w) => [w.index, opts.wallMarginMm]));
  const placements: FixturePlacement[] = [];
  const unplaced: LayoutFixtureKind[] = [];
  for (const spec of specs) {
    let done = false;
    for (const wi of params.wallOrder) {
      if (wi === params.excludeDoorWallIndex) continue;
      const wall = walls[wi];
      if (!wall || wall.lengthMm < spec.widthMm + 2 * opts.wallMarginMm) continue;
      const res = tryPlaceOnWall(wall, spec, cursors.get(wi) ?? opts.wallMarginMm, placements, roomLifted, doorKeepClear, opts);
      if (res) {
        placements.push(res.placement);
        cursors.set(wi, res.nextCursor);
        done = true;
        break;
      }
    }
    if (!done) unplaced.push(spec.kind);
  }
  return { placements, unplaced };
}

/** The deterministic strategy set (distinct wall orders → distinct, comparable layouts). */
function buildCandidateParamSets(
  walls: readonly RoomWall[],
  doorWallIndex: number,
): PackParams[] {
  const byLenDesc = [...walls].sort((a, b) => b.lengthMm - a.lengthMm).map((w) => w.index);
  const byLenAsc = [...byLenDesc].reverse();
  const doorLast =
    doorWallIndex >= 0
      ? byLenDesc.filter((i) => i !== doorWallIndex).concat(doorWallIndex)
      : byLenDesc;
  const rot1 = byLenDesc.length > 1 ? [...byLenDesc.slice(1), byLenDesc[0]] : byLenDesc;
  return [
    { wallOrder: doorLast, excludeDoorWallIndex: doorWallIndex, label: 'strategy.wetGroup' },
    { wallOrder: byLenDesc, excludeDoorWallIndex: -1, label: 'strategy.longestWall' },
    { wallOrder: byLenAsc, excludeDoorWallIndex: doorWallIndex, label: 'strategy.compact' },
    { wallOrder: doorLast, excludeDoorWallIndex: -1, label: 'strategy.perimeter' },
    { wallOrder: rot1, excludeDoorWallIndex: doorWallIndex, label: 'strategy.alt' },
  ];
}

/** Grid-rounded signature (50 mm) so near-identical strategy outputs dedupe. */
function signatureOf(placements: readonly FixturePlacement[]): string {
  return placements
    .map((p) => `${p.kind}@${Math.round(p.center.x / 50)},${Math.round(p.center.y / 50)}#${p.wallIndex}`)
    .sort()
    .join('|');
}

/**
 * Generate up to `maxSolutions` ranked bathroom layouts for `input`. Returns `[]`
 * for a degenerate room (< 3 walls) or an empty fixture list. Solutions are sorted
 * best-first; ties broken deterministically by id.
 */
export function solveBathroomLayout(
  input: RoomInput,
  options?: SolveOptions,
): BathroomLayoutSolution[] {
  const opts: ResolvedOpts = {
    maxSolutions: options?.maxSolutions ?? 3,
    gapMm: options?.gapMm ?? 50,
    wallMarginMm: options?.wallMarginMm ?? 50,
  };
  const walls = segmentRoomWalls(input.polygonMm);
  const specs = resolveFixtureSpecs(input.fixtures);
  if (walls.length < 3 || specs.length === 0) return [];

  const roomLifted = lift(input.polygonMm);
  const roomAreaMm2 = areaOf(input.polygonMm);
  const doorKeepClear = input.doorKeepClearMm;
  const doorWallIndex = deriveDoorWallIndex(walls, doorKeepClear);
  const paramSets = buildCandidateParamSets(walls, doorWallIndex);

  const seen = new Set<string>();
  const solutions: BathroomLayoutSolution[] = [];
  for (const params of paramSets) {
    const { placements, unplaced } = packLayout(walls, specs, roomLifted, doorKeepClear, params, opts);
    const sig = signatureOf(placements);
    if (seen.has(sig)) continue;
    seen.add(sig);
    const { score, breakdown } = scoreLayout({
      placements,
      requestedCount: specs.length,
      roomLifted,
      roomAreaMm2,
      doorKeepClear,
      wetWallHintIndex: input.wetWallHintIndex,
    });
    solutions.push({
      id: `${params.label}:${sig || 'empty'}`,
      strategy: params.label,
      placements,
      score,
      scoreBreakdown: breakdown,
      warnings: unplaced.length ? [`unplaced:${unplaced.join(',')}`] : [],
    });
  }
  solutions.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return solutions.slice(0, opts.maxSolutions);
}

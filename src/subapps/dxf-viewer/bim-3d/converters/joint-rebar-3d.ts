/**
 * ADR-473 — 3Δ joint reinforcement: dowels / laps / anchorages at structural joints.
 *
 * Pure geometry POST-PASS (mirror ADR-458 beam-column cutback): cross-member
 * geometry CANNOT live in per-entity caches. Consumes the organism continuity
 * result (`reinforcement-continuity.ts`) → THREE.Group of rods per joint type:
 *
 *   - `dowel`     (footing→column base):  vertical rods straddling the interface,
 *                                          at exact column bar positions (cage parity).
 *   - `anchorage` (beam→column joint):    horizontal stubs at beam end pointing INTO column.
 *   - `anchorage` (column→top host):      vertical stubs from column top INTO host.
 *   - `lap`       (column↔column floor):  vertical overlap zone at floor interface.
 *
 * Reuses `rebar-3d-shared` primitives (buildRods / REBAR_MATERIAL / toThree / MM_TO_M).
 * Rods are grouped by diameter → one InstancedMesh per Ø (correct radius per bar).
 * DERIVED, NEVER persisted.
 *
 * @see ../../bim/structural/organism/reinforcement-continuity.ts — math SSoT
 * @see ./rebar-3d-shared.ts — geometry primitives
 * @see docs/centralized-systems/reference/adrs/ADR-473-joint-reinforcement-render-takeoff.md
 */

import * as THREE from 'three';
import type { Entity } from '../../types/entities';
import { isColumnEntity, isBeamEntity } from '../../types/entities';
import type { StructuralCodeProvider } from '../../bim/structural/codes/structural-code-types';
import type {
  OrganismContinuityResult,
  ReinforcementContinuityItem,
} from '../../bim/structural/organism/reinforcement-continuity';
import type { StructuralGraph, StructuralNode } from '../../bim/structural/organism/structural-organism-types';
import type { ColumnEntity } from '../../bim/types/column-types';
import type { BeamEntity } from '../../bim/types/beam-types';
import { columnLocalMmToWorld } from '../../bim/geometry/column-geometry';
import { scalePoints } from '../../rendering/entities/shared/geometry-vector-utils';
import { sceneUnitsToMeters } from '../../utils/scene-units';
import { resolveActiveColumnReinforcementForParams } from '../../bim/structural/active-reinforcement';
import { resolveColumnReinforcementSection } from '../../bim/structural/reinforcement/column-section-outline';
import { resolveColumnRebarLayout } from '../../bim/structural/reinforcement/column-rebar-layout-resolve';
import { MM_TO_M, MIN_RADIUS, REBAR_MATERIAL, buildRods, toThree, type Seg } from './rebar-3d-shared';

/** Max rods rendered per joint — prevents visual clutter on heavily reinforced sections. */
const MAX_JOINT_RODS = 8;

// ─── Plan-space helpers (canvas-unit geometry) ───────────────────────────────

function centroid(pts: readonly { x: number; y: number }[]): { x: number; y: number } {
  if (!pts.length) return { x: 0, y: 0 };
  const s = pts.reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y }), { x: 0, y: 0 });
  return { x: s.x / pts.length, y: s.y / pts.length };
}

function dist2(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

function planDir(from: { x: number; y: number }, to: { x: number; y: number }): { x: number; y: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const l = Math.sqrt(dx * dx + dy * dy);
  return l > 1e-9 ? { x: dx / l, y: dy / l } : { x: 1, y: 0 };
}

// ─── Column bar positions helper (shared by dowel / lap / top-anchorage) ─────

function columnBarPositions(
  colEntity: ColumnEntity,
): { x: number; y: number }[] | null {
  const r = resolveActiveColumnReinforcementForParams(colEntity.params);
  if (!r) return null;
  const section = resolveColumnReinforcementSection(colEntity.params);
  const layout = resolveColumnRebarLayout(r, section);
  if (!layout) return null;
  const sceneToM = sceneUnitsToMeters(colEntity.params.sceneUnits ?? 'mm');
  const world = scalePoints(columnLocalMmToWorld(colEntity.params, layout.longitudinalBarsMm), sceneToM);
  return world.slice(0, MAX_JOINT_RODS);
}

// ─── Dowels: vertical rods straddling footing↔column interface ───────────────

/**
 * Vertical rods at EXACT column bar positions (cage parity): anchored inside
 * footing (lbd) and lapping with column bars (l₀).
 */
function dowelSegs(
  item: ReinforcementContinuityItem,
  colNode: StructuralNode,
  ftgNode: StructuralNode,
  colEntity: ColumnEntity,
  provider: StructuralCodeProvider,
): Seg[] {
  const bars = columnBarPositions(colEntity);
  if (!bars) return [];
  const anchorMm = provider.anchorageLengthMm(item.diameterMm);
  const lapMm = provider.lapLengthMm(item.diameterMm);
  const bottomY = (ftgNode.topZmm - anchorMm) * MM_TO_M;
  const topY = (colNode.baseZmm + lapMm) * MM_TO_M;
  if (topY <= bottomY) return [];
  return bars.map((pt) => ({ a: toThree(pt, bottomY), b: toThree(pt, topY) }));
}

// ─── Anchorage: beam bars entering column horizontally ───────────────────────

/**
 * Short horizontal rods at the beam end nearest to the column, pointing INTO
 * the column. Bars stacked vertically across the beam depth (bottom→top).
 */
function anchorageBeamSegs(
  item: ReinforcementContinuityItem,
  beamNode: StructuralNode,
  colNode: StructuralNode,
  beamEntity: BeamEntity,
): Seg[] {
  const axis = beamEntity.geometry.axisPolyline.points;
  if (axis.length < 2) return [];
  const sceneToM = sceneUnitsToMeters(beamEntity.params.sceneUnits ?? 'mm');
  const colCx = centroid(colNode.footprint ?? []);
  const endPt = dist2(axis[0], colCx) <= dist2(axis[axis.length - 1], colCx)
    ? axis[0]
    : axis[axis.length - 1];
  const dir = planDir(endPt, colCx);
  const anchorLenCanvas = item.lengthMm; // mm = canvas units under canonical-mm
  const count = Math.min(item.count, MAX_JOINT_RODS);
  const depthM = beamEntity.params.depth * MM_TO_M;
  const segs: Seg[] = [];
  for (let i = 0; i < count; i++) {
    const frac = count > 1 ? i / (count - 1) : 0.5;
    const worldY = beamNode.baseZmm * MM_TO_M + depthM * 0.1 + depthM * 0.8 * frac;
    const ax = endPt.x * sceneToM;
    const az = -(endPt.y * sceneToM);
    const bx = (endPt.x + dir.x * anchorLenCanvas) * sceneToM;
    const bz = -((endPt.y + dir.y * anchorLenCanvas) * sceneToM);
    segs.push({ a: new THREE.Vector3(ax, worldY, az), b: new THREE.Vector3(bx, worldY, bz) });
  }
  return segs;
}

// ─── Column top anchorage: bars extending UP from column into host ────────────

/** Vertical rods extending from column top INTO the host (beam/slab). */
function anchorageColumnTopSegs(
  item: ReinforcementContinuityItem,
  colNode: StructuralNode,
  colEntity: ColumnEntity,
): Seg[] {
  const bars = columnBarPositions(colEntity);
  if (!bars) return [];
  const bottomY = colNode.topZmm * MM_TO_M;
  const topY = bottomY + item.lengthMm * MM_TO_M;
  return bars.map((pt) => ({ a: toThree(pt, bottomY), b: toThree(pt, topY) }));
}

// ─── Laps: column↔column floor-interface overlap ─────────────────────────────

/**
 * Vertical rods straddling the floor interface (±l₀/2), at lower column bar
 * positions — showing the overlap zone where both members' bars co-exist.
 */
function lapSegs(
  item: ReinforcementContinuityItem,
  lowerColNode: StructuralNode,
  lowerColEntity: ColumnEntity,
  provider: StructuralCodeProvider,
): Seg[] {
  const bars = columnBarPositions(lowerColEntity);
  if (!bars) return [];
  const lapMm = provider.lapLengthMm(item.diameterMm);
  const interfaceY = lowerColNode.topZmm * MM_TO_M;
  const bottomY = interfaceY - (lapMm / 2) * MM_TO_M;
  const topY = interfaceY + (lapMm / 2) * MM_TO_M;
  if (topY <= bottomY) return [];
  return bars.map((pt) => ({ a: toThree(pt, bottomY), b: toThree(pt, topY) }));
}

// ─── Per-item seg dispatch ────────────────────────────────────────────────────

function segsForItem(
  item: ReinforcementContinuityItem,
  fromNode: StructuralNode,
  toNode: StructuralNode,
  fromEntity: Entity | undefined,
  provider: StructuralCodeProvider,
): Seg[] {
  switch (item.kind) {
    case 'dowel':
      if (fromEntity && isColumnEntity(fromEntity)) {
        return dowelSegs(item, fromNode, toNode, fromEntity, provider);
      }
      return [];
    case 'anchorage':
      if (fromEntity && isBeamEntity(fromEntity)) {
        return anchorageBeamSegs(item, fromNode, toNode, fromEntity);
      }
      if (fromEntity && isColumnEntity(fromEntity)) {
        return anchorageColumnTopSegs(item, fromNode, fromEntity);
      }
      return [];
    case 'lap':
      if (fromEntity && isColumnEntity(fromEntity)) {
        return lapSegs(item, fromNode, fromEntity, provider);
      }
      return [];
  }
}

// ─── Main builder (public) ────────────────────────────────────────────────────

/**
 * Builds a THREE.Group of joint reinforcement meshes (one InstancedMesh per Ø).
 * Called as a scene-level post-pass AFTER all per-member cages are built.
 * Returns null when there are no joint items (organism has no connected members).
 */
export function buildJointRebarGroup(
  continuity: OrganismContinuityResult,
  graph: StructuralGraph,
  entityById: ReadonlyMap<string, Entity>,
  provider: StructuralCodeProvider,
): THREE.Group | null {
  if (continuity.items.length === 0) return null;

  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const segsByDiam = new Map<number, Seg[]>();

  for (const item of continuity.items) {
    const fromNode = nodeById.get(item.fromMemberId);
    const toNode = nodeById.get(item.toMemberId);
    if (!fromNode || !toNode) continue;

    const newSegs = segsForItem(
      item, fromNode, toNode, entityById.get(item.fromMemberId), provider,
    );
    if (newSegs.length === 0) continue;

    const bucket = segsByDiam.get(item.diameterMm) ?? [];
    bucket.push(...newSegs);
    segsByDiam.set(item.diameterMm, bucket);
  }

  if (segsByDiam.size === 0) return null;

  const group = new THREE.Group();
  for (const [diam, segs] of segsByDiam) {
    const radius = Math.max(MIN_RADIUS, (diam / 2) * MM_TO_M);
    const mesh = buildRods(segs, radius, REBAR_MATERIAL);
    if (mesh) group.add(mesh);
  }

  if (group.children.length === 0) return null;
  group.userData['bimType'] = 'joint-reinforcement';
  return group;
}

/**
 * Structural Organism — connectivity graph builder (ADR-459, Phase 0).
 *
 * Pure function: `buildStructuralGraph(entities)` → DERIVED graph (nodes = δομικά
 * μέλη footing/column/beam, edges = στατικές συνδέσεις). Re-derived σε κάθε
 * structural αλλαγή — ΠΟΤΕ persisted. SSoT = τα params των entities.
 *
 * REUSE (N.0.2 Boy Scout — μηδέν duplicate detection logic):
 *   · `findColumnsFramedByBeam` (column-structural-attach-coordinator) → framing edges
 *   · `resolveColumnBaseZmm` (column-vertical-profile) → column base Z
 *   · `beamHostInput` / `slabHostInput` (wall-host-plan-builder) → footprint + Z extents
 *   · `attachTopToIds` (ColumnParams) → top-attachment edges
 *   · `isPointInPolygon` (GeometryUtils) → footing-under-column coverage
 *
 * @see structural-organism-types.ts
 * @see docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md
 */

import type { Entity } from '../../../types/entities';
import {
  isColumnEntity,
  isBeamEntity,
  isFoundationEntity,
  isSlabEntity,
} from '../../../types/entities';
import { isPointInPolygon } from '../../../utils/geometry/GeometryUtils';
import { mmToSceneUnits } from '../../../utils/scene-units';
import { resolveColumnBaseZmm } from '../../geometry/column-vertical-profile';
import { beamHostInput, slabHostInput } from '../../geometry/wall-host-plan-builder';
import { findColumnsFramedByBeam } from '../../columns/column-structural-attach-coordinator';
import type { ColumnEntity } from '../../types/column-types';
import type { BeamEntity } from '../../types/beam-types';
import type { FoundationEntity } from '../../types/foundation-types';
import type { SlabEntity } from '../../types/slab-types';
import type {
  OrganismPoint,
  StructuralEdge,
  StructuralGraph,
  StructuralNode,
} from './structural-organism-types';

/**
 * mm. Ένα πέδιλο στηρίζει τη βάση κολόνας μόνο όταν η άνω παρειά του δεν είναι
 * ΠΑΝΩ από τη βάση της κολόνας (ίδια λογική με τον AUTO_ATTACH_Z_GATE_MM).
 */
const FOOTING_Z_GATE_MM = 1;

/** Point3D[] (ή Pt2[]) → plan polygon (canvas units, x/y μόνο). */
function toPlan(vertices: readonly { x: number; y: number }[]): OrganismPoint[] {
  return vertices.map((v) => ({ x: v.x, y: v.y }));
}

// ─── Node builders ───────────────────────────────────────────────────────────

function foundationNode(f: FoundationEntity): StructuralNode | null {
  const verts = f.geometry?.footprint?.vertices;
  if (!verts || verts.length < 3) return null;
  const topZmm = f.params.topElevationMm;
  return {
    id: f.id,
    memberKind: 'footing',
    entityType: 'foundation',
    footprint: toPlan(verts),
    baseZmm: topZmm - f.params.thicknessMm,
    topZmm,
  };
}

/** Foundation/ground πλάκα (raft/εδαφόπλακα) = footing node (έδραση από κάτω). */
function foundationSlabNode(s: SlabEntity): StructuralNode | null {
  const input = slabHostInput(s);
  if (input.footprint.length < 3) return null;
  const topZmm = input.topsideZmm ?? input.undersideZmm;
  return {
    id: s.id,
    memberKind: 'footing',
    entityType: 'foundation-slab',
    footprint: toPlan(input.footprint),
    baseZmm: input.undersideZmm,
    topZmm,
  };
}

function columnNode(c: ColumnEntity): StructuralNode | null {
  const verts = c.geometry?.footprint?.vertices;
  if (!verts || verts.length < 3) return null;
  const baseZmm = resolveColumnBaseZmm(c.params, { floorElevationMm: 0 });
  return {
    id: c.id,
    memberKind: 'column',
    entityType: 'column',
    footprint: toPlan(verts),
    baseZmm,
    topZmm: baseZmm + c.params.height,
  };
}

function beamNode(b: BeamEntity): StructuralNode {
  const input = beamHostInput(b);
  const perScene = mmToSceneUnits(b.params.sceneUnits ?? 'mm');
  return {
    id: b.id,
    memberKind: 'beam',
    entityType: 'beam',
    axis: {
      start: { x: b.params.startPoint.x, y: b.params.startPoint.y },
      end: { x: b.params.endPoint.x, y: b.params.endPoint.y },
      halfWidth: (b.params.width / 2) * perScene,
    },
    supportType: b.params.supportType ?? 'simple',
    baseZmm: input.undersideZmm,
    topZmm: input.topsideZmm ?? input.undersideZmm,
  };
}

function isFoundationSlab(e: Entity): e is SlabEntity {
  return isSlabEntity(e) && (e.kind === 'foundation' || e.kind === 'ground');
}

function buildNodes(entities: readonly Entity[]): StructuralNode[] {
  const nodes: StructuralNode[] = [];
  for (const e of entities) {
    let node: StructuralNode | null = null;
    if (isFoundationEntity(e)) node = foundationNode(e);
    else if (isFoundationSlab(e)) node = foundationSlabNode(e);
    else if (isColumnEntity(e)) node = columnNode(e);
    else if (isBeamEntity(e)) node = beamNode(e);
    if (node) nodes.push(node);
  }
  return nodes;
}

// ─── Edge builders ───────────────────────────────────────────────────────────

const edgeId = (s: string, t: string, k: string): string => `${s}->${t}:${k}`;

/** Plan-centroid ενός footprint (μέσος όρος κορυφών). */
function centroid(poly: readonly OrganismPoint[]): OrganismPoint {
  let x = 0;
  let y = 0;
  for (const p of poly) {
    x += p.x;
    y += p.y;
  }
  return { x: x / poly.length, y: y / poly.length };
}

/**
 * footing-bearing ακμές: για κάθε κολόνα, βρες footing nodes (πέδιλο/εδαφόπλακα)
 * που (α) καλύπτουν στο plan το κέντρο της βάσης της και (β) έχουν άνω παρειά
 * όχι ψηλότερα από τη βάση της κολόνας.
 */
function buildFootingEdges(nodes: readonly StructuralNode[]): StructuralEdge[] {
  const footings = nodes.filter((n) => n.memberKind === 'footing' && n.footprint);
  const columns = nodes.filter((n) => n.memberKind === 'column' && n.footprint);
  const edges: StructuralEdge[] = [];
  for (const col of columns) {
    const base = centroid(col.footprint!);
    for (const f of footings) {
      if (f.topZmm > col.baseZmm + FOOTING_Z_GATE_MM) continue;
      if (!isPointInPolygon(base, [...f.footprint!])) continue;
      edges.push({ id: edgeId(f.id, col.id, 'footing-bearing'), supportId: f.id, supportedId: col.id, kind: 'footing-bearing' });
    }
  }
  return edges;
}

/**
 * column-bearing (framing) + top-attachment ακμές. Framing reuse του SSoT
 * `findColumnsFramedByBeam`· top-attachment από το persisted `attachTopToIds`.
 */
function buildFramingAndAttachEdges(
  entities: readonly Entity[],
  nodeIds: ReadonlySet<string>,
): StructuralEdge[] {
  const edges: StructuralEdge[] = [];
  for (const e of entities) {
    if (isBeamEntity(e)) {
      for (const colId of findColumnsFramedByBeam(e, entities)) {
        edges.push({ id: edgeId(colId, e.id, 'column-bearing'), supportId: colId, supportedId: e.id, kind: 'column-bearing' });
      }
    } else if (isColumnEntity(e)) {
      for (const hostId of e.params.attachTopToIds ?? []) {
        if (!nodeIds.has(hostId)) continue;
        edges.push({ id: edgeId(hostId, e.id, 'top-attachment'), supportId: hostId, supportedId: e.id, kind: 'top-attachment' });
      }
    }
  }
  return edges;
}

/**
 * Build the DERIVED structural organism graph από τα entities ενός ορόφου.
 * Pure — μηδέν side-effects, μηδέν mutation των entities.
 */
export function buildStructuralGraph(entities: readonly Entity[]): StructuralGraph {
  const nodes = buildNodes(entities);
  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges = [
    ...buildFootingEdges(nodes),
    ...buildFramingAndAttachEdges(entities, nodeIds),
  ];
  return { nodes, edges };
}

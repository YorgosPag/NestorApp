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
import { isColumnEntity, isBeamEntity } from '../../../types/entities';
import {
  footingSupportsColumnBase,
  polygonCentroid,
} from '../../foundations/footing-column-coverage';
import { isFootingElement, resolveFootingSummary } from '../../foundations/footing-element-summary';
import { mmToSceneUnits } from '../../../utils/scene-units';
import { resolveColumnBaseZmm } from '../../geometry/column-vertical-profile';
import { beamHostInput } from '../../geometry/wall-host-plan-builder';
import { findColumnsFramedByBeam } from '../../columns/column-structural-attach-coordinator';
import type { ColumnEntity } from '../../types/column-types';
import type { BeamEntity } from '../../types/beam-types';
import type {
  OrganismPoint,
  StructuralEdge,
  StructuralGraph,
  StructuralNode,
} from './structural-organism-types';

/** Point3D[] (ή Pt2[]) → plan polygon (canvas units, x/y μόνο). */
function toPlan(vertices: readonly { x: number; y: number }[]): OrganismPoint[] {
  return vertices.map((v) => ({ x: v.x, y: v.y }));
}

// ─── Node builders ───────────────────────────────────────────────────────────

/**
 * ADR-459 Phase 0 (cross-level) — options για τον graph builder. Όταν δίνεται
 * `floorElevationByEntityId`, το Z κάθε μέλους μετατοπίζεται στο **απόλυτο**
 * datum-relative frame (FFL του ορόφου του) ώστε μέλη από διαφορετικές σκηνές
 * (κολόνα ισογείου ↔ πέδιλο Θεμελίωσης) να συγκρίνονται σωστά. Παράλειψη / κενός
 * χάρτης → 0 (single-level, byte-for-byte η προηγούμενη συμπεριφορά).
 */
export interface BuildGraphOptions {
  readonly floorElevationByEntityId?: ReadonlyMap<string, number>;
}

/** Απόλυτο FFL (mm) ενός entity μέσω του χάρτη· 0 fallback (single-level). */
function elevationFor(options: BuildGraphOptions | undefined, id: string): number {
  return options?.floorElevationByEntityId?.get(id) ?? 0;
}

/** Footing node (πέδιλο/πεδιλοδοκός/συνδετήρια ή εδαφόπλακα) μέσω SSoT summary. */
function footingNode(e: Entity, floorElevationMm: number): StructuralNode | null {
  const s = resolveFootingSummary(e);
  if (!s) return null;
  return {
    id: e.id,
    memberKind: 'footing',
    entityType: s.entityType,
    footprint: s.footprint,
    baseZmm: s.baseZmm + floorElevationMm,
    topZmm: s.topZmm + floorElevationMm,
  };
}

function columnNode(c: ColumnEntity, floorElevationMm: number): StructuralNode | null {
  const verts = c.geometry?.footprint?.vertices;
  if (!verts || verts.length < 3) return null;
  const baseZmm = resolveColumnBaseZmm(c.params, { floorElevationMm });
  return {
    id: c.id,
    memberKind: 'column',
    entityType: 'column',
    footprint: toPlan(verts),
    footingId: c.params.footingId,
    baseZmm,
    topZmm: baseZmm + c.params.height,
  };
}

function beamNode(b: BeamEntity, floorElevationMm: number): StructuralNode {
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
    baseZmm: input.undersideZmm + floorElevationMm,
    topZmm: (input.topsideZmm ?? input.undersideZmm) + floorElevationMm,
  };
}

function buildNodes(entities: readonly Entity[], options?: BuildGraphOptions): StructuralNode[] {
  const nodes: StructuralNode[] = [];
  for (const e of entities) {
    const elev = elevationFor(options, e.id);
    let node: StructuralNode | null = null;
    if (isFootingElement(e)) node = footingNode(e, elev);
    else if (isColumnEntity(e)) node = columnNode(e, elev);
    else if (isBeamEntity(e)) node = beamNode(e, elev);
    if (node) nodes.push(node);
  }
  return nodes;
}

// ─── Edge builders ───────────────────────────────────────────────────────────

const edgeId = (s: string, t: string, k: string): string => `${s}->${t}:${k}`;

const footingEdge = (footingId: string, columnId: string): StructuralEdge => ({
  id: edgeId(footingId, columnId, 'footing-bearing'),
  supportId: footingId,
  supportedId: columnId,
  kind: 'footing-bearing',
});

/**
 * footing-bearing ακμές (ADR-459 Phase 2 — explicit-FK-wins):
 *   - Αν η κολόνα έχει ρητό `footingId` που δείχνει σε υπαρκτό footing node →
 *     ΜΟΝΟ αυτή η ακμή (authoritative)· stale FK → καμία ακμή → `columnMissingFooting`.
 *   - Αλλιώς (legacy/μη-attached): spatial-coincidence fallback μέσω του SSoT
 *     κριτηρίου `footingSupportsColumnBase` (πέδιλα/εδαφόπλακες που καλύπτουν στο
 *     plan το κέντρο βάσης + άνω παρειά όχι ψηλότερα από τη βάση).
 */
function buildFootingEdges(nodes: readonly StructuralNode[]): StructuralEdge[] {
  const footings = nodes.filter((n) => n.memberKind === 'footing' && n.footprint);
  const footingIds = new Set(footings.map((f) => f.id));
  const columns = nodes.filter((n) => n.memberKind === 'column' && n.footprint);
  const edges: StructuralEdge[] = [];
  for (const col of columns) {
    if (col.footingId !== undefined) {
      if (footingIds.has(col.footingId)) edges.push(footingEdge(col.footingId, col.id));
      continue; // ρητό FK = authoritative → δεν πέφτουμε σε spatial
    }
    const baseCentroid = polygonCentroid(col.footprint!);
    for (const f of footings) {
      if (footingSupportsColumnBase({ footprint: f.footprint!, topZmm: f.topZmm }, { baseCentroid, baseZmm: col.baseZmm })) {
        edges.push(footingEdge(f.id, col.id));
      }
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
export function buildStructuralGraph(
  entities: readonly Entity[],
  options?: BuildGraphOptions,
): StructuralGraph {
  const nodes = buildNodes(entities, options);
  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges = [
    ...buildFootingEdges(nodes),
    ...buildFramingAndAttachEdges(entities, nodeIds),
  ];
  return { nodes, edges };
}

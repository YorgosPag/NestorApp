/**
 * IFC4 Exporter Service (ADR-369 §Q8.3)
 *
 * Orchestrator that turns Nestor domain objects (Project + Buildings +
 * Floors) into a downloadable IFC4 STEP21 byte buffer. Entity geometry
 * serializers (walls / slabs / columns / beams / openings) plug in via
 * the optional `entitySerializer` hook and are written *after* the
 * spatial hierarchy is established (Q8.4).
 *
 * Q8.3 scope: spatial chain + units + geometric context. Q8.4+Q8.5 will
 * append building elements + property sets via the same `IfcGraph`.
 */

import type { Project } from '@/types/project';
import type { Building } from '@/types/building/contracts';
import type { FloorDocument } from '@/app/api/floors/floors.types';
import type { SceneModel } from '@/subapps/dxf-viewer/types/scene';

import { IfcGraph } from './ifc-entity-graph';
import {
  buildIfcSpatialHierarchy,
  type SpatialHierarchyOutput,
} from './ifc-spatial-hierarchy';
import {
  writeStepIfc,
  type IfcStepHeader,
} from './ifc-step-writer';

// ─── Public types ───────────────────────────────────────────────────────────

export interface IfcExportParams {
  readonly project: Project;
  readonly buildings: readonly Building[];
  readonly floors: readonly FloorDocument[];
  /** Optional per-floor scene used by entity serializers (Q8.4). */
  readonly scenes?: ReadonlyMap<string, SceneModel>;
  /** When true (default), include per-entity Property Sets (Q8.5). */
  readonly includePsets?: boolean;
  /** Optional STEP21 file header overrides. */
  readonly header?: Partial<IfcStepHeader>;
  /** Optional plugin that appends building elements after the spatial chain. */
  readonly entitySerializer?: IfcEntitySerializer;
}

export interface IfcExportResult {
  readonly bytes: Uint8Array;
  readonly fileName: string;
  /** Highest expressID assigned in the graph — useful for telemetry. */
  readonly entityCount: number;
}

/**
 * Plugin contract for Q8.4 element serializers. Receives the live graph
 * after the spatial chain is built, plus the storey lookup so each element
 * can attach to the correct `IfcBuildingStorey` via
 * `IfcRelContainedInSpatialStructure`.
 */
export interface IfcEntitySerializer {
  serializeEntities(
    graph: IfcGraph,
    spatial: SpatialHierarchyOutput,
    params: IfcExportParams,
  ): void;
}

// ─── Service ────────────────────────────────────────────────────────────────

export class IfcExporter {
  /**
   * Builds the complete IFC4 graph and returns it as a STEP21 byte buffer.
   * Synchronous on purpose — text emission is CPU-bound and avoids the
   * web-ifc WASM round-trip until tessellated geometry is required (Q8.6).
   */
  exportProject(params: IfcExportParams): IfcExportResult {
    const graph = new IfcGraph();
    const spatial = buildIfcSpatialHierarchy(graph, {
      project: params.project,
      buildings: params.buildings,
      floors: params.floors,
    });
    params.entitySerializer?.serializeEntities(graph, spatial, params);

    const fileName = sanitizeFileName(params.project.name) + '.ifc';
    const bytes = writeStepIfc(graph, {
      fileName,
      ...params.header,
    });
    return { bytes, fileName, entityCount: graph.lastId() };
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function sanitizeFileName(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return 'project';
  return trimmed.replace(/[\\/:*?"<>|]/g, '_');
}

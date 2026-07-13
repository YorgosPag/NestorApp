/**
 * ADR-650 Milestone 1 — contour lines → native CAD entity payloads.
 *
 * The final stage: turn derived {@link ContourLine}s into `lwpolyline` + `text` entities
 * that flow through `completeEntity` (ADR-057) — so contours get undo, persistence,
 * rendering, selection and export for FREE (the whole reason contours are native entities,
 * not a bespoke canvas layer). `lwpolyline` is the AutoCAD-native contour representation:
 * a 2D polyline carrying its elevation in the `elevation` field (each contour = one Z).
 *
 * Pure: layer ids are passed in (the hook owns layer lifecycle), so this stays unit-testable
 * and free of store side effects.
 */

import type { LWPolylineEntity, TextEntity } from '../../types/entities';
import { generateEntityId } from '@/services/enterprise-id.service';
import type { ContourLine } from './topo-types';
import type { ContourConfig } from './contour-config';
import {
  TOPO_MAJOR_COLOR, TOPO_MINOR_COLOR, TOPO_LABEL_COLOR, TOPO_LABEL_HEIGHT_MM,
} from './contour-config';

/** Layer ids the contour entities are assigned to (minted/ensured by the caller). */
export interface ContourLayerIds {
  readonly major: string;
  readonly minor: string;
  readonly label: string;
}

/** An lwpolyline is closed at the DXF level; drop the duplicated closing vertex. */
function toPolylineVertices(line: ContourLine): { x: number; y: number }[] {
  const v = line.vertices.map((p) => ({ x: p.x, y: p.y }));
  if (line.closed && v.length > 1) v.pop();
  return v;
}

/** Format an elevation (canonical mm) as a metre label, e.g. 12.50. */
export function formatElevationLabel(levelMm: number, decimals: number): string {
  return (levelMm / 1000).toFixed(decimals);
}

/** Build the lwpolyline entity for one contour line. */
function toPolylineEntity(line: ContourLine, layers: ContourLayerIds): LWPolylineEntity {
  return {
    id: generateEntityId(),
    type: 'lwpolyline',
    layerId: line.isMajor ? layers.major : layers.minor,
    color: line.isMajor ? TOPO_MAJOR_COLOR : TOPO_MINOR_COLOR,
    vertices: toPolylineVertices(line),
    closed: line.closed,
    elevation: line.level,
  };
}

/** Build an elevation label at the mid vertex of a major contour. */
function toLabelEntity(line: ContourLine, layers: ContourLayerIds, config: ContourConfig): TextEntity {
  const mid = line.vertices[Math.floor(line.vertices.length / 2)];
  return {
    id: generateEntityId(),
    type: 'text',
    layerId: layers.label,
    color: TOPO_LABEL_COLOR,
    position: { x: mid.x, y: mid.y },
    text: formatElevationLabel(line.level, config.labelDecimals),
    fontSize: TOPO_LABEL_HEIGHT_MM,
    height: TOPO_LABEL_HEIGHT_MM,
    alignment: 'center',
  };
}

/**
 * Convert contour lines into entity payloads (lwpolylines + optional major labels).
 * Lines with fewer than 2 vertices are skipped.
 */
export function buildContourEntities(
  contours: readonly ContourLine[],
  config: ContourConfig,
  layers: ContourLayerIds,
): (LWPolylineEntity | TextEntity)[] {
  const entities: (LWPolylineEntity | TextEntity)[] = [];
  for (const line of contours) {
    if (line.vertices.length < 2) continue;
    entities.push(toPolylineEntity(line, layers));
    if (config.labelMajors && line.isMajor && line.vertices.length >= 2) {
      entities.push(toLabelEntity(line, layers, config));
    }
  }
  return entities;
}

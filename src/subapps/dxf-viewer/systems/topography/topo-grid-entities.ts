/**
 * ADR-656 M11 — ΕΓΣΑ87 coordinate grid → native CAD entities (the export consumer).
 *
 * The «Bake to drawing» counterpart of the live screen graticule: turn the ONE pure
 * `TopoGridModel` into `line` + `text` entities that flow through `completeEntities`
 * (ADR-057) — so the baked grid gets undo, persistence, rendering, selection and DXF/PDF
 * export for FREE, exactly like the contours (`topo-to-entities`) and point labels
 * (`topo-point-labels`). No bespoke geometry: each cross is two short lines, each perimeter
 * label a text at the round coordinate in metres.
 *
 * Pure: the layer id is passed in (the hook owns the layer lifecycle), so this stays
 * unit-testable and free of store side effects.
 */

import type { LineEntity, TextEntity } from '../../types/entities';
import type { Point2D } from '../../rendering/types/Types';
import { generateEntityId } from '@/services/enterprise-id.service';
import { lengthMmToM } from '../../utils/scene-units';
import type { PerimeterLabel, TopoGridModel } from './topo-grid-model';
import {
  TOPO_GRID_COLOR, TOPO_GRID_LABEL_COLOR, TOPO_GRID_CROSS_WORLD_MM,
  TOPO_GRID_LABEL_HEIGHT_MM, TOPO_GRID_LABEL_DECIMALS,
} from './topo-grid-config';

type GridEntity = LineEntity | TextEntity;

/** One straight line segment on the grid layer. */
function lineAt(start: Point2D, end: Point2D, layerId: string): LineEntity {
  return { id: generateEntityId(), type: 'line', layerId, color: TOPO_GRID_COLOR, start, end };
}

/** A cross at a round intersection = a horizontal + a vertical arm (canonical mm). */
function toCrossLines(c: Point2D, layerId: string): LineEntity[] {
  const a = TOPO_GRID_CROSS_WORLD_MM;
  return [
    lineAt({ x: c.x - a, y: c.y }, { x: c.x + a, y: c.y }, layerId),
    lineAt({ x: c.x, y: c.y - a }, { x: c.x, y: c.y + a }, layerId),
  ];
}

/** Format a round coordinate (canonical mm) as its whole-metre ΕΓΣΑ87 value, e.g. `200`. */
export function formatGridCoordinate(coordinateMm: number): string {
  return lengthMmToM(coordinateMm).toFixed(TOPO_GRID_LABEL_DECIMALS);
}

/** A perimeter coordinate label, offset just outside its edge so it clears the grid. */
function toPerimeterLabel(l: PerimeterLabel, layerId: string): TextEntity {
  const off = TOPO_GRID_LABEL_HEIGHT_MM * 1.5;
  // Eastings sit below the bottom edge (centred); Northings sit left of the left edge.
  const position = l.axis === 'E'
    ? { x: l.worldPos.x, y: l.worldPos.y - off }
    : { x: l.worldPos.x - off, y: l.worldPos.y };
  return {
    id: generateEntityId(),
    type: 'text',
    layerId,
    color: TOPO_GRID_LABEL_COLOR,
    position,
    text: formatGridCoordinate(l.coordinateMm),
    fontSize: TOPO_GRID_LABEL_HEIGHT_MM,
    height: TOPO_GRID_LABEL_HEIGHT_MM,
    alignment: l.axis === 'E' ? 'center' : 'right',
  };
}

/**
 * Build the baked grid entities: two lines per cross + one text per perimeter label.
 * An empty model (no lines inside the rectangle) yields no entities.
 */
export function buildTopoGridEntities(model: TopoGridModel, layerId: string): GridEntity[] {
  const entities: GridEntity[] = [];
  for (const cross of model.crosses) entities.push(...toCrossLines(cross, layerId));
  for (const label of model.perimeterLabels) entities.push(toPerimeterLabel(label, layerId));
  return entities;
}

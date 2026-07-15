/**
 * ADR-656 M12 — North arrow → native CAD entities (the «Bake to drawing» export consumer).
 *
 * Turns the ONE angle from `north-arrow-model` into a closed `lwpolyline` (the arrowhead) + a
 * `text` glyph («Β»), placed at a world anchor in the DISPLAY frame, flowing through
 * `completeEntities` (ADR-057) — undo / persistence / render / DXF-PDF export for FREE, exactly
 * like the grid (`topo-grid-entities`). Pure: the layer id + anchor + angle are passed in.
 */

import type { LWPolylineEntity, TextEntity } from '../../types/entities';
import type { Point2D } from '../../rendering/types/Types';
import { generateEntityId } from '@/services/enterprise-id.service';
import {
  NORTH_ARROW_UNIT_OUTLINE, TOPO_NORTH_COLOR, TOPO_NORTH_GLYPH,
  TOPO_NORTH_WORLD_HEIGHT_MM, TOPO_NORTH_GLYPH_HEIGHT_MM,
} from './north-arrow-config';

type NorthEntity = LWPolylineEntity | TextEntity;

/** Rotate a unit-frame point (tip up) to the display angle, scale to mm, translate to the anchor. */
function place(u: Point2D, anchor: Point2D, angleRad: number, size: number): Point2D {
  // Unit tip is +Y (90°); rotate the outline by (angle − 90°) so the tip lands on `angle`.
  const phi = angleRad - Math.PI / 2;
  const c = Math.cos(phi);
  const s = Math.sin(phi);
  return {
    x: anchor.x + (u.x * c - u.y * s) * size,
    y: anchor.y + (u.x * s + u.y * c) * size,
  };
}

/** The arrowhead as a closed lwpolyline. */
function toArrowOutline(anchor: Point2D, angleRad: number, layerId: string): LWPolylineEntity {
  const vertices = NORTH_ARROW_UNIT_OUTLINE.map((u) => place(u, anchor, angleRad, TOPO_NORTH_WORLD_HEIGHT_MM));
  return {
    id: generateEntityId(),
    type: 'lwpolyline',
    layerId,
    color: TOPO_NORTH_COLOR,
    vertices,
    closed: true,
    elevation: 0,
  };
}

/** The «Β» glyph, beyond the tip along the arrow, rotated to read along it. */
function toGlyph(anchor: Point2D, angleRad: number, angleDeg: number, layerId: string): TextEntity {
  const reach = TOPO_NORTH_WORLD_HEIGHT_MM * 0.5 + TOPO_NORTH_GLYPH_HEIGHT_MM;
  const position = { x: anchor.x + Math.cos(angleRad) * reach, y: anchor.y + Math.sin(angleRad) * reach };
  return {
    id: generateEntityId(),
    type: 'text',
    layerId,
    color: TOPO_NORTH_COLOR,
    position,
    text: TOPO_NORTH_GLYPH,
    fontSize: TOPO_NORTH_GLYPH_HEIGHT_MM,
    height: TOPO_NORTH_GLYPH_HEIGHT_MM,
    alignment: 'center',
    rotation: angleDeg - 90,
  };
}

/**
 * Build the baked north-arrow entities (arrowhead outline + «Β» glyph) at a world anchor,
 * oriented to `angleDeg` (display-frame, from `northAngleDeg`).
 */
export function buildNorthArrowEntities(anchor: Point2D, angleDeg: number, layerId: string): NorthEntity[] {
  const angleRad = angleDeg * Math.PI / 180;
  return [toArrowOutline(anchor, angleRad, layerId), toGlyph(anchor, angleRad, angleDeg, layerId)];
}

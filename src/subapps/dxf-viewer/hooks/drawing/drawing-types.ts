/**
 * @module drawing-types
 * @description Type definitions for the unified drawing system.
 * Extracted from useUnifiedDrawing.tsx for clean separation of concerns.
 *
 * All types are re-exported from useUnifiedDrawing.tsx for backward compatibility,
 * so existing imports from 19+ consumer files continue to work unchanged.
 */

import type { Point2D } from '../../rendering/types/Types';
import type { AnySceneEntity, LineEntity, CircleEntity, PolylineEntity, ArcEntity } from '../../types/scene';

// ─── Preview Point ──────────────────────────────────────────────────────────

/**
 * Preview-only point overlay (drawing tools).
 *
 * ADR-358 Phase 9D-5b-ii — `layer` (name backref) made optional to align with
 * BaseEntity dual-write window. `layerId` (`lyr_<UUID-v4>`) is the stable id.
 * Both fields collapse to `layerId` only at end of Phase 9D-5b-iii.
 */
export interface PreviewPoint {
  id: string;
  type: 'point';
  position: Point2D;
  size: number;
  visible: boolean;
  /** Stable layer id — `lyr_<UUID-v4>`. */
  layerId: string;
  preview: boolean;
}

// ─── Extended Entity Types (preview-aware) ──────────────────────────────────

export interface ExtendedPolylineEntity extends PolylineEntity {
  showEdgeDistances?: boolean;
}

export interface ExtendedCircleEntity extends CircleEntity {
  diameterMode?: boolean;
  twoPointDiameter?: boolean;
  /** Show radius/circumference/area labels during drawing preview */
  showPreviewMeasurements?: boolean;
  /** Cursor world position during preview — used to draw radius line toward cursor */
  previewCursorPoint?: Point2D;
}

export interface ExtendedLineEntity extends LineEntity {
  showEdgeDistances?: boolean;
}

// Extended Arc Entity for preview with construction lines
// Shows both the arc shape AND the rubber band lines connecting clicked points
export interface ExtendedArcEntity extends ArcEntity {
  // Construction vertices: all clicked points + cursor position
  // Used to draw rubber band lines during arc drawing
  constructionVertices?: Point2D[];
  showConstructionLines?: boolean;
  showEdgeDistances?: boolean;
  // Arc direction flag for Canvas 2D rendering
  // true = draw counterclockwise (anticlockwise), false = draw clockwise
  counterclockwise?: boolean;
  // Construction line drawing mode
  // 'polyline': Connect points in sequence (arc-3p: start -> mid -> end)
  // 'radial': Draw radii from center (arc-cse/arc-sce: center -> start, center -> end)
  constructionLineMode?: 'polyline' | 'radial';
}

// ─── Union Type ─────────────────────────────────────────────────────────────

export type ExtendedSceneEntity =
  | ExtendedPolylineEntity
  | ExtendedCircleEntity
  | ExtendedLineEntity
  | ExtendedArcEntity
  | PreviewPoint
  | AnySceneEntity;

// ─── Drawing Tool & State ───────────────────────────────────────────────────

// ADR-059: Arc tools, ADR-083: Circle variants, ADR-358 Phase 5a: Stair tool, ADR-363 Phase 1B: Wall tool
export type DrawingTool =
  | 'select' | 'line' | 'rectangle'
  | 'circle' | 'circle-diameter' | 'circle-2p-diameter'
  | 'circle-3p' | 'circle-chord-sagitta' | 'circle-2p-radius' | 'circle-best-fit'
  | 'polyline' | 'polygon'
  | 'hatch' // ADR-507 S2 — γραμμοσκίαση (κλειστό όριο, N-click + Enter)
  | 'measure-distance' | 'measure-distance-continuous' | 'measure-area' | 'measure-angle'
  | 'measure-angle-line-arc' | 'measure-angle-two-arcs' | 'measure-angle-measuregeom' | 'measure-angle-constraint'
  | 'arc-3p' | 'arc-cse' | 'arc-sce'
  | 'stair'
  | 'wall'
  | 'slab'
  | 'column'
  | 'beam'
  // ADR-436 Slice 2 — foundation line tools (rubber-band band preview).
  | 'foundation-strip'
  | 'foundation-tie-beam'
  | 'xline'
  | 'ray'
  | 'slab-opening'
  | 'roof'
  | 'floor-finish'
  | 'wall-covering'
  | 'mep-underfloor'
  | 'thermal-space'
  | 'space-separator';

export interface DrawingState {
  currentTool: DrawingTool;
  isDrawing: boolean;
  previewEntity: ExtendedSceneEntity | null;
  tempPoints: Point2D[];
  measurementId?: string;
  isOverlayMode?: boolean;
  currentPoints: Point2D[];
  snapPoint: Point2D | null;
  snapType: string | null;
}

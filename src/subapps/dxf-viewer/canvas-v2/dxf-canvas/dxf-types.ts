/**
 * CANVAS V2 - DXF SPECIFIC TYPES
 * Τύποι μόνο για το DXF canvas module
 */

import type { Point2D } from '../../rendering/types/Types';

// === DXF ENTITY TYPES ===
export interface DxfEntity {
  id: string;
  type: 'line' | 'circle' | 'arc' | 'polyline' | 'text' | 'angle-measurement';
  layer: string;
  color: string;
  lineWidth: number;
  visible: boolean;
}

export interface DxfLine extends DxfEntity {
  type: 'line';
  start: Point2D;
  end: Point2D;
}

export interface DxfCircle extends DxfEntity {
  type: 'circle';
  center: Point2D;
  radius: number;
}

export interface DxfPolyline extends DxfEntity {
  type: 'polyline';
  vertices: Point2D[];
  closed: boolean;
}

export interface DxfArc extends DxfEntity {
  type: 'arc';
  center: Point2D;
  radius: number;
  startAngle: number; // in degrees
  endAngle: number; // in degrees
  // 🔧 FIX (2026-01-31): Arc direction flag for correct rendering
  // true = draw counterclockwise, false = draw clockwise (default)
  counterclockwise?: boolean;
}

/**
 * ADR-344 Phase 6.E — Rich-text style derived from the first run of textNode.
 * Carries only what Canvas2D can render: font family, weight, italic, per-run color.
 */
export interface DxfTextStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  overline?: boolean;
  strikethrough?: boolean;
  fontFamily?: string;
  /** Per-run color override (overrides entity.color when set). */
  runColor?: string;
  /** Derived from textNode.attachment horizontal component (L/C/R). */
  textAlign?: 'left' | 'center' | 'right';
  /** Derived from textNode.attachment vertical component (T/M/B). */
  textBaseline?: 'top' | 'middle' | 'bottom';
}

export interface DxfText extends DxfEntity {
  type: 'text';
  position: Point2D;
  text: string;
  height: number;
  rotation?: number; // in degrees
  /** ADR-344 Phase 6.E: style derived from textNode first-run, used by TextRenderer. */
  textStyle?: DxfTextStyle;
}

export interface DxfAngleMeasurement extends DxfEntity {
  type: 'angle-measurement';
  vertex: Point2D; // Center point of the angle
  point1: Point2D; // First arm endpoint
  point2: Point2D; // Second arm endpoint
  angle: number; // Angle in degrees
}

export type DxfEntityUnion = DxfLine | DxfCircle | DxfPolyline | DxfArc | DxfText | DxfAngleMeasurement;

// === DXF SCENE ===
export interface DxfScene {
  entities: DxfEntityUnion[];
  layers: string[];
  bounds: {
    min: Point2D;
    max: Point2D;
  } | null;
}

// === DXF RENDERING ===
export interface DxfRenderOptions {
  showGrid: boolean;
  showLayerNames: boolean;
  wireframeMode: boolean;
  selectedEntityIds: string[];
  hoveredEntityId?: string | null;
  /** Grip interaction state for visual feedback (hovered/active grip coloring) */
  gripInteractionState?: {
    hoveredGrip?: { entityId: string; gripIndex: number };
    activeGrip?: { entityId: string; gripIndex: number };
  };
  // ADR-049 SSOT (2026-05-12): the `dragPreview` field used to live here so
  // DxfRenderer could mutate the entity in-place during grip drag. It has
  // been removed — drag-time ghost rendering is now exclusively handled by
  // `useGripGhostPreview` on the PreviewCanvas overlay, mirroring the Move
  // tool path and freeing the bitmap cache from 60fps invalidation.
  /**
   * Phase D RE-IMPLEMENT (ADR-040, 2026-05-09): when true, render entities in
   * pure normal-state (no hover, no selection, no grips, no drag preview).
   * Used by the bitmap cache layer — interactive state is rendered separately
   * via DxfRenderer.renderSingleEntity() as a single-entity overlay on top.
   */
  skipInteractive?: boolean;
}

// === DXF SELECTION ===
export interface DxfSelectionResult {
  entityId: string;
  distance: number;
  point: Point2D;
}
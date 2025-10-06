/**
 * RENDERING TYPES - UNIFIED TYPE DEFINITIONS
 * ✅ ΕΝΟΠΟΙΗΜΕΝΟ: Κοινά types για όλο το rendering system
 */

import type { LineType } from '../settings-core/types';

// ===== BASIC GEOMETRY TYPES =====
/**
 * Βασικό 2D point interface
 *
 * @see docs/CENTRALIZED_SYSTEMS.md - Coordinate Systems
 * @example
 * // Χρησιμοποίησε CoordinateTransforms για μετατροπές
 * const screenPoint = CoordinateTransforms.worldToScreen(worldPoint, transform, viewport);
 */
export interface Point2D {
  x: number;
  y: number;
}

export interface Point3D extends Point2D {
  z: number;
}

// ===== TRANSFORM & VIEWPORT TYPES =====
/**
 * Viewport transformation interface
 *
 * @see docs/CENTRALIZED_SYSTEMS.md - Zoom & Pan Systems
 * @example
 * // Χρησιμοποίησε ZoomManager αντί για manual transform manipulation
 * zoomManager.setTransform(newTransform);
 */
export interface ViewTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface Viewport {
  x?: number;     // Optional x offset (defaults to 0)
  y?: number;     // Optional y offset (defaults to 0)
  width: number;
  height: number;
}


export interface BoundingBox {
  min: Point2D;
  max: Point2D;
}

// ===== ENTITY TYPES =====
export interface EntityModel {
  id: string;
  type: string;
  visible?: boolean;
  selected?: boolean;
  hovered?: boolean;
  layer?: string;
  color?: string;
  lineType?: LineType;
  lineWeight?: number;

  // Geometry properties - different per entity type
  position?: Point2D;
  center?: Point2D;
  start?: Point2D;
  end?: Point2D;
  radius?: number;
  points?: Point2D[];

  // Additional properties για specialized entities
  [key: string]: any;
}

// Legacy compatibility - alias for different naming conventions
export type Entity = EntityModel;
export type AnySceneEntity = EntityModel;

// ===== RENDER OPTIONS =====
export interface RenderOptions {
  phase?: 'normal' | 'preview' | 'selected' | 'highlighted';
  transform?: ViewTransform;
  viewport?: Viewport;
  showGrips?: boolean;
  showBounds?: boolean;
  clipToBounds?: boolean;
  alpha?: number;
}

// ===== GRIP TYPES =====
export interface GripInfo {
  id: string;
  position: Point2D;
  type: 'corner' | 'midpoint' | 'center' | 'control' | 'vertex' | 'edge';
  entityId: string;
  isVisible: boolean;
  isSelected?: boolean;
  isHovered?: boolean;
}

export interface GripSettings {
  // === AutoCAD Variables ===
  gripSize: number;         // GRIPSIZE: 1-255 DIPs, default 5
  pickBoxSize: number;      // PICKBOX: 0-50 DIPs, default 3
  apertureSize: number;     // APERTURE: 1-50 px, default 10
  showAperture: boolean;    // APBOX: show/hide osnap aperture

  // === Grip Colors (AutoCAD style) ===
  colors: {
    cold: string;           // GRIPCOLOR: unselected (default blue)
    warm: string;           // GRIPHOVER: hover (default orange)
    hot: string;            // GRIPHOT: selected (default red)
    contour: string;        // GRIPCONTOUR: border (default black)
  };

  // === Advanced Settings ===
  enabled: boolean;         // Enable/disable grip system
  showGrips: boolean;       // Show/hide grips on selected entities
  multiGripEdit: boolean;   // Allow multi-grip operations
  snapToGrips: boolean;     // Enable snap to grips
  showGripTips: boolean;    // Show grip tooltips
  dpiScale: number;         // DPI scaling factor
  maxGripsPerEntity: number; // Maximum grips per entity (performance)

  // === Display Settings ===
  opacity: number;          // Grip opacity (0.0 - 1.0)
  showMidpoints: boolean;   // Show midpoint grips
  showCenters: boolean;     // Show center grips
  showQuadrants: boolean;   // Show quadrant grips

  // Legacy compatibility
  size?: number;
  hoverSize?: number;
  color?: string;
  hoverColor?: string;
  selectedColor?: string;
  strokeWidth?: number;
  showLabels?: boolean;
}

export interface GripInteractionState {
  hovered?: { entityId: string; gripIndex: number };
  active?: { entityId: string; gripIndex: number };

  // Legacy compatibility
  hoveredGripId?: string;
  selectedGripIds?: string[];
  draggedGripId?: string;
  dragStartPosition?: Point2D;
  dragCurrentPosition?: Point2D;
}

// ===== STYLE TYPES =====
export interface EntityStyle {
  strokeColor: string;
  fillColor?: string;
  lineWidth: number;
  lineDash?: number[];
  alpha: number;
  shadowBlur?: number;
  shadowColor?: string;
}

export interface MaterialDefinition {
  name: string;
  strokeColor: string;
  fillColor?: string;
  lineWidth: number;
  lineDash?: number[];
  texture?: string;
}

// ✅ ΔΙΟΡΑΘΩΣΗ ΔΙΠΛΟΤΥΠΟΥ: Χρήση unified IRenderContext από core/IRenderContext.ts
// Legacy simplified IRenderContext removed - use core implementation instead

// ===== HIT TESTING TYPES =====
export interface HitTestResult {
  entityId: string | null;
  point: Point2D;
  distance: number;
  gripInfo?: GripInfo;
}

export interface SpatialQueryOptions {
  tolerance: number;
  includeHidden?: boolean;
  entityTypes?: string[];
  layers?: string[];
}

// ===== CANVAS CONFIG =====
export interface CanvasConfig {
  devicePixelRatio: number;
  enableHiDPI: boolean;
  backgroundColor: string;
  antialias?: boolean;
  imageSmoothingEnabled?: boolean;
}

// ===== LEGACY COMPATIBILITY =====

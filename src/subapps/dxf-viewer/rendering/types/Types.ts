/**
 * RENDERING TYPES - UNIFIED TYPE DEFINITIONS
 * ✅ ΕΝΟΠΟΙΗΜΕΝΟ: Κοινά types για όλο το rendering system
 */

// ADR-393 v2 — type-only import (erased at runtime, no require cycle) so a
// computed grip can carry an optional rendered-shape hint (move/rotation icon
// glyphs for BIM parametric handles).
import type { GripShape } from '../grips/types';

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

// ===== DRAWING PHASE TYPE =====
/**
 * Drawing phase για dynamic input system
 */
export type Phase = 'first-point' | 'second-point' | 'continuous';

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

// ===== LEGACY ENTITY SUPPORT =====
// ✅ ENTERPRISE: EntityModel interface moved to centralized entity system
// ✅ BACKWARD COMPATIBILITY: Re-export for any legacy code that still uses EntityModel
export type { EntityModel } from '../../types/entities';

// Note: EntityModel is now defined in types/entities.ts as BaseEntity interface
// Legacy code using EntityModel should gradually migrate to Entity types

// ============================================================================
// 🔄 ENTERPRISE CENTRALIZATION: Entity types now from unified system
// ============================================================================
//
// ✅ FIXED: Removed problematic aliases that caused TypeScript conflicts
// ✅ ENTERPRISE: Import from centralized entity system
// ✅ BACKWARD COMPATIBILITY: Use proper re-exports instead of conflicting aliases
//
// Previous: export type Entity = EntityModel;           // ❌ CONFLICT!
// Previous: export type AnySceneEntity = EntityModel;   // ❌ CONFLICT!
// New: Use proper imports from centralized system
//
// Migration completed: 2025-12-29
// ============================================================================

// Re-export Entity types from centralized system (maintains backward compatibility)
export type { Entity, AnySceneEntity } from '../../types/entities';

// ===== RENDER OPTIONS =====
export interface RenderOptions {
  phase?: 'normal' | 'preview' | 'selected' | 'highlighted';
  transform?: ViewTransform;
  viewport?: Viewport;
  showGrips?: boolean;
  showBounds?: boolean;
  clipToBounds?: boolean;
  alpha?: number;
  // ✅ ENTERPRISE FIX: Missing properties for hover/index.ts TS2339 errors
  hovered?: boolean;    // Whether entity is in hovered state
  selected?: boolean;   // Whether entity is in selected state
  preview?: boolean;    // Whether entity is in preview state (PhaseManager compatibility)

  // ✅ ENTERPRISE FIX: Missing grips property for BaseEntityRenderer TS2339 errors
  grips?: boolean;      // Whether to show entity grips
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

  // ✅ ENTERPRISE FIX: Missing properties for useEntityGripInteraction
  gripIndex?: number;   // Index of the grip within the entity
  gripType?: 'corner' | 'midpoint' | 'center' | 'control' | 'vertex' | 'edge'; // Alias for type (backward compatibility)

  // ADR-393 v2 — optional rendered-shape hint. When set (e.g. by
  // StairRenderer.getGrips for the move/rotation handles), GripPhaseRenderer
  // uses it instead of the default 'square'. Generic — no entity coupling.
  shape?: GripShape;

  // ADR-397 (Giorgio 2026-06-17) — screen-space rotation (radians) for the MOVE
  // 4-arrow glyph so it follows the entity's orientation. Attached centrally in
  // `BaseEntityRenderer.renderGrips` (from `resolveMoveGlyphFrame` via worldToScreen).
  // Undefined → axis-aligned glyph (default). Ignored by non-glyph shapes.
  glyphRotationRad?: number;

  // ADR-397 Φ2 (Giorgio 2026-06-17) — the MOVE-glyph arm under the cursor, in the
  // glyph's DRAWN local frame (already mapped from the world hover zone via
  // `worldZoneToLocalArm`). Set in `BaseEntityRenderer.renderGrips` from
  // `MoveGlyphZoneStore`; the renderer lights ONLY that arm (warm) over a cold
  // cross. Undefined → whole cross drawn in its temperature colour (default).
  moveHoveredZone?: import('../../bim/grips/move-glyph-zones').MoveGlyphZone;
}

export interface GripSettings {
  // === AutoCAD Variables ===
  gripSize: number;         // GRIPSIZE: 1-255 DIPs, default 5
  pickBoxSize: number;      // PICKBOX: 0-50 DIPs, default 3
  apertureSize: number;     // APERTURE: 1-50 px, default 10
  showAperture: boolean;    // APBOX: show/hide osnap aperture

  // === Grip Colors (AutoCAD style) ===
  colors: {
    cold: string | null;    // GRIPCOLOR: unselected (default blue). null = resolved via GRIP_COLD_COLOR SSoT
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
  /** ADR-501 — grip keys clicked-to-select for a multi-grip move (orange). */
  armedKeys?: ReadonlySet<string>;

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
  entityType?: string; // ✅ ENTERPRISE FIX: Added entity type για HitTestingService.ts
  layer?: string; // ✅ ENTERPRISE FIX: Added layer για HitTestingService.ts
  point?: Point2D; // ✅ ENTERPRISE FIX: Made optional για flexibility
  distance?: number; // ✅ ENTERPRISE FIX: Made optional για flexibility
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

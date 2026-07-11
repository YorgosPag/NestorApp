/**
 * RENDERING TYPES - UNIFIED TYPE DEFINITIONS
 * ✅ ΕΝΟΠΟΙΗΜΕΝΟ: Κοινά types για όλο το rendering system
 */

// ADR-393 v2 — type-only import (erased at runtime, no require cycle) so a
// computed grip can carry an optional rendered-shape hint (move/rotation icon
// glyphs for BIM parametric handles).
import type { GripShape } from '../grips/types';
// ADR-559 — canonical grip-settings schema (this rendering type === GripSettingsFull projection)
import type { GripSettingsFull } from '../../types/grip-settings-schema';

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
// ADR-559 — 🏢 SSoT for the grip-KIND literal set. Before this, the same overlapping literals were
// re-declared in ≥6 places (`GripInfo.type`, `rendering/grips/types.ts GripType`,
// `unified-grip-types.ts UnifiedGripType`, `hooks/grip-kinds.ts GripType`, `OverlayPass.gripType`,
// `gripSettings.ts GripState.gripType`) — adding ONE kind (e.g. `'quadrant'`) meant editing them all.
// Now this is the ONE canonical union; every other grip-kind type is a PROJECTION (`Exclude`/`Extract`).
// `'quadrant'` (circle/ellipse cardinal points) is kept distinct from `'vertex'` so «Εμφάνιση
// Quadrants» can gate it without hiding real polyline vertices.
export type GripKind =
  | 'vertex'    // structural endpoint / polyline vertex (always shown)
  | 'edge'      // edge/midpoint grip (legacy alias for midpoint)
  | 'midpoint'  // explicit midpoint grip
  | 'center'    // center point (circles, arcs, …)
  | 'corner'    // corner grip (rectangles, special cases)
  | 'control'   // control point (splines, …)
  | 'quadrant'  // circle/ellipse cardinal point (gated by showQuadrants)
  | 'close';    // close-polygon indicator (ADR-047)

export interface GripInfo {
  id: string;
  position: Point2D;
  // Data-model grips never carry the render-only 'close' indicator.
  type: Exclude<GripKind, 'close'>;
  entityId: string;
  isVisible: boolean;
  isSelected?: boolean;
  isHovered?: boolean;

  // ✅ ENTERPRISE FIX: Missing properties for useEntityGripInteraction
  gripIndex?: number;   // Index of the grip within the entity
  gripType?: Exclude<GripKind, 'close'>; // Alias for type (backward compatibility)

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

  // ADR-047 / ADR-637 Φ4-D — optional per-grip fill override (highest priority in
  // `GripColorManager.getColor`). Set by a renderer's `getGrips` to give a grip family a
  // distinct identity colour (e.g. StairRenderer paints rest-landing grips fuchsia). When
  // set the grip renders in this colour regardless of temperature; undefined → normal
  // cold/warm/hot behaviour. Forwarded to `GripRenderConfig.customColor` by GripPhaseRenderer.
  customColor?: string;
}

// ADR-559 — the rendering grip-settings type is the canonical `GripSettingsFull` projection
// (base + render extras + legacy compat, sentinel colours). One schema, no re-declaration.
export type GripSettings = GripSettingsFull;

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

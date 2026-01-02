/**
 * @fileoverview Phase Manager Type Definitions
 * @description Centralized types for the phase management system
 * @author Enterprise Architecture Team
 * @date 2026-01-02
 * @version 2.0.0
 * @compliance CLAUDE.md Enterprise Standards - NO any, NO hardcoded values
 */

import type { Point2D, GripInfo, RenderOptions } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';

// ============================================================================
// PHASE TYPES
// ============================================================================

/**
 * Available rendering phases following CAD industry standards
 * - normal: Standard entity rendering (solid lines, authentic colors)
 * - preview: Preview/draft rendering (dashed lines, preview colors)
 * - measurement: Measurement display mode (with dimensions)
 */
export type RenderingPhase = 'normal' | 'preview' | 'measurement';

/**
 * Grip interaction temperature states (AutoCAD/BricsCAD standard)
 * - cold: Normal state (blue) - grip is visible but not interacted
 * - warm: Hover state (orange) - cursor is over the grip
 * - hot: Active/dragging state (red) - grip is being manipulated
 */
export type GripTemperature = 'cold' | 'warm' | 'hot';

// ============================================================================
// CONFIGURATION INTERFACES
// ============================================================================

/**
 * Phase Manager initialization options
 */
export interface PhaseManagerOptions {
  /** Canvas 2D rendering context */
  ctx: CanvasRenderingContext2D;
  /** Current viewport transform */
  transform: ViewTransformConfig;
  /** World-to-screen coordinate transformation function */
  worldToScreen: (point: Point2D) => Point2D;
}

/**
 * Viewport transform configuration
 */
export interface ViewTransformConfig {
  /** Current zoom scale factor */
  scale: number;
  /** Horizontal offset in screen coordinates */
  offsetX: number;
  /** Vertical offset in screen coordinates */
  offsetY: number;
}

// ============================================================================
// STATE INTERFACES
// ============================================================================

/**
 * Complete phase rendering state for an entity
 */
export interface PhaseRenderingState {
  /** Current rendering phase */
  phase: RenderingPhase;
  /** Whether the phase is actively affecting rendering */
  isActive: boolean;
  /** Rendering priority (higher = rendered later/on top) */
  priority: number;
  /** Context information about why this phase was determined */
  context: PhaseContext;
  /** Optional grip interaction state */
  gripState?: GripInteractionState;
}

/**
 * Context information for phase determination
 */
export interface PhaseContext {
  /** Phase was determined from entity properties */
  fromEntity?: boolean;
  /** Phase was determined from drawing tool state */
  fromDrawing?: boolean;
  /** Entity has preview styling */
  hasPreview?: boolean;
  /** Entity has measurement display */
  hasMeasurement?: boolean;
  /** Entity is an overlay preview (layering system) */
  hasOverlayPreview?: boolean;
}

/**
 * Grip interaction state tracking
 */
export interface GripInteractionState {
  /** Currently hovered grip (cursor over) */
  hoveredGrip?: GripIdentifier;
  /** Currently selected grip (clicked) */
  selectedGrip?: GripIdentifier;
  /** Currently dragging grip (mouse down + move) */
  dragginGrip?: GripIdentifier;
}

/**
 * Unique grip identifier
 */
export interface GripIdentifier {
  /** Entity ID that owns the grip */
  entityId: string;
  /** Index of the grip within the entity */
  gripIndex: number;
}

// ============================================================================
// MEASUREMENT INTERFACES
// ============================================================================

/**
 * Measurement data for display
 */
export interface MeasurementData {
  /** Label for the measurement (e.g., "Length", "Radius") */
  label: string;
  /** Numeric value */
  value: number;
  /** Optional unit suffix (e.g., "°", "m", "mm") */
  unit?: string;
}

/**
 * Screen position with text alignment for measurement display
 */
export interface MeasurementPosition {
  /** X coordinate in screen space */
  x: number;
  /** Y coordinate in screen space */
  y: number;
  /** Text alignment direction */
  textAlign: CanvasTextAlign;
}

/**
 * Canvas bounds for smart positioning calculations
 */
export interface CanvasBounds {
  /** Canvas width in pixels */
  width: number;
  /** Canvas height in pixels */
  height: number;
}

// ============================================================================
// DRAG MEASUREMENT INTERFACES
// ============================================================================

/**
 * Base interface for entity-specific drag measurement renderers
 */
export interface IDragMeasurementRenderer {
  /**
   * Render live measurements during grip drag operation
   * @param entity - Entity being modified
   * @param gripIndex - Index of the grip being dragged
   * @param currentPosition - Current cursor position in world coordinates
   */
  render(entity: Entity, gripIndex: number, currentPosition: Point2D): void;
}

/**
 * Context passed to drag measurement renderers
 */
export interface DragMeasurementContext {
  /** Canvas 2D rendering context */
  ctx: CanvasRenderingContext2D;
  /** World-to-screen transformation function */
  worldToScreen: (point: Point2D) => Point2D;
  /** Current canvas bounds */
  canvasBounds: CanvasBounds;
}

// ============================================================================
// RE-EXPORTS FOR CONVENIENCE
// ============================================================================

export type { Point2D, GripInfo, RenderOptions, Entity };

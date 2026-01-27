/**
 * @fileoverview Unified Grip Rendering System - Type Definitions
 * @description Enterprise-grade type system for grip rendering
 * @author Enterprise Architecture Team
 * @date 2027-01-27
 * @version 1.0.0
 * @compliance CLAUDE.md Enterprise Standards - NO any, Full TypeScript
 */

import type { Point2D } from '../types/Types';
import type { GripSettings } from '../../types/gripSettings';

// ============================================================================
// GRIP TYPE DEFINITIONS
// ============================================================================

/**
 * Grip type classification
 * Determines visual style and behavior of grip points
 */
export type GripType =
  | 'vertex'    // Standard vertex grip (corners, endpoints)
  | 'edge'      // Edge/midpoint grip (between vertices)
  | 'midpoint'  // Explicit midpoint (same as edge, for clarity)
  | 'center'    // Center point grip (circles, arcs, etc.)
  | 'corner'    // Corner grip (rectangles, special cases)
  | 'close';    // Close polygon grip (ADR-047 green indicator)

/**
 * Grip temperature state
 * Following AutoCAD/BricsCAD standards for visual feedback
 */
export type GripTemperature =
  | 'cold'  // Normal state (default color - blue)
  | 'warm'  // Hover state (highlight color - orange)
  | 'hot';  // Active/drag state (active color - red)

/**
 * Grip shape type
 * Determines rendered shape geometry
 */
export type GripShape =
  | 'square'   // Standard AutoCAD grip (default)
  | 'circle'   // Alternative shape (future)
  | 'diamond'; // Special case grips (future)

// ============================================================================
// GRIP CONFIGURATION INTERFACES
// ============================================================================

/**
 * Grip render configuration
 * Complete specification for rendering a single grip point
 *
 * @example
 * ```typescript
 * const gripConfig: GripRenderConfig = {
 *   position: { x: 100, y: 200 },
 *   type: 'vertex',
 *   temperature: 'cold',
 *   entityId: 'line-123',
 *   gripIndex: 0
 * };
 * ```
 */
export interface GripRenderConfig {
  /** Grip position in world coordinates */
  position: Point2D;

  /** Grip type (determines default styling) */
  type: GripType;

  /** Temperature state (cold/warm/hot) - optional, will be auto-detected if not provided */
  temperature?: GripTemperature;

  /** Custom color override (e.g., ADR-047 green grip for close indicator) */
  customColor?: string;

  /** Entity ID for interaction detection */
  entityId?: string;

  /** Grip index within entity (for interaction state detection) */
  gripIndex?: number;

  /** Shape type override (default: square) */
  shape?: GripShape;

  /** Size multiplier override (default: 1.0) */
  sizeMultiplier?: number;
}

/**
 * Grip interaction state
 * Tracks current hover/active/drag states for all grips
 * Used by UnifiedGripRenderer to determine temperature
 */
export interface GripInteractionState {
  /** Currently hovered grip */
  hovered?: {
    entityId: string;
    gripIndex: number;
  };

  /** Currently active/selected grip */
  active?: {
    entityId: string;
    gripIndex: number;
  };

  /** Currently dragging grip (with position tracking) */
  dragging?: {
    entityId: string;
    gripIndex: number;
    startPosition: Point2D;
    currentPosition: Point2D;
  };
}

/**
 * Midpoint grip configuration
 * Specialized config for rendering midpoint grips between vertices
 *
 * @example
 * ```typescript
 * const midpointConfig: MidpointGripConfig = {
 *   enabled: true,
 *   size: 6,
 *   color: '#00ff00',
 *   shape: 'square'
 * };
 * ```
 */
export interface MidpointGripConfig {
  /** Whether to render midpoint grips */
  enabled: boolean;

  /** Optional size override (default: 75% of vertex grip size) */
  size?: number;

  /** Optional color override (default: from settings) */
  color?: string;

  /** Optional shape override (default: square) */
  shape?: GripShape;
}

// ============================================================================
// EXPORT ALL TYPES
// ============================================================================

// Re-export GripSettings for convenience (from existing types)
export type { GripSettings } from '../../types/gripSettings';

/**
 * UI RENDERER - Core interface για όλα τα UI elements
 * ✅ ΦΑΣΗ 6: Centralized UI rendering infrastructure
 */

import type { Point2D, Viewport } from '../../types/Types';

/**
 * 🔺 CORE UI RENDERER INTERFACE
 * Unified contract για όλα τα UI elements (crosshair, cursor, grid, etc.)
 */
export interface UIRenderer {
  readonly type: string;

  /**
   * Main render method για UI elements
   */
  render(
    context: UIRenderContext,
    viewport: Viewport,
    settings: UIElementSettings
  ): void;

  /**
   * Optional cleanup method
   */
  cleanup?(): void;

  /**
   * Optional performance metrics
   */
  getMetrics?(): UIRenderMetrics;
}

/**
 * 🔺 UI RENDER CONTEXT
 * Specialized context για UI element rendering
 */
export interface UIRenderContext {
  readonly ctx: CanvasRenderingContext2D;
  readonly transform: UITransform;
  readonly timestamp: number;
}

/**
 * 🔺 EXTENDED UI RENDER CONTEXT - With World Transform
 * Για UI elements που χρειάζονται world coordinate transformation
 */
export interface UIRenderContextWithWorld extends UIRenderContext {
  readonly worldTransform: import('../../types/Types').ViewTransform;
}

/**
 * 🔺 EXTENDED UI RENDER CONTEXT - With Mouse Position
 * Για UI elements που χρειάζονται mouse tracking (cursor, crosshair)
 */
export interface UIRenderContextWithMouse extends UIRenderContext {
  readonly mousePosition: Point2D | null;
}

/**
 * 🔺 EXTENDED UI RENDER CONTEXT - With Snap Data
 * Για UI elements που χρειάζονται snap information
 */
export interface UIRenderContextWithSnap extends UIRenderContext {
  readonly snapData: Array<{
    point: Point2D;
    type: string;
    entity?: { id: string; type: string };
  }>;
}

/**
 * 🔺 FULL EXTENDED UI RENDER CONTEXT
 * Combination όλων των extended properties
 */
export interface ExtendedUIRenderContext extends UIRenderContext {
  readonly worldTransform?: import('../../types/Types').ViewTransform;
  readonly mousePosition?: Point2D | null;
  readonly snapData?: Array<{
    point: Point2D;
    type: string;
    entity?: { id: string; type: string };
  }>;
}

/**
 * 🔺 UI TRANSFORM
 * UI-specific transformations (different from world transforms)
 */
export interface UITransform {
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly rotation?: number; // Optional for rotated UI elements
}

/**
 * 🔺 GENERIC UI ELEMENT SETTINGS
 * Base interface που extend όλα τα specific UI settings
 */
export interface UIElementSettings {
  readonly enabled: boolean;
  readonly visible: boolean;
  readonly opacity: number;
  readonly zIndex?: number;
}

/**
 * 🔺 UI RENDER METRICS
 * Performance tracking για UI elements
 */
export interface UIRenderMetrics {
  readonly renderTime: number;
  readonly drawCalls: number;
  readonly primitiveCount: number;
  readonly memoryUsage?: number;
}

/**
 * 🔺 UI RENDERER FACTORY
 * Type-safe factory για δημιουργία UI renderers
 */
export type UIRendererFactory = (context: UIRenderContext) => UIRenderer;

/**
 * 🔺 UI RENDER OPTIONS
 * Configuration για UI rendering passes
 */
export interface UIRenderOptions {
  readonly enableBatching: boolean;
  readonly enableCaching: boolean;
  readonly enableMetrics: boolean;
  readonly maxDrawCalls?: number;
  readonly debugMode?: boolean;
}
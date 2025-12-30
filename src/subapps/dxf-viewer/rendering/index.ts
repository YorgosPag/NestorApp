/**
 * RENDERING MODULE - PUBLIC API
 * ✅ UNIFIED: Κεντρικό entry point για όλο το rendering system
 */

// ===== CORE INFRASTRUCTURE =====
export * from './core/EntityRenderer';
export * from './core/IRenderContext';
export * from './core/RendererRegistry';
export * from './core/CoordinateTransforms';

// ===== ΦΑΣΗ 4: RENDER PIPELINE =====
export * from './core/RenderPipeline';
export * from './passes';
export * from './adapters/canvas2d/Canvas2DContext';

// ===== ENTITY RENDERERS =====
export * from './entities/BaseEntityRenderer';
export * from './core/EntityRendererComposite';
export * from './entities/LineRenderer';
export * from './entities/CircleRenderer';
export * from './entities/PolylineRenderer';
export * from './entities/ArcRenderer';
export * from './entities/TextRenderer';
export * from './entities/RectangleRenderer';
export * from './entities/EllipseRenderer';
export * from './entities/SplineRenderer';
export * from './entities/AngleMeasurementRenderer';
export * from './entities/PointRenderer';

// ===== SHARED UTILITIES =====
// export * from './entities/shared'; // ✅ ENTERPRISE FIX: Commented out - entities/shared directory doesn't exist

// ===== ΦΑΣΗ 5: SPATIAL INDEXING & OPTIMIZATION =====
// ✅ ENTERPRISE: Explicit re-exports to resolve ambiguous names
export { createHitTester, HitTester } from './hitTesting';
export { getGlobalPathCache, PathCache } from './cache';

// ===== TYPES =====
export type {
  Point2D,
  Point3D,
  ViewTransform,
  Viewport,
  EntityModel,
  RenderOptions,
  GripInfo
} from './types/Types';

// ✅ ENTERPRISE FIX: Export EntityRenderer from rendering core
export type { IEntityRenderer as EntityRenderer } from './core/EntityRenderer';

export type { BoundingBox } from './types/Types';

// ===== LEGACY COMPATIBILITY =====
// ✅ ΔΙΟΡΑΘΩΣΗ ΔΙΠΛΟΤΥΠΟΥ: LegacyEntityComposite αφαιρέθηκε - δεν χρησιμοποιείται πουθενά
export { CoordinateTransforms as LegacyTransforms } from './core/CoordinateTransforms';

/**
 * Default factory functions για common usage
 */
import { globalRendererRegistry, type RendererFactory } from './core/RendererRegistry';
import { LineRenderer } from './entities/LineRenderer';
import { CircleRenderer } from './entities/CircleRenderer';
import { PolylineRenderer } from './entities/PolylineRenderer';
import { ArcRenderer } from './entities/ArcRenderer';
import { TextRenderer } from './entities/TextRenderer';
import { RectangleRenderer } from './entities/RectangleRenderer';
import { EllipseRenderer } from './entities/EllipseRenderer';
import { SplineRenderer } from './entities/SplineRenderer';
import { AngleMeasurementRenderer } from './entities/AngleMeasurementRenderer';
import { PointRenderer } from './entities/PointRenderer';
import { BaseEntityRenderer } from './entities/BaseEntityRenderer';
import type { IRenderContext } from './core/IRenderContext';

/**
 * Auto-register standard renderers
 */
export function registerStandardRenderers(): void {
  // ✅ ENTERPRISE: Proper type casting through unknown for IRenderContext compatibility
  const standardRenderers: Record<string, RendererFactory> = {
    'line': (ctx) => new LineRenderer(ctx as unknown as CanvasRenderingContext2D),
    'circle': (ctx) => new CircleRenderer(ctx as unknown as CanvasRenderingContext2D),
    'polyline': (ctx) => new PolylineRenderer(ctx as unknown as CanvasRenderingContext2D),
    'lwpolyline': (ctx) => new PolylineRenderer(ctx as unknown as CanvasRenderingContext2D), // Alias
    'arc': (ctx) => new ArcRenderer(ctx as unknown as CanvasRenderingContext2D),
    'text': (ctx) => new TextRenderer(ctx as unknown as CanvasRenderingContext2D),
    'mtext': (ctx) => new TextRenderer(ctx as unknown as CanvasRenderingContext2D), // Alias
    'rectangle': (ctx) => new RectangleRenderer(ctx as unknown as CanvasRenderingContext2D),
    'rect': (ctx) => new RectangleRenderer(ctx as unknown as CanvasRenderingContext2D), // Alias
    'ellipse': (ctx) => new EllipseRenderer(ctx as unknown as CanvasRenderingContext2D),
    'spline': (ctx) => new SplineRenderer(ctx as unknown as CanvasRenderingContext2D),
    'point': (ctx) => new PointRenderer(ctx as unknown as CanvasRenderingContext2D) as BaseEntityRenderer,
    'angle-measurement': (ctx) => new AngleMeasurementRenderer(ctx as unknown as CanvasRenderingContext2D),
  };

  globalRendererRegistry.registerBatch(standardRenderers);
}

/**
 * Initialize rendering system με default configuration
 */
export function initializeRenderingSystem(): void {
  registerStandardRenderers();
}

/**
 * 🔺 ΦΑΣΗ 5: SPATIAL INDEX FACTORY
 * Convenience function για δημιουργία spatial index από entities
 */
// Spatial index functionality moved to core/spatial system
import { createHitTester } from './hitTesting/HitTester';
import { getGlobalPathCache } from './cache/PathCache';
import type { EntityModel } from './types/Types';

// Διαγράφηκε το περιττό wrapper createOptimizedHitTester
// Χρησιμοποιείστε απευθείας createHitTester που έχει ήδη default useSpatialIndex = true

export function getPerformanceCache() {
  return {
    pathCache: getGlobalPathCache(),
    spatialIndex: null // Will be set when created
  };
}

/**
 * Get global registry instance
 */
export function getRenderingRegistry() {
  return globalRendererRegistry;
}
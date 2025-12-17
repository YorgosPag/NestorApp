/**
 * 🗺️ MAP LAYERS - ENTERPRISE BARREL EXPORTS
 *
 * Centralized exports για map layer components με clean import paths.
 * Professional component organization για complex map rendering.
 *
 * ✅ Enterprise Standards:
 * - Barrel export pattern
 * - Clean import paths
 * - Component organization
 * - Performance optimization
 *
 * @module MapLayers
 */

// ============================================================================
// 🎯 CORE MAP LAYER COMPONENTS
// ============================================================================

export { ControlPointLayer } from './ControlPointLayer';
export type { ControlPointLayerProps } from './ControlPointLayer';

export { PolygonLinesLayer } from './PolygonLinesLayer';
export type { PolygonLinesLayerProps } from './PolygonLinesLayer';

export { LiveDrawingPreview } from './LiveDrawingPreview';
export type {
  LiveDrawingPreviewProps,
  DrawingPoint,
  CurrentDrawing
} from './LiveDrawingPreview';

export { AccuracyVisualizationLayer } from './AccuracyVisualizationLayer';
export type { AccuracyVisualizationLayerProps } from './AccuracyVisualizationLayer';

export { TransformationPreviewLayer } from './TransformationPreviewLayer';
export type { TransformationPreviewLayerProps } from './TransformationPreviewLayer';

export { PolygonSystemLayers } from './PolygonSystemLayers';
export type { PolygonSystemLayersProps } from './PolygonSystemLayers';

// ============================================================================
// 🎯 CONVENIENCE RE-EXPORTS
// ============================================================================

/**
 * All map layer components για convenience imports
 */
export const MapLayerComponents = {
  ControlPointLayer,
  PolygonLinesLayer,
  LiveDrawingPreview
} as const;

/**
 * ✅ ENTERPRISE MAP LAYERS BARREL EXPORTS COMPLETE (2025-12-17)
 *
 * Organization Benefits:
 * 🎯 Clean Imports - Single import path για all map layers
 * 🔄 Maintainability - Centralized component organization
 * 📦 Bundle Optimization - Tree-shaking friendly exports
 * 🧪 Testing - Easy to import specific components
 * 📚 Documentation - Clear component hierarchy
 *
 * Usage Examples:
 * ```tsx
 * import { ControlPointLayer, PolygonLinesLayer } from '../map-layers';
 * import type { ControlPointLayerProps } from '../map-layers';
 * import { MapLayerComponents } from '../map-layers';
 * ```
 */
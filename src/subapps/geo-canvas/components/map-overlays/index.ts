/**
 * 🌍 MAP OVERLAYS - BARREL EXPORTS
 *
 * Enterprise barrel export για map overlay components.
 * Centralized export interface for professional architecture.
 *
 * ✅ Enterprise Standards:
 * - TypeScript strict typing
 * - Tree-shakable exports
 * - Clear component organization
 * - Professional architecture
 *
 * @module map-overlays
 */

// ============================================================================
// 🎯 GEO-SPECIFIC MAP OVERLAYS (NO DUPLICATES)
// ============================================================================

// Import components και types για local usage
import { GeoCoordinateDisplay as GeoCoordinateDisplayImport } from './GeoCoordinateDisplay';
import type { GeoCoordinateDisplayProps as GeoCoordinateDisplayPropsImport } from './GeoCoordinateDisplay';
import { GeoAccuracyLegend as GeoAccuracyLegendImport } from './GeoAccuracyLegend';
import type { GeoAccuracyLegendProps as GeoAccuracyLegendPropsImport } from './GeoAccuracyLegend';
import { GeoMapControls as GeoMapControlsImport } from './GeoMapControls';
import type { GeoMapControlsProps as GeoMapControlsPropsImport } from './GeoMapControls';
import { GeoStatusBar as GeoStatusBarImport } from './GeoStatusBar';
import type { GeoStatusBarProps as GeoStatusBarPropsImport } from './GeoStatusBar';

// Re-export components και types
export { GeoCoordinateDisplay, default as GeoCoordinateDisplayComponent } from './GeoCoordinateDisplay';
export type { GeoCoordinateDisplayProps } from './GeoCoordinateDisplay';

export { GeoAccuracyLegend, default as GeoAccuracyLegendComponent } from './GeoAccuracyLegend';
export type { GeoAccuracyLegendProps } from './GeoAccuracyLegend';

export { GeoMapControls, default as GeoMapControlsComponent } from './GeoMapControls';
export type { GeoMapControlsProps } from './GeoMapControls';

export { GeoStatusBar, default as GeoStatusBarComponent } from './GeoStatusBar';
export type { GeoStatusBarProps } from './GeoStatusBar';

// ============================================================================
// 🎯 GROUPED EXPORTS FOR CONVENIENCE
// ============================================================================

/**
 * All geo-specific overlay components
 */
export const MapOverlayComponents = {
  GeoCoordinateDisplay: GeoCoordinateDisplayImport,
  GeoAccuracyLegend: GeoAccuracyLegendImport,
  GeoMapControls: GeoMapControlsImport,
  GeoStatusBar: GeoStatusBarImport
} as const;

/**
 * All overlay component props types
 */
export type MapOverlayComponentProps = {
  GeoCoordinateDisplay: GeoCoordinateDisplayPropsImport;
  GeoAccuracyLegend: GeoAccuracyLegendPropsImport;
  GeoMapControls: GeoMapControlsPropsImport;
  GeoStatusBar: GeoStatusBarPropsImport;
};

// ============================================================================
// 🎯 UTILITY CONSTANTS
// ============================================================================

/**
 * Available overlay component names για type safety
 */
export const OVERLAY_COMPONENT_NAMES = [
  'GeoCoordinateDisplay',
  'GeoAccuracyLegend',
  'GeoMapControls',
  'GeoStatusBar'
] as const;

export type OverlayComponentName = typeof OVERLAY_COMPONENT_NAMES[number];

/**
 * ✅ ENTERPRISE MAP OVERLAYS BARREL COMPLETE (2025-12-17)
 *
 * Features Implemented:
 * ✅ TypeScript strict typing με proper type exports
 * ✅ Tree-shakable exports για performance optimization
 * ✅ Named and default exports για flexibility
 * ✅ Grouped exports για developer convenience
 * ✅ Type-safe component name constants
 * ✅ Professional barrel export patterns
 * ✅ Clear documentation και comments
 * ✅ Enterprise-grade organization
 *
 * Import Examples:
 * ```typescript
 * // Named imports (recommended)
 * import { GeoCoordinateDisplay, GeoMapControls } from '@/components/map-overlays';
 *
 * // Type-only imports
 * import type { GeoCoordinateDisplayProps } from '@/components/map-overlays';
 *
 * // Grouped import
 * import { MapOverlayComponents } from '@/components/map-overlays';
 * const { GeoStatusBar } = MapOverlayComponents;
 *
 * // Default component imports
 * import GeoCoordinateDisplayComponent from '@/components/map-overlays/GeoCoordinateDisplay';
 * ```
 *
 * Enterprise Benefits:
 * 🎯 Single Import Point - Όλα τα overlays από ένα location
 * 🌳 Tree-Shakable - Τα bundlers μπορούν να eliminate unused code
 * 📝 Type Safety - Πλήρης TypeScript support
 * 🔄 Backwards Compatible - Support για named και default imports
 * 📦 Developer Experience - Clean και consistent import patterns
 */
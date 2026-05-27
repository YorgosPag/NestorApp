/**
 * 📍 SNAP SYSTEM MAIN BARREL EXPORT
 *
 * Centralized export για όλο το snap system (geo-canvas façade over
 * ProSnapEngineV2 via getGlobalSnapEngine() — ADR-378 Phase 4).
 *
 * @module floor-plan-system/snapping
 */

// Types (SnapPoint, SnapResult, SnapMode, SnapSettings — consumed by render layer)
export * from './types';

// Config (DEFAULT_SNAP_SETTINGS, SNAP_VISUAL, SNAP_MODE_LABELS, SNAP_MODE_PRIORITY)
export * from './config';

// Hooks (useSnapEngine — ADR-378 Phase 4 façade over getGlobalSnapEngine)
export * from './hooks';

// Rendering (SnapIndicator)
export * from './rendering';

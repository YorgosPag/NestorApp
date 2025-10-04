/**
 * Snap Engine Exports
 * Κεντρικό σημείο εισαγωγής για το snap system
 */

// Main engines
export { ProSnapEngineV2 } from './ProSnapEngineV2'; // Unified snap engine
export { snapSystem } from './pro-snap-engine'; // Global instance for legacy compatibility

// Orchestrator and engines
export { SnapOrchestrator } from './orchestrator/SnapOrchestrator';
export { EndpointSnapEngine } from './engines/EndpointSnapEngine';
export { MidpointSnapEngine } from './engines/MidpointSnapEngine';
export { IntersectionSnapEngine } from './engines/IntersectionSnapEngine';
export { CenterSnapEngine } from './engines/CenterSnapEngine';

// Shared utilities
export { GeometricCalculations } from './shared/GeometricCalculations';
export { SpatialIndex } from './shared/SpatialIndex';
export { BaseSnapEngine, type SnapEngineContext, type SnapEngineResult } from './shared/BaseSnapEngine';

// Types and settings
export * from './extended-types';

// Convenience exports
export { default as useSnapManager } from './hooks/useSnapManager';

/**
 * Migration helper - Use ProSnapEngineV2 for new projects
 */
export const createSnapEngine = (settings?: any) => {
  return new ProSnapEngineV2(settings);
};

/**
 * Feature flag for enabling the new modular architecture
 */
export const ENABLE_MODULAR_SNAP_ENGINE = true;
/**
 * Snap Engine Exports
 * Κεντρικό σημείο εισαγωγής για το snap system
 *
 * 🏢 ENTERPRISE CENTRALIZATION (2025-01-05):
 * - ProSnapSettings is exported from extended-types.ts (no duplicate import needed)
 */

// Main engines
import { ProSnapEngineV2 } from './ProSnapEngineV2'; // Unified snap engine
export { ProSnapEngineV2 };
export { snapSystem } from './pro-snap-engine'; // Global instance for legacy compatibility

// Orchestrator and engines
export { SnapOrchestrator } from './orchestrator/SnapOrchestrator';
export { EndpointSnapEngine } from './engines/EndpointSnapEngine';
export { MidpointSnapEngine } from './engines/MidpointSnapEngine';
export { IntersectionSnapEngine } from './engines/IntersectionSnapEngine';
export { CenterSnapEngine } from './engines/CenterSnapEngine';

// Shared utilities
export { GeometricCalculations } from './shared/GeometricCalculations';
// SpatialIndex migrated to core/spatial - use SpatialFactory instead
export { BaseSnapEngine, type SnapEngineContext, type SnapEngineResult } from './shared/BaseSnapEngine';

// Types and settings (ProSnapSettings exported here)
export * from './extended-types';

// Convenience exports
export { useSnapManager } from './hooks/useSnapManager';

// 🏢 ENTERPRISE: Import ProSnapSettings from extended-types for the factory function
import type { ProSnapSettings } from './extended-types';

/**
 * Migration helper - Use ProSnapEngineV2 for new projects
 */
export const createSnapEngine = (settings?: Partial<ProSnapSettings>) => {
  return new ProSnapEngineV2(settings);
};

/**
 * Feature flag for enabling the new modular architecture
 */
export const ENABLE_MODULAR_SNAP_ENGINE = true;
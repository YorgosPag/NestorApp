/**
 * 🏢 ENTERPRISE POLYGON SYSTEM - MAIN EXPORTS
 * Centralized polygon management system for geo-canvas
 *
 * @module polygon-system
 * @version 1.0.0
 * @enterprise-pattern Facade + Provider Pattern
 */

// ============================================================================
// CORE EXPORTS
// ============================================================================

// Context Provider & Hook
export { PolygonSystemProvider } from './providers/PolygonSystemProvider';
export { usePolygonSystemContext } from './hooks/usePolygonSystemContext';

// Centralized hook (replacement for individual usePolygonSystem calls)
export { useCentralizedPolygonSystem } from './hooks/useCentralizedPolygonSystem';

// Types
export type * from './types/polygon-system.types';

// Components
export { PolygonControls } from './components/PolygonControls';

// Utils
export { polygonSystemConfig } from './utils/polygon-config';
export { createPolygonFromLegacy } from './utils/legacy-migration';

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

import { PolygonSystemProvider } from './providers/PolygonSystemProvider';

export default PolygonSystemProvider;
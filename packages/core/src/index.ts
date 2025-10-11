/**
 * 🌍 GEO-ALERT CORE PACKAGE
 * Core business logic for GEO-ALERT system
 *
 * @version 1.0.0-alpha.1
 * @description Universal polygon system, spatial operations & alert engine
 */

// ============================================================================
// POLYGON SYSTEM EXPORTS
// ============================================================================

// Core Types
export * from '../polygon-system/types';

// Drawing Components
export * from '../polygon-system/drawing/SimplePolygonDrawer';
export * from '../polygon-system/drawing/ControlPointDrawer';

// Converters
export * from '../polygon-system/converters/polygon-converters';

// Utilities
export * from '../polygon-system/utils/polygon-utils';

// React Integrations
export * from '../polygon-system/integrations/usePolygonSystem';
export * from '../polygon-system/integrations/geo-canvas-integration';

// Main Index (re-export everything from polygon-system)
export * from '../polygon-system/index';

// ============================================================================
// PACKAGE INFO
// ============================================================================

export const PACKAGE_INFO = {
  name: '@geo-alert/core',
  version: '1.0.0-alpha.1',
  description: 'Core business logic for GEO-ALERT system - polygon management, spatial operations & alert engine',
  license: 'MIT'
} as const;
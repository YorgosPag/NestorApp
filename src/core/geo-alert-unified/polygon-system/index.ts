/**
 * 🎯 UNIVERSAL POLYGON SYSTEM
 *
 * Κεντρικοποιημένο σύστημα για όλες τις polygon λειτουργίες
 *
 * @module core/polygon-system
 */

// Core types
export type {
  UniversalPolygon,
  PolygonPoint,
  PolygonStyle,
  PolygonType
} from './types';

// Drawing system
export { SimplePolygonDrawer } from './drawing/SimplePolygonDrawer';
export { ControlPointDrawer } from './drawing/ControlPointDrawer';

// Utilities
export {
  validatePolygon,
  calculatePolygonArea,
  isPolygonClosed,
  closePolygon
} from './utils/polygon-utils';

// Converters
export {
  polygonToGeoJSON,
  geoJSONToPolygon,
  polygonToSVG,
  polygonToCSV,
  importPolygonsFromCSV,
  polygonsToGeoJSONCollection,
  exportPolygons
} from './converters/polygon-converters';

// Integrations
export { GeoCanvasPolygonManager } from './integrations/geo-canvas-integration';
export type { GeoCanvasIntegrationOptions } from './integrations/geo-canvas-integration';

// React hooks
export {
  usePolygonSystem,
  PolygonSystemProvider,
  usePolygonSystemContext
} from './integrations/usePolygonSystem';
export type {
  UsePolygonSystemOptions,
  UsePolygonSystemReturn,
  PolygonSystemProviderProps
} from './integrations/usePolygonSystem';
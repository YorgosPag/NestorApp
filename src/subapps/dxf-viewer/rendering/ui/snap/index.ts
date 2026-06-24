/**
 * SNAP MODULE - Public API
 * ✅ ΦΑΣΗ 6: Centralized exports για snap rendering
 */

// ADR-137: SnapRenderer + LegacySnapAdapter removed (dead canvas path).
// Live snap rendering is owned exclusively by SnapIndicatorOverlay (SVG, ADR-040 leaf).

// Snap settings (the only remaining snap types here — result types live in snapping/extended-types.ts).
export type { SnapSettings } from './SnapTypes';

export { DEFAULT_SNAP_SETTINGS } from './SnapTypes';

// 🏢 ADR-137: Snap Icon Geometry Centralization
export {
  SNAP_ICON_GEOMETRY,
  getSnapIconHalf,
  getSnapIconQuarter,
  getTangentCircleRadius,
  getGridDotRadius,
  getNodeDotRadius
} from './snap-icon-config';

// ✅ REMOVED: Περιττή wrapper function - χρησιμοποιήστε απευθείας new SnapRenderer()
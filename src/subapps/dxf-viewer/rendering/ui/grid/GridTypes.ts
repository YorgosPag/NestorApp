/**
 * GRID TYPES - Centralized types για grid rendering
 * ✅ ΦΑΣΗ 6: Unified grid interfaces
 */

import type { UIElementSettings } from '../core/UIRenderer';
import { UI_COLORS } from '../../../config/color-config';

/**
 * 🔺 GRID STYLES
 * Different grid visualization styles
 */
export type GridStyle =
  | 'lines'     // Grid lines
  | 'dots'      // Grid dots
  | 'crosses';  // Grid crosses

/**
 * 🔺 GRID SETTINGS
 * Centralized interface για grid configuration
 * Extends UIElementSettings για consistency
 */
export interface GridSettings extends UIElementSettings {
  readonly color: string;
  readonly size: number;           // Grid spacing in world units
  readonly style: GridStyle;
  readonly lineWidth: number;

  // Advanced features
  readonly majorGridColor: string;
  readonly minorGridColor: string;
  readonly majorInterval: number;  // Major grid lines every N intervals
  readonly showMajorGrid: boolean;
  readonly showMinorGrid: boolean;
  readonly adaptiveOpacity: boolean; // Fade out when zoomed out
  readonly minVisibleSize: number;   // Minimum pixel size to show grid

}

/**
 * 🔺 GRID RENDER DATA
 * Data που χρειάζεται το GridRenderer
 */
export interface GridRenderData {
  readonly settings: GridSettings;
  readonly scale: number;          // Current zoom scale
  readonly offset: { x: number; y: number }; // Current pan offset
  readonly timestamp?: number;     // For animations
}

/**
 * 🔺 GRID RENDER MODES
 * Different rendering approaches
 */
export type GridRenderMode =
  | 'normal'      // Standard grid
  | 'adaptive'    // Adaptive grid based on zoom
  | 'blueprint';  // Blueprint-style grid

/**
 * 🔺 DEFAULT GRID SETTINGS
 * Sensible defaults για grid rendering
 */
export const DEFAULT_GRID_SETTINGS: GridSettings = {
  enabled: true,
  visible: true,
  opacity: 0.3,
  color: UI_COLORS.MEDIUM_GRAY,
  size: 10,              // 10 units spacing
  style: 'lines',
  lineWidth: 1,

  // Advanced features
  majorGridColor: UI_COLORS.GRID_MAJOR,
  minorGridColor: UI_COLORS.GRID_MINOR,
  majorInterval: 5,      // Major grid every 5 intervals
  showMajorGrid: true,
  showMinorGrid: true,
  adaptiveOpacity: true,
  minVisibleSize: 5,     // Don't show grid if smaller than 5px


  zIndex: 100           // Low priority for background rendering
};
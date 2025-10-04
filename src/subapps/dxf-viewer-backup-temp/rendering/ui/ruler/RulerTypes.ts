/**
 * RULER TYPES - Centralized types για ruler rendering
 * ✅ ΦΑΣΗ 6: Unified ruler interfaces
 */

import type { UIElementSettings } from '../core/UIRenderer';

/**
 * 🔺 RULER POSITIONS
 * Different ruler placement options
 */
export type RulerPosition =
  | 'top'
  | 'bottom'
  | 'left'
  | 'right';

/**
 * 🔺 RULER ORIENTATION
 * Ruler direction
 */
export type RulerOrientation =
  | 'horizontal'
  | 'vertical';

/**
 * 🔺 RULER SETTINGS
 * Centralized interface για ruler configuration
 * Extends UIElementSettings για consistency
 */
export interface RulerSettings extends UIElementSettings {
  readonly color: string;
  readonly backgroundColor: string;
  readonly textColor: string;
  readonly fontSize: number;
  readonly height: number;         // For horizontal rulers
  readonly width: number;          // For vertical rulers

  // Ticks configuration
  readonly showMajorTicks: boolean;
  readonly showMinorTicks: boolean;
  readonly majorTickColor: string;
  readonly minorTickColor: string;
  readonly majorTickLength: number;
  readonly minorTickLength: number;
  readonly tickInterval: number;   // Major tick interval in world units

  // Labels configuration
  readonly showLabels: boolean;
  readonly showUnits: boolean;
  readonly unit: string;
  readonly unitsFontSize: number;
  readonly unitsColor: string;
  readonly labelPrecision: number; // Decimal places for labels

  // Background
  readonly showBackground: boolean;
  readonly borderColor: string;
  readonly borderWidth: number;
}

/**
 * 🔺 RULER RENDER DATA
 * Data που χρειάζεται το RulerRenderer
 */
export interface RulerRenderData {
  readonly settings: RulerSettings;
  readonly orientation: RulerOrientation;
  readonly position: RulerPosition;
  readonly scale: number;          // Current zoom scale
  readonly offset: { x: number; y: number }; // Current pan offset
  readonly timestamp?: number;     // For animations
}

/**
 * 🔺 RULER RENDER MODES
 * Different rendering approaches
 */
export type RulerRenderMode =
  | 'normal'      // Standard ruler
  | 'engineering' // Engineering ruler with precise measurements
  | 'architectural'; // Architectural ruler with imperial units

/**
 * 🔺 DEFAULT RULER SETTINGS
 * Sensible defaults για ruler rendering
 */
export const DEFAULT_RULER_SETTINGS: RulerSettings = {
  enabled: true,
  visible: true,
  opacity: 1.0,
  color: '#333333',
  backgroundColor: '#f0f0f0',
  textColor: '#000000',
  fontSize: 12,
  height: 30,              // 30px for horizontal rulers
  width: 30,               // 30px for vertical rulers

  // Ticks configuration
  showMajorTicks: true,
  showMinorTicks: true,
  majorTickColor: '#333333',
  minorTickColor: '#666666',
  majorTickLength: 10,
  minorTickLength: 5,
  tickInterval: 100,       // Major tick every 100 units

  // Labels configuration
  showLabels: true,
  showUnits: true,
  unit: 'mm',
  unitsFontSize: 10,
  unitsColor: '#666666',
  labelPrecision: 0,       // No decimal places by default

  // Background
  showBackground: true,
  borderColor: '#cccccc',
  borderWidth: 1,

  zIndex: 200             // Medium priority for ruler rendering
};
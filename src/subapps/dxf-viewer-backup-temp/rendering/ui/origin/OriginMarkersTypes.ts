/**
 * ORIGIN MARKERS TYPES
 * ✅ UI Renderer-compliant types για Origin Markers debugging overlay
 */

import type { UIElementSettings } from '../core/UIRenderer';

/**
 * 🎯 ORIGIN MARKERS SETTINGS
 * Extends UIElementSettings για consistency με το UI rendering system
 */
export interface OriginMarkersSettings extends UIElementSettings {
  // Crosshair στο origin (0,0)
  color: string;              // Χρώμα του crosshair στο (0,0)
  size: number;               // Pixel size του crosshair
  lineWidth: number;          // Πάχος γραμμών crosshair
  showCenter: boolean;        // Δείχνει μικρό κύκλο στο κέντρο
  centerRadius: number;       // Radius του center circle
  showLabel: boolean;         // Δείχνει "(0,0)" label

  // Πλήρεις άξονες X και Y
  showAxisLines: boolean;     // Δείχνει πλήρεις γραμμές αξόνων X και Y
  axisColor: string;          // Χρώμα για τις γραμμές αξόνων
  axisLineWidth: number;      // Πάχος γραμμών αξόνων
  axisOpacity: number;        // Transparency αξόνων
}

/**
 * 🎯 DEFAULT ORIGIN MARKERS SETTINGS
 */
export const DEFAULT_ORIGIN_MARKERS_SETTINGS: OriginMarkersSettings = {
  // UIElementSettings
  enabled: false,             // 🚫 OFF by default - debug only
  visible: true,              // Visible όταν enabled
  opacity: 0.8,               // Slightly transparent
  zIndex: 1000,               // Top-most layer για debugging

  // Origin crosshair
  color: '#ff0000',           // Κόκκινο για καλύτερη ορατότητα
  size: 15,                   // Μεγαλύτερο για debugging
  lineWidth: 2,               // Έντονες γραμμές
  showCenter: true,           // Center dot για ακρίβεια
  centerRadius: 3,            // Larger center dot
  showLabel: true,            // Debug label

  // Axis lines
  showAxisLines: true,        // Δείχνει πλήρεις άξονες X,Y
  axisColor: '#ff00ff',       // MAGENTA για μέγιστη ορατότητα
  axisLineWidth: 4,           // ΠΑΧΥΤΕΡΕΣ γραμμές
  axisOpacity: 1.0            // 100% OPACITY - μη διαφανείς
};

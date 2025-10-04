/**
 * CROSSHAIR TYPES - Centralized types για crosshair rendering
 * ✅ ΦΑΣΗ 6: Unified crosshair interfaces
 */

import type { Point2D } from '../../types/Types';
import type { UIElementSettings } from '../core/UIRenderer';

/**
 * 🔺 CROSSHAIR SETTINGS
 * Centralized interface για crosshair configuration
 */
export interface CrosshairSettings extends UIElementSettings {
  readonly color: string;
  readonly size: number;           // 0-100 percentage (100 = full screen)
  readonly lineWidth: number;
  readonly style: CrosshairLineStyle;

  // Advanced features
  readonly useCursorGap: boolean;
  readonly centerGapPx: number;
  readonly showCenterDot: boolean;
  readonly centerDotSize: number;
}

/**
 * 🔺 CROSSHAIR LINE STYLES
 * Supported line patterns
 */
export type CrosshairLineStyle =
  | 'solid'
  | 'dashed'
  | 'dotted'
  | 'dash-dot';

/**
 * 🔺 CROSSHAIR RENDER DATA
 * Data που χρειάζεται το CrosshairRenderer
 */
export interface CrosshairRenderData {
  readonly position: Point2D;
  readonly settings: CrosshairSettings;
  readonly gapSize?: number;       // Optional gap for pickbox
  readonly timestamp?: number;     // For animations
}

/**
 * 🔺 CROSSHAIR RENDER MODES
 * Different rendering approaches
 */
export type CrosshairRenderMode =
  | 'normal'      // Standard crosshair
  | 'with-gap'    // Crosshair με gap για pickbox
  | 'animated';   // Animated crosshair (future)

/**
 * 🔺 DEFAULT CROSSHAIR SETTINGS
 * Sensible defaults για crosshair
 */
export const DEFAULT_CROSSHAIR_SETTINGS: CrosshairSettings = {
  enabled: true,
  visible: true,
  opacity: 1.0,
  color: '#ffffff',
  size: 100,             // Full screen
  lineWidth: 1,
  style: 'solid',
  useCursorGap: true,
  centerGapPx: 10,
  showCenterDot: true,
  centerDotSize: 2,
  zIndex: 1000          // High priority για top rendering
};
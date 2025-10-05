/**
 * CURSOR TYPES - Centralized types για cursor rendering
 * ✅ ΦΑΣΗ 6: Unified cursor interfaces
 */

import type { Point2D } from '../../types/Types';
import type { UIElementSettings } from '../core/UIRenderer';

/**
 * 🔺 CURSOR LINE STYLES
 * Supported line patterns για cursor rendering
 */
export type CursorLineStyle =
  | 'solid'
  | 'dashed'
  | 'dotted'
  | 'dash-dot';

/**
 * 🔺 CURSOR SHAPES
 * Different cursor shape types
 */
export type CursorShape =
  | 'square'
  | 'circle'
  | 'diamond'
  | 'cross';

/**
 * 🔺 UI CURSOR SETTINGS
 * UI-specific interface για cursor rendering (διαφορετικό από systems/cursor/config.ts)
 * Extends UIElementSettings για consistency
 */
export interface UICursorSettings extends UIElementSettings {
  readonly color: string;
  readonly size: number;           // Size in pixels
  readonly lineWidth: number;
  readonly shape: CursorShape;
  readonly style: CursorLineStyle;

  // Advanced features
  readonly showFill: boolean;
  readonly fillColor: string;
  readonly fillOpacity: number;
}

/**
 * 🔺 CURSOR RENDER DATA
 * Data που χρειάζεται το CursorRenderer
 */
export interface CursorRenderData {
  readonly position: Point2D;
  readonly settings: UICursorSettings;
  readonly isActive?: boolean;     // Visual feedback για active cursor
  readonly timestamp?: number;     // For animations
}

/**
 * 🔺 CURSOR RENDER MODES
 * Different rendering approaches
 */
export type CursorRenderMode =
  | 'normal'      // Standard cursor shape
  | 'highlight'   // Emphasized cursor (brighter/larger)
  | 'animated';   // Animated cursor (future)

/**
 * 🔺 DEFAULT CURSOR SETTINGS
 * Sensible defaults για cursor rendering
 */
export const DEFAULT_UI_CURSOR_SETTINGS: UICursorSettings = {
  enabled: true,
  visible: true,
  opacity: 0.8,
  color: '#ffffff',
  size: 12,              // 12px pickbox
  lineWidth: 1,
  shape: 'square',
  style: 'solid',
  showFill: false,
  fillColor: '#ffffff',
  fillOpacity: 0.1,
  zIndex: 900           // High priority for cursor visibility
};
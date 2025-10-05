/**
 * ZOOM SYSTEM - CONSTANTS & DEFAULTS
 *
 * ⚠️ DEPRECATED: Αυτό το αρχείο κάνει re-export από το κεντρικό config/transform-config.ts
 *
 * ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ 2025-10-04:
 * - Όλα τα transform/zoom constants είναι τώρα στο config/transform-config.ts
 * - Αυτό το αρχείο διατηρείται για backward compatibility
 * - Χρησιμοποιήστε το TRANSFORM_CONFIG για νέο κώδικα
 *
 * @see ../../config/transform-config.ts - Single source of truth
 */

import type { ZoomConfig } from './zoom-types';
import {
  UI_ZOOM_LIMITS,
  ZOOM_FACTORS as ZOOM_FACTORS_CONFIG,
  TRANSFORM_KEYS,
  TRANSFORM_ANIMATION,
  VIEWPORT_DEFAULTS as VIEWPORT_CONFIG,
  TRANSFORM_HISTORY,
  TRANSFORM_BEHAVIOR,
} from '../../config/transform-config';

// === DEFAULT ZOOM CONFIGURATION ===
export const DEFAULT_ZOOM_CONFIG: ZoomConfig = {
  // Scale limits (CAD-standard - using UI limits for toolbar controls)
  minScale: UI_ZOOM_LIMITS.MIN_SCALE,
  maxScale: UI_ZOOM_LIMITS.MAX_SCALE,

  // Zoom factors
  wheelFactor: ZOOM_FACTORS_CONFIG.WHEEL_IN,
  keyboardFactor: ZOOM_FACTORS_CONFIG.KEYBOARD_IN,

  // Animation
  animated: TRANSFORM_ANIMATION.ENABLED,
  animationDuration: TRANSFORM_ANIMATION.DURATION,

  // Behavior
  zoomToCursor: TRANSFORM_BEHAVIOR.ZOOM_TO_CURSOR,
  restrictToContent: TRANSFORM_BEHAVIOR.RESTRICT_TO_CONTENT,
};

// === RE-EXPORTS FROM CENTRALIZED CONFIG ===
// ✅ Backward compatibility: Existing code continues to work
export const ZOOM_FACTORS = ZOOM_FACTORS_CONFIG;
export const ZOOM_KEYS = TRANSFORM_KEYS;
export const ZOOM_ANIMATION = TRANSFORM_ANIMATION;
export const VIEWPORT_DEFAULTS = VIEWPORT_CONFIG;

// === ZOOM LIMITS (UI-specific) ===
export const ZOOM_LIMITS = {
  MIN_SCALE: UI_ZOOM_LIMITS.MIN_SCALE,
  MAX_SCALE: UI_ZOOM_LIMITS.MAX_SCALE,
  HISTORY_SIZE: TRANSFORM_HISTORY.MAX_SIZE,
} as const;
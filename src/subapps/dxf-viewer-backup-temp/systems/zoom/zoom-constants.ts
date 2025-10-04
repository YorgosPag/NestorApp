/**
 * ZOOM SYSTEM - CONSTANTS & DEFAULTS
 * Σταθερές και default τιμές για το zoom system
 */

import type { ZoomConfig } from './zoom-types';

// === DEFAULT ZOOM CONFIGURATION ===
export const DEFAULT_ZOOM_CONFIG: ZoomConfig = {
  // Scale limits (CAD-standard - balanced for architectural drawings)
  minScale: 0.1,        // 10% - μπορείς να δεις ολόκληρο κτίριο
  maxScale: 50,         // 5000% - μπορείς να δεις millimeter details

  // Zoom factors
  wheelFactor: 1.1,      // 10% zoom per wheel step (industry standard)
  keyboardFactor: 1.1,   // 10% zoom per key press (UNIFIED with wheel)

  // Animation
  animated: false,       // No animation για τώρα
  animationDuration: 200, // 200ms για μελλοντική χρήση

  // Behavior
  zoomToCursor: true,    // Zoom στο σημείο του cursor
  restrictToContent: false // Δεν περιορίζουμε zoom σε content bounds
};

// === ZOOM FACTORS ===
export const ZOOM_FACTORS = {
  WHEEL_IN: 1.1,
  WHEEL_OUT: 0.9,
  KEYBOARD_IN: 1.1,        // UNIFIED: Same as wheel for consistent behavior
  KEYBOARD_OUT: 1 / 1.1,   // UNIFIED: Same as wheel for consistent behavior
  FIT_PADDING: 100,      // Pixels padding για fit-to-view
  WINDOW_MIN_SIZE: 10    // Minimum window size για window zoom
} as const;

// === ZOOM LIMITS ===
export const ZOOM_LIMITS = {
  MIN_SCALE: 0.1,        // 10% - can see entire building/floor plan
  MAX_SCALE: 50,         // 5000% - can see millimeter-level details
  HISTORY_SIZE: 50       // Μέγιστος αριθμός history entries
} as const;

// === KEYBOARD SHORTCUTS ===
export const ZOOM_KEYS = {
  ZOOM_IN: ['+', '='],
  ZOOM_OUT: ['-'],
  FIT_TO_VIEW: ['0'],
  PREVIOUS: ['p'],
  RESET: ['r']
} as const;

// === ZOOM ANIMATION ===
export const ZOOM_ANIMATION = {
  DURATION: 200,         // Animation duration σε ms
  EASING: 'ease-out',    // CSS easing function
  STEPS: 10              // Animation steps
} as const;

// === VIEWPORT DEFAULTS ===
export const VIEWPORT_DEFAULTS = {
  WIDTH: 800,
  HEIGHT: 600,
  PADDING: 50           // Default padding for fit operations
} as const;
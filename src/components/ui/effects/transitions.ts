// ============================================================================
// ⏱️ ENTERPRISE TRANSITION SYSTEM
// ============================================================================
//
// ✨ Centralized transition configurations για consistent timing
// Professional animation curves και durations
// Based on Material Design και Apple HIG guidelines
//
// ============================================================================

/**
 * 🕒 CORE TRANSITION DURATIONS
 * Standard durations για different types of interactions
 */
export const TRANSITION_DURATIONS = {
  /** Instant feedback (75-100ms) */
  INSTANT: 'duration-75',

  /** Fast interactions (100-150ms) */
  FAST: 'duration-150',

  /** Standard interactions (200-250ms) */
  STANDARD: 'duration-200',

  /** Smooth interactions (300ms) */
  SMOOTH: 'duration-300',

  /** Slow/dramatic animations (500ms) */
  SLOW: 'duration-500',

  /** Very slow για complex animations (700ms) */
  VERY_SLOW: 'duration-700'
} as const;

/**
 * 📈 EASING FUNCTIONS
 * Professional easing curves για natural motion
 */
export const TRANSITION_EASING = {
  /** Linear - constant speed */
  LINEAR: 'ease-linear',

  /** Standard ease - natural deceleration */
  EASE: 'ease',

  /** Ease in - slow start */
  EASE_IN: 'ease-in',

  /** Ease out - slow end */
  EASE_OUT: 'ease-out',

  /** Ease in out - slow start and end */
  EASE_IN_OUT: 'ease-in-out',

  /** Custom cubic beziers για advanced animations */
  CUSTOM: {
    /** Sharp - quick and precise */
    SHARP: '[cubic-bezier(0.4, 0.0, 0.6, 1.0)]',

    /** Material - Google Material Design curve */
    MATERIAL: '[cubic-bezier(0.4, 0.0, 0.2, 1.0)]',

    /** Apple - iOS-style natural curve */
    APPLE: '[cubic-bezier(0.25, 0.1, 0.25, 1.0)]',

    /** Bounce - playful spring effect */
    BOUNCE: '[cubic-bezier(0.68, -0.55, 0.265, 1.55)]',

    /** Anticipate - slight reverse before forward */
    ANTICIPATE: '[cubic-bezier(0.36, 0, 0.66, -0.56)]'
  }
} as const;

/**
 * 🎭 TRANSITION PROPERTIES
 * What properties to animate
 */
export const TRANSITION_PROPERTIES = {
  /** All properties - use sparingly */
  ALL: 'transition-all',

  /** Colors only */
  COLORS: 'transition-colors',

  /** Opacity only */
  OPACITY: 'transition-opacity',

  /** Transform only (scale, rotate, translate) */
  TRANSFORM: 'transition-transform',

  /** Shadow only */
  SHADOW: 'transition-shadow',

  /** Background only */
  BACKGROUND: 'transition-[background-color]',

  /** Border only */
  BORDER: 'transition-[border-color]',

  /** Size properties (width, height) */
  SIZE: 'transition-[width,height]',

  /** Custom combinations */
  CUSTOM: {
    /** Transform and opacity για smooth show/hide */
    TRANSFORM_OPACITY: 'transition-[transform,opacity]',

    /** Colors and shadow για button states */
    COLORS_SHADOW: 'transition-[color,background-color,box-shadow]',

    /** Transform and shadow για interactive elements */
    TRANSFORM_SHADOW: 'transition-[transform,box-shadow]'
  }
} as const;

/**
 * 🚀 PRE-BUILT TRANSITION COMBINATIONS
 * Ready-to-use transition patterns για common use cases
 */
export const TRANSITION_PRESETS = {
  /** Ultra-fast για immediate feedback */
  INSTANT_ALL: `${TRANSITION_PROPERTIES.ALL} ${TRANSITION_DURATIONS.INSTANT} ${TRANSITION_EASING.EASE_OUT}`,

  /** Fast color changes για buttons */
  FAST_COLORS: `${TRANSITION_PROPERTIES.COLORS} ${TRANSITION_DURATIONS.FAST} ${TRANSITION_EASING.EASE_OUT}`,

  /** Standard all-purpose transition */
  STANDARD_ALL: `${TRANSITION_PROPERTIES.ALL} ${TRANSITION_DURATIONS.STANDARD} ${TRANSITION_EASING.EASE_IN_OUT}`,

  /** Smooth για premium feel */
  SMOOTH_ALL: `${TRANSITION_PROPERTIES.ALL} ${TRANSITION_DURATIONS.SMOOTH} ${TRANSITION_EASING.EASE_IN_OUT}`,

  /** Transform-only για performance */
  STANDARD_TRANSFORM: `${TRANSITION_PROPERTIES.TRANSFORM} ${TRANSITION_DURATIONS.STANDARD} ${TRANSITION_EASING.EASE_OUT}`,

  /** Colors-only για text και backgrounds */
  STANDARD_COLORS: `${TRANSITION_PROPERTIES.COLORS} ${TRANSITION_DURATIONS.STANDARD} ${TRANSITION_EASING.EASE_IN_OUT}`,

  /** Shadow transitions για cards */
  SMOOTH_SHADOW: `${TRANSITION_PROPERTIES.SHADOW} ${TRANSITION_DURATIONS.SMOOTH} ${TRANSITION_EASING.EASE_OUT}`,

  /** Opacity για fade effects */
  STANDARD_OPACITY: `${TRANSITION_PROPERTIES.OPACITY} ${TRANSITION_DURATIONS.STANDARD} ${TRANSITION_EASING.EASE_IN_OUT}`,

  /** Material Design inspired */
  MATERIAL_STANDARD: `${TRANSITION_PROPERTIES.ALL} ${TRANSITION_DURATIONS.STANDARD} ease-${TRANSITION_EASING.CUSTOM.MATERIAL}`,

  /** Bounce για playful elements */
  BOUNCE_TRANSFORM: `${TRANSITION_PROPERTIES.TRANSFORM} ${TRANSITION_DURATIONS.SLOW} ease-${TRANSITION_EASING.CUSTOM.BOUNCE}`,

  /** ✅ ENTERPRISE FIX: Shortcut alias for STANDARD_OPACITY */
  OPACITY: `${TRANSITION_PROPERTIES.OPACITY} ${TRANSITION_DURATIONS.STANDARD} ${TRANSITION_EASING.EASE_IN_OUT}`,

  /** ✅ ENTERPRISE FIX: Slow all transition for AnalyticsOverview */
  SLOW_ALL: `${TRANSITION_PROPERTIES.ALL} ${TRANSITION_DURATIONS.SLOW} ${TRANSITION_EASING.EASE_IN_OUT}`,
} as const;

/**
 * 📱 CONTEXT-SPECIFIC PRESETS
 * Transitions optimized για specific use cases
 */
export const CONTEXT_TRANSITIONS = {
  /** Button transitions */
  BUTTON: {
    PRIMARY: TRANSITION_PRESETS.FAST_COLORS,
    SECONDARY: TRANSITION_PRESETS.STANDARD_ALL,
    GHOST: TRANSITION_PRESETS.STANDARD_COLORS
  },

  /** Card transitions */
  CARD: {
    STANDARD: TRANSITION_PRESETS.STANDARD_ALL,
    PREMIUM: TRANSITION_PRESETS.SMOOTH_ALL,
    MINIMAL: TRANSITION_PRESETS.STANDARD_TRANSFORM
  },

  /** Navigation transitions */
  NAVIGATION: {
    LINK: TRANSITION_PRESETS.FAST_COLORS,
    DROPDOWN: TRANSITION_PRESETS.STANDARD_ALL,
    SIDEBAR: TRANSITION_PRESETS.SMOOTH_ALL
  },

  /** Form transitions */
  FORM: {
    INPUT_FOCUS: TRANSITION_PRESETS.FAST_COLORS,
    FIELD_VALIDATION: TRANSITION_PRESETS.STANDARD_COLORS,
    SUBMIT_BUTTON: TRANSITION_PRESETS.STANDARD_ALL
  },

  /** Modal/Dialog transitions */
  MODAL: {
    BACKDROP: TRANSITION_PRESETS.STANDARD_OPACITY,
    CONTENT: `${TRANSITION_PROPERTIES.CUSTOM.TRANSFORM_OPACITY} ${TRANSITION_DURATIONS.SMOOTH} ${TRANSITION_EASING.EASE_OUT}`,
    SLIDE_IN: `${TRANSITION_PROPERTIES.TRANSFORM} ${TRANSITION_DURATIONS.SMOOTH} ${TRANSITION_EASING.EASE_OUT}`
  },

  /** Loading states */
  LOADING: {
    SPINNER: `${TRANSITION_PROPERTIES.TRANSFORM} ${TRANSITION_DURATIONS.STANDARD} ${TRANSITION_EASING.LINEAR}`,
    PROGRESS: `${TRANSITION_PROPERTIES.ALL} ${TRANSITION_DURATIONS.SMOOTH} ${TRANSITION_EASING.EASE_OUT}`,
    SKELETON: TRANSITION_PRESETS.STANDARD_OPACITY
  }
} as const;

/**
 * ⚡ PERFORMANCE-OPTIMIZED TRANSITIONS
 * Transitions που χρησιμοποιούν GPU acceleration
 */
export const PERFORMANCE_TRANSITIONS = {
  /** GPU-accelerated transform only */
  GPU_TRANSFORM: `${TRANSITION_PROPERTIES.TRANSFORM} ${TRANSITION_DURATIONS.STANDARD} ${TRANSITION_EASING.EASE_OUT} will-change-transform`,

  /** Optimized opacity */
  GPU_OPACITY: `${TRANSITION_PROPERTIES.OPACITY} ${TRANSITION_DURATIONS.STANDARD} ${TRANSITION_EASING.EASE_IN_OUT} will-change-opacity`,

  /** Combined GPU optimization */
  GPU_COMBINED: `${TRANSITION_PROPERTIES.CUSTOM.TRANSFORM_OPACITY} ${TRANSITION_DURATIONS.STANDARD} ${TRANSITION_EASING.EASE_OUT} will-change-transform will-change-opacity`
} as const;

/**
 * 🎨 ANIMATION UTILITIES
 * Helper functions για dynamic transitions
 */
export const createCustomTransition = (
  property: keyof typeof TRANSITION_PROPERTIES | keyof typeof TRANSITION_PROPERTIES.CUSTOM,
  duration: keyof typeof TRANSITION_DURATIONS,
  easing: keyof typeof TRANSITION_EASING | keyof typeof TRANSITION_EASING.CUSTOM = 'EASE_IN_OUT'
): string => {
  let propertyValue: string;

  if (property in TRANSITION_PROPERTIES) {
    propertyValue = TRANSITION_PROPERTIES[property as keyof typeof TRANSITION_PROPERTIES] as string;
  } else {
    propertyValue = TRANSITION_PROPERTIES.CUSTOM[property as keyof typeof TRANSITION_PROPERTIES.CUSTOM];
  }

  const durationValue = TRANSITION_DURATIONS[duration];

  let easingValue: string;
  if (easing in TRANSITION_EASING) {
    easingValue = TRANSITION_EASING[easing as keyof typeof TRANSITION_EASING] as string;
  } else {
    easingValue = `ease-${TRANSITION_EASING.CUSTOM[easing as keyof typeof TRANSITION_EASING.CUSTOM]}`;
  }

  return `${propertyValue} ${durationValue} ${easingValue}`;
};

/**
 * ⏳ DELAY UTILITIES
 * Για staggered animations
 */
export const TRANSITION_DELAYS = {
  NONE: 'delay-0',
  SHORT: 'delay-75',
  MEDIUM: 'delay-150',
  LONG: 'delay-300',
  VERY_LONG: 'delay-500'
} as const;

/**
 * 🎯 EXPORT EVERYTHING
 */
export const TRANSITIONS = {
  DURATIONS: TRANSITION_DURATIONS,
  EASING: TRANSITION_EASING,
  PROPERTIES: TRANSITION_PROPERTIES,
  PRESETS: TRANSITION_PRESETS,
  CONTEXT: CONTEXT_TRANSITIONS,
  PERFORMANCE: PERFORMANCE_TRANSITIONS,
  DELAYS: TRANSITION_DELAYS,
  createCustom: createCustomTransition,

  // ✅ ENTERPRISE FIX: Shortcut aliases for common usage patterns
  INSTANT_ALL: TRANSITION_PRESETS.INSTANT_ALL,
  FAST_COLORS: TRANSITION_PRESETS.FAST_COLORS,
  STANDARD_ALL: TRANSITION_PRESETS.STANDARD_ALL,
  SMOOTH_ALL: TRANSITION_PRESETS.SMOOTH_ALL,
  STANDARD_TRANSFORM: TRANSITION_PRESETS.STANDARD_TRANSFORM,
  STANDARD_COLORS: TRANSITION_PRESETS.STANDARD_COLORS,
  SMOOTH_SHADOW: TRANSITION_PRESETS.SMOOTH_SHADOW,
  STANDARD_OPACITY: TRANSITION_PRESETS.STANDARD_OPACITY,
  BOUNCE_TRANSFORM: TRANSITION_PRESETS.BOUNCE_TRANSFORM,
  OPACITY: TRANSITION_PRESETS.STANDARD_OPACITY,
} as const;

export default TRANSITIONS;
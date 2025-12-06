// ============================================================================
// PHOTO EFFECTS - ENTERPRISE MODULE
// ============================================================================
//
// ✨ Animation and effect configurations for photo components
// Transitions, hover effects, and interactive styling
// Part of modular Enterprise photo configuration architecture
//
// ============================================================================

/**
 * Photo transition effects για smooth interactions
 */
export const PHOTO_TRANSITIONS = {
  /** Standard transition για most elements */
  STANDARD: 'transition-all duration-300 ease-in-out',

  /** Fast transition για quick feedback */
  FAST: 'transition-all duration-150 ease-in-out',

  /** Slow transition για dramatic effects */
  SLOW: 'transition-all duration-500 ease-in-out',

  /** Opacity only transition */
  OPACITY: 'transition-opacity duration-300 ease-in-out',

  /** Transform only transition για hover effects */
  TRANSFORM: 'transition-transform duration-300 ease-in-out',

  /** Color transition για background changes */
  COLORS: 'transition-colors duration-300 ease-in-out'
} as const;

/**
 * Photo hover effects για interactive elements
 */
export const PHOTO_HOVER_EFFECTS = {
  /** Scale up slightly on hover */
  SCALE_UP: 'hover:scale-105',

  /** Scale down slightly on hover */
  SCALE_DOWN: 'hover:scale-95',

  /** Lift effect with shadow */
  LIFT: 'hover:shadow-lg hover:-translate-y-1',

  /** Subtle glow effect */
  GLOW: 'hover:shadow-md',

  /** Opacity change */
  FADE: 'hover:opacity-80',

  /** Brighten on hover */
  BRIGHTEN: 'hover:brightness-110',

  /** Standard button hover */
  BUTTON: 'hover:bg-opacity-80 hover:scale-105'
} as const;

/**
 * Photo loading animations
 */
export const PHOTO_LOADING_EFFECTS = {
  /** Pulse animation για loading states */
  PULSE: 'animate-pulse',

  /** Spin animation για progress indicators */
  SPIN: 'animate-spin',

  /** Bounce animation για notifications */
  BOUNCE: 'animate-bounce',

  /** Fade in animation */
  FADE_IN: 'animate-fade-in',

  /** Slide up animation */
  SLIDE_UP: 'animate-slide-up'
} as const;

/**
 * Photo focus effects για accessibility
 */
export const PHOTO_FOCUS_EFFECTS = {
  /** Standard focus ring */
  RING: 'focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50',

  /** Outline focus για buttons */
  OUTLINE: 'focus:outline-none focus:ring-2 focus:ring-blue-500',

  /** Subtle focus για form elements */
  SUBTLE: 'focus:ring-1 focus:ring-blue-300',

  /** High contrast focus για accessibility */
  HIGH_CONTRAST: 'focus:ring-2 focus:ring-yellow-400 focus:ring-opacity-75'
} as const;

/**
 * Photo state effects για different states
 */
export const PHOTO_STATE_EFFECTS = {
  /** Disabled state styling */
  DISABLED: 'opacity-50 cursor-not-allowed',

  /** Loading state styling */
  LOADING: 'opacity-75 cursor-wait',

  /** Error state styling */
  ERROR: 'border-red-300 bg-red-50',

  /** Success state styling */
  SUCCESS: 'border-green-300 bg-green-50',

  /** Selected state styling */
  SELECTED: 'border-blue-500 bg-blue-50',

  /** Active state styling */
  ACTIVE: 'shadow-md transform scale-105'
} as const;

/**
 * Combined effect classes για common use cases
 */
export const PHOTO_COMBINED_EFFECTS = {
  /** Interactive card: transition + hover + focus */
  INTERACTIVE_CARD: `${PHOTO_TRANSITIONS.STANDARD} ${PHOTO_HOVER_EFFECTS.LIFT} ${PHOTO_FOCUS_EFFECTS.RING}`,

  /** Upload zone: transition + hover + focus */
  UPLOAD_ZONE: `${PHOTO_TRANSITIONS.STANDARD} ${PHOTO_HOVER_EFFECTS.SCALE_UP} ${PHOTO_FOCUS_EFFECTS.OUTLINE}`,

  /** Action button: transition + hover + focus */
  ACTION_BUTTON: `${PHOTO_TRANSITIONS.FAST} ${PHOTO_HOVER_EFFECTS.BUTTON} ${PHOTO_FOCUS_EFFECTS.RING}`,

  /** Photo preview: transition + hover */
  PHOTO_PREVIEW: `${PHOTO_TRANSITIONS.STANDARD} ${PHOTO_HOVER_EFFECTS.GLOW}`,

  /** Loading overlay: opacity + pulse */
  LOADING_OVERLAY: `${PHOTO_TRANSITIONS.OPACITY} ${PHOTO_LOADING_EFFECTS.PULSE}`
} as const;
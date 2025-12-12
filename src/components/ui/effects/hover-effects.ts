// ============================================================================
// 🎨 ENTERPRISE UI HOVER EFFECTS SYSTEM
// ============================================================================
//
// ✨ Centralized hover patterns για consistent user interactions
// Single source of truth για όλα τα UI hover effects
// Based on analysis από 374 αρχεία με διάσπαρτα hover patterns
//
// ============================================================================

/**
 * 🔄 CORE HOVER TRANSFORMATIONS
 * Βασικές μετατροπές που χρησιμοποιούνται σε όλη την εφαρμογή
 */
export const CORE_HOVER_TRANSFORMS = {
  /** Standard scale up effect για cards και buttons */
  SCALE_UP_SMALL: 'hover:scale-105',

  /** Smaller scale up για subtle interactions */
  SCALE_UP_TINY: 'hover:scale-[1.02]',

  /** Larger scale up για emphasis */
  SCALE_UP_MEDIUM: 'hover:scale-110',

  /** Scale down για pressed/click simulation */
  SCALE_DOWN: 'hover:scale-95',

  /** Lift effect με vertical movement */
  LIFT_SMALL: 'hover:-translate-y-1',

  /** Larger lift effect για dramatic hover */
  LIFT_MEDIUM: 'hover:-translate-y-2',

  /** Rotation για playful elements */
  ROTATE_SLIGHT: 'hover:rotate-1',

  /** Combined scale and lift για premium feel */
  SCALE_AND_LIFT: 'hover:scale-105 hover:-translate-y-1'
} as const;

/**
 * 💫 SHADOW HOVER EFFECTS
 * Professional shadow patterns για depth και hierarchy
 */
export const HOVER_SHADOWS = {
  /** Subtle shadow για cards */
  SUBTLE: 'hover:shadow-md',

  /** Enhanced shadow για important elements */
  ENHANCED: 'hover:shadow-lg',

  /** Dramatic shadow για hero elements */
  DRAMATIC: 'hover:shadow-xl',

  /** Colored shadows με transparency */
  COLORED: {
    BLUE: 'hover:shadow-lg hover:shadow-blue-500/30',
    GREEN: 'hover:shadow-lg hover:shadow-green-500/30',
    PURPLE: 'hover:shadow-lg hover:shadow-purple-500/30',
    RED: 'hover:shadow-lg hover:shadow-red-500/30',
    ORANGE: 'hover:shadow-lg hover:shadow-orange-500/30',
    GRAY: 'hover:shadow-lg hover:shadow-gray-500/30'
  },

  /** Combined shadow with lift */
  LIFTED: 'hover:shadow-lg hover:-translate-y-1'
} as const;

/**
 * 🎨 COLOR & OPACITY HOVER EFFECTS
 * Background, text και opacity changes
 */
export const HOVER_COLOR_EFFECTS = {
  /** Opacity changes */
  FADE_OUT: 'hover:opacity-80',
  FADE_IN: 'hover:opacity-100',
  SUBTLE_FADE: 'hover:opacity-90',

  /** Background opacity changes */
  BG_FADE: 'hover:bg-opacity-80',
  BG_ENHANCE: 'hover:bg-opacity-90',

  /** Brightness adjustments */
  BRIGHTEN: 'hover:brightness-110',
  DARKEN: 'hover:brightness-90',

  /** Filter effects */
  BLUR_SUBTLE: 'hover:backdrop-blur-sm',
  SATURATE: 'hover:saturate-150'
} as const;

/**
 * 📱 INTERACTIVE ELEMENT PATTERNS
 * Common patterns για specific UI elements
 */
export const INTERACTIVE_PATTERNS = {
  /** Standard button hover */
  BUTTON_PRIMARY: `transition-colors duration-200 hover:bg-opacity-90`,

  /** Secondary button hover */
  BUTTON_SECONDARY: `transition-all duration-200 ${CORE_HOVER_TRANSFORMS.SCALE_UP_TINY} ${HOVER_SHADOWS.SUBTLE}`,

  /** Card hover pattern */
  CARD_STANDARD: `transition-all duration-200 ${CORE_HOVER_TRANSFORMS.SCALE_UP_TINY} ${HOVER_SHADOWS.ENHANCED}`,

  /** Card με lift effect */
  CARD_PREMIUM: `transition-all duration-300 ${CORE_HOVER_TRANSFORMS.SCALE_AND_LIFT} ${HOVER_SHADOWS.DRAMATIC}`,

  /** Link hover pattern */
  LINK_STANDARD: 'transition-colors duration-150 hover:text-primary',

  /** Icon hover pattern */
  ICON_STANDARD: `transition-transform duration-200 ${CORE_HOVER_TRANSFORMS.SCALE_UP_SMALL}`,

  /** Avatar hover pattern */
  AVATAR_STANDARD: `transition-all duration-200 ${CORE_HOVER_TRANSFORMS.SCALE_UP_SMALL} hover:ring-2 hover:ring-primary hover:ring-offset-2`,

  /** Image hover pattern */
  IMAGE_STANDARD: `transition-all duration-300 ${CORE_HOVER_TRANSFORMS.SCALE_UP_SMALL} ${HOVER_SHADOWS.SUBTLE}`,

  /** Dropdown item hover */
  DROPDOWN_ITEM: 'transition-colors duration-150 hover:bg-accent hover:text-accent-foreground',

  /** Navigation item hover */
  NAV_ITEM: 'transition-all duration-200 hover:bg-accent hover:text-accent-foreground rounded-md'
} as const;

/**
 * 🎭 GROUP HOVER PATTERNS
 * Patterns που ενεργοποιούνται από parent group hover
 */
export const GROUP_HOVER_PATTERNS = {
  /** Scale up when parent is hovered */
  SCALE_ON_GROUP: 'group-hover:scale-110',

  /** Opacity change on group hover */
  FADE_ON_GROUP: 'group-hover:opacity-90',

  /** Transform on group hover */
  LIFT_ON_GROUP: 'group-hover:-translate-y-1',

  /** Color change on group hover */
  ACCENT_ON_GROUP: 'group-hover:text-accent-foreground'
} as const;

/**
 * 🚀 COMPLEX COMBINED EFFECTS
 * Ready-to-use combinations για specific use cases
 */
export const COMPLEX_HOVER_EFFECTS = {
  /** Social media button hover */
  SOCIAL_BUTTON: `transition-all duration-200 ${CORE_HOVER_TRANSFORMS.SCALE_UP_SMALL} ${HOVER_SHADOWS.COLORED.BLUE}`,

  /** CTA button hover */
  CTA_BUTTON: `transition-all duration-300 ${CORE_HOVER_TRANSFORMS.SCALE_UP_SMALL} ${HOVER_SHADOWS.DRAMATIC} hover:brightness-110`,

  /** Product card hover */
  PRODUCT_CARD: `transition-all duration-300 ${CORE_HOVER_TRANSFORMS.SCALE_UP_TINY} ${HOVER_SHADOWS.ENHANCED} hover:bg-accent/50`,

  /** Feature card hover */
  FEATURE_CARD: `transition-all duration-300 ${CORE_HOVER_TRANSFORMS.LIFT_SMALL} ${HOVER_SHADOWS.ENHANCED}`,

  /** Profile card hover */
  PROFILE_CARD: `transition-all duration-200 ${CORE_HOVER_TRANSFORMS.SCALE_UP_TINY} hover:ring-1 hover:ring-border`,

  /** Notification hover */
  NOTIFICATION: `transition-all duration-200 hover:bg-accent hover:border-accent-foreground/20`,

  /** Dashboard stat card */
  STAT_CARD: `transition-all duration-200 ${CORE_HOVER_TRANSFORMS.SCALE_UP_TINY} ${HOVER_SHADOWS.SUBTLE} hover:border-primary/50`
} as const;

/**
 * 🎯 ACCESSIBILITY-FIRST HOVER PATTERNS
 * Patterns που τηρούν accessibility guidelines
 */
export const ACCESSIBLE_HOVER_PATTERNS = {
  /** Focus-visible support */
  FOCUS_BUTTON: 'transition-all duration-200 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',

  /** High contrast hover */
  HIGH_CONTRAST: 'hover:bg-foreground hover:text-background transition-colors duration-200',

  /** Keyboard navigation friendly */
  KEYBOARD_NAV: 'transition-all duration-200 hover:bg-accent focus:bg-accent focus:outline-none focus:ring-2 focus:ring-ring'
} as const;

/**
 * 💡 UTILITY FUNCTIONS για dynamic hover effects
 */
export const createCustomHoverEffect = (
  transform?: keyof typeof CORE_HOVER_TRANSFORMS,
  shadow?: keyof typeof HOVER_SHADOWS | keyof typeof HOVER_SHADOWS.COLORED,
  duration: 'fast' | 'normal' | 'slow' = 'normal'
): string => {
  const durations = {
    fast: 'transition-all duration-150',
    normal: 'transition-all duration-200',
    slow: 'transition-all duration-300'
  };

  const parts = [durations[duration]];

  if (transform) {
    parts.push(CORE_HOVER_TRANSFORMS[transform]);
  }

  if (shadow) {
    if (shadow in HOVER_SHADOWS) {
      parts.push(HOVER_SHADOWS[shadow as keyof typeof HOVER_SHADOWS] as string);
    } else if (shadow in HOVER_SHADOWS.COLORED) {
      parts.push(HOVER_SHADOWS.COLORED[shadow as keyof typeof HOVER_SHADOWS.COLORED]);
    }
  }

  return parts.join(' ');
};

/**
 * 🎨 Export everything για clean imports
 */
export const UI_HOVER_EFFECTS = {
  TRANSFORMS: CORE_HOVER_TRANSFORMS,
  SHADOWS: HOVER_SHADOWS,
  COLORS: HOVER_COLOR_EFFECTS,
  PATTERNS: INTERACTIVE_PATTERNS,
  GROUP: GROUP_HOVER_PATTERNS,
  COMPLEX: COMPLEX_HOVER_EFFECTS,
  ACCESSIBLE: ACCESSIBLE_HOVER_PATTERNS,
  createCustom: createCustomHoverEffect
} as const;

export default UI_HOVER_EFFECTS;
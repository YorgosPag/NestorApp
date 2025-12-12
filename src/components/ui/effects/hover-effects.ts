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
  LIFTED: 'hover:shadow-lg hover:-translate-y-1',

  /** Sidebar accent border shadow */
  SIDEBAR_ACCENT: 'hover:shadow-[0_0_0_1px_hsl(var(--sidebar-accent))]'
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
  SATURATE: 'hover:saturate-150',

  /** SVG fill color changes */
  FILL_VIOLET: 'hover:fill-violet-500'
} as const;

/**
 * 🎨 HOVER BORDER EFFECTS
 * Dynamic border colors για interactive elements
 */
export const HOVER_BORDER_EFFECTS = {
  /** Primary blue border hover */
  BLUE: 'hover:border-blue-500 dark:hover:border-blue-400',

  /** Purple accent border hover */
  PURPLE: 'hover:border-purple-500 dark:hover:border-purple-400',

  /** Success green border hover */
  GREEN: 'hover:border-green-500 dark:hover:border-green-400',

  /** Warning orange border hover */
  ORANGE: 'hover:border-orange-500 dark:hover:border-orange-400',

  /** Danger red border hover */
  RED: 'hover:border-red-500 dark:hover:border-red-400',

  /** Neutral gray border hover */
  GRAY: 'hover:border-gray-300 dark:hover:border-gray-600'
} as const;

/**
 * 🎨 HOVER TEXT EFFECTS
 * Dynamic text colors για interactive icons και elements
 */
export const HOVER_TEXT_EFFECTS = {
  /** Success/create actions */
  GREEN: 'text-green-600 hover:text-green-700',

  /** Primary/edit actions */
  BLUE: 'text-blue-600 hover:text-blue-700',

  /** Danger/delete actions */
  RED: 'text-red-600 hover:text-red-700',

  /** Filter actions */
  PURPLE: 'text-purple-600 hover:text-purple-700',

  /** Sort actions */
  INDIGO: 'text-indigo-600 hover:text-indigo-700',

  /** Favorites actions */
  YELLOW: 'text-yellow-600 hover:text-yellow-700',

  /** Neutral/archive actions */
  GRAY: 'text-gray-600 hover:text-gray-700',

  /** Export actions */
  EMERALD: 'text-emerald-600 hover:text-emerald-700',

  /** Import actions */
  TEAL: 'text-teal-600 hover:text-teal-700',

  /** System/refresh actions */
  CYAN: 'text-cyan-600 hover:text-cyan-700',

  /** Preview actions */
  ORANGE: 'text-orange-600 hover:text-orange-700',

  /** Copy actions */
  SLATE: 'text-slate-600 hover:text-slate-700',

  /** Share actions */
  PINK: 'text-pink-600 hover:text-pink-700',

  /** Reports actions */
  AMBER: 'text-amber-600 hover:text-amber-700',

  /** Settings actions */
  VIOLET: 'text-violet-600 hover:text-violet-700',

  /** Favorites management */
  ROSE: 'text-rose-600 hover:text-rose-700',

  /** Help actions */
  SKY: 'text-sky-600 hover:text-sky-700',

  /** Blue light text για navigation links */
  BLUE_LIGHT: 'text-blue-400 hover:text-blue-300'
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
  NAV_ITEM: 'transition-all duration-200 hover:bg-accent hover:text-accent-foreground rounded-md',

  // ========================================================================
  // 🆕 MISSING PATTERNS - Added for Batch 3 Migration
  // ========================================================================

  /** Success action hover (green theme) */
  SUCCESS_HOVER: 'transition-all duration-200 hover:bg-green-50 hover:text-green-700 hover:border-green-300 dark:hover:bg-green-900/20 dark:hover:text-green-300',

  /** Primary action hover (blue theme) */
  PRIMARY_HOVER: 'transition-all duration-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 dark:hover:bg-blue-900/20 dark:hover:text-blue-300',

  /** Destructive action hover (red theme) */
  DESTRUCTIVE_HOVER: 'transition-all duration-200 hover:bg-red-50 hover:text-red-700 hover:border-red-300 dark:hover:bg-red-900/20 dark:hover:text-red-300',

  /** Enhanced button με scale και shadow */
  BUTTON_ENHANCED: `transition-all duration-200 ${CORE_HOVER_TRANSFORMS.SCALE_UP_TINY} hover:shadow-md hover:bg-primary/10`,

  /** Accent color hover */
  ACCENT_HOVER: 'transition-colors duration-200 hover:bg-accent hover:text-accent-foreground',

  /** Subtle hover για minimal interactions */
  SUBTLE_HOVER: 'transition-colors duration-150 hover:bg-muted/50 hover:text-foreground',

  /** Link primary color hover */
  LINK_PRIMARY: 'transition-colors duration-150 hover:text-primary hover:underline',

  /** Border subtle hover για cards */
  BORDER_SUBTLE: 'transition-all duration-200 hover:border-border/80',

  /** Fade in/out effect για icons */
  FADE_IN_OUT: 'transition-opacity duration-200',

  /** Enhanced card hover με shadow upgrade */
  CARD_ENHANCED: 'hover:shadow-xl',

  /** Opacity hover για interactive elements */
  OPACITY_HOVER: 'hover:opacity-80',

  // ========================================================================
  // 🔘 BUTTON-SPECIFIC HOVER PATTERNS
  // ========================================================================

  /** Button primary hover (90% opacity) */
  BUTTON_PRIMARY_HOVER: 'hover:bg-primary/90',

  /** Button destructive hover (90% opacity) */
  BUTTON_DESTRUCTIVE_HOVER: 'hover:bg-destructive/90',

  /** Button secondary hover (80% opacity) */
  BUTTON_SECONDARY_HOVER: 'hover:bg-secondary/80',

  /** Button accent hover για ghost/outline */
  BUTTON_ACCENT_HOVER: 'hover:bg-accent hover:text-accent-foreground',

  /** Button underline hover για links */
  BUTTON_LINK_HOVER: 'hover:underline',

  /** Button primary selected state hover */
  BUTTON_PRIMARY_SELECTED_HOVER: 'hover:bg-primary hover:text-primary-foreground',

  // ========================================================================
  // 🏢 SIDEBAR-SPECIFIC HOVER PATTERNS (New for Batch 10 Migration)
  // ========================================================================

  /** Sidebar accent background hover */
  SIDEBAR_ACCENT_HOVER: 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',

  /** Sidebar background hover for rail */
  SIDEBAR_BACKGROUND_HOVER: 'hover:bg-sidebar',

  /** Border hover for pseudo-elements (after/before) */
  BORDER_HOVER_AFTER: 'hover:after:bg-sidebar-border',

  /** Text hover για standard text elements */
  TEXT_HOVER: 'hover:text-foreground',

  /** Warning themed hover (orange colors) */
  WARNING_HOVER: 'hover:bg-orange-100 hover:text-orange-700 dark:hover:bg-orange-900/20 dark:hover:text-orange-300',

  /** Purple themed hover για special actions */
  PURPLE_HOVER: 'hover:bg-purple-100 dark:hover:bg-purple-900/40',

  /** Text highlight για close buttons και navigation */
  TEXT_HIGHLIGHT: 'hover:text-white'
} as const;

/**
 * 🎨 HOVER BACKGROUND EFFECTS
 * Background color changes για navigation και interactive elements
 */
export const HOVER_BACKGROUND_EFFECTS = {
  /** Light background για navigation items */
  LIGHT: 'hover:bg-gray-50 dark:hover:bg-gray-800/50',

  /** Muted background για subtle interactions */
  MUTED: 'hover:bg-muted/50',

  /** Accent background για highlighting */
  ACCENT: 'hover:bg-accent/50',

  /** Primary background για important actions */
  PRIMARY: 'hover:bg-primary/10',

  /** Transparent background με transitions */
  TRANSPARENT: 'hover:bg-black/5 dark:hover:bg-white/5',

  /** Blue button background hover (darker shade) */
  BLUE_BUTTON: 'hover:bg-blue-700',

  /** Orange button background hover (darker shade) */
  ORANGE_BUTTON: 'hover:bg-orange-700',

  /** Green button background hover (darker shade) */
  GREEN_BUTTON: 'hover:bg-green-700',

  /** Purple button background hover (darker shade) */
  PURPLE_BUTTON: 'hover:bg-purple-700',

  /** Yellow button background hover (darker shade) */
  YELLOW_BUTTON: 'hover:bg-yellow-700',

  /** Indigo button background hover (darker shade) */
  INDIGO_BUTTON: 'hover:bg-indigo-700',

  /** Gray button background hover (darker shade) */
  GRAY_BUTTON: 'hover:bg-gray-700',

  /** Gray panel background hover (medium shade) */
  GRAY_PANEL: 'hover:bg-gray-600',

  /** Gray dark background hover (darker shade for modals) */
  GRAY_DARK: 'hover:bg-gray-800',

  /** Blue light background hover (lighter shade) */
  BLUE_LIGHT: 'hover:bg-blue-500',

  /** Purple light background hover (lighter shade) */
  PURPLE_LIGHT: 'hover:bg-purple-500',

  /** Gray 750 background hover (custom dark shade) */
  GRAY_750: 'hover:bg-gray-750',

  /** Gray background hover with opacity (semi-transparent) */
  GRAY_SEMI: 'hover:bg-gray-700/50',

  /** Success state hover (green with light opacity) */
  SUCCESS_HOVER: 'hover:bg-green-500/20',

  /** File input button hover (sky color) */
  FILE_INPUT: 'hover:file:bg-sky-500',

  /** DXF Toolbar button hover (dark background) */
  TOOLBAR_DEFAULT: 'hover:bg-[#262626] hover:border-[#3a3a3a]',

  /** DXF Toolbar primary button hover */
  TOOLBAR_PRIMARY: 'hover:bg-[#364157] hover:border-[#4a5a7a]',

  /** DXF Toolbar success button hover */
  TOOLBAR_SUCCESS: 'hover:bg-[#255233] hover:border-[#36a555]',

  /** DXF Toolbar danger button hover */
  TOOLBAR_DANGER: 'hover:bg-[#352626] hover:border-[#6a3535]',

  /** Success button hover (green) */
  SUCCESS_BUTTON: 'hover:bg-green-500'
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
  ACCENT_ON_GROUP: 'group-hover:text-accent-foreground',

  /** Subtle opacity reveal on group hover */
  REVEAL_ON_GROUP: 'opacity-0 group-hover:opacity-20',

  /** Full opacity reveal on group hover */
  SHOW_ON_GROUP: 'opacity-0 group-hover:opacity-100',

  /** Blue text color on group hover */
  BLUE_TEXT_ON_GROUP: 'group-hover:text-blue-600',

  /** Blue icon color on group hover (lighter shade) */
  BLUE_ICON_ON_GROUP: 'group-hover:text-blue-500'
} as const;

/**
 * 🌈 GRADIENT HOVER EFFECTS
 * Beautiful gradient patterns με hover states
 */
export const GRADIENT_HOVER_EFFECTS = {
  /** Primary gradient button με hover transition */
  PRIMARY_BUTTON: 'bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700',

  /** Success gradient με hover */
  SUCCESS_BUTTON: 'bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-lg hover:from-green-600 hover:to-emerald-700',

  /** Warning gradient με hover */
  WARNING_BUTTON: 'bg-gradient-to-r from-orange-500 to-red-600 text-white font-semibold rounded-lg hover:from-orange-600 hover:to-red-700',

  /** Neutral gradient με hover */
  NEUTRAL_BUTTON: 'bg-gradient-to-r from-gray-600 to-slate-700 text-white font-semibold rounded-lg hover:from-gray-700 hover:to-slate-800',

  /** Purple to Pink gradient με hover */
  PURPLE_PINK_BUTTON: 'hover:from-purple-500 hover:to-pink-500'
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
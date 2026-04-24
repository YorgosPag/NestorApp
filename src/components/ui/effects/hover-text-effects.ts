/**
 * 🎨 HOVER TEXT EFFECTS
 * Dynamic text colors for interactive icons and elements.
 * Extracted from hover-effects.ts for file-size compliance (SRP).
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
  GRAY_TO_BLACK: 'text-gray-600 hover:text-black',
  GRAY_600_TO_800: 'text-gray-600 hover:text-gray-800',
  BLUE_DARK: 'text-blue-700 hover:text-blue-800',
  WHITE: 'text-white hover:text-gray-100',
  DARKER: 'text-gray-800 hover:text-gray-900',
  RED_LIGHT: 'text-red-400 hover:text-red-500',
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
  BLUE_LIGHT: 'text-blue-400 hover:text-blue-300',
  TO_PRIMARY: 'hover:text-blue-500',
  LIGHTER: 'hover:text-gray-400',
  GRAY_LIGHT: 'hover:text-gray-300',
  DESTRUCTIVE: 'text-red-600 hover:text-red-700',
  GREEN_SUBTLE: 'text-green-500 hover:text-green-600',
  BLUE_SUBTLE: 'text-blue-500 hover:text-blue-600',
  RED_SUBTLE: 'text-red-500 hover:text-red-600',
  PRIMARY_WITH_UNDERLINE: 'text-primary hover:text-primary/80 hover:underline',
  BLUE_WITH_UNDERLINE: 'text-blue-600 hover:text-blue-700 hover:underline',
} as const;

// ============================================================================
// PHOTO COLORS - ENTERPRISE MODULE
// ============================================================================
//
// 🎨 Color configurations for photo components
// Background colors, borders, and semantic color schemes
// Part of modular Enterprise photo configuration architecture
//
// ============================================================================

import { borderVariants } from '@/styles/design-tokens';

/**
 * Standard photo background colors για consistent UI
 */
export const PHOTO_COLORS = {
  /** Main photo container background */
  PHOTO_BACKGROUND: 'bg-gray-200',

  /** Empty state background */
  EMPTY_STATE_BACKGROUND: 'rgb(43, 59, 85)',

  /** Muted background για placeholders */
  MUTED_BACKGROUND: 'bg-muted',

  /** Overlay background για hover effects */
  OVERLAY_BACKGROUND: 'bg-black',

  /** Label background για photo names */
  LABEL_BACKGROUND: 'bg-black bg-opacity-60',

  /** Light background για upload zones */
  UPLOAD_BACKGROUND: 'bg-gray-100',

  /** Loading overlay background */
  LOADING_OVERLAY: 'bg-gray-100 bg-opacity-75',

  /** Progress bar background */
  PROGRESS_BACKGROUND: 'bg-gray-200',

  /** Cancel button background */
  CANCEL_BUTTON: 'bg-gray-300'
} as const;

/**
 * Photo border colors για consistent styling
 */
export const PHOTO_BORDERS = {
  /** Dashed borders για empty states */
  EMPTY_STATE: `border-2 border-dashed ${borderVariants.input.default.className.split(' ')[1]}`,

  /** Hover border για empty states */
  EMPTY_HOVER: `hover:${borderVariants.input.focus.className}`,

  /** Primary border για active states */
  PRIMARY: 'border-primary',

  /** Standard border */
  STANDARD: 'border-border'
} as const;

/**
 * Photo text colors για consistent typography
 */
export const PHOTO_TEXT_COLORS = {
  /** Muted text για empty states */
  MUTED: 'text-gray-400',

  /** White text για overlays */
  OVERLAY: 'text-white',

  /** Muted foreground */
  FOREGROUND_MUTED: 'text-muted-foreground',

  /** Light gray text για secondary content */
  LIGHT_MUTED: 'text-gray-500',

  /** Medium gray text για upload states */
  MEDIUM: 'text-gray-600',

  /** Light icon colors για inactive states */
  ICON_LIGHT: 'text-gray-300',

  /** Gray text για form labels */
  LABEL: 'text-gray-700'
} as const;

/**
 * Photo semantic colors για consistent meaning
 */
export const PHOTO_SEMANTIC_COLORS = {
  /** Error states */
  ERROR: 'text-red-600',

  /** Success states */
  SUCCESS: 'text-green-600',

  /** Loading states */
  LOADING: 'text-blue-600',

  /** Warning states */
  WARNING: 'text-yellow-600',

  /** Info states */
  INFO: 'text-blue-700'
} as const;
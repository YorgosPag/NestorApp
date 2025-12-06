// ============================================================================
// PHOTO SIZES & DIMENSIONS - ENTERPRISE MODULE
// ============================================================================
//
// 📐 Core size and dimension configurations for photo components
// Centralized width, height and combined size definitions
// Part of modular Enterprise photo configuration architecture
//
// ============================================================================

/**
 * Standard photo heights για consistent UI
 */
export const PHOTO_HEIGHTS = {
  /** Main photo preview height - χρήση για όλα τα κύρια previews */
  STANDARD: 'h-[300px]',

  /** Compact photo preview height - χρήση για compact modes */
  COMPACT: 'h-[220px]',

  /** Thumbnail size - χρήση για small thumbnails */
  THUMBNAIL: 'h-20',

  /** Avatar size - χρήση για user avatars */
  AVATAR: 'h-12',

  /** Large preview - χρήση για detailed modals */
  LARGE: 'h-[400px]',

  /** Upload zone height - χρήση για photo upload zones */
  UPLOAD_ZONE: 'h-[280px]',

  /** Compact upload minimum height - χρήση για compact upload modes */
  UPLOAD_MIN: 'min-h-[120px]'
} as const;

/**
 * Standard photo widths για consistent UI
 */
export const PHOTO_WIDTHS = {
  /** Full width - χρήση για responsive layouts */
  FULL: 'w-full',

  /** Standard square - χρήση για logos και avatars */
  SQUARE_STANDARD: 'w-[300px]',

  /** Large square - χρήση για service logos */
  SQUARE_LARGE: 'w-[400px]',

  /** Thumbnail size */
  THUMBNAIL: 'w-16',

  /** Avatar size */
  AVATAR: 'w-12',

  /** Compact preview */
  COMPACT: 'w-64'
} as const;

/**
 * Pre-combined dimension classes για common use cases
 */
export const PHOTO_SIZES = {
  /** Standard preview card - 300x300px για main previews */
  STANDARD_PREVIEW: `${PHOTO_WIDTHS.FULL} ${PHOTO_HEIGHTS.STANDARD}`,

  /** Compact preview card - full width, 220px height */
  COMPACT_PREVIEW: `${PHOTO_WIDTHS.FULL} ${PHOTO_HEIGHTS.COMPACT}`,

  /** Thumbnail - 16x16 for small UI elements */
  THUMBNAIL: `${PHOTO_WIDTHS.THUMBNAIL} ${PHOTO_HEIGHTS.THUMBNAIL}`,

  /** Avatar - 12x12 for user avatars */
  AVATAR: `${PHOTO_WIDTHS.AVATAR} ${PHOTO_HEIGHTS.AVATAR}`,

  /** Service logo - 400x300 για service logos */
  SERVICE_LOGO: `${PHOTO_WIDTHS.SQUARE_LARGE} ${PHOTO_HEIGHTS.STANDARD}`,

  /** Company logo - 300x300 square for company branding */
  COMPANY_LOGO: `${PHOTO_WIDTHS.SQUARE_STANDARD} ${PHOTO_HEIGHTS.STANDARD}`,

  /** Large modal - 400x400 για detailed viewing */
  LARGE_MODAL: `${PHOTO_WIDTHS.SQUARE_LARGE} ${PHOTO_HEIGHTS.LARGE}`,

  /** Upload compact - 64x220 για upload previews */
  UPLOAD_COMPACT: `${PHOTO_WIDTHS.COMPACT} ${PHOTO_HEIGHTS.COMPACT}`,

  /** Grid item - aspect square για dynamic grids */
  GRID_ITEM: 'aspect-square'
} as const;

/**
 * Icon sizes για photo-related UI elements
 */
export const PHOTO_ICON_SIZES = {
  /** Small icons - χρήση σε buttons και compact UI */
  SMALL: 'w-4 h-4',

  /** Medium icons - χρήση σε headers και normal UI */
  MEDIUM: 'w-8 h-8',

  /** Large icons - χρήση σε empty states */
  LARGE: 'w-12 h-12',

  /** Extra large - χρήση σε empty placeholders */
  EXTRA_LARGE: 'w-16 h-16'
} as const;

/**
 * Button sizes για photo actions
 */
export const PHOTO_BUTTON_SIZES = {
  /** Small action buttons */
  SMALL: 'p-1',

  /** Medium action buttons */
  MEDIUM: 'p-2',

  /** Large action buttons */
  LARGE: 'p-3'
} as const;
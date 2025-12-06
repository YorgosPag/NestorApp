// ============================================================================
// PHOTO TYPOGRAPHY - ENTERPRISE MODULE
// ============================================================================
//
// ✍️ Typography configurations for photo components
// Font sizes, weights, line heights and text styling
// Part of modular Enterprise photo configuration architecture
//
// ============================================================================

/**
 * Photo text sizes για consistent typography
 */
export const PHOTO_TEXT_SIZES = {
  /** Small text για metadata and labels */
  SMALL: 'text-sm',

  /** Standard text για descriptions */
  STANDARD: 'text-base',

  /** Large text για titles */
  LARGE: 'text-lg',

  /** Extra large για headers */
  EXTRA_LARGE: 'text-xl',

  /** Tiny text για technical info */
  TINY: 'text-xs'
} as const;

/**
 * Photo font weights για consistent emphasis
 */
export const PHOTO_FONT_WEIGHTS = {
  /** Normal weight για body text */
  NORMAL: 'font-normal',

  /** Medium weight για important text */
  MEDIUM: 'font-medium',

  /** Semibold για headings */
  SEMIBOLD: 'font-semibold',

  /** Bold για emphasis */
  BOLD: 'font-bold',

  /** Light για subtle text */
  LIGHT: 'font-light'
} as const;

/**
 * Photo line heights για readability
 */
export const PHOTO_LINE_HEIGHTS = {
  /** Tight για compact layouts */
  TIGHT: 'leading-tight',

  /** Normal για standard text */
  NORMAL: 'leading-normal',

  /** Relaxed για easy reading */
  RELAXED: 'leading-relaxed',

  /** Loose για spaced content */
  LOOSE: 'leading-loose'
} as const;

/**
 * Photo text alignment για consistent layouts
 */
export const PHOTO_TEXT_ALIGNMENT = {
  /** Left aligned text */
  LEFT: 'text-left',

  /** Center aligned text για labels and titles */
  CENTER: 'text-center',

  /** Right aligned text για numerical data */
  RIGHT: 'text-right',

  /** Justified text για descriptions */
  JUSTIFY: 'text-justify'
} as const;

/**
 * Combined typography classes για common use cases
 */
export const PHOTO_TYPOGRAPHY = {
  /** Photo label: small, medium weight, center aligned */
  LABEL: `${PHOTO_TEXT_SIZES.SMALL} ${PHOTO_FONT_WEIGHTS.MEDIUM} ${PHOTO_TEXT_ALIGNMENT.CENTER}`,

  /** Photo title: large, semibold, center aligned */
  TITLE: `${PHOTO_TEXT_SIZES.LARGE} ${PHOTO_FONT_WEIGHTS.SEMIBOLD} ${PHOTO_TEXT_ALIGNMENT.CENTER}`,

  /** Photo description: standard, normal, left aligned */
  DESCRIPTION: `${PHOTO_TEXT_SIZES.STANDARD} ${PHOTO_FONT_WEIGHTS.NORMAL} ${PHOTO_TEXT_ALIGNMENT.LEFT}`,

  /** Photo metadata: tiny, light, right aligned */
  METADATA: `${PHOTO_TEXT_SIZES.TINY} ${PHOTO_FONT_WEIGHTS.LIGHT} ${PHOTO_TEXT_ALIGNMENT.RIGHT}`,

  /** Upload text: standard, medium, center */
  UPLOAD_TEXT: `${PHOTO_TEXT_SIZES.STANDARD} ${PHOTO_FONT_WEIGHTS.MEDIUM} ${PHOTO_TEXT_ALIGNMENT.CENTER}`,

  /** Error text: small, semibold, left aligned */
  ERROR_TEXT: `${PHOTO_TEXT_SIZES.SMALL} ${PHOTO_FONT_WEIGHTS.SEMIBOLD} ${PHOTO_TEXT_ALIGNMENT.LEFT}`
} as const;
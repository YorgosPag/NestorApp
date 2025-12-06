// ============================================================================
// PHOTO LAYOUTS - ENTERPRISE MODULE
// ============================================================================
//
// 🏗️ Layout-specific dimension configurations for photo components
// Grid layouts, container arrangements, and responsive configurations
// Part of modular Enterprise photo configuration architecture
//
// ============================================================================

// Import size configurations from the same module
import { PHOTO_SIZES, PHOTO_HEIGHTS, PHOTO_WIDTHS } from './sizes';

/**
 * Layout-specific dimension configurations
 */
export const PHOTO_LAYOUTS = {
  /** Company photos: logo + representative (2x1 grid) */
  COMPANY_GRID: {
    container: 'grid grid-cols-1 md:grid-cols-2 gap-6 p-2',
    item: PHOTO_SIZES.STANDARD_PREVIEW,
    itemWrapper: `${PHOTO_HEIGHTS.STANDARD} ${PHOTO_WIDTHS.FULL}`
  },

  /** Individual photos: 6 photos (3x2 grid) - UNIFIED με Modal */
  INDIVIDUAL_GRID: {
    container: 'grid grid-cols-3 gap-8 p-2',
    item: PHOTO_SIZES.STANDARD_PREVIEW,
    itemWrapper: PHOTO_SIZES.STANDARD_PREVIEW
  },

  /** Service logo: centered single logo */
  SERVICE_CENTER: {
    container: 'flex justify-center p-2',
    item: PHOTO_SIZES.STANDARD_PREVIEW,
    itemWrapper: PHOTO_SIZES.SERVICE_LOGO
  },

  /** Photo grid: dynamic grid για project/building photos */
  PHOTO_GRID: {
    container: 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4',
    item: PHOTO_SIZES.GRID_ITEM,
    itemWrapper: PHOTO_SIZES.GRID_ITEM
  },

  /** Upload section: vertical layout για upload forms */
  UPLOAD_SECTION: {
    container: 'flex flex-col gap-4',
    item: PHOTO_SIZES.COMPACT_PREVIEW,
    itemWrapper: PHOTO_SIZES.UPLOAD_COMPACT
  }
} as const;

/**
 * Get layout configuration για specific layout type
 */
export function getPhotoLayout(layout: keyof typeof PHOTO_LAYOUTS) {
  return PHOTO_LAYOUTS[layout];
}
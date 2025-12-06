// ============================================================================
// PHOTO RESPONSIVE CONFIGURATIONS - ENTERPRISE MODULE
// ============================================================================
//
// 📱 Responsive dimension configurations for different screen sizes
// Mobile-first approach with breakpoint-specific adjustments
// Part of modular Enterprise photo configuration architecture
//
// ============================================================================

// Import size configurations from the same module
import { PHOTO_HEIGHTS, PHOTO_WIDTHS } from './sizes';

/**
 * Responsive dimension configurations για different screen sizes
 */
export const PHOTO_RESPONSIVE = {
  /** Mobile-first approach */
  MOBILE: {
    height: PHOTO_HEIGHTS.COMPACT,
    width: PHOTO_WIDTHS.FULL,
    gridCols: 'grid-cols-1'
  },

  /** Tablet dimensions */
  TABLET: {
    height: PHOTO_HEIGHTS.STANDARD,
    width: PHOTO_WIDTHS.FULL,
    gridCols: 'md:grid-cols-2'
  },

  /** Desktop dimensions */
  DESKTOP: {
    height: PHOTO_HEIGHTS.STANDARD,
    width: PHOTO_WIDTHS.FULL,
    gridCols: 'lg:grid-cols-3'
  },

  /** Large desktop */
  LARGE_DESKTOP: {
    height: PHOTO_HEIGHTS.LARGE,
    width: PHOTO_WIDTHS.FULL,
    gridCols: 'xl:grid-cols-4'
  }
} as const;

/**
 * Build responsive class string
 */
export function buildResponsivePhotoClass(
  mobile: string = PHOTO_RESPONSIVE.MOBILE.height,
  tablet: string = PHOTO_RESPONSIVE.TABLET.height,
  desktop: string = PHOTO_RESPONSIVE.DESKTOP.height
): string {
  return `${mobile} ${tablet} ${desktop}`;
}
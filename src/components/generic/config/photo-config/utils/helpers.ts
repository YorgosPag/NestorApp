// ============================================================================
// PHOTO UTILITIES & HELPERS - ENTERPRISE MODULE
// ============================================================================
//
// 🛠️ Utility functions for photo component configuration
// Helper functions, validation, and common operations
// Part of modular Enterprise photo configuration architecture
//
// ============================================================================

import { PHOTO_SIZES, PHOTO_HEIGHTS, PHOTO_WIDTHS } from '../dimensions/sizes';
import { PHOTO_LAYOUTS } from '../dimensions/layouts';
import { PHOTO_RESPONSIVE } from '../dimensions/responsive';

/**
 * Photo type enumeration για different photo categories
 */
export type PhotoType = 'company-logo' | 'company-representative' | 'individual' | 'service-logo' | 'project' | 'building';

/**
 * Build complete photo class string από multiple configurations
 */
export function buildPhotoClass(
  size: keyof typeof PHOTO_SIZES = 'STANDARD_PREVIEW',
  effects?: string,
  colors?: string,
  typography?: string
): string {
  const classes = [PHOTO_SIZES[size]];

  if (effects) classes.push(effects);
  if (colors) classes.push(colors);
  if (typography) classes.push(typography);

  return classes.join(' ');
}

/**
 * Get appropriate photo configuration για specific type
 */
export function getPhotoConfig(type: PhotoType) {
  switch (type) {
    case 'company-logo':
      return {
        size: PHOTO_SIZES.COMPANY_LOGO,
        layout: PHOTO_LAYOUTS.COMPANY_GRID,
        aspectRatio: 'aspect-square'
      };

    case 'company-representative':
      return {
        size: PHOTO_SIZES.STANDARD_PREVIEW,
        layout: PHOTO_LAYOUTS.COMPANY_GRID,
        aspectRatio: 'aspect-[4/3]'
      };

    case 'individual':
      return {
        size: PHOTO_SIZES.STANDARD_PREVIEW,
        layout: PHOTO_LAYOUTS.INDIVIDUAL_GRID,
        aspectRatio: 'aspect-[4/3]'
      };

    case 'service-logo':
      return {
        size: PHOTO_SIZES.SERVICE_LOGO,
        layout: PHOTO_LAYOUTS.SERVICE_CENTER,
        aspectRatio: 'aspect-[4/3]'
      };

    case 'project':
    case 'building':
      return {
        size: PHOTO_SIZES.GRID_ITEM,
        layout: PHOTO_LAYOUTS.PHOTO_GRID,
        aspectRatio: 'aspect-square'
      };

    default:
      return {
        size: PHOTO_SIZES.STANDARD_PREVIEW,
        layout: PHOTO_LAYOUTS.PHOTO_GRID,
        aspectRatio: 'aspect-square'
      };
  }
}

/**
 * Calculate responsive photo dimensions για given viewport
 */
export function calculatePhotoDimensions(
  viewportWidth: number,
  type: PhotoType = 'individual'
): {
  width: number;
  height: number;
  columns: number;
} {
  // Determine grid columns based on viewport
  let columns = 1;
  if (viewportWidth >= 1024) columns = 4; // lg
  else if (viewportWidth >= 768) columns = 3; // md
  else if (viewportWidth >= 640) columns = 2; // sm

  // Adjust columns based on photo type
  if (type === 'company-logo' || type === 'company-representative') {
    columns = Math.min(columns, 2); // Max 2 columns για company photos
  }

  // Calculate dimensions
  const padding = 32; // Total padding
  const gap = 16 * (columns - 1); // Gap between items
  const width = Math.floor((viewportWidth - padding - gap) / columns);
  const height = type === 'individual' ? width * 0.75 : width; // 4:3 ratio για individuals, 1:1 για others

  return { width, height, columns };
}

/**
 * Validate photo dimensions configuration
 */
export function validatePhotoDimensions(config: {
  width?: string;
  height?: string;
  aspectRatio?: string;
}): boolean {
  const { width, height, aspectRatio } = config;

  // Check if at least one dimension is specified
  if (!width && !height && !aspectRatio) {
    return false;
  }

  // Validate width format
  if (width && !isValidTailwindClass(width)) {
    return false;
  }

  // Validate height format
  if (height && !isValidTailwindClass(height)) {
    return false;
  }

  // Validate aspect ratio format
  if (aspectRatio && !aspectRatio.startsWith('aspect-')) {
    return false;
  }

  return true;
}

/**
 * Helper function to validate Tailwind CSS class format
 */
function isValidTailwindClass(className: string): boolean {
  // Basic validation για common Tailwind patterns
  const patterns = [
    /^w-/, /^h-/, /^min-/, /^max-/,
    /^w-\[/, /^h-\[/, // Arbitrary values
    /^aspect-/
  ];

  return patterns.some(pattern => pattern.test(className));
}

/**
 * Get photo placeholder configuration για empty states
 */
export function getPhotoPlaceholder(type: PhotoType) {
  const baseConfig = getPhotoConfig(type);

  return {
    ...baseConfig,
    placeholder: true,
    icon: type === 'company-logo' || type === 'service-logo' ? 'building' : 'user',
    text: getPlaceholderText(type)
  };
}

/**
 * Get appropriate placeholder text για photo type
 */
function getPlaceholderText(type: PhotoType): string {
  switch (type) {
    case 'company-logo':
      return 'Λογότυπο Εταιρείας';
    case 'company-representative':
      return 'Εκπρόσωπος Εταιρείας';
    case 'individual':
      return 'Φωτογραφία Ατόμου';
    case 'service-logo':
      return 'Λογότυπο Υπηρεσίας';
    case 'project':
      return 'Φωτογραφία Έργου';
    case 'building':
      return 'Φωτογραφία Κτιρίου';
    default:
      return 'Φωτογραφία';
  }
}

/**
 * Build responsive grid classes για photo layouts
 */
export function buildResponsiveGrid(type: PhotoType): string {
  const baseClasses = ['grid', 'gap-4'];

  switch (type) {
    case 'company-logo':
    case 'company-representative':
      baseClasses.push('grid-cols-1', 'md:grid-cols-2');
      break;

    case 'individual':
      baseClasses.push('grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-3');
      break;

    case 'service-logo':
      baseClasses.push('grid-cols-1', 'place-items-center');
      break;

    case 'project':
    case 'building':
      baseClasses.push('grid-cols-2', 'md:grid-cols-3', 'lg:grid-cols-4');
      break;

    default:
      baseClasses.push('grid-cols-2', 'md:grid-cols-3', 'lg:grid-cols-4');
  }

  return baseClasses.join(' ');
}
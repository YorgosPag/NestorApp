/**
 * 📏 PHOTO DIMENSIONS CONFIGURATION
 *
 * Centralized configuration για όλες τις photo UI dimensions.
 * Εξαλείφει τις μικτές διαστάσεις από διάφορα components.
 *
 * @location src/components/generic/config/photo-dimensions.ts
 * @uses PhotoPreviewCard, PhotosPreview, PhotoPreview, PhotoItem
 */

// ============================================================================
// CORE DIMENSIONS
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
  THUMBNAIL: 'h-16',

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

// ============================================================================
// COMBINED DIMENSION CLASSES
// ============================================================================

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

// ============================================================================
// LAYOUT CONFIGURATIONS
// ============================================================================

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

  /** Individual photos: 6 photos (3x2 grid) */
  INDIVIDUAL_GRID: {
    container: 'grid grid-cols-3 gap-8 p-6',
    item: PHOTO_SIZES.STANDARD_PREVIEW,
    itemWrapper: `${PHOTO_HEIGHTS.STANDARD} ${PHOTO_WIDTHS.FULL}`
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

// ============================================================================
// ICON & ELEMENT SIZES
// ============================================================================

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

// ============================================================================
// RESPONSIVE BREAKPOINTS
// ============================================================================

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

// ============================================================================
// USAGE CONTEXT MAPPING
// ============================================================================

/**
 * Context-specific dimension mapping για easy selection
 */
export const PHOTO_CONTEXTS = {
  /** Contact form photo previews */
  CONTACT_FORM: PHOTO_SIZES.STANDARD_PREVIEW,

  /** Modal photo previews */
  MODAL_PREVIEW: PHOTO_SIZES.STANDARD_PREVIEW,

  /** List item thumbnails */
  LIST_ITEM: PHOTO_SIZES.THUMBNAIL,

  /** Upload drag zones */
  UPLOAD_ZONE: PHOTO_SIZES.COMPACT_PREVIEW,

  /** Gallery grids */
  GALLERY_GRID: PHOTO_SIZES.GRID_ITEM,

  /** Company branding */
  COMPANY_BRANDING: PHOTO_SIZES.COMPANY_LOGO,

  /** Service identification */
  SERVICE_IDENTIFICATION: PHOTO_SIZES.SERVICE_LOGO,

  /** User profiles */
  USER_PROFILE: PHOTO_SIZES.AVATAR
} as const;

// ============================================================================
// VALIDATION & HELPERS
// ============================================================================

/**
 * Get dimensions για specific use case
 */
export function getPhotoDimensions(context: keyof typeof PHOTO_CONTEXTS): string {
  return PHOTO_CONTEXTS[context];
}

/**
 * Get layout configuration για specific layout type
 */
export function getPhotoLayout(layout: keyof typeof PHOTO_LAYOUTS) {
  return PHOTO_LAYOUTS[layout];
}

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

// ============================================================================
// PHOTO COLORS & STYLING
// ============================================================================

/**
 * Standard photo background colors για consistent UI
 */
export const PHOTO_COLORS = {
  /** Main photo container background */
  PHOTO_BACKGROUND: 'bg-red-200',

  /** Empty state background */
  EMPTY_STATE_BACKGROUND: 'bg-red-100',

  /** Muted background για placeholders */
  MUTED_BACKGROUND: 'bg-red-50',

  /** Overlay background για hover effects */
  OVERLAY_BACKGROUND: 'bg-black',

  /** Label background για photo names */
  LABEL_BACKGROUND: 'bg-black bg-opacity-60',

  /** Light background για upload zones */
  UPLOAD_BACKGROUND: 'bg-red-100',

  /** Loading overlay background */
  LOADING_OVERLAY: 'bg-red-100 bg-opacity-75',

  /** Progress bar background */
  PROGRESS_BACKGROUND: 'bg-red-200',

  /** Cancel button background */
  CANCEL_BUTTON: 'bg-red-300'
} as const;

/**
 * Photo border colors για consistent styling
 */
export const PHOTO_BORDERS = {
  /** Dashed borders για empty states */
  EMPTY_STATE: 'border-2 border-dashed border-gray-300',

  /** Hover border για empty states */
  EMPTY_HOVER: 'hover:border-gray-400',

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
 * Photo hover effects για consistent interactions
 */
export const PHOTO_HOVER_EFFECTS = {
  /** Standard shadow lift effect */
  SHADOW_LIFT: 'hover:shadow-lg transition-shadow duration-200',

  /** Subtle scale effect για images */
  SCALE_SUBTLE: 'hover:scale-105 transition-transform duration-200',

  /** Standard card hover effect */
  CARD_HOVER: 'hover:shadow-lg transition-all duration-200',

  /** Overlay fade in effect */
  OVERLAY_FADE: 'opacity-0 group-hover:opacity-100 transition-opacity duration-200',

  /** Text color change effect */
  TEXT_PRIMARY: 'group-hover:text-primary transition-colors duration-200',

  /** Border color change effect */
  BORDER_PRIMARY: 'hover:border-primary transition-colors duration-200',

  /** Color transition effect για buttons */
  COLOR_TRANSITION: 'transition-colors',

  /** Transform transition για image scaling */
  TRANSFORM_TRANSITION: 'transition-transform duration-200',

  /** Remove button hover effect */
  REMOVE_BUTTON: 'hover:bg-red-200 transition-colors',

  /** Cancel button hover effect */
  CANCEL_BUTTON: 'hover:bg-gray-400 transition-colors',

  /** All transitions για upload zones */
  ALL_TRANSITION: 'transition-all duration-300'
} as const;

/**
 * Combined photo styling classes για common use cases
 */
export const PHOTO_STYLES = {
  /** Standard photo container με hover effects */
  PHOTO_CONTAINER: `${PHOTO_COLORS.PHOTO_BACKGROUND} rounded overflow-hidden shadow-sm cursor-pointer ${PHOTO_HOVER_EFFECTS.CARD_HOVER}`,

  /** Photo image με subtle scale effect */
  PHOTO_IMAGE: `w-full h-full object-cover ${PHOTO_HOVER_EFFECTS.SCALE_SUBTLE}`,

  /** Empty state styling με consistent hover */
  EMPTY_STATE: `${PHOTO_COLORS.EMPTY_STATE_BACKGROUND} ${PHOTO_BORDERS.EMPTY_STATE} rounded-lg flex items-center justify-center text-center cursor-pointer transition-colors ${PHOTO_BORDERS.EMPTY_HOVER}`,

  /** Placeholder styling */
  PLACEHOLDER: `${PHOTO_COLORS.MUTED_BACKGROUND} rounded-lg flex items-center justify-center`,

  /** Overlay styling για hover effects */
  HOVER_OVERLAY: `absolute inset-0 ${PHOTO_COLORS.OVERLAY_BACKGROUND} bg-opacity-0 group-hover:bg-opacity-40 transition-all rounded-lg flex items-center justify-center`,

  /** Overlay content με fade effect */
  OVERLAY_CONTENT: `${PHOTO_HOVER_EFFECTS.OVERLAY_FADE} flex gap-2`,

  /** Label styling */
  PHOTO_LABEL: `absolute bottom-2 left-2 ${PHOTO_COLORS.LABEL_BACKGROUND} ${PHOTO_TEXT_COLORS.OVERLAY} text-xs px-2 py-1 rounded`,

  /** Thumbnail styling */
  THUMBNAIL: `${PHOTO_COLORS.PHOTO_BACKGROUND} rounded-lg overflow-hidden shadow-sm relative`,

  /** Icon με hover effect */
  ICON_HOVER: `${PHOTO_TEXT_COLORS.FOREGROUND_MUTED} ${PHOTO_HOVER_EFFECTS.TEXT_PRIMARY}`
} as const;

// ============================================================================
// COLOR HELPERS
// ============================================================================

/**
 * Get color scheme για specific photo context
 */
export function getPhotoColorScheme(context: 'container' | 'empty' | 'placeholder' | 'overlay' | 'label' | 'thumbnail') {
  switch (context) {
    case 'container':
      return PHOTO_STYLES.PHOTO_CONTAINER;
    case 'empty':
      return PHOTO_STYLES.EMPTY_STATE;
    case 'placeholder':
      return PHOTO_STYLES.PLACEHOLDER;
    case 'overlay':
      return PHOTO_STYLES.HOVER_OVERLAY;
    case 'label':
      return PHOTO_STYLES.PHOTO_LABEL;
    case 'thumbnail':
      return PHOTO_STYLES.THUMBNAIL;
    default:
      return PHOTO_STYLES.PHOTO_CONTAINER;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  heights: PHOTO_HEIGHTS,
  widths: PHOTO_WIDTHS,
  sizes: PHOTO_SIZES,
  layouts: PHOTO_LAYOUTS,
  icons: PHOTO_ICON_SIZES,
  buttons: PHOTO_BUTTON_SIZES,
  responsive: PHOTO_RESPONSIVE,
  contexts: PHOTO_CONTEXTS,
  colors: PHOTO_COLORS,
  borders: PHOTO_BORDERS,
  textColors: PHOTO_TEXT_COLORS,
  hoverEffects: PHOTO_HOVER_EFFECTS,
  styles: PHOTO_STYLES,
  getDimensions: getPhotoDimensions,
  getLayout: getPhotoLayout,
  getColorScheme: getPhotoColorScheme,
  buildResponsive: buildResponsivePhotoClass
};
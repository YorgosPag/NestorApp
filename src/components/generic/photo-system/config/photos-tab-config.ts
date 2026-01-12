// ============================================================================
// PHOTOS TAB CONFIG - ENTERPRISE ENTITY CONFIGURATIONS
// ============================================================================
//
// ADR-018: Upload Systems Centralization
// Centralized configurations for all PhotosTab implementations
//
// Enterprise Standards:
// - Single source of truth for entity-specific settings
// - Type-safe configuration objects
// - No hardcoded values in components
// - Easy to extend for new entity types
//
// ============================================================================

import type {
  PhotosTabConfig,
  PhotosTabEntityType,
  PhotoCategory,
  PhotoGridCols,
  PhotoWithMetadata,
} from './photos-tab-types';

// =============================================================================
// SHARED CONSTANTS
// =============================================================================

/**
 * Default file size limits (in bytes)
 */
export const PHOTO_SIZE_LIMITS = {
  /** Standard photo upload (10MB) */
  STANDARD: 10 * 1024 * 1024,
  /** Large photos for buildings/projects (15MB) */
  LARGE: 15 * 1024 * 1024,
  /** Contact photos (5MB) */
  CONTACT: 5 * 1024 * 1024,
  /** Logos (2MB) */
  LOGO: 2 * 1024 * 1024,
} as const;

/**
 * Default max photo counts
 */
export const PHOTO_MAX_COUNTS = {
  /** Standard entity */
  STANDARD: 20,
  /** Buildings/Projects (more photos needed) */
  EXTENDED: 30,
  /** Contacts (limited slots) */
  CONTACT: 6,
  /** Storages */
  STORAGE: 20,
} as const;

/**
 * Default grid columns
 */
export const DEFAULT_GRID_COLS: PhotoGridCols = {
  mobile: 2,
  tablet: 3,
  desktop: 4,
};

/**
 * Accepted image types
 */
export const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

// =============================================================================
// STORAGE PHOTO CATEGORIES
// =============================================================================

/**
 * Photo categories for Storage entity
 */
export const STORAGE_PHOTO_CATEGORIES: PhotoCategory[] = [
  {
    id: 'all',
    label: 'Όλες',
    icon: 'Image',
    colorClass: 'text-blue-600',
    filter: () => true,
  },
  {
    id: 'exterior',
    label: 'Εξωτερικές',
    icon: 'Home',
    colorClass: 'text-green-600',
    filter: (photo) =>
      photo.name.includes('Εξωτερική') ||
      photo.name.includes('Πόρτα') ||
      (photo as PhotoWithMetadata).category === 'exterior',
  },
  {
    id: 'interior',
    label: 'Εσωτερικές',
    icon: 'LayoutDashboard',
    colorClass: 'text-purple-600',
    filter: (photo) =>
      photo.name.includes('Εσωτερικός') ||
      photo.name.includes('Χρήση') ||
      (photo as PhotoWithMetadata).category === 'interior',
  },
  {
    id: 'maintenance',
    label: 'Συντήρηση',
    icon: 'Wrench',
    colorClass: 'text-orange-600',
    filter: (photo) =>
      photo.name.includes('Συντήρηση') ||
      photo.name.includes('Φόρτωσης') ||
      (photo as PhotoWithMetadata).category === 'maintenance',
  },
];

/**
 * Photo categories for Building entity
 */
export const BUILDING_PHOTO_CATEGORIES: PhotoCategory[] = [
  {
    id: 'all',
    label: 'Όλες',
    icon: 'Image',
    colorClass: 'text-blue-600',
    filter: () => true,
  },
  {
    id: 'facade',
    label: 'Πρόσοψη',
    icon: 'Building2',
    colorClass: 'text-indigo-600',
    filter: (photo) =>
      photo.name.includes('Πρόσοψη') ||
      photo.name.includes('Facade') ||
      (photo as PhotoWithMetadata).category === 'facade',
  },
  {
    id: 'common',
    label: 'Κοινόχρηστα',
    icon: 'Users',
    colorClass: 'text-teal-600',
    filter: (photo) =>
      photo.name.includes('Κοινόχρηστ') ||
      photo.name.includes('Είσοδος') ||
      (photo as PhotoWithMetadata).category === 'common',
  },
  {
    id: 'amenities',
    label: 'Παροχές',
    icon: 'Sparkles',
    colorClass: 'text-amber-600',
    filter: (photo) =>
      photo.name.includes('Παροχ') ||
      photo.name.includes('Ανέσ') ||
      (photo as PhotoWithMetadata).category === 'amenities',
  },
];

// =============================================================================
// ENTITY CONFIGURATIONS
// =============================================================================

/**
 * Default configurations per entity type
 *
 * Each entity type has specific settings for:
 * - Display (title, icon)
 * - Limits (max photos, file size)
 * - Features (stats, categories)
 * - Storage (folder, purpose)
 */
export const PHOTOS_TAB_CONFIGS: Record<PhotosTabEntityType, PhotosTabConfig> = {
  // ---------------------------------------------------------------------------
  // PROJECT
  // ---------------------------------------------------------------------------
  project: {
    entityType: 'project',
    title: 'Φωτογραφίες Έργου',
    titleIcon: 'Briefcase',
    maxPhotos: PHOTO_MAX_COUNTS.STANDARD,
    maxFileSize: PHOTO_SIZE_LIMITS.STANDARD,
    showStats: false,
    showCategories: false,
    categories: undefined,
    uploadPurpose: 'photo',
    storageFolder: 'projects',
    gridCols: DEFAULT_GRID_COLS,
    showEntityInfo: false,
    acceptedTypes: ACCEPTED_IMAGE_TYPES,
  },

  // ---------------------------------------------------------------------------
  // BUILDING
  // ---------------------------------------------------------------------------
  building: {
    entityType: 'building',
    title: 'Φωτογραφίες Κτιρίου',
    titleIcon: 'Building2',
    maxPhotos: PHOTO_MAX_COUNTS.EXTENDED,
    maxFileSize: PHOTO_SIZE_LIMITS.LARGE,
    showStats: false,
    showCategories: false,
    categories: BUILDING_PHOTO_CATEGORIES,
    uploadPurpose: 'photo',
    storageFolder: 'buildings',
    gridCols: DEFAULT_GRID_COLS,
    showEntityInfo: false,
    acceptedTypes: ACCEPTED_IMAGE_TYPES,
  },

  // ---------------------------------------------------------------------------
  // CONTACT
  // ---------------------------------------------------------------------------
  contact: {
    entityType: 'contact',
    title: 'Φωτογραφίες',
    titleIcon: 'User',
    maxPhotos: PHOTO_MAX_COUNTS.CONTACT,
    maxFileSize: PHOTO_SIZE_LIMITS.CONTACT,
    showStats: false,
    showCategories: false,
    categories: undefined,
    uploadPurpose: 'photo',
    storageFolder: 'contacts',
    gridCols: {
      mobile: 2,
      tablet: 3,
      desktop: 3,
    },
    showEntityInfo: false,
    acceptedTypes: ACCEPTED_IMAGE_TYPES,
  },

  // ---------------------------------------------------------------------------
  // STORAGE
  // ---------------------------------------------------------------------------
  storage: {
    entityType: 'storage',
    title: 'Φωτογραφίες Αποθήκης',
    titleIcon: 'Warehouse',
    maxPhotos: PHOTO_MAX_COUNTS.STORAGE,
    maxFileSize: PHOTO_SIZE_LIMITS.STANDARD,
    showStats: true,
    showCategories: true,
    categories: STORAGE_PHOTO_CATEGORIES,
    uploadPurpose: 'photo',
    storageFolder: 'storages',
    gridCols: DEFAULT_GRID_COLS,
    showEntityInfo: true,
    acceptedTypes: ACCEPTED_IMAGE_TYPES,
  },

  // ---------------------------------------------------------------------------
  // UNIT
  // ---------------------------------------------------------------------------
  unit: {
    entityType: 'unit',
    title: 'Φωτογραφίες Μονάδας',
    titleIcon: 'Home',
    maxPhotos: PHOTO_MAX_COUNTS.STANDARD,
    maxFileSize: PHOTO_SIZE_LIMITS.STANDARD,
    showStats: false,
    showCategories: false,
    categories: undefined,
    uploadPurpose: 'photo',
    storageFolder: 'units',
    gridCols: DEFAULT_GRID_COLS,
    showEntityInfo: true,
    acceptedTypes: ACCEPTED_IMAGE_TYPES,
  },

  // ---------------------------------------------------------------------------
  // PARKING
  // ---------------------------------------------------------------------------
  parking: {
    entityType: 'parking',
    title: 'Φωτογραφίες Θέσης Στάθμευσης',
    titleIcon: 'Car',
    maxPhotos: 10,
    maxFileSize: PHOTO_SIZE_LIMITS.STANDARD,
    showStats: false,
    showCategories: false,
    categories: undefined,
    uploadPurpose: 'photo',
    storageFolder: 'parkings',
    gridCols: {
      mobile: 2,
      tablet: 2,
      desktop: 3,
    },
    showEntityInfo: true,
    acceptedTypes: ACCEPTED_IMAGE_TYPES,
  },

  // ---------------------------------------------------------------------------
  // FLOOR
  // ---------------------------------------------------------------------------
  floor: {
    entityType: 'floor',
    title: 'Φωτογραφίες Ορόφου',
    titleIcon: 'Layers',
    maxPhotos: PHOTO_MAX_COUNTS.STANDARD,
    maxFileSize: PHOTO_SIZE_LIMITS.STANDARD,
    showStats: false,
    showCategories: false,
    categories: undefined,
    uploadPurpose: 'photo',
    storageFolder: 'floors',
    gridCols: DEFAULT_GRID_COLS,
    showEntityInfo: true,
    acceptedTypes: ACCEPTED_IMAGE_TYPES,
  },
};

// =============================================================================
// CONFIGURATION HELPERS
// =============================================================================

/**
 * Get configuration for a specific entity type
 *
 * @param entityType - The entity type
 * @param overrides - Optional configuration overrides
 * @returns Merged configuration
 */
export function getPhotosTabConfig(
  entityType: PhotosTabEntityType,
  overrides?: Partial<PhotosTabConfig>
): PhotosTabConfig {
  const baseConfig = PHOTOS_TAB_CONFIGS[entityType];

  if (!overrides) {
    return baseConfig;
  }

  return {
    ...baseConfig,
    ...overrides,
    // Deep merge gridCols if provided
    gridCols: overrides.gridCols
      ? { ...baseConfig.gridCols, ...overrides.gridCols }
      : baseConfig.gridCols,
    // Deep merge categories if provided (append, don't replace)
    categories: overrides.categories
      ? [...(baseConfig.categories || []), ...overrides.categories]
      : baseConfig.categories,
  };
}

/**
 * Get grid classes for Tailwind CSS
 *
 * @param gridCols - Grid columns configuration
 * @returns Tailwind grid classes
 */
export function getGridClasses(gridCols: PhotoGridCols): string {
  return `grid grid-cols-${gridCols.mobile} md:grid-cols-${gridCols.tablet} lg:grid-cols-${gridCols.desktop} gap-4`;
}

/**
 * Format file size for display
 *
 * @param bytes - File size in bytes
 * @returns Formatted string (e.g., "10 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Validate file against configuration
 *
 * @param file - File to validate
 * @param config - Configuration to validate against
 * @returns Validation result
 */
export function validatePhotoFile(
  file: File,
  config: PhotosTabConfig
): { valid: boolean; error?: string } {
  // Check file type
  if (!config.acceptedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Μη αποδεκτός τύπος αρχείου. Επιτρέπονται: ${config.acceptedTypes
        .map((t) => t.replace('image/', ''))
        .join(', ')}`,
    };
  }

  // Check file size
  if (file.size > config.maxFileSize) {
    return {
      valid: false,
      error: `Το αρχείο υπερβαίνει το μέγιστο μέγεθος (${formatFileSize(config.maxFileSize)})`,
    };
  }

  return { valid: true };
}

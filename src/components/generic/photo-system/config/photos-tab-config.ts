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
import { getStatusColor } from '@/lib/design-system';
import { ENTITY_TYPES, FILE_DOMAINS, FILE_CATEGORIES } from '@/config/domain-constants';

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
 * 🏢 ENTERPRISE: Labels are i18n keys - translated in PhotosTabBase component
 */
export const STORAGE_PHOTO_CATEGORIES: PhotoCategory[] = [
  {
    id: 'all',
    label: 'photos.categories.all',
    icon: 'Image',
    colorClass: getStatusColor('info', 'text'),
    filter: () => true,
  },
  {
    id: 'exterior',
    label: 'photos.categories.exterior',
    icon: 'Home',
    colorClass: getStatusColor('success', 'text'),
    filter: (photo) =>
      photo.name.includes('Εξωτερική') ||
      photo.name.includes('Πόρτα') ||
      (photo as PhotoWithMetadata).category === 'exterior',
  },
  {
    id: 'interior',
    label: 'photos.categories.interior',
    icon: 'LayoutDashboard',
    colorClass: 'text-purple-600',
    filter: (photo) =>
      photo.name.includes('Εσωτερικός') ||
      photo.name.includes('Χρήση') ||
      (photo as PhotoWithMetadata).category === 'interior',
  },
  {
    id: 'maintenance',
    label: 'photos.categories.maintenance',
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
 * 🏢 ENTERPRISE: Labels are i18n keys - translated in PhotosTabBase component
 */
export const BUILDING_PHOTO_CATEGORIES: PhotoCategory[] = [
  {
    id: 'all',
    label: 'photos.categories.all',
    icon: 'Image',
    colorClass: getStatusColor('info', 'text'),
    filter: () => true,
  },
  {
    id: 'facade',
    label: 'photos.categories.facade',
    icon: 'Building2',
    colorClass: 'text-indigo-600',
    filter: (photo) =>
      photo.name.includes('Πρόσοψη') ||
      photo.name.includes('Facade') ||
      (photo as PhotoWithMetadata).category === 'facade',
  },
  {
    id: 'common',
    label: 'photos.categories.common',
    icon: 'Users',
    colorClass: 'text-teal-600',
    filter: (photo) =>
      photo.name.includes('Κοινόχρηστ') ||
      photo.name.includes('Είσοδος') ||
      (photo as PhotoWithMetadata).category === 'common',
  },
  {
    id: 'amenities',
    label: 'photos.categories.amenities',
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
// 🌐 i18n: All titles converted to i18n keys - 2026-01-18
export const PHOTOS_TAB_CONFIGS: Record<PhotosTabEntityType, PhotosTabConfig> = {
  // ---------------------------------------------------------------------------
  // PROJECT
  // ---------------------------------------------------------------------------
  project: {
    entityType: ENTITY_TYPES.PROJECT,
    canonicalEntityType: ENTITY_TYPES.PROJECT,
    title: 'photos.tabs.project',
    titleIcon: 'Briefcase',
    maxPhotos: PHOTO_MAX_COUNTS.STANDARD,
    maxFileSize: PHOTO_SIZE_LIMITS.STANDARD,
    showStats: false,
    showCategories: false,
    categories: undefined,
    uploadPurpose: 'photo',
    domain: FILE_DOMAINS.SALES,
    category: FILE_CATEGORIES.PHOTOS,
    storageFolder: 'projects',
    gridCols: DEFAULT_GRID_COLS,
    showEntityInfo: false,
    acceptedTypes: ACCEPTED_IMAGE_TYPES,
  },

  // ---------------------------------------------------------------------------
  // BUILDING
  // ---------------------------------------------------------------------------
  building: {
    entityType: ENTITY_TYPES.BUILDING,
    canonicalEntityType: ENTITY_TYPES.BUILDING,
    title: 'photos.tabs.building',
    titleIcon: 'Building2',
    maxPhotos: PHOTO_MAX_COUNTS.EXTENDED,
    maxFileSize: PHOTO_SIZE_LIMITS.LARGE,
    showStats: false,
    showCategories: false,
    categories: BUILDING_PHOTO_CATEGORIES,
    uploadPurpose: 'photo',
    domain: FILE_DOMAINS.SALES,
    category: FILE_CATEGORIES.PHOTOS,
    storageFolder: 'buildings',
    gridCols: DEFAULT_GRID_COLS,
    showEntityInfo: false,
    acceptedTypes: ACCEPTED_IMAGE_TYPES,
  },

  // ---------------------------------------------------------------------------
  // CONTACT
  // ---------------------------------------------------------------------------
  contact: {
    entityType: ENTITY_TYPES.CONTACT,
    canonicalEntityType: ENTITY_TYPES.CONTACT,
    title: 'photos.tabs.contact',
    titleIcon: 'User',
    maxPhotos: PHOTO_MAX_COUNTS.CONTACT,
    maxFileSize: PHOTO_SIZE_LIMITS.CONTACT,
    showStats: false,
    showCategories: false,
    categories: undefined,
    uploadPurpose: 'photo',
    domain: FILE_DOMAINS.ADMIN,
    category: FILE_CATEGORIES.PHOTOS,
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
    canonicalEntityType: ENTITY_TYPES.STORAGE,
    title: 'photos.tabs.storage',
    titleIcon: 'Warehouse',
    maxPhotos: PHOTO_MAX_COUNTS.STORAGE,
    maxFileSize: PHOTO_SIZE_LIMITS.STANDARD,
    showStats: true,
    showCategories: true,
    categories: STORAGE_PHOTO_CATEGORIES,
    uploadPurpose: 'photo',
    domain: FILE_DOMAINS.SALES,
    category: FILE_CATEGORIES.PHOTOS,
    storageFolder: 'storages',
    gridCols: DEFAULT_GRID_COLS,
    showEntityInfo: true,
    acceptedTypes: ACCEPTED_IMAGE_TYPES,
  },

  // ---------------------------------------------------------------------------
  // PROPERTY
  // ---------------------------------------------------------------------------
  property: {
    entityType: ENTITY_TYPES.PROPERTY,
    canonicalEntityType: ENTITY_TYPES.PROPERTY,
    title: 'photos.tabs.unit',
    titleIcon: 'Home',
    maxPhotos: PHOTO_MAX_COUNTS.STANDARD,
    maxFileSize: PHOTO_SIZE_LIMITS.STANDARD,
    showStats: false,
    showCategories: false,
    categories: undefined,
    uploadPurpose: 'photo',
    domain: FILE_DOMAINS.SALES,
    category: FILE_CATEGORIES.PHOTOS,
    storageFolder: 'properties',
    gridCols: DEFAULT_GRID_COLS,
    showEntityInfo: true,
    acceptedTypes: ACCEPTED_IMAGE_TYPES,
  },

  // ---------------------------------------------------------------------------
  // PARKING
  // ---------------------------------------------------------------------------
  parking: {
    entityType: 'parking',
    canonicalEntityType: ENTITY_TYPES.PARKING_SPOT,
    title: 'photos.tabs.parking',
    titleIcon: 'Car',
    maxPhotos: 10,
    maxFileSize: PHOTO_SIZE_LIMITS.STANDARD,
    showStats: false,
    showCategories: false,
    categories: undefined,
    uploadPurpose: 'photo',
    domain: FILE_DOMAINS.SALES,
    category: FILE_CATEGORIES.PHOTOS,
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
    canonicalEntityType: ENTITY_TYPES.FLOOR,
    title: 'photos.tabs.floor',
    titleIcon: 'Layers',
    maxPhotos: PHOTO_MAX_COUNTS.STANDARD,
    maxFileSize: PHOTO_SIZE_LIMITS.STANDARD,
    showStats: false,
    showCategories: false,
    categories: undefined,
    uploadPurpose: 'photo',
    domain: FILE_DOMAINS.CONSTRUCTION,
    category: FILE_CATEGORIES.PHOTOS,
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
 * Re-export canonical formatFileSize from file-validation for backward compatibility
 */
export { formatFileSize } from '@/utils/file-validation';

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
  // 🌐 i18n: Validation errors converted to i18n keys - 2026-01-18
  if (!config.acceptedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'photos.validation.invalidFileType',
    };
  }

  // Check file size
  if (file.size > config.maxFileSize) {
    return {
      valid: false,
      error: 'photos.validation.fileTooLarge',
    };
  }

  return { valid: true };
}

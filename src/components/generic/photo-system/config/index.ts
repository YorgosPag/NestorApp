// ============================================================================
// PHOTO SYSTEM CONFIG - PUBLIC EXPORTS
// ============================================================================
//
// ADR-018: Upload Systems Centralization
// Centralized exports for PhotosTab configuration
//
// ============================================================================

// Type definitions
export type {
  Photo,
  PhotoWithMetadata,
  PhotosTabEntityType,
  PhotoUploadPurpose,
  PhotoCategory,
  CategoryStats,
  PhotoGridCols,
  PhotosTabConfig,
  BaseEntity,
  PhotosTabBaseProps,
  PhotosTabHeaderProps,
  PhotosTabStatsProps,
  PhotosTabCategoriesProps,
  PhotosTabUploaderProps,
  PhotosTabGridProps,
  PhotosTabEntityInfoProps,
  EntityInfoField,
  FileUploadResult,
  PhotoUploadProgress,
  UsePhotosTabStateReturn,
  UsePhotosTabUploadReturn,
  UsePhotosCategoriesReturn,
  EntityTypeMap,
  GetEntityType,
} from './photos-tab-types';

// Configuration
export {
  PHOTOS_TAB_CONFIGS,
  PHOTO_SIZE_LIMITS,
  PHOTO_MAX_COUNTS,
  DEFAULT_GRID_COLS,
  ACCEPTED_IMAGE_TYPES,
  STORAGE_PHOTO_CATEGORIES,
  BUILDING_PHOTO_CATEGORIES,
  getPhotosTabConfig,
  getGridClasses,
  formatFileSize,
  validatePhotoFile,
} from './photos-tab-config';

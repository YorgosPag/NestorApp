// ============================================================================
// PHOTO SYSTEM - MAIN PUBLIC EXPORTS
// ============================================================================
//
// ADR-018: Upload Systems Centralization
// Enterprise template system for PhotosTab implementations
//
// Usage:
// import { PhotosTabBase, usePhotosTabState } from '@/components/generic/photo-system';
//
// ============================================================================

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export { PhotosTabBase } from './components/PhotosTabBase';

// =============================================================================
// HOOKS
// =============================================================================

export {
  usePhotosTabState,
  usePhotosTabUpload,
  usePhotosCategories,
} from './hooks';

export type {
  UsePhotosTabStateProps,
  UsePhotosTabUploadProps,
  UsePhotosCategoriesProps,
} from './hooks';

// =============================================================================
// CONFIGURATION
// =============================================================================

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
} from './config';

// =============================================================================
// TYPES
// =============================================================================

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
} from './config';

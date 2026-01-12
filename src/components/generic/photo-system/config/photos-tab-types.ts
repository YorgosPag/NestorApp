// ============================================================================
// PHOTOS TAB TYPES - ENTERPRISE TYPE DEFINITIONS
// ============================================================================
//
// ADR-018: Upload Systems Centralization
// Single source of truth for all PhotosTab type definitions
//
// Enterprise Standards:
// - Zero `any` types
// - Full TypeScript generics
// - Discriminated unions where applicable
// - JSDoc documentation
// - Re-export existing types (no duplicates!)
//
// ============================================================================

import type { ComponentType } from 'react';

// =============================================================================
// CORE TYPES - IMPORT FROM EXISTING SOURCES
// =============================================================================

/**
 * Import Photo interface from PhotoItem (single source of truth)
 *
 * @see src/components/generic/utils/PhotoItem.tsx
 */
import type { Photo } from '../../utils/PhotoItem';

/**
 * Import FileUploadResult from useFileUploadState (single source of truth)
 *
 * @see src/hooks/useFileUploadState.ts
 */
import type { FileUploadResult } from '@/hooks/useFileUploadState';

// =============================================================================
// RE-EXPORTS - Make types available to consumers
// =============================================================================

export type { Photo, FileUploadResult };

/**
 * Extended Photo with additional metadata for PhotosTab
 *
 * Extends the base Photo interface with optional fields for
 * category filtering, upload tracking, and file metadata.
 */
export interface PhotoWithMetadata {
  /** Unique identifier (UUID or timestamp-based) */
  id: string;
  /** Image source URL */
  src: string;
  /** Alt text for accessibility */
  alt: string;
  /** Display name for the photo */
  name: string;
  /** AI hint for accessibility/SEO */
  aiHint?: string;
  /** Optional category for filtering */
  category?: string;
  /** Upload timestamp */
  uploadedAt?: Date;
  /** File size in bytes */
  fileSize?: number;
}

/**
 * Entity types supported by PhotosTabBase
 */
export type PhotosTabEntityType =
  | 'project'
  | 'building'
  | 'contact'
  | 'storage'
  | 'unit'
  | 'parking'
  | 'floor';

/**
 * Upload purpose for file naming and storage path
 */
export type PhotoUploadPurpose =
  | 'photo'
  | 'logo'
  | 'representative'
  | 'avatar'
  | 'document'
  | 'floorplan';

// =============================================================================
// CATEGORY SYSTEM
// =============================================================================

/**
 * Photo category configuration for filtering
 */
export interface PhotoCategory {
  /** Unique category identifier */
  id: string;
  /** Display label (Greek) */
  label: string;
  /** Lucide icon name */
  icon?: string;
  /** Tailwind color class for icon */
  colorClass?: string;
  /** Filter function to match photos */
  filter: (photo: Photo) => boolean;
}

/**
 * Category statistics for display
 */
export interface CategoryStats {
  /** Category ID */
  categoryId: string;
  /** Number of photos in category */
  count: number;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Grid columns configuration per breakpoint
 */
export interface PhotoGridCols {
  /** Mobile (< 768px) */
  mobile: number;
  /** Tablet (768px - 1024px) */
  tablet: number;
  /** Desktop (> 1024px) */
  desktop: number;
}

/**
 * PhotosTabBase configuration per entity type
 */
export interface PhotosTabConfig {
  /** Entity type identifier */
  entityType: PhotosTabEntityType;
  /** Tab title (Greek) */
  title: string;
  /** Lucide icon name for title */
  titleIcon?: string;
  /** Maximum number of photos allowed */
  maxPhotos: number;
  /** Maximum file size in bytes */
  maxFileSize: number;
  /** Show statistics section */
  showStats: boolean;
  /** Show category filtering */
  showCategories: boolean;
  /** Category definitions (if showCategories is true) */
  categories?: PhotoCategory[];
  /** Upload purpose for file naming */
  uploadPurpose: PhotoUploadPurpose;
  /** Firebase storage folder name */
  storageFolder: string;
  /** Grid columns per breakpoint */
  gridCols: PhotoGridCols;
  /** Show entity info section above upload */
  showEntityInfo: boolean;
  /** Accepted file types */
  acceptedTypes: string[];
}

// =============================================================================
// COMPONENT PROPS
// =============================================================================

/**
 * Base entity constraint - all entities must have id and name
 */
export interface BaseEntity {
  id: string;
  name?: string;
}

/**
 * Main props interface for PhotosTabBase
 *
 * @template TEntity - The entity type (Project, Building, Storage, etc.)
 */
export interface PhotosTabBaseProps<TEntity extends BaseEntity> {
  /** The entity data */
  entity: TEntity;

  /** Entity type for configuration lookup */
  entityType: PhotosTabEntityType;

  /** Entity display name (overrides entity.name) */
  entityName?: string;

  /** Custom configuration overrides */
  configOverrides?: Partial<PhotosTabConfig>;

  /** External photos state (for form-controlled mode) */
  photos?: Photo[];

  /** External photos setter (for form-controlled mode) */
  onPhotosChange?: (photos: Photo[]) => void;

  /** Disabled state (view-only mode) */
  disabled?: boolean;

  /** Loading state */
  isLoading?: boolean;

  /** Custom header component */
  customHeader?: ComponentType<PhotosTabHeaderProps>;

  /** Custom grid component */
  customGrid?: ComponentType<PhotosTabGridProps>;

  /** Additional CSS classes */
  className?: string;

  /** Photo click handler (for gallery modal) */
  onPhotoClick?: (photo: Photo, index: number) => void;

  /** Photo delete handler */
  onPhotoDelete?: (photo: Photo) => void;
}

// =============================================================================
// SUB-COMPONENT PROPS
// =============================================================================

/**
 * Props for PhotosTabHeader component
 */
export interface PhotosTabHeaderProps {
  /** Config for styling and labels */
  config: PhotosTabConfig;
  /** Entity name for display */
  entityName?: string;
  /** Total photo count */
  photoCount: number;
}

/**
 * Props for PhotosTabStats component
 */
export interface PhotosTabStatsProps {
  /** Total photo count */
  totalCount: number;
  /** Stats per category */
  categoryStats: CategoryStats[];
  /** Category definitions */
  categories?: PhotoCategory[];
}

/**
 * Props for PhotosTabCategories component
 */
export interface PhotosTabCategoriesProps {
  /** Category definitions */
  categories: PhotoCategory[];
  /** Currently active category ID */
  activeCategory: string;
  /** Category change handler */
  onCategoryChange: (categoryId: string) => void;
  /** Stats per category */
  categoryStats: CategoryStats[];
}

/**
 * Props for PhotosTabUploader component
 */
export interface PhotosTabUploaderProps {
  /** Config for limits and labels */
  config: PhotosTabConfig;
  /** Current file being uploaded */
  currentFile: File | null;
  /** File change handler */
  onFileChange: (file: File | null) => void;
  /** Upload complete handler */
  onUploadComplete: (result: FileUploadResult) => void;
  /** Entity name for file naming */
  entityName?: string;
  /** Disabled state */
  disabled?: boolean;
}

/**
 * Props for PhotosTabGrid component
 */
export interface PhotosTabGridProps {
  /** Photos to display */
  photos: Photo[];
  /** Grid columns config */
  gridCols?: PhotoGridCols;
  /** Upload trigger handler */
  onUploadClick?: () => void;
  /** Show placeholder slots */
  showPlaceholders?: boolean;
  /** Max placeholder count */
  maxPlaceholders?: number;
  /** Photo click handler */
  onPhotoClick?: (photo: Photo, index: number) => void;
  /** Photo delete handler */
  onPhotoDelete?: (photo: Photo) => void;
}

/**
 * Props for PhotosTabEntityInfo component
 */
export interface PhotosTabEntityInfoProps<TEntity extends BaseEntity> {
  /** Entity data */
  entity: TEntity;
  /** Entity type */
  entityType: PhotosTabEntityType;
  /** Fields to display */
  fields?: EntityInfoField<TEntity>[];
}

/**
 * Entity info field configuration
 */
export interface EntityInfoField<TEntity> {
  /** Field key in entity */
  key: keyof TEntity;
  /** Display label */
  label: string;
  /** Value formatter */
  format?: (value: TEntity[keyof TEntity]) => string;
}

// =============================================================================
// UPLOAD TYPES
// =============================================================================

// NOTE: FileUploadResult removed - use FileUploadResult from useFileUploadState
// FileUploadResult is re-exported at the top of this file

/**
 * Upload progress information for photo tab display
 */
export interface PhotoUploadProgress {
  /** Upload phase */
  phase: 'validating' | 'compressing' | 'uploading' | 'processing' | 'complete' | 'error';
  /** Progress percentage (0-100) */
  progress: number;
  /** Current file being uploaded */
  fileName?: string;
  /** Error message if phase is 'error' */
  error?: string;
}

// =============================================================================
// HOOK RETURN TYPES
// =============================================================================

/**
 * Return type for usePhotosTabState hook
 */
export interface UsePhotosTabStateReturn {
  /** Current photos array */
  photos: Photo[];
  /** Set photos */
  setPhotos: (photos: Photo[] | ((prev: Photo[]) => Photo[])) => void;
  /** Add a photo */
  addPhoto: (photo: Photo) => void;
  /** Remove a photo by ID */
  removePhoto: (photoId: string) => void;
  /** Current file being uploaded */
  currentFile: File | null;
  /** Set current file */
  setCurrentFile: (file: File | null) => void;
  /** Whether using external state (form-controlled) */
  isControlled: boolean;
}

/**
 * Return type for usePhotosTabUpload hook
 */
export interface UsePhotosTabUploadReturn {
  /** Handle file selection */
  handleFileChange: (file: File | null) => void;
  /** Handle upload completion */
  handleUploadComplete: (result: FileUploadResult) => void;
  /** Trigger file picker */
  triggerUpload: () => void;
  /** Upload in progress */
  isUploading: boolean;
  /** Upload progress */
  progress: PhotoUploadProgress | null;
  /** Upload error */
  error: string | null;
  /** Clear error */
  clearError: () => void;
}

/**
 * Return type for usePhotosCategories hook
 */
export interface UsePhotosCategoriesReturn {
  /** Active category ID */
  activeCategory: string;
  /** Set active category */
  setActiveCategory: (categoryId: string) => void;
  /** Filtered photos based on active category */
  filteredPhotos: Photo[];
  /** Stats per category */
  categoryStats: CategoryStats[];
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Extract entity type from PhotosTabEntityType
 */
export type EntityTypeMap = {
  project: { id: string; name: string; status?: string };
  building: { id: string; name: string; address?: string };
  contact: { id: string; name?: string; firstName?: string; lastName?: string };
  storage: { id: string; name: string; area?: number; status?: string; type?: string };
  unit: { id: string; name: string; floor?: number };
  parking: { id: string; name: string; spotNumber?: string };
  floor: { id: string; name: string; level?: number };
};

/**
 * Get entity type from PhotosTabEntityType
 */
export type GetEntityType<T extends PhotosTabEntityType> = EntityTypeMap[T];

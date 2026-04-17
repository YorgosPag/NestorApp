// ============================================================================
// PHOTO SYSTEM HOOKS - PUBLIC EXPORTS
// ============================================================================
//
// ADR-018: Upload Systems Centralization
// Centralized exports for all PhotosTab hooks
//
// ============================================================================

// State management hook
export { usePhotosTabState } from './usePhotosTabState';
export type { UsePhotosTabStateProps } from './usePhotosTabState';

// Upload logic hook (thin wrapper around enterprise hooks)
export { usePhotosTabUpload } from './usePhotosTabUpload';
export type { UsePhotosTabUploadProps } from './usePhotosTabUpload';

// Live Firestore subscription for entity photos (ADR-293 Phase 5 Batch 29)
export { usePhotosTabFetch } from './usePhotosTabFetch';
export type { UsePhotosTabFetchParams, UsePhotosTabFetchReturn } from './usePhotosTabFetch';

// Category filtering hook
export { usePhotosCategories } from './usePhotosCategories';
export type { UsePhotosCategoriesProps } from './usePhotosCategories';

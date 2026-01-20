// ============================================================================
// MODULAR CONTACT FORM HOOKS - MAIN INDEX
// ============================================================================
//
// 🏢 Enterprise Modular Contact Form Hooks System - Main Entry Point
// Centralized access to all contact form hook functionalities
//
// 🎯 ENTERPRISE BENEFITS:
// - Tree-shaking optimization (import only what you need)
// - Clear separation of concerns (core vs files vs photos vs interactions)
// - Enhanced maintainability (focused hooks)
// - Better developer experience (organized imports)
//
// ============================================================================

// =============================================================================
// CORE MODULE - 🏗️ Basic form state and reset functionality
// =============================================================================
export * from '../core';

// =============================================================================
// FILES MODULE - 📁 File upload and management functionality
// =============================================================================
export * from '../files';

// =============================================================================
// PHOTOS MODULE - 📸 Photo selection and management functionality
// =============================================================================
export * from '../photos';

// =============================================================================
// INTERACTIONS MODULE - 🎭 User interaction functionality
// =============================================================================
export * from '../interactions';

// =============================================================================
// CONVENIENCE RE-EXPORTS - Most commonly used hooks
// =============================================================================

// Primary core hooks
export {
  useFormState,
  useFormReset
} from '../core';

// Primary file hooks
export {
  useFileUploads,
  useUploadCompletion,
  useMemoryCleanup
} from '../files';

// Primary photo hooks
export {
  usePhotoSelection
} from '../photos';

// Primary interaction hooks
export {
  useDragAndDrop
} from '../interactions';

// Key types - from their respective modules
export type { UseFormStateReturn, UseFormResetReturn } from '../core';
export type { UseFileUploadsReturn, UseUploadCompletionReturn, UseMemoryCleanupReturn } from '../files';
export type { UsePhotoSelectionReturn } from '../photos';
export type { UseDragAndDropReturn } from '../interactions';
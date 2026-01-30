/**
 * 🏢 ENTERPRISE: Centralized Upload Hooks (ADR-054)
 *
 * This module provides reusable hooks for file upload functionality.
 * Extracted from usePhotoUploadLogic for better code reuse.
 *
 * @example
 * ```typescript
 * import {
 *   useAutoUploadEffect,
 *   useFileSelectionHandlers,
 * } from '@/hooks/upload';
 *
 * // Auto-upload when file changes
 * useAutoUploadEffect({
 *   file: selectedFile,
 *   upload: enterpriseUpload,
 *   uploadHandler: createCanonicalUploadHandler({ ... }),
 *   onUploadComplete: handleComplete,
 * });
 *
 * // File selection handlers for drag/drop/click
 * const handlers = useFileSelectionHandlers({
 *   onFileSelect: setSelectedFile,
 *   accept: 'image/*',
 * });
 * ```
 */

export {
  // Auto-upload effect hook
  useAutoUploadEffect,
  type UseAutoUploadEffectConfig,
  type UploadInstance,
  type UploadHandler,
} from './useAutoUploadEffect';

export {
  // File selection handlers hook
  useFileSelectionHandlers,
  type UseFileSelectionHandlersConfig,
  type FileSelectionHandlers,
} from './useFileSelectionHandlers';

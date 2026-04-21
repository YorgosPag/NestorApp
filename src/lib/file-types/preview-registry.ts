/**
 * =============================================================================
 * 🏢 ENTERPRISE: File Preview Registry (thin adapter over classification SSoT)
 * =============================================================================
 *
 * Backwards-compatible re-exports over the unified classification registry.
 * All logic — MIME lists, extensions, preview-type resolution, category
 * resolution — lives in `src/config/file-types/classification-registry.ts`.
 *
 * Consumers (unchanged public API):
 *   - components/file-manager/FilePreviewPanel.tsx (authenticated view)
 *   - components/shared/pages/SharedFilePageContent.tsx (public share view)
 *   - components/shared/files/preview/FilePreviewRenderer.tsx (actual renderer)
 *
 * @module lib/file-types/preview-registry
 * @enterprise ADR-296 — File-Type Classification SSoT Unification
 */

export type {
  PreviewType,
  FileCategory,
} from '@/config/file-types/classification-registry';

export {
  getPreviewType,
  getFileCategory,
  getFileCategoryI18nKey,
} from '@/config/file-types/classification-registry';

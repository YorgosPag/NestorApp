/**
 * =============================================================================
 * 🏢 ENTERPRISE: File Preview Registry (SSoT)
 * =============================================================================
 *
 * Single source of truth for:
 *   - Mapping a file's contentType/extension to a preview strategy
 *   - Mapping a file to a friendly i18n label key
 *
 * Consumers:
 *   - components/file-manager/FilePreviewPanel.tsx (authenticated view)
 *   - components/shared/pages/SharedFilePageContent.tsx (public share view)
 *   - components/shared/files/preview/FilePreviewRenderer.tsx (actual renderer)
 *
 * @module lib/file-types/preview-registry
 * @enterprise ADR-191 — Enterprise Document Management System (Phase 4.3)
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Preview strategy selected by the renderer.
 *
 * - `pdf`         → PDF canvas viewer (pdfjs-dist)
 * - `image`       → Native <img> with zoom/rotate controls
 * - `video`       → Native HTML5 <video> player
 * - `audio`       → Native HTML5 <audio> player
 * - `docx`        → Client-side docx-preview rendering
 * - `unsupported` → Fallback with download prompt
 */
export type PreviewType = 'pdf' | 'image' | 'video' | 'audio' | 'docx' | 'excel' | 'xml' | 'text' | 'unsupported';

/**
 * Broad file category used for user-facing labels (i18n).
 * Kept separate from PreviewType because some categories (excel, powerpoint,
 * archive, text) share the same 'unsupported' preview strategy but need
 * distinct labels.
 */
export type FileCategory =
  | 'word'
  | 'excel'
  | 'powerpoint'
  | 'pdf'
  | 'image'
  | 'video'
  | 'audio'
  | 'archive'
  | 'text'
  | 'unknown';

// ============================================================================
// CONSTANTS
// ============================================================================

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const EXCEL_EXTS = ['xls', 'xlsx', 'csv'] as const;
const POWERPOINT_EXTS = ['ppt', 'pptx'] as const;
const WORD_EXTS = ['doc', 'docx'] as const;
const ARCHIVE_EXTS = ['zip', 'rar', '7z', 'tar', 'gz'] as const;
const TEXT_EXTS = ['txt', 'md', 'json', 'xml'] as const;

// ============================================================================
// PREVIEW TYPE — drives the renderer
// ============================================================================

/**
 * Determines which preview component should render this file.
 *
 * Uses contentType first (most reliable), then falls back to the filename's
 * extension when contentType is missing or ambiguous (e.g. octet-stream).
 */
export function getPreviewType(
  contentType: string | undefined,
  fileName: string | undefined,
): PreviewType {
  const ct = (contentType ?? '').toLowerCase();
  const ext = extractExtension(fileName);

  if (ct === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (ct.startsWith('image/')) return 'image';
  if (ct.startsWith('video/')) return 'video';
  if (ct.startsWith('audio/')) return 'audio';
  if (ct === DOCX_MIME || ext === 'docx') return 'docx';
  if (
    ct.includes('spreadsheetml') ||
    ct === 'application/vnd.ms-excel' ||
    ext === 'xlsx' ||
    ext === 'xls'
  ) return 'excel';
  if (ct === 'text/xml' || ct === 'application/xml' || ext === 'xml') return 'xml';
  if (ct === 'text/plain' || ext === 'txt') return 'text';

  return 'unsupported';
}

// ============================================================================
// FILE CATEGORY — drives the i18n label
// ============================================================================

/**
 * Classifies the file into a broad user-facing category.
 * Used for friendly labels like "Word Document" / "Έγγραφο Word".
 */
export function getFileCategory(
  contentType: string | undefined,
  fileName: string | undefined,
): FileCategory {
  const ct = (contentType ?? '').toLowerCase();
  const ext = extractExtension(fileName);

  if (ct.includes('wordprocessingml') || ct === 'application/msword' || includes(WORD_EXTS, ext)) {
    return 'word';
  }
  if (ct.includes('spreadsheetml') || ct === 'application/vnd.ms-excel' || includes(EXCEL_EXTS, ext)) {
    return 'excel';
  }
  if (ct.includes('presentationml') || ct === 'application/vnd.ms-powerpoint' || includes(POWERPOINT_EXTS, ext)) {
    return 'powerpoint';
  }
  if (ct === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (ct.startsWith('image/')) return 'image';
  if (ct.startsWith('video/')) return 'video';
  if (ct.startsWith('audio/')) return 'audio';
  if (includes(ARCHIVE_EXTS, ext) || ct.includes('zip') || ct.includes('compressed')) return 'archive';
  if (ct.startsWith('text/') || includes(TEXT_EXTS, ext)) return 'text';

  return 'unknown';
}

/**
 * Returns the i18n key (within the `files-media` namespace) for the
 * friendly label of a file category.
 *
 * Example: getFileCategoryI18nKey('word') → 'share.fileType.word'
 */
export function getFileCategoryI18nKey(category: FileCategory): string {
  return `share.fileType.${category}`;
}

// ============================================================================
// HELPERS
// ============================================================================

function extractExtension(fileName: string | undefined): string {
  if (!fileName) return '';
  const dot = fileName.lastIndexOf('.');
  if (dot < 0 || dot === fileName.length - 1) return '';
  return fileName.slice(dot + 1).toLowerCase();
}

function includes<T extends string>(list: readonly T[], value: string): value is T {
  return (list as readonly string[]).includes(value);
}

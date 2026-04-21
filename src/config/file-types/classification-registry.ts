/**
 * =============================================================================
 * 🏢 ENTERPRISE: File-Type Classification Registry (SSoT)
 * =============================================================================
 *
 * Single source of truth for every per-file-type decision in the application:
 *   - Which MIME types / extensions belong to which "family" (pdf, docx, dxf…)
 *   - Which families the AI classification pipeline accepts
 *   - Which preview strategy the renderer should apply
 *   - Which broad user-facing category the file belongs to (i18n labels)
 *   - Which body-text extractor to run before the AI call
 *   - Which deterministic documentType to emit for media (video/audio)
 *
 * Before this module the same knowledge lived — duplicated — in three places:
 *   - src/app/api/files/classify/route.ts         (server classifier)
 *   - src/components/shared/files/hooks/useFileClassification.ts (client classifier)
 *   - src/lib/file-types/preview-registry.ts      (preview renderer)
 *
 * Drift between those three lists produced ~10 commits on 2026-04-21 alone.
 *
 * @module config/file-types/classification-registry
 * @enterprise ADR-296 — File-Type Classification SSoT Unification
 * @ssot true
 */

// ============================================================================
// TYPES
// ============================================================================

/** Renderer strategy used by `FilePreviewRenderer`. */
export type PreviewType =
  | 'pdf'
  | 'image'
  | 'video'
  | 'audio'
  | 'docx'
  | 'excel'
  | 'xml'
  | 'text'
  | 'html'
  | 'dxf'
  | 'unsupported';

/** Broad user-facing file category (drives the i18n label). */
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

/** Body-text extraction strategy run before the AI classification call. */
export type ExtractorKind = 'docx' | 'xlsx' | 'dxf' | 'svg-truncate';

/** Deterministic AI documentType for media files (no AI call required). */
export type MediaDocumentType = 'video' | 'audio';

/** Canonical description of one file-type family. */
export interface FileTypeSpec {
  /** Stable identifier (used by tests & logs). */
  readonly id: string;
  /** Canonical + alias MIME types. */
  readonly mimeTypes: readonly string[];
  /** Lowercase extensions (no leading dot). */
  readonly extensions: readonly string[];
  /** `true` → the AI classification pipeline accepts this family. */
  readonly classifiable: boolean;
  /** Preview strategy in `FilePreviewRenderer`. */
  readonly previewType: PreviewType;
  /** i18n label family. */
  readonly category: FileCategory;
  /** Which extractor to run before the AI call (if any). */
  readonly extractor?: ExtractorKind;
  /** Deterministic `documentType` emitted without an AI call. */
  readonly mediaDocumentType?: MediaDocumentType;
}

/** Prefix-matching spec for MIME families (image/*, video/*, audio/*). */
export interface MimePrefixSpec {
  readonly prefix: string;
  readonly previewType: PreviewType;
  readonly category: FileCategory;
  readonly classifiable: boolean;
  readonly mediaDocumentType?: MediaDocumentType;
}

// ============================================================================
// REGISTRY
// ============================================================================

/**
 * Explicit file-type specifications.
 *
 * Ordering is informational only — lookup is driven by `specByMime` /
 * `specByExt` maps built from this array. The invariants preserved by the
 * registry are:
 *   - every MIME appears in exactly one spec
 *   - every extension appears in exactly one spec
 *   - every spec with `classifiable: true` is either directly supported by the
 *     AI pipeline (text/image/pdf) or has an `extractor` to pre-process it
 */
export const FILE_TYPE_REGISTRY: readonly FileTypeSpec[] = [
  {
    id: 'pdf',
    mimeTypes: ['application/pdf'],
    extensions: ['pdf'],
    classifiable: true,
    previewType: 'pdf',
    category: 'pdf',
  },
  {
    id: 'docx',
    mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    extensions: ['docx'],
    classifiable: true,
    previewType: 'docx',
    category: 'word',
    extractor: 'docx',
  },
  {
    id: 'doc',
    mimeTypes: ['application/msword'],
    extensions: ['doc'],
    classifiable: false,
    previewType: 'unsupported',
    category: 'word',
  },
  {
    id: 'xlsx',
    mimeTypes: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ],
    extensions: ['xlsx', 'xls'],
    classifiable: true,
    previewType: 'excel',
    category: 'excel',
    extractor: 'xlsx',
  },
  {
    id: 'csv',
    mimeTypes: ['text/csv'],
    extensions: ['csv'],
    classifiable: true,
    previewType: 'text',
    category: 'excel',
  },
  {
    id: 'pptx',
    mimeTypes: [
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-powerpoint',
    ],
    extensions: ['pptx', 'ppt'],
    classifiable: false,
    previewType: 'unsupported',
    category: 'powerpoint',
  },
  {
    id: 'txt',
    mimeTypes: ['text/plain'],
    extensions: ['txt', 'md'],
    classifiable: true,
    previewType: 'text',
    category: 'text',
  },
  {
    id: 'xml',
    mimeTypes: ['text/xml', 'application/xml'],
    extensions: ['xml'],
    classifiable: true,
    previewType: 'xml',
    category: 'text',
  },
  {
    id: 'html',
    mimeTypes: ['text/html'],
    extensions: ['html', 'htm'],
    classifiable: true,
    previewType: 'html',
    category: 'text',
  },
  {
    id: 'json',
    mimeTypes: ['application/json'],
    extensions: ['json'],
    classifiable: false,
    previewType: 'text',
    category: 'text',
  },
  {
    id: 'image-jpeg',
    mimeTypes: ['image/jpeg'],
    extensions: ['jpg', 'jpeg'],
    classifiable: true,
    previewType: 'image',
    category: 'image',
  },
  {
    id: 'image-png',
    mimeTypes: ['image/png'],
    extensions: ['png'],
    classifiable: true,
    previewType: 'image',
    category: 'image',
  },
  {
    id: 'image-gif',
    mimeTypes: ['image/gif'],
    extensions: ['gif'],
    classifiable: true,
    previewType: 'image',
    category: 'image',
  },
  {
    id: 'image-webp',
    mimeTypes: ['image/webp'],
    extensions: ['webp'],
    classifiable: true,
    previewType: 'image',
    category: 'image',
  },
  {
    id: 'svg',
    mimeTypes: ['image/svg+xml'],
    extensions: ['svg'],
    classifiable: true,
    previewType: 'image',
    category: 'image',
    extractor: 'svg-truncate',
  },
  {
    id: 'dxf',
    mimeTypes: ['image/vnd.dxf', 'application/dxf'],
    extensions: ['dxf'],
    classifiable: true,
    previewType: 'dxf',
    category: 'unknown',
    extractor: 'dxf',
  },
  {
    id: 'archive',
    mimeTypes: [
      'application/zip',
      'application/x-rar-compressed',
      'application/x-7z-compressed',
      'application/x-tar',
      'application/gzip',
    ],
    extensions: ['zip', 'rar', '7z', 'tar', 'gz'],
    classifiable: false,
    previewType: 'unsupported',
    category: 'archive',
  },
];

/**
 * Prefix-based MIME specs — used when no explicit spec matched and the content
 * type starts with one of these prefixes. Gives deterministic classification
 * of the "all video files" / "all audio files" families without enumerating
 * every codec variant.
 */
export const MIME_PREFIX_SPECS: readonly MimePrefixSpec[] = [
  {
    prefix: 'video/',
    previewType: 'video',
    category: 'video',
    classifiable: true,
    mediaDocumentType: 'video',
  },
  {
    prefix: 'audio/',
    previewType: 'audio',
    category: 'audio',
    classifiable: true,
    mediaDocumentType: 'audio',
  },
];

// ============================================================================
// LOOKUP INDICES (built once at module load)
// ============================================================================

const MIME_INDEX: Map<string, FileTypeSpec> = new Map();
const EXT_INDEX: Map<string, FileTypeSpec> = new Map();

for (const spec of FILE_TYPE_REGISTRY) {
  for (const mime of spec.mimeTypes) {
    if (MIME_INDEX.has(mime)) {
      throw new Error(
        `[classification-registry] duplicate MIME type "${mime}" in specs ` +
          `"${MIME_INDEX.get(mime)?.id}" and "${spec.id}"`,
      );
    }
    MIME_INDEX.set(mime, spec);
  }
  for (const ext of spec.extensions) {
    if (EXT_INDEX.has(ext)) {
      throw new Error(
        `[classification-registry] duplicate extension "${ext}" in specs ` +
          `"${EXT_INDEX.get(ext)?.id}" and "${spec.id}"`,
      );
    }
    EXT_INDEX.set(ext, spec);
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/** Pull the lowercase extension from a filename — empty string if none. */
export function extractExtension(filename: string | undefined): string {
  if (!filename) return '';
  const dot = filename.lastIndexOf('.');
  if (dot < 0 || dot === filename.length - 1) return '';
  return filename.slice(dot + 1).toLowerCase();
}

/** Spec lookup by exact MIME (case-insensitive). */
export function specByMime(mime: string | undefined): FileTypeSpec | null {
  if (!mime) return null;
  return MIME_INDEX.get(mime.toLowerCase()) ?? null;
}

/** Spec lookup by extension (accepts with or without leading dot). */
export function specByExt(ext: string | undefined): FileTypeSpec | null {
  if (!ext) return null;
  const normalized = ext.startsWith('.') ? ext.slice(1) : ext;
  return EXT_INDEX.get(normalized.toLowerCase()) ?? null;
}

/**
 * Resolve the spec for a file given its stored MIME, filename and (optional)
 * filename extension. Resolution order:
 *   1. Exact MIME match
 *   2. Extension match on `fileExt`
 *   3. Extension match on the extension derived from `filename`
 *   4. Extension match on `displayName` (client-side hint; safe to omit)
 */
export function specForFile(
  contentType: string | undefined,
  filename: string | undefined,
  fileExt?: string,
  displayName?: string,
): FileTypeSpec | null {
  return (
    specByMime(contentType) ??
    specByExt(fileExt) ??
    specByExt(extractExtension(filename)) ??
    specByExt(extractExtension(displayName)) ??
    null
  );
}

/** Match a content-type against the prefix specs (`video/`, `audio/`). */
export function prefixSpecFor(contentType: string | undefined): MimePrefixSpec | null {
  if (!contentType) return null;
  const ct = contentType.toLowerCase();
  for (const spec of MIME_PREFIX_SPECS) {
    if (ct.startsWith(spec.prefix)) return spec;
  }
  return null;
}

// ============================================================================
// PUBLIC API — used by route.ts, useFileClassification.ts, preview-registry.ts
// ============================================================================

/**
 * `true` when the AI classification pipeline accepts this file.
 * Mirrors the server-side decision exactly — this IS the server-side decision.
 */
export function isAIClassifiable(
  contentType: string | undefined,
  filename?: string,
  fileExt?: string,
  displayName?: string,
): boolean {
  const spec = specForFile(contentType, filename, fileExt, displayName);
  if (spec) return spec.classifiable;
  return prefixSpecFor(contentType)?.classifiable ?? false;
}

/** Preview strategy for the renderer. */
export function getPreviewType(
  contentType: string | undefined,
  filename: string | undefined,
): PreviewType {
  const spec = specForFile(contentType, filename);
  if (spec) return spec.previewType;
  return prefixSpecFor(contentType)?.previewType ?? 'unsupported';
}

/** Broad user-facing file category (drives the i18n label). */
export function getFileCategory(
  contentType: string | undefined,
  filename: string | undefined,
): FileCategory {
  const spec = specForFile(contentType, filename);
  if (spec) return spec.category;
  return prefixSpecFor(contentType)?.category ?? 'unknown';
}

/** Deterministic documentType for media files; `null` for everything else. */
export function getMediaDocumentType(
  contentType: string | undefined,
): MediaDocumentType | null {
  return prefixSpecFor(contentType)?.mediaDocumentType ?? null;
}

/** Which body-text extractor (if any) to run before the AI call. */
export function getExtractorKind(
  contentType: string | undefined,
  filename?: string,
  fileExt?: string,
): ExtractorKind | null {
  return specForFile(contentType, filename, fileExt)?.extractor ?? null;
}

/** i18n key for the friendly label of a file category. */
export function getFileCategoryI18nKey(category: FileCategory): string {
  return `share.fileType.${category}`;
}

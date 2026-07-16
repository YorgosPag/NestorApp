/**
 * =============================================================================
 * SSoT INVARIANT TESTS — File-Type Classification Registry (ADR-296)
 * =============================================================================
 *
 * These tests are the enforcement layer that prevents the drift pattern
 * observed on 2026-04-21 (10+ fix commits caused by parallel MIME lists
 * kept in sync by hand).
 *
 * If any of these assertions fails, DO NOT adjust the test — fix the
 * registry. The tests encode contracts the three consumers (route.ts,
 * useFileClassification.ts, preview-registry.ts) rely on.
 */

import {
  FILE_TYPE_REGISTRY,
  MIME_PREFIX_SPECS,
  type FileTypeSpec,
  type PreviewType,
  type FileCategory,
  type ExtractorKind,
  type MediaDocumentType,
  isAIClassifiable,
  getPreviewType,
  getFileCategory,
  getMediaDocumentType,
  getExtractorKind,
  specByMime,
  specByExt,
  specForFile,
  filenameFromUrl,
  canonicalMimeForFilename,
  canonicalMimeForUrl,
  UNKNOWN_MIME_TYPE,
} from '../classification-registry';

// ============================================================================
// Helper: enumerate literal members of the PreviewType union
// ============================================================================

const ALL_PREVIEW_TYPES: readonly PreviewType[] = [
  'pdf',
  'image',
  'video',
  'audio',
  'docx',
  'excel',
  'xml',
  'text',
  'html',
  'dxf',
  'unsupported',
] as const;

const ALL_CATEGORIES: readonly FileCategory[] = [
  'word',
  'excel',
  'powerpoint',
  'pdf',
  'image',
  'video',
  'audio',
  'archive',
  'text',
  'unknown',
] as const;

const ALL_EXTRACTORS: readonly ExtractorKind[] = [
  'docx',
  'xlsx',
  'dxf',
  'svg-truncate',
] as const;

// ============================================================================
// Registry uniqueness invariants
// ============================================================================

describe('FILE_TYPE_REGISTRY — uniqueness', () => {
  it('has no duplicate MIME type across specs', () => {
    const seen = new Map<string, string>();
    const duplicates: string[] = [];
    for (const spec of FILE_TYPE_REGISTRY) {
      for (const mime of spec.mimeTypes) {
        const lower = mime.toLowerCase();
        if (seen.has(lower)) {
          duplicates.push(`${lower} → [${seen.get(lower)}, ${spec.id}]`);
        }
        seen.set(lower, spec.id);
      }
    }
    expect(duplicates).toEqual([]);
  });

  it('has no duplicate extension across specs', () => {
    const seen = new Map<string, string>();
    const duplicates: string[] = [];
    for (const spec of FILE_TYPE_REGISTRY) {
      for (const ext of spec.extensions) {
        const lower = ext.toLowerCase();
        if (seen.has(lower)) {
          duplicates.push(`${lower} → [${seen.get(lower)}, ${spec.id}]`);
        }
        seen.set(lower, spec.id);
      }
    }
    expect(duplicates).toEqual([]);
  });

  it('has a unique `id` per spec', () => {
    const ids = FILE_TYPE_REGISTRY.map((spec) => spec.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('declares only extensions without a leading dot', () => {
    for (const spec of FILE_TYPE_REGISTRY) {
      for (const ext of spec.extensions) {
        expect(ext.startsWith('.')).toBe(false);
        expect(ext).toEqual(ext.toLowerCase());
      }
    }
  });
});

// ============================================================================
// Enum coverage — every spec field is a valid union literal
// ============================================================================

describe('FILE_TYPE_REGISTRY — enum coverage', () => {
  it('every spec.previewType is a valid PreviewType', () => {
    for (const spec of FILE_TYPE_REGISTRY) {
      expect(ALL_PREVIEW_TYPES).toContain(spec.previewType);
    }
  });

  it('every spec.category is a valid FileCategory', () => {
    for (const spec of FILE_TYPE_REGISTRY) {
      expect(ALL_CATEGORIES).toContain(spec.category);
    }
  });

  it('every spec.extractor (when set) is a valid ExtractorKind', () => {
    for (const spec of FILE_TYPE_REGISTRY) {
      if (spec.extractor) {
        expect(ALL_EXTRACTORS).toContain(spec.extractor);
      }
    }
  });

  it('every classifiable spec is either text/image/pdf or has an extractor', () => {
    const nativelySupported = new Set<PreviewType>(['pdf', 'text', 'image', 'html', 'xml', 'dxf']);
    for (const spec of FILE_TYPE_REGISTRY) {
      if (!spec.classifiable) continue;
      const ok = nativelySupported.has(spec.previewType) || !!spec.extractor;
      if (!ok) {
        throw new Error(
          `Spec "${spec.id}" is classifiable but has neither a native-supported ` +
            `previewType nor an extractor — AI pipeline cannot consume it.`,
        );
      }
    }
  });
});

// ============================================================================
// MIME_PREFIX_SPECS
// ============================================================================

describe('MIME_PREFIX_SPECS', () => {
  it('covers video/ and audio/ prefixes', () => {
    const prefixes = MIME_PREFIX_SPECS.map((s) => s.prefix);
    expect(prefixes).toEqual(expect.arrayContaining(['video/', 'audio/']));
  });

  it('every prefix spec with mediaDocumentType emits a valid literal', () => {
    const validMedia: readonly MediaDocumentType[] = ['video', 'audio'];
    for (const spec of MIME_PREFIX_SPECS) {
      if (spec.mediaDocumentType) {
        expect(validMedia).toContain(spec.mediaDocumentType);
      }
    }
  });
});

// ============================================================================
// Parity with the legacy hand-maintained MIME lists
// ============================================================================
//
// These literal arrays mirror the lists that previously lived in:
//   - src/app/api/files/classify/route.ts (IMAGE_MIME_TYPES + TEXT_MIME_TYPES)
//   - src/components/shared/files/hooks/useFileClassification.ts
// If the registry ever stops classifying one of these, something regressed.

const LEGACY_CLASSIFIABLE_MIMES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/vnd.dxf',
  'application/dxf',
  'application/pdf',
  'text/plain',
  'text/csv',
  'text/xml',
  'application/xml',
  'text/html',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;

const LEGACY_CLASSIFIABLE_EXTS = ['dxf', 'svg', 'pdf', 'txt', 'csv', 'docx', 'xlsx', 'xml', 'html'] as const;

describe('Legacy parity — every hand-maintained MIME resolves to classifiable=true', () => {
  it.each(LEGACY_CLASSIFIABLE_MIMES)('MIME %s is classifiable', (mime) => {
    expect(isAIClassifiable(mime)).toBe(true);
  });

  it.each(LEGACY_CLASSIFIABLE_EXTS)('extension %s is classifiable via ext fallback', (ext) => {
    expect(isAIClassifiable(undefined, `sample.${ext}`, ext)).toBe(true);
  });
});

// ============================================================================
// Behavioural parity with the legacy isClassifiable / isAIClassifiable
// ============================================================================

describe('isAIClassifiable — behavioural parity with legacy implementations', () => {
  it('rejects empty content type with no filename/ext', () => {
    expect(isAIClassifiable(undefined)).toBe(false);
    expect(isAIClassifiable('')).toBe(false);
  });

  it('accepts any video/* or audio/* MIME via prefix match', () => {
    expect(isAIClassifiable('video/mp4')).toBe(true);
    expect(isAIClassifiable('video/x-matroska')).toBe(true);
    expect(isAIClassifiable('audio/mpeg')).toBe(true);
    expect(isAIClassifiable('audio/ogg')).toBe(true);
  });

  it('accepts DXF through octet-stream + ext fallback', () => {
    expect(isAIClassifiable('application/octet-stream', 'drawing.dxf')).toBe(true);
    expect(isAIClassifiable('application/octet-stream', undefined, 'dxf')).toBe(true);
  });

  it('accepts DXF through displayName fallback', () => {
    expect(isAIClassifiable('application/octet-stream', undefined, undefined, 'ΣΧΕΔΙΟ.dxf')).toBe(
      true,
    );
  });

  it('rejects archives (zip, rar) and legacy Office formats (.doc)', () => {
    expect(isAIClassifiable('application/zip')).toBe(false);
    expect(isAIClassifiable('application/x-rar-compressed')).toBe(false);
    expect(isAIClassifiable('application/msword')).toBe(false);
  });
});

// ============================================================================
// getPreviewType — renderer coverage
// ============================================================================

describe('getPreviewType', () => {
  it('returns unsupported for unknown types', () => {
    expect(getPreviewType('application/octet-stream', 'mystery.bin')).toBe('unsupported');
    expect(getPreviewType(undefined, undefined)).toBe('unsupported');
  });

  it('routes PDF / DOCX / XLSX to their dedicated previews', () => {
    expect(getPreviewType('application/pdf', 'x.pdf')).toBe('pdf');
    expect(
      getPreviewType(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'x.docx',
      ),
    ).toBe('docx');
    expect(
      getPreviewType(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'x.xlsx',
      ),
    ).toBe('excel');
  });

  it('falls back to extension when content type is missing', () => {
    expect(getPreviewType(undefined, 'drawing.dxf')).toBe('dxf');
    expect(getPreviewType(undefined, 'notes.txt')).toBe('text');
    expect(getPreviewType(undefined, 'report.html')).toBe('html');
  });

  it('classifies SVG as image preview', () => {
    expect(getPreviewType('image/svg+xml', 'logo.svg')).toBe('image');
  });

  it('classifies any video/audio MIME via prefix', () => {
    expect(getPreviewType('video/mp4', 'clip.mp4')).toBe('video');
    expect(getPreviewType('audio/ogg', 'song.ogg')).toBe('audio');
  });
});

// ============================================================================
// getFileCategory — i18n label coverage
// ============================================================================

describe('getFileCategory', () => {
  it('maps DOCX to word, XLSX to excel, PPTX to powerpoint', () => {
    expect(
      getFileCategory(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'x.docx',
      ),
    ).toBe('word');
    expect(
      getFileCategory(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'x.xlsx',
      ),
    ).toBe('excel');
    expect(
      getFileCategory(
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'x.pptx',
      ),
    ).toBe('powerpoint');
  });

  it('falls back to unknown when nothing matches', () => {
    expect(getFileCategory('application/octet-stream', 'x.wtf')).toBe('unknown');
    expect(getFileCategory(undefined, undefined)).toBe('unknown');
  });
});

// ============================================================================
// Extractor dispatch
// ============================================================================

describe('getExtractorKind — extractor assignment', () => {
  it('returns the correct extractor for DOCX / XLSX / DXF / SVG', () => {
    expect(
      getExtractorKind(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'x.docx',
      ),
    ).toBe('docx');
    expect(
      getExtractorKind(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'x.xlsx',
      ),
    ).toBe('xlsx');
    expect(getExtractorKind('image/vnd.dxf', 'plan.dxf')).toBe('dxf');
    expect(getExtractorKind('image/svg+xml', 'icon.svg')).toBe('svg-truncate');
  });

  it('returns null for families that do not need extraction', () => {
    expect(getExtractorKind('application/pdf', 'x.pdf')).toBeNull();
    expect(getExtractorKind('text/plain', 'x.txt')).toBeNull();
    expect(getExtractorKind('image/png', 'x.png')).toBeNull();
  });

  it('resolves DXF through octet-stream + ext fallback', () => {
    expect(getExtractorKind('application/octet-stream', 'plan.dxf', 'dxf')).toBe('dxf');
  });
});

// ============================================================================
// Media documentType
// ============================================================================

describe('getMediaDocumentType', () => {
  it.each([
    ['video/mp4', 'video'],
    ['video/webm', 'video'],
    ['audio/mpeg', 'audio'],
    ['audio/wav', 'audio'],
  ] as const)('maps %s → %s', (mime, expected) => {
    expect(getMediaDocumentType(mime)).toBe(expected);
  });

  it('returns null for non-media MIME types', () => {
    expect(getMediaDocumentType('application/pdf')).toBeNull();
    expect(getMediaDocumentType(undefined)).toBeNull();
  });
});

// ============================================================================
// Lookup helpers
// ============================================================================

describe('specByMime / specByExt / specForFile', () => {
  it('is case-insensitive on both MIME and extension', () => {
    expect(specByMime('APPLICATION/PDF')?.id).toBe('pdf');
    expect(specByExt('PDF')?.id).toBe('pdf');
    expect(specByExt('.pdf')?.id).toBe('pdf');
  });

  it('returns null for unknown inputs', () => {
    expect(specByMime('application/xyz')).toBeNull();
    expect(specByExt('xyz')).toBeNull();
  });

  it('specForFile prefers exact MIME over extension', () => {
    const spec: FileTypeSpec | null = specForFile('application/pdf', 'mislabelled.docx');
    expect(spec?.id).toBe('pdf');
  });

  it('specForFile falls through to filename extension when MIME is missing', () => {
    const spec = specForFile(undefined, 'drawing.dxf');
    expect(spec?.id).toBe('dxf');
  });
});

// ============================================================================
// Canonical MIME resolution (extension → MIME)
// ============================================================================
//
// The trap this guards: `mimeTypes[0]` is an array position, not a per-extension
// answer. A spec listing several MIMEs must say which one each extension means,
// or `.rar` silently resolves to `application/zip`.

describe('canonicalMimeByExt invariants', () => {
  it('every multi-MIME spec maps EVERY one of its extensions explicitly', () => {
    for (const spec of FILE_TYPE_REGISTRY) {
      if (spec.mimeTypes.length <= 1) continue;
      for (const ext of spec.extensions) {
        expect(spec.canonicalMimeByExt?.[ext]).toBeDefined();
      }
    }
  });

  it('every mapped MIME is one the spec actually claims', () => {
    for (const spec of FILE_TYPE_REGISTRY) {
      for (const [, mime] of Object.entries(spec.canonicalMimeByExt ?? {})) {
        expect(spec.mimeTypes).toContain(mime);
      }
    }
  });

  it('every canonical MIME round-trips back to its own spec', () => {
    for (const spec of FILE_TYPE_REGISTRY) {
      for (const ext of spec.extensions) {
        expect(specByMime(canonicalMimeForFilename(`file.${ext}`))?.id).toBe(spec.id);
      }
    }
  });

  it('resolves the sibling extensions that array order would get wrong', () => {
    expect(canonicalMimeForFilename('archive.rar')).toBe('application/x-rar-compressed');
    expect(canonicalMimeForFilename('book.xls')).toBe('application/vnd.ms-excel');
    expect(canonicalMimeForFilename('deck.ppt')).toBe('application/vnd.ms-powerpoint');
  });
});

describe('filenameFromUrl', () => {
  it.each([
    ['https://x/invoices/doc.pdf', 'doc.pdf'],
    ['https://x/doc.pdf?alt=media&token=a.b.c', 'doc.pdf'],
    ['https://x/doc.pdf#page=2', 'doc.pdf'],
    ['https://x/%CE%A4%CE%99%CE%9C%CE%9F%CE%9B%CE%9F%CE%93%CE%99%CE%9F.pdf', 'ΤΙΜΟΛΟΓΙΟ.pdf'],
    ['https://x/', ''],
  ])('%s → "%s"', (url, expected) => {
    expect(filenameFromUrl(url)).toBe(expected);
  });

  it('returns the raw segment when percent-decoding fails', () => {
    expect(filenameFromUrl('https://x/bad%ZZ.pdf')).toBe('bad%ZZ.pdf');
  });
});

describe('canonicalMimeForUrl', () => {
  it('resolves a double extension by the LAST one', () => {
    expect(canonicalMimeForUrl('https://x/report.png.pdf')).toBe('application/pdf');
  });

  it('ignores the query string', () => {
    expect(canonicalMimeForUrl('https://x/scan.png?alt=media&token=a.b.c')).toBe('image/png');
  });

  it('falls back for unknown or absent extensions', () => {
    expect(canonicalMimeForUrl('https://x/scan.tiff')).toBe(UNKNOWN_MIME_TYPE);
    expect(canonicalMimeForUrl('https://x/noext')).toBe(UNKNOWN_MIME_TYPE);
    expect(canonicalMimeForUrl(undefined)).toBe(UNKNOWN_MIME_TYPE);
  });

  it('honours a caller-supplied fallback', () => {
    expect(canonicalMimeForUrl('https://x/scan.tiff', 'image/tiff')).toBe('image/tiff');
  });
});

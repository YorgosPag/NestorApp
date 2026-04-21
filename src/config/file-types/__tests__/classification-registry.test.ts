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

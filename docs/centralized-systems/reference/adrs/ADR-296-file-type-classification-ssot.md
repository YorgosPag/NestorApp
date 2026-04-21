# ADR-296: File-Type Classification SSoT Unification

| Metadata | Value |
|----------|-------|
| **Status** | ✅ IMPLEMENTED |
| **Date** | 2026-04-21 |
| **Category** | File Management / Architectural Integrity |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI — Opus 4.7) |
| **Related** | ADR-191 (Document Management), ADR-281 (Soft-Delete), ADR-294 (SSoT Ratchet), ADR-299 (Ratchet Backlog) |

---

## 1. Context

Between `00:01` and `17:50` on **2026-04-21**, the project received **31 commits** concentrated in the file management subsystem. Twenty of those commits touched file classification or extraction logic. A forensic reading of the sequence (`3d537879` → `a346c57e`) shows a recurring symptom:

> A MIME type or extension was accepted on one side of the pipeline but rejected on the other, so the user saw files stuck in `classifying` state, "Content type not classifiable" errors, or previews falling back to "unsupported".

The root cause was **three parallel hand-maintained lists** describing the same knowledge:

| File | Constant(s) | Role |
|------|-------------|------|
| `src/app/api/files/classify/route.ts` | `IMAGE_MIME_TYPES`, `TEXT_MIME_TYPES`, `DXF_EXTENSIONS` | Server-side gate for the AI classifier |
| `src/components/shared/files/hooks/useFileClassification.ts` | `CLASSIFIABLE_TYPES`, `CLASSIFIABLE_EXTS` | Client-side "is this button clickable" check |
| `src/lib/file-types/preview-registry.ts` | branches inside `getPreviewType()` | Preview renderer dispatch |

Line 56 of `useFileClassification.ts` even contained the comment
`// CLASSIFIABLE MIME TYPES (mirror of server-side check)` — a self-denounced SSoT violation. Adding a new format (DXF, SVG, HTML, XML, DOCX, XLSX, video, audio…) required editing all three files, each time with a different semantic shape (`Set<string>` vs `if`-chain), and the drift was only visible at runtime.

In parallel, the extractor pipeline in `classify-background.ts` contained an `if/else` chain dispatching on hard-coded `DOCX_MIME` / `XLSX_MIME` / `DXF_MIMES` / `SVG_MIME` constants — a fourth copy of the same knowledge.

---

## 2. Decision

Introduce a **single registry** that owns every per-file-type decision, and reduce the three legacy modules to thin adapters over it.

**Canonical file**: `src/config/file-types/classification-registry.ts`

### 2.1 Data model

```ts
export interface FileTypeSpec {
  readonly id: string;                          // stable key ('pdf', 'docx', 'dxf', …)
  readonly mimeTypes: readonly string[];        // canonical + aliases
  readonly extensions: readonly string[];       // lowercase, no leading dot
  readonly classifiable: boolean;               // AI pipeline accepts this family
  readonly previewType: PreviewType;            // renderer strategy
  readonly category: FileCategory;              // i18n label family
  readonly extractor?: ExtractorKind;           // body-text extraction strategy
  readonly mediaDocumentType?: 'video' | 'audio';  // deterministic documentType
}

export interface MimePrefixSpec {
  readonly prefix: string;           // 'video/', 'audio/'
  readonly previewType: PreviewType;
  readonly category: FileCategory;
  readonly classifiable: boolean;
  readonly mediaDocumentType?: 'video' | 'audio';
}
```

One spec per file-type family (`pdf`, `docx`, `xlsx`, `csv`, `pptx`, `txt`, `xml`, `html`, `json`, `svg`, `dxf`, `image-jpeg`, `image-png`, `image-gif`, `image-webp`, `archive`, `doc`). Two prefix specs (`video/`, `audio/`).

### 2.2 Public API

| Function | Replaces |
|----------|----------|
| `isAIClassifiable(contentType?, filename?, ext?, displayName?)` | `isClassifiable()` (server) + `isAIClassifiable()` (client) |
| `getPreviewType(contentType?, filename?)` | the `if`-chain that used to live in `preview-registry.ts` |
| `getFileCategory(contentType?, filename?)` | same file, same function |
| `getMediaDocumentType(contentType?)` | `getMediaDocumentType()` in `route.ts` |
| `getExtractorKind(contentType?, filename?, ext?)` | hard-coded MIME comparisons in `classify-background.ts` |
| `specForFile(...)`, `specByMime(...)`, `specByExt(...)` | (new — primitives for future consumers) |

### 2.3 Consumers after refactor

| File | Before | After |
|------|--------|-------|
| `src/lib/file-types/preview-registry.ts` | 164 LOC with its own MIME lists | 28 LOC — pure re-export of the SSoT (backward compatible) |
| `src/components/shared/files/hooks/useFileClassification.ts` | 44 LOC of `CLASSIFIABLE_TYPES` + `CLASSIFIABLE_EXTS` + branching | 1 delegate call to `isAIClassifiableSSoT` |
| `src/app/api/files/classify/route.ts` | `IMAGE_MIME_TYPES` + `TEXT_MIME_TYPES` + `DXF_EXTENSIONS` + 17-line `isClassifiable` + `getMediaDocumentType` | two 3-line thin wrappers |
| `src/app/api/files/classify/classify-background.ts` | `DOCX_MIME` / `XLSX_MIME` / `DXF_MIMES` / `SVG_MIME` + 27-line `if/else` chain | `runExtractor(kind, …)` switch over the `ExtractorKind` union — dispatched via `getExtractorKind(...)` |

### 2.4 Backwards compatibility

The public API of `preview-registry.ts` (`PreviewType`, `FileCategory`, `getPreviewType`, `getFileCategory`, `getFileCategoryI18nKey`) is preserved via re-export. Every caller outside the file-types module continues to work unchanged.

---

## 3. Enforcement — Three New Presubmit Checks

### 3.1 CHECK 3.19 — SSoT ratchet entry

Added under `file-type-classification` in `.ssot-registry.json`:

```json
{
  "ssotFile": "src/config/file-types/classification-registry.ts",
  "forbiddenPatterns": [
    "(CLASSIFIABLE_TYPES|CLASSIFIABLE_EXTS|IMAGE_MIME_TYPES|TEXT_MIME_TYPES|DXF_EXTENSIONS)\\s*=\\s*new\\s+Set",
    "const\\s+(DOCX_MIME|XLSX_MIME|DXF_MIMES|SVG_MIME)\\s*="
  ],
  "allowlist": [
    "src/config/file-types/classification-registry.ts",
    "src/lib/file-types/preview-registry.ts"
  ]
}
```

Any new file that re-declares those constants blocks the commit. Picked up automatically by the existing `check-ssot-imports.sh` hook (ADR-294) — no wrapper script needed.

### 3.2 CHECK 3.20 — Extractor registry invariants

File: `src/app/api/files/classify/__tests__/extractor-registry.test.ts`

Asserts:
1. `runExtractor` in `classify-background.ts` has a `case` branch for every `ExtractorKind` literal (compile-time TS exhaustive check + grep cross-check).
2. `classify-background.ts` actually dispatches through `getExtractorKind(…)` (no re-hardcoded MIME constants).
3. Every `*-extractor.ts` file under `src/lib/document-extractors/` is imported by `classify-background.ts`. Orphan extractors fail the test.

### 3.3 CHECK 3.21 — Preview renderer invariant

File: `src/components/shared/files/preview/__tests__/FilePreviewRenderer.invariant.test.ts`

Asserts:
1. Every `PreviewType` literal has a matching `previewType === 'X'` branch in the renderer.
2. Every `previewType === 'X'` branch references a literal that belongs to the union — no orphan strings.

This catches the bug pattern from commit `1d522810` (DXF preview component added + `getPreviewType()` updated, renderer not touched → silent fallback to `unsupported`).

### 3.4 Registry self-tests

Two additional invariants inside `classification-registry.test.ts`:
- No MIME appears in more than one spec.
- No extension appears in more than one spec.
- Every `classifiable: true` spec is either natively supported by the AI pipeline or has an `extractor` assigned.
- Parity fixtures: every MIME/extension that was in the legacy hand-maintained lists resolves to `classifiable: true`.

Total: **80 tests**, full suite runs in ~8 s on SWC / Jest.

---

## 4. Consequences

### 4.1 Positive

- **Single edit to add a new format.** Future PDF, PPTX, RTF, HEIC, MP4 variants need one entry in `FILE_TYPE_REGISTRY`; every consumer picks it up automatically.
- **Pre-commit drift prevention.** The three tests encode the contracts that were previously enforced only by memory + code review.
- **Telemetry-friendly IDs.** Every spec has a stable `id` — useful for log aggregation and future metrics.
- **Zero behaviour change in production.** All 80 parity tests (legacy MIMEs, legacy extensions, octet-stream DXF fallback, `displayName` fallback) pass. Vercel build untouched apart from the 5 refactored files.

### 4.2 Negative / Deferred

- **Cascade coverage (ADR-281) not in scope.** Today's 4 cascade-fix commits (`6e2bf3b1`, `3f0efe3f`, `a346c57e`, `16b0dca0`) reveal a second SSoT gap: the per-entity cascade to `files` lives inline in API routes, not in `DELETION_REGISTRY`. That refactor requires moving cascade helpers into a declarative config and is tracked as **Phase 2** below.
- **`file-upload-config.ts` not merged.** `FILE_TYPE_CONFIG` (size limits, upload error messages, MIME allowlists per upload purpose) is orthogonal to classification and remains separate. A future ADR may unify them if the MIME lists overlap drift-worthy.

### 4.3 Phase 2 (follow-up, not this ADR)

- [ ] Declarative cascade in `DELETION_REGISTRY`: add `cascadeTo: 'files'` with a canonical helper, remove the inline `cascadeContactFilesToTrash` / `cascadeContactFilesToRestore` / `cascadeContactFilesToPurge` from contact route.
- [ ] `FILE_OWNING_ENTITIES` constant shared by `files` collection queries and deletion cascade.
- [ ] Test: every entity in `FILE_OWNING_ENTITIES` has all three cascade actions wired (soft-delete, restore, purge).

---

## 5. Changelog

| Date | Change |
|------|--------|
| 2026-04-21 | ADR created + implemented. 5 files refactored, 3 test suites added (80 tests), 1 new `.ssot-registry.json` module (`file-type-classification`). Driven by forensic analysis of the 31 commits landed earlier the same day. |

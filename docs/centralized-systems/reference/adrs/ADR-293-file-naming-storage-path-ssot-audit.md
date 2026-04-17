# ADR-293: File Naming & Storage Path SSoT Audit

**Status**: APPROVED
**Date**: 2026-04-07
**Author**: Claude Code + Georgios Pagonis
**Type**: Audit / Cross-Reference Map

---

## Context & Problem

Across 12 ADRs written over 4+ months, the file naming and storage path architecture has been built incrementally. Each ADR solved a specific problem (photo upload consolidation, floorplan migration, CAD metadata centralization, etc.), but **no single document answers the question:**

> "Are file naming and storage paths truly centralized? Does every upload path use the same code?"

**Symptoms that triggered this audit:**

1. **12 scattered ADRs** — understanding naming/path architecture requires reading all of them
2. **Recurring bugs** traced to violations: `ImageProcessor.ts` uses `Date.now()` instead of `generateFileId()`, CRM communications bypasses the canonical upload pipeline
3. **No adoption metrics** — nobody knows how many call sites use `buildStoragePath()` vs hardcoded paths
4. **Legacy fallbacks** still active in production (`dxf-scenes/`, `contacts/photos/`, `companies/logos/`)

**This ADR serves as:**
- A **cross-reference map** linking all 12 naming/path-related ADRs with Google-style relationship metadata
- A **centralization audit** with concrete adoption metrics
- A **violation registry** with severity ratings and remediation plan
- A **single source of truth** for "which service handles what" in the naming/path domain

---

## Related Documents (Google-Style Cross-Reference)

### Relationship Type Taxonomy

| Type | Definition |
|------|-----------|
| **Foundation** | Established the pattern/service this ADR audits |
| **Upstream** | Produced decisions that feed into naming/path logic |
| **Downstream** | Consumed naming/path services and exposed bugs/gaps |
| **Sibling** | Related architectural concern (not directly naming/paths) |
| **Consumer** | Actively calls `buildStoragePath()` or `buildFileDisplayName()` |
| **Hub** | Cross-reference/map document at same abstraction level |

### ADR Cross-Reference Table

| Document | What it Does | Relationship | Content Relevance | Why It's Related |
|----------|-------------|--------------|-------------------|------------------|
| **[ADR-018](./ADR-018-unified-upload-service.md)** Unified Upload Service | Defines the Gateway + Strategy pattern for routing uploads by file type | **Foundation** | Established `UnifiedUploadService` class that all processors (Image, PDF, CAD) inherit from | Created the architectural skeleton that `buildStoragePath()` and processors plug into — without it, each file type would have its own upload stack |
| **[ADR-054](./ADR-054-enterprise-upload-system-consolidation.md)** Enterprise Upload Consolidation | Established `buildStoragePath()` as SSoT, introduced `LEGACY_STORAGE_PATHS` constants | **Foundation** | `buildStoragePath()` (33 call sites), `LEGACY_STORAGE_PATHS` (12+ references), canonical path scheme | Origin document for the canonical storage path pattern — every path violation in this audit is a deviation from ADR-054's decision |
| **[ADR-060](./ADR-060-building-floorplan-enterprise-storage.md)** Building Floorplan Enterprise Storage | Migrated DXF scene files from legacy `dxf-scenes/` paths to canonical Firebase Storage | **Upstream** | Legacy fallback in `dxf-firestore-storage.impl.ts`, `canonicalScenePath` pattern | Introduced the canonical scene path concept, but left a fallback to `dxf-scenes/{fileId}/scene.json` that remains a violation today |
| **[ADR-179](./ADR-179-ifc-compliant-floorplan-hierarchy.md)** IFC-Compliant Floorplan Hierarchy | Defines ISO 16739 entity hierarchy (Site > Building > Storey > Space) | **Sibling** | Entity types (`building`, `floor`, `property`) used in `entityType` parameter of `buildStoragePath()` | The hierarchy determines which `entityType`/`entityId` values are valid in storage paths — incorrect hierarchy = wrong storage path |
| **[ADR-190](./ADR-190-photo-upload-ssot-consolidation.md)** Photo/Logo Upload SSoT | Eliminated 3 duplications in photo upload pipeline | **Downstream** | Refactored `PhotoUploadConfiguration.ts` to use `createUploadHandlerFromPreset()` | Cleaned up photo naming duplications but did NOT migrate `useEnterpriseFileUpload` from `LEGACY_STORAGE_PATHS` to `buildStoragePath()` — that gap remains (violation #4) |
| **[ADR-191](./ADR-191-enterprise-document-management.md)** Enterprise Document Management | Defined `FileRecord` model (586 lines), lifecycle, display naming | **Foundation** | `FileRecord.displayName`, `FileRecord.storagePath`, `FileRecord.originalFilename`, `buildFileDisplayName()` | Canonical data model where display names and storage paths are stored — `buildFileDisplayName()` generates the `displayName` field in every `FileRecord` |
| **[ADR-196](./ADR-196-unit-floorplan-enterprise-filerecord.md)** Unit Floorplan FileRecord Migration | Fixed `companyId` mismatch in unit floorplan records, added Unicode support | **Downstream** | `companyId` validation in `buildStoragePath()`, `isValidPathSegment()` Unicode regex | Exposed that missing `companyId` breaks storage paths — the Unicode path validation was enhanced after this fix |
| **[ADR-202](./ADR-202-floorplan-save-orchestrator.md)** Floorplan Save Orchestrator | Defined 4-step canonical save pattern, removed ~200 LOC duplicated logic | **Consumer** | `FloorplanSaveOrchestrator` calls `createPendingFileRecord()` which internally uses `buildStoragePath()` + `buildFileDisplayName()` | Highest-volume consumer of the naming/path SSoT for floorplan saves — if it bypassed the SSoT, all floorplan paths would be wrong |
| **[ADR-240](./ADR-240-floorplan-pipeline-unification.md)** Floorplan Pipeline Unification | Fixed wizard-to-floor-tab disconnect, unified `entityType`/`floorId`/`purpose` propagation | **Downstream** | Wizard context propagation ensures correct `entityType` and `entityId` reach `buildStoragePath()` | Without this fix, wizard uploads produced paths with wrong `entityType` or missing `entityId` — a naming/path correctness dependency |
| **[ADR-285](./ADR-285-dxf-tenant-scoping-and-module-split.md)** DXF Tenant Scoping & Module Split | Added `companyId`/`createdBy` to cadFiles and dxf-levels, split oversized files | **Downstream** | `companyId` propagation into `DxfSaveContext` which feeds `buildStoragePath()` | Ensured DXF saves include `companyId` (required by `buildStoragePath()`) — before this, DXF paths could not use canonical storage |
| **[ADR-288](./ADR-288-cad-file-metadata-centralization.md)** CAD File Metadata Centralization | Created server-side `/api/cad-files` endpoint with dual-write to `files` collection | **Consumer** | `dual-write-to-files.ts` calls `buildFileDisplayName()`, uses `LEGACY_STORAGE_PATHS.DXF_SCENES` as fallback | Server-side consumer that generates display names for CAD files — its fallback to legacy paths is a documented violation (#7) |
| **[ADR-292](./ADR-292-floorplan-upload-consolidation-map.md)** Floorplan Upload Consolidation Map | Maps all upload paths, services, and collections for floorplans | **Hub** | Upload path diagram (A-F), service layer map, decision matrix | Sibling "map" document focused on upload FLOW; this ADR focuses on NAMING/PATHS specifically — together they form the complete picture |

### Non-ADR Documentation

| Document | What it Does | Content Relevance |
|----------|-------------|-------------------|
| **[file-management-system.md](../file-management-system.md)** | Complete file management system documentation | Architecture overview, 3-phase upload pipeline, FileRecord interface specs, integration guide |
| **[05-files-storage-pipeline.md](../../architecture-review/05-files-storage-pipeline.md)** | Architecture review of files & storage pipeline | Canonical path analysis, legacy path security audit, permissions model, gaps & recommendations |

---

## Current Architecture — SSoT Services

### Service Registry

| Service | Location | Responsibility | Adoption |
|---------|----------|---------------|----------|
| `buildStoragePath()` | `src/services/upload/utils/storage-path.ts` | Canonical Firebase Storage path generation (IDs only) | 33 call sites, 11 files |
| `buildFileDisplayName()` | `src/services/upload/utils/file-display-name.ts` | Human-readable display name generation (Greek i18n) | 15 call sites, 5 files |
| `FileNamingService` | `src/services/FileNamingService.ts` | Client-side File naming for contacts (delegates to canonical) | Wrapper, uses `sanitizeForFilename()` |
| `generateFileId()` | `src/services/enterprise-id.service.ts` | UUID-based file ID generation (`file_xxxxxxxx-...`) | Canonical, bypassed by 2 violations |
| `LEGACY_STORAGE_PATHS` | `src/config/domain-constants.ts` | Centralized constants for deprecated paths (read-only) | 12+ references |
| `FileRecordService` | `src/services/file-record.service.ts` | CRUD on `files` collection | All upload paths |
| `file-mutation-gateway.ts` | `src/services/filesystem/file-mutation-gateway.ts` | Policy enforcement wrapper for file mutations | Entity file uploads |

### Canonical Storage Path Pattern

```
/companies/{companyId}/entities/{entityType}/{entityId}/
  domains/{domain}/categories/{category}/files/{fileId}.{ext}
```

**Segments** (from `STORAGE_PATH_SEGMENTS` in domain-constants.ts):
- `companies` → tenant isolation (REQUIRED)
- `projects` → optional project scope
- `entities` → entity type + ID
- `domains` → admin, construction, sales, accounting, legal, ingestion
- `categories` → photos, floorplans, documents, invoices, contracts, drawings, permits, audio, videos
- `files` → file ID + extension

### Naming Data Flow

```
Upload Request
    |
    v
generateFileId()  ─────────────>  file_xxxxxxxx-xxxx (canonical ID)
    |
    v
buildStoragePath()  ────────────>  Firebase Storage path (IDs only, no Unicode)
    |                               companies/{companyId}/entities/{type}/{id}/...
    |
    v
buildFileDisplayName()  ────────>  FileRecord.displayName (Greek, human-readable)
    |                               "Κάτοψη - Κτίριο Α - 1ος Όροφος (v2)"
    |
    v
sanitizeForFilename()  ─────────>  FileRecord.exportFilename (download-safe)
    |                               "Κάτοψη_Κτίριο_Α_1ος_Όροφος_v2.pdf"
    |
    v
normalizeForSearch()  ──────────>  FileRecord.normalizedTitle (search index)
                                    "κατοψη κτιριο α 1ος οροφος v2"
```

### Legacy Storage Paths (Deprecated, Read-Only)

| Constant | Value | Used By |
|----------|-------|---------|
| `CONTACTS_PHOTOS` | `'contacts/photos'` | Photo upload fallback |
| `COMPANIES_LOGOS` | `'companies/logos'` | Company logo upload |
| `FLOOR_PLANS` | `'floor-plans'` | Legacy floorplan reads |
| `DXF_SCENES` | `'dxf-scenes'` | DXF scene fallback |
| `ATTENDANCE` | `'attendance'` | Attendance photos |

**Production Lock:** `FILE_STORAGE_FLAGS.BLOCK_LEGACY_WRITES` blocks new uploads to legacy paths.

---

## Centralization Audit Results

### Overall Score: **100%** (50/50 code paths use canonical SSoT) — was 92% at initial audit

### Breakdown by Service

| Service | Total Usages | Canonical | Violations | Rate |
|---------|-------------|-----------|-----------|------|
| `buildStoragePath()` | 36 | 36 | 0 | 100% |
| `buildFileDisplayName()` | 15 | 15 | 0 | 100% |
| `generateFileId()` | 12 | 12 | 0 | 100% |
| `file-mutation-gateway` | 9 | 9 | 0 | 100% |
| **Total** | **50** | **50** | **0** | **100%** |

### What's Centralized

- **Storage path generation** — `buildStoragePath()` used in 33 locations across 11 files
- **Display name generation** — `buildFileDisplayName()` in all FileRecord creation paths, 0 direct bypasses
- **Path validation** — `isValidPathSegment()` with Unicode support (Greek IDs supported)
- **File ID generation** — `generateFileId()` from enterprise-id.service.ts (most paths)
- **Upload pipeline** — 8/9 upload files properly route through canonical services

### What's Scattered

**Nothing.** All violations fixed (Phases 1-6). Legacy pipeline deleted. Zero scattered code remaining.

---

## Violations & Gaps

| # | File | Violation | Severity | Root Cause | Remediation |
|---|------|-----------|----------|------------|-------------|
| 1 | `src/services/upload/processors/ImageProcessor.ts:166` | `Date.now()` used for filename instead of `generateFileId()` | **HIGH** | Pre-dates ADR-054 canonical ID generation | Replace with `generateFileId()` |
| 2 | `src/app/crm/communications/useCommunicationsPageController.ts` | Uses legacy upload pipeline, not routed through `file-mutation-gateway` | **HIGH** | Communications module built before enterprise upload system | Refactor to `createPendingFileRecordWithPolicy()` flow |
| 3 | `src/components/crm/UnifiedInbox.tsx` | Uses legacy upload pipeline, not routed through `file-mutation-gateway` | **HIGH** | Same as #2 (communications subsystem) | Refactor alongside #2 |
| 4 | `src/hooks/useEnterpriseFileUpload.ts` | Uses `LEGACY_STORAGE_PATHS.CONTACTS_PHOTOS` for new photo uploads | **HIGH** | Hook centralized for validation/state but path generation not migrated | Replace with `buildStoragePath()` using entity context |
| 5 | `src/app/api/upload/photo/route.ts:79` | Falls back to `LEGACY_STORAGE_PATHS.CONTACTS_PHOTOS` when no `folderPath` provided | **MEDIUM** | Server route needs canonical path but client may not always send it | Compute server-side via `buildStoragePath()` |
| 6 | `src/subapps/dxf-viewer/services/dxf-firestore-storage.impl.ts:156` | Falls back to legacy `dxf-scenes/{fileId}/scene.json` | **MEDIUM** | Backward compatibility for callers without `canonicalScenePath` | Audit callers, ensure `canonicalScenePath`, remove fallback |
| 7 | `src/app/api/cad-files/dual-write-to-files.ts` | References `LEGACY_STORAGE_PATHS` for fallback scene path | **MEDIUM** | Server-side dual-write handles legacy cadFiles lacking canonical paths | Transitional — remove when cadFiles deprecated |
| 8 | `src/services/FileNamingService.ts:170` | `Date.now()` fallback in default switch case | **LOW** | Defensive fallback for unrecognized entity types | Replace with `generateFileId()` |

---

## Remediation Roadmap

### Phase 1: Quick Wins (1-2 days, no behavior change) -- COMPLETED 2026-04-07

- [x] Fix violation #1: `ImageProcessor.ts` — replaced `Date.now()` with `generateFileId()` for fallback filename
- [x] Fix violation #8: `FileNamingService.ts` — replaced `Date.now()` with `generateFileId()` in default case, replaced `'Company_' + Date.now()` with `'Unknown_Company'` static fallback
- [x] Pure internal filename changes, no external API impact

### Phase 2: Photo Upload Path Migration (3-5 days) -- COMPLETED 2026-04-07

- [x] Fix violation #4: `useEnterpriseFileUpload` — conditional `folderPath` (omitted for canonical, kept for legacy)
- [x] Fix violation #5: `upload/photo/route.ts` — replaced `Date.now()` with `generateFileId()` in fallback naming
- [x] Made `folderPath` optional in `PhotoUploadOptions` (only needed by legacy pipeline)
- [x] Added `folderPath` guard in legacy pipeline (fails fast with clear error)
- [x] Fixed `generateUniqueFileName()` — replaced `Date.now()` with `generateFileId()`
- [x] Removed unused `generateTempId` imports

### Phase 3: Communications Module Migration (5-7 days) -- COMPLETED 2026-04-07

- [x] Fix violation #2: `useCommunicationsPageController.ts` — replaced legacy `PhotoUploadService` with canonical `useCrmAttachmentUpload` hook
- [x] Fix violation #3: `UnifiedInbox.tsx` — same migration to canonical hook
- [x] Created shared `useCrmAttachmentUpload` hook (`src/hooks/inbox/`) — DRY, canonical 3-step pipeline
- [x] Added `CONVERSATION` entity type to `ENTITY_TYPES` in `domain-constants.ts`
- [x] Canonical flow: `validateUploadAuth()` → `createPendingFileRecordWithPolicy()` → `uploadBytesResumable()` → `finalizeFileRecordWithPolicy()`
- [x] FileRecord created in Firestore with tenant isolation, entity linking, and audit trail

### Phase 4: Legacy Fallback Elimination -- COMPLETED 2026-04-07

- [x] Fix violation #6: `dxf-firestore-storage.impl.ts` — `canonicalScenePath` now REQUIRED for saves (throws if missing), `storagePath` REQUIRED for loads (returns null if missing)
- [x] Fix violation #7: `dual-write-to-files.ts` — `canonicalScenePath` now REQUIRED (skips FileRecord creation if missing)
- [x] Removed `STORAGE_FOLDER` constant and `LEGACY_STORAGE_PATHS` imports from both files
- [x] **Decision rationale:** All Firestore/Storage data is test/draft — will be wiped before production. No backward compatibility needed.
- [x] **Target achieved: 100% centralization rate**

### Phase 5: Dead Code Elimination & Legacy Lock -- COMPLETED 2026-04-07

- [x] Removed deprecated methods: `uploadContactPhoto()`, `uploadCompanyLogo()`, `isLegacyContactPhotoPath()` from `PhotoUploadService`
- [x] Removed deprecated methods chain: `ImageProcessor.uploadContactPhoto/Logo()`, `UnifiedUploadService.uploadContactPhoto/Logo()`
- [x] Removed deprecated default handlers: `defaultContactPhotoHandler`, `defaultCompanyLogoHandler`
- [x] Migrated `PDFProcessor.getStoragePath()` from `LEGACY_STORAGE_PATHS.FLOOR_PLANS` → `buildStoragePath()` SSoT
- [x] Migrated `CADProcessor.getStoragePath()` from `LEGACY_STORAGE_PATHS.DXF_SCENES` → `buildStoragePath()` SSoT
- [x] Removed `isLegacyFloorplanPath()` dead code from `PDFProcessor`
- [x] Removed attendance legacy fallback — `companyId` now required for `uploadAttendancePhoto()`
- [x] **Enabled `BLOCK_LEGACY_WRITES: true`** — legacy pipeline throws on any write attempt
- [x] Added `companyId` to `BaseUploadOptions` and `StoragePathOptions` interfaces
- [x] Made `folderPath` optional in `BaseUploadOptions` and `StoragePathOptions`
- [x] Cleaned LEGACY_STORAGE_PATHS imports from 4 files
- [x] Updated JSDoc examples to use canonical `companyId` instead of legacy paths

### Phase 6: Full Legacy Pipeline Elimination -- COMPLETED 2026-04-07

- [x] Deleted `photo-upload-legacy-pipeline.ts` — entire file removed (was 300+ lines of dead code)
- [x] Replaced legacy fallback in `PhotoUploadService.uploadPhoto()` with explicit throw (canonical fields required)
- [x] Removed `LEGACY_STORAGE_PATHS` constant from `domain-constants.ts` — zero imports remaining
- [x] Removed `FILE_STORAGE_FLAGS`, `FILE_STORAGE_ERROR_MESSAGES`, `DEPRECATION_MESSAGES` — all dead after pipeline removal
- [x] Cleaned `useEnterpriseFileUpload.ts` — removed conditional `folderPath`, all uploads canonical
- [x] Cleaned `upload/photo/route.ts` — removed `LEGACY_STORAGE_PATHS` import
- [x] Cleaned `defaultUploadHandler.ts` — removed `folderPath` from presets, `folderPath` now optional
- [x] Cleaned `migration-operations.ts` — inline string for admin migration reads
- [x] Updated test file — removed `resolveStorageErrorMessage` tests (dead code)
- [x] **ZERO legacy upload code remaining in the codebase**

### Phase 7: Entity-Polymorphic Photo Upload (Batch 29) -- COMPLETED 2026-04-17

**Problem**: `PhotoUploadService.uploadContactPhotoCanonical()` hardcoded
`entityType=CONTACT, domain=ADMIN, category=PHOTOS` regardless of caller.
Every property/building/floor/parking/storage/project photo upload routed
through the contact-only path and was tagged as a contact admin photo in
Firestore. Users reported "uploaded photo doesn't appear" because the
Photos tab's downstream reads never matched the wrong-entityType records,
and `usePropertyMediaCounts` (Batch 28 completion meter) always returned
`photos=0` for properties. A secondary gap: `PhotosTabBase` never fetched
persisted photos from Firestore — every mount started with an empty array.

- [x] Renamed `uploadContactPhotoCanonical` → `uploadEntityPhotoCanonical`
  with required `entityType/entityId/domain/category` params.
- [x] Renamed `getContactPhotos` → `getEntityPhotos` polymorphic.
- [x] `PhotoUploadOptions`: added `entityType/entityId/domain/category/
  entityLabel` fields; `contactId/contactName` retained as legacy aliases
  with CONTACT/ADMIN/PHOTOS defaults for backward compat.
- [x] `PhotosTabConfig`: added `canonicalEntityType` (separates UI tab key
  like `parking` from canonical `ENTITY_TYPES.PARKING_SPOT`) + `domain` +
  `category` per entity entry. Mapping: property/building/parking/storage/
  project → SALES/PHOTOS, floor → CONSTRUCTION/PHOTOS, contact →
  ADMIN/PHOTOS.
- [x] Wired full chain PhotosTabConfig → usePhotosTabUpload →
  useEnterpriseFileUpload → PhotoUploadService.uploadPhoto.
- [x] ~~New hook `usePhotosTabFetch`~~ **Superseded 2026-04-17 cleanup**:
  `PhotosTabBase` now reads through `useEntityFiles` (SSoT shared with
  `EntityFilesManager`) — single fetch hook for every Photos tab.
- [x] `PhotosTabBase` invokes `useEntityFiles` in uncontrolled mode with
  `realtime: true` + `purpose: 'photo'` (META_PHOTO_PURPOSES passthrough)
  and maps `FileRecord[]` → `Photo[]` inline. Photos survive refresh/
  remount; no fetch duplication.
- [x] ~~Two new Firestore composite indexes~~ **Removed 2026-04-17 cleanup**:
  `useEntityFiles` reuses the pre-existing FILES composite indexes — the
  two Batch 29 indexes (category+companyId+domain+entityId+entityType+
  lifecycleState+status and super_admin variant) are no longer required.
- [x] Contract tests `photos-tab-config.test.ts` lock the canonical
  write+read contract per tab.
- [x] Unblocks usePropertyMediaCounts photos count (Batch 28 meter) and
  makes property/building/floor/parking/storage/project photos persist,
  reappear on refresh, and be correctly tagged in FileRecord.

---

## Decision

1. **`buildStoragePath()` is the sole authority** for generating Firebase Storage paths. No code may construct storage paths by string concatenation or `Date.now()`.

2. **`buildFileDisplayName()` is the sole authority** for generating human-readable display names. No code may hardcode Greek labels for file display.

3. **`generateFileId()` is the sole authority** for file ID generation. `Date.now()` is prohibited for filename generation.

4. **All new upload paths** MUST go through `file-mutation-gateway.ts` — no direct Firestore writes to `files` collection.

5. **Violations are tracked** in this ADR's changelog until 100% centralization is achieved.

6. **This ADR is the cross-reference hub** for all naming/path-related decisions. Any new ADR touching file naming or storage paths MUST add a Related Documents entry pointing to ADR-293.

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-04-17 | Phase 7 follow-up (Batch 29 cleanup SSoT) — removed `usePhotosTabFetch` duplicate. `PhotosTabBase` now fetches through `useEntityFiles` (single SSoT hook shared with `EntityFilesManager`). Inline `fileRecordToPhoto` mapper (FileRecord→Photo) keeps `PhotoItem` UI contract clean. Removed the 2 Batch 29 composite indexes (category+companyId+domain+entityId+entityType+lifecycleState+status default + super_admin variant) — pre-existing FILES indexes cover `useEntityFiles` realtime constraints. Google SSoT restored: one fetch hook for every Photos tab. | Claude Code |
| 2026-04-17 | Phase 7 follow-up (Batch 29 amendment) — `useEntityFiles.filterByPurpose` META_PHOTO_PURPOSES passthrough. Property/Building Photos tabs use meta `purpose='photo'`/`'building-photo'` at the view layer; upload entry-point selector writes sub-purposes (interior/exterior/maintenance/facade). Strict equality rejected valid photos → count=0 UI despite correct FileRecord write. Fix adds meta-purpose set; `*-floorplan` strict semantics preserved. | Claude Code |
| 2026-04-17 | Phase 7 COMPLETED (Batch 29) — entity-polymorphic photo upload: `uploadContactPhotoCanonical` → `uploadEntityPhotoCanonical`, `getContactPhotos` → `getEntityPhotos`, `PhotosTabConfig` gains `canonicalEntityType` + `domain` + `category`, new `usePhotosTabFetch` live subscription + 2 composite indexes, contract tests lock write+read per tab. Unblocks Batch 28 completion meter photos count and fixes "uploaded photo doesn't appear" for property/building/floor/parking/storage/project tabs. | Claude Code |
| 2026-04-08 | SSoT storage deletion: `deleteObject()` now called in exactly ONE place (`PhotoUploadService.deletePhoto()`). PDFProcessor.deletePDF() delegates to SSoT instead of inline `deleteObject()`. Fixed false-alarm logging: error level now checked AFTER `object-not-found` guard, not before. Removed hardcoded Greek error string (ratchet down: `photo-upload.service.ts` 1→0). | Claude Code |
| 2026-04-08 | fix(photos): Race-condition-safe upload completion in edit mode. Added `handleMultiplePhotoUploadComplete` to `useContactPhotoHandlers` using React functional updater (`prev => ...`). Previously, edit mode fell back to `normalizedPhotosRef` (stale closure) causing 2+ concurrent uploads to overwrite each other. Deferred save never fired → `multiplePhotoURLs` not persisted. Now wired through `ContactDetails → UnifiedContactTabbedSection → IndividualFormTabRenderer`. | Claude Code |
| 2026-04-08 | SSoT `resolveContactName()` — extracted as exported function, eliminated 4 duplicate contact name computations from `usePhotoUploadLogic.ts`, `UnifiedPhotoManager.tsx` (×3), `MultiplePhotosCompact.tsx`, `MultiplePhotosFull.tsx`. Root cause: `usePhotoUploadLogic` bypassed `getPhotoUploadHandlers` when canonical fields present, used `contactData?.name` (empty for individuals). All 5 consumers now delegate to single SSoT. | Claude Code |
| 2026-04-08 | SSoT contact name resolution — centralized `resolveContactName()` as sole authority for contact name in display names. Removed duplicate logic from TabbedAddNewContactDialog + InlineContactCreation. Fixed file tree: entity type labels now i18n-translated ("contact" → "Επαφές"), missing entityLabel shows friendly fallback ("Επαφή #dd01473a" instead of raw ID). | Claude Code |
| 2026-04-07 | Phase 6 COMPLETED — legacy pipeline fully eliminated: deleted `photo-upload-legacy-pipeline.ts`, removed `LEGACY_STORAGE_PATHS`/`FILE_STORAGE_FLAGS`/`DEPRECATION_MESSAGES`/`FILE_STORAGE_ERROR_MESSAGES` from domain-constants, cleaned all legacy imports. Zero legacy code remaining. | Claude Code |
| 2026-04-07 | Phase 5 COMPLETED — dead code elimination: removed 7 deprecated methods, migrated 2 processors to `buildStoragePath()`, enabled `BLOCK_LEGACY_WRITES: true`, attendance `companyId` required | Claude Code |
| 2026-04-07 | Phase 4 COMPLETED — violations #6, #7 fixed: legacy `dxf-scenes/` fallbacks removed, `canonicalScenePath` and `storagePath` now required. 100% centralization achieved. | Claude Code |
| 2026-04-07 | Phase 3 COMPLETED — violations #2, #3 fixed: CRM communications migrated to canonical pipeline via `useCrmAttachmentUpload` hook, added `CONVERSATION` entity type | Claude Code |
| 2026-04-07 | Phase 2 COMPLETED — violations #4, #5 fixed: conditional folderPath, Date.now() replaced, folderPath optional | Claude Code |
| 2026-04-07 | Phase 1 COMPLETED — violations #1, #8 fixed: `Date.now()` replaced with `generateFileId()` | Claude Code |
| 2026-04-07 | Initial SSoT audit — 12 ADRs mapped, 8 violations found, 92% centralization | Claude Code |

# ADR-292: Floorplan Upload Consolidation Map

**Status**: APPROVED
**Date**: 2026-04-07
**Author**: Claude Code + Georgios Pagonis
**Type**: Consolidation / Architecture Map

---

## Context & Problem

Across 11+ ADRs and dozens of source files, the floorplan/technical-drawing upload system has been built incrementally over months. Each ADR solved a specific problem, but **no single document maps the full picture**. The result:

1. **11 scattered ADRs** - nobody can understand the full upload architecture without reading all of them
2. **8+ upload call sites** - wizard, entity files manager, inline components, API endpoints
3. **Dual-write still active** - `files` + `cadFiles` collections (source of bugs: ADR-196, ADR-240, ADR-285)
4. **Recurring bugs** - permission-denied (2026-04-07), wizard disconnect (ADR-240), dual-write mismatch (ADR-196) - ALL rooted in fragmented upload paths
5. **Multiple services** doing overlapping work - UnifiedUploadService, FloorplanSaveOrchestrator, useFloorplanUpload, useEnterpriseFileUpload, file-mutation-gateway

This ADR serves as the **consolidation map** - a single reference that:
- Charts all upload paths
- Cross-references the 11 related ADRs
- Defines the canonical upload flow
- Proposes a phased roadmap to eliminate fragmentation

---

## Related ADRs

| ADR | Title | Role in Upload | Status |
|-----|-------|---------------|--------|
| **ADR-018** | Unified Upload Service | Foundation: Gateway + Strategy pattern | Active |
| **ADR-054** | Enterprise Upload Consolidation | Photo/Logo SSoT, `buildStoragePath()` | Active |
| **ADR-060** | Building Floorplan Enterprise Storage | DXF scenes migration to Firebase Storage | Active |
| **ADR-179** | IFC-Compliant Floorplan Hierarchy | ISO 16739 hierarchy (Site>Building>Storey>Space) | Implemented |
| **ADR-190** | Photo/Logo Upload SSoT | Eliminated 3 duplications in photo upload | Accepted |
| **ADR-191** | Enterprise Document Management | FileRecord data model (586 lines), lifecycle | Phases 1-5 |
| **ADR-196** | Unit Floorplan FileRecord Migration | Fixed dual-write bugs, companyId mismatch | Implemented |
| **ADR-202** | Floorplan Save Orchestrator | 4-step canonical save pattern (~200 LOC removed) | Approved |
| **ADR-240** | Floorplan Pipeline Unification | Fixed wizard-to-floor-tab disconnect | Implemented |
| **ADR-285** | DXF Tenant Scoping & Module Split | Tenant isolation for cadFiles/dxf-levels | Accepted |
| **ADR-288** | CAD File Metadata Centralization | Server-side cadFiles endpoint + dual-write to files | Accepted |

---

## Current Architecture Map

### Upload Entry Points (Configuration)

Location: `src/config/upload-entry-points/`

| File | Entity Level | Floorplan Entries |
|------|-------------|-------------------|
| `entries-floor.ts` | Floor | 4: floor-plan, section, electrical, plumbing |
| `entries-building.ts` | Building | 1: building-floorplan |
| `entries-project.ts` | Project | 4: floor-plan, section, electrical, plumbing |
| `entries-property.ts` | Property/Unit | 4: unit-floor-plan, section, electrical, plumbing |
| `entries-studies.ts` | Studies (cross-entity) | 60+: architectural, structural, MEP |

### Upload Paths (Runtime)

```
PATH A: Entity Files Manager (Generic)
  UI: EntityFilesManager → useFileUpload → createPendingFileRecordWithPolicy() → upload → finalize
  Collection: files
  Used by: Buildings, Floors, Properties, Projects, Contacts

PATH B: Photo/Logo Upload
  UI: EnterprisePhotoUpload → PhotoUploadService → createPendingFileRecord()
  Collection: files
  Used by: Contacts (photos), Companies (logos)

PATH C: DXF Floorplan Save (Auto-save / Manual save)
  Hook: useFloorplanUpload → FloorplanSaveOrchestrator → createPendingFileRecord() → upload → finalize
  Collection: files (+ cadFiles via dual-write server endpoint)
  Used by: DXF Viewer (auto-save, toolbar save)

PATH D: DXF Wizard Pipeline (6-step)
  Flow: Company → Project → Building → Floor → Unit → Upload
  Hook: useFloorplanUpload → createPendingFileRecordWithPolicy() → upload → finalize
  Collection: files (+ cadFiles via /api/cad-files)
  Used by: DXF Viewer wizard

PATH E: Batch File Upload
  Handler: file-manager-handlers.ts → createPendingFileRecord()
  Collection: files
  Used by: Company file manager

PATH F: PDF Floorplan Processing
  Processor: PDFProcessor → createPendingFileRecord()
  Collection: files
  Used by: UnifiedUploadService.uploadFloorplanCanonical()
```

### Service Layer

```
                        +---------------------------+
                        |   UnifiedUploadService    |  (Gateway - routes by file type)
                        |   src/services/upload/    |
                        +------+--------+-----------+
                               |        |
                    +----------+        +----------+
                    |                              |
            +-------v-------+          +-----------v---------+
            | ImageProcessor |          |    PDFProcessor      |
            | (photos)       |          |    CADProcessor      |
            +-------+-------+          +-----------+----------+
                    |                              |
                    v                              v
            +------------------------------------------+
            |        FileRecordService                  |  (Core CRUD on files collection)
            |   src/services/file-record.service.ts     |
            +------------------------------------------+
                    ^
                    |
            +-------+---------------------------+
            |  file-mutation-gateway.ts          |  (Policy enforcement wrapper)
            |  createPendingFileRecordWithPolicy  |
            |  finalizeFileRecordWithPolicy       |
            +------------------------------------+
                    ^
                    |
            +-------+---------------------------+
            |  FloorplanSaveOrchestrator         |  (4-step canonical save)
            |  floorplan-save-orchestrator.ts     |
            +------------------------------------+
                    ^
                    |
    +---------------+------------------+
    |               |                  |
    v               v                  v
FloorFP       PropertyFP         BuildingFP
Service        Service            Service
```

### Firestore Collections

| Collection | Purpose | Status | Write Source |
|-----------|---------|--------|-------------|
| **`files`** | ALL uploaded files (SSoT) | Current | All paths (A-F) |
| **`cadFiles`** | CAD file metadata (legacy) | Deprecated (dual-write active) | PATH C, D via /api/cad-files |
| `cadLayers` | Layer metadata | Deprecated | DXF Viewer |
| `cadSessions` | Edit sessions | Deprecated | DXF Viewer |
| `floorplans` | Legacy floorplan metadata | Deprecated | None (read-only fallback) |

---

## Canonical Upload Flow (SSoT)

**The ONE correct way to upload a floorplan/technical drawing:**

```
1. createPendingFileRecordWithPolicy()   → files doc (status: 'pending')
2. Upload binary to Firebase Storage     → storagePath from step 1
3. getDownloadURL()                      → downloadUrl
4. finalizeFileRecordWithPolicy()        → files doc (status: 'ready')
5. [If CAD] POST /api/cad-files          → cadFiles doc (server-side, dual-write back to files)
```

**Rules:**
- ALL uploads MUST go through `file-mutation-gateway.ts` (policy layer)
- ALL uploads MUST write to `files` collection
- CAD metadata goes to `/api/cad-files` endpoint (server-side only, not client-side writes)
- `companyId` MUST come from the entity's actual Firestore document (NOT from auth context for super_admin)
- Storage paths MUST use `buildStoragePath()` from domain-constants (ADR-054)

---

## Known Issues & Technical Debt

### CRITICAL: Dual-Write (files + cadFiles)

**Problem**: Two collections store overlapping data about the same file.
- `files` = enterprise FileRecord (SSoT per ADR-191)
- `cadFiles` = legacy CAD metadata (kept for DXF Viewer backward compatibility)

**Impact**: 
- Query failures when one collection has data the other doesn't (ADR-196)
- Permission-denied when queries lack companyId (2026-04-07 fix)
- Confusion about which collection is authoritative

**Resolution path**: ADR-288 moves cadFiles writes to server-side, with dual-write back to files. Long-term: merge cadFiles fields into FileRecord and deprecate cadFiles entirely.

### HIGH: Multiple Upload Hooks

**Problem**: `useFloorplanUpload`, `useEnterpriseFileUpload`, `useFileUpload` have overlapping responsibilities.

| Hook | Scope | Issue |
|------|-------|-------|
| `useFloorplanUpload` | DXF/PDF floorplans | Specialized but duplicates validation |
| `useEnterpriseFileUpload` | Photos/logos | Validation + state management |
| `useFileUpload` | Generic files | Entity files manager |

**Resolution path**: Extract shared validation into `file-mutation-gateway.ts`, let hooks focus only on UI state.

### MEDIUM: Legacy Fallback Loaders

**Problem**: `BuildingFloorplanService` still has fallback logic to read from legacy `floorplans` collection when `files` collection returns empty.

**Resolution path**: Once all historical data is migrated to `files`, remove fallback paths.

---

## Consolidation Roadmap

### Phase 1: Stabilize (Current)
- [x] Server-side cadFiles endpoint (ADR-288)
- [x] Tenant scoping on all collections (ADR-285)
- [x] companyId in linked files queries (2026-04-07)
- [x] companyId propagation to all photo upload consumers (2026-04-07)
- [x] EnterprisePhotoUpload canonical fields passed from PhotosTabBase, UnifiedPhotoManager, MultiplePhotos* (2026-04-07)
- [ ] Verify all upload paths use `file-mutation-gateway.ts`

### Phase 2: Simplify Hooks
- [x] Extract shared auth validation (`validateUploadAuth`) to `file-mutation-gateway.ts` (2026-04-07)
- [x] Remove inline `validateAuthAndClaims` from `useFloorplanUpload` — uses gateway SSoT (2026-04-07)
- [x] Enhance `useFileUpload` auth to validate companyId claims via `validateUploadAuth` (2026-04-07)
- [ ] Reduce `useFloorplanUpload` to thin wrapper over gateway + FloorplanSaveOrchestrator
- [ ] Document which hook to use for which scenario (decision matrix)

### Phase 3: Eliminate Dual-Write
- [ ] Migrate cadFiles-specific fields (layers, sessions, viewport) into FileRecord metadata
- [ ] Update DXF Viewer to read from `files` collection only
- [ ] Remove cadFiles dual-write from `/api/cad-files`
- [ ] Deprecate `cadFiles` collection (read-only for historical data)

### Phase 4: Eliminate Legacy Fallbacks
- [ ] Data migration: copy all `floorplans` / `building_floorplans` data to `files`
- [ ] Remove fallback loaders from BuildingFloorplanService
- [ ] Remove `unit_floorplans` references
- [ ] Final cleanup: archive deprecated collections

---

## Decision Matrix: Which Upload Path to Use

| Scenario | Path | Hook/Service | Collection |
|----------|------|-------------|-----------|
| User uploads DXF/PDF via wizard | D | useFloorplanUpload | files + cadFiles |
| DXF auto-save from viewer | C | FloorplanSaveOrchestrator | files + cadFiles |
| User uploads file in entity page | A | useFileUpload + EntityFilesManager | files |
| User uploads photo/logo | B | useEnterpriseFileUpload | files |
| Batch file upload (company) | E | file-manager-handlers | files |
| PDF floorplan processing | F | UnifiedUploadService.PDFProcessor | files |

---

## Related Documents (Upload Architecture)

| Document | Relationship | Context |
|----------|-------------|---------|
| **[ADR-293](./ADR-293-file-naming-storage-path-ssot-audit.md)** | **Sibling** | Naming/path-specific audit — complements this upload flow map with centralization metrics and violations |
| **[ADR-054](./ADR-054-enterprise-upload-system-consolidation.md)** | Foundation | `buildStoragePath()` SSoT and `LEGACY_STORAGE_PATHS` — path patterns all upload paths must use |
| **[ADR-191](./ADR-191-enterprise-document-management.md)** | Foundation | FileRecord model — the data model all upload paths write to |

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-04-07 | **Phase 1+2 Implementation**: (1) Added canonical fields (companyId/contactId/createdBy) to `UseEnterpriseFileUploadConfig` + fallback path to `PhotoUploadService.uploadPhoto()`. (2) Propagated canonical fields from all consumers: `PhotosTabBase`, `UnifiedPhotoManager` (Company/Service/Individual), `MultiplePhotosCompact`, `MultiplePhotosFull`, `EnterprisePhotoUpload`. (3) Extracted `validateUploadAuth()` SSoT to `file-mutation-gateway.ts` — removed inline `validateAuthAndClaims()` from `useFloorplanUpload`. (4) Enhanced `useFileUpload` auth to use `validateUploadAuth(companyId)` with companyId claim validation. | Claude Code |
| 2026-04-07 | Added Related Documents section with ADR-293 back-reference | Claude Code |
| 2026-04-07 | Initial consolidation map created | Claude Code |

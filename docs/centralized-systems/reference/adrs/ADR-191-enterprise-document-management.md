# ADR-191: Enterprise Document Management System

| Metadata | Value |
|----------|-------|
| **Status** | PHASES_1-5_COMPLETE |
| **Date** | 2026-03-09 |
| **Category** | File Management / Document Governance |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

Τεκμηρίωση του Enterprise Document Management System της εφαρμογής Nestor:
1. **Τρέχουσα κατάσταση** — τι έχει υλοποιηθεί (Phase 1)
2. **Enterprise roadmap** — τι θέλουμε να χτίσουμε (Phases 2-5)
3. **Σταδιακή υλοποίηση** — πώς θα φτάσουμε εκεί με ασφάλεια

Πρότυπα αναφοράς: SAP DMS, Google Workspace Drive, Procore Document Management.

---

## Section 1: Current State (Phase 1 — COMPLETED)

### 1.1 Core Data Model

**FileRecord** (`src/types/file-record.ts` — 586 lines)

Πλήρες Firestore document contract με:
- **Core fields**: id, companyId, projectId, entityType, entityId
- **Classification**: domain, category, classification (`public` / `internal` / `confidential`)
- **Storage**: storagePath (IDs only — ποτέ direct URLs), downloadUrl
- **Display**: displayName (Greek/multilingual), originalFilename, description
- **Lifecycle**: status, lifecycleState (`active` → `trashed` → `archived` → `purged`)
- **Ingestion tracking**: source metadata (telegram/email/whatsapp/web-form/api), fileUniqueId dedup
- **Processed data caching**: FloorplanProcessedData (DXF/PDF parse cache σε Storage)
- **Entity linking**: linkedTo array για cross-entity file references
- **Trash system**: trashedAt, trashedBy, purgeAt, retentionUntil, hold (3-tier lifecycle)
- **Audit fields**: createdAt, createdBy, classifiedAt, classifiedBy, originalIngestionPath

**Firestore collection**: `files`

### 1.2 UI Components

| Component | Location | Responsibility |
|-----------|----------|----------------|
| **EntityFilesManager** | `src/components/shared/files/EntityFilesManager.tsx` | Central orchestrator — view modes, CRUD, linking |
| **FilesList** | `src/components/shared/files/FilesList.tsx` | Enterprise list with multi-select, inline edit, delete confirm |
| **GroupedFilesList** | `src/components/shared/files/GroupedFilesList.tsx` | Category/purpose grouping |
| **FilePathTree** | `src/components/shared/files/FilePathTree.tsx` | Hierarchical tree view |
| **BatchActionsBar** | `src/components/file-manager/BatchActionsBar.tsx` | Multi-select batch operations |
| **FileManagerPageContent** | `src/components/file-manager/FileManagerPageContent.tsx` | Full-page file manager |
| **CompanyFileTree** | `src/components/file-manager/CompanyFileTree.tsx` | Company-level hierarchical tree |
| **FilePreviewPanel** | `src/components/file-manager/FilePreviewPanel.tsx` | Split-panel preview |
| **PdfCanvasViewer** | `src/components/file-manager/PdfCanvasViewer.tsx` | PDF viewer (pdfjs-dist canvas) |

### 1.3 PDF Viewer Features

- **Library**: pdfjs-dist@4.5.136 με self-hosted worker
- **Zoom**: Mouse wheel zoom (scale 0.25–5.0)
- **Pan**: Click-drag panning
- **Fit**: Fit-to-width scaling
- **Navigation**: Page prev/next
- **Rotation**: 90° increments
- **Fullscreen**: Toggle support
- **Theme**: Dark/light mode aware

### 1.4 Batch Operations

- **Multi-select**: Checkbox selection σε FilesList
- **Batch delete**: Move selected to trash (soft-delete)
- **Batch download**: Server-side ZIP creation + download
- **Batch classify**: Apply classification (public/internal/confidential) σε επιλεγμένα

### 1.5 Data Classification

- **Τύποι**: `public` / `internal` / `confidential`
- **Default**: `internal`
- **Pattern**: SAP/Google-inspired — classification badges με color coding
- **Batch**: Μαζική αλλαγή classification μέσω BatchActionsBar
- **Visual**: Badges — confidential (κόκκινο), public (πράσινο), internal (χωρίς badge)

### 1.6 Search

- **Accent-insensitive**: NFD normalization για ελληνικά (π.χ. "αρχειο" βρίσκει "αρχείο")
- **Client-side**: Filter σε loaded documents
- **Scope**: displayName, originalFilename, description

### 1.7 Server-Side ZIP

**Endpoint**: `POST /api/files/batch-download`

- **Native implementation**: Node.js zlib (deflateRawSync) — zero external dependencies
- **ZIP format**: Local file headers + Central Directory + EOCD
- **UTF-8 support**: Bit 11 flag για Greek filenames
- **Security**: Firebase Storage URL validation only, withAuth protection
- **Limits**: Max 50 files per batch, maxDuration 60s
- **Resilience**: Partial success (Promise.allSettled — some files fail, rest proceed)

### 1.8 File Lifecycle

```
active → trashed → archived → purged
         ↑                      ↑
    soft-delete           auto-purge
    (reversible)        (after retention)
```

- **Soft delete**: trashedAt, trashedBy timestamps
- **Retention**: retentionUntil, purgeAt fields
- **Hold**: Legal/compliance hold prevents purge

### 1.9 Upload Infrastructure

- **Entry points**: 7 upload entry points (UploadEntryPointSelector, HierarchicalEntryPointSelector)
- **Service**: FileRecordService (`src/services/file-record.service.ts`)
- **Hooks**: useFileUploads, useUploadCompletion, useMemoryCleanup
- **Utilities**: buildStoragePath, generateFileId, getFileExtension, buildFileDisplayName
- **Multi-tenancy**: WorkspaceContext isolation per company

### 1.10 Media Gallery

- **MediaGallery**: Grid/gallery view for images
- **MediaCard**: Individual media display
- **FloorplanGallery**: DXF/PDF floorplan gallery
- **VideoPlayer**: Embedded video playback

### 1.11 Related ADRs

| ADR | Title | Relevance |
|-----|-------|-----------|
| ADR-031 | Canonical File Storage System | FileRecord + Firebase Storage separation |
| ADR-032 | Enterprise Trash System | 3-tier lifecycle with retention/holds |
| ADR-033 | Floorplan Processing Pipeline | DXF/PDF caching |
| ADR-055 | Enterprise Attachment Ingestion | Source tracking + AI classification |

---

## Section 2: Enterprise Roadmap (Phases 2-5)

### Phase 2: Document Intelligence (MOSTLY COMPLETE — 2026-03-09)

| Feature | Status | Files |
|---------|--------|-------|
| **2.1 Thumbnail generation** | ✅ Done | `src/components/shared/files/utils/generate-upload-thumbnail.ts`, `src/components/shared/files/FileThumbnail.tsx`, `src/components/shared/files/hooks/usePdfThumbnail.ts` |
| **2.2 AI auto-classification** | ✅ Done | `src/components/shared/files/hooks/useFileClassification.ts`, `src/app/api/files/classify/route.ts` |
| **2.3 File versioning** | ✅ Done | `src/services/file-version.service.ts`, `src/components/shared/files/VersionHistory.tsx` |
| **2.4 Full-text search** | ⏸️ Pending | Requires Algolia/Meilisearch external service |

**Λεπτομέρειες υλοποίησης:**

- **Thumbnail generation**: Dual approach — (1) Persistent thumbnails at upload time via OffscreenCanvas (images→300px resize, PDFs→page 1 render), stored as WebP in Firebase Storage alongside originals. (2) On-demand client-side thumbnails via `usePdfThumbnail` hook for PDFs not yet thumbnailed. `FileThumbnail` component handles priority: pre-existing URL → PDF generation → image direct → file type icon.
- **AI auto-classification**: Fire-and-forget call to `/api/files/classify` after every upload finalize. OpenAI gpt-4o-mini vision classifies document type (invoice, contract, permit, photo, etc.). Also available as manual batch operation via BatchActionsBar. Results stored in `ingestion.analysis` field.
- **File versioning**: Firestore subcollection `files/{fileId}/versions`. `FileVersionService` (create/history/rollback). `VersionHistory` UI component in FilePreviewPanel with download per version and reversible rollback.

### Phase 3: Governance & Compliance (✅ COMPLETED — 2026-03-09)

| Feature | Status | Files |
|---------|--------|-------|
| **3.1 Audit trail** | ✅ Done | `src/services/file-audit.service.ts`, `src/components/shared/files/AuditLogPanel.tsx` |
| **3.2 Retention policies** | ✅ Done | `src/app/api/files/archive/route.ts`, `src/app/api/files/purge/route.ts`, `src/app/api/cron/file-purge/route.ts` |
| **3.3 Approval workflows** | ✅ Done | `src/services/file-approval.service.ts`, `src/components/shared/files/ApprovalPanel.tsx` |
| **3.4 Watermarking** | ✅ Done | `src/app/api/files/watermark/route.ts` (pdf-lib, MIT) |
| **3.5 GDPR compliance** | ✅ Done | `src/app/api/files/gdpr-export/route.ts`, `src/app/api/files/gdpr-delete/route.ts` |

**Λεπτομέρειες υλοποίησης:**

- **Audit trail**: Firestore `file_audit_log` collection, real-time events (view/download/modify/share/classify), UI panel με advanced filters (date range, action type, user)
- **Retention**: Cron endpoint (`/api/cron/file-purge`) checks `purgeAt` dates, `archive` API για manual archiving, batch archive via BatchActionsBar
- **Approval workflows**: Sequential multi-step chains (submitted → reviewed → approved), real-time Firestore subscription, approve/reject with reason, cancel support. Firestore `file_approvals` collection
- **Watermarking**: Server-side diagonal text watermark via pdf-lib, configurable opacity/fontSize, A4 pages
- **GDPR**: Article 17 (Right to Erasure) — respects legal holds, anonymizes audit logs, requires confirmation phrase. Article 20 (Data Portability) — exports files, audit log, comments, shares as JSON

### Phase 4: Advanced UX (✅ COMPLETED — 2026-03-09)

| Feature | Status | Files |
|---------|--------|-------|
| **4.1 Document templates** | ✅ Done | `src/services/document-template.service.ts`, `src/components/shared/files/DocumentTemplatePanel.tsx` |
| **4.2 External sharing** | ✅ Done | `src/services/file-share.service.ts`, `src/components/shared/files/ShareDialog.tsx`, `src/app/shared/[token]/page.tsx` |
| **4.3 Inline comments** | ✅ Done | `src/services/file-comment.service.ts`, `src/components/shared/files/CommentsPanel.tsx` |
| **4.4 Virtual folders** | ✅ Done | `src/services/file-folder.service.ts`, `src/components/shared/files/FolderManager.tsx` |
| **4.5 Advanced filters** | ✅ Done | `src/components/core/AdvancedFilters/configs.ts` (audit log filters) |

**Λεπτομέρειες υλοποίησης:**

- **Document templates**: Template CRUD with variable interpolation (`{{variable}}`), category-based organization, HTML preview, copy-to-clipboard. Firestore `document_templates` collection
- **External sharing**: Expiring links με token-based access, public page `/shared/[token]`, download count tracking, link deactivation. Firestore `file_shares` collection
- **Inline comments**: Threaded comments (parent-child with `parentId`), real-time Firestore subscription (`onSnapshot`), reply/edit/delete/resolve, Ctrl+Enter submit. Firestore `file_comments` collection
- **Virtual folders**: Flat Firestore collection with `parentId` for tree structure, drag-and-drop files between folders (HTML5 `dataTransfer`), 7 color options, nested folders, batch file moves. Firestore `file_folders` collection
- **Advanced filters**: Date range, action type, user filter for audit log panel

### Phase 5: Enterprise Integration (PARTIAL — 2026-03-09)

| Feature | Status | Files |
|---------|--------|-------|
| **5.1 myDATA/AADE** | ⏸️ Pending | Requires AADE credentials |
| **5.2 PDF generation** | ✅ Done | `src/app/api/files/generate-pdf/route.ts` (pdf-lib, MIT) |
| **5.3 Per-document ACL** | ⏸️ Pending | Requires RBAC redesign |
| **5.4 Webhook notifications** | ✅ Done | `src/app/api/files/webhook/route.ts` |
| **5.5 Storage abstraction** | ⏸️ Pending | Requires cloud account (S3/Azure) |

**Λεπτομέρειες υλοποίησης:**

- **PDF generation**: Server-side HTML-to-PDF via pdf-lib (MIT), A4 format, word-wrap, title support, Helvetica/HelveticaBold fonts. Endpoint: `POST /api/files/generate-pdf`
- **Webhook notifications**: Webhook registry in Firestore `file_webhooks`, GET/POST/DELETE endpoints, 8 event types (file.created/updated/deleted/approved/rejected/shared/commented/moved), URL validation, secret management (never exposed in GET)

---

## Section 3: Architectural Prohibitions

### 3.1 Security Prohibitions

| Rule | Rationale |
|------|-----------|
| **No client-side ZIP creation** | Server-side only — security (URL validation) + performance (streaming) |
| **No direct Firebase Storage URLs to client** | Proxy via `/api/download` — audit trail + access control |
| **No file operations without auth** | Every endpoint uses withAuth middleware |
| **No Firebase Storage URL in FileRecord** | Store storagePath (IDs only), generate downloadUrl on-demand |

### 3.2 Code Quality Prohibitions

| Rule | Rationale |
|------|-----------|
| **No `any` types** | Enterprise TypeScript — use generics, union types, proper interfaces |
| **No `as any` casts** | Proper type narrowing with discriminated unions |
| **No `@ts-ignore`** | Fix type issues at the source |
| **No inline styles** | Use design tokens (useIconSizes, useBorderTokens, useSemanticColors) |
| **No div soup** | Semantic HTML — article, section, nav, header, footer |

### 3.3 Data Prohibitions

| Rule | Rationale |
|------|-----------|
| **No file operations without classification** (Phase 3+) | Governance requires classification before sharing |
| **No permanent delete without retention check** | Compliance — check retentionUntil and hold before purge |
| **No upload without entryPointId** | Audit trail — know where every file came from |
| **No undefined values in Firestore** | Use `?? null` — Firestore rejects undefined |

---

## Section 4: Industry References & Standards

### 4.1 Enterprise Systems

| System | What We Learn |
|--------|---------------|
| **SAP Document Management System (DMS)** | Classification, versioning, approval workflows, retention |
| **Google Workspace Drive API** | Sharing model, ACL, thumbnails, search, real-time collaboration |
| **Procore Document Management** | Construction-specific: permits, RFIs, submittals, approval chains |
| **Dropbox Business** | Sync, sharing links, team folders, activity audit |
| **SharePoint Online** | Metadata-driven views, content types, records management |

### 4.2 Compliance Standards

| Standard | Relevance |
|----------|-----------|
| **ISO 27001** | Information security — access control (§A.9), cryptography (§A.10), audit logging (§A.12.4) |
| **GDPR** | Art. 17 (Right to Erasure), Art. 20 (Data Portability), Art. 30 (Processing Records) |
| **ISO 9001** | Document control procedures, version management |
| **Greek Tax Law** | myDATA/AADE requirements for invoice/receipt document retention |

### 4.3 Technical Standards

| Standard | Application |
|----------|-------------|
| **ZIP format (PKWARE APPNOTE)** | Server-side ZIP creation — UTF-8 flag, CRC-32, deflate |
| **PDF/A (ISO 19005)** | Long-term archival format for compliance documents |
| **WebDAV (RFC 4918)** | Potential future: document locking, versioning protocol |

---

## Section 5: Migration Strategy

### Guiding Principles

1. **Incremental delivery** — κάθε Phase είναι ανεξάρτητη και deployable
2. **Zero downtime** — backward compatible migrations, no breaking changes
3. **Feature flags** — νέα features πίσω από flags μέχρι να σταθεροποιηθούν
4. **Data safety** — migration scripts με dry-run mode, rollback capability
5. **Existing patterns** — reuse centralized systems (FilterSystem, StateManager, AI pipeline)

### Phase Priorities

```
Phase 1: ████████████████████ COMPLETED — Core file management
Phase 2: ████████████████░░░░ 75% DONE — Thumbnails, AI classify, versioning done. Full-text search pending
Phase 3: ████████████████████ COMPLETED — Governance & GDPR (5/5 features)
Phase 4: ████████████████████ COMPLETED — Advanced UX (5/5 features)
Phase 5: ████████░░░░░░░░░░░ PARTIAL  — PDF gen + webhooks done (2/5 features)
```

### Remaining Work

1. **Phase 2.4** — Full-text search (requires Algolia/Meilisearch external service)
2. **Phase 5.1** — myDATA/AADE (requires AADE credentials)
3. **Phase 5.3** — Per-document ACL (requires RBAC redesign)
4. **Phase 5.5** — S3/Azure Storage (requires cloud account)

### New Firestore Collections (added in Phases 3-5)

| Collection | Purpose | Phase |
|------------|---------|-------|
| `file_audit_log` | Document lifecycle events | 3.1 |
| `file_approvals` | Approval workflow chains | 3.3 |
| `file_comments` | Threaded document comments | 4.3 |
| `file_folders` | Virtual folder structure | 4.4 |
| `file_shares` | External sharing links | 4.2 |
| `document_templates` | Document templates | 4.1 |
| `file_webhooks` | Webhook registrations | 5.4 |

### New API Routes (added in Phases 3-5)

| Route | Method | Purpose | Phase |
|-------|--------|---------|-------|
| `/api/files/archive` | POST | Archive files | 3.2 |
| `/api/files/purge` | POST | Purge archived files | 3.2 |
| `/api/cron/file-purge` | GET | Auto-purge cron job | 3.2 |
| `/api/files/watermark` | POST | PDF watermarking | 3.4 |
| `/api/files/gdpr-export` | POST | GDPR data export | 3.5 |
| `/api/files/gdpr-delete` | POST | GDPR right to erasure | 3.5 |
| `/api/files/generate-pdf` | POST | HTML-to-PDF generation | 5.2 |
| `/api/files/webhook` | GET/POST/DELETE | Webhook management | 5.4 |

### Dependencies Added

| Package | License | Purpose |
|---------|---------|---------|
| `pdf-lib` | MIT ✅ | Watermarking + PDF generation (server-side) |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-03-09 | Initial ADR — Phase 1 documented, Phases 2-5 roadmap defined |
| 2026-03-09 | Phase 3 COMPLETE — Audit trail, retention, approvals, watermarking, GDPR (12 commits) |
| 2026-03-09 | Phase 4 COMPLETE — Templates, sharing, comments, folders, advanced filters |
| 2026-03-09 | Phase 5 PARTIAL — PDF generation + webhook notifications implemented |
| 2026-03-09 | ADR updated with all implementation details, new collections, API routes, dependencies |
| 2026-03-09 | Phase 2 MOSTLY COMPLETE — Thumbnail generation at upload, AI auto-classify, versioning all operational |
| 2026-03-24 | **Storage Garbage Collection FIX** — Purge routes (`/api/files/purge`, `/api/cron/file-purge`, `/api/files/gdpr-delete`) now call `bucket.file(storagePath).delete()` to physically remove binary files from Firebase Storage before marking Firestore records as purged. Previously only soft-deleted metadata, leaving orphaned storage files. GDPR route also nullifies `storagePath` field. |
| 2026-03-26 | **AI Document Auto-Classification** — New `contact-document-classifier.ts` uses OpenAI vision to classify uploaded documents into 117 contact-specific purposes (e.g., 'id', 'cv-resume', 'health-certificate'). Integrated transparently in `attachment-handler.ts` `handleDocument()`. Sets `FileRecord.purpose` field so files appear in the correct UI card instead of "Άλλο Γενικό". Fallback to 'generic' on low confidence or API error. |
| 2026-03-26 | **Orphan PENDING File Cleanup** — New `file-purge-helpers.ts` shared module with `purgeFileRecord()` + `isFileHeld()`. Cron `file-purge` route extended with Phase B: auto-purge PENDING/FAILED files older than 48h (configurable via `PENDING_FILE_TTL_HOURS` env). New AI agent tool `discard_pending_file` for immediate deletion when user says "μην το καταχωρείς". Firestore composite index `status+createdAt` on `files` collection. |
| 2026-04-01 | **Contact Soft Delete (ADR-191 pattern reuse)** — Εφαρμογή του lifecycle pattern `active → deleted → purged` στα Contacts. Ίδια collection (`contacts`) με `status='deleted'` + `deletedAt`/`deletedBy`/`previousStatus` metadata. Restore επαναφέρει στο `previousStatus`. Auto-purge cron (`/api/cron/purge-deleted-contacts`, daily 03:00 UTC, 30-day retention) καλεί `executeDeletion()` (ADR-226). Undo toast 5sec. Αυτό αποδεικνύει ότι το ADR-191 lifecycle pattern είναι **reusable** πέρα από files. |

---

## Related Documents (Upload Architecture)

| Document | Relationship | Context |
|----------|-------------|---------|
| **[ADR-292](./ADR-292-floorplan-upload-consolidation-map.md)** | **Hub** | Full upload architecture map — all 6 paths, service diagram, consolidation roadmap |
| **[ADR-018](./ADR-018-unified-upload-service.md)** | Upstream | Unified Upload Service — the gateway that routes files into this lifecycle |
| **[ADR-202](./ADR-202-floorplan-save-orchestrator.md)** | Consumer | 4-step save pattern that calls createPendingFileRecord/finalizeFileRecord from this model |
| **[ADR-196](./ADR-196-unit-floorplan-enterprise-filerecord.md)** | Consumer | Unit floorplan migration — adopted this FileRecord model to replace legacy collection |
| **[ADR-288](./ADR-288-cad-file-metadata-centralization.md)** | Consumer | CAD metadata — dual-writes back to `files` collection using this model |

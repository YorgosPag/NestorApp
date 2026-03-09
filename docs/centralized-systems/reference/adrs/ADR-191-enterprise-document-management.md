# ADR-191: Enterprise Document Management System

| Metadata | Value |
|----------|-------|
| **Status** | PHASE_1_COMPLETE |
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

### Phase 2: Document Intelligence (Medium Priority)

| Feature | Description | Complexity | Industry Reference |
|---------|-------------|------------|-------------------|
| **Thumbnail generation** | Auto-generate thumbnails για images + PDF first page. Firebase Cloud Function ή on-upload processing | Medium | Google Drive, Dropbox |
| **AI auto-classification** | OpenAI vision (gpt-4o-mini) → document type detection (invoice, contract, permit, photo). Extend existing AI pipeline | Medium | SAP DMS, Google Cloud Document AI |
| **Full-text search** | Content indexing: OCR for scanned docs, text extraction for PDFs. Algolia ή Firebase Extensions | High | Google Drive, Elasticsearch |
| **File versioning** | Version history, rollback, diff view. New `file_versions` Firestore collection | High | Google Docs, SharePoint |

**Implementation notes:**
- Thumbnail generation μπορεί να γίνει client-side (canvas) ή server-side (Sharp/Canvas)
- AI classification ήδη υπάρχει στο pipeline (ADR-055) — χρειάζεται extension
- Full-text search απαιτεί external service (Algolia/Meilisearch) ή Firebase Extensions
- Versioning: κάθε upload δημιουργεί new version, `files/{id}/versions` subcollection

### Phase 3: Governance & Compliance (High Priority for Production)

| Feature | Description | Compliance |
|---------|-------------|------------|
| **Audit trail** | Log view/download/modify/share events σε Firestore `file_audit_log` collection | ISO 27001 §A.12.4 |
| **Retention policies** | Auto-archive rules per category (π.χ. invoices → 10 years, drafts → 1 year) | GDPR Art. 5(1)(e) |
| **Approval workflows** | Document sign-off chains — submitted → reviewed → approved → published | SAP DMS, Procore |
| **Watermarking** | Server-side watermark injection for confidential documents | ISO 27001 §A.8.2 |
| **GDPR compliance** | Right to erasure (Art. 17), data export (Art. 20), processing records (Art. 30) | GDPR |

**Implementation notes:**
- Audit trail: Firebase Cloud Function trigger on document changes
- Retention: Scheduled Cloud Function (daily) checks retentionUntil dates
- Approval workflows: State machine pattern (FSM) — reuse drawing-state-machine pattern (ADR-032)
- Watermarking: Server-side PDF manipulation (pdf-lib — MIT license)
- GDPR: Data subject request API endpoint + automated data discovery

### Phase 4: Advanced UX (Medium Priority)

| Feature | Description | Industry Reference |
|---------|-------------|-------------------|
| **Drag-and-drop folders** | Virtual folder structure (Firestore path-based), drag files between folders | Google Drive, Dropbox |
| **Document templates** | Pre-built templates: contracts, permits, invoices, reports. Markdown/PDF generation | Procore, PandaDoc |
| **External sharing** | Expiring links + password protection. Separate `shared_links` collection | Google Drive, OneDrive |
| **Inline annotations** | Comments/annotations on documents (PDF/image overlay) | Adobe Acrobat, Procore |
| **Advanced filters** | Date range, file size, uploader, classification, entity type, tags | SAP DMS |

**Implementation notes:**
- Folders: Virtual (metadata-only), δεν αλλάζει Firebase Storage structure
- Templates: Handlebars/Mustache → PDF generation (server-side)
- Sharing: Signed URLs με TTL + access logging
- Annotations: Canvas overlay system (reuse DXF viewer patterns)
- Filters: Extend existing FilterSystem (ADR-051)

### Phase 5: Enterprise Integration (Low Priority — Long-term)

| Feature | Description | Integration |
|---------|-------------|-------------|
| **myDATA/AADE** | Tax document integration — auto-upload invoices to AADE | Greek tax compliance |
| **PDF generation** | Automated PDF from templates (contracts, reports, BOQ) | SAP, Procore |
| **Per-document ACL** | Fine-grained permissions per file (view/edit/delete/share) | Google Drive ACL |
| **Webhook notifications** | Events on document changes (upload, classify, approve) | Zapier, Make |
| **Storage abstraction** | S3/Azure Blob Storage abstraction layer (beyond Firebase Storage) | AWS S3, Azure Blob |

**Implementation notes:**
- myDATA: Extend existing accounting module (ADR ACC-008)
- PDF generation: pdf-lib (MIT) ή Puppeteer for complex layouts
- ACL: roles array per document + Firestore security rules
- Webhooks: Firebase Cloud Functions + webhook registry
- Storage abstraction: Strategy pattern — StorageProvider interface

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
Phase 1: ████████████████████ COMPLETED (current)
Phase 2: ░░░░░░░░░░░░░░░░░░░ Next (document intelligence)
Phase 3: ░░░░░░░░░░░░░░░░░░░ Production blocker (governance)
Phase 4: ░░░░░░░░░░░░░░░░░░░ UX enhancement
Phase 5: ░░░░░░░░░░░░░░░░░░░ Long-term enterprise
```

### Recommended Order

1. **Phase 3** (Governance) — ΠΡΙΝ το production deployment (security audit blockers)
2. **Phase 2** (Intelligence) — μετά το production, για added value
3. **Phase 4** (UX) — incremental, per user feedback
4. **Phase 5** (Integration) — long-term, per business needs

---

## Changelog

| Date | Change |
|------|--------|
| 2026-03-09 | Initial ADR — Phase 1 documented, Phases 2-5 roadmap defined |

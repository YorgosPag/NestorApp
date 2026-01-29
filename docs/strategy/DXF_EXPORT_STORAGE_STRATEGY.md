# 📦 DXF EXPORT STORAGE STRATEGY

---

**📋 Document Type:** Enterprise Storage Strategy
**🎯 Scope:** DXF Export File Storage & Metadata Management
**👤 Architect:** Γιώργος Παγωνής
**🤖 Developer:** Claude (Anthropic AI)
**📅 Created:** 2026-01-30
**📅 Last Updated:** 2026-01-30
**📊 Status:** APPROVED - Phase 0 Complete

---

## 📖 TABLE OF CONTENTS

1. [Executive Summary](#1-executive-summary)
2. [Current Storage Architecture](#2-current-storage-architecture)
3. [DXF Export Storage Design](#3-dxf-export-storage-design)
4. [Storage Path Specification](#4-storage-path-specification)
5. [Metadata Schema](#5-metadata-schema)
6. [Versioning Strategy](#6-versioning-strategy)
7. [Retention Policy](#7-retention-policy)
8. [Cleanup & Maintenance](#8-cleanup--maintenance)
9. [Security Considerations](#9-security-considerations)
10. [Performance Optimization](#10-performance-optimization)
11. [Integration Points](#11-integration-points)
12. [Monitoring & Alerts](#12-monitoring--alerts)
13. [Cost Estimation](#13-cost-estimation)
14. [Implementation Checklist](#14-implementation-checklist)

---

## 1. EXECUTIVE SUMMARY

### 1.1 Purpose

This document defines the **storage strategy for DXF export functionality**. It extends the existing enterprise-grade Firebase Storage architecture to handle exported DXF files with proper versioning, metadata tracking, and lifecycle management.

### 1.2 Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Storage Backend** | Firebase Storage | Existing infrastructure, proven reliability |
| **Metadata Store** | Firestore | Consistent with existing pattern |
| **Path Structure** | Entity-centric | Aligns with existing `/companies/{companyId}/...` |
| **Versioning** | Incremental with history | Audit trail, rollback capability |
| **Retention** | 90 days for exports, 7 days for temp | Cost optimization |

### 1.3 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     DXF EXPORT STORAGE FLOW                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐    ┌──────────────┐    ┌─────────────────────┐   │
│  │  Next.js │───►│ ezdxf Python │───►│  Firebase Storage   │   │
│  │   App    │    │ Microservice │    │  (DXF Binary File)  │   │
│  └──────────┘    └──────────────┘    └─────────────────────┘   │
│       │                                        │                │
│       │                                        │                │
│       ▼                                        ▼                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                      Firestore                            │  │
│  │  /companies/{companyId}/dxfExports/{exportId}            │  │
│  │  - metadata (settings, stats, timestamps)                 │  │
│  │  - storageUrl (pointer to Firebase Storage)               │  │
│  │  - NO binary data (enterprise pattern)                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. CURRENT STORAGE ARCHITECTURE

### 2.1 Existing Pattern (Reference)

The Nestor platform already uses an **enterprise-grade storage architecture**:

**File**: `src/subapps/dxf-viewer/services/dxf-firestore.service.ts`

```typescript
// 🏢 EXISTING ENTERPRISE PATTERN
interface DxfFileMetadata {
  id: string;
  fileName: string;
  storageUrl: string;        // Firebase Storage URL
  lastModified: Timestamp;
  version: number;           // Version control
  checksum?: string;         // Data integrity
  sizeBytes?: number;        // Performance monitoring
  entityCount?: number;      // CAD metrics
}
```

**Key Principles**:
- ✅ **Binary data** → Firebase Storage (cheap, scalable)
- ✅ **Metadata only** → Firestore (fast queries)
- ✅ **Version control** → Incremental versioning
- ✅ **Data integrity** → Checksum validation

### 2.2 Existing Path Structure

From `docs/architecture-review/05-files-storage-pipeline.md`:

```
/companies/{companyId}/projects/{projectId}/entities/{entityType}/{entityId}/
  domains/{domain}/categories/{category}/files/{fileId}.{ext}
```

**Status**: ✅ Enterprise-grade, tenant-isolated

---

## 3. DXF EXPORT STORAGE DESIGN

### 3.1 Design Principles

| Principle | Implementation |
|-----------|----------------|
| **Tenant Isolation** | All paths include `companyId` |
| **Separation of Concerns** | Binary in Storage, metadata in Firestore |
| **Audit Trail** | Version history, export logs |
| **Cost Efficiency** | Retention policies, cleanup jobs |
| **Performance** | Signed URLs for direct download |

### 3.2 Storage Types

| Type | Purpose | Retention | Path Pattern |
|------|---------|-----------|--------------|
| **Final Export** | User-requested DXF exports | 90 days | `/exports/dxf/final/` |
| **Draft Export** | Auto-save during editing | 30 days | `/exports/dxf/drafts/` |
| **Temp Export** | In-progress exports | 7 days | `/exports/dxf/temp/` |
| **Archive Export** | Long-term storage (paid) | Indefinite | `/exports/dxf/archive/` |

### 3.3 Export Triggers

| Trigger | Storage Type | Auto-Delete |
|---------|--------------|-------------|
| **User clicks "Export DXF"** | Final Export | After 90 days |
| **Auto-save during edit** | Draft Export | After 30 days |
| **API batch export** | Final Export | After 90 days |
| **Scheduled backup** | Archive Export | Never (user-managed) |

---

## 4. STORAGE PATH SPECIFICATION

### 4.1 Firebase Storage Paths

#### 4.1.1 Final Exports (User-Initiated)

```
gs://{bucket}/companies/{companyId}/exports/dxf/final/{year}/{month}/{exportId}/{fileName}.dxf
```

**Example**:
```
gs://nestor-app.appspot.com/companies/comp_abc123/exports/dxf/final/2026/01/exp_xyz789/floor-plan-v3.dxf
```

**Components**:
| Component | Description | Example |
|-----------|-------------|---------|
| `{bucket}` | Firebase Storage bucket | `nestor-app.appspot.com` |
| `{companyId}` | Tenant ID | `comp_abc123` |
| `{year}/{month}` | Date partitioning | `2026/01` |
| `{exportId}` | Unique export ID | `exp_xyz789` |
| `{fileName}` | User-friendly name | `floor-plan-v3` |

#### 4.1.2 Draft Exports (Auto-Save)

```
gs://{bucket}/companies/{companyId}/exports/dxf/drafts/{sourceFileId}/{version}/{fileName}.dxf
```

**Example**:
```
gs://nestor-app.appspot.com/companies/comp_abc123/exports/dxf/drafts/file_abc/v3/floor-plan-draft.dxf
```

#### 4.1.3 Temporary Exports (Processing)

```
gs://{bucket}/companies/{companyId}/exports/dxf/temp/{sessionId}/{timestamp}_{random}.dxf
```

**Example**:
```
gs://nestor-app.appspot.com/companies/comp_abc123/exports/dxf/temp/sess_123/1706590800000_a1b2c3.dxf
```

#### 4.1.4 Archive Exports (Long-Term)

```
gs://{bucket}/companies/{companyId}/exports/dxf/archive/{projectId}/{entityId}/{exportId}.dxf
```

### 4.2 Path Generation Code

```typescript
// src/services/dxf-export/storage-paths.ts

import { generateExportId } from '@/services/enterprise-id.service';

/**
 * DXF Export storage path generator
 * Follows enterprise path specification from storage strategy
 */
export const DxfExportPaths = {
  /**
   * Generate path for final user-initiated export
   */
  finalExport(params: {
    companyId: string;
    exportId?: string;
    fileName: string;
  }): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const exportId = params.exportId || generateExportId();
    const safeName = sanitizeFileName(params.fileName);

    return `companies/${params.companyId}/exports/dxf/final/${year}/${month}/${exportId}/${safeName}.dxf`;
  },

  /**
   * Generate path for draft auto-save
   */
  draftExport(params: {
    companyId: string;
    sourceFileId: string;
    version: number;
    fileName: string;
  }): string {
    const safeName = sanitizeFileName(params.fileName);

    return `companies/${params.companyId}/exports/dxf/drafts/${params.sourceFileId}/v${params.version}/${safeName}.dxf`;
  },

  /**
   * Generate path for temporary processing file
   */
  tempExport(params: {
    companyId: string;
    sessionId: string;
  }): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);

    return `companies/${params.companyId}/exports/dxf/temp/${params.sessionId}/${timestamp}_${random}.dxf`;
  },

  /**
   * Generate path for archived export
   */
  archiveExport(params: {
    companyId: string;
    projectId: string;
    entityId: string;
    exportId: string;
  }): string {
    return `companies/${params.companyId}/exports/dxf/archive/${params.projectId}/${params.entityId}/${params.exportId}.dxf`;
  },
};

/**
 * Sanitize filename for storage
 */
function sanitizeFileName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100);
}
```

---

## 5. METADATA SCHEMA

### 5.1 Firestore Collection

**Collection**: `/companies/{companyId}/dxfExports/{exportId}`

### 5.2 Document Schema

```typescript
// src/types/dxf-export-metadata.types.ts

import { Timestamp } from 'firebase/firestore';
import type { DxfVersion, DxfUnit, DxfExportSettings } from '@/subapps/dxf-viewer/types/dxf-export.types';

/**
 * DXF Export metadata stored in Firestore
 * Binary data stored separately in Firebase Storage
 */
export interface DxfExportMetadata {
  /** Unique export ID */
  id: string;

  /** Company ID (tenant isolation) */
  companyId: string;

  /** User who initiated export */
  userId: string;

  /** Export type */
  exportType: 'final' | 'draft' | 'temp' | 'archive';

  /** Export status */
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'expired';

  // ─────────────────────────────────────────────────────────────
  // SOURCE INFORMATION
  // ─────────────────────────────────────────────────────────────

  /** Source file ID (if exporting existing DXF) */
  sourceFileId?: string;

  /** Source entity type (building, unit, project, etc.) */
  sourceEntityType?: string;

  /** Source entity ID */
  sourceEntityId?: string;

  /** Source project ID */
  projectId?: string;

  // ─────────────────────────────────────────────────────────────
  // EXPORT SETTINGS (SNAPSHOT)
  // ─────────────────────────────────────────────────────────────

  /** DXF version used for export */
  dxfVersion: DxfVersion;

  /** Drawing units */
  units: DxfUnit;

  /** Text encoding */
  encoding: string;

  /** Full settings snapshot (for reproducibility) */
  settingsSnapshot: DxfExportSettings;

  // ─────────────────────────────────────────────────────────────
  // FILE INFORMATION
  // ─────────────────────────────────────────────────────────────

  /** User-friendly filename */
  fileName: string;

  /** Firebase Storage URL */
  storageUrl: string;

  /** Storage path (without bucket) */
  storagePath: string;

  /** File size in bytes */
  sizeBytes: number;

  /** MD5 checksum for integrity */
  checksum: string;

  /** MIME type */
  mimeType: 'application/dxf';

  // ─────────────────────────────────────────────────────────────
  // EXPORT STATISTICS
  // ─────────────────────────────────────────────────────────────

  /** Export statistics */
  stats: {
    /** Total entities in source */
    totalEntities: number;

    /** Successfully exported entities */
    exportedEntities: number;

    /** Skipped entities (not exportable) */
    skippedEntities: number;

    /** Failed entities */
    failedEntities: number;

    /** Layers exported */
    layersExported: number;

    /** Export duration in milliseconds */
    exportTimeMs: number;
  };

  // ─────────────────────────────────────────────────────────────
  // VERSIONING
  // ─────────────────────────────────────────────────────────────

  /** Export version (incremental per source) */
  version: number;

  /** Previous version ID (for version chain) */
  previousVersionId?: string;

  // ─────────────────────────────────────────────────────────────
  // TIMESTAMPS
  // ─────────────────────────────────────────────────────────────

  /** When export was requested */
  createdAt: Timestamp;

  /** When export completed/failed */
  completedAt?: Timestamp;

  /** When file expires (for cleanup) */
  expiresAt: Timestamp;

  /** Last download timestamp */
  lastDownloadedAt?: Timestamp;

  /** Download count */
  downloadCount: number;

  // ─────────────────────────────────────────────────────────────
  // ERROR INFORMATION (if failed)
  // ─────────────────────────────────────────────────────────────

  /** Error details if export failed */
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };

  // ─────────────────────────────────────────────────────────────
  // AUDIT
  // ─────────────────────────────────────────────────────────────

  /** Audit trail */
  audit: {
    createdBy: string;
    createdAt: Timestamp;
    lastModifiedBy?: string;
    lastModifiedAt?: Timestamp;
  };
}

/**
 * Indexes required for efficient queries
 */
export const DXF_EXPORT_INDEXES = [
  // Query by company + status
  { fields: ['companyId', 'status'] },

  // Query by company + expiration (for cleanup)
  { fields: ['companyId', 'expiresAt'] },

  // Query by source file (version history)
  { fields: ['companyId', 'sourceFileId', 'version'] },

  // Query by user exports
  { fields: ['companyId', 'userId', 'createdAt'] },

  // Query by project exports
  { fields: ['companyId', 'projectId', 'createdAt'] },
] as const;
```

### 5.3 Example Document

```json
{
  "id": "exp_abc123xyz",
  "companyId": "comp_nestor001",
  "userId": "user_georgios",
  "exportType": "final",
  "status": "completed",

  "sourceFileId": "file_floor_plan_01",
  "sourceEntityType": "building",
  "sourceEntityId": "bld_main_office",
  "projectId": "proj_athens_2026",

  "dxfVersion": "AC1015",
  "units": "millimeters",
  "encoding": "utf-8",
  "settingsSnapshot": {
    "version": "AC1015",
    "units": "millimeters",
    "encoding": "utf-8",
    "quality": {
      "coordinatePrecision": 6,
      "simplifyPolylines": false
    },
    "layers": {
      "visibleOnly": true,
      "includeLocked": false
    }
  },

  "fileName": "main-office-floor-plan",
  "storageUrl": "https://storage.googleapis.com/nestor-app.appspot.com/companies/comp_nestor001/exports/dxf/final/2026/01/exp_abc123xyz/main-office-floor-plan.dxf",
  "storagePath": "companies/comp_nestor001/exports/dxf/final/2026/01/exp_abc123xyz/main-office-floor-plan.dxf",
  "sizeBytes": 245760,
  "checksum": "d41d8cd98f00b204e9800998ecf8427e",
  "mimeType": "application/dxf",

  "stats": {
    "totalEntities": 156,
    "exportedEntities": 154,
    "skippedEntities": 2,
    "failedEntities": 0,
    "layersExported": 5,
    "exportTimeMs": 342
  },

  "version": 3,
  "previousVersionId": "exp_abc122xyz",

  "createdAt": "2026-01-30T10:30:00Z",
  "completedAt": "2026-01-30T10:30:01Z",
  "expiresAt": "2026-04-30T10:30:00Z",
  "lastDownloadedAt": null,
  "downloadCount": 0,

  "audit": {
    "createdBy": "user_georgios",
    "createdAt": "2026-01-30T10:30:00Z"
  }
}
```

---

## 6. VERSIONING STRATEGY

### 6.1 Version Types

| Type | Trigger | Numbering | Retention |
|------|---------|-----------|-----------|
| **Export Version** | Each export of same source | Incremental (v1, v2, v3...) | 90 days |
| **Draft Version** | Auto-save | Incremental per session | 30 days |
| **Settings Version** | Settings change | Timestamp-based | With export |

### 6.2 Version Chain

```
Source File: file_floor_plan_01
│
├── exp_v1 (2026-01-15) - Initial export, AC1015
├── exp_v2 (2026-01-20) - Added annotations layer
├── exp_v3 (2026-01-30) - Changed to AC1021 for Unicode
│   └── previousVersionId: exp_v2
│
└── [Current Version: 3]
```

### 6.3 Version Query

```typescript
// Get version history for a source file
async function getExportVersionHistory(
  companyId: string,
  sourceFileId: string
): Promise<DxfExportMetadata[]> {
  const exports = await db
    .collection('companies')
    .doc(companyId)
    .collection('dxfExports')
    .where('sourceFileId', '==', sourceFileId)
    .orderBy('version', 'desc')
    .limit(10)
    .get();

  return exports.docs.map(doc => doc.data() as DxfExportMetadata);
}
```

---

## 7. RETENTION POLICY

### 7.1 Retention Rules

| Export Type | Default Retention | Extendable | Auto-Delete |
|-------------|-------------------|------------|-------------|
| **Final Export** | 90 days | Yes (archive) | Yes |
| **Draft Export** | 30 days | No | Yes |
| **Temp Export** | 7 days | No | Yes |
| **Archive Export** | Indefinite | N/A | No (manual) |

### 7.2 Expiration Calculation

```typescript
// Calculate expiration date based on export type
function calculateExpirationDate(exportType: DxfExportMetadata['exportType']): Date {
  const now = new Date();

  switch (exportType) {
    case 'final':
      return new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days
    case 'draft':
      return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
    case 'temp':
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);  // 7 days
    case 'archive':
      return new Date('9999-12-31'); // Never expires
    default:
      return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // Default 30 days
  }
}
```

### 7.3 User Notifications

| Days Before Expiry | Action |
|-------------------|--------|
| 14 days | Email notification (optional) |
| 7 days | In-app notification |
| 1 day | Final warning notification |
| 0 days | Status → 'expired', file eligible for cleanup |

---

## 8. CLEANUP & MAINTENANCE

### 8.1 Cleanup Job Schedule

| Job | Schedule | Scope | Action |
|-----|----------|-------|--------|
| **Expired Exports Cleanup** | Daily 03:00 UTC | All companies | Delete expired files |
| **Orphaned Files Cleanup** | Weekly Sunday 04:00 | All companies | Delete files without metadata |
| **Failed Exports Cleanup** | Daily 03:30 UTC | All companies | Delete failed exports >24h |
| **Temp Files Cleanup** | Hourly | All companies | Delete temp files >7 days |

### 8.2 Cleanup Cloud Function

```typescript
// functions/src/scheduled/dxf-export-cleanup.ts

import * as functions from 'firebase-functions';
import { getStorage } from 'firebase-admin/storage';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

/**
 * Scheduled cleanup of expired DXF exports
 * Runs daily at 03:00 UTC
 */
export const cleanupExpiredDxfExports = functions
  .runWith({ timeoutSeconds: 540, memory: '512MB' })
  .pubsub.schedule('0 3 * * *')
  .timeZone('UTC')
  .onRun(async (context) => {
    const db = getFirestore();
    const storage = getStorage();
    const bucket = storage.bucket();

    const now = Timestamp.now();
    let deletedCount = 0;
    let errorCount = 0;

    // Query all companies
    const companies = await db.collection('companies').get();

    for (const company of companies.docs) {
      const companyId = company.id;

      // Find expired exports
      const expiredExports = await db
        .collection('companies')
        .doc(companyId)
        .collection('dxfExports')
        .where('expiresAt', '<=', now)
        .where('status', '!=', 'archive')
        .limit(100)
        .get();

      for (const exportDoc of expiredExports.docs) {
        const exportData = exportDoc.data() as DxfExportMetadata;

        try {
          // 1. Delete from Storage
          if (exportData.storagePath) {
            await bucket.file(exportData.storagePath).delete({ ignoreNotFound: true });
          }

          // 2. Update status to 'expired' or delete document
          await exportDoc.ref.update({
            status: 'expired',
            'audit.lastModifiedBy': 'system-cleanup',
            'audit.lastModifiedAt': now,
          });

          deletedCount++;
        } catch (error) {
          console.error(`Failed to cleanup export ${exportDoc.id}:`, error);
          errorCount++;
        }
      }
    }

    console.log(`DXF Export Cleanup: deleted=${deletedCount}, errors=${errorCount}`);
    return { deleted: deletedCount, errors: errorCount };
  });
```

### 8.3 Manual Cleanup Commands

```bash
# Admin CLI commands (future implementation)

# List expired exports
nestor-admin dxf-exports list --status=expired --company=comp_abc123

# Force cleanup for company
nestor-admin dxf-exports cleanup --company=comp_abc123 --dry-run
nestor-admin dxf-exports cleanup --company=comp_abc123 --confirm

# Archive export before expiry
nestor-admin dxf-exports archive --export-id=exp_abc123
```

---

## 9. SECURITY CONSIDERATIONS

### 9.1 Access Control

| Operation | Permission Required | Implementation |
|-----------|---------------------|----------------|
| **Create Export** | Authenticated + same company | Firestore rules + API check |
| **Download Export** | Owner OR company admin | Signed URL with expiry |
| **Delete Export** | Owner OR company admin | Firestore rules |
| **View History** | Authenticated + same company | Firestore rules |

### 9.2 Firebase Storage Rules

```javascript
// storage.rules - DXF Export section

rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {

    // DXF Exports - Company-isolated access
    match /companies/{companyId}/exports/dxf/{allPaths=**} {

      // Allow read if user belongs to company
      allow read: if request.auth != null
                  && request.auth.token.companyId == companyId;

      // Allow write only from server (Cloud Functions)
      // Client uploads go through signed URLs
      allow write: if false; // Server-only via Admin SDK
    }
  }
}
```

### 9.3 Signed URL Strategy

```typescript
// Generate signed URL for secure download
async function generateDownloadUrl(
  exportId: string,
  companyId: string,
  userId: string
): Promise<string> {
  // 1. Verify user has access
  const hasAccess = await verifyExportAccess(exportId, companyId, userId);
  if (!hasAccess) {
    throw new Error('ACCESS_DENIED');
  }

  // 2. Get export metadata
  const exportMeta = await getExportMetadata(companyId, exportId);
  if (!exportMeta || exportMeta.status !== 'completed') {
    throw new Error('EXPORT_NOT_AVAILABLE');
  }

  // 3. Generate signed URL (expires in 1 hour)
  const bucket = getStorage().bucket();
  const file = bucket.file(exportMeta.storagePath);

  const [signedUrl] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 60 * 60 * 1000, // 1 hour
    responseDisposition: `attachment; filename="${exportMeta.fileName}.dxf"`,
  });

  // 4. Update download stats
  await updateDownloadStats(companyId, exportId);

  return signedUrl;
}
```

### 9.4 Data Sanitization

| Check | When | Action |
|-------|------|--------|
| **File size limit** | Before upload | Reject >100MB |
| **File type validation** | After generation | Verify DXF header |
| **Malware scan** | After upload | Cloud Function trigger |
| **Checksum verification** | Before download | Compare with stored checksum |

---

## 10. PERFORMANCE OPTIMIZATION

### 10.1 Caching Strategy

| Cache | TTL | Scope | Purpose |
|-------|-----|-------|---------|
| **Metadata cache** | 5 min | Per user session | Reduce Firestore reads |
| **Signed URL cache** | 55 min | Per export | Reduce URL generation |
| **Version list cache** | 10 min | Per source file | Fast history display |

### 10.2 Batch Operations

```typescript
// Batch export multiple entities
async function batchExport(
  companyId: string,
  requests: ExportRequest[]
): Promise<BatchExportResult> {
  // Process in parallel with concurrency limit
  const CONCURRENCY = 5;
  const results: ExportResult[] = [];

  for (let i = 0; i < requests.length; i += CONCURRENCY) {
    const batch = requests.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(req => exportSingle(companyId, req))
    );
    results.push(...batchResults);
  }

  return { results, total: requests.length };
}
```

### 10.3 Storage Class Optimization

| Export Type | Storage Class | Cost Savings |
|-------------|---------------|--------------|
| **Final (0-30 days)** | Standard | Baseline |
| **Final (30-90 days)** | Nearline | ~50% |
| **Archive** | Coldline | ~75% |
| **Temp** | Standard | N/A (short-lived) |

---

## 11. INTEGRATION POINTS

### 11.1 Existing Services Integration

| Service | Integration Point | Purpose |
|---------|-------------------|---------|
| **DxfFirestoreService** | Export trigger | Source scene loading |
| **UnifiedUploadService** | Storage utilities | Reuse upload patterns |
| **EnterpriseIdService** | ID generation | Unique export IDs |
| **AuditService** | Logging | Export activity tracking |

### 11.2 API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/dxf/export` | POST | Initiate export |
| `/api/dxf/export/{id}` | GET | Get export status/metadata |
| `/api/dxf/export/{id}/download` | GET | Get signed download URL |
| `/api/dxf/export/{id}` | DELETE | Cancel/delete export |
| `/api/dxf/exports` | GET | List user's exports |
| `/api/dxf/export/{id}/archive` | POST | Move to archive |

### 11.3 Event Integration

```typescript
// Events emitted by export system
type DxfExportEvent =
  | { type: 'EXPORT_STARTED'; exportId: string; userId: string }
  | { type: 'EXPORT_COMPLETED'; exportId: string; stats: ExportStats }
  | { type: 'EXPORT_FAILED'; exportId: string; error: ExportError }
  | { type: 'EXPORT_DOWNLOADED'; exportId: string; userId: string }
  | { type: 'EXPORT_EXPIRED'; exportId: string }
  | { type: 'EXPORT_ARCHIVED'; exportId: string };
```

---

## 12. MONITORING & ALERTS

### 12.1 Metrics to Track

| Metric | Threshold | Alert |
|--------|-----------|-------|
| **Export success rate** | <95% | Warning |
| **Export duration P95** | >5s | Warning |
| **Storage usage per company** | >10GB | Info |
| **Failed exports count** | >10/hour | Critical |
| **Cleanup job failures** | Any | Critical |

### 12.2 Dashboard Queries

```typescript
// Export metrics for monitoring dashboard
interface DxfExportMetrics {
  // Volume
  totalExports24h: number;
  totalExports7d: number;

  // Success rate
  successRate24h: number;
  failureRate24h: number;

  // Performance
  avgExportTimeMs: number;
  p95ExportTimeMs: number;

  // Storage
  totalStorageBytes: number;
  storageByType: Record<string, number>;

  // Cleanup
  expiredPendingCleanup: number;
  lastCleanupTime: Date;
}
```

---

## 13. COST ESTIMATION

### 13.1 Firebase Storage Costs (Estimate)

| Component | Unit Cost | Estimated Monthly |
|-----------|-----------|-------------------|
| **Storage (Standard)** | $0.026/GB | ~$2.60 (100GB) |
| **Downloads** | $0.12/GB | ~$12 (100GB) |
| **Operations** | $0.05/10K | ~$0.50 |
| **Total** | | ~$15/month |

### 13.2 Cost Optimization Strategies

1. **Lifecycle policies** → Auto-delete expired exports
2. **Storage class transitions** → Nearline after 30 days
3. **Compression** → gzip DXF files (~60% reduction)
4. **Deduplication** → Skip unchanged exports

---

## 14. IMPLEMENTATION CHECKLIST

### Phase 0 (Current) - Documentation ✅

- [x] Storage strategy document created
- [x] Path specification defined
- [x] Metadata schema designed
- [x] Security rules documented
- [ ] Review with architecture team

### Phase 1 - Infrastructure

- [ ] Create Firestore collection `/companies/{companyId}/dxfExports`
- [ ] Add Firestore indexes
- [ ] Update Firebase Storage rules
- [ ] Create storage path utilities

### Phase 2 - Core Implementation

- [ ] Implement `DxfExportStorageService`
- [ ] Implement metadata CRUD operations
- [ ] Implement signed URL generation
- [ ] Add checksum validation

### Phase 3 - Cleanup & Maintenance

- [ ] Deploy cleanup Cloud Function
- [ ] Configure lifecycle policies
- [ ] Set up monitoring alerts
- [ ] Create admin CLI tools

### Phase 4 - Integration

- [ ] Integrate with export API
- [ ] Add to existing DXF viewer
- [ ] Update UI for export history
- [ ] End-to-end testing

---

## CROSS-REFERENCES

| Document | Relationship |
|----------|--------------|
| [01-dxf-technology-decision.md](./01-dxf-technology-decision.md) | Technology decision |
| [dxf-export.types.ts](../../src/subapps/dxf-viewer/types/dxf-export.types.ts) | API contract types |
| [DXF_EXPORT_TEST_STRATEGY.md](../testing/DXF_EXPORT_TEST_STRATEGY.md) | Test strategy |
| [05-files-storage-pipeline.md](../architecture-review/05-files-storage-pipeline.md) | Existing storage architecture |
| [DXF_STORAGE_ENTERPRISE_AUDIT_REPORT.md](../../src/subapps/dxf-viewer/docs/architecture/DXF_STORAGE_ENTERPRISE_AUDIT_REPORT.md) | Current DXF storage audit |

---

## REVISION HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-30 | Claude (Anthropic AI) | Initial storage strategy document |

---

**END OF DXF EXPORT STORAGE STRATEGY**

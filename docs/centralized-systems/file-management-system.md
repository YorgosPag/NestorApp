# Enterprise File Management System

> **ADR-031** | Canonical File Storage System
> **Version**: 2.0.0
> **Last Updated**: 2026-01-24
> **Status**: Production Ready
> **Authors**: Nestor Pagonis Development Team

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Core Components](#3-core-components)
4. [View Modes](#4-view-modes)
5. [Upload Pipeline](#5-upload-pipeline)
6. [Data Models](#6-data-models)
7. [Integration Guide](#7-integration-guide)
8. [Configuration](#8-configuration)
9. [Security](#9-security)
10. [Best Practices](#10-best-practices)
11. [Troubleshooting](#11-troubleshooting)
12. [API Reference](#12-api-reference)

---

## 1. Executive Summary

### 1.1 Purpose

The **Enterprise File Management System** is a centralized, multi-tenant file management solution designed following industry patterns from **Procore**, **BIM360**, **Autodesk Construction Cloud**, **Google Drive**, and **Dropbox Business**.

### 1.2 Key Features

| Feature | Description | Industry Pattern |
|---------|-------------|------------------|
| Multi-tenant Isolation | Complete data separation per company | Salesforce, SAP |
| Canonical Upload Pipeline | 3-phase upload with atomic operations | Google Cloud Storage |
| Multiple View Modes | Gallery, List, Tree, Business, Technical | Procore, BIM360 |
| Soft Delete & Restore | Recycle bin with recovery | Google Drive, OneDrive |
| File Search | Real-time filtering across metadata | Dropbox, Google Drive |
| Entry Point Selection | Context-aware upload categorization | Autodesk Docs |

### 1.3 Technology Stack

- **Frontend**: React 19, TypeScript 5.x, Tailwind CSS
- **Backend**: Firebase (Firestore, Storage, Auth)
- **State Management**: React hooks with optimistic updates
- **i18n**: react-i18next with namespace isolation

---

## 2. Architecture Overview

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         EntityFilesManager                          │
│                    (Orchestrator Component)                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │   Header    │  │   Toolbar   │  │   Search    │  │   Tabs     │ │
│  │  (Title)    │  │  (Views)    │  │  (Filter)   │  │(Files/Trash)│ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘ │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                     Upload Pipeline                              ││
│  │  ┌──────────────────┐  ┌──────────────────┐                     ││
│  │  │ EntryPointSelector│  │  FileUploadZone  │                     ││
│  │  │ (Document Type)   │  │  (Drag & Drop)   │                     ││
│  │  └──────────────────┘  └──────────────────┘                     ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                     View Components                              ││
│  │                                                                  ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  ││
│  │  │MediaGallery │  │  FilesList  │  │     FilePathTree        │  ││
│  │  │(Grid/Photos)│  │   (Table)   │  │  (Business/Technical)   │  ││
│  │  └─────────────┘  └─────────────┘  └─────────────────────────┘  ││
│  │                                                                  ││
│  │  ┌─────────────────────────┐  ┌─────────────────────────────┐   ││
│  │  │   FloorplanGallery      │  │        TrashView            │   ││
│  │  │   (DXF/PDF Viewer)      │  │   (Recycle Bin)             │   ││
│  │  └─────────────────────────┘  └─────────────────────────────┘   ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Data Layer                                  │
│                                                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐ │
│  │  useEntityFiles │  │FileRecordService│  │  Firebase Storage   │ │
│  │     (Hook)      │  │   (Service)     │  │     (Binary)        │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────┘ │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                    Firestore Collections                         ││
│  │   companies/{companyId}/fileRecords/{fileId}                    ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 File Path Structure (Firebase Storage)

```
companies/
└── {companyId}/
    └── entities/
        └── {entityType}/           # contact, building, unit, project
            └── {entityId}/
                └── domains/
                    └── {domain}/   # admin, construction, sales
                        └── categories/
                            └── {category}/  # photos, documents, contracts
                                └── files/
                                    └── {fileId}.{ext}
```

### 2.3 Component Hierarchy

```
src/components/shared/files/
├── EntityFilesManager.tsx          # Main orchestrator (870 lines)
├── FilesList.tsx                   # Table view component
├── FilePathTree.tsx                # Tree view with business/technical modes
├── FileUploadZone.tsx              # Drag & drop upload
├── UploadEntryPointSelector.tsx    # Document type selection
├── TrashView.tsx                   # Recycle bin
├── FileInspector.tsx               # Metadata details modal
├── hooks/
│   ├── useEntityFiles.ts           # File fetching hook
│   └── useMediaGallery.ts          # Gallery state management
├── media/
│   ├── MediaGallery.tsx            # Photo/video gallery
│   ├── MediaCard.tsx               # Individual media item
│   ├── VideoPlayer.tsx             # Video playback
│   └── FloorplanGallery.tsx        # DXF/PDF viewer
└── utils/
    └── file-path-tree.ts           # Tree building utilities
```

---

## 3. Core Components

### 3.1 EntityFilesManager

**Purpose**: Central orchestrator for file management across all entity types.

**Location**: `src/components/shared/files/EntityFilesManager.tsx`

**Props Interface**:

```typescript
interface EntityFilesManagerProps {
  // Required
  entityType: 'contact' | 'building' | 'unit' | 'project';
  entityId: string;
  companyId: string;
  domain: 'admin' | 'construction' | 'sales' | 'legal' | 'financial';
  category: 'photos' | 'documents' | 'contracts' | 'floorplans' | 'videos';
  currentUserId: string;

  // Optional - Display
  entityLabel?: string;           // Human-readable entity name
  companyName?: string;           // For tree view display

  // Optional - Filtering
  purpose?: string;               // Sub-category filter (e.g., 'profile-photo')
  entryPointCategoryFilter?: FileCategory;      // Show only specific entry points
  entryPointExcludeCategories?: FileCategory[]; // Hide specific entry points

  // Optional - Upload Configuration
  maxFileSize?: number;           // Default: 50MB
  acceptedTypes?: string;         // MIME types (e.g., 'image/*,application/pdf')

  // Optional - Display Style
  displayStyle?: 'standard' | 'media-gallery' | 'floorplan-gallery';
}
```

**Usage Example**:

```tsx
// Project Photos Tab
<EntityFilesManager
  companyId={user.companyId}
  currentUserId={user.uid}
  entityType="project"
  entityId={project.id}
  entityLabel={project.name}
  domain="construction"
  category="photos"
  purpose="photo"
  displayStyle="media-gallery"
  entryPointCategoryFilter="photos"
  acceptedTypes="image/*"
/>
```

### 3.2 MediaGallery

**Purpose**: Grid/list display for photos and videos with lightbox preview.

**Location**: `src/components/shared/files/media/MediaGallery.tsx`

**Features**:
- Grid view (responsive thumbnail grid)
- List view (compact table)
- Multi-select for bulk operations
- Sorting (date, name, size)
- Filtering (all, photos, videos)
- Photo lightbox (PhotoPreviewModal integration)
- Video player modal
- Keyboard navigation (a11y)

**Props Interface**:

```typescript
interface MediaGalleryProps {
  files: FileRecord[];
  initialViewMode?: 'grid' | 'list';
  showToolbar?: boolean;
  enableSelection?: boolean;
  cardSize?: 'sm' | 'md' | 'lg';
  onSelectionChange?: (selectedFiles: FileRecord[]) => void;
  onDelete?: (files: FileRecord[]) => void;
  onDownload?: (files: FileRecord[]) => void;
  emptyMessage?: string;
  className?: string;
}
```

### 3.3 FilePathTree

**Purpose**: Windows Explorer-style hierarchical tree view with business/technical modes.

**Location**: `src/components/shared/files/FilePathTree.tsx`

**View Modes**:

| Mode | Description | Use Case |
|------|-------------|----------|
| Business | User-friendly labels (Ταυτοποίηση, Νομικά) | End users |
| Technical | Full paths with IDs | Developers, debugging |

**Features**:
- Collapsible folder structure
- Copy path to clipboard (technical mode)
- File Inspector modal (metadata details)
- i18n label translation
- Keyboard accessible

**Props Interface**:

```typescript
interface FilePathTreeProps {
  files: FileRecord[];
  onFileSelect?: (file: FileRecord) => void;
  className?: string;
  contextLevel?: 'full' | 'domains' | 'categories';
  companyName?: string;
  viewMode?: 'business' | 'technical';
}
```

### 3.4 TrashView

**Purpose**: Soft-deleted files with restore functionality.

**Location**: `src/components/shared/files/TrashView.tsx`

**Features**:
- List of deleted files
- Restore individual files
- Permanent delete (admin only)
- Retention period display
- Bulk operations

### 3.5 UploadEntryPointSelector

**Purpose**: Context-aware document type selection before upload.

**Location**: `src/components/shared/files/UploadEntryPointSelector.tsx`

**Features**:
- Entity-specific entry points
- Category filtering
- Custom title support for "Other Document"
- i18n labels

---

## 4. View Modes

### 4.1 Available Modes

| Icon | Mode | Component | Description |
|------|------|-----------|-------------|
| `Grid3X3` | Gallery | `MediaGallery` | Thumbnail grid for photos/videos |
| `List` | List | `FilesList` | Tabular list view |
| `Network` | Tree | `FilePathTree` | Hierarchical folder view |
| `Eye` | Business | `FilePathTree` | User-friendly tree (hides technical segments) |
| `Code` | Technical | `FilePathTree` | Full technical paths with IDs |

### 4.2 Mode Selection Logic

```typescript
// Default mode based on displayStyle
const [viewMode, setViewMode] = useState<'list' | 'tree' | 'gallery'>(
  displayStyle === 'media-gallery' || displayStyle === 'floorplan-gallery'
    ? 'gallery'
    : 'list'
);
```

### 4.3 Display Styles

| Style | Default View | Use Case |
|-------|--------------|----------|
| `standard` | List | Documents, contracts |
| `media-gallery` | Gallery | Photos, videos |
| `floorplan-gallery` | Gallery | DXF, PDF floorplans |

---

## 5. Upload Pipeline

### 5.1 Canonical 3-Phase Upload (ADR-031)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CANONICAL UPLOAD PIPELINE                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  PHASE A: Create Pending FileRecord                                 │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 1. Generate unique fileId                                    │   │
│  │ 2. Build canonical storage path                              │   │
│  │ 3. Create Firestore document with status: 'pending'          │   │
│  │ 4. Return { fileId, storagePath, displayName }               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  PHASE B: Upload Binary to Storage                                  │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 1. Wait 300ms for Firestore propagation                      │   │
│  │ 2. Create Storage reference                                  │   │
│  │ 3. Upload file bytes                                         │   │
│  │ 4. Get download URL                                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  PHASE C: Finalize FileRecord                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 1. Update Firestore document with:                           │   │
│  │    - status: 'active'                                        │   │
│  │    - downloadUrl                                             │   │
│  │    - sizeBytes                                               │   │
│  │ 2. Trigger refetch                                           │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2 Upload Flow Code

```typescript
// Step A: Create pending record
const { fileId, storagePath, displayName } = await FileRecordService.createPendingFileRecord({
  companyId,
  projectId,
  entityType,
  entityId,
  domain,
  category,
  entityLabel,
  purpose,
  originalFilename: file.name,
  ext: getFileExtension(file.name),
  contentType: file.type,
  createdBy: currentUserId,
  customTitle, // For "Other Document" entry point
});

// Wait for Firestore propagation (Storage Rules validate against Firestore)
await new Promise(resolve => setTimeout(resolve, 300));

// Step B: Upload binary
const storageRef = ref(storage, storagePath);
await uploadBytes(storageRef, file);
const downloadUrl = await getDownloadURL(storageRef);

// Step C: Finalize record
await FileRecordService.finalizeFileRecord({
  fileId,
  sizeBytes: file.size,
  downloadUrl,
});
```

### 5.3 Authentication Gate

```typescript
// ENTERPRISE: Verify authentication before upload
const currentUser = auth.currentUser;
if (!currentUser) {
  showError('Must be authenticated to upload files');
  return;
}

// Force token refresh for valid Storage Rules authorization
const idToken = await currentUser.getIdToken(true);
```

### 5.4 Rate Limiting

```typescript
// Wait 300ms between uploads to avoid quota limits
if (i < selectedFiles.length - 1) {
  await new Promise(resolve => setTimeout(resolve, 300));
}
```

---

## 6. Data Models

### 6.1 FileRecord Interface

```typescript
interface FileRecord {
  // Identifiers
  id: string;                    // Firestore document ID
  fileId: string;                // Canonical file ID

  // Ownership
  companyId: string;             // Multi-tenant isolation
  projectId?: string;            // Optional project scope

  // Entity Association
  entityType: EntityType;        // 'contact' | 'building' | 'unit' | 'project'
  entityId: string;

  // Classification
  domain: FileDomain;            // 'admin' | 'construction' | 'sales' | etc.
  category: FileCategory;        // 'photos' | 'documents' | 'contracts' | etc.
  purpose?: string;              // Sub-category (e.g., 'profile-photo')

  // File Metadata
  originalFilename: string;      // Original uploaded filename
  displayName: string;           // Generated display name (i18n)
  storagePath: string;           // Firebase Storage path
  downloadUrl?: string;          // Signed download URL
  contentType: string;           // MIME type
  sizeBytes?: number;            // File size

  // Status
  status: 'pending' | 'active' | 'deleted';

  // Audit
  createdBy: string;             // User ID
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  deletedAt?: Timestamp;
  deletedBy?: string;
}
```

### 6.2 Upload Entry Point Interface

```typescript
interface UploadEntryPoint {
  id: string;                    // Unique identifier
  label: string;                 // i18n key for display
  domain: FileDomain;
  category: FileCategory;
  purpose: string;
  entityTypes: EntityType[];     // Which entities support this entry point
  icon: LucideIcon;
  requiresCustomTitle?: boolean; // For "Other Document" type
}
```

### 6.3 Tree Node Types

```typescript
type TreeNode = RootNode | FolderNode | FileNode;

interface RootNode {
  id: 'root';
  type: 'root';
  label: string;
  path: string[];
  children: TreeNode[];
}

interface FolderNode {
  id: string;
  type: 'folder';
  label: string;
  segment: string;           // Path segment type (companies, entities, etc.)
  value?: string;            // Actual value for this segment
  path: string[];
  children: TreeNode[];
  isExpanded?: boolean;
}

interface FileNode {
  id: string;
  type: 'file';
  label: string;
  path: string[];
  fileRecord: FileRecord;
}
```

---

## 7. Integration Guide

### 7.1 Adding File Management to a New Entity

**Step 1**: Create Tab Component

```tsx
// src/components/{entity}/{Entity}PhotosTab.tsx
'use client';

import React from 'react';
import { EntityFilesManager } from '@/components/shared/files/EntityFilesManager';
import { useAuth } from '@/auth/contexts/AuthContext';
import { DEFAULT_PHOTO_ACCEPT } from '@/config/file-upload-config';
import type { YourEntityType } from '@/types/your-entity';

interface PhotosTabProps {
  entity?: YourEntityType & { id: string; name?: string };
  data?: YourEntityType;
}

export function PhotosTab({ entity, data }: PhotosTabProps) {
  const { user } = useAuth();
  const resolvedEntity = entity || data;

  if (!resolvedEntity?.id || !user?.companyId || !user?.uid) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p>Select an entity to view photos.</p>
      </div>
    );
  }

  return (
    <EntityFilesManager
      companyId={user.companyId}
      currentUserId={user.uid}
      entityType="your-entity-type"
      entityId={String(resolvedEntity.id)}
      entityLabel={resolvedEntity.name || `Entity ${resolvedEntity.id}`}
      domain="your-domain"
      category="photos"
      purpose="photo"
      entryPointCategoryFilter="photos"
      displayStyle="media-gallery"
      acceptedTypes={DEFAULT_PHOTO_ACCEPT}
    />
  );
}
```

**Step 2**: Register Entry Points

```typescript
// src/config/upload-entry-points.ts
export const UPLOAD_ENTRY_POINTS: UploadEntryPoint[] = [
  // ... existing entry points
  {
    id: 'your-entity-photo',
    label: 'entryPoints.yourEntityPhoto',
    domain: 'your-domain',
    category: 'photos',
    purpose: 'your-entity-photo',
    entityTypes: ['your-entity-type'],
    icon: Camera,
  },
];
```

**Step 3**: Add i18n Translations

```json
// src/i18n/locales/el/files.json
{
  "entryPoints": {
    "yourEntityPhoto": "Φωτογραφία Οντότητας"
  }
}
```

### 7.2 Common Integration Patterns

**Documents Tab (Standard View)**:
```tsx
<EntityFilesManager
  entityType="contact"
  entityId={contact.id}
  domain="admin"
  category="documents"
  displayStyle="standard"
  entryPointExcludeCategories={['photos', 'videos']}
/>
```

**Floorplans Tab (Full-width Viewer)**:
```tsx
<EntityFilesManager
  entityType="building"
  entityId={building.id}
  domain="construction"
  category="floorplans"
  purpose="building-floorplan"
  displayStyle="floorplan-gallery"
  acceptedTypes=".dxf,.pdf,.dwg"
/>
```

---

## 8. Configuration

### 8.1 File Upload Configuration

**Location**: `src/config/file-upload-config.ts`

```typescript
export const UPLOAD_LIMITS = {
  MAX_FILE_SIZE: 50 * 1024 * 1024,  // 50MB
  MAX_FILES_PER_UPLOAD: 10,
  MAX_IMAGE_DIMENSION: 4096,
  COMPRESSION_QUALITY: 0.8,
};

export const FILE_TYPE_CONFIG = {
  photos: {
    accept: 'image/jpeg,image/png,image/webp,image/heic',
    maxSize: 20 * 1024 * 1024,
  },
  documents: {
    accept: 'application/pdf,.doc,.docx,.xls,.xlsx',
    maxSize: 50 * 1024 * 1024,
  },
  floorplans: {
    accept: '.dxf,.dwg,application/pdf',
    maxSize: 100 * 1024 * 1024,
  },
};

export const DEFAULT_PHOTO_ACCEPT = FILE_TYPE_CONFIG.photos.accept;
export const DEFAULT_DOCUMENT_ACCEPT = FILE_TYPE_CONFIG.documents.accept;
```

### 8.2 Domain Constants

**Location**: `src/config/domain-constants.ts`

```typescript
export type EntityType = 'contact' | 'building' | 'unit' | 'project';

export type FileDomain =
  | 'admin'        // Administrative documents
  | 'construction' // Construction-related
  | 'sales'        // Sales materials
  | 'legal'        // Legal documents
  | 'financial';   // Financial records

export type FileCategory =
  | 'photos'
  | 'documents'
  | 'contracts'
  | 'floorplans'
  | 'videos'
  | 'certificates';
```

---

## 9. Security

### 9.1 Firebase Storage Rules

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Multi-tenant file access
    match /companies/{companyId}/{allPaths=**} {
      // Must be authenticated
      allow read, write: if request.auth != null
        // Must belong to company
        && request.auth.token.companyId == companyId
        // Verify FileRecord exists in Firestore
        && exists(/databases/(default)/documents/companies/$(companyId)/fileRecords/$(resource.name));
    }
  }
}
```

### 9.2 Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /companies/{companyId}/fileRecords/{fileId} {
      // Read: Must be authenticated and belong to company
      allow read: if request.auth != null
        && request.auth.token.companyId == companyId;

      // Create: Must be authenticated and set correct companyId
      allow create: if request.auth != null
        && request.resource.data.companyId == companyId
        && request.resource.data.createdBy == request.auth.uid;

      // Update: Must be owner or admin
      allow update: if request.auth != null
        && (resource.data.createdBy == request.auth.uid
            || request.auth.token.role == 'admin');

      // Delete: Soft delete only (status change)
      allow delete: if false; // Use soft delete instead
    }
  }
}
```

### 9.3 Download Security

```typescript
// Enterprise download handler with authenticated backend
const handleDownload = async (file: FileRecord) => {
  const user = auth.currentUser;
  if (!user) return;

  const idToken = await user.getIdToken();

  // Same-origin backend endpoint with Authorization header
  const response = await fetch(
    `/api/download?url=${encodeURIComponent(file.downloadUrl)}&filename=${encodeURIComponent(file.displayName)}`,
    {
      headers: {
        'Authorization': `Bearer ${idToken}`
      }
    }
  );

  // Stream file with Content-Disposition: attachment
  const blob = await response.blob();
  // ... trigger download
};
```

---

## 10. Best Practices

### 10.1 Performance

1. **Lazy Loading**: Use `displayStyle` to load only needed components
2. **Pagination**: Implement virtual scrolling for large file lists
3. **Image Optimization**: Use Firebase Image Resize extension
4. **Caching**: Leverage browser cache for download URLs

### 10.2 User Experience

1. **Progress Feedback**: Show upload progress with percentage
2. **Error Handling**: Display user-friendly error messages
3. **Optimistic Updates**: Update UI before server confirmation
4. **Keyboard Navigation**: Full accessibility support

### 10.3 Code Quality

1. **Type Safety**: Use strict TypeScript types
2. **i18n**: All user-facing strings through translation
3. **Centralized Tokens**: Use design system tokens (no inline styles)
4. **Error Boundaries**: Wrap components with error boundaries

---

## 11. Troubleshooting

### 11.1 Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Upload fails with 403 | Invalid auth token | Force token refresh before upload |
| Files not appearing | Firestore propagation delay | Increase wait time (300ms → 500ms) |
| Duplicate files | Missing fileId check | Verify unique constraint |
| Slow gallery | Too many files | Implement pagination |
| Missing thumbnails | Compression disabled | Check IMAGE_RESIZE extension |

### 11.2 Debug Logging

```typescript
// Enable diagnostic logging
const logger = createModuleLogger('ENTITY_FILES_MANAGER');

logger.info('UPLOAD_START', {
  storagePath,
  bucket: app.options.storageBucket,
  fileSize: file.size,
  contentType: file.type,
  authUid: auth.currentUser?.uid,
});
```

### 11.3 Storage Rules Testing

```bash
# Test with Firebase Emulator
firebase emulators:start --only storage,firestore

# Run rules tests
npm run test:storage-rules
```

---

## 12. API Reference

### 12.1 useEntityFiles Hook

```typescript
const {
  files,           // FileRecord[]
  loading,         // boolean
  error,           // Error | null
  refetch,         // () => Promise<void>
  deleteFile,      // (fileId: string, userId: string) => Promise<void>
  totalStorageBytes, // number
} = useEntityFiles({
  entityType,
  entityId,
  companyId,
  domain,
  category,
  purpose,
  autoFetch: true,
});
```

### 12.2 FileRecordService

```typescript
// Create pending record
const { fileId, storagePath, displayName, fileRecord } =
  await FileRecordService.createPendingFileRecord({
    companyId,
    projectId,
    entityType,
    entityId,
    domain,
    category,
    entityLabel,
    purpose,
    originalFilename,
    ext,
    contentType,
    createdBy,
    customTitle,
  });

// Finalize record
await FileRecordService.finalizeFileRecord({
  fileId,
  sizeBytes,
  downloadUrl,
});

// Soft delete
await FileRecordService.softDeleteFile(fileId, userId);

// Restore
await FileRecordService.restoreFile(fileId);
```

### 12.3 Event Callbacks

```typescript
// Upload success notification
const handleUploadComplete = (successCount: number) => {
  success(`${successCount} files uploaded successfully`);
};

// Selection change
const handleSelectionChange = (selectedFiles: FileRecord[]) => {
  setSelectedCount(selectedFiles.length);
};

// Delete confirmation
const handleDelete = async (files: FileRecord[]) => {
  if (await confirm(`Delete ${files.length} files?`)) {
    for (const file of files) {
      await deleteFile(file.id, currentUserId);
    }
  }
};
```

---

## Appendix A: File Structure Reference

```
src/
├── components/
│   └── shared/
│       └── files/
│           ├── EntityFilesManager.tsx      # Main orchestrator
│           ├── FilesList.tsx               # Table view
│           ├── FilePathTree.tsx            # Tree view
│           ├── FileUploadZone.tsx          # Upload dropzone
│           ├── UploadEntryPointSelector.tsx # Document type picker
│           ├── TrashView.tsx               # Recycle bin
│           ├── FileInspector.tsx           # Metadata modal
│           ├── hooks/
│           │   ├── useEntityFiles.ts       # Data fetching
│           │   └── useMediaGallery.ts      # Gallery state
│           ├── media/
│           │   ├── MediaGallery.tsx        # Photo/video gallery
│           │   ├── MediaCard.tsx           # Media item card
│           │   ├── VideoPlayer.tsx         # Video playback
│           │   └── FloorplanGallery.tsx    # DXF/PDF viewer
│           └── utils/
│               └── file-path-tree.ts       # Tree utilities
├── services/
│   ├── file-record.service.ts              # Firestore operations
│   └── upload.ts                           # Storage utilities
├── config/
│   ├── file-upload-config.ts               # Upload limits
│   ├── domain-constants.ts                 # Type definitions
│   └── upload-entry-points.ts              # Entry point registry
├── types/
│   └── file-record.ts                      # TypeScript interfaces
└── i18n/
    └── locales/
        ├── el/files.json                   # Greek translations
        └── en/files.json                   # English translations
```

---

## Appendix B: Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0.0 | 2026-01-24 | Full documentation rewrite |
| 1.5.0 | 2026-01-15 | Added FloorplanGallery |
| 1.4.0 | 2026-01-10 | Added TrashView (ADR-032) |
| 1.3.0 | 2026-01-05 | Business/Technical view modes |
| 1.2.0 | 2025-12-20 | MediaGallery component |
| 1.1.0 | 2025-12-15 | Entry point selection |
| 1.0.0 | 2025-12-01 | Initial release (ADR-031) |

---

**Document maintained by**: Nestor Pagonis Development Team
**Contact**: development@nestorpagonis.com
**Repository**: https://github.com/nestor-pagonis/nestor-app

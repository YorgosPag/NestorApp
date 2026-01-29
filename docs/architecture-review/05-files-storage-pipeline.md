# 📁 Files & Storage Pipeline - Analysis

**Review Date**: 2026-01-29
**Backend**: Firebase Storage
**Score**: **75/100** (Good, with security improvements needed)

---

## 1. FILE TAXONOMY

### 1.1 Canonical Enterprise Path

**Structure**:
```
/companies/{companyId}/projects/{projectId}/entities/{entityType}/{entityId}/
  domains/{domain}/categories/{category}/files/{fileId}.{ext}
```

**Evidence**: `storage.rules:175-204`

**Components**:
- `companyId` - Tenant isolation
- `projectId` - Project scope
- `entityType` - Entity type (building, unit, contact, etc.)
- `entityId` - Specific entity
- `domain` - File domain (documents, images, cad, etc.)
- `category` - File category (floorplans, contracts, photos, etc.)
- `fileId` - Unique file ID
- `ext` - File extension

**Status**: ✅ Excellent - Enterprise-grade path structure

---

### 1.2 Legacy Paths (⚠️ SECURITY ISSUES)

| Path | Purpose | Security Issue | Evidence |
|------|---------|----------------|----------|
| `/contacts/photos/{fileName}` | Contact photos | `allow read/write: if isAuthenticated()` (NO tenant check) | `storage.rules:243-278` |
| `/floor-plans/{buildingId}/{floorId}/{fileName}` | Floor plans | `allow read/write: if isAuthenticated()` (NO tenant check) | `storage.rules:243-278` |
| `/companies/logos/{fileName}` | Company logos | `allow read/write: if isAuthenticated()` (NO companyId check) | `storage.rules:287-296` |
| `/cad/{userId}/{fileId}/{fileName}` | CAD files | ✅ Owner-based access OK | `storage.rules:305-316` |
| `/temp/{userId}/{fileName}` | Temporary uploads | ✅ Owner-only OK | `storage.rules:325-332` |

**🔴 CRITICAL**: Legacy paths need tenant isolation (see [03-auth-rbac-security.md](./03-auth-rbac-security.md))

---

## 2. UPLOAD FLOWS

### 2.1 Standard Upload Flow

```
1. Client: Request upload URL
   └─ API: /api/files/upload (POST)
      └─ Server: Generate signed URL + metadata

2. Client: Upload file to Storage
   └─ Storage: Direct upload with signed URL

3. Client: Confirm upload
   └─ API: /api/files/confirm (POST)
      └─ Firestore: Save file metadata to /files collection

4. Server: Post-processing (if needed)
   └─ Cloud Function: Generate thumbnail, extract metadata
```

**Evidence**: `src/services/file/` - File services

---

### 2.2 Photo Upload Service

**File**: `src/services/photo-upload.service.ts` (40KB)

**Features**:
- ✅ Image compression
- ✅ Thumbnail generation
- ✅ EXIF data extraction
- ✅ Multiple sizes (thumbnail, medium, large)

**Evidence**: `C:\Nestor_Pagonis\src\services\photo-upload.service.ts`

---

### 2.3 File Naming Service

**File**: `src/services/file/FileNamingService.ts`

**Features**:
- ✅ Generates unique file IDs
- ✅ Sanitizes file names
- ✅ Handles duplicates
- ✅ Preserves extensions

**Evidence**: `C:\Nestor_Pagonis\src\services\file\FileNamingService.ts`

---

## 3. PERMISSIONS

### 3.1 Canonical Path Permissions

**Rules** (`storage.rules:175-204`):
```
match /companies/{companyId}/.../files/{fileId}.{ext} {
  allow read: if isAuthenticated() && belongsToCompany(companyId);
  allow write: if isAuthenticated()
    && belongsToCompany(companyId)
    && request.resource.size < 50 * 1024 * 1024  // 50MB limit
    && request.resource.contentType.matches('image/.*|application/pdf|...'); // Content type validation
}
```

**Status**: ✅ Excellent - Proper tenant isolation + size + content type validation

---

### 3.2 Legacy Path Permissions (⚠️ ISSUES)

**Contact Photos** (`storage.rules:243-278`):
```
match /contacts/photos/{fileName} {
  allow read: if isAuthenticated();    // ❌ ANY authenticated user!
  allow write: if isAuthenticated();   // ❌ ANY authenticated user!
}
```

**Impact**: 🟠 HIGH - Cross-tenant access possible

**Remediation**: Add `belongsToCompany()` check

---

## 4. METADATA MODEL

### 4.1 Firestore File Record

**Collection**: `/files/{fileId}`

**Schema**:
```typescript
interface FileRecord {
  id: string;                    // File ID
  companyId: string;             // Tenant isolation
  projectId: string;             // Project scope
  entityType: string;            // Entity type (building, unit, etc.)
  entityId: string;              // Entity ID
  domain: string;                // File domain (documents, images, etc.)
  category: string;              // File category (floorplans, contracts, etc.)

  fileName: string;              // Original file name
  storagePath: string;           // Full Storage path
  contentType: string;           // MIME type
  size: number;                  // File size in bytes

  createdBy: string;             // User ID
  createdAt: Timestamp;          // Upload timestamp
  updatedAt: Timestamp;          // Last update

  metadata?: {                   // Optional metadata
    width?: number;              // Image width
    height?: number;             // Image height
    duration?: number;           // Video/audio duration
    exif?: object;               // EXIF data
    tags?: string[];             // User tags
    description?: string;        // Description
  };

  versions?: {                   // File versions (thumbnails, etc.)
    thumbnail?: string;          // Thumbnail path
    medium?: string;             // Medium size path
    large?: string;              // Large size path
  };
}
```

**Evidence**: `src/types/file-record.ts` (19KB)

**Status**: ✅ Excellent - Comprehensive metadata model

---

## 5. RETENTION & VERSIONING

### 5.1 Retention Policy

**Current**: No automatic retention policy

**Recommendation**: Implement retention policies:
- Temporary files: Delete after 24 hours
- Deleted files: Soft delete (move to `/deleted/` for 30 days)
- Archived files: Move to cold storage after 1 year

---

### 5.2 Versioning

**Current**: Manual versioning only

**Implementation**:
- New upload creates new file with version suffix
- Previous version preserved
- No automatic cleanup

**Recommendation**: Implement automatic versioning with Cloud Functions

---

## 6. THUMBNAILING & PREVIEW

### 6.1 Thumbnail Strategy

**Current**:
- ✅ Image thumbnails: Generated on upload
- ✅ PDF preview: First page as image
- ⚠️ Video thumbnails: Not implemented
- ❌ DXF preview: Not implemented

**Evidence**: `src/services/photo-upload.service.ts` - Thumbnail generation

---

### 6.2 Preview Generation

**Cloud Function** (if exists):
- Triggered on file upload
- Generates thumbnails
- Extracts metadata
- Updates Firestore record

**Status**: ⚠️ Partial (manual implementation, not automated)

---

## 7. GAPS & RECOMMENDATIONS

### 7.1 Critical Issues

| Issue | Severity | Evidence | Remediation |
|-------|----------|----------|-------------|
| **Legacy paths lack tenant isolation** | 🟠 HIGH | `storage.rules:243-296` | Add `belongsToCompany()` check (2-3 hours) |
| **Company logos no tenant check** | 🟠 HIGH | `storage.rules:287-296` | Restructure path to `/companies/{companyId}/logos/` |
| **No retention policy** | 🟡 MEDIUM | N/A | Implement Cloud Functions for cleanup |
| **No automatic versioning** | 🟡 MEDIUM | Manual only | Add versioning Cloud Functions |
| **DXF preview not implemented** | 🟡 MEDIUM | Not found | Generate preview images for DXF files |

---

### 7.2 Recommended Direction

#### **✅ WHAT WORKS WELL**

1. **Canonical path structure** - Enterprise-grade, proper tenant isolation
2. **Metadata model** - Comprehensive, well-typed
3. **Photo upload service** - Compression, thumbnails, EXIF extraction
4. **File naming service** - Unique IDs, sanitization

---

#### **⚠️ WHAT NEEDS IMPROVEMENT**

1. **Fix legacy path permissions** - Add tenant isolation (2-3 hours)
2. **Implement retention policies** - Cloud Functions for cleanup
3. **Add automatic versioning** - Cloud Functions for version management
4. **DXF preview generation** - Generate preview images
5. **Video thumbnail generation** - Add support for videos

---

## 8. NEXT ACTIONS

### Immediate (This Week)
- [ ] Fix legacy path permissions (add `belongsToCompany()`)
- [ ] Restructure company logos path

### Short-term (Next 2 Weeks)
- [ ] Implement retention policies (Cloud Functions)
- [ ] Add automatic versioning

### Medium-term (Next Month)
- [ ] DXF preview generation
- [ ] Video thumbnail generation
- [ ] Implement cold storage migration

---

**Related Reports**:
- [03-auth-rbac-security.md](./03-auth-rbac-security.md) - Storage security rules
- [04-data-model-firestore.md](./04-data-model-firestore.md) - Firestore integration
- [06-dxf-subsystem-review.md](./06-dxf-subsystem-review.md) - DXF file handling

---

**Critical Files**:
- `C:\Nestor_Pagonis\storage.rules` (336 lines)
- `C:\Nestor_Pagonis\src\types\file-record.ts` (19KB)
- `C:\Nestor_Pagonis\src\services\photo-upload.service.ts` (40KB)
- `C:\Nestor_Pagonis\src\services\file\FileNamingService.ts`

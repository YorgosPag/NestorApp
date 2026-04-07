# ADR-054: Enterprise Upload System Consolidation

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Last Updated** | 2026-03-24 |
| **Category** | Entity Systems |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: 5 canonical components
- **Pipeline**: pending → upload → finalize

---

## Canonical Components

| Component | File | Purpose |
|-----------|------|---------|
| `EnterprisePhotoUpload` | `src/components/ui/EnterprisePhotoUpload.tsx` | Single photo upload with preview |
| `MultiplePhotosUpload` | `src/components/ui/MultiplePhotosUpload.tsx` | Multi-slot photo management |
| `MultiplePhotosFull` | `src/components/ui/MultiplePhotosFull.tsx` | Full-size multi-photo layout |
| `MultiplePhotosCompact` | `src/components/ui/MultiplePhotosCompact.tsx` | Compact multi-photo layout |
| `useEnterpriseFileUpload` | `src/hooks/useEnterpriseFileUpload.ts` | Upload hook with Firebase Storage |

## Data Flow — Contact Photos

```
individualMapper.ts (SSoT: multiplePhotoURLs → multiplePhotos)
    ↓
ContactDetails.tsx (enhancedFormData useMemo — uses mapper output directly)
    ↓
UnifiedContactTabbedSection → IndividualFormTabRenderer
    ↓
MultiplePhotosUpload → MultiplePhotosFull → EnterprisePhotoUpload
    ↓
useAutoUploadEffect → useEnterpriseFileUpload → Firebase Storage
    ↓
handleMultiplePhotosChange (functional updater) → setEditedData
```

### Single Source of Truth

- **`individualMapper.ts`** (lines 43-81): ΜΟΝΑΔΙΚΟ σημείο μετατροπής `multiplePhotoURLs[]` → `PhotoSlot[]`
- **`ContactDetails.tsx`**: Χρησιμοποιεί ΜΟΝΟ το output του mapper, χωρίς πρόσθετη μετατροπή

---

## Changelog

### 2026-03-24 — Deprecated Legacy Upload Methods Removed from PDFProcessor

**Πρόβλημα**: `PDFProcessor` περιείχε ~200 γραμμές deprecated code (`uploadFloorPlan()`, `cleanupExistingFiles()`, `uploadToStorage()`, `updateFirestoreFloor()`) που χρησιμοποιούσαν legacy `floor-plans/` paths χωρίς companyId isolation.

**Λύση**:
1. **PDFProcessor.ts**: Αφαίρεση 4 deprecated methods (~200 LOC). Διατήρηση `getStoragePath()` (interface contract) + `getCanonicalStoragePath()` + `uploadFloorplanCanonical()` (enterprise flow)
2. **UnifiedUploadService.ts**: `uploadPDF()` + `handlePDFUpload()` πετάνε σαφές error → redirect σε `pdfProcessor.uploadFloorplanCanonical()`
3. **test-upload/page.tsx**: Αντικατάσταση `LEGACY_STORAGE_PATHS.CONTACTS_PHOTOS` → `buildStoragePath()` canonical

**Αρχεία**:
- `src/services/upload/processors/PDFProcessor.ts` — removed deprecated methods
- `src/services/upload/UnifiedUploadService.ts` — deprecated uploadPDF() throws clear error
- `src/app/test-upload/page.tsx` — canonical path via buildStoragePath()

**DxfFirestoreService**: Legacy fallback (`dxf-scenes/{fileId}/scene.json`) ΔΙΑΤΗΡΗΘΗΚΕ — χρησιμοποιείται ακόμα από BuildingFloorplanService, CADProcessor, Migration004 που δεν παρέχουν canonicalScenePath.

### 2026-03-24 — Zero Hardcoded Paths: LEGACY_STORAGE_PATHS as SSoT for ALL Legacy References

**Πρόβλημα**: 12+ αρχεία χρησιμοποιούσαν hardcoded string literals (`'contacts/photos'`, `'floor-plans'`, `'dxf-scenes'`, `'companies/logos'`, `'attendance'`) αντί για centralized constants. Αυτό δημιουργούσε:
- Ασυνέπεια: αλλαγή path σε 1 σημείο δεν propagated
- Αδυναμία global refactoring
- Παραβίαση Single Source of Truth

**Λύση**: Αντικατάσταση ΟΛΩΝ hardcoded path strings με `LEGACY_STORAGE_PATHS.*` constants:

| Αρχείο | Πριν | Μετά |
|--------|------|------|
| `useEnterpriseFileUpload.ts` | `'contacts/photos'` | `LEGACY_STORAGE_PATHS.CONTACTS_PHOTOS` |
| `communications/page.tsx` | `'contacts/photos'` (x2) | `LEGACY_STORAGE_PATHS.CONTACTS_PHOTOS` |
| `UnifiedInbox.tsx` | `'contacts/photos'` (x2) | `LEGACY_STORAGE_PATHS.CONTACTS_PHOTOS` |
| `photo-upload.service.ts` | `'contacts/photos'`, `'companies/logos'` | `LEGACY_STORAGE_PATHS.*` |
| `api/upload/photo/route.ts` | `'contacts/photos'` | `LEGACY_STORAGE_PATHS.CONTACTS_PHOTOS` |
| `defaultUploadHandler.ts` | 6 hardcoded paths | `LEGACY_STORAGE_PATHS.*` |
| `PDFProcessor.ts` | `'floor-plans/'` (x3) | `LEGACY_STORAGE_PATHS.FLOOR_PLANS` |
| `dxf-firestore.service.ts` | `'dxf-scenes'` | `LEGACY_STORAGE_PATHS.DXF_SCENES` |
| `attendance-server-service.ts` | `'attendance/'` | `LEGACY_STORAGE_PATHS.ATTENDANCE` |
| `pdf-utils.ts` | `'floor-plans/'` (x3) | `LEGACY_STORAGE_PATHS.FLOOR_PLANS` |

**Νέο constant**: `COMPANIES_LOGOS: 'companies/logos'` προστέθηκε στο `LEGACY_STORAGE_PATHS`

**Αποτέλεσμα**: Μηδενικά hardcoded storage paths στο codebase. Κάθε legacy path reference δείχνει στο `domain-constants.ts` ως SSoT.

---

### 2026-03-24 — Storage Path SSoT Enforcement (Legacy Path Elimination)

**Πρόβλημα**: Πολλαπλά modules χρησιμοποιούσαν hardcoded storage paths εκτός canonical SSoT:
- `PDFProcessor`: `floor-plans/{buildingId}/{floorId}/` (χωρίς companyId isolation)
- `DxfFirestoreService`: `dxf-scenes/{fileId}/scene.json` (heuristic dual-path)
- `attendance-server-service`: `attendance/{projectId}/{date}/` (custom pattern)
- `/api/upload/photo`: User-provided `folderPath` (arbitrary paths)

**Λύση**: Enforcement του `buildStoragePath()` ως μοναδικό SSoT:
1. **domain-constants.ts**: Κεντρικοποίηση ΟΛΩΝ legacy paths στο `LEGACY_STORAGE_PATHS`
2. **PDFProcessor**: `getCanonicalStoragePath()` method + deprecation σε legacy methods
3. **DxfFirestoreService**: `storagePath` field στο DxfFileMetadata + deprecation warnings
4. **attendance-server-service**: Canonical paths μέσω `buildStoragePath()` (backward compatible)
5. **photo route**: Support canonical params (entityType/entityId) + legacy fallback
6. **pdf-utils.ts**: Entire module marked deprecated
7. **upload/index.ts**: Removed legacy `uploadFloorPDF` re-export

**Αρχεία**:
- `src/config/domain-constants.ts` — LEGACY_STORAGE_PATHS expanded
- `src/services/upload/processors/PDFProcessor.ts` — canonical method + deprecations
- `src/subapps/dxf-viewer/services/dxf-firestore.service.ts` — storagePath persistence
- `src/services/attendance/attendance-server-service.ts` — canonical with fallback
- `src/app/api/upload/photo/route.ts` — canonical params support
- `src/services/upload/index.ts` — removed legacy re-export
- `src/lib/pdf-utils.ts` — deprecation header

### 2026-02-13 — Critical Bug Fixes (VERIFIED WORKING)

> **ΣΗΜΕΙΩΣΗ**: Το photo upload pipeline λειτουργεί σωστά. ΜΗΝ ΤΡΟΠΟΠΟΙΕΙΤΕ τα παρακάτω αρχεία χωρίς σοβαρό λόγο.

**Bug 1: Duplicate photo σε 2 consecutive slots** (commit `8d894bfc`)
- **Αιτία**: `ContactDetails.tsx` `enhancedFormData` useMemo συνένωνε `getMultiplePhotoURLs(contact)` πάνω στα ήδη mapped `formData.multiplePhotos` από τον `individualMapper.ts`, διπλασιάζοντας τις εγγραφές
- **Λύση**: Αφαίρεση του redundant κώδικα μετατροπής — ο `individualMapper.ts` είναι η μοναδική πηγή αλήθειας
- **Αρχεία**: `src/components/contacts/details/ContactDetails.tsx`

**Bug 2: addCacheBuster URL corruption** (commit `1dc71775`)
- **Αιτία**: `addCacheBuster` χρησιμοποιούσε `?` separator ακόμα κι όταν το URL είχε ήδη query params, δημιουργώντας invalid double-`?` URLs
- **Λύση**: Χρήση `&` separator όταν το URL περιέχει ήδη `?`
- **Αρχεία**: `src/hooks/useCacheBusting.ts`

**Bug 3: Stale closure σε async upload callbacks** (commit `533f7e95`)
- **Αιτία**: Τα handlers στο `MultiplePhotosFull` έκλειναν πάνω σε stale `formData` state
- **Λύση**: `useRef` pattern + functional updater `setEditedData(prev => ({...prev, multiplePhotos}))` στο `ContactDetails.tsx`
- **Αρχεία**: `MultiplePhotosFull.tsx`, `MultiplePhotosCompact.tsx`, `ContactDetails.tsx`

### Αρχεία που ΔΕΝ πρέπει να αλλάξουν (σταθεροποιημένα 2026-02-13)

| Αρχείο | Λόγος |
|--------|-------|
| `src/utils/contactForm/fieldMappers/individualMapper.ts` | SSoT για multiplePhotoURLs → PhotoSlot[] |
| `src/components/contacts/details/ContactDetails.tsx` | Σωστό data flow χωρίς duplicate μετατροπή |
| `src/hooks/useCacheBusting.ts` | Σωστό URL handling με & separator |
| `src/components/ui/MultiplePhotosFull.tsx` | useRef pattern για async uploads |
| `src/components/ui/MultiplePhotosCompact.tsx` | useRef pattern για async uploads |
| `src/components/ui/EnterprisePhotoUpload.tsx` | Stable upload component |
| `src/hooks/upload/useAutoUploadEffect.ts` | Stable auto-upload trigger |

### 2026-03-24 — Dead Code Cleanup: pdf-utils.ts DELETED

- **Αφαίρεση**: `src/lib/pdf-utils.ts` (414 γραμμές) — ολόκληρο deprecated module
- **Λόγος**: Zero active imports. Όλη η λειτουργικότητα έχει μεταφερθεί στο `PDFProcessor.ts` + `UnifiedUploadService`
- **Επίδραση**: Κανένα — κανένα αρχείο δεν εισήγαγε functions από αυτό το module
- **Αρχιτεκτονική**: Εξάλειψη τελευταίου legacy PDF upload module — πλέον μόνο canonical pipeline

---

## Related Documents (Upload Architecture)

| Document | Relationship | Context |
|----------|-------------|---------|
| **[ADR-292](./ADR-292-floorplan-upload-consolidation-map.md)** | **Hub** | Full upload architecture map — all 6 paths, service diagram, consolidation roadmap |
| **[ADR-018](./ADR-018-unified-upload-service.md)** | Upstream | Foundation — Gateway + Strategy pattern this ADR builds upon |
| **[ADR-190](./ADR-190-photo-upload-ssot-consolidation.md)** | Extends | Photo upload deduplication — applies SSoT principle to photo/logo handlers |
| **[ADR-191](./ADR-191-enterprise-document-management.md)** | Downstream | FileRecord lifecycle model — documents stored via paths defined here |
| **[ADR-060](./ADR-060-building-floorplan-enterprise-storage.md)** | Sibling | Building floorplan storage migration — parallel consolidation effort |
| **[ADR-293](./ADR-293-file-naming-storage-path-ssot-audit.md)** | Audit | Naming/path SSoT audit — adoption metrics (33 call sites) and remaining violations for patterns defined here |

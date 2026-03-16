# SPEC-237D: Floorplan Import Pipeline — Horizontal UI

| Field | Value |
|-------|-------|
| **ADR** | ADR-237 |
| **Phase** | D — Floorplan Import Pipeline UI |
| **Priority** | MEDIUM |
| **Status** | ✅ IMPLEMENTED |
| **Estimated Effort** | 2 sessions |
| **Prerequisite** | SPEC-237A (Level-to-Floor mapping) |
| **Dependencies** | Ανεξάρτητο — μπορεί να υλοποιηθεί παράλληλα με SPEC-237B/C |

---

## 1. Objective

Δημιουργία **οριζόντιου pipeline UI** (wizard) για εισαγωγή κατόψεων στο σύστημα — από την επιλογή εταιρείας μέχρι το upload αρχείου. Αυτό ΔΕΝ είναι νέα υποδομή — είναι **UI layer** πάνω σε existing enterprise services.

**Κεντρική αρχή**: Κανένα νέο service δεν δημιουργείται. Ο wizard καλεί τα **existing** `FloorplanSaveOrchestrator`, `FloorFloorplanService`, `UnitFloorplanService`, `BuildingFloorplanService`.

---

## 2. Τρέχουσα Κατάσταση Κώδικα (Source of Truth)

### 2.1 FloorplanSaveOrchestrator — 4-Step Pattern

**Αρχείο**: `src/services/floorplans/floorplan-save-orchestrator.ts`

```typescript
/**
 * Centralizes the 4-step FileRecord save pattern:
 * 1. FileRecordService.createPendingFileRecord() → fileId, storagePath
 * 2. Upload binary to Firebase Storage (JSON / gzip / raw file)
 * 3. getDownloadURL() → downloadUrl
 * 4. FileRecordService.finalizeFileRecord() → status: ready
 */

type FloorplanPayload =
  | { kind: 'json'; data: SceneModel }
  | { kind: 'gzip-json'; data: SceneModel | Record<string, unknown> }
  | { kind: 'raw-file'; file: File; compress?: boolean };

interface FloorplanSaveInput {
  companyId: string;
  projectId?: string;
  entityType: EntityType;
  entityId: string;
  domain: FileDomain;
  category: FileCategory;
  purpose: string;
  displayName: string;
  originalFilename: string;
  ext: string;
  payload: FloorplanPayload;
  createdBy: string;
}
```

**REUSE αυτό** — ο wizard στέλνει `FloorplanSaveInput` στον orchestrator.

### 2.2 3 Floorplan Services

| Service | Αρχείο | Entity Type |
|---------|--------|------------|
| `BuildingFloorplanService` | `src/services/floorplans/BuildingFloorplanService.ts` | building |
| `FloorFloorplanService` | `src/services/floorplans/FloorFloorplanService.ts` | floor |
| `UnitFloorplanService` | `src/services/floorplans/UnitFloorplanService.ts` | unit |

Κάθε service:
- Validates input
- Calls `FloorplanSaveOrchestrator.saveFloorplan()`
- Dispatches `FLOORPLAN_CREATED` event via RealtimeService
- Returns result

### 2.3 Storage Path Pattern

**Αρχείο**: `src/services/upload/utils/storage-path.ts`

```
companies/{companyId}/projects/{projectId}/entities/{entityType}/{entityId}/
  domains/{domain}/categories/{category}/files/{fileId}.{ext}
```

Paths περιέχουν **μόνο IDs** — ποτέ human-readable names.

### 2.4 Existing Import UI Components

| Component | Αρχείο | Status |
|-----------|--------|--------|
| `ImportWizard` | `src/subapps/dxf-viewer/ui/ImportWizard.tsx` | DXF-specific wizard — ΜΗΝ reuse (different context) |
| `DxfImportModal` | `src/subapps/dxf-viewer/components/DxfImportModal.tsx` | DXF import modal — reference for UX patterns |
| `EntityFilesManager` | `src/components/shared/files/EntityFilesManager.tsx` | Generic file upload UI — REUSE for upload step |
| `useFloorplanUpload` | `src/hooks/useFloorplanUpload.ts` | Upload hook — REUSE |

### 2.5 FileRecord Schema

**Αρχείο**: `src/services/file-record.service.ts`

```typescript
interface FileRecord {
  id: string;                    // file_xxxxx
  companyId: string;             // Tenant isolation
  entityType: 'floor' | 'unit' | 'building';
  entityId: string;
  domain: 'construction';
  category: 'floorplans';
  purpose: 'floor-floorplan' | 'unit-floorplan' | 'building-floorplan';
  displayName: string;
  originalFilename: string;
  ext: string;                   // 'dxf' | 'pdf' | 'json'
  status: 'pending' | 'ready' | 'failed';
  storagePath: string;
  downloadUrl?: string;
  sizeBytes?: number;
  createdBy: string;
  createdAt: string;             // ISO8601
}
```

### 2.6 Κεντρικοποιημένη Ονοματοδοσία

| Τύπος | Display Name Pattern |
|-------|---------------------|
| Γενική Κάτοψη | "Γενική Κάτοψη - {buildingName}" |
| Κάτοψη Ορόφου | "Κάτοψη Ορόφου - {floorName}" |
| Κάτοψη Μονάδας | "Κάτοψη Μονάδας - {unitName}" |

---

## 3. Pipeline Steps (Horizontal Wizard)

### Overview

```
┌──────┐   ┌──────┐   ┌──────┐   ┌──────┐   ┌──────┐   ┌──────┐
│  1   │ → │  2   │ → │  3   │ → │  4   │ → │  5   │ → │  6   │
│Εται- │   │Έργο  │   │Κτίριο│   │Όροφος│   │Τύπος │   │Upload│
│ρεία  │   │      │   │      │   │      │   │Κάτοψ.│   │      │
└──────┘   └──────┘   └──────┘   └──────┘   └──────┘   └──────┘
```

### Step 1: Επιλογή Εταιρείας

| Field | Value |
|-------|-------|
| **Data Source** | Firestore `companies` collection |
| **Selection** | Dropdown / list |
| **Output** | `companyId: string` |
| **Auto-skip** | ❌ ΑΦΑΙΡΕΘΗΚΕ (2026-03-16) — ο χρήστης επιλέγει πάντα χειροκίνητα |

### Step 2: Επιλογή Έργου

| Field | Value |
|-------|-------|
| **Data Source** | Firestore `projects` where `companyId === selected` |
| **Selection** | Dropdown / list |
| **Output** | `projectId: string` |
| **Dependency** | Step 1 (companyId) |

### Step 3: Επιλογή Κτιρίου

| Field | Value |
|-------|-------|
| **Data Source** | Firestore `buildings` where `projectId === selected` |
| **Selection** | Dropdown / list |
| **Output** | `buildingId: string` |
| **Dependency** | Step 2 (projectId) |
| **Auto-skip** | ❌ ΑΦΑΙΡΕΘΗΚΕ (2026-03-16) — ο χρήστης επιλέγει πάντα χειροκίνητα |

### Step 4: Επιλογή Ορόφου

| Field | Value |
|-------|-------|
| **Data Source** | Firestore `floors` where `buildingId === selected` |
| **Selection** | Dropdown / list (sorted by `number`) |
| **Output** | `floorId: string`, `floorNumber: number` |
| **Dependency** | Step 3 (buildingId) |
| **Special** | Εμφάνιση "Γενική Κάτοψη" option (building-level, χωρίς floor) |

### Step 5: Τύπος Κάτοψης

| Field | Value |
|-------|-------|
| **Options** | Γενική Κάτοψη Κτιρίου / Κάτοψη Ορόφου / Κάτοψη Μονάδας |
| **Output** | `floorplanType: 'building' \| 'floor' \| 'unit'` |
| **Dependency** | Step 4 determines available options |
| **Logic** | Αν επιλέχθηκε floor → Κάτοψη Ορόφου default. Αν "Γενική" → Κάτοψη Κτιρίου. |

**Conditional Branch**:
- Αν `floorplanType === 'unit'` → εμφάνιση sub-step: Επιλογή Μονάδας (units where `floorId === selected`)
- Αν `floorplanType === 'building'` → floor selection optional (building-level)
- Αν `floorplanType === 'floor'` → proceed to upload

### Step 6: Upload Αρχείου

| Field | Value |
|-------|-------|
| **Accepted Types** | `.dxf`, `.pdf`, `.jpg`, `.png` |
| **Max Size** | 50MB |
| **Upload Method** | Drag & drop + file picker |
| **Processing** | `FloorplanSaveOrchestrator.saveFloorplan()` |
| **Progress** | Real-time progress bar (upload %, processing status) |
| **Result** | Success → redirect to viewer / Error → retry option |

---

## 4. Service Routing Logic

Βάσει των επιλογών του wizard, ο σωστός service καλείται:

```
floorplanType === 'building'
  → BuildingFloorplanService.saveFloorplan({
      companyId, buildingId, file, createdBy
    })

floorplanType === 'floor'
  → FloorFloorplanService.saveFloorplan({
      companyId, floorId, file, createdBy
    })

floorplanType === 'unit'
  → UnitFloorplanService.saveFloorplan({
      companyId, unitId, file, createdBy
    })
```

Κάθε service:
1. Validates input
2. Calls `FloorplanSaveOrchestrator` (4-step pattern)
3. Dispatches `FLOORPLAN_CREATED` event
4. Returns `FileRecord`

---

## 5. UI/UX Design

### Wizard Layout

```
┌─────────────────────────────────────────────────────────────┐
│  ΕΙΣΑΓΩΓΗ ΚΑΤΟΨΗΣ                                          │
│                                                              │
│  ● Εταιρεία  ─  ○ Έργο  ─  ○ Κτίριο  ─  ○ Όροφος  ─  ○   │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                                                        │  │
│  │  [Εταιρεία selection content]                          │  │
│  │                                                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│                                    [← Πίσω]  [Επόμενο →]   │
└─────────────────────────────────────────────────────────────┘
```

### Step Indicator

- **Horizontal progress bar** — dots/circles connected by lines
- Active step: filled circle + bold label
- Completed steps: checkmark + clickable (go back)
- Future steps: empty circle + dimmed label

### Navigation Controls

| Button | Action | Condition |
|--------|--------|-----------|
| ← Πίσω | Go to previous step | Disabled on Step 1 |
| Επόμενο → | Go to next step | Disabled if no selection |
| ✕ Ακύρωση | Close wizard | Always available |
| ✓ Upload | Start upload | Only on Step 6 with file selected |

### Auto-Skip Logic — ❌ ΑΦΑΙΡΕΘΗΚΕ (2026-03-16)

~~Αν company/project/building count === 1 → auto-select + skip~~

**Λόγος αφαίρεσης**: Το auto-skip προκαλούσε race condition στο Step 3 (buildings) —
τα buildings εξάγονταν από `projectsRawRef` που δεν είχε ενημερωθεί ακόμα.
Επιπλέον, ο χρήστης δεν μπορούσε να δει τι επιλέχθηκε αυτόματα, δημιουργώντας σύγχυση.

**Τρέχουσα συμπεριφορά**: Ο χρήστης επιλέγει χειροκίνητα σε κάθε βήμα.
Μπορεί να πατήσει "Πίσω" για να αλλάξει οποιαδήποτε επιλογή.

---

## 6. Κεντρικοποιημένα Συστήματα (REUSE ONLY)

| Σύστημα | Αρχείο | Χρήση στο SPEC-237D |
|---------|--------|---------------------|
| `FloorplanSaveOrchestrator` | `src/services/floorplans/floorplan-save-orchestrator.ts` | 4-step upload pattern |
| `BuildingFloorplanService` | `src/services/floorplans/BuildingFloorplanService.ts` | Building floorplan save |
| `FloorFloorplanService` | `src/services/floorplans/FloorFloorplanService.ts` | Floor floorplan save |
| `UnitFloorplanService` | `src/services/floorplans/UnitFloorplanService.ts` | Unit floorplan save |
| `FileRecordService` | `src/services/file-record.service.ts` | FileRecord CRUD |
| `storage-path.ts` | `src/services/upload/utils/storage-path.ts` | Canonical path builder |
| `useFloorplanUpload` | `src/hooks/useFloorplanUpload.ts` | Upload hook with progress |
| `EntityFilesManager` | `src/components/shared/files/EntityFilesManager.tsx` | File upload UI patterns |
| `ImportWizard` | `src/subapps/dxf-viewer/ui/ImportWizard.tsx` | UX reference (step-by-step pattern) |
| `DxfImportModal` | `src/subapps/dxf-viewer/components/DxfImportModal.tsx` | Modal + DXF import UX reference |
| `RealtimeService` | `src/services/realtime/` | Event dispatch (FLOORPLAN_CREATED) |

---

## 7. Prohibitions

- ⛔ **ΜΗΝ δημιουργήσεις** νέο upload service — χρησιμοποίησε `FloorplanSaveOrchestrator`
- ⛔ **ΜΗΝ δημιουργήσεις** νέο storage path pattern — χρησιμοποίησε `storage-path.ts`
- ⛔ **ΜΗΝ δημιουργήσεις** νέο FileRecord interface — χρησιμοποίησε `FileRecordService`
- ⛔ **ΜΗΝ δημιουργήσεις** νέο naming pattern — χρησιμοποίησε κεντρικοποιημένη ονοματοδοσία
- ⛔ **ΜΗΝ** χρησιμοποιήσεις inline styles — Tailwind utilities only
- ⛔ **ΜΗΝ** χρησιμοποιήσεις `any` type — proper TypeScript generics

---

## 8. Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| 1 | Wizard εμφανίζεται σωστά (horizontal steps) | Visual — step indicator |
| 2 | Company → Project → Building → Floor cascade | Selection propagation |
| 3 | ~~Auto-skip~~ ΑΦΑΙΡΕΘΗΚΕ — χρήστης επιλέγει πάντα χειροκίνητα | Manual selection at every step |
| 4 | Back navigation λειτουργεί σε κάθε step | Click "Πίσω" |
| 5 | DXF file upload → FloorplanSaveOrchestrator | FileRecord created in Firestore |
| 6 | PDF file upload λειτουργεί | FileRecord + Storage upload |
| 7 | Image file upload λειτουργεί | FileRecord + Storage upload |
| 8 | Progress bar δείχνει real-time progress | Upload % visible |
| 9 | Success → FLOORPLAN_CREATED event dispatched | RealtimeService subscriber notified |
| 10 | Error handling: retry option on failure | Upload retry button |
| 11 | Σωστό `displayName` βάσει κεντρικοποιημένης ονοματοδοσίας | FileRecord.displayName matches pattern |
| 12 | Σωστό `storagePath` βάσει canonical path | FileRecord.storagePath matches pattern |

---

## 9. Σχετικά ADRs & SPECs

| Αναφορά | Σχέση |
|---------|-------|
| **ADR-237** | Parent ADR — Polygon Overlay Bridge |
| **ADR-031** | Canonical File Storage System |
| **ADR-060** | Building Floorplan Enterprise Storage |
| **ADR-187** | Floor-Level Floorplans (IFC-Compliant) |
| **ADR-196** | Unit Floorplan Enterprise FileRecord Migration |
| **ADR-202** | Floorplan Save Orchestrator |
| **SPEC-237A** | Prerequisite — Level-to-Floor mapping |

---

## 10. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Large file upload timeout | MEDIUM | Progress bar + retry mechanism |
| Company/Project/Building cascade latency | LOW | Parallel Firestore queries where possible |
| User confusion σε πολλά steps | LOW | Clear step indicator + back navigation |
| DXF parsing failure | LOW | Error message + retry, fallback to raw upload |
| Concurrent uploads (same floor) | LOW | Last-write-wins — same as existing pattern |

---

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-03-16 | IMPLEMENTED — 5 new files in `src/features/floorplan-import/`, i18n keys added (el+en), zero new services | Claude |
| 2026-03-16 | FIX: Race condition στο companies fetch — αφαίρεση `step !== 1` guard από useEffect deps | Claude |
| 2026-03-16 | FIX: Αφαίρεση auto-skip λογικής — προκαλούσε race condition στο buildings step + κακή UX. Ο χρήστης επιλέγει χειροκίνητα πλέον | Claude |
| 2026-03-16 | FIX: Αφαίρεση "Αυτόματη επιλογή" UI — single items εμφανίζονται ως radio buttons, απαιτούν explicit κλικ πριν το "Επόμενο" | Claude |
| 2026-03-16 | FIX: Step 3 (buildings) — αντικατάσταση embedded data από projectsRawRef με proper API call `GET /api/buildings?projectId=xxx`. Πιο αξιόπιστο, με fallback σε companyId | Claude |
| 2026-03-16 | FEAT: Multi-level unit support (ADR-236) — μεζονέτες/penthouses δείχνουν level selector μετά την επιλογή μονάδας. `levelFloorId` περνά στο upload config. i18n `select.level` keys (el+en) | Claude |

### Implementation Notes

**New files:**
- `src/features/floorplan-import/index.ts` — Barrel exports
- `src/features/floorplan-import/FloorplanImportWizard.tsx` — Main wizard (Dialog + WizardProgress + step routing)
- `src/features/floorplan-import/components/StepEntitySelector.tsx` — Generic entity selector (steps 1-4), radio ≤5 / Radix Select >5
- `src/features/floorplan-import/components/StepFloorplanType.tsx` — 3 radio cards + conditional unit selector
- `src/features/floorplan-import/components/StepUpload.tsx` — FileUploadZone + progress bar + success/error
- `src/features/floorplan-import/hooks/useFloorplanImportState.ts` — State machine (6 steps, cascading API, manual selection)

**Modified files:**
- `src/i18n/locales/el/files.json` — +floorplanImport.* (34 keys)
- `src/i18n/locales/en/files.json` — +floorplanImport.* (34 keys)

**Reused systems:** apiClient, useFloorplanUpload, FileUploadZone, WizardProgress, Dialog, Radix Select, useFirestoreUnits, Spinner

---

*SPEC Format based on: ADR-237 Polygon Overlay Bridge*
*Enterprise standards inspired by: Autodesk, Adobe, Bentley Systems, SAP, Google*

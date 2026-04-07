# ADR-240: Floorplan Pipeline Unification — Wizard → ΚΑΤΟΨΗ ΟΡΟΦΟΥ

| Field | Value |
|-------|-------|
| **Status** | ✅ IMPLEMENTED |
| **Date** | 2026-03-17 |
| **Category** | Entity Systems / File Storage |
| **Author** | ADR-Driven Workflow |
| **Related** | ADR-031 (File Storage), ADR-179 (Floorplan Types), ADR-031 (Canonical File Storage), ADR-239 (Entity Linking) |

---

## Πρόβλημα

Τα floor plans που ανεβαίνουν μέσω του **"Εισαγωγή Κάτοψης (Wizard)"** δεν εμφανίζονται στο tab **"ΚΑΤΟΨΗ ΟΡΟΦΟΥ"**, ενώ τα floor plans από το **"Enhanced DXF Import"** (SimpleProjectDialog) εμφανίζονται κανονικά.

### Σύγκριση των δύο pipelines

| Βήμα | Enhanced DXF Import (λειτουργεί) | Wizard (δεν εμφανίζεται) |
|------|----------------------------------|--------------------------|
| **Αποθήκευση** | `FloorFloorplanService.saveFloorplan()` → `FloorplanSaveOrchestrator` | `useFloorplanUpload` → raw DXF upload |
| **Τι αποθηκεύεται** | Parsed JSON scene | Raw DXF binary |
| **FileRecord `entityType`** | `'floor'` ✅ | `'floor'` ✅ (από useFloorplanUpload) |
| **FileRecord `category`** | `'floorplans'` ✅ | `'floorplans'` ✅ |
| **FileRecord `processedData`** | `null` (αλλά `ext: 'json'` → PATH C) | `null` (και `ext: 'dxf'` → PATH D ή processing spinner) |
| **DXF Viewer auto-save** | ΝΑΙ (μέσω onSceneImported) | ΝΑΙ (μέσω onSceneImported) |
| **Εμφανίζεται στο tab** | ✅ ΝΑΙ | ❌ ΟΧΙ |

---

## Root Cause Analysis — 3 Bugs

### Bug #1 — `writeToFilesCollection()`: Hardcoded `entityType: 'building'`

**Αρχείο:** `src/subapps/dxf-viewer/services/dxf-firestore.service.ts`

Κάθε φορά που ο DXF viewer κάνει auto-save (μετά τη φόρτωση του αρχείου), η `writeToFilesCollection()` γράφει ένα **δεύτερο** FileRecord στη `files` collection με λάθος δεδομένα:

```typescript
// ❌ ΛΑΘΟΣ — hardcoded τιμές ανεξάρτητα από context
entityType: 'building' as const,
entityId: context?.buildingId ?? 'standalone',
category: 'drawings' as const,    // πρέπει 'floorplans'
purpose: undefined,                // πρέπει 'floor-floorplan'
```

**Αποτέλεσμα:** Δημιουργείται ένα "σκουπίδι" FileRecord με `entityType: 'building'` που:
- Δεν εμφανίζεται στο ΚΑΤΟΨΗ ΟΡΟΦΟΥ (που ψάχνει `entityType: 'floor'`)
- Μολύνει τη `files` collection με λάθος records
- Παίζει ρόλο μόνο στη `cadFiles` logic — δεν πρέπει να γράφεται στα `files` χωρίς σωστό context

### Bug #2 — `FloorFloorplanInline` χρησιμοποιεί `useEntityFiles` αντί `useFloorplanFiles`

**Αρχείο:** `src/components/building-management/tabs/FloorFloorplanInline.tsx`

Το component χρησιμοποιεί `EntityFilesManager` → `useEntityFiles`, το οποίο **ΔΕΝ** έχει auto-processing για unprocessed DXF files.

Αντίθετα, το `useFloorplanFiles` έχει `processUnprocessedFiles()` που καλεί `/api/floorplans/process` για files χωρίς `processedData`.

**Αποτέλεσμα:** Ο Wizard ανεβάζει raw DXF με `processedData: null`. Το `FloorplanGallery` βλέπει:
- `ext === 'dxf'`
- `processedData === null`
- `status === 'ready'`

→ Πέφτει στο **PATH D** (client-side parse), που προσπαθεί να κάνει parse raw DXF binary με `DxfSceneBuilder.buildScene()`. Αν ο viewer είναι κλειστός ή η parsing αποτύχει, εμφανίζεται spinner "processing" ή κενό canvas.

### Bug #3 — Wizard `onComplete` callback triggεράρει `autoSaveV3` με λάθος context

**Αρχείο:** `src/subapps/dxf-viewer/ui/toolbar/EnhancedDXFToolbar.tsx`

```typescript
onComplete={(file) => {
  setShowImportWizard(false);
  onSceneImported?.(file);  // ← φορτώνει αρχείο στο DXF viewer → autoSaveV3
}}
```

Όταν ο Wizard ολοκληρωθεί, το αρχείο φορτώνεται στο DXF viewer, που triggεράρει `autoSaveV3`. Αλλά σε αυτό το σημείο:
- Το `DxfSaveContext` **δεν γνωρίζει** το `floorId` που επέλεξε ο χρήστης στον Wizard
- Το dual-write γράφει `entityType: 'building'` (Bug #1) αντί `entityType: 'floor'`
- Το σωστό FileRecord (από `useFloorplanUpload`) ΔΕΝ έχει `processedData` → μένει unprocessed

---

## Τρέχουσα Αρχιτεκτονική — FloorplanGallery Loading Paths

```
FloorplanGallery.loadScene(fileRecord)
  ├── PATH A: processedData?.scene → use directly (embedded scene, legacy)
  ├── PATH B: processedData?.processedDataPath → fetch via /api/floorplans/scene (server auth)
  ├── PATH C: ext === 'json' AND downloadUrl → fetch + parse as JSON scene ← Enhanced DXF Import
  └── PATH D: ext === 'dxf' AND status === 'ready' → client-side DxfSceneBuilder.buildScene() ← Wizard (ΑΠΟΤΥΧΑΙΝΕΙ)
```

**Enhanced DXF Import λειτουργεί γιατί:**
- Αποθηκεύει parsed JSON scene (όχι raw DXF) με `FloorplanSaveOrchestrator`
- `ext` παράγεται από `originalFilename` (π.χ. `_AfrPolGD.dxf`) → `ext: 'dxf'`
- Αλλά το `downloadUrl` δείχνει σε JSON content → PATH D προσπαθεί DXF parse
- **Αντίφαση:** Δουλεύει πιθανώς επειδή το DXF viewer auto-save (`writeToFilesCollection`) γράφει ένα record με `processedData` που περιέχει `processedDataPath` → PATH B εκτελείται για αυτό το record

**Wizard ΔΕΝ λειτουργεί γιατί:**
- Ανεβάζει raw DXF (πραγματικό binary DXF αρχείο)
- `processedData: null`
- Κανείς δεν καλεί `/api/floorplans/process` για auto-processing
- `FloorFloorplanInline` χρησιμοποιεί `useEntityFiles` που δεν έχει auto-processing

---

## Ευρήματα Κεντρικοποιημένων Συστημάτων (Υπάρχουσα Υποδομή)

| Σύστημα | Αρχείο | Ρόλος |
|---------|--------|-------|
| `useFloorplanFiles` | `src/hooks/useFloorplanFiles.ts` | Real-time listener + **auto-processing** (υπάρχει!) |
| `FloorplanSaveOrchestrator` | `src/services/floorplans/floorplan-save-orchestrator.ts` | Κεντρικό 4-βήμα save pattern |
| `/api/floorplans/process` | `src/app/api/floorplans/process/route.ts` | Server-side DXF → JSON processing |
| `FloorFloorplanService` | `src/services/floorplans/FloorFloorplanService.ts` | Floor-specific save/load |
| `FileRecordService` | `src/services/file-record.service.ts` | CRUD για FileRecords |
| `EntityFilesManager` | `src/components/shared/files/EntityFilesManager.tsx` | Orchestrator component |

**Κρίσιμο εύρημα:** Η υποδομή για auto-processing **ΗΔΗ ΥΠΑΡΧΕΙ** στο `useFloorplanFiles`. Δεν χρειάζεται να δημιουργηθεί νέος μηχανισμός — πρέπει να χρησιμοποιηθεί το υπάρχον σύστημα.

---

## Απόφαση

### Προσέγγιση: Ενοποίηση μέσω `useFloorplanFiles` + Wizard post-processing

**ΑΡΧΗ:** REUSE υπαρχόντων κεντρικοποιημένων συστημάτων. ZERO νέα infrastructure.

**Στρατηγική:**
1. **`FloorFloorplanInline`**: Αντικατάσταση `useEntityFiles` pattern με `useFloorplanFiles` (που έχει built-in auto-processing)
2. **`DxfFirestoreService.writeToFilesCollection()`**: Fix hardcoded values — να δέχεται πλήρες context (`entityType`, `entityId`, `purpose`, `category`)
3. **`DxfSaveContext`**: Επέκταση για να περιέχει `floorId`, `purpose`, `entityType` — ώστε το auto-save να γράφει σωστά records
4. **`EnhancedDXFToolbar`**: Μετάδοση Wizard context (floorId, purpose) στον DXF viewer για σωστό auto-save

**Τι ΔΕΝ αλλάζει:**
- `FloorplanSaveOrchestrator` — reused as-is
- `/api/floorplans/process` — reused as-is
- `FloorplanGallery` PATH logic — reused as-is
- `useFloorplanUpload` — reused as-is

---

## Βήματα Υλοποίησης (Google-Level)

### Phase 1 — Fix `DxfSaveContext` + `writeToFilesCollection()`

**Αρχείο:** `src/subapps/dxf-viewer/services/dxf-firestore.service.ts`

**Βήμα 1.1** — Επέκταση `DxfSaveContext` interface:
```typescript
export interface DxfSaveContext {
  companyId?: string;
  projectId?: string;
  buildingId?: string;
  floorId?: string;
  createdBy?: string;
  canonicalScenePath?: string;
  // --- ΝΕΕΣ ΠΕΔΙΑ ---
  /** entityType για το files collection record (default: 'building' για backward compat) */
  entityType?: 'building' | 'floor' | 'unit';
  /** purpose για το files collection record */
  purpose?: string;
  /** category για το files collection record (default: 'drawings') */
  filesCategory?: 'drawings' | 'floorplans';
}
```

**Βήμα 1.2** — Fix `writeToFilesCollection()`:
- `entityType`: Χρησιμοποίησε `context?.entityType ?? 'building'` (backward compat)
- `entityId`: Αν `entityType === 'floor'` → `context?.floorId ?? 'standalone'`, αλλιώς `context?.buildingId ?? 'standalone'`
- `category`: Χρησιμοποίησε `context?.filesCategory ?? 'drawings'`
- `purpose`: Χρησιμοποίησε `context?.purpose ?? undefined`
- Πρόσθεσε `lifecycleState: 'active'` (required by `getFilesByEntity`)

**Βήμα 1.3** — Guard: Αν `context?.entityType` είναι undefined (παλιό call site) → skip dual-write εντελώς ή γράφε μόνο αν `context?.buildingId` υπάρχει (αποτρέπει "σκουπίδια" records).

---

### Phase 2 — Μετάδοση context από Wizard στο DXF viewer

**Αρχείο:** `src/subapps/dxf-viewer/ui/toolbar/EnhancedDXFToolbar.tsx`

**Στόχος:** Όταν ο Wizard ολοκληρωθεί, ο DXF viewer πρέπει να γνωρίζει το `floorId` + `purpose` για σωστό auto-save context.

**Βήμα 2.1** — `FloorplanImportWizard.onComplete` να επιστρέφει metadata:
```typescript
// Τρέχον:
onComplete: (file: File) => void;

// Νέο:
onComplete: (file: File, meta: { entityType: 'floor'; entityId: string; purpose: string; companyId: string }) => void;
```

**Βήμα 2.2** — `EnhancedDXFToolbar` να μεταδίδει το context στο DXF viewer μέσω callback `onUpdateSaveContext`:
```typescript
onComplete={(file, meta) => {
  setShowImportWizard(false);
  onUpdateSaveContext?.(meta);  // ← ενημερώνει DxfSaveContext στο viewer
  onSceneImported?.(file);
}}
```

**Βήμα 2.3** — DXF viewer: Αποδοχή `onUpdateSaveContext` prop και ενημέρωση `DxfSaveContext` πριν το `autoSaveV3`.

---

### Phase 3 — `FloorFloorplanInline`: Ενεργοποίηση auto-processing

**Αρχείο:** `src/components/building-management/tabs/FloorFloorplanInline.tsx`

**Τρέχουσα κατάσταση:**
```typescript
<EntityFilesManager
  displayStyle="floorplan-gallery"
  // ↑ Χρησιμοποιεί useEntityFiles — ΔΕΝ έχει auto-processing
/>
```

**Επιλογή Α (Προτεινόμενη):** Πρόσθεσε prop `autoProcessFloorplans={true}` στο `EntityFilesManager` που, όταν `displayStyle='floorplan-gallery'`, εκτελεί `processUnprocessedFiles()` (ίδια λογική με `useFloorplanFiles`).

**Επιλογή Β:** Αντικατέστησε εσωτερικά το `useEntityFiles` με `useFloorplanFiles` στο `EntityFilesManager` όταν `displayStyle='floorplan-gallery'` — αλλά αυτό είναι πιο invasive.

**Λόγος επιλογής Α:**
- Minimal change (1 prop, 1 flag)
- Η logic `processUnprocessedFiles()` ήδη υπάρχει και δουλεύει
- `EntityFilesManager` παραμένει generic — μόνο για `floorplan-gallery` mode ενεργοποιείται

**Υλοποίηση:**
- `EntityFilesManager`: Δέχεται `autoProcessFloorplans?: boolean` prop
- Όταν `displayStyle === 'floorplan-gallery' && autoProcessFloorplans === true`: Μετά το fetch των files, κάλεσε `/api/floorplans/process` για κάθε file με `status === 'ready'` και `processedData === null`
- Χρησιμοποίησε `useCallback` + `useEffect` με debounce (300ms) για να αποφύγεις repeated calls

---

### Phase 4 — Validation & Edge Cases

**Βήμα 4.1** — Guard για duplicate FileRecords: Αν `useFloorplanUpload` έχει ήδη γράψει ένα σωστό FileRecord (`entityType: 'floor'`) και μετά το `autoSaveV3` γράφει άλλο με ίδιο `fileId` → το `merge: true` θα κάνει update (OK). Αλλά αν τα `fileId` διαφέρουν → δύο records. Χρειάζεται **correlation**: το `FileRecord.id` από `useFloorplanUpload` πρέπει να περαστεί ως `canonicalScenePath` context στο viewer ώστε το auto-save να χρησιμοποιεί το ίδιο `fileId`.

**Βήμα 4.2** — `FloorplanGallery` PATH logic update: Για files με `ext: 'dxf'` και `processedData.processedDataPath` → PATH B (authenticated fetch). Βεβαιώσου ότι το PATH B δουλεύει για `storagePath` που δείχνει σε private Firebase Storage path.

**Βήμα 4.3** — Sold/Rented locking: Η νέα auto-processing logic πρέπει να ελέγχει `commercialStatus` πριν trigger processing (consistency με ADR-239 field locking pattern).

---

## Συνολικά Αρχεία

| Αρχείο | Ενέργεια | Phase |
|--------|---------|-------|
| `src/subapps/dxf-viewer/services/dxf-firestore.service.ts` | MODIFY — Fix `writeToFilesCollection` + extend `DxfSaveContext` | 1 |
| `src/features/floorplan-import/FloorplanImportWizard.tsx` | MODIFY — `onComplete` callback επιστρέφει metadata | 2 |
| `src/subapps/dxf-viewer/ui/toolbar/EnhancedDXFToolbar.tsx` | MODIFY — Μεταδίδει Wizard context στο viewer | 2 |
| DXF viewer state management (TBD) | MODIFY — Αποδοχή + αποθήκευση `DxfSaveContext` update | 2 |
| `src/components/shared/files/EntityFilesManager.tsx` | MODIFY — `autoProcessFloorplans` prop + processing logic | 3 |
| `src/components/building-management/tabs/FloorFloorplanInline.tsx` | MODIFY — Πρόσθεσε `autoProcessFloorplans={true}` | 3 |

**Αρχεία που ΔΕΝ αλλάζουν (REUSE):**
- `src/services/floorplans/floorplan-save-orchestrator.ts`
- `src/app/api/floorplans/process/route.ts`
- `src/hooks/useFloorplanFiles.ts`
- `src/services/floorplans/FloorFloorplanService.ts`
- `src/hooks/useFloorplanUpload.ts`
- `src/components/shared/files/media/FloorplanGallery.tsx`

---

## Verification Checklist

1. **Wizard flow end-to-end:**
   - Ανέβασε DXF μέσω Wizard για floor X
   - Βεβαιώσου ότι FileRecord δημιουργήθηκε με `entityType: 'floor'`, `entityId: floorX`, `purpose: 'floor-floorplan'`
   - Άνοιξε ΚΑΤΟΨΗ ΟΡΟΦΟΥ για floor X → εμφανίζεται ✅

2. **Auto-processing trigger:**
   - FileRecord έχει `status: 'ready'`, `processedData: null`
   - `EntityFilesManager` καλεί `/api/floorplans/process`
   - FileRecord ενημερώνεται με `processedData.processedDataPath`
   - `FloorplanGallery` φορτώνει μέσω PATH B ✅

3. **DXF viewer auto-save δεν μολύνει `files` collection:**
   - Μετά από Wizard upload, το `autoSaveV3` γράφει record με `entityType: 'floor'` (ΟΧΙ `'building'`)
   - Ή: αν δεν υπάρχει `entityType` context → skip dual-write εντελώς ✅

4. **Enhanced DXF Import (regression test):**
   - Δεν πρέπει να σπάσει — SimpleProjectDialog δεν αλλάζει ✅

5. **TypeScript:** `npx tsc --noEmit` → 0 νέα errors ✅

---

## Changelog

| Date | Change |
|------|--------|
| 2026-03-17 | Initial implementation — Phase 1 (DxfSaveContext + writeToFilesCollection fix) + Phase 3 (EntityFilesManager auto-processing). Phase 2 (Wizard context propagation) pending next session. |
| 2026-03-17 | ADR δημιουργήθηκε — ευρήματα + βήματα υλοποίησης |

---

## Related Documents (Upload Architecture)

| Document | Relationship | Context |
|----------|-------------|---------|
| **[ADR-292](./ADR-292-floorplan-upload-consolidation-map.md)** | **Hub** | Full upload architecture map — all 6 paths, service diagram, consolidation roadmap |
| **[ADR-202](./ADR-202-floorplan-save-orchestrator.md)** | Upstream | 4-step save orchestrator — canonical save pattern this ADR builds upon |
| **[ADR-196](./ADR-196-unit-floorplan-enterprise-filerecord.md)** | Upstream | Unit FileRecord migration — prerequisite that exposed the wizard disconnect bug |
| **[ADR-179](./ADR-179-ifc-compliant-floorplan-hierarchy.md)** | Upstream | IFC hierarchy — structural change that created the floor-tab visibility gap |
| **[ADR-288](./ADR-288-cad-file-metadata-centralization.md)** | Downstream | CAD metadata centralization — server-side solution for cadFiles dual-write identified here |
| **[ADR-293](./ADR-293-file-naming-storage-path-ssot-audit.md)** | Audit | Naming/path SSoT audit — wizard context propagation confirmed as fixing naming/path correctness |

# SPEC-214-10: DXF Viewer Collections Migration

| Metadata | Value |
|----------|-------|
| **ADR** | ADR-214 |
| **Phase** | 10 |
| **Status** | COMPLETED |
| **Risk** | LOW |
| **Αρχεία** | 4 modified + 2 infrastructure |
| **Depends On** | SPEC-214-01 |

---

## Στόχος

Migration DXF Viewer Firestore operations (overlays, CAD files reads). Pragmatic scope λόγω 3 τεχνικών περιορισμών.

---

## Αλλαγές που Έγιναν

### 1. `src/subapps/dxf-viewer/overlays/overlay-store.tsx` — ADR-210 Compliance

- `addDoc` → `generateOverlayId()` + `setDoc` (enterprise ID generation)
- Αφαιρέθηκε import `addDoc`, προστέθηκε import `generateOverlayId`
- Subcollection pattern (`dxf-overlay-levels/{levelId}/items`) διατηρείται as-is (firestoreQueryService δεν υποστηρίζει subcollections)

### 2. `src/subapps/dxf-viewer/services/dxf-firestore.service.ts` — Reads Migrated

- `getFileMetadata()` → `firestoreQueryService.getById('CAD_FILES', fileId)`
- `getFile()` (private) → `firestoreQueryService.getById('CAD_FILES', fileId)`
- `fileExists()` → `firestoreQueryService.getById('CAD_FILES', fileId) !== null`
- Write methods (setDoc + Firebase Storage) untouched — coupled with Storage operations

### 3. `src/services/enterprise-id.service.ts` — New Prefixes

- `OVERLAY: 'ovrl'` prefix + `generateOverlayId()` method + convenience export
- `LEVEL: 'lvl'` prefix + `generateLevelId()` method + convenience export

### 4. `src/services/firestore/tenant-config.ts` — New Entries

- `CAD_FILES: { mode: 'none', fieldName: '' }`
- `DXF_OVERLAY_LEVELS: { mode: 'none', fieldName: '' }`

---

## Αρχεία που SKIP-αρίστηκαν

### `ReadOnlyLayerViewer.tsx` — Already migrated in Phase 7

### `LevelsSystem.tsx` — SKIP (3 reasons)

| Περιορισμός | Λεπτομέρεια |
|-------------|-------------|
| **Collection name mismatch** | Κώδικας χρησιμοποιεί `'dxf-viewer-levels'` (actual Firestore), αλλά `COLLECTIONS.DXF_VIEWER_LEVELS` = `'dxfViewerLevels'` — ΔΙΑΦΟΡΕΤΙΚΑ! Migration θα query-αρε ΛΑΘΟΣ collection. |
| **writeBatch** | 4 batch operations χωρίς centralized εναλλακτική στο firestoreQueryService |
| **Subcollection pattern** | Ίδιο πρόβλημα με overlay-store — `dxf-overlay-levels/{levelId}/items` |

**Future fix**: Correct `COLLECTIONS.DXF_VIEWER_LEVELS` value to `'dxf-viewer-levels'` πρώτα, μετά migrate.

---

## Verification Checklist

- [x] Overlays add() uses enterprise ID (`ovrl_` prefix)
- [x] CAD file reads use firestoreQueryService
- [x] `addDoc` removed from overlay-store.tsx
- [x] `getDoc` removed from dxf-firestore.service.ts
- [x] tenant-config entries for CAD_FILES + DXF_OVERLAY_LEVELS
- [x] `npx tsc --noEmit` clean (background check)
- [ ] Manual: Overlays CRUD works in DXF Viewer
- [ ] Manual: File loading works (autoSaveV3, loadFileV2)

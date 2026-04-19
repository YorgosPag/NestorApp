# ADR-018.1: Photos Tab Base Template

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Last Updated** | 2026-02-13 |
| **Category** | Entity Systems |
| **Canonical Location** | `PhotosTabBase` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `PhotosTabBase` from photo-system
- **Result**: 79% code reduction

---

## Photo Upload & Preview — Stabilization Notice (2026-02-13)

> **ΣΗΜΕΙΩΣΗ**: Το σύστημα φωτογραφιών (upload, preview, gallery) λειτουργεί σωστά μετά από σειρά bug fixes.
> **ΜΗΝ ΤΡΟΠΟΠΟΙΕΙΤΕ** τα αρχεία που αναφέρονται παρακάτω χωρίς σοβαρό λόγο.

### Σχετικά ADRs
- **ADR-054**: Enterprise Upload System Consolidation — πλήρες changelog των fixes

### Photo Preview Modal Fix (commit `e33ec40e`)
- **Πρόβλημα**: Η fullscreen προεπισκόπηση φωτογραφιών ξεχείλιζε αριστερά και πάνω από την οθόνη
- **Αιτία**: Το `DialogContent` (Radix) εφαρμόζει `translate-x-[-50%] translate-y-[-50%]` centering, το οποίο δεν αντικαθιστάτο από τα `inset-0` classes
- **Λύση**: Πρόσθεση `!translate-x-0 !translate-y-0 !left-0 !top-0` overrides στο `photoPreviewLayout` (`src/styles/design-tokens.ts`)
- **Αρχείο**: `src/styles/design-tokens.ts` → `photoPreviewLayout.dialog.desktop` / `.mobile`

### Αρχεία που ΔΕΝ πρέπει να αλλάξουν

| Αρχείο | Λόγος |
|--------|-------|
| `src/styles/design-tokens.ts` (section `photoPreviewLayout`) | Σωστό positioning με override centering transforms |
| `src/core/modals/PhotoPreviewModal.tsx` | Stable fullscreen gallery με zoom/rotate/pan |

> Βλέπε **ADR-054** για πλήρη λίστα σταθεροποιημένων αρχείων του upload pipeline.

---

## Changelog

### 2026-04-19 — StoragePhotosTab migrated to EntityFilesManager (SSoT unification)

**Motivation**: Apartment / parking / storage photo tabs had two divergent UX flows:
- Apartment + parking → `EntityFilesManager` + `UploadEntryPointSelector` → category cards **before** upload (pre-upload selection).
- Storage → `PhotosTabBase` + `usePhotosCategories` → category filter **after** upload (in-memory filter).

User requested a single, unified flow across all three entities.

**Changes**:
- `src/components/space-management/StoragesPage/StorageDetails/tabs/StoragePhotosTab.tsx` — rewritten to use `EntityFilesManager` (same pattern as `ParkingPhotosTab`).
- `src/config/upload-entry-points/entries-parking.ts` — added 3 photo entry points: `parking-interior-photo`, `parking-exterior-photo`, `parking-progress-photo` (no "view" for parking).
- `src/config/upload-entry-points/entries-storage.ts` — added 3 photo entry points: `storage-interior-photo`, `storage-exterior-photo`, `storage-progress-photo` (no "view" for storage).
- `src/i18n/locales/{el,en}/storage.json` — added `auth.signInToViewPhotos` key.

**Canonical for photo tab (all entities)**: `EntityFilesManager` + per-entity `*_ENTRY_POINTS` with `category: 'photos'`.

**`PhotosTabBase` scope after this change**: only `src/components/building-management/tabs/PhotosTabContent.tsx` still consumes it. Future work may migrate that too.

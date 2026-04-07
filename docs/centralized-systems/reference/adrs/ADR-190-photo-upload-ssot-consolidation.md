# ADR-190: Photo/Logo Upload System — SSoT Consolidation

**Status**: Accepted
**Date**: 2026-03-06
**Category**: Infrastructure / File Upload

---

## Context

The photo/logo upload system evolved organically across 16+ files. After bug fixes (flickering, save issues), analysis revealed **3 actual duplications** — not 16 scattered files. Most files are proper abstraction layers, not duplicates.

### Duplications Found

1. **Dead Code**: `hooks/contactForm/modular/orchestrator.ts` exported `useContactFormState()` but **no production code** imported it. The real hook lives at `hooks/useContactFormState.ts`.

2. **Logo Validation Duplication**: `hooks/useContactLogoHandlers.ts` (169 lines) duplicated validation (image type + 5MB + allowed types) already handled by `useEnterpriseFileUpload.validateAndPreview()`.

3. **Upload Handler Creation — 2 paths**:
   - `PhotoUploadConfiguration.ts` called `FirebasePhotoUploadService.uploadPhoto()` directly
   - `defaultUploadHandler.ts` provided `createUploadHandlerFromPreset()` factory (canonical)
   - Same result, different interface.

---

## Decision

### Phase 1: Remove Dead Code (ZERO RISK)
- **Deleted** `hooks/contactForm/modular/orchestrator.ts`
- **Cleaned** `hooks/contactForm/index.ts` barrel exports

### Phase 2: Centralise Logo Validation (LOW RISK)
- **Deleted** `hooks/useContactLogoHandlers.ts`
- **Simplified** `hooks/useContactFormHandlers.ts` — logo validation is handled by `EnterprisePhotoUpload` -> `useEnterpriseFileUpload.validateAndPreview()` (SSoT)
- **Removed** `logoHandlers` from `useContactForm.ts` return API (no consumer existed)

### Phase 3: Unify Upload Handler Factory (MEDIUM RISK)
- **Refactored** `PhotoUploadConfiguration.ts` → `getPhotoUploadHandlers()` now uses `createUploadHandlerFromPreset()` from `@/services/upload-handlers`
- **Removed** direct `FirebasePhotoUploadService.uploadPhoto()` calls, `LEGACY_STORAGE_PATHS`, `UPLOAD_PURPOSE`, `COMPRESSION_USAGE` imports
- External interface unchanged — `UnifiedContactTabbedSection.tsx` unaffected

---

## Canonical Architecture

```
Config:          file-upload-config.ts, photo-compression-config.ts
Core State:      useFileUploadState.ts
Firebase:        photo-upload.service.ts
Handler Factory: upload-handlers/defaultUploadHandler.ts  <-- SSoT for handler creation
Enterprise Hook: useEnterpriseFileUpload.ts               <-- SSoT for validation
Upload Utils:    useAutoUploadEffect.ts, useFileSelectionHandlers.ts, usePhotoUploadLogic.ts
Form State:      useContactFormState.ts                   <-- SSoT for form photo/logo state
Save Pipeline:   photo-urls.ts -> data-cleaning.ts -> mappers -> EnterpriseContactSaver
UI Components:   EnterprisePhotoUpload -> MultiplePhotosUpload -> UnifiedPhotoManager
```

---

## Files Changed

| Action | File |
|--------|------|
| DELETED | `src/hooks/contactForm/modular/orchestrator.ts` |
| DELETED | `src/hooks/useContactLogoHandlers.ts` |
| MODIFIED | `src/hooks/contactForm/index.ts` |
| MODIFIED | `src/hooks/useContactFormHandlers.ts` |
| MODIFIED | `src/hooks/useContactForm.ts` |
| MODIFIED | `src/components/ContactFormSections/utils/PhotoUploadConfiguration.ts` |

---

## Consequences

- **Positive**: Single path for upload handler creation, no duplicate validation, less dead code
- **Negative**: None — external interfaces unchanged, all consumers unaffected
- **Risk**: Low — validation still happens in `useEnterpriseFileUpload`, factory presets match previous config exactly

---

## Related Documents (Upload Architecture)

| Document | Relationship | Context |
|----------|-------------|---------|
| **[ADR-292](./ADR-292-floorplan-upload-consolidation-map.md)** | **Hub** | Full upload architecture map — all 6 paths, service diagram, consolidation roadmap |
| **[ADR-054](./ADR-054-enterprise-upload-system-consolidation.md)** | Upstream | Enterprise upload consolidation — parent initiative this ADR refines for photos |
| **[ADR-018](./ADR-018-unified-upload-service.md)** | Upstream | Unified Upload Service — Gateway + Strategy foundation |
| **[ADR-191](./ADR-191-enterprise-document-management.md)** | Downstream | FileRecord model — photo uploads create records following this lifecycle |
| **[ADR-293](./ADR-293-file-naming-storage-path-ssot-audit.md)** | Audit | Naming/path SSoT audit — violation #4: `useEnterpriseFileUpload` still uses legacy paths for new photo uploads |

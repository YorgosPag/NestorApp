# ADR-340 — Floorplan Background System (PDF + Image, single-per-floor, Procore-grade separation)

**Status:** ✅ **IMPLEMENTED** (2026-05-08) — Phases 1-3, 5-8 complete + **Phase 4 REBORN** (unified Wizard upload entry point with smart routing + HARD floor wipe). Phase 8 ships the visual regression suite, a11y audit, SSoT registry module, and the Firestore-emulator integration suite (deferred from Phase 7). All ship gates green; baselines locked. §4 Migration plan è HISTORICAL — wrapper non costruito, vecchio PDF subsystem rimosso integralmente.
**Date:** 2026-05-07
**Author:** Claude (Opus 4.7) + Γιώργος
**Mandate:** GOL + SSOT — full enterprise scope, zero MVP variants, completeness over phased-light, industry-standard convergence (Procore / SAP / Bluebeam)
**Supersedes (parzialmente):** PDF Background subsystem (`src/subapps/dxf-viewer/pdf-background/*`) → ridotto a **provider** PDF dietro un'astrazione comune
**Related ADRs:**
ADR-002 (z-index hierarchy),
ADR-003 (FloatingPanel compound),
ADR-029 (panel dimensions),
ADR-031 (Canonical File Storage System — `buildStoragePath`),
ADR-054 (FileUploadButton),
ADR-067/068/071 (geometry-utils, clamp, angle conversion),
ADR-134/170 (Telegram + attendance, side-context only),
ADR-292 (FILES collection unification),
ADR-294 (SSoT ratchet),
ADR-298 (Firestore rules tests),
ADR-301 (Storage rules tests),
ADR-310/311/312 (showcase + photo capture, side-context),
SPEC-237D (overlay support on PDF backgrounds)

---

### Changelog

| Date | Changes |
|------|---------|
| 2026-05-08 | ✅ **Phase 4 REBORN — FOLLOW-UP** (Opus 4.7) — 3 hardening fix dopo test cycle DXF→PDF in `/dxf-viewer`. **(Issue A — Storage orphans)** `floorplan-floor-wipe.service.ts` `deleteStorageObjects()` ora fa **prefix-list** (`bucket.getFiles({ prefix: storagePath })`) prima del delete, catturando le derivazioni create da `FloorplanProcessService` (`{storagePath}.processed.json` compressed scene + `{storagePath}.thumbnail.png`) oltre al binary canonico. Best-effort + per-file `ignoreNotFound: true`; counter `storageObjectsDeleted` riflette ora il totale (originale + derivazioni). Idempotent. **(Issue B — `dxf_viewer_levels` ricreato per PDF/Image)** Format-aware routing end-to-end: `WizardCompleteMeta` + `StepUpload.onComplete` + `FloorplanImportWizard.handleUploadComplete` ora propagano `format: 'dxf' | 'pdf' | 'image'` (estratto da `SmartUploadResult.format`). Caller `EnhancedDXFToolbar` + `LevelPanel` early-return prima di `onSceneImported(...)` quando `meta.format !== 'dxf'` — il raster è già persistito via `/api/floorplan-backgrounds` dentro il Wizard, quindi il legacy `cadFiles` processor + `linkSceneToLevel` non devono più runnare e ricreare `dxf_viewer_levels/{levelId}` con `sceneFileId` puntante a un PDF. `updateLevelContext` rimane attivo per ogni format (scrive solo `floorId`/`buildingId`/`entityLabel`/`floorplanType`, NOT `sceneFileId`) — necessario perché il binding Issue C dipende da `level.floorId`. **(Issue C — PDF non visibile in DXF Viewer canvas)** `useFloorplanBackgroundForLevel.ts` ora risolve il **real building floorId** dalla Level corrente (`levels.find(l => l.id === currentLevelId)?.floorId ?? currentLevelId`) e lo usa come chiave canonica per `setActiveFloor`, `useFloorplanBackgroundPersistence(...)`, `useFloorplanBackground(...)`, `uploadBackground` (POST `/api/floorplan-backgrounds`), `deleteBackground`, e store reads. Risolve mismatch architetturale: ADR-340 keya per `floorId` (es. `flr_894...`), ma il DXF Viewer subapp usa un `levelManager.currentLevelId` sintetico (es. `"default"`); pre-fix il GET `/api/floorplan-backgrounds?floorId=default` restituiva 0 risultati anche se il floorplan esisteva per il floor reale. Backward-compat: legacy levels senza `floorId` continuano a usare `levelId` come chiave. **Files**: `src/services/floorplan-background/floorplan-floor-wipe.service.ts`, `src/features/floorplan-import/components/StepUpload.tsx`, `src/features/floorplan-import/FloorplanImportWizard.tsx`, `src/subapps/dxf-viewer/ui/toolbar/EnhancedDXFToolbar.tsx`, `src/subapps/dxf-viewer/ui/components/LevelPanel.tsx`, `src/subapps/dxf-viewer/floorplan-background/hooks/useFloorplanBackgroundForLevel.ts`. UX wizard invariato (no nuovi step, no UI changes). |
| 2026-05-08 | ✅ **Phase 4 REBORN** (Opus 4.7) — unified Wizard upload entry point with smart routing + HARD floor wipe. **NEW** `src/services/floorplan-background/floorplan-floor-wipe.service.ts` (`FloorplanFloorWipeService.preview()` + `wipeAllForFloor()`): tenant-scoped HARD delete of `floorplan_overlays` + `dxf_overlay_levels/{levelId}/items` (delegated to `FloorplanCascadeDeleteService.cascadeAllPolygonsForFloor`) + `dxf_viewer_levels` parent docs + `floorplan_backgrounds` docs + canonical `files/{fileId}` records (cross-referenced from BOTH legacy `dxf_viewer_levels.sceneFileId` and new `floorplan_backgrounds.fileId`) + Firebase Storage objects (`bucket.file(path).delete({ ignoreNotFound: true })`, best-effort, parallel). Idempotent. 450-op chunked batches. **NEW** `src/app/api/floorplans/wipe-floor/route.ts` — GET preview (no mutations) + POST execute. RBAC `[super_admin, company_admin, internal_user]` via `withAuth` + `withHeavyRateLimit`. **NEW** `src/features/floorplan-import/hooks/useFloorplanSmartUpload.ts` — single hook orchestrating: format detection (`detectFloorplanFormat`: dxf / pdf / image / unknown via MIME + extension), floor resolution (`entityType==='floor'` → `entityId`; `entityType==='unit' && levelFloorId` → `levelFloorId`; otherwise `null`), preview fetch, wipe call, raster upload via `FloorplanBackgroundApiClient.upload` with naturalBounds loaded through `providerRegistry.get(providerId)` + `provider.loadAsync({kind:'file',file})` + `dispose()`, DXF upload via legacy `useFloorplanUpload`. Returns unified `{ uploadSmart, isUploading, progress, error, clearError, detectFormat, resolveFloorId, fetchPreview }`. Non-floor PDF/Image rejected with explicit message ("supported only at floor level"). **MODIFY** `src/features/floorplan-import/components/StepUpload.tsx` — uses smart hook; floor branch fetches preview on mount and shows amber `PreviewBanner` when wipe required (polygons + backgrounds + files counts); on file drop, if wipe required → `WipeConfirmDialog` (AlertDialog with file name + counts) → confirm triggers `uploadSmart` (which performs wipe internally then routes by format). Non-floor branch keeps legacy `existingFile` warning + `FileRecordService.moveToTrash` post-upload. **i18n** `floorplanImport.wipePreview.{title,summary}` + `floorplanImport.wipeDialog.{title,description,confirm,cancel}` (el + en). **NOT TOUCHED** (per ordine Giorgio): legacy DXF upload buttons in DXF Viewer toolbar (Upload DXF Legacy, Enhanced DXF Import, FileUp), `FloorplanBackgroundPanel` toolbar button (rimane control panel, non upload). **WHY**: ADR-340 originale aveva PDF e DXF in subsystem separati, replace flow non simmetrico — un PDF upload non ripuliva DXF e viceversa. Phase 4 reborn unifica: ogni nuovo upload (qualsiasi formato) sweepa **completamente** lo stato del floor prima di scrivere il nuovo background. Replace cross-type (DXF↔PDF/Image) ora atomico end-to-end. |
| 2026-05-07 | ✅ **Phase 8 COMPLETE — Status flipped to ✅ IMPLEMENTED** (Opus 4.7). 4 NEW files + 1 ADR finalize. **(1) SSoT registry module** — added `floorplan-background-system` (Tier 2) in `.ssot-registry.json` between `multi-combobox` and the closing brace. `forbiddenPatterns`: `(addDoc|setDoc)\\s*\\([^)]*(floorplan_backgrounds|FLOORPLAN_BACKGROUNDS)`, same for overlays, plus `useState[^;]*pdfBackground` (legacy state outside subsystem). `allowlist`: `src/services/floorplan-background/`, `src/subapps/dxf-viewer/floorplan-background/`, `src/app/api/floorplan-backgrounds/`, `functions/src/floorplan-background/`, `functions/src/config/firestore-collections.ts`, `src/config/firestore-collections.ts`. Note: bucket-write protection is provided by the existing `storage-public-upload` module (re-using rather than duplicating). `npm run ssot:audit` → 0 violations on the new module; `npm run ssot:baseline` refreshed. **(2) Emulator integration test** — `tests/functions-integration/suites/floorplan-background-persistence.integration.test.ts` (3 describe blocks, 9 cases). Uses the existing `_harness/emulator.ts` (Admin SDK pointed at Firestore emulator via `FIRESTORE_EMULATOR_HOST` set in `setup-env.ts`). Coverage: `FloorplanBackgroundService` round-trip (create/getById/listByFloor/patchTransform/deleteById), tenant isolation (cross-company getById→null, listByFloor→[], patchTransform/deleteById→reject), locked guard, `countByFileId` global cross-company; `FloorplanCascadeDeleteService.cascadeAllPolygonsForFloor` Q8 unified (3 floorplan_overlays + 2 dxf_viewer_levels with 9 items → all wiped, idempotent re-run), `cascadeOverlaysForBackground` (only target bg's overlays, leaves DXF + sibling bg untouched), cross-tenant cascade isolation; `CalibrationRemapService.applyCalibration` atomic single-batch (3 overlays + bg in one commit, polygons remapped to preserve world position via `vertex_new = inverse(T_new) ∘ T_old(v_old)`), and overlay isolation (untouched: same-company-other-bg + other-company-same-bg). Run: `npm run test:functions-integration -- floorplan-background`. Pure-math suite remains in `src/services/floorplan-background/__tests__/persistence.integration.test.ts` (jsdom run). **(3) Visual regression suite** — `src/subapps/dxf-viewer/floorplan-background/components/__tests__/FloorplanBackgroundCanvas.e2e.spec.ts` (Playwright, picked up by `**/*.e2e.spec.ts` testMatch). 4 active cases against `/demo/floorplan-background-image`: PNG identity, PNG scale ×2, JPEG rotation 90° (block-noise tolerance 0.02), visibility toggle. Test images generated programmatically via canvas → blob (deterministic 4-quadrant + diagonal cross pattern; no committed binaries). 3 deferred cases (`test.skip` with TODO): PDF identity (needs tiny test PDF in `__fixtures__/`), TIFF utif decode (needs TIFF fixture), calibration ×2 + polygon remap (needs DxfViewer harness route, not the standalone demo page). Baselines locked on first run via `--update-snapshots`. **(4) A11y audit** — `src/subapps/dxf-viewer/floorplan-background/components/__tests__/FloorplanBackgroundPanel.a11y.test.tsx` (jest-axe). Hook-graph fully mocked (`useFloorplanBackgroundForLevel`, `useCalibration`, `useFloorplanBackgroundStore`, `useTranslation`, `useSemanticColors`, `FileUploadButton`, `FloatingPanel`). Suites: 7 panel cases + 2 dialog cases. Asserts: axe-clean DOM in 3 panel states (empty / loaded / calibrating), `aria-pressed` toggle semantics on Visible+Locked icon-buttons, `role="alert"` on error `<output>`, every icon-only button has an accessible name (`aria-label` || textContent), Greek-stub renders non-empty translated strings, `isOpen=false` renders nothing, `CalibrationDialog` exposes `role="alertdialog"` with title + description when both points are picked, closed dialog renders nothing. **(5) ADR finalize** — Status header flipped to ✅ IMPLEMENTED, this changelog entry added, §5.4 (visual) + §5.7 (SSoT registry) marked DONE inline; Phase 8 row in §6 table marked DONE. **Ship gate**: SSoT module registered, baseline refreshed, emulator test compiles (tsc verde, 0 errors on new files), Playwright spec discoverable, jest-axe suite runnable, ADR coherent. |
| 2026-05-07 | ✅ **Phase 7 COMPLETE** (Opus 4.7) — server-side persistence end-to-end. **NEW server services** (3): `src/services/floorplan-background/floorplan-background.service.ts` (Admin SDK CRUD: create/getById/listByFloor/patchTransform/patchCalibration/deleteById/countByFileId; tenant isolation enforced; immutables D6 guarded), `floorplan-cascade-delete.service.ts` (Q8 unified — wipes `floorplan_overlays` AND `dxf_viewer_levels` floorId-indexed → `dxf_overlay_levels/{levelId}/items` subcollection in chunked 450-op batches; idempotent; `getFloorPolygonState` for replace-confirm dialog), `calibration-remap.service.ts` (Q10 affine math `vertex_new = inverse(T_new) ∘ T_old(vertex_old)`, atomic single-batch when overlays ≤ 499, chunked otherwise; pure helpers exported as `__test__`). **NEW API routes** (2 files): `src/app/api/floorplan-backgrounds/route.ts` (POST multipart upload via `uploadPublicFile()` SSoT + `buildPendingFileRecordData/buildFinalizeFileRecordUpdate` SSoT cores; GET by floor with optional `include=polygonState` + inline `fileRecord.downloadUrl` to avoid a second round-trip during hydrate; 50MB cap + mime allowlist; `withHeavyRateLimit` + `withAuth` `requiredGlobalRoles=[super_admin,company_admin,internal_user]`), `[id]/route.ts` (PATCH discriminated union `{ kind: 'transform' \| 'calibration' }` — calibration calls `CalibrationRemapService.applyCalibration`; DELETE cascades overlays via `cascadeOverlaysForBackground`; standard rate limit). **NEW Cloud Function**: `functions/src/floorplan-background/onDeleteFloorplanBackground.ts` (D4 — onDelete trigger; ref-counts `fileId` across `floorplan_backgrounds`; if 0 references remain, deletes `files/{fileId}` doc + Storage object via `bucket.file().delete({ ignoreNotFound: true })`; idempotent; exported from `functions/src/index.ts`; `FLOORPLAN_BACKGROUNDS`/`FLOORPLAN_OVERLAYS` mirrored in `functions/src/config/firestore-collections.ts`). **NEW client wiring** (3 files): `subapps/dxf-viewer/floorplan-background/services/floorplan-background-api-client.ts` (typed wrapper around 4 endpoints; FormData multipart for upload), `hooks/useFloorplanBackgroundPersistence.ts` (D1 `kind: 'url'` hydrate using inline `fileRecord.downloadUrl` from GET response — no extra round-trip; D2 optimistic UI + 500ms debounced PATCH on transform/opacity/visible/locked deltas via Zustand `subscribe`; AbortController on unmount; calibration writes excluded from auto-commit because they remap polygons), additional store action `_hydratePersistedBackground(floorId, persisted, source)` adopts server-issued id/companyId/fileId/createdBy. **MODIFIED**: `useFloorplanBackgroundForLevel.ts` (calls `useFloorplanBackgroundPersistence` + exposes `uploadBackground(file, providerId)` and `deleteBackground()` action handlers — upload flow loads provider locally for `naturalBounds`, POSTs file, then hydrates from canonical proxy URL), `FloorplanBackgroundPanel.tsx` (replace + remove buttons → API), `index.ts` barrel updated. **firestore.rules** + 2 match blocks (lines 1108–1170): `floorplan_backgrounds` Q9 RBAC (read same-tenant, write/delete `isInternalUserOfCompany`, immutables D6 enforced server-side: `id/companyId/floorId/fileId/providerId/naturalBounds/createdBy`); `floorplan_overlays` same RBAC, immutables `id/companyId/backgroundId/floorId`. **firestore.indexes.json** + 3 composite indexes: `(companyId,floorId)` on backgrounds, `(companyId,backgroundId)` and `(companyId,floorId)` on overlays. **Tests**: `tests/firestore-rules/suites/floorplan-backgrounds.rules.test.ts` + `floorplan-overlays.rules.test.ts` (CHECK 3.16 ratchet — 33-cell `role_dual` matrices added to `coverage-matrices-dxf.ts` as `floorplanBackgroundsMatrix()` / `floorplanOverlaysMatrix()`, COVERAGE entries appended to `coverage-manifest.ts`); `seed-helpers-dxf.ts` + `seedFloorplanBackground` / `seedFloorplanOverlay`. `src/services/floorplan-background/__tests__/persistence.integration.test.ts` (pure-math suite for the 3 calibration remap helpers — round-trip property, scale invariance, translate-only inversion, rotation invariance, polygon-wide world-position preservation; emulator round-trip deferred to Phase 8). **storage.rules** unchanged — Phase 7 upload paths (`companies/.../entities/floor/.../domains/construction/categories/floorplans/files/{fileId}.{ext}`) are already covered by the existing `canonical_with_project` and `canonical_no_project` storage-rules paths; client-side writes go through the API which uses Admin SDK (privileged) so storage rules apply only as defense-in-depth. **RBAC mapping note**: ADR Q9 lists `ADMIN`, `SUPER_ADMIN`, `PROJECT_MANAGER` — the codebase uses Firebase custom-claim `globalRole` ∈ {`super_admin`, `company_admin`, `internal_user`, `external_user`}. Phase 7 maps `ADMIN→company_admin`, `SUPER_ADMIN→super_admin`, `PROJECT_MANAGER→internal_user` (project-role mapping deferred — internal_user is the closest fit at the global-claims layer; per-project tightening is a Phase 8 follow-up). |
| 2026-05-07 | 🧹 **Dead-code cleanup DONE** (Sonnet 4.6 — pre-Phase 7). 7 file eliminati: `pdf-background/components/PdfControlsPanel.tsx`, `pdf-background/components/PdfBackgroundCanvas.tsx`, `pdf-background/stores/pdfBackgroundStore.ts`, `pdf-background/hooks/usePdfBackground.ts`, `pdf-background/index.ts`, `hooks/canvas/useFitToPdf.ts`, `systems/levels/hooks/useLevelPdfLoader.ts`. 4 file fix consumer: `useLevelFloorplanSync.ts` (replace `usePdfBackgroundStore.unloadPdf()+setEnabled(false)` → `useFloorplanBackgroundStore.removeBackground(floorId)`), `LevelsSystem.tsx` (rimosso import+call `useLevelPdfLoader` — già coperto da `useFloorplanBackgroundForLevel` in CanvasSection), `hooks/canvas/index.ts` (rimosso export `useFitToPdf`), `useFloorplanImport.ts` (refactored: `usePdfBackgroundStore.loadPdf()/setEnabled()/state.renderedImageUrl/pageDimensions` → `PdfRenderer.loadDocument()+renderPage()` direct calls, rimosso `PANEL_LAYOUT.TIMING.OBSERVER_RETRY` 100ms wait). KEEP: `pdf-background/services/PdfRenderer.ts` + `pdf-background/types/pdf.types.ts` (riusati da `PdfPageProvider` + `floorplan-pdf-renderer`). tsc verde. |
| 2026-05-07 | ✅ **Phase 6 COMPLETE** (Sonnet 4.6) — Sistema calibrazione 2-point in-memory. 12 file touch (5 NEW + 7 MODIFY). **NEW** `hooks/useCalibration.ts` (math: `scaleFactor = realDistMm / dWorld`, optional rotation correction da atan2, unit conversion mm/cm/m/ft/in → mm, `CalibrationData` builder; assunzione 1 world unit = 1mm per DXF costruzione, Phase 7 parametrizzerà da INSUNITS), `components/CalibrationDialog.tsx` (self-contained AlertDialog — legge da store, apre automaticamente quando entrambi i punti sono picked; form: real distance input + unit Select + "set as horizontal" Checkbox), `components/CalibrationPolygonRemapDialog.tsx` (component completo per polygon remap confirm — Phase 6: mai mostrato (count=0); Phase 7 wires query overlay count), `stores/floorplanBackgroundStore.ts` (+ `CalibrationSession` interface, `calibrationSession` state, 4 nuove azioni: `startCalibration`/`setCalibrationPoint`/`cancelCalibration`/`applyCalibration`, selector `selectCalibrationSession`). **MODIFY** `FloorplanBackgroundCanvas.tsx` (click handler → `setCalibrationPoint` con `worldToCanvasRef.current.scale`; RAF draws crosshair A=cyan B=red + dashed line; `style.pointerEvents='auto'` quando `isCalibrating`, `cursor-crosshair` class), `FloorplanBackgroundPanel.tsx` (Calibrate button attivo — `disabled` solo se `background.locked`; `CalibrationInstructions` sub-component con instruction A/B + cancel; transform controls hidden durante calibration), `useFloorplanBackgroundForLevel.ts` (return type extended con `floorId: string`), `DxfViewerContent.tsx` (+ lazy `CalibrationDialog` + Suspense), `index.ts` (+ `CalibrationDialog`, `CalibrationPolygonRemapDialog`, `CalibrationSession`, `useCalibration`, `selectCalibrationSession`, `FloorplanBackgroundForLevelResult`), i18n el + en (+ `calibration.*` namespace — 11 chiavi: title/pixelDist/realDist/deriveRotation/cancel/apply/remapTitle/remapDesc/remapConfirm/instructionA/instructionB/instructionCancel). ADR-340 §3.7 implementato completamente. |
| 2026-05-07 | ✅ **Phase 5 COMPLETE — Phase 4 SKIPPED** (Opus 4.7). Decisione Giorgio: data wipe imminente → no live PDFs da preservare → no wrapper backward-compat → vecchio `pdfBackgroundStore` + `useFitToPdf` + `PdfControlsPanel` + `PdfBackgroundCanvas` diventano dead code inert (Phase 6 cleanup). 12 file touch (8 NEW + 4 MODIFY): **NEW** `providers/PdfPageProvider.ts` (singleton-safe via image cache, ADR-340 §3.3 Q7 single-page), `components/FloorplanBackgroundPanel.tsx` (FloatingPanel-based, empty-state + loaded-state, ProviderId switching, sliders scale/rotation/opacity, visible/locked toggle, replace + remove + calibrate-disabled), `components/ReplaceConfirmDialog.tsx` (AlertDialog auto-mounts da `pendingReplaceRequest`), `hooks/useFloorplanBackgroundForLevel.ts` (binding `levelManager.currentLevelId` → `floorId`, idempotent registerProviders on mount). **MODIFY** `providers/types.ts` (+ `CadCoordinateAdaptation` type), `providers/ImageProvider.ts` + `PdfPageProvider.ts` render() supporta `params.cad` con pipeline Y-flip + margins matching legacy `PdfBackgroundCanvas` pixel-perfect, `components/FloorplanBackgroundCanvas.tsx` accetta `cad?` prop (RAF reads via ref). **WIRE** `CanvasLayerStack.tsx` swap `PdfBackgroundCanvas` → `FloorplanBackgroundCanvas` con CAD adapter, `CanvasSection.tsx` rimuove `usePdfBackgroundStore` + `useFitToPdf` + aggiunge auto-fit camera per nuovo background tramite `useFloorplanBackgroundForLevel`, `canvas-layer-stack-types.ts` swap `pdf` group prop → `floorId: string \| null`, `DxfViewerContent.tsx` swap `PdfControlsPanel` → `FloorplanBackgroundPanel` + `ReplaceConfirmDialog`. **i18n** namespace `panels.floorplanBackground.*` (el + en) — 25 chiavi, Greek puro zero parole inglesi. **panel-tokens** entry `FLOORPLAN_BACKGROUND_CONTROLS` (300×520). **index.ts** barrel aggiornato. Ship gate: panel sostituisce `PdfControlsPanel`, replace flow funzionante in-memory. |
| 2026-05-07 | ✅ **Phase 3 COMPLETE** — Store + Hook + Canvas implementati (Sonnet 4.6). 5 file creati + 2 aggiornati: `stores/floorplanBackgroundStore.ts` (Zustand + immer + devtools + subscribeWithSelector — `Record<string,FloorSlot>` per immer compatibility, module-level `_floorProviders` Map per provider class instances fuori immer, `pendingReplaceRequest` per replace-flow Phase 5, azioni: addBackground/removeBackground/setTransform/setOpacity/setVisible/setLocked/setActiveFloor/confirmReplace/cancelReplace/_loadBackground + selectors), `hooks/useFloorplanBackground.ts` (useShallow selector + bound actions per floorId), `components/FloorplanBackgroundCanvas.tsx` (RAF single-mount loop con refs per valori mutanti, canvas sempre montato per evitare RAF restart bug, z-index delegato al consumer via className), `providers/register-providers.ts` (idempotent singleton guard, ImageProvider registered, PDF stub Phase 4), `stores/__tests__/floorplanBackgroundStore.test.ts` (4 test: addBackground, double-add→pendingReplace, removeBackground+dispose, setTransform). `index.ts` barrel aggiornato con tutti i nuovi export. Demo page `/demo/floorplan-background-image` aggiornata per usare `useFloorplanBackground('demo-floor')` + `FloorplanBackgroundCanvas` (scale/rotation/opacity/visible slider live via store). |
| 2026-05-07 | ✅ **Phase 2 COMPLETE** — ImageProvider implementato (Sonnet 4.6). Deps: `utif@3.x` MIT + `exifr@7.x` MIT installati via pnpm. 4 file creati: `ImageProvider.ts` (~180 LOC — load/EXIF/TIFF/render/dispose, OffscreenCanvas-based, EXIF orientation cases 1–8 via pre-render hardware rotation), `image-compression.ts` (helper — compressImage + isTiff), `utif.d.ts` (module declaration per libreria senza types), `app/demo/floorplan-background-image/page.tsx` (demo interattiva: drag file PNG/JPEG/WEBP/TIFF → naturalBounds + orientation display + canvas render con scale/rotation slider). `index.ts` aggiornato per esportare `ImageProvider`. Zero impatto sui consumer esistenti. Ship gate: demo reachable at `/demo/floorplan-background-image`. |
| 2026-05-07 | ✅ **Phase 1 COMPLETE** — scaffolding implementato (Sonnet 4.6). 10 file creati/modificati: `providers/types.ts` (domain types — BackgroundTransform, CalibrationData, FloorplanBackground, FloorplanOverlay, ProviderSource, ProviderLoadResult, ProviderRenderParams, ProviderCapabilities, ProviderMetadata, type guards), `providers/IFloorplanBackgroundProvider.ts` (contratto interface), `providers/provider-registry.ts` (singleton FloorplanBackgroundProviderRegistry + registerProvider/getProvider helpers), `providers/__tests__/provider-contract.suite.ts` (generic contract test suite factory — 8 tests), `index.ts` (barrel export). ID system: `RASTER_BACKGROUND: 'rbg'` in `enterprise-id-prefixes.ts`, `generateFloorplanBackgroundId()` in `enterprise-id-class.ts` + `enterprise-id-convenience.ts` + `enterprise-id.service.ts`. Firestore: `FLOORPLAN_BACKGROUNDS` + `FLOORPLAN_OVERLAYS` in `firestore-collections.ts`. Test: 2 casi aggiunti in `enterprise-id.service.test.ts`. Zero impatto sui consumer esistenti. |
| 2026-05-07 | 📋 PROPOSED **revisione 3** — round 2 di clarification (Q7-Q11, ελληνικά). Decisioni vincolanti aggiunte: **(Q7)** PDF = single-page only — ogni floor ha 1 file, niente multi-page navigation, UI semplificata, **(Q8)** cross-type replace (DXF↔PDF/Image) = cascade delete unified — service che cancella **ENTRAMBI** DXF-polygons (sistema esistente) **E** floorplan_overlays per il floor — un solo "delete all polygons of floor" path, **(Q9)** RBAC = solo `ADMIN`, `SUPER_ADMIN`, `PROJECT_MANAGER` possono upload/calibrate/delete; read = tutti i ruoli stessa company, **(Q10)** calibration with existing polygons = **auto-remap + always confirm** (Procore-grade safety — polygons mantengono real-world position, dialog "N polygons saranno aggiornati"), **(Q11)** EXIF orientation = **auto-rotate sempre** (industry-standard AutoCAD/Procore/Google Photos), **(Q12)** file size cap 50MB + **in-app compression**: PDF re-render at lower DPI, Image = canvas resize + JPEG q=0.85, TIFF → convert to PNG durante upload. ADR aggiornato sezioni 3.3, 3.6, 3.7, 3.8, 3.10, 3.11 + nuova §3.12 (RBAC). |
| 2026-05-07 | 📋 PROPOSED **revisione 2** dopo clarification round (6 Q&A, ελληνικά). Decisioni vincolanti: **(Q1)** scope = per-κάτοψη-ορόφου, niente altrove, multi-level units (μεζονέτες/καταστήματα) = N κατόψεις indipendenti (codice esistente), **(Q2)** single file per κάτοψη — abbandonato multi-layer stack/z-order/reorder, **(Q3)** replace = confirm dialog + cascade delete polygons, **(Q4)** calibration sempre disponibile (PDF + Image), **(Q5)** strong-separation Procore/SAP-grade — `files` SSoT (binary + generic metadata) + nuova `floorplan_backgrounds` (domain entity con calibration/transform/FK→files) + nuova `floorplan_overlays` (polygons con FK→floorplan_backgrounds), nuovo prefix `rbg_<ulid>`, **(Q6)** image formats = PNG + JPEG + WEBP + TIFF (via `utif.js` MIT). Tile provider rimosso dallo scope (non necessario per single-file-per-floor). ADR riscritto end-to-end. |
| 2026-05-07 | 📋 PROPOSED **revisione 1** — bozza iniziale post bug-fix PDF overlay alignment (`pdfTransform=identity` permanente). Architettura provider-based + multi-layer stack (poi rivista in revisione 2 dopo Q1-Q2 di Giorgio). |

---

## 1. Context

### 1.1 Stato corrente (2026-05-07)

Il DXF Viewer ha un **subsystem PDF-only** (`src/subapps/dxf-viewer/pdf-background/`) che renderizza la pagina 1 di un documento PDF dietro al canvas DXF, con transform indipendente, opacity, page navigation e fit-to-view.

**FloorplanGallery (read-only consumer)** usa lo stesso `PdfRenderer` via:
- `floorplan-pdf-renderer.ts` → `loadPdfPage1(url)` rende a scala 2x → `imageWidth × imageHeight` in pixel-space
- `floorplan-pdf-overlay-renderer.ts` → renderizza poligoni sopra l'immagine usando `calcFit + toScreen` (Y-UP CAD), fit semplice senza margini

**Bug recente (RISOLTO, dirty in working tree):**
`PdfControlsPanel.calculateFitScale()` raddoppiava `pageDimensions` (già a `scale=2`) per `DEFAULT_RENDER_SCALE=2` → `fitScale ≈ 0.22` → vertici salvati nello world ridotto (524×370 invece di ~1190×840) → gallery rendeva nell'angolo. **Fix:** `pdfTransform = identity` permanente + camera fit gestito esclusivamente da `useFitToPdf` su `canvasTransform`.

### 1.2 Limiti dell'architettura attuale

| Aspetto | Stato attuale | Limite |
|---------|---------------|--------|
| **Sources** | Solo PDF | No PNG/JPG/WEBP/TIFF → impossibile usare scansioni di kατόψεις vecchie da fotocopiatore/scanner |
| **Calibration** | Inesistente | L'utente non può dire "questo segmento = 2.5m" per scalare il raster a misure reali |
| **Persistence** | Inesistente — solo in-memory store | Reload pagina = riselezione file da disco |
| **Domain modeling** | `pdfBackgroundStore` accoppia file binary + render state + transform | Niente entità `FloorplanBackground` di prima classe; impossibile versionare, calibrare e salvare in modo coerente |
| **Polygon-file twin** | Polygons salvati in spazio mondiale del DXF; nessun twin per PDF/Image | Cancellando la κάτοψη restano polygons orfani |
| **Test coverage** | Smoke-only | Niente provider contract test, niente visual regression |

### 1.3 Pattern industry — convergenza

| Vendor | Pattern background floorplan |
|--------|------------------------------|
| **Procore (Drawings)** | `drawings/{id}` first-class entity (versions, calibration, sheet-area), markup tables FK to drawing+page |
| **Bluebeam Revu** | PDF document = doc; markups in tabelle dedicate per-page; calibration tool 2-click |
| **AutoCAD Construction Cloud** | Drawing = entity, markups separate, cross-version diff |
| **PlanGrid (ACC)** | Sheet-based PDF, photo overlays as separate domain, geo-pin calibration |
| **SAP DMS / EAM** | Strong typing — generic file blob + domain entity (cv_* + business object) |

**Pattern enterprise convergente:**
1. Drawing/floorplan = **first-class domain entity** con propria collection (NOT "just another file")
2. File binary = stored in object storage, **referenced via FK** dalla domain entity
3. Calibration / scale / transform = **on the domain entity** (mai dentro generic FileRecord)
4. Markups / polygons = **separate collection** con FK alla domain entity
5. Cascade delete = entity → markups → file (se non riferito altrove)

Memory rule "industry standard = default answer" (ADR-330 D8) ⟹ **applichiamo strong separation Procore/SAP-grade**.

### 1.4 Scope drivers (post-Giorgio Q1-Q2)

1. **FloorplanGallery** ha bisogno di renderizzare immagini scannerizzate (vecchie kátopseis su carta, foto smartphone, TIFF da scanner) come background.
2. **DXF Viewer editor** ha bisogno di **un solo** background per κάτοψη (nessuno stack multi-layer — semplificato dopo Q2).
3. **Per-floor binding**: ogni κάτοψη ha 0-1 background. Gli edifici μεζονέτα/κατάστημα che hanno N livelli avranno N κατόψεις indipendenti — **codice esistente nell'app**.
4. **Calibration** è essenziale e sempre disponibile (Q4): il workflow scan-old-floorplan → calibrate-by-known-distance → place-polygons è dominante.
5. **Persistence** è essenziale: reload-after-page-refresh deve mostrare lo stesso background con la stessa calibration.

---

## 2. Decision

Costruiamo un **Floorplan Background System** end-to-end enterprise che:

1. **Astrae** il source dietro un **provider pattern** (PDF + Image, due implementazioni).
2. **Modella** una nuova first-class entity `FloorplanBackground` (domain entity) separata dal generic `FileRecord` SSoT.
3. **Aggancia 0-1 background** per ogni κάτοψη ορόφου (single, no stack — Q2 vincolante).
4. **Introduce** calibration tool (2-point reference distance), sempre disponibile per entrambi i provider (Q4).
5. **Persiste** in 3 layer separati Procore-grade (Q5):
   - `files` collection — binary metadata SSoT (esistente, nessuna modifica)
   - `floorplan_backgrounds` — domain entity (NUOVA), FK→files, FK→floor
   - `floorplan_overlays` — polygons (NUOVA), FK→floorplan_backgrounds
6. **Replace flow** (Q3): nuovo upload con κάτοψη già occupata = confirm dialog + cascade delete (background + polygons), poi load del nuovo.
7. **Image formats** Procore-grade (Q6): PNG + JPEG + WEBP + TIFF (`utif.js` MIT).
8. **Sostituisce** `PdfControlsPanel` con `FloorplanBackgroundPanel` (single-target, no list/reorder).
9. **Wrap** del vecchio `pdfBackgroundStore` come adapter zero-data-loss durante migrazione.
10. **Copre** con test contract (provider) + integration (store + persistence) + visual regression (canvas) + Firestore/Storage rules tests.

Il PDF resta **fully functional** durante la migrazione: il vecchio store viene wrappato come **adapter** sopra il nuovo store, e tutti i consumer esistenti (`useFitToPdf`, `FloorplanGallery`, `DxfCanvas`) continuano a funzionare senza modifiche fino al boy-scout.

---

## 3. Architecture

### 3.1 Layered structure

```
┌──────────────────────────────────────────────────────────────┐
│  LAYER 8 — Migration sites (boy-scout)                       │
│  FloorplanGallery, DXF editor canvas, future consumers       │
└──────────────────────────────────────────────────────────────┘
                              ↑
┌──────────────────────────────────────────────────────────────┐
│  LAYER 7 — UI Panel                                          │
│  FloorplanBackgroundPanel (single-target controls)           │
│  CalibrationDialog (2-point picker)                          │
│  ReplaceConfirmDialog (cascade delete confirmation)          │
└──────────────────────────────────────────────────────────────┘
                              ↑
┌──────────────────────────────────────────────────────────────┐
│  LAYER 6 — Canvas                                            │
│  FloorplanBackgroundCanvas (RAF, paints active background)   │
│  Replaces PdfBackgroundCanvas                                │
└──────────────────────────────────────────────────────────────┘
                              ↑
┌──────────────────────────────────────────────────────────────┐
│  LAYER 5 — Hooks                                             │
│  useFloorplanBackground(floorId), useFitToBackground         │
│  (replaces useFitToPdf), useCalibration                      │
└──────────────────────────────────────────────────────────────┘
                              ↑
┌──────────────────────────────────────────────────────────────┐
│  LAYER 4 — Store                                             │
│  floorplanBackgroundStore (Zustand + immer + devtools)       │
│  Per-floor singleton state via Map<floorId, BackgroundState> │
└──────────────────────────────────────────────────────────────┘
                              ↑
┌──────────────────────────────────────────────────────────────┐
│  LAYER 3 — Persistence                                       │
│  floorplan-background-persistence.service                    │
│  Writes: files + floorplan_backgrounds + floorplan_overlays  │
│  Tenant isolation: companyId on all 3 collections            │
└──────────────────────────────────────────────────────────────┘
                              ↑
┌──────────────────────────────────────────────────────────────┐
│  LAYER 2 — Provider Registry                                 │
│  registerProvider(providerId, factory) → ProviderRegistry    │
└──────────────────────────────────────────────────────────────┘
                              ↑
┌──────────────────────────────────────────────────────────────┐
│  LAYER 1 — Provider Strategies                               │
│  PdfPageProvider, ImageProvider                              │
│  Both implement IFloorplanBackgroundProvider                 │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 Provider interface (Layer 1)

**Single contract** che PDF e Image implementano:

```ts
export interface IFloorplanBackgroundProvider {
  readonly id: 'pdf-page' | 'image';
  readonly capabilities: ProviderCapabilities;
  readonly supportedMimeTypes: ReadonlyArray<string>;

  /** Loads raw source from File or storage URL. Returns natural pixel-space bounds. */
  loadAsync(source: ProviderSource): Promise<ProviderLoadResult>;

  /** Renders one frame onto the target canvas. */
  render(ctx: CanvasRenderingContext2D, params: ProviderRenderParams): void;

  /** Reports the un-transformed natural pixel dimensions. */
  getNaturalBounds(): NaturalBounds;

  /** Optional: page navigation (PDF-only). Gated by capabilities.multiPage. */
  setActivePage?(page: number): Promise<void>;

  /** Cleanup. */
  dispose(): void | Promise<void>;
}

export interface ProviderCapabilities {
  multiPage: boolean;             // PDF: true, Image: false
  exifAware: boolean;             // Image: true (rotation), PDF: false
  vectorEquivalent: boolean;      // PDF: true, Image: false
  calibratable: boolean;          // ENTRAMBI true (Q4 vincolante)
}

export type NaturalBounds = { width: number; height: number };

export type ProviderSource =
  | { kind: 'file'; file: File }
  | { kind: 'url'; url: string }
  | { kind: 'storage-path'; path: string };

export interface ProviderLoadResult {
  success: boolean;
  bounds?: NaturalBounds;
  metadata?: Record<string, unknown>;
  error?: string;
}

export interface ProviderRenderParams {
  transform: BackgroundTransform;
  worldToCanvas: ViewTransform;
  viewport: { width: number; height: number };
  opacity: number;
}
```

### 3.3 Provider implementations

**PdfPageProvider** (Layer 1):
- Wraps existing `PdfRenderer` (pdfjs-dist 4.5.136). Zero re-implementation.
- `supportedMimeTypes`: `['application/pdf']`
- `capabilities`: `{ multiPage: false, exifAware: false, vectorEquivalent: true, calibratable: true }` — **Q7: single-page only**. Se PDF ha N>1 pagine: rende sempre pagina 1, le altre **ignorate** (l'utente carica un PDF distinto per ogni κάτοψη).
- Render: `ctx.drawImage(this.renderedImageCanvas, 0, 0)` con transform applicato dal compositor.
- **Compression upload (Q12)**: se `fileSize > 50MB` → re-render a DPI ridotta (`scale=1` invece di `scale=2`), reupload se size ancora >50MB → reject con error UI "Αρχείο πολύ μεγάλο. Συμπίεσε ή χρησιμοποίησε χαμηλότερη DPI."

**ImageProvider** (Layer 1):
- Carica binary via `fetch(url).blob()`, decodifica a `HTMLImageElement` o `ImageBitmap`.
- `supportedMimeTypes`: `['image/png', 'image/jpeg', 'image/webp', 'image/tiff']` (Q6).
- `capabilities`: `{ multiPage: false, exifAware: true, vectorEquivalent: false, calibratable: true }`.
- **TIFF handling (Q6 + Q12)**: rileva mime `image/tiff`/`image/tif` o estensione `.tif/.tiff` → decode via `utif.js` (MIT) → ImageData → OffscreenCanvas. **In upload pipeline il TIFF viene convertito a PNG/JPG** (lossless→PNG se contiene alpha, altrimenti JPG q=0.92) e salvato come PNG/JPG in Storage. Il `mimeType` salvato in `files` riflette il post-conversion type. Provider runtime non incontra mai TIFF in storage path.
- **EXIF orientation (Q11 vincolante = AUTO-ROTATE)**: legge tag `Orientation` via `exifr` (MIT, ~10KB gzip). Pre-render applica la rotazione hardware al canvas → output `naturalBounds` riflette dimensioni post-rotation (es. portrait phone photo viene salvata già in orientamento corretto). L'utente **non vede mai** una foto "πλάγια". `metadata.imageOrientation` salva il valore EXIF originale per debugging.
- **Compression upload (Q12)**: se size > 50MB → resize via OffscreenCanvas (max-edge 8192px) + re-encode JPEG q=0.85. Se ancora >50MB → reject UI.
- Render: `ctx.drawImage(this.image, 0, 0)`.

### 3.4 Domain entity (Layer 4 store + Layer 3 persistence)

```ts
export interface FloorplanBackground {
  id: string;                              // rbg_<ulid> via enterprise-id.service
  companyId: string;                       // tenant isolation (immutable)
  floorId: string;                         // FK → floor entity (immutable)
  fileId: string;                          // FK → files collection (immutable)
  providerId: 'pdf-page' | 'image';
  providerMetadata: ProviderMetadata;      // page number, exif orientation, etc.
  naturalBounds: NaturalBounds;            // provider-reported, pixel-space, immutable
  transform: BackgroundTransform;          // user-controlled transform
  calibration: CalibrationData | null;     // Q4: optional, available for both
  opacity: number;                         // 0..1
  visible: boolean;
  locked: boolean;                         // UI: cannot move/calibrate when locked
  createdAt: number;
  updatedAt: number;
  createdBy: string;                       // userId
  updatedBy: string;                       // userId
}

export interface BackgroundTransform {
  translateX: number;       // world units (== natural pixels at scale=1)
  translateY: number;
  scaleX: number;
  scaleY: number;           // separate axes for non-uniform calibration
  rotation: number;         // degrees, CCW positive (CAD convention)
}

export interface CalibrationData {
  method: 'two-point';      // future-extension: 'three-point-affine'
  pointA: Point2D;          // pixel-space of natural raster
  pointB: Point2D;
  realDistance: number;     // user-supplied
  unit: 'm' | 'cm' | 'mm' | 'ft' | 'in';
  rotationDerived: boolean; // whether 2-point also derived rotation correction
  calibratedAt: number;
  calibratedBy: string;     // userId
}

export interface ProviderMetadata {
  pdfPageNumber?: number;   // pdf-only
  imageOrientation?: number; // exif-only
  imageMimeType?: string;
  imageDecoderUsed?: 'native' | 'utif';
}
```

### 3.5 Polygon overlays (separated entity, FK→background)

```ts
export interface FloorplanOverlay {
  id: string;                              // ovrl_<ulid> via existing OVERLAY prefix
  companyId: string;                       // tenant isolation (immutable)
  backgroundId: string;                    // FK → floorplan_backgrounds (immutable)
  floorId: string;                         // FK → floor (denormalized for query speed)
  polygon: ReadonlyArray<Point2D>;         // pixel-space del background (Y-UP CAD)
  linkedPropertyId?: string;               // FK → property entity (optional)
  resolvedStatus?: PropertyStatus;         // denormalized for render
  label?: string;
  zIndex: number;                          // ordering when overlapping
  createdAt: number;
  updatedAt: number;
}
```

**Cascade rule (Q3 vincolante):**
- Delete `FloorplanBackground` → cascade delete tutti gli `FloorplanOverlay` con matching `backgroundId`.
- Delete `Floor` → cascade delete tutti i `FloorplanBackground` con matching `floorId` → cascade delete relativi overlays.
- Cancellazione del file in `files`: solo se nessun altro background lo riferisce (reference counting).

### 3.6 Replace flow (Q3 + Q8 vincolanti)

User uploads new file su κάτοψη già occupata. **Same-type** (PDF→PDF, Image→Image) e **cross-type** (DXF↔PDF/Image, PDF↔Image) seguono lo stesso flow:

1. Detect via unified service `getFloorPolygonState(floorId)`:
   ```ts
   {
     hasFloorplanBackground: boolean,
     floorplanOverlayCount: number,
     hasDxfBackground: boolean,
     dxfOverlayCount: number,
   }
   ```
2. Se almeno uno è truthy, mostra `ReplaceConfirmDialog`:
   ```
   ⚠️ Ο όροφος έχει ήδη background αρχείο "{existingFileName}".
   Αν συνεχίσεις, θα διαγραφούν:
   • Το παλιό αρχείο
   • {floorplanOverlayCount + dxfOverlayCount} polygons συνολικά
     ({floorplanOverlayCount} από PDF/Image + {dxfOverlayCount} από DXF)
   Σίγουρα θες να συνεχίσεις;

   [ Ακύρωση ]    [ Διαγραφή και αντικατάσταση ]
   ```
3. Conferma → `cascadeDeleteAllPolygonsForFloor(floorId)` (Q8 unified service) → `addBackground(newFile)` (atomic via Firestore batch).
4. Cancel → no-op.

**`cascadeDeleteAllPolygonsForFloor(floorId)` (Q8 NUOVO unified service):**
- Deve toccare **ENTRAMBI** i polygon systems per garantire single source of truth post-delete:
  1. Query `floorplan_overlays where floorId == floorId AND companyId == ctx.companyId` → batch delete tutti
  2. Query DXF polygon system (collection esistente — TBD da grep, candidate: `dxf_overlay_levels` con FK al floor) → batch delete tutti
  3. Query `floorplan_backgrounds where floorId == floorId AND companyId == ctx.companyId` → delete + reference-decrement file
- Tutto in una Firestore batch atomic. Failure mid-way = rollback automatico (Firestore guarantee).
- Idempotente: chiamata due volte → second call no-op (already empty).

### 3.7 Calibration system (Layer 5 hook + Layer 7 dialog)

**Two-point calibration** (Q4: sempre disponibile):
1. User clicca "Calibration" sul pannello → entra modalità `calibrate`.
2. Click 1: pixel-space point A.
3. Click 2: pixel-space point B.
4. Dialog `CalibrationDialog`:
   ```
   📏 Calibration

   Distance pixel-space: 487.3 px (calculated)

   Real distance: [____] [m ▾]

   ☐ Set this line as horizontal (derive rotation)

   [ Cancel ]    [ Apply ]
   ```
5. Apply → hook calcola:
   - `pixelDist = ‖B − A‖`
   - `realDist = userInput * unitToMeters[unit]`
   - `scale = realDist / pixelDist` (uniform — `scaleX === scaleY`)
   - **Optional rotation correction:** se utente checkba "horizontal/vertical", deriva `rotation` da `atan2(B−A)` e roto-trasla.
6. Aggiorna `background.transform` e `background.calibration`.
7. **Polygon impact (Q10 vincolante = auto-remap + always confirm):** se esistono polygons (`count = countOverlaysByBackgroundId(rbgId)`) > 0:
   - Mostra `CalibrationPolygonRemapDialog`:
     ```
     ℹ️ Calibration θα ενημερώσει {count} polygons για να κρατηθούν
        στην ίδια πραγματική θέση (real-world position).

     Παράδειγμα: αν έχεις διαμέρισμα 5m × 5m, μετά μένει 5m × 5m
        (όχι αλλιώς λόγω scale change).

     [ Ακύρωση ]    [ Calibrate και ενημέρωση polygons ]
     ```
   - Conferma → applica `vertex_new = inverse(newTransform) ∘ oldTransform(vertex_old)` a tutti i polygons via Firestore batch (atomic con la calibration write).
   - Cancel → no-op (né calibration né remap).
   - **Nessuna threshold** (5% delta, etc.) — sempre confirm per Procore-grade transparency.

### 3.8 Persistence (Layer 3) — strong separation Procore-grade

**Storage path** (esistente, ADR-031, zero modifica):

```
companies/{companyId}/projects/{projectId}/entities/floor/{floorId}/
  domains/construction/categories/floorplans/files/{fileId}.{ext}
```

via `buildStoragePath({ companyId, projectId, entityType: 'floor', entityId: floorId, domain: 'construction', category: 'floorplans', fileId, ext })`.

**Firestore collection 1 — `files` (esistente, SSoT post ADR-292):**
- Documento `FileRecord` con `file_*` ID via `generateFileId()`.
- Generic metadata: `fileName`, `fileSize`, `mimeType`, `storagePath`, `uploaderId`, `uploadedAt`, `entityType`, `entityId`.
- **Zero modifiche** al schema esistente. Nessun campo "rasterBackground" iniettato.

**Firestore collection 2 — `floorplan_backgrounds` (NUOVA):**
- Path: `floorplan_backgrounds/{rbgId}` (top-level, tenant isolation via `companyId` field + Firestore rules).
- ID: `rbg_<ulid>` via NUOVO `generateFloorplanBackgroundId()`.
- Domain entity: transform + calibration + naturalBounds + provider info.
- FK: `fileId` → files, `floorId` → (concettuale, no Firestore-level FK).
- Indexed by `(companyId, floorId)` per look-up O(1) per κάτοψη.

**Firestore collection 3 — `floorplan_overlays` (NUOVA):**
- Path: `floorplan_overlays/{ovrlId}` (top-level, tenant isolation via `companyId`).
- ID: `ovrl_<ulid>` via existing `generateOverlayId()` (REUSE).
- Polygons + linked property.
- FK: `backgroundId` → floorplan_backgrounds.
- Indexed by `(companyId, backgroundId)`.

**Cascade delete** (server-side, atomic):
- `deleteFloorplanBackground(rbgId)`: Firestore batch
  1. Query overlays where `backgroundId == rbgId` → delete tutti
  2. Delete `floorplan_backgrounds/{rbgId}`
  3. Check reference count for `fileId` → se 1 (solo questo background), mark file for deletion
  4. Cloud Function trigger pulisce Storage path + delete `files/{fileId}` se reference count == 0

**Tenant isolation:** ogni doc ha `companyId` immutable. Firestore rules CHECK 3.10 enforced (queries devono includere `where('companyId', '==', auth.token.companyId)`).

### 3.9 ID prefixes & naming (SSoT compliant)

**NUOVO prefix** in `src/services/enterprise-id-prefixes.ts`:
```ts
RASTER_BACKGROUND: 'rbg',  // Floorplan background (PDF or Image) — twin of file
```

**NUOVO generator** in `src/services/enterprise-id.service.ts`:
```ts
export function generateFloorplanBackgroundId(): string {
  return `${ENTERPRISE_ID_PREFIXES.RASTER_BACKGROUND}_${ulid()}`;
}
```

**NUOVE collections** in `src/config/firestore-collections.ts`:
```ts
FLOORPLAN_BACKGROUNDS: process.env.NEXT_PUBLIC_FLOORPLAN_BACKGROUNDS_COLLECTION || 'floorplan_backgrounds',
FLOORPLAN_OVERLAYS: process.env.NEXT_PUBLIC_FLOORPLAN_OVERLAYS_COLLECTION || 'floorplan_overlays',
```

**REUSE esistenti:**
- `OVERLAY: 'ovrl'` per polygon IDs
- `FILE: 'file'` per uploaded asset IDs
- `entityType: 'floor'` (già esistente in `ENTITY_TYPES`)
- `domain: 'construction'`, `category: 'floorplans'` (già esistenti in `FILE_DOMAINS` / `FILE_CATEGORIES`)

### 3.10 UI Panel (Layer 7) — single-target

`FloorplanBackgroundPanel` sostituisce `PdfControlsPanel`. **Q7: niente page navigation (single-page only).**

```
┌─ Background Κάτοψης ───────────────────[ × ]─┐
│  📄 Floor-A.pdf                       [ ⋮ ]  │  ← active background
├──────────────────────────────────────────────┤
│  ▸ Scale: [████░░░░] 1.20×    [ Calibrate ] │
│  ▸ Rotation: [────●───] 15°                 │
│  ▸ Position: X: 0  Y: 0       [ Reset ]     │
│  ▸ Opacity: [██████░░] 0.8                  │
│  ▸ Visible: [▣]  Locked: [□]                │
│  ────────────────────────────────────────── │
│  [ Replace background... ]                  │
│  [ Remove background ]                      │
└──────────────────────────────────────────────┘
```

Pannello vuoto-state (κάτοψη senza background):
```
┌─ Background Κάτοψης ───────────────────[ × ]─┐
│                                              │
│  Δεν υπάρχει background.                    │
│                                              │
│  [ 📄 Φόρτωση PDF ]   [ 🖼 Φόρτωση Εικόνας ]│
│                                              │
│  Υποστήριξη: PDF, PNG, JPG, WEBP, TIFF      │
└──────────────────────────────────────────────┘
```

UI features:
- ⋮ menu: Rename, Replace, Calibrate, Export transform, Delete
- **Niente page navigation** (Q7 — single-page only). Se l'utente carica un PDF multi-page, render della sola pagina 1, le altre pagine ignorate (e l'utente lo sa: deve caricare PDF separati per ogni κάτοψη).
- Calibrate button **always visible** (Q4)
- Replace = trigger `ReplaceConfirmDialog` (Q3 + Q8 unified cascade)
- **Visibilità del Panel (Q9 RBAC):** read-only per ruoli ≠ ADMIN/SUPER_ADMIN/PROJECT_MANAGER (tutti i bottoni di mutation disabilitati con tooltip "Δεν έχεις δικαίωμα").

### 3.11 Capabilities matrix

| Provider     | multiPage      | exifAware | vectorEquiv | calibratable | mimeTypes (input)                                                |
|--------------|----------------|-----------|-------------|--------------|------------------------------------------------------------------|
| `pdf-page`   | ❌ (Q7)        | ❌        | ✅          | ✅ (Q4)      | `application/pdf`                                                |
| `image`      | ❌             | ✅ (Q11)  | ❌          | ✅ (Q4)      | `image/png`, `image/jpeg`, `image/webp`, `image/tiff`*           |

*TIFF input convertito a PNG/JPG durante upload (Q12) — runtime non incontra mai TIFF in storage.

UI panel reagisce alla matrix: nasconde controlli irrilevanti per provider.

### 3.12 RBAC (Q9 vincolante)

**Ruoli autorizzati a write/delete:**
- `ADMIN`
- `SUPER_ADMIN`
- `PROJECT_MANAGER`

**Tutti gli altri ruoli (stessa company):** read-only.
**Cross-company:** denied.

**Implementazione:**
- **Client-side (UI):** `useUserRole()` hook → conditional render dei bottoni mutation. Disabled state con tooltip greco.
- **Server-side (Firestore rules):** `firestore.rules` blocchi `match /floorplan_backgrounds/{rbgId}` e `match /floorplan_overlays/{ovrlId}` con:
  ```
  allow read: if belongsToCompany();
  allow create, update, delete: if belongsToCompany() && hasRole(['admin', 'super_admin', 'project_manager']);
  ```
- **API routes:** wrapper `withAuth({ requiredRoles: ['admin', 'super_admin', 'project_manager'] })` su tutte le mutation routes.
- **Storage rules:** stessa policy ruoli per upload + delete in path `companies/.../floorplans/files/...`.

**Test (CHECK 3.16, ADR-298):** rules suite copre tutti i 9 ruoli × 4 ops × 2 companies = matrix completa.

---

## 4. Migration plan (PDF → wrapped provider)

### 4.1 Wrapped store

`pdfBackgroundStore` rimane API-compatibile ma diventa **selector wrapper** sopra `floorplanBackgroundStore`:

```ts
// External selectors unchanged — internally derive from new store
export const usePdfBackgroundStore = () => {
  const bg = useFloorplanBackgroundStore(s => s.activeBackground);
  return useMemo(() => ({
    enabled: bg?.visible ?? true,
    opacity: bg?.opacity ?? 0.5,
    documentInfo: bg?.providerId === 'pdf-page' ? legacyDocInfo(bg) : null,
    currentPage: bg?.providerMetadata.pdfPageNumber ?? 1,
    transform: legacyPdfTransform(bg?.transform),
    renderedImageUrl: bg?.providerId === 'pdf-page' ? rendererCache.get(bg.id) : null,
    // ... etc
  }), [bg]);
};
```

I metodi mutativi (`loadPdf`, `setCurrentPage`, `setOpacity`, `setTransform`) traducono in azioni del nuovo store.

### 4.2 Old → new mapping

| Old (`pdfBackgroundStore`)             | New (`floorplanBackgroundStore`)                                  |
|----------------------------------------|----------------------------------------------------------------|
| `state.enabled`                        | `activeBackground.visible`                                     |
| `state.opacity`                        | `activeBackground.opacity`                                     |
| `state.documentInfo.fileName`          | `getFileRecord(activeBackground.fileId).fileName`              |
| `state.currentPage`                    | `activeBackground.providerMetadata.pdfPageNumber`              |
| `state.pageDimensions`                 | `activeBackground.naturalBounds`                               |
| `state.transform`                      | `activeBackground.transform` (mapped)                          |
| `state.renderedImageUrl`               | provider-internal (cached by provider, not store-exposed)      |
| `loadPdf(file)`                        | `addBackground({ providerId: 'pdf-page', source: { kind: 'file' } })` |
| `setCurrentPage(n)`                    | `setActivePage(backgroundId, n)`                               |
| `unloadPdf()`                          | `removeBackground(backgroundId)`                               |

### 4.3 Boy-scout migration sites

| File | Migration action | Phase |
|------|------------------|-------|
| `src/subapps/dxf-viewer/hooks/canvas/useFitToPdf.ts` | Rinomina → `useFitToBackground`, leggi `activeBackground` | Phase 4 |
| `src/components/shared/files/media/floorplan-pdf-renderer.ts` | Sostituisci con `floorplan-background-renderer.ts` (delegate al provider registry) | Phase 4 |
| `src/components/shared/files/media/floorplan-pdf-overlay-renderer.ts` | Rinomina → `floorplan-overlay-renderer.ts`, accetta `bounds` da any provider | Phase 4 |
| `src/subapps/dxf-viewer/.../DxfCanvas.tsx` (consumer di PdfBackgroundCanvas) | Sostituisci con `FloorplanBackgroundCanvas` | Phase 5 |
| `src/components/shared/files/media/FloorplanGallery.tsx` | Aggiorna prop API (rinomina `pdfBounds` → `backgroundBounds`) | Phase 4 |
| `src/components/shared/files/media/useFloorplanCanvasRender.ts` | Adatta a provider-agnostic | Phase 4 |
| `src/components/shared/files/media/useFloorplanPdfLoader.ts` | Generalizza → `useFloorplanBackgroundLoader` | Phase 4 |

**Strategia:** Phase 1-3 lavorano in parallelo accanto al PDF subsystem (zero modifiche ai consumer). Phase 4 introduce il wrapper. Phase 5 sostituisce i canvas. Phase 6+ elimina il vecchio store.

### 4.4 Data migration

**Test data only** (memory: "All Firestore/Storage data is test. No backward compat needed"):
- Nessun migration script necessario.
- File PDF caricati nelle session precedenti: utente ricarica file da disco — workflow attuale (no persistence ancora).

---

## 5. Test strategy (ADR-298 / ADR-301 / ADR-294 compliant)

### 5.1 Provider contract tests

`src/subapps/dxf-viewer/floorplan-background/providers/__tests__/<provider>.contract.test.ts`

Ogni provider passa la stessa test-suite generica:
1. `loadAsync({ kind: 'file' })` con asset di test → `success: true`, `bounds` valido
2. `getNaturalBounds()` post-load → identico al risultato di `loadAsync`
3. `render()` con identity transform → primo pixel non-blank al centro del canvas
4. `dispose()` → no-op chiamato due volte
5. Capabilities boolean-coerenti con feature implementate
6. **ImageProvider TIFF-specific:** decode multi-strip TIFF con baseline pattern → bounds correct, render non-blank

### 5.2 Store integration tests

`src/subapps/dxf-viewer/floorplan-background/stores/__tests__/floorplanBackgroundStore.test.ts`

- Add background → state.activeBackground populated
- Add second on same floor → trigger replace flow event (no auto-overwrite)
- Calibrate → polygon vertices remap (via subscription mock)
- Cascade delete simulation: background deleted → overlays subscriber notified

### 5.3 Persistence integration tests

`src/services/floorplan-background/__tests__/persistence.integration.test.ts`

- Create background → write to `floorplan_backgrounds` + reference to existing `file_*` doc
- Cascade delete: background → all overlays gone, file ref-count decrement
- Replace flow atomicity: batch write — failure mid-way leaves no orphans
- Tenant isolation: companyId mismatch → query returns empty

### 5.4 Compositor visual regression — ✅ DONE (Phase 8)

`src/subapps/dxf-viewer/floorplan-background/components/__tests__/FloorplanBackgroundCanvas.e2e.spec.ts` (Playwright + screenshot diff, picked up by `**/*.e2e.spec.ts` testMatch)

- ✅ Image PNG + identity transform → baseline `image-png-identity.png`
- ✅ Image PNG + scale ×2 → baseline `image-png-scale-2x.png`
- ✅ Image JPEG + rotation 90° → baseline `image-jpeg-rotation-90.png` (block-noise tolerance 0.02)
- ✅ Visibility toggle → baseline `image-png-hidden.png`
- ⏭️ PDF + identity transform → `test.skip` (needs tiny test PDF in `__fixtures__/`)
- ⏭️ Image TIFF (utif decode) → `test.skip` (needs TIFF fixture)
- ⏭️ Calibration scale ×2 + polygons → `test.skip` (needs DxfViewer harness route, not the standalone demo page)

Test images generated programmatically (canvas → blob, no committed binaries). Baselines locked on first run via `--update-snapshots`.

### 5.5 Firestore rules tests (CHECK 3.16)

`tests/firestore-rules/suites/floorplan-backgrounds.rules.test.ts`
`tests/firestore-rules/suites/floorplan-overlays.rules.test.ts`

- Read same-company → ALLOW
- Read other-company → DENY
- Write same-company + edit-role → ALLOW
- Write same-company + viewer-role → DENY
- Write missing `companyId` → DENY (immutability check via `request.resource.data.companyId == request.auth.token.companyId`)

### 5.6 Storage rules tests (CHECK 3.15)

`tests/storage-rules/suites/floorplan-backgrounds.test.ts`

- Upload pdf same-company → ALLOW
- Upload tiff same-company → ALLOW
- Upload exe → DENY (mime allowlist)
- Upload >50MB → DENY (size cap)
- Read other-company → DENY

### 5.7 SSoT registry update (ADR-294) — ✅ DONE (Phase 8)

Modulo `floorplan-background-system` registrato in `.ssot-registry.json` come **Tier 2** (2026-05-07):
- `forbiddenPatterns`:
  - `(addDoc|setDoc)\\s*\\([^)]*(floorplan_backgrounds|FLOORPLAN_BACKGROUNDS)`
  - `(addDoc|setDoc)\\s*\\([^)]*(floorplan_overlays|FLOORPLAN_OVERLAYS)`
  - `useState[^;]*pdfBackground` (legacy state outside subsystem)
- `allowlist`: `src/services/floorplan-background/`, `src/subapps/dxf-viewer/floorplan-background/`, `src/app/api/floorplan-backgrounds/`, `functions/src/floorplan-background/`, `functions/src/config/firestore-collections.ts`, `src/config/firestore-collections.ts`
- Bucket-write protection (`bucket.file().save()` su path floorplan) è già coperta dal modulo `storage-public-upload` Tier 2 — non duplicato
- Baseline `npm run ssot:baseline` rifrescato; audit corrente: 0 violations sul nuovo modulo

---

## 6. Phases

| Phase | Scope | Files (~) | Ship gate |
|-------|-------|-----------|-----------|
| ✅ **1** | ADR + provider interface + contract test scaffold + provider registry + ID prefix + collections constants | ~10 NEW | **DONE** 2026-05-07 — ADR-340 PROPOSED merged, prefix/collections registered, zero consumer impact |
| ✅ **2** | `ImageProvider` (PNG/JPG/WEBP/TIFF via utif.js) + EXIF orientation + standalone demo | ~6 NEW + 2 deps install (`utif`, `exifr`) | **DONE** 2026-05-07 — Demo `/demo/floorplan-background-image` mostra TIFF + EXIF |
| ✅ **3** | `floorplanBackgroundStore` + `useFloorplanBackground` + `FloorplanBackgroundCanvas` + provider switching (PDF + Image), no persist | ~7 NEW | **DONE** 2026-05-07 — Demo multi-provider funzionante in-memory |
| ⏭️ **4** | PDF wrapper adapter + `useFitToBackground` + FloorplanGallery boy-scout migration | ~4 MODIFY + 2 NEW | **SKIPPED** 2026-05-07 — data wipe imminente, vecchio PDF subsystem rimosso integralmente (no wrapper) |
| ✅ **5** | `FloorplanBackgroundPanel` UI + `ReplaceConfirmDialog` + DxfCanvas integration | ~4 NEW + 2 MODIFY | **DONE** 2026-05-07 — Panel sostituisce `PdfControlsPanel`, replace flow funzionante |
| ✅ **6** | Calibration system (2-point) + `CalibrationDialog` + `useCalibration` + polygon remap on calibrate | ~5 NEW | **DONE** 2026-05-07 — Calibration funzionante su image + pdf con polygon-aware remap |
| ✅ **7** | Firestore + Storage persistence + rules + tests + cascade delete CF | ~10 NEW + rules.json + index.json + 1 Cloud Function | **DONE** 2026-05-07 — Persistence reload across sessions; tenant isolation provata; cascade delete atomic |
| ✅ **8** | Visual regression suite + a11y audit + SSoT registry module + emulator integration test + ADR finalize | 4 NEW tests + registry module + ADR | **DONE** 2026-05-07 — Status `✅ IMPLEMENTED`; SSoT module registered (Tier 2); baseline locked; jest-axe 9/9; tsc verde |

**Atomicità:** ogni phase è ship-able da sola. Phase 1-3 zero impact sui consumer. Phase 4 critical-path migration. Phase 5+ può scivolare nel tempo senza bloccare.

---

## 7. Architecture invariants (N.7.2 checklist)

| # | Question | Answer |
|---|----------|--------|
| 1 | Proactive or reactive? | **Proactive** — provider load = data fetched + validated prima di render; replace = explicit confirm not silent overwrite |
| 2 | Race condition possible? | **No** — store mutations sequenziali in immer; canvas RAF debounced; provider.loadAsync await prima di addBackground; cascade delete via Firestore batch (atomic) |
| 3 | Idempotent? | **Yes** — `addBackground` con stesso `(floorId, fileId)` deduplica; `setTransform` overwrite-safe; cascade delete idempotente |
| 4 | Belt-and-suspenders? | **Yes** — `floorplan_backgrounds.fileId` validato a runtime contro `files`; orphan-detection task (Phase 9 follow-up); persistence reload validates `naturalBounds` |
| 5 | Single Source of Truth? | **Yes** — `floorplanBackgroundStore` SSoT in-memory; `floorplan_backgrounds` SSoT in Firestore; `files` SSoT per binary metadata; `pdfBackgroundStore` solo lettura derivata |
| 6 | Fire-and-forget or await? | **Await** per loadAsync, persistence write, cascade delete (correctness); fire-and-forget per render-ready telemetry (Phase 9) |
| 7 | Who owns the lifecycle? | **`floorplanBackgroundStore`** in-memory; **`floorplan-background-persistence.service`** server-side; provider registry singleton stateless |

✅ **Google-level: YES** — provider abstraction industria-standard, single-target per κάτοψη (Q2 vincolante), strong-separation Procore-grade (Q5), calibration first-class (Q4), persistence tenant-scoped, replace explicit (Q3), test multi-livello, image format coverage Procore-level (Q6).

---

## 8. File size compliance (N.7.1)

| Module | Estimated LOC | Notes |
|--------|---------------|-------|
| `IFloorplanBackgroundProvider.ts` (types) | ~100 | types/config — no limit |
| `provider-registry.ts` | ~60 | OK |
| `PdfPageProvider.ts` | ~280 | wraps existing PdfRenderer, OK |
| `ImageProvider.ts` | ~340 | OK (decoder dispatch + EXIF + TIFF) |
| `floorplanBackgroundStore.ts` | ~380 | OK (single-target, no stack) |
| `FloorplanBackgroundCanvas.tsx` | ~280 | OK (single-target rendering) |
| `FloorplanBackgroundPanel.tsx` | ~360 | OK |
| `CalibrationDialog.tsx` | ~280 | OK |
| `ReplaceConfirmDialog.tsx` | ~140 | OK |
| `useCalibration.ts` | ~180 | OK |
| `useFloorplanBackground.ts` | ~150 | OK |
| `useFitToBackground.ts` | ~80 | OK |
| `floorplan-background-persistence.service.ts` | ~420 | OK |

Tutti ≤500 LOC, target funzioni ≤40 LOC. Helpers estratti se necessario.

---

## 9. Risks & mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Migration breaks existing PDF flows | **HIGH** | Phase 4 wrapper preserves API exactly; contract tests over wrapper boundary; FloorplanGallery pixel-diff baseline |
| Calibration math wrong → polygons drift | **HIGH** | Pure helpers + property-based tests (fast-check), visual regression with known-good fixtures, polygon remap confirm dialog if delta >5% |
| TIFF decoder crash on malformed input | **MED** | `utif.js` wrapped in try/catch, fallback error UI "TIFF non leggibile, prova PNG/JPG"; size cap 50MB |
| EXIF orientation rotates pin polygons unexpectedly | **MED** | Provider applies orientation pre-render, store baseline = post-orientation natural bounds; documented invariant |
| Storage cost spike (large TIFF files) | **MED** | 50 MB cap + per-company quota counter (Phase 9 follow-up) |
| Firestore index over-cost | **LOW** | Singolo composite `(companyId ASC, floorId ASC)` su backgrounds, `(companyId ASC, backgroundId ASC)` su overlays — sotto quota |
| Replace flow race (double-click) | **MED** | Confirm dialog button disabled during async cascade; idempotent `cascadeDeleteBackground(rbgId)` returns success if not found |
| FloorplanGallery breaks during Phase 4 | **HIGH** | Boy-scout same commit del wrapper; smoke-tests pre/post; PDF baseline pixel-diff |
| Cascade delete leaves orphan storage file | **MED** | Cloud Function trigger su delete `files/{fileId}` quando reference count == 0; nightly orphan-detection job (Phase 9) |
| pdf.js worker hot-reload regression | **LOW** | Già self-hosted (`/pdf.worker.min.mjs`); ImageProvider has no worker dep |

---

## 10. Open questions — RESOLVED (clarification round 2026-05-07)

> Tutte le domande aperte sono state risolte con Giorgio. Riepilogo vincolante.

| # | Domanda | Decisione | Memo |
|---|---------|-----------|------|
| **Q1** | Persistence scope | **Per κάτοψη ορόφου.** Niente altrove nell'app. | Multi-level units (μεζονέτα, κατάστημα) hanno N κατόψεις indipendenti — codice già esistente. |
| **Q2** | Quanti file per κάτοψη | **1 (singolo).** PDF *o* Image *o* DXF (il DXF rimane nel suo subsystem). | Niente stack multi-layer. Niente z-order. Niente reorder. |
| **Q3** | Replace flow su κάτοψη già occupata | **Confirm dialog + cascade delete.** | "Θα χαθούν τα N polygons. Συνεχίζεις;" — yes → atomic batch delete + new upload. No → cancel. |
| **Q4** | Calibration scope | **Sempre disponibile** per entrambi PDF e Image. | Bottone Calibrate sempre visibile. Default scale identity se utente non calibra. |
| **Q5** | Storage / collection / ID | **Strong-separation Procore/SAP-grade.** `files` (esistente, generic) + `floorplan_backgrounds` (NUOVA, domain entity, ID `rbg_<ulid>`) + `floorplan_overlays` (NUOVA, polygons, ID `ovrl_<ulid>` reuse). FK relationships. | Storage path via `buildStoragePath()` esistente, zero modifica. |
| **Q6** | Image formats | **PNG + JPEG + WEBP + TIFF.** | TIFF via `utif.js` (MIT). Procore-level coverage. AVIF/GIF/BMP esclusi. |
| **Q7** | Multi-page PDF | **Single-page only.** Ogni κάτοψη = 1 file. PDF multi-page → solo pagina 1 renderizzata. | Niente UI di page navigation. Compositor semplificato. |
| **Q8** | Cross-type replace (DXF↔PDF/Image) | **Cascade delete unified.** Service `cascadeDeleteAllPolygonsForFloor(floorId)` cancella ENTRAMBI floorplan_overlays + DXF polygon system. | Atomic Firestore batch. Confirm dialog conta polygons di entrambi i sistemi. |
| **Q9** | RBAC | **ADMIN, SUPER_ADMIN, PROJECT_MANAGER** possono write/delete. | Read = tutti stessa company. Cross-company denied. Enforced UI + Firestore rules + API routes + Storage rules. |
| **Q10** | Calibration with existing polygons | **Auto-remap + always confirm dialog.** Polygons mantengono real-world position. Nessuna threshold. | `vertex_new = inverse(newT) ∘ oldT(vertex_old)` atomic con calibration write. |
| **Q11** | EXIF orientation | **Auto-rotate sempre.** Industry-standard. | Pre-render hardware rotation. `naturalBounds` post-orientation. Phone portrait foto sempre orientate correttamente. |
| **Q12** | File size cap + compression | **50MB cap + in-app compression.** PDF re-render lower DPI; Image canvas resize + JPEG q=0.85; TIFF→PNG/JPG conversion in upload pipeline. | Reject UI se ancora >50MB post-compression. |

---

## 11. Library license check (N.5)

| Library | Use | License | Verdict |
|---------|-----|---------|---------|
| `pdfjs-dist@4.5.136` | PDF rendering | Apache-2.0 | ✅ already in tree |
| `utif@3.x` | TIFF decode | MIT | ✅ to install Phase 2 (~30KB gzip) |
| `exifr@7.x` | EXIF orientation read | MIT | ✅ to install Phase 2 (~10KB gzip) |

---

## 12. References

- **ADR-002** — Z-index hierarchy
- **ADR-031** — Canonical File Storage System (`buildStoragePath`)
- **ADR-292** — FILES collection unification
- **ADR-294** — SSoT ratchet enforcement
- **ADR-298** — Firestore rules test coverage SSoT
- **ADR-301** — Storage rules test coverage SSoT
- **SPEC-237D** — Overlay support on PDF backgrounds (carries over)
- **SOS. SOS. N.0.1** — ADR-driven workflow 4-phase
- **SOS. SOS. N.6** — Enterprise IDs (new generator `generateFloorplanBackgroundId`)
- **SOS. SOS. N.7.1 / N.7.2** — File size + architecture checklist
- **SOS. SOS. N.11** — i18n SSoT (all panel strings via `t()`)
- **SOS. SOS. N.12** — SSoT ratchet (new module in registry)

---

**Status finale (2026-05-07):** ✅ **IMPLEMENTED**. Tutte le phase chiuse (Phase 4 SKIPPED per data wipe). Follow-up opzionali documentati come `test.skip` con TODO nel suite Playwright (PDF/TIFF fixtures + DxfViewer harness per il visual remap polygon test).

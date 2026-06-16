# ADR-465 — Cross-Floor Floorplan Duplicate

> **Status:** ✅ APPROVED (implemented v1, UNCOMMITTED) — 2026-06-16
> **Scope:** DXF Viewer · Floorplan Import feature
> **Supersedes / relates:** ADR-240 (pipeline unification), ADR-340 (smart upload), ADR-420 (autosave file-doc), ADR-187/309/399/448 (levels ↔ floors)

---

## 1. Context / Problem

A user wants to **copy an existing DXF floorplan from one floor to another** (e.g. from
«Θεμελίωση» to «Ισόγειο») without re-uploading the file by hand. Today the **only** way to
get a floorplan onto a floor is the Floorplan Import Wizard. There is no «Duplicate to floor».

Why the obvious gestures do **not** work (confirmed in code):

1. There is **no Ctrl+V / paste** — `config/keyboard-shortcuts.ts` has only `Ctrl+C`/`Ctrl+A`.
2. `Ctrl+C` is **not** a clipboard copy — `case 'copy-selected'` activates the `bim-copy` tool
   (AutoCAD COPY: base→target translate **within the same floor**); it stores nothing.
3. `bim-copy` only handles **BIM entities** (wall/opening/slab/column/beam/stair) — not raw DXF
   floorplan geometry.
4. Switching floors resets the tool (`bimIdsRef` cleared on deactivation). No cross-floor path.

➡️ A **new action** is required that reuses the EXISTING import pipeline, targeting the
destination floor.

## 2. Decision

### 2.1 Architecture — maximum reuse (no new import path)

The canonical entry point `useFloorplanSmartUpload().uploadSmart(file)` already performs the
WHOLE pipeline: pre-flight **wipe** of the target floor → `generateFileId()` → canonical
**storage path** → `dual-write-to-files` (correct `displayName`) → **process** (scene.json) →
thumbnail → dxfLevel. It accepts a plain `File`.

Therefore the duplicate is **UI + orchestration glue** only. The duplicate flow == the wizard's
**Step-6 upload**, but with a PRE-SUPPLIED source `File` and a FIXED destination floor:

```
sourceFloor.files (primaryFile)
   │  fetch(downloadUrl) → File          ← downloadFileRecordAsFile()  (CORS-safe)
   ▼
uploadSmart(File)  with destConfig       ← buildFloorDuplicateConfig() (floor-level)
   │  wipe + fileId + path + dual-write + process + thumbnail + dxfLevel  (UNCHANGED)
   ▼
onComplete(File, WizardCompleteMeta)     ← REUSED handleImportComplete (render + level wiring)
```

`handleImportComplete` (the existing wizard `onComplete` body) was **extracted** in `LevelPanel`
so BOTH the wizard and the duplicate dialog call ONE handler — no copy-paste (N.0.2).

### 2.2 Design decision — what is copied (v1 = Option A)

- **(A) the original source `.dxf`** (storage object via `downloadUrl`) → the destination
  re-parses a clean original floorplan. **Deterministic, zero-risk. CHOSEN for v1.**
- (B) the **current edited state** (scene.json + BIM entities, re-id'd on the dest floor + BOQ)
  → bigger «Revit duplicate». **DEFERRED** as «Duplicate with BIM».

### 2.3 Destination BIM (v1)

`uploadSmart(file, { wipeBim: false })` — the wipe clears the destination's polygons /
backgrounds / dxf-levels / file records but **keeps** existing BIM (matches the wizard default).
A BIM-wipe toggle is deferred together with Option B.

## 3. Anti-duplicate guardrails (honoured)

| Concern | SSoT reused |
|---|---|
| Whole pipeline | `useFloorplanSmartUpload.uploadSmart` |
| Dest config shape | `buildFloorDuplicateConfig` mirrors wizard `uploadConfig` (`FLOORPLAN_PURPOSE_BY_TYPE.floor`) |
| Source DXF discovery | `useFloorplanFiles({ entityType:'floor', entityId: sourceFloorId })` |
| Download bytes → File | `fetch(downloadUrl)` (proven in `FloorFloorplanService`) |
| File ID / path / displayName | generated inside the pipeline — never hand-built |
| Render + level wiring | extracted `handleImportComplete` (shared with wizard) |
| Action menu | `LevelListCard` actions array (added `onDuplicate`) |

## 4. Implementation

**New**
- `features/floorplan-import/utils/floorplan-duplicate-core.ts` — pure: `downloadFileRecordAsFile`,
  `buildFloorDuplicateConfig`.
- `features/floorplan-import/components/DuplicateFloorplanDialog.tsx` — dest picker + wipe preview
  + confirm; runs `uploadSmart(sourceFile)` then fires the reused `onComplete`.

**Modified**
- `subapps/dxf-viewer/ui/components/LevelPanel.tsx` — extracted `handleImportComplete` (SSoT for
  wizard + duplicate); `duplicateSource` state; `duplicateDestinations` (building floors minus
  source); `onDuplicate` on each level card; render the dialog.
- `domain/cards/level/LevelListCard.tsx` — `onDuplicate?` prop → `Copy` action.
- `features/floorplan-import/index.ts` — export `DuplicateFloorplanDialog`, `WizardCompleteMeta`,
  `DuplicateDestinationFloor`.
- `i18n/locales/{el,en}/dxf-viewer-panels.json` — `panels.levels.duplicateFloorplan.*` keys.

## 5. Verification

- **Firestore**: new `files` doc on the dest floor — correct `entityId`/`displayName`/`storagePath`,
  `createdAt` write-once, `layerCount > 0`.
- **Storage**: dest path has `.dxf` + `.processed.json`/scene + thumbnail.
- **Browser**: dest floor opens with the floorplan visible (identical to source).

## 6. Changelog

- **2026-06-16** — v1 implemented (Option A), UNCOMMITTED. Pure core + dialog + LevelPanel
  extraction + card action + i18n. DEFER: Option B «Duplicate with BIM», dest BIM-wipe toggle.

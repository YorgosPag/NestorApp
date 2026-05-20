# ADR-368 — DXF Import Drawing Units Override (AutoCAD/Revit Pattern)

**Status:** IMPLEMENTED  
**Date:** 2026-05-20  
**Scope:** DXF Viewer — Import Wizard + Scene Unit Resolution  
**Replaces patches:** ADR-362 R12 (dim-style-importer rescue) + ADR-362 R13 (dim-text-renderer rescue) — these remain as fallback for legacy files

---

## 1. Problem

Greek architectural DXF files declare `$INSUNITS=4` (mm) in the DXF header but store coordinates in **meters** — a nationwide AutoCAD default issue. This caused a cascade of rendering patches:

| Round | Symptom | Patch |
|-------|---------|-------|
| R12 | Imported dim styles microscopic (dimscale=1 in m-scene) | dim-style-importer rescue: dimscale→100 |
| R13 | Built-in styles (ISO_129) still microscopic | dim-text-renderer rescue: effectiveDimscale→100 |

Each patch fixed one symptom while potentially introducing another. Root cause was never addressed.

**Root cause:** The system had no way for the user to declare "my DXF is in meters" — it relied entirely on heuristics (`resolveSceneUnits` bounds diagonal).

---

## 2. Industry Standard (AutoCAD/Revit Pattern)

| Application | Pattern |
|-------------|---------|
| **AutoCAD** | "Insert Units" dialog on open — user confirms/overrides units |
| **Revit** | "Link CAD" dialog → "Import Units" dropdown |
| **BricsCad** | Same as AutoCAD |
| **ArchiCAD** | "Import Scale" setting |

**Industry consensus:** Auto-detect + user override. No application relies on heuristics alone.

---

## 3. Decision

Add a **"Μονάδες Σχεδίου" (Drawing Units)** step to the DXF Import Wizard, between level selection and calibration.

### User flow (4 steps total):
```
1. Επιλογή Επιπέδου (Level Selection)
2. Μονάδες Σχεδίου ← NEW (ADR-368)
3. Βαθμονόμηση (Calibration, optional)
4. Προεπισκόπηση & Εισαγωγή (Preview & Import)
```

### Unit resolution priority (SSoT hierarchy):
```
1. FloorplanDoc.userDrawingUnits  ← user-explicit (ADR-368) — HIGHEST PRIORITY
2. resolveSceneUnits(scene)       ← R12 heuristic (bounds + $INSUNITS)
3. R12 dim-style-importer rescue  ← dimscale patch for imported styles
4. R13 dim-text-renderer rescue   ← dimscale patch for built-in styles (LOWEST)
```

---

## 4. Architecture

### 4.1 Data Model

**`FloorplanDoc`** (config.ts):
```typescript
userDrawingUnits?: SceneUnits  // set by wizard; overrides resolveSceneUnits at render time
```

**`ImportWizardState`** (config.ts):
```typescript
step: 'level' | 'units' | 'calibration' | 'preview' | 'complete'
userDrawingUnits?: SceneUnits | 'auto'  // 'auto' = use heuristic (default)
```

**`ImportWizardActions`** (config.ts):
```typescript
setUserDrawingUnits?: (units: SceneUnits | 'auto') => void
```

### 4.2 Unit Resolution at Render Time

**`useDxfSceneConversion`** (hooks/canvas/useDxfSceneConversion.ts):
```typescript
// Before (R12):
units: resolveSceneUnits(currentScene)

// After (ADR-368):
units: userDrawingUnits ?? resolveSceneUnits(currentScene)
```

**`CanvasSection`** passes the active floorplan's override:
```typescript
const currentFloorplan = Object.values(levelManager.floorplans).find(
  f => f.levelId === levelManager.currentLevelId
);
const { dxfScene } = useDxfSceneConversion({
  currentScene: props.currentScene ?? null,
  userDrawingUnits: currentFloorplan?.userDrawingUnits,
});
```

### 4.3 Persistence

`FloorplanDoc.userDrawingUnits` is stored in Firestore alongside the floorplan document. Persists across sessions. Per-file (not per-user preference).

---

## 5. UI — DrawingUnitsStep Component

**File:** `ui/wizard/DrawingUnitsStep.tsx`

Options displayed (radio group):
| Value | Label (el) | Description |
|-------|-----------|-------------|
| `auto` | Αυτόματος εντοπισμός ✨ | Ανάλυση διαστάσεων — καλύπτει τα περισσότερα ελληνικά DXF |
| `m` | Μέτρα (m) | Τυπικό για ελληνικά αρχιτεκτονικά σχέδια AutoCAD |
| `cm` | Εκατοστά (cm) | Χρησιμοποιείται σε ορισμένα ευρωπαϊκά σχέδια |
| `mm` | Χιλιοστά (mm) | Κατασκευαστικά, μηχανολογικά, λεπτομέρειες |
| `ft` | Πόδια (ft) | Αγγλοσαξονικά αρχεία (ΗΠΑ, ΗΒ) |
| `in` | Ίντσες (in) | Αγγλοσαξονικά αρχεία — λεπτομέρειες |

Default: `auto` (safe for all existing files).

Example values shown inline (e.g., "τοίχος 5μ → 5.00" for meters).

---

## 6. Impact on R12 + R13 Patches

| Patch | Status after ADR-368 | Reason |
|-------|---------------------|--------|
| R12 dim-style-importer rescue | **Kept as fallback** | Files imported before ADR-368 have no `userDrawingUnits` |
| R13 dim-text-renderer rescue | **Kept as fallback** | Same — backward compatibility |
| R12 resolveSceneUnits() call | **Kept as fallback level 2** | Still needed when userDrawingUnits='auto' |

When `userDrawingUnits` is set → R12+R13 patches are bypassed entirely. Correct units flow from the top of the priority chain.

---

## 7. Files Changed

| File | Change |
|------|--------|
| `systems/levels/config.ts` | `FloorplanDoc.userDrawingUnits`, `ImportWizardState.step` + `userDrawingUnits`, `ImportWizardActions.setUserDrawingUnits` |
| `hooks/common/useImportWizard.ts` | `setUserDrawingUnits()` action + `completeImport` persists it |
| `systems/levels/LevelsSystem.tsx` | Wires `setUserDrawingUnits` through context |
| `systems/levels/useLevels.ts` | Exposes `setUserDrawingUnits` in `useImportWizard()` hook |
| `ui/wizard/DrawingUnitsStep.tsx` | **NEW** — radio group UI for unit selection |
| `ui/ImportWizard.tsx` | Adds `case 'units'` + imports DrawingUnitsStep |
| `hooks/useWizardNavigation.ts` | Adds `'units'` step to navigation flow (4 steps total) |
| `hooks/canvas/useDxfSceneConversion.ts` | Adds `userDrawingUnits?` param; uses it over resolveSceneUnits |
| `components/dxf-layout/CanvasSection.tsx` | Resolves current floorplan, passes `userDrawingUnits` |
| `i18n/locales/el/dxf-viewer-wizard.json` | `drawingUnits.*` keys (Greek) |
| `i18n/locales/en/dxf-viewer-wizard.json` | `drawingUnits.*` keys (English) |

---

## 8. Changelog

- **2026-05-20 (Initial implementation)**
  - Added "Μονάδες Σχεδίου" wizard step (step 2 of 4).
  - `FloorplanDoc.userDrawingUnits` field — per-file Firestore storage.
  - `useDxfSceneConversion` uses user override first, falls back to resolveSceneUnits.
  - R12+R13 patches retained as backward-compatible fallback.
  - ✅ Google-level: YES — industry-standard pattern (AutoCAD/Revit parity); explicit user intent overrides heuristics; backward-compatible for legacy files.

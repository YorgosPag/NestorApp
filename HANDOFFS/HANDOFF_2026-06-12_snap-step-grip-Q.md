# HANDOFF — SNAP-MODE «βήμα» στο 2Δ grip-drag (κράτα Q) + 2 pending fixes

**Ημερομηνία:** 2026-06-12 · **Μοντέλο:** Opus 4.8 · **Subapp:** `localhost:3000/dxf/viewer`

---

## 🎯 ΓΕΝΙΚΟ ΠΛΑΙΣΙΟ
Revit-grade DXF viewer, **FULL ENTERPRISE + FULL SSoT**. Απάντηση **στα Ελληνικά**.
**COMMIT/PUSH τα κάνει ΜΟΝΟ ο Giorgio.** Το working tree **μοιράζεται με άλλον agent** →
`git add` **ΜΟΝΟ τα δικά σου αρχεία**, **ΠΟΤΕ** `-A`, **ΠΟΤΕ** `--no-verify`.

⚠️ **SHARED FILE:** `systems/constraints/cad-toggle-state.ts` το επεξεργάζεται **ΚΑΙ άλλος agent**
(το refactored σε subscribable store με `subscribe`/`notify`/useSyncExternalStore για το ortho
multi-instance bug). Οι δικές μου προσθήκες (`setSnap`/`isSnapOn`/`getSnapStep`) συνυπάρχουν εκεί.
Προσοχή στο merge/commit.

---

## ⛔ ΕΝΕΡΓΟ ΠΡΟΒΛΗΜΑ (ΚΑΝΕ ΤΟ ΠΡΩΤΟ): SNAP-MODE «κράτα Q → βήμα» — ΑΚΟΜΗ ΔΕΝ ΛΕΙΤΟΥΡΓΕΙ

### Τι θέλει ο Giorgio (τελικό μοντέλο, κλειδωμένο)
- F9 toggle (status bar) = master + εμφανίζει **inline πεδίο τιμής σε mm** (live, χωρίς popover/κουμπί).
- **Default = ελεύθερη κίνηση.** Κατά το grip-drag, **κράτα `Q` → βηματική κίνηση** (release → ελεύθερο).
- `Q` = κανονικά εργαλείο «Τόξο» (`tool:arc-3p`) → context-sensitive: step-override ΜΟΝΟ μέσα σε grip-drag.

### Τι έχει υλοποιηθεί (η ΛΟΓΙΚΗ είναι σωστή — 9/9 jest, αλλά στο browser ΔΕΝ δουλεύει)
- **NEW** `bim/grips/grip-step-quantize.ts` — pure `quantizeDeltaToStep` + `applyGripStepSnap`
  (gate = `cadToggleState.isSnapOn() && QKeyTracker.getSnapshot()`· step mm → scene units μέσω
  `immediateSceneScale.getMmToScene()`). Έχει **TEMP DEBUG console.log** (`[SNAP-Q] applyGripStepSnap`).
- **NEW** `keyboard/QKeyTracker.ts` — sibling Ctrl/Shift trackers· window capture keydown/keyup/blur·
  context-sensitive preventDefault+stopPropagation στο Q **μόνο όταν `getActiveDragGrip()` non-null**.
  Έχει **TEMP DEBUG** (`[SNAP-Q] Q keydown {dragging}` / `[SNAP-Q] Q keyup`).
- **NEW** `systems/cursor/ImmediateSceneScaleStore.ts` — non-React mm→scene scale (sole writer
  `useDxfSceneConversion` effect on `dxfScene.units`). Λύνει το «σχέδιο ≠ mm → βήμα μηδενίζει κίνηση».
- **MOD** `hooks/useKeyboardShortcuts.ts` — **guard**: `if ((e.key==='q'||e.key==='Q') && getActiveDragGrip()) return;`
  στην ΑΡΧΗ του onKeyDown (αλλιώς «γράμμα σε select mode → command line» άνοιγε command line «Q» κι έκλεβε focus).
- **MOD** `statusbar/CadStatusBar.tsx` — `SnapToggleWithStep` (toggle + inline live mm πεδίο, w-24)
  + **single-writer** effect `cadToggleState.setSnap(snap.on, snapStep)` (ΜΟΝΟ εδώ).
- **MOD** `hooks/common/useCadToggles.ts` — `snapStep` στο slice/DEFAULTS/setter· **αφαιρέθηκε** το snap mirror
  (έμεινε ΜΟΝΟ στο CadStatusBar).
- **MOD** `systems/constraints/cad-toggle-state.ts` — `setSnap`/`isSnapOn`/`getSnapStep` (snapStep = **mm**).
  ⚠️ shared file (βλ. πάνω).
- **MOD** `hooks/grips/grip-projections.ts` + `hooks/grips/grip-mouse-handlers.ts` — `applyGripStepSnap(delta)`
  στα 2 SSoT delta-points (preview ghost + commit, 4 σημεία) → καλύπτουν ΟΛΑ τα BIM entities.
- **MOD** `config/user-settings-schema.ts` (src/services/user-settings/) — `snapStep?: number` optional.
- **MOD** i18n `el/en dxf-viewer-panels.json` — `cadDock.statusBar.snapStepTitle` + `snapDesc` «κράτα Q».
- **Tests:** `bim/grips/__tests__/grip-step-quantize.test.ts` 9/9 (math + wiring gate + unit-scale).

### 🔬 ΠΡΩΤΟ ΒΗΜΑ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ: διάβασε τα F12 logs του Giorgio
Ο Giorgio θα τρέξει: F9 ON → γράψει τιμή (π.χ. 100) → πιάσει χερούλι → κρατήσει Q → κουνήσει ποντίκι.
Στο F12 console ψάξε `[SNAP-Q]`:
- **Αν ΔΕΝ εμφανίζεται `[SNAP-Q] Q keydown`** → το Q δεν φτάνει στον QKeyTracker (άλλος capture listener το τρώει
  πρώτος με stopImmediatePropagation, ή ο tracker δεν φορτώθηκε). Έλεγξε registration order / import.
- **Αν `Q keydown {dragging:false}`** → το `getActiveDragGrip()` είναι null τη στιγμή του Q → ο guard στο
  dispatcher δεν ενεργοποιείται → command line ανοίγει. Ρίζα: το entity που σύρει ΔΕΝ καλεί `setActiveDragGrip`
  (ή έχει ήδη γίνει clear). Έλεγξε `grip-mouse-handlers.runGripMouseDown` setActiveDragGrip για το συγκεκριμένο grip kind.
- **Αν `applyGripStepSnap {snapOn:false}`** → το F9 δεν φτάνει στο cadToggleState (CadStatusBar single-writer effect).
- **Αν `applyGripStepSnap {qHeld:false}`** ενώ κρατάει Q → ο tracker δεν κρατά state (keyup πρόωρο/blur).
- **Αν `scale` λάθος** (π.χ. 0.001 ενώ σχέδιο mm, ή 1 ενώ μέτρα) → λάθος μονάδες → βήμα αόρατο/μηδέν.
- **Αν `delta` πολύ μικρό/μεγάλο σε σχέση με stepMm×scale** → units mismatch.
**Με βάση το log → εντόπισε & διόρθωσε τη ρίζα (Revit-grade, SSoT). ΜΕΤΑ αφαίρεσε τα TEMP DEBUG logs.**

### Πιθανές υποψίες (κατά σειρά)
1. `getActiveDragGrip()` null για το entity του Giorgio → guard δεν πιάνει → command line «Q».
2. Preview ghost ανανεώνεται ΜΟΝΟ σε mouse-move → πάτημα Q χωρίς κίνηση δεν δείχνει τίποτα (ο Giorgio ίσως δεν κουνά).
3. Registration order των window-capture keydown (QKeyTracker vs useKeyboardShortcuts) → stopImmediatePropagation.

---

## 🔴 ΑΛΛΑ 2 PENDING (verify + commit — ανεξάρτητα, ΟΛΟΚΛΗΡΩΜΕΝΑ)

### A) ADR-377 test fix (test-only, ο κώδικας ήταν σωστός)
`state/__tests__/bim-render-settings-subcategory.test.ts` — wall ΕΧΕΙ default `interior` subcat (C.9)·
«WITHOUT defaults» test→`slab`· +test wall-restores-default. 11/11. + ADR-377 changelog v1.2.

### B) ADR-436 πεδιλοδοκός justified-strip grip alignment (Revit Location Line)
Τα grips justified (left/right) strip/tie-beam κάθονταν στον raw άξονα αντί στο έκκεντρο σώμα.
**Fix SSoT:** `geometry/foundation-geometry.ts` NEW `stripJustifiedAxis()` + `unjustifyStripAxis()`
(reuse στο `buildBandFootprint`)· `bim/foundations/foundation-grips.ts` `lineAxisBoxParams`→justified άξονας,
`lineFromAxisPatch`→un-justify write-back. 55/55 jest + ADR-436 changelog. tsc 0.
⚠️ ADR-441 / foundation-grid-*.ts = **άλλος agent** — ΜΗΝ τα αγγίξεις.

---

## 📋 git add list (ΜΟΝΟ δικά μου — shared tree· ο Giorgio κάνει commit)
```
# SNAP-MODE step (κράτα Q)
src/subapps/dxf-viewer/bim/grips/grip-step-quantize.ts
src/subapps/dxf-viewer/bim/grips/__tests__/grip-step-quantize.test.ts
src/subapps/dxf-viewer/keyboard/QKeyTracker.ts
src/subapps/dxf-viewer/systems/cursor/ImmediateSceneScaleStore.ts
src/subapps/dxf-viewer/hooks/canvas/useDxfSceneConversion.ts
src/subapps/dxf-viewer/hooks/useKeyboardShortcuts.ts
src/subapps/dxf-viewer/statusbar/CadStatusBar.tsx
src/subapps/dxf-viewer/hooks/common/useCadToggles.ts
src/subapps/dxf-viewer/hooks/grips/grip-projections.ts
src/subapps/dxf-viewer/hooks/grips/grip-mouse-handlers.ts
src/services/user-settings/user-settings-schema.ts
src/i18n/locales/el/dxf-viewer-panels.json
src/i18n/locales/en/dxf-viewer-panels.json
# ⚠️ SHARED με άλλον agent — επιβεβαίωσε πριν add:
src/subapps/dxf-viewer/systems/constraints/cad-toggle-state.ts
# ADR-377 test fix
src/subapps/dxf-viewer/state/__tests__/bim-render-settings-subcategory.test.ts
docs/centralized-systems/reference/adrs/ADR-377-bim-subcategories-system.md
# ADR-436 foundation justified-strip grip
src/subapps/dxf-viewer/bim/geometry/foundation-geometry.ts
src/subapps/dxf-viewer/bim/foundations/foundation-grips.ts
src/subapps/dxf-viewer/bim/foundations/__tests__/foundation-grips.test.ts
docs/centralized-systems/reference/adrs/ADR-436-bim-foundation-discipline.md
# Docs (κοινά — επιβεβαίωσε)
docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md
local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt
```
**ΜΗΝ** προσθέσεις: foundation-preview-helpers (pre-existing fail = άλλου agent WYSIWYG)· ADR-441· foundation-grid-*.

## 🚨 ΚΑΝΟΝΕΣ
- Ελληνικά. Μοντέλο Opus. FULL ENTERPRISE + FULL SSoT (όπως Revit).
- ΟΧΙ commit/push (Giorgio). Shared tree → git add μόνο δικά σου, ΠΟΤΕ -A/--no-verify.
- N.17: ΕΝΑ tsc τη φορά (έλεγξε με wmic πριν).
- Μετά τη διόρθωση → **αφαίρεσε τα TEMP DEBUG `[SNAP-Q]` console.log**.
- Memory: `reference_grip_step_snap_ssot.md` + `reference_axis_box_grips_ssot.md`.

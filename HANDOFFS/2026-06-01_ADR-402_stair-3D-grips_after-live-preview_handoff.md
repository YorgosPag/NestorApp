# HANDOFF — ADR-402: Πλήρη Revit-style 3Δ grips για σκάλα (επόμενη φάση)

**Ημερομηνία:** 2026-06-01
**Μοντέλο:** Opus 4.8 (Developer A SOLO)
**Προηγούμενο:** **Live preview** ✅ DONE (η οντότητα ακολουθεί ζωντανά τον κέρσορα σε move/rotate/resize) — pending commit.
**Επόμενο:** **Stair 3Δ grips** = πλήρη Revit-style draggable grips για σκάλα στον 3Δ καμβά (όχι μόνο τα 2 gizmo resize handles).

---

## 0. ΚΑΤΑΣΤΑΣΗ ΤΩΡΑ — ΔΙΑΒΑΣΕ ΠΡΩΤΑ

### ⚠️ COMMIT STATUS — ΚΡΙΣΙΜΟ
**Ο Giorgio κάνει ΟΛΑ τα commits ο ίδιος — ΟΧΙ εσύ (N.(-1)).** Όταν ξεκινήσεις:
1. **Τρέξε `git log --oneline -15` + `git status` ΠΡΩΤΑ.** Multi-agent repo — μην υποθέσεις.
2. Το ADR-402 **live-preview** + οι προηγούμενες φάσεις (Port A/B/C, vertical move, stair resize) μπορεί να έχουν **ήδη γίνει commit** από τον Giorgio μέχρι να ξεκινήσεις τη νέα session — **ή όχι**. Έλεγξε.

### Τι ήταν pending commit όταν γράφτηκε αυτό (ADR-402 live-preview):
```
src/subapps/dxf-viewer/bim-3d/animation/bim3d-edit-live-preview.ts          (NEW)
src/subapps/dxf-viewer/bim-3d/animation/bim3d-preview-rebuild.ts            (NEW)
src/subapps/dxf-viewer/bim-3d/animation/__tests__/bim3d-edit-live-preview.test.ts (NEW)
src/subapps/dxf-viewer/bim-3d/animation/bim3d-edit-interaction-handlers.ts  (MOD)
src/subapps/dxf-viewer/bim-3d/animation/use-bim3d-edit-interaction.ts       (MOD)
src/subapps/dxf-viewer/bim-3d/gizmo/bim-gizmo-controller.ts                 (MOD: getLivePreview)
src/subapps/dxf-viewer/bim-3d/gizmo/bim-gizmo-drag-bridge.ts                (MOD: getLiveRotationRad)
src/subapps/dxf-viewer/bim-3d/gizmo/__tests__/bim-gizmo-drag-bridge.test.ts (MOD)
docs/centralized-systems/reference/adrs/ADR-402-3d-bim-element-editing.md   (MOD: doc+changelog)
```
> ⚠️ Στο ίδιο working tree υπάρχει **ΚΑΙ άσχετη δουλειά ADR-401 F.3 + ADR-403** (column attach/placement: `AttachColumnsCommand`, `column-structural-attach-coordinator`, `useWallAttachTool`, ribbon files, `bim/entities/`). **ΜΗΝ** τα μπερδέψεις με το ADR-402. ΟΧΙ `git add -A` ποτέ.

### Tests / tsc (live-preview): ✅ 25/25 PASS (live-preview + drag-bridge), tsc 0.
### 🔴 Εκκρεμεί ακόμη: browser verify του live-preview (move/rotate/resize/κάθετο).

---

## 1. ΕΠΟΜΕΝΗ ΦΑΣΗ — SCOPE: Stair 3Δ grips

### Τι ΥΠΑΡΧΕΙ ήδη για τη σκάλα στο 3Δ:
- **Move / rotate / κάθετο move** → δουλεύουν type-agnostic (gizmo Port A + vertical move).
- **Resize** → ΜΟΝΟ **2 gizmo handles** (πλάτος μέσω `resize-x` perp, run/βήματα μέσω `resize-z` axial) via `computeStairResizeParams` στο `bim-3d/gizmo/bim3d-resize-bridge.ts`. `RESIZE_HANDLES_BY_TYPE.stair = ['resize-x','resize-z']` (plan-only).
- Απόφαση Giorgio (Sub-Phase 1, 2026-06-01): «**gizmo handles τώρα, πλήρη Revit-style 3Δ grips ως επόμενη φάση**» → **ΑΥΤΗ είναι η φάση**.

### ❌ Τι ΛΕΙΠΕΙ (το έργο αυτής της φάσης):
Πλήρη draggable **grip points** στον 3Δ καμβά για σκάλα — mirror των 2Δ grips — όχι μόνο τα 2 gizmo βέλη. Δηλαδή ανά grip kind:
- `stair-base` (σημείο βάσης), `stair-direction` (κατεύθυνση/περιστροφή flight)
- `stair-width`, `stair-length`
- corner grips (start/end)
- per-flight: `stair-flight1-end`, `stair-flight2-start`
- landing: `stair-landing-depth`, `stair-landing-corner-radius`

### 🟢 SSoT ΠΟΥ ΥΠΑΡΧΕΙ ΗΔΗ — REUSE, ΜΗΝ ΔΙΠΛΑΣΙΑΣΕΙΣ:
- **`bim/stairs/stair-grips.ts`** → `getStairGrips(entity): GripInfo[]` — ΟΛΑ τα grip σημεία (θέσεις σε 2Δ plan + `stairGripKind`). + `stairGripGlyphShape(kind)`.
- **`bim/stairs/stair-grip-transforms.ts`** → `applyStairGripDrag(input): StairVariantParams` — η **πλήρης** drag-resolve λογική για ΚΑΘΕ grip kind (width/length/corner/flight/landing/direction, με clamps + whole-step snapping). **ΑΥΤΟ είναι το engine — απλώς γέφυρωσέ το στο 3Δ.**
- **`bim/types/stair-types.ts`** → `StairEntity`, `StairVariantParams`.
- **Command:** `core/commands/entity-commands/UpdateStairParamsCommand.ts` (ήδη στο `EditCommand` union του 3D edit handler).
- **Converter:** `stairToMeshes` (`bim-3d/converters/StairToThreeConverter.ts`) + `computeStairGeometry` (`bim/geometry/stairs/StairGeometryService.ts`).
- **Live-preview rebuild:** `bim3d-preview-rebuild.ts` → `rebuildStair` ΗΔΗ υπάρχει (χρησιμοποιεί `computeStairResizeParams`). Για τα νέα grips, ίσως θες παράλληλο rebuild path που δέχεται `StairVariantParams` απευθείας από `applyStairGripDrag` (αντί `ResizeDragMm`).

### 📐 ΣΧΕΔΙΑΣΤΙΚΟ ΕΡΩΤΗΜΑ (recognition first — ΡΩΤΑ GIORGIO σε απλά ελληνικά + παράδειγμα):
**Πώς θέλει τα 3Δ grips;**
- (α) **Discrete 3Δ grip spheres** ανά σημείο (όπως τα 2Δ grips αλλά στον 3Δ χώρο) — Revit-style, drag το καθένα ξεχωριστά. **(Πιθανότατα αυτό — το είπε «Revit-style grips».)**
- (β) Επέκταση gizmo με περισσότερα handles.

Αν (α): υπάρχει ήδη 3Δ grip-rendering subsystem ή μόνο το gizmo overlay; **Investigate** `bim-3d/gizmo/` + `bim-3d/` για τυχόν grip overlay. Αν δεν υπάρχει, ίσως πρέπει να φτιαχτεί ένα μικρό 3Δ grip overlay (raycast σε grip spheres → drag στο floor plane / axis → `applyStairGripDrag` → live preview rebuild → `UpdateStairParamsCommand` στο release). Mirror του `bim-gizmo-overlay` + `bim-gizmo-controller` pattern.

### Units παγίδα (ΚΡΙΣΙΜΟ — έχει χτυπήσει ξανά):
- Grip θέσεις/params σε **mm** (drawing-units), click worldPoint σε **scene units**.
- Reuse `mmToSceneUnits(inferSceneUnitsFromWidth)` / `mmFactorFromWidth` (ίδιο factor με `getStairGrips`/`computeStairResizeParams`, scene-safe mm/cm/m). **Διάβασε grip positions από computed geometry, ΠΟΤΕ re-derive από raw mm.** [[feedback_grip_positions_read_geometry]]

---

## 2. ⚠️ ΚΡΙΣΙΜΑ ΣΗΜΕΙΑ (CLAUDE.md + lessons)

- **N.(-1):** ΟΧΙ commit/push χωρίς ρητή εντολή. **Ο Giorgio κάνει τα commits — ΟΧΙ εσύ.** ΟΧΙ `git add -A`.
- **N.8/N.14:** Νέα φάση 3Δ grips = πιθανώς **5+ αρχεία → Opus + Plan Mode.** Δήλωσε μοντέλο + κάνε recognition (διάβασε κώδικα) πριν γράψεις. Ρώτα scope (όλα τα grip kinds ή υποσύνολο;).
- **N.0.1 ADR-driven:** Recognition (code→ADR) → Implementation → ADR-402 update (changelog + sub-phase πίνακας: άλλαξε «πλήρες stair 3Δ grips (deferred)» σε DONE) → commit (Giorgio).
- **N.15:** Μετά την υλοποίηση → ενημέρωσε `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + ADR-402 + `adr-index.md` + memory MEMORY.md (project_adr402_genarc_gizmo_port.md). Όλα μαζί.
- **CHECK 6B/6D:** Αγγίζεις gizmo/render/scene/converter/grip files → **stage ADR-402** (+ADR-393 αν αγγίξεις stair grip λογική, +ADR-397 αν grip/glyph SSoT, +ADR-366 αν 3Δ viewport, +ADR-040 αν micro-leaf/scheduler).
- **i18n (N.11):** Νέα labels → κλειδιά ΠΡΩΤΑ σε `el/dxf-viewer-shell.json` **ΚΑΙ** `en/...`. Namespace `dxf-viewer-shell`. ΟΧΙ hardcoded/`defaultValue`.
- **rAF (ADR-040/366):** Live preview render = `manager.markSceneDirty()`, **ΠΟΤΕ** δικό σου `requestAnimationFrame` (UnifiedFrameScheduler SSoT).
- **3D mirrors 2D SSoT:** Μην φτιάξεις παράλληλη stair-grip λογική. Reuse `applyStairGripDrag`/`getStairGrips`. [[feedback_3d_mirror_2d_ssot]] [[feedback_derived_geometry_central_cascade]]

---

## 3. ΓΡΗΓΟΡΟ START (νέα session)
1. `git log --oneline -15` + `git status` → δες τι έχει committed ο Giorgio.
2. Δήλωσε μοντέλο (Opus) + μπες Plan Mode.
3. Recognition: διάβασε `stair-grips.ts`, `stair-grip-transforms.ts`, `bim-gizmo-overlay.ts`, `bim-gizmo-controller.ts`, `bim3d-edit-interaction-handlers.ts`, `bim3d-preview-rebuild.ts`. Δες αν υπάρχει 3Δ grip overlay subsystem.
4. Ρώτα Giorgio (απλά ελληνικά + παράδειγμα, ΕΝΑ ερώτημα τη φορά): discrete 3Δ grips (α) ή gizmo handles (β); ποια grip kinds;
5. Υλοποίησε → tests → tsc → ADR-402 + N.15 updates → σταμάτα, ο Giorgio κάνει commit.

**ADR-402 §«Σχέδιο σε υπο-φάσεις» + changelog 2026-06-01 = το roadmap. Code = source of truth.**

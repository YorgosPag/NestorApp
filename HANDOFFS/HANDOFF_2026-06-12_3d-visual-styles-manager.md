# HANDOFF — 3D Visual Styles Manager (Revit-grade) + παράδοση isolate work

**Ημερομηνία:** 2026-06-12
**Από:** Opus session (isolate feature) → **Προς:** νέο session (3D Visual Styles)
**Working tree:** SHARED με άλλον agent. **Commit:** ΜΟΝΟ ο Giorgio. Ποτέ `git add -A`, ποτέ `--no-verify`.

---

## ΜΕΡΟΣ Α — ΟΛΟΚΛΗΡΩΜΕΝΗ ΔΟΥΛΕΙΑ (uncommitted, περιμένει commit Giorgio)

**ADR-358 §5.6.bis — Isolate (3 scopes) — DONE + BROWSER-VERIFIED από Giorgio:**
- «Απομόνωση αντικειμένου» (Revit Isolate Element) — δεξί-κλικ → μόνο αυτή η οντότητα (2Δ+3Δ)
- «Απομόνωση κατηγορίας» (Revit Isolate Category) — μόνο ίδιο είδος (live), 2Δ+3Δ
- FIX routing: δεξί-κλικ σε ΣΥΜΠΑΓΗ entity (κολώνα) άνοιγε grip-menu αντί EntityContextMenu
- Tests 91/91 PASS, tsc καθαρό (δικά μου). ADR-358 changelog + ΕΚΚΡΕΜΟΤΗΤΕΣ + memory ενημερωμένα.

### Αρχεία ΓΙΑ COMMIT (δικά μου — `git add` ΜΟΝΟ αυτά, ΟΧΙ -A):
NEW:
- `src/subapps/dxf-viewer/core/commands/layer/EntityIsolateCommand.ts`
- `src/subapps/dxf-viewer/core/commands/layer/CategoryIsolateCommand.ts`
- `src/subapps/dxf-viewer/core/commands/layer/__tests__/EntityIsolateCommand.test.ts`
- `src/subapps/dxf-viewer/core/commands/layer/__tests__/CategoryIsolateCommand.test.ts`
- `src/subapps/dxf-viewer/bim/visibility/resolve-entity-bim-category.ts`
- `src/subapps/dxf-viewer/bim/visibility/__tests__/resolve-entity-bim-category.test.ts`

MOD:
- `src/subapps/dxf-viewer/systems/isolate/IsolateEffectsStore.ts`
- `src/subapps/dxf-viewer/systems/isolate/__tests__/IsolateEffectsStore.test.ts`
- `src/subapps/dxf-viewer/core/commands/layer/index.ts`
- `src/subapps/dxf-viewer/core/commands/layer/LayerUnisolateCommand.ts`
- `src/subapps/dxf-viewer/canvas-v2/dxf-canvas/DxfRenderer.ts`  ⚠️ ADR-040 CHECK 6B/6D
- `src/subapps/dxf-viewer/bim/visibility/visibility-resolver.ts`
- `src/subapps/dxf-viewer/bim/visibility/__tests__/visibility-resolver.test.ts`
- `src/subapps/dxf-viewer/bim-3d/scene/BimSceneLayer.ts`
- `src/subapps/dxf-viewer/bim-3d/scene/bim-scene-context.ts`
- `src/subapps/dxf-viewer/bim-3d/scene/bim-scene-attach-syncs.ts`
- `src/subapps/dxf-viewer/ui/components/EntityContextMenu.tsx`
- `src/subapps/dxf-viewer/ui/icons/MenuIcons.tsx`
- `src/subapps/dxf-viewer/components/dxf-layout/CanvasSection.tsx`  ⚠️ ADR-040 CHECK 6B (500 γρ. ακριβώς — ΜΗΝ μεγαλώσει)
- `src/subapps/dxf-viewer/hooks/grips/useGripContextMenuController.ts`  ⚠️ shared tree ADR-357
- `src/i18n/locales/el/dxf-viewer.json`
- `src/i18n/locales/en/dxf-viewer.json`
- `docs/centralized-systems/reference/adrs/ADR-358-layer-management-system.md`
- `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`

⚠️ **CHECK 6B/6D:** το `DxfRenderer.ts` + `CanvasSection.tsx` είναι ADR-040 micro-leaf critical → το pre-commit ίσως ζητήσει `ADR-040` staged. Αν μπλοκάρει, πρόσθεσε 1 changelog γραμμή στο `ADR-040-preview-canvas-performance.md` (δεν υπήρξε αρχιτεκτονική αλλαγή — μόνο entity/category isolate gate στο υπάρχον `isEntityLayerSkipped`/`applyIsolateAlpha`) και stage το μαζί.
⚠️ Όλα τα παραπάνω είναι σε SHARED tree — άλλος agent δουλεύει ταυτόχρονα. ΠΟΤΕ `git add -A`. Stage ΟΝΟΜΑΣΤΙΚΑ.

**SSoT μνήμη:** `~/.claude/projects/C--Nestor-Pagonis/memory/reference_isolate_scopes_ssot.md` (πώς δουλεύει το isolate — διάβασέ το αν αγγίξεις isolate ξανά).

---

## ΜΕΡΟΣ Β — ΝΕΟ TASK: 3D VISUAL STYLES MANAGER (Revit-grade, FULL ENTERPRISE + FULL SSOT)

### Τι ζητάει ο Giorgio (με δικά του λόγια, αναλυμένο)
Ένα **κεντρικό σημείο διαχείρισης των προβολών (Visual Styles) του 3Δ καμβά** — όπως το Revit «Visual Style». Οι προβολές που περιέγραψε αναλύονται σε **3 ανεξάρτητους άξονες**:

- **Άξονας FACES (όγκοι):** κανένα (wireframe) / επίπεδο χρώμα (consistent colors) / σκιασμένο με φωτισμό (shaded) / με υφές-textures (realistic)
- **Άξονας EDGES (ακμές):** καμία / ΟΛΕΣ οι ακμές / ΜΟΝΟ πρώτου πλάνου (hidden-line, οι πίσω ακμές κρυμμένες)
- **Occlusion:** όταν υπάρχουν faces, κρύβουν τις πίσω ακμές (hidden-line behavior)

### Revit presets (το ζητούμενο UI — dropdown με presets + ίσως advanced toggles)
| Preset | Faces | Edges |
|---|---|---|
| Wireframe | none | all |
| Hidden Line | opaque-occlude | front-only |
| Shaded | shaded | none |
| Shaded with Edges | shaded | all (ή front-only) |
| Consistent Colors | flat color | none/edges |
| Realistic | textured | none |
| Realistic with Edges | textured | all (ή front-only) |

Ο Giorgio θέλει τους ΣΥΝΔΥΑΣΜΟΥΣ: χρώμα-μόνο / χρώμα+ακμές(όλες ή πρώτου πλάνου) / υφές+ακμές / υφές-χωρίς-ακμές / γεμάτος όγκος+ακμές / μόνο-ακμές.

### ΥΠΑΡΧΟΥΣΑ ΥΠΟΔΟΜΗ (κρίσιμο — FULL SSOT σημαίνει ΕΝΟΠΟΙΗΣΕ, ΜΗΝ προσθέσεις παράλληλα)
- **Edges 3Δ ΗΔΗ ΥΠΑΡΧΟΥΝ:** ADR-375 «Shaded with Edges» (EdgesGeometry/LineSegments + polygonOffset + renderOrder + uniform colour). Δες `HANDOFF_2026-06-12_3d-shaded-with-edges.md` + ADR-375 changelog.
- **Scattered toggles ΠΟΥ ΠΡΕΠΕΙ ΝΑ ΕΝΟΠΟΙΗΘΟΥΝ** στο νέο Visual Style SSoT (αλλιώς δεν είναι full-SSoT):
  - `RealisticMaterials` toggle — στο View tab panel `ui/ribbon/data/view-tab-bim-settings.ts` (BIM_GRAPHICS_PANEL)
  - `wireframeMode` — υπάρχει στο 2Δ `DxfRenderer` render options· έλεγξε αν υπάρχει 3Δ αντίστοιχο
  - τυχόν edge on/off toggle από ADR-375
- **Faces materials SSoT:** `bim-3d/materials/MaterialCatalog3D.ts` + `bim/materials/material-catalog-defs.ts` (3Δ face colours/materials, ADR-445 structural colour identity).
- **3Δ scene build:** `bim-3d/scene/BimSceneLayer.ts` + `bim-3d/converters/*` (φτιάχνουν meshes + edges) + `ThreeJsSceneManager`.
- **Ribbon Προβολή:** `ui/ribbon/data/view-tab-bim-settings.ts` (εκεί ζει το «Ορατότητα/Γραφικά» panel — δίπλα του μπαίνει το «Στυλ Προβολής»).

### Αρχιτεκτονική πρόταση (Revit-grade, για επικύρωση σε Plan Mode)
- **SSoT store:** νέο `VisualStyleStore` micro-leaf (πρότυπο: `IsolateEffectsStore` / `HoverStore` — ADR-040 compliant, zero React state, `useSyncExternalStore`). Κρατά `{ preset, faceMode, edgeMode }`. Persisted per-view (πρότυπο `bim-render-settings-store`).
- **Renderers διαβάζουν το store** event-time (faces: visible/material-type· edges: build/skip + depthTest για front-only). ΟΧΙ subscription σε orchestrators (ADR-040 cardinal rules).
- **Ribbon control:** dropdown «Στυλ Προβολής» στην καρτέλα Προβολή (Radix Select — ADR-001, ΟΧΙ EnterpriseComboBox), presets + (προαιρετικά) advanced face/edge overrides.
- **i18n:** el+en keys ΠΡΩΤΑ (N.11), ICU plurals αν χρειαστεί.
- **Tests:** store + render-decision pure logic (jest).

### Τεχνικές σημειώσεις Three.js
- Faces shaded = `MeshStandardMaterial` (lit)· flat/consistent = `MeshBasicMaterial` ή emissive flat· textured = υπάρχοντα CC0/material maps· wireframe = faces `visible=false` (ΜΗΝ χρησιμοποιήσεις `material.wireframe=true` — δίνει triangulation, ΟΧΙ clean edges — χρησιμοποίησε το υπάρχον EdgesGeometry).
- Edges all vs front-only = `LineSegments` με `material.depthTest` true (front-only occluded από faces) vs faces hidden (all visible). Hidden-line = opaque white faces + front edges.
- ADR-375 polygonOffset/renderOrder ήδη λύνει z-fighting ακμών — REUSE το, ΜΗΝ ξαναφτιάξεις.

### PHASE 1 RECOGNITION (κάνε ΠΡΩΤΑ, πριν κώδικα — N.0.1)
1. Διάβασε **ADR-366** (3D viewer), **ADR-375** (shaded with edges — edge pipeline), `adr-index.md` για **επόμενο free ADR number** (ΜΗΝ μαντέψεις — διάβασε το index· ADR-001 select rule).
2. Grep/Read: `MaterialCatalog3D.ts`, `material-catalog-defs.ts`, `bim-3d/converters/*` (faces+edges build), `ThreeJsSceneManager`, `view-tab-bim-settings.ts`, `RealisticMaterials`, `wireframeMode`, υπάρχον edge toggle (ADR-375).
3. Εντόπισε ΟΛΑ τα scattered visual toggles → σχεδίασε την ενοποίησή τους στο `VisualStyleStore` (full SSoT).
4. **Plan Mode** → παρουσίασε αρχιτεκτονική στον Giorgio για έγκριση πριν υλοποίηση.

### Μοντέλο
Cross-cutting (5+ αρχεία, 3Δ rendering + ribbon + store) → **Opus**, Plan Mode.

---

## ΚΑΝΟΝΕΣ (ΑΠΑΡΑΒΑΤΟΙ)
- Απαντάς ΠΑΝΤΑ στα **Ελληνικά** (Giorgio native).
- **ΟΧΙ commit / ΟΧΙ push** χωρίς ρητή εντολή (N.-1). Commit κάνει ο Giorgio.
- **ΟΧΙ `git add -A`** — SHARED tree, stage ονομαστικά ΜΟΝΟ δικά σου.
- **ΟΧΙ `--no-verify`** (N.-1.1).
- **ΕΝΑ tsc τη φορά** (N.17) — έλεγξε running tsc πριν ξεκινήσεις.
- FULL ENTERPRISE (N.7/7.1/7.2: 40-line functions, 500-line files, Google-level checklist) + FULL SSOT (N.0/N.12: search centralized πρώτα, ΟΧΙ duplicates).
- ADR-driven workflow (N.0.1): code=SoT, update ADR + ΕΚΚΡΕΜΟΤΗΤΕΣ στο ίδιο commit.

# HANDOFF — ADR-539 «Polygon Mode» · Φ4 (multi-face select · copy/paste μεταξύ entities · drag bmat_* · per-face PBR)

**Date:** 2026-06-27 · **Model:** Opus 4.8 · **Mode:** Plan Mode πρώτα (ανά υπο-φάση)
**Quality:** Revit «Paint on face» / Maxon Cinema 4D «Polygon Mode» — **FULL ENTERPRISE + FULL SSOT, μηδέν διπλότυπα.**

---

## 🎯 ΣΤΟΧΟΣ
Η Φ3 ΟΛΟΚΛΗΡΩΘΗΚΕ (slab + foundation + column + roof + wall + beam = όλα τα δομικά solids faced, + 2D fill Φ3e
+ context-menu Φ3f). Η **Φ4** είναι το «advanced polygon editing» layer, 4 ανεξάρτητα features:
1. **multi-face select με Shift** (πολλαπλές όψεις ταυτόχρονα → batch paint/clear)
2. **copy/paste appearance μεταξύ entities**
3. **drag `bmat_*` (library) materials** σε όψη
4. **per-face PBR textures** (πραγματικά υλικά με υφές, όχι σκέτο χρώμα)

---

## 🚨 ΠΡΩΤΟ ΒΗΜΑ — ΥΠΟΧΡΕΩΤΙΚΟ SSoT AUDIT (GREP) ΠΡΙΝ ΓΡΑΨΕΙΣ ΚΩΔΙΚΑ
**Μην εμπιστευτείς τυφλά αυτό το handoff.** Κάνε ΠΡΑΓΜΑΤΙΚΟ grep. Reuse ό,τι υπάρχει, ΜΗΝ ξαναγράψεις.
Τα παρακάτω επαληθεύτηκαν στο audit 2026-06-27 — **ξανα-ελέγξέ τα** (το working tree αλλάζει· shared με άλλον agent).

### 🔑 ΚΡΙΣΙΜΑ ΕΥΡΗΜΑΤΑ ΤΟΥ AUDIT (τι ΥΠΑΡΧΕΙ ΗΔΗ — ΜΗΝ το ξαναφτιάξεις):

| Feature | Τι υπάρχει ΗΔΗ | Τι ΟΝΤΩΣ λείπει (Φ4 work) |
|---------|----------------|--------------------------|
| **copy/paste** | ✅ **Per-face cross-entity copy/paste ΥΛΟΠΟΙΗΘΗΚΕ** (Φ3f): `FaceContextMenuStore.clipboard` (global, ΟΧΙ entity-scoped) + `FaceContextMenu.tsx` copy/paste → δουλεύει ΗΔΗ από όψη entity A σε όψη entity B! | Μόνο: (α) **keyboard shortcuts** Ctrl+C/Ctrl+V σε επιλεγμένη όψη, (β) **entity-level** copy/paste (ΟΛΕΣ οι όψεις μιας entity → άλλη). Το per-face cross-entity ΕΙΝΑΙ ΕΤΟΙΜΟ. |
| **drag materials** | ✅ DnD plumbing ΕΤΟΙΜΟ: `polygon-material-dnd.ts` (`BIM_MATERIAL_MIME`, `serializeFaceAppearanceDrag`/`parse`), payload = `FaceAppearance` ({materialId}\|{colorHex}). Panel swatches ΗΔΗ draggable. | Το panel δείχνει ΜΟΝΟ `listWallCoveringMaterials()`. Λείπει: drag των **`bmat_*` library υλικών** (bim_materials) + το `resolveFaceMaterial`/`faceAppearanceColorHex` να τα επιλύει. |
| **PBR** | ✅ **ΟΛΟΚΛΗΡΟ PBR pipeline ΥΠΑΡΧΕΙ** (ADR-413): `MaterialCatalog3D.ts` (`attachLoadedTextureSet`, textured clones, `appearance.textures?.albedoUrl`), `bim/materials/bim-texture-registry.ts` (albedo+normal+roughness+ao sets), `material-catalog-defs.ts` (MATERIAL_DEFS PBR coeffs). | Το per-face `resolveFaceMaterial` φτιάχνει ΜΟΝΟ flat `MeshStandardMaterial(color)`. Λείπει: **γέφυρα** per-face `materialId` → υπάρχον PBR textured material του `MaterialCatalog3D`. |
| **multi-select** | ❌ `PolygonMode3DStore.selectedFace` = **single**. `FaceSelectionHighlighter` = single overlay. Pointer handler = single set. | **ΤΟ ΚΥΡΙΟ ΝΕΟ WORK.** Set επιλεγμένων όψεων + Shift-additive + N overlays + batch apply (ΕΝΑ undo). |

**ΣΥΜΠΕΡΑΣΜΑ:** Το μεγαλύτερο μέρος της «Φ4» είναι ΗΔΗ χτισμένο σε υποδομή. Το πραγματικό νέο work =
**multi-face select** (Φ4b) + **2 γέφυρες** (bmat_ resolve Φ4c, PBR bridge Φ4d) + **2 μικρά** (keyboard/entity copy Φ4a).

---

## 🗂️ ΕΠΑΛΗΘΕΥΜΕΝΑ ΑΡΧΕΙΑ-ΚΛΕΙΔΙΑ (audit 2026-06-27)

### Stores / state
- `bim-3d/stores/PolygonMode3DStore.ts` — `active`, `targetBimId`, **`selectedFace: SelectedFace3D | null`** (single),
  `setActive/selectFace/reset`. **Φ4b: εδώ μπαίνει το multi-select** (π.χ. `selectedFaces` set + toggle).
- `bim-3d/stores/FaceContextMenuStore.ts` — `open/screen/target/**clipboard**/show/hide/setClipboard`.
  Το clipboard είναι **global FaceAppearance** (cross-entity ΗΔΗ). Φ4a: ίσως `entityClipboard: FaceAppearanceMap`.

### Apply / commands (SSoT — reuse)
- `bim-3d/ui/apply-face-appearance.ts` — **`applyFaceAppearance(levels, bimId, faceKey, value|null)`** → undoable
  `SetFaceAppearanceCommand` + level-scene adapter (κοινό history). **ΕΝΑ wiring για panel + dnd + context-menu.**
  ⚠️ Φ4b batch: αν κάνεις loop `applyFaceAppearance` ανά όψη → N undo steps. **Ψάξε αν χρειάζεται batch command**
  (grep `SetFaceAppearanceCommand`, δες αν δέχεται πολλαπλές όψεις ή αν υπάρχει composite/macro command pattern —
  π.χ. πώς κάνει batch το move/ADR-049). Στόχος: **ΕΝΑ undo για multi-paint**.
- `core/commands/entity-commands/SetFaceAppearanceCommand.ts` — generic (6 kinds, base field). Πιθανή επέκταση
  για batch (faceKey[] ή Map) — **πρώτα grep, μετά απόφαση**.

### Material resolution (SSoT — reuse/extend)
- `bim-3d/materials/face-appearance-material.ts` — **`resolveFaceMaterial(faceKey, appearance, baseMat)`**.
  Τώρα: flat `MeshStandardMaterial(color, roughness 0.92, metalness 0, DoubleSide)`. **Φ4d: εδώ η γέφυρα PBR.**
- `bim/utils/face-appearance-color.ts` — **`faceAppearanceColorHex(face)`**: `colorHex` wins, αλλιώς
  `getWallCoveringColor(materialId)`. **Φ4c: extend να επιλύει `bmat_*`** (όχι μόνο wall-covering ids).
- `bim-3d/materials/MaterialCatalog3D.ts` — **PBR pipeline (ADR-413)**: `attachLoadedTextureSet`, textured clone builder,
  `appearance.textures?.albedoUrl`, `realistic` gate. **Φ4d delegate εδώ — ΜΗΝ ξαναγράψεις texture loading.**
- `bim/materials/bim-texture-registry.ts` — texture sets (slug → albedo+normal+roughness+ao). `material-catalog-defs.ts`
  — `MATERIAL_DEFS`. `bim/data/system-materials-seed.ts` + `app/UserMaterialRegistryHost.tsx` — `bmat_*` library (bim_materials).

### Selection highlight (reuse/extend)
- `bim-3d/systems/selection/FaceSelectionHighlighter.ts` — single-face translucent overlay (child του target mesh).
  `faceGroupRange` + `sliceFaceGeometry` = SSoT geometry slicing. `setTarget(bimId, faceKey)` / `refresh()` / `dispose()`.
  **Φ4b: extend σε N όψεις** (π.χ. `setTargets(SelectedFace3D[])` που κρατά N overlays· reuse το slicing αυτούσιο).

### Picking / pointer (reuse/extend)
- `bim-3d/viewport/use-bim3d-pointer-handlers.ts` (233γρ) — Polygon Mode: hover (γρ.58-61 yellow preview),
  **click face-pick (γρ.141-147 `selectFace`)**, right-click (γρ.190-210 `FaceContextMenu.show`). `raycastBimFace`.
  **Φ4b: Shift στο face-click (γρ.141) → additive/toggle** (mirror του ήδη υπάρχοντος `e.shiftKey` entity-toggle, γρ.159).
- `systems/raycaster/BimEntityRaycaster.ts raycastBimFace` — επιστρέφει `{bimId, faceKey}` (faced-wins). Kind-agnostic.

### UI panel (reuse/extend)
- `bim-3d/ui/PolygonMaterialPanel.tsx` (134γρ) — swatches από `listWallCoveringMaterials()` (γρ.68), κάθε swatch
  **draggable** (γρ.78-80 `setData(BIM_MATERIAL_MIME, serialize({materialId}))`) + click apply + `EnterpriseColorDialog`
  custom color. **Φ4c: πρόσθεσε section με `bmat_*` library swatches** (ίδιο draggable pattern, payload `{materialId: bmat_…}`).

### Context-menu (Φ3f — reuse)
- `bim-3d/viewport/grips/FaceContextMenu.tsx` — clear/copy/paste appearance· `readFaceAppearance` διαβάζει το live scene·
  copy→`setClipboard`, paste→`applyFaceAppearance(target, clipboard)`. **Cross-entity ΗΔΗ δουλεύει.**

---

## 🏛️ ΠΡΟΤΕΙΝΟΜΕΝΗ ΣΕΙΡΑ ΥΠΟ-ΦΑΣΕΩΝ (κάθε μία = ξεχωριστό SSoT audit + Plan Mode + tests + ADR + commit Giorgio)

> ⚠️ **Κάνε ΜΙΑ υπο-φάση τη φορά.** Μην τις μπλέξεις. Μετά από κάθε μία: tests GREEN + ADR-539 changelog +
> δώσε stage list στον Giorgio (commit το κάνει ΑΥΤΟΣ). Δήλωσε Google-level (N.7.2) + context health (N.9).

### **Φ4a — copy/paste appearance: keyboard + entity-level** (ΜΙΚΡΟ — ξεκίνα από εδώ)
- Per-face cross-entity **ΗΔΗ ΕΤΟΙΜΟ** — μην το ξαναφτιάξεις.
- (α) Keyboard Ctrl+C/Ctrl+V όταν υπάρχει `selectedFace` (reuse `FaceContextMenuStore.clipboard` + `applyFaceAppearance`).
  Ψάξε πού ζουν τα 3D keyboard shortcuts (grep `useKeyboardShortcuts` / `keydown` στο bim-3d viewport).
- (β) Entity-level: copy ΟΛΟ το `faceAppearance` map μιας entity → paste σε άλλη (νέο clipboard slot ή reuse).
  Reuse `SetFaceAppearanceCommand` ανά όψη ή batch (δες Φ4b batch decision).

### **Φ4b — multi-face select με Shift** (ΤΟ ΚΥΡΙΟ — self-contained, μεγαλύτερο UX win)
- `PolygonMode3DStore`: πρόσθεσε set επιλεγμένων όψεων (κράτα `selectedFace` ως «primary/last» αν χρειάζεται για panel anchor).
- Pointer handler: Shift+face-click → toggle/add στο set· σκέτο click → replace με μία.
- `FaceSelectionHighlighter`: N overlays (reuse `faceGroupRange`/`sliceFaceGeometry`). Πιθανό νέο
  `MultiFaceSelectionHighlighter` Ή extend το υπάρχον με `setTargets()`.
- Apply (panel swatch / custom color / clear / paste): σε **ΟΛΕΣ** τις επιλεγμένες όψεις, **ΕΝΑ undo step**
  (batch command — grep πρώτα για υπάρχον batch/macro pattern· μην φτιάξεις N commands).
- ⚠️ Cross-entity multi-select: μπορεί όψεις από διαφορετικά entities. Το batch command πρέπει να χειρίζεται N entities.

### **Φ4c — drag `bmat_*` library materials** (ΓΕΦΥΡΑ #1)
- Panel: νέο section με τα `bmat_*` (bim_materials) ως draggable swatches (reuse `BIM_MATERIAL_MIME`/`serialize`).
  Βρες την πηγή list (grep `UserMaterialRegistryHost` / `MaterialLibraryService` / `bim_materials` query/hook).
- `faceAppearanceColorHex`: extend να επιλύει `bmat_*` → χρώμα (μέσω `MaterialCatalog3D`/`material-catalog-defs`),
  ΟΧΙ μόνο `getWallCoveringColor`. **Κράτα το ως ΕΝΑ resolver SSoT** (το χρησιμοποιεί ΚΑΙ το 2D fill Φ3e).
- i18n: labels των bmat_ από τον υπάρχοντα registry (N.11 — μηδέν hardcoded).

### **Φ4d — per-face PBR textures** (ΓΕΦΥΡΑ #2 — δυσκολότερο, χτίζει πάνω στο Φ4c)
- `resolveFaceMaterial`: όταν το `materialId` έχει PBR texture set → **delegate στο `MaterialCatalog3D`** textured
  material builder (ADR-413), ΟΧΙ flat color. Reuse `attachLoadedTextureSet` + texture cache (ΜΗΝ ξαναγράψεις loader).
- ⚠️ **Async:** οι υφές φορτώνουν async → χρειάζεται scene re-sync/redraw όταν φτάσει η texture (δες πώς το κάνει
  ο υπάρχων ADR-413 path για entities· reuse το ίδιο pattern· μην block-άρεις το render).
- Firestore-safe: το `FaceAppearance` αποθηκεύει **μόνο** `materialId` (texture refs ζουν στο catalog/registry,
  ΟΧΙ inline στο doc). Αν χρειαστεί custom texture per-face → Storage URL ref, ΟΧΙ blob.
- Πιθανό «realistic» view gate (το `MaterialCatalog3D` έχει `realistic` flag) — σεβάσου το.

---

## ⚠️ GUARDS / ΠΕΡΙΟΡΙΣΜΟΙ (ΚΡΙΣΙΜΟ)
- 🔴 **NO COMMIT / NO PUSH — ο GIORGIO κάνει ΟΛΑ τα commits** (N.(-1)). Εσύ μόνο γράφεις + δίνεις stage list.
- 🔴 **SHARED WORKING TREE με άλλον agent.** Άγγιξε ΜΟΝΟ τα αρχεία της τρέχουσας υπο-φάσης. Έλεγξε `git status`/
  `git log` ΠΡΩΤΑ — η Φ3 (incl. Φ3d beam) πιθανώς ΕΧΕΙ γίνει commit ήδη· άλλος agent έχει δικά του uncommitted.
  **ΜΗΝ revert-άρεις/πειράξεις ξένα αρχεία.**
- 🟡 **ADR-040 CHECK 6B/6D:** πιάνουν `use-bim3d-pointer-handlers.ts`, `HoverStore`, viewport leaves κ.ά. Αν αγγίξεις
  pointer handler / highlighter που είναι ADR-040 αρχείο → **stage ADR-040 + ADR-539** (αλλιώς commit blocked).
  Τα `bim-3d/converters/`, `bim/materials/`, `bim/utils/`, `bim-3d/ui/`, `bim-3d/stores/` ΔΕΝ πιάνονται από 6B/6D.
- **N.7.1:** <500 γρ/αρχείο, <40/function. `PolygonMaterialPanel.tsx`=134, pointer-handler=233 → χώρος, αλλά πρόσεχε.
- **N.2:** zero `any`/`as any`/`@ts-ignore`. **N.11:** μηδέν νέα hardcoded i18n (υπάρχουν `polygonMode.*` + material labels).
- **N.17:** ΕΝΑΣ tsc τη φορά — έλεγξε `Get-CimInstance … '*tsc*'` ΠΡΩΤΑ. Full tsc OOM → ts-jest type-check-άρει.
- **N.14:** Opus (cross-cutting· αρχιτεκτονική· PBR/texture pipeline).
- **ADR-413** (PBR textures) = must-read για τη Φ4d: `docs/centralized-systems/reference/adrs/ADR-413-*.md`.

---

## 🔁 REUSE POINTS (μηδέν διπλότυπα) — SUMMARY
`applyFaceAppearance` / `SetFaceAppearanceCommand` / `resolveFaceMaterial` / `faceAppearanceColorHex` /
`FaceSelectionHighlighter` (faceGroupRange+sliceFaceGeometry) / `raycastBimFace` / `polygon-material-dnd`
(BIM_MATERIAL_MIME+serialize/parse) / `PolygonMode3DStore` / `FaceContextMenuStore` (clipboard) /
**`MaterialCatalog3D` (PBR, ADR-413)** / `bim-texture-registry` / `MATERIAL_DEFS` / `EnterpriseColorDialog`.

---

## ✅ CHECKLIST Φ4 (ανά υπο-φάση)
- [ ] **Φ4a** — keyboard Ctrl+C/V σε όψη + entity-level copy/paste (per-face cross-entity ΗΔΗ έτοιμο)
- [ ] **Φ4b** — multi-face select (Shift) + N overlays + **batch command (ΕΝΑ undo)**
- [ ] **Φ4c** — `bmat_*` draggable swatches + `faceAppearanceColorHex` resolve extend
- [ ] **Φ4d** — `resolveFaceMaterial` → γέφυρα PBR (`MaterialCatalog3D`, async re-sync, ADR-413 reuse)
- [ ] tests ανά υπο-φάση GREEN + regression (polygon-material-dnd, FaceContextMenuStore, beam/wall-faced) = 0 break
- [ ] ADR-539 changelog/roadmap ανά υπο-φάση (+ ADR-413 αν επεκταθεί)
- [ ] 🔴 browser-verify + commit (Giorgio) ανά υπο-φάση

## 📍 ΕΠΟΜΕΝΟ ΒΗΜΑ
1. Δήλωσε μοντέλο (Opus). 2. Επίλεξε υπο-φάση (πρότεινε **Φ4a** πρώτα — μικρό, χτίζει momentum· ή **Φ4b**
   αν ο Giorgio θέλει το κύριο feature). 3. **SSoT audit (grep)** της υπο-φάσης. 4. Plan Mode. 5. Υλοποίηση +
   tests + ADR. 6. Declare Google-level (N.7.2) + context health (N.9). **ΜΗΝ κάνεις commit.**

📎 **ADR:** `docs/centralized-systems/reference/adrs/ADR-539-cinema4d-polygon-mode-per-face-appearance.md` (§4 roadmap Φ4)
📎 **PBR ADR:** `docs/centralized-systems/reference/adrs/ADR-413-*.md` (Φ4d must-read)
📎 **Προηγ. handoff:** `HANDOFFS/HANDOFF_2026-06-27_adr-539-phase3d-beam-faced.md`
📎 **Memory:** `reference_polygon_mode_foundation_dragdrop_holes.md`

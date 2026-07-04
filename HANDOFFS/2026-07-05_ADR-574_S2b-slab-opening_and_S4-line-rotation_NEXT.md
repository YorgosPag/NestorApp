# HANDOFF — ADR-574 · Σ2b (slab-opening) + Σ4 (line rotation)

**Date:** 2026-07-05
**Subapp:** `src/subapps/dxf-viewer` (https://nestorconstruct.gr/dxf/viewer)
**ADR:** `docs/centralized-systems/reference/adrs/ADR-574-ghost-preview-ssot-audit.md`
**Πρότυπο ποιότητας:** Revit / Maxon (Cinema 4D) / Figma-level · FULL enterprise + FULL SSoT.
Κανόνας big-player: **αν οι μεγάλοι παίκτες ΔΕΝ το προτείνουν → ακολουθούμε τη δική τους πρακτική**.

---

## 0. ΚΑΤΑΣΤΑΣΗ (πού είμαστε ΤΩΡΑ)

**Νησίδα Σ2 (MEP + openings placement paint) → ΥΛΟΠΟΙΗΘΗΚΕ** (2026-07-05, orchestrator, 8/9 οικογένειες):
- **8 migrated σε WYSIWYG** μέσω πραγματικού `EntityRendererComposite`: manifold, electrical-panel,
  boiler, water-heater, radiator, fixture, **mep-segment**, **opening**.
- **Νέος κοινός SSoT helper:** `bim/ghosts/wysiwyg-placement-ghost.ts` →
  `renderWysiwygPlacementGhost(ctx, entity, transform, viewport)` (memoized `BimPreviewRenderer` ανά ctx
  μέσω WeakMap· reuse — καμία νέα γεωμετρία/renderer). **ΧΡΗΣΙΜΟΠΟΙΗΣΕ ΤΟΝ — μη φτιάξεις νέο.**
- Διαγράφηκαν 6 bespoke `*GhostRenderer` (+1 test) + το `opening-ghost-renderer.ts`.
  `MepSegmentGhostRenderer.ts` **κρατήθηκε** (το χρησιμοποιεί & το `components/dxf-layout/proposal-ghost-paint.ts`
  ADR-426/554 — άλλο feature).
- ADR-574 ενημερώθηκε (§5/§7 → ✅ IMPLEMENTED, §10 changelog). **ΔΕΝ έγινε commit** (ο Giorgio committάρει).

**ΕΚΚΡΕΜΟΥΝ 2 items** (αυτό το handoff): **Σ2b slab-opening (blocked)** + **Σ4 line rotation**.
Επίσης ανοιχτά (χαμηλή προτ.): Σ3 twin dispatch ladders, Σ1 primitive rubber-band style.

---

## 1. Σ2b — SLAB-OPENING placement ghost (BLOCKED στη Σ2 — χρειάζεται wiring)

### Γιατί block-αρίστηκε (τίμιο, όχι αποτυχία)
Το slab-opening ghost (`hooks/tools/useSlabOpeningGhostPreview.ts`) **ΔΕΝ** μπόρεσε να μεταναστεύσει
εντός των shared-tree constraints της Σ2 γιατί:
1. Οι commit builders `buildDefaultSlabOpeningParams` + `buildSlabOpeningEntity`
   (`hooks/drawing/slab-opening-completion.ts`) **απαιτούν ζωντανό host `SlabEntity`** (`params.slabId`,
   `params.sceneUnits`, `geometry.bbox`, `validateSlabOpeningParams(params, hostSlab)`) **+ `currentLevelId`**
   ως layerId. Το leaf hook **δεν** έχει πρόσβαση σε αυτά (τα props του είναι μόνο
   `{isAwaitingPosition, kind, overrides, hoveredEdgeMidpointGrip, transform, ...}`).
2. Το «preview ≡ commit by identity» θα έκανε το φάντασμα **να εξαφανίζεται στις άκρες** της πλάκας:
   το `validateSlabOpeningParams` βγάζει **hard error `outlineOutsideSlab`** όταν το ορθογώνιο ξεπερνά
   τα όρια → `built.ok === false` → κενό frame. Κακό UX (το legacy translucent rect ΠΑΝΤΑ φαινόταν).

### Τι πρέπει να γίνει (enterprise λύση)
**A. Δώσε στο leaf hook τον host slab + level** (χρειάζεται mount/parent-wiring — ΤΩΡΑ επιτρέπεται,
   ο orchestrator τελείωσε, το tree είναι ήσυχο· single-writer εσύ):
   - Πέρασε `getHostSlab: () => SlabEntity | null` + `getSceneUnits` + `currentLevelId` (ή `getDefaultLayerId()`)
     στο `useSlabOpeningGhostPreview` — mirror του `useOpeningGhostPreview` που ήδη παίρνει `getHostWall`.
   - Wiring: `components/dxf-layout/canvas-layer-stack-slab-opening-ghost.tsx` (prop type) +
     ο parent που συναρμολογεί το `slabOpeningGhost` payload (`components/dxf-layout/canvas-layer-stack-preview-mounts.tsx`
     → `PreviewCanvasMounts`) + η πηγή του host slab (πιθανόν `useSlabOpeningTool`).
**B. Relaxed preview build (big-player: το placement preview ΔΕΝ εξαφανίζεται στα όρια):**
   - Χτίσε το `SlabOpeningEntity` παρακάμπτοντας ΜΟΝΟ το hard `outlineOutsideSlab` validation για το preview
     (π.χ. build χωρίς hard-reject, ή status-schematic 🔴 όταν εκτός — δες `resolveGhostStatusColor('overlap')`
     + `toWysiwygPreviewEntity(entity, id, ghostStatusColor)` που ΗΔΗ κάνει το ίδιο για τους τοίχους).
   - Στόχος: εντός πλάκας → πλήρες WYSIWYG μέσω `renderWysiwygPlacementGhost`· εκτός → κόκκινο schematic
     (ΟΧΙ κενό). Επιβεβαίωσε big-player πρακτική (Revit: δείχνει το opening + warning, δεν εξαφανίζεται).
**C. ΚΡΑΤΑ το branch (2)** — το edge-midpoint hover affordance (πράσινο +vertex glyph) **ΔΕΝ** είναι
   placement ghost· μείνε στο υπάρχον bespoke draw. Μετέτρεψε **ΜΟΝΟ** το branch (1) placement.
**D. Delete** το `bim/slab-openings/slab-opening-ghost-renderer.ts` **ΜΟΝΟ ΑΝ** το branch (2) δεν το
   χρησιμοποιεί (grep πρώτα)· αλλιώς κράτα το αρχείο, άλλαξε μόνο το branch (1) paint call.

### Κλειδιά-αρχεία (Σ2b)
- `hooks/tools/useSlabOpeningGhostPreview.ts` (dual-branch leaf)
- `hooks/drawing/slab-opening-completion.ts` (`buildDefaultSlabOpeningParams` + `buildSlabOpeningEntity`)
- `bim/geometry/slab-opening-geometry.ts` (`computeSlabOpeningGeometry`) · `bim/renderers/SlabOpeningRenderer.ts`
- `bim/ghosts/wysiwyg-placement-ghost.ts` (**ο helper — reuse**)
- Mount: `components/dxf-layout/canvas-layer-stack-slab-opening-ghost.tsx` + `...preview-mounts.tsx`
- Reference pattern: `hooks/tools/useOpeningGhostPreview.ts` (ήδη migrated, wall-hosted — mirror-άρε το)

---

## 2. Σ4 — LINE ROTATION: preview ≠ commit geometry engine (LOW severity)

### Το πρόβλημα (από ADR-574 §5 Νησίδα 4)
Η γραμμή (line) περιστρέφεται με **ΔΥΟ διαφορετικές υλοποιήσεις** γεωμετρίας:
- **Preview:** `applyLineRotationDrag → applyAxisBoxGripDrag('rotation') → rotateAxisPointsAboutPivot`.
- **Commit:** `commitLineGripDrag → sweptAngleDegAboutPivot + RotateEntityCommand → rotateEntity`.
Μοιράζονται το **angle SSoT** (`sweptAngleDegAboutPivot`), αλλά εφαρμόζουν τη γεωμετρία μέσω δύο μηχανών.
Μαθηματικά ισοδύναμο για γραμμή 2 σημείων, **ΑΛΛΑ ΟΧΙ identity** — σε αντίθεση με arc/polyline/rect
που ΗΔΗ ενοποιήθηκαν και οι δύο πλευρές στο `rotateEntity` (**ADR-561**).

### Τι πρέπει να γίνει
- **Ενοποίησε το line preview στο `rotateEntity`** (ίδιο με arc/polyline, ADR-561), ώστε
  preview↔commit να γίνουν **identity**. Δηλ. το `applyLineRotationDrag` να καλεί `rotateEntity`
  (με το ίδιο `sweptAngleDegAboutPivot` angle + pivot) αντί για `applyAxisBoxGripDrag('rotation')`.
- **Σχετική ασυμμετρία προς έλεγχο (ADR-574 §5):** το rectangle preview το περιστρέφει ως polyline μέσω
  `rotateEntity`, ενώ το commit «εκρήγνυται» σε πραγματικό `polyline` με `UpdateEntityCommand` (ίδιες
  κορυφές, διαφορετική αναπαράσταση στο release). Δες αν θέλει και αυτό ευθυγράμμιση ή αν είναι σκόπιμο.
- **ΜΗΝ** αγγίξεις τα BIM box/linear rotations (είναι ΗΔΗ identity, ADR-574 §4 πίνακας).

### Κλειδιά-αρχεία (Σ4) — grep πρώτα, ίσως άλλαξαν
- `rendering/ghost/apply-entity-preview.ts` (+ `apply-entity-preview-helpers.ts`) — preview transforms
- `hooks/grips/grip-primitive-rotate-commits.ts` / `primitive-rotation-drag.ts` — commit rotate (ADR-561)
- `rotateEntity` (grep — `bim/transforms/bim-rotate-geometry.ts` ή `rendering/...`) — ο κοινός στόχος
- `sweptAngleDegAboutPivot`, `applyAxisBoxGripDrag`, `applyLineRotationDrag`, `commitLineGripDrag` — grep
- **Reference:** ADR-561 (πώς ενοποιήθηκαν arc/polyline → και οι δύο πλευρές στο `rotateEntity`)

---

## 3. 🚨 ΥΠΟΧΡΕΩΤΙΚΟ ΠΡΙΝ ΚΩΔΙΚΑ (και για τα δύο items)

1. **SSoT AUDIT με grep ΠΡΩΤΑ** (N.0/N.0.2): Σ2b → reuse `renderWysiwygPlacementGhost` + mirror
   `useOpeningGhostPreview`. Σ4 → reuse `rotateEntity` + mirror ADR-561. **ΜΗΝ φτιάξεις διπλότυπα.**
2. **Plan Mode → δείξε plan στον Giorgio ΠΡΙΝ γράψεις** (N.0.1 Phase 1).
3. **ADR-driven:** μετά την υλοποίηση → update ADR-574 (§5/§7 status της κάθε νησίδας → ✅ IMPLEMENTED +
   §10 changelog). Ίδιο commit κώδικας + ADR (ο Giorgio committάρει).
4. **Phase-per-session:** ΜΙΑ νησίδα ανά συνεδρία (Σ2b Ή Σ4, όχι μαζί), ≤70% context, handoff στο τέλος.

---

## 4. 🚨 SHARED WORKING TREE + git

- Το tree μοιράζεται με άλλον agent. **ΠΟΤΕ** `git add -A` / `git restore .` / `git reset --hard` /
  checkout αρχείων άλλου. Μόνο `git add <specific>` + verify `git diff --cached`.
- **ΜΗΝ αγγίξεις** (άλλου agent): `bim-3d/scene/ThreeJsSceneManager.ts`, `bim-3d/viewport/viewport-camera.ts`,
  `bim-3d/viewport/viewport-types.ts`, και το handoff `HANDOFF-ghost-preview-slab-undefined-kind-2026-07-05.md`
  (ξεχωριστό crash του άλλου agent: `buildEntityModelFromDxf` στο **grip** ghost — ΑΣΧΕΤΟ με τη Σ2· ο
  `renderWysiwygPlacementGhost` δεν περνά από `buildEntityModelFromDxf`).
- **COMMIT / PUSH: μόνο ο Giorgio.** Εσύ ετοιμάζεις, σταματάς, αναφέρεις (N.(-1)).
- **ΟΧΙ tsc / typecheck** (N.17). jest επιτρέπεται στοχευμένα.
- CHECK 6B/6D: αν αγγίξεις preview/renderer/cursor αρχεία → stage ΚΑΙ το ADR-574 (+ ADR-040 αν χρειαστεί).

---

## 5. VERIFY (big-player-grade)

- **Σ2b:** τρέξε app (localhost:3000/dxf/viewer), εργαλείο slab-opening, τοποθέτησε πάνω σε πλάκα:
  εντός → φάντασμα = ακριβώς το committed opening (WYSIWYG)· στις άκρες → κόκκινο schematic, **ΟΧΙ κενό**.
  Έλεγξε ότι το edge-midpoint hover (branch 2) δουλεύει ακόμα.
- **Σ4:** επίλεξε line, τράβα τη rotation grip: το preview να ταυτίζεται pixel-perfect με το release commit.

## 6. Non-fare
- ΜΗΝ αγγίξεις τα ήδη-migrated Σ2 families (8) — δουλεύουν WYSIWYG.
- ΜΗΝ ξεκινήσεις 2η νησίδα στην ίδια συνεδρία (phase-per-session).
- ΜΗΝ commitάρεις/pushάρεις. ΜΗΝ τρέξεις tsc.

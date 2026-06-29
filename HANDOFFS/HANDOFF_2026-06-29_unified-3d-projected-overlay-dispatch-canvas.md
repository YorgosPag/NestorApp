# HANDOFF — Ενιαίος 3D Projected-Overlay Dispatch Canvas (5 → 1)

**Date:** 2026-06-29
**Επόμενο βήμα:** ADR-551 §5.2 **#4 + #5 + §5.3** (το «ισχυρότερο εύρημα») — οι **5 camera-projected Canvas2D overlays** του 3D viewport να ενοποιηθούν σε **ΕΝΑΝ** shared dispatch canvas (3D αδελφός του 2D `PreviewCanvas` / ADR-552 / ADR-554 dispatch pattern). ΟΧΙ 2 ξεχωριστά pairwise merges — ΕΝΑ unified.
**Νέο ADR:** **ADR-555** (επιβεβαίωσε next-free: `ls docs/centralized-systems/reference/adrs | grep -oE 'ADR-[0-9]+' | sort -t- -k2 -n | tail` — **shared tree**, μπορεί άλλος agent να πήρε 555).
**Model:** Opus (αρχιτεκτονικό· camera projection + RAF + occlusion + ADR-040 micro-leaf).
**Commit:** ΜΟΝΟ ο Giorgio. **Working tree μοιράζεται με άλλον agent** → ΠΟΤΕ `git add -A`, stage μόνο συγκεκριμένα αρχεία.

---

## 0. ΞΕΚΙΝΑ ΕΤΣΙ (κανόνες Giorgio — ΑΠΑΡΑΒΑΤΑ)
1. **PLAN MODE πρώτα.** Καμία γραμμή κώδικα πριν εγκριθεί plan.
2. **ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT (grep) ΠΡΙΝ γράψεις** — ψάξε αν υπάρχει ήδη αντίστοιχος μηχανισμός (projector/dispatch/RAF/occluder) ώστε να τον **επαναχρησιμοποιήσεις**, ΟΧΙ διπλότυπα. (Το §3 έχει τα μέχρι τώρα ευρήματα — **επιβεβαίωσέ τα με δικό σου grep**, μην τα εμπιστευτείς τυφλά.)
3. **Big-player doctrine:** υλοποίησε όπως **Revit / Maxon Cinema 4D / Autodesk APS / Three.js editor**. FULL ENTERPRISE + FULL SSOT. **ΑΝ** οι μεγάλοι ΔΕΝ προτείνουν την ενοποίηση (π.χ. κρατούν ξεχωριστό overlay layer για λόγο), τότε **ακολούθησε τη δική τους πρακτική** και **τεκμηρίωσε** γιατί — escape hatch (§5).
4. **GOL** (N.7.2 checklist + δήλωση στο τέλος) + όρια 500 γρ./αρχείο, 40 γρ./συνάρτηση.
5. **N.17:** ΕΝΑ tsc τη φορά — έλεγξε για running tsc πριν τρέξεις (`Get-CimInstance Win32_Process … tsc`). Σημ.: ΕΝΑ `npx tsc` εμφανίζεται ως **2** node processes (npx wrapper + tsc) — ΔΕΝ είναι παραβίαση.

---

## 1. Τι έγινε ΗΔΗ (context — μην το ξαναγγίξεις)
Στο πλαίσιο του ADR-551 (census καμβάδων/viewports) έγιναν διαδοχικά:
- **#1 ADR-552** (7 analytical overlays → 1 dispatch) — **COMMITTED**.
- **#6 ADR-553** (ViewCube 2ος WebGL context → scissored sub-viewport, 3D 2 WebGL→1) — **IMPLEMENTED, UNCOMMITTED** (εκκρεμεί browser-verify + commit Giorgio).
- **#2 ADR-554** (7 proposal ghosts → 1 zero-lag dispatch) — **IMPLEMENTED, UNCOMMITTED**. **SSoT highlight:** εξήχθη shared `paintOverlayDispatchFrame` (`components/dxf-layout/overlay-dispatch/overlay-dispatch-frame.ts`) που μοιράζονται analytical + proposal (μηδέν duplicate). **ΑΥΤΟ ΤΟ PATTERN ΕΙΝΑΙ ΤΟ ΠΡΟΤΥΠΟ ΣΟΥ** για το 3D.
- **#3 DEFERRED** (envelope+homerun) — τεκμηριωμένο στο ADR-551 (ασύμβατες repaint αρχιτεκτονικές, συνυπάρχουν → μηδέν όφελος, perf regression risk). **Μην το κάνεις** εκτός αν ο Giorgio το ζητήσει ρητά.

**⚠️ Πιθανό commit ενδιάμεσα:** ο Giorgio ίσως έχει κάνει commit τα #6/#2 πριν ξεκινήσεις. Τρέξε `git status` + `git log --oneline -5` στην αρχή.

---

## 2. Στόχος — ΕΝΑΣ unified 3D dispatch canvas (5 → 1)

Οι 5 camera-projected Canvas2D overlays που mount-άρει το `bim-3d/viewport/BimViewport3DCanvasOverlays.tsx` να γίνουν **ΕΝΑΣ** canvas με z-ordered multi-pass dispatch:

| # census | Αρχείο (προς διαγραφή/μετατροπή σε pass) | Projector | Paints | Gate |
|---|---|---|---|---|
| #3 | `bim-3d/viewport/grips/BimGripOverlay2D.tsx` | `makeGripPlanToCanvas` (2 projectors top/bottom elev) | DXF live-ghost + `UnifiedGripRenderer` grips | `grips.length>0` |
| #4 | `bim-3d/viewport/grips/DxfHoverGlowOverlay2D.tsx` | `makeGripPlanToCanvas` (flat) | `drawEntityGlowPrePass` yellow halo | `hoveredId!==null` |
| #5 | `bim-3d/viewport/wall-hud/WallHudOverlay3D.tsx` | `makeGripPlanToCanvas` + scene→mm | `paintWallHudCore` | `is3D && tool==='wall' && hasStart` |
| #6 | `bim-3d/viewport/tracking/Tracking3DOverlay.tsx` | `makePlacementOverlayProjector` | `paintAlignmentPaths`/`paintTrackingMarkers`/`paintTooltip` | `is3D && tool==='wall'` |
| #7 | `bim-3d/viewport/placement/BimPlacementOverlay2D.tsx` | `makePlacementOverlayProjector` | `paintPlacement3DOverlay` (polar/rect grid) | `meta!==null` |

**Κρίσιμο:** όλα προβάλλουν τελικά μέσω **ΕΝΟΣ** `makeGripPlanToCanvas` (`bim-3d/grips/grip-3d-screen-project.ts:42`) — ο `makePlacementOverlayProjector` (`bim-3d/placement/placement-overlay-project.ts:33`) είναι thin wrapper του. **ΕΝΑ projection SSoT — reuse, μην το ξαναγράψεις.**

---

## 3. SSoT audit μέχρι τώρα (ΕΠΙΒΕΒΑΙΩΣΕ ΤΟ με δικό σου grep)

**Shared lifecycle SSoT** (`bim-3d/viewport/overlay-raf.ts`): `useRafWhile`, `useCameraMotionGate` (per-frame pose-diff), `useGripDepthOccluder` (GL depth pre-pass). **Σήμερα κάθε ένα από τα 5 overlays έχει ΔΙΚΟ του RAF + motion gate + occluder** — αυτή είναι η σπατάλη. Reuse `overlay-raf.ts`, μην γράψεις νέο.

**Κοινό sizing/clear:** `sizeCanvasToContainerDpr` (per-frame size+clear). Τα paint modules (`wall-hud-paint`, `tracking-paint`, `placement-overlay-paint`, `UnifiedGripRenderer`, `drawEntityGlowPrePass`) reuse **ως έχουν**.

**Το dispatch frame-renderer πρότυπο:** `components/dxf-layout/overlay-dispatch/overlay-dispatch-frame.ts` (`paintOverlayDispatchFrame`, ADR-554) — αλλά είναι 2D (transform από props). Το 3D χρειάζεται **3D αδελφό** (`paintBimOverlayFrame`) γιατί:
- 3D painters οδηγούνται από τη **ζωντανή κάμερα κάθε RAF frame**, όχι από React `transform` prop.
- χρειάζονται per-frame **camera-motion gate** + **occluder** context.
→ **ΟΧΙ** forced generic abstraction· **δύο αδέλφια του ίδιου pattern** (size+clear+ordered-paint), τα κοινά low-level κομμάτια είναι ήδη SSoT (`sizeCanvasToContainerDpr`, `overlay-raf.ts`, projectors). Τεκμηρίωσε αυτή την απόφαση.

**ΟΧΙ στο canvas** (verified, μην τα αγγίξεις): `BimCrosshairOverlay3D` (HTML div, ADR-545), `BimSnapIndicatorOverlay3D` (SVG, ADR-542), `DynamicInput3DLeaf` (DOM ring, ADR-513), `CropRegionOverlay` (screen-space + interactive pointer-events handles — ΟΧΙ camera-projected). Άρα §5.3 «ALL projected overlays» = **μόνο τα 5 camera-projected Canvas2D**.

**⚠️ Ο agent βρήκε ότι οι ισχυρισμοί mutual-exclusivity του ADR-551 είναι ΛΑΘΟΣ (verified από κώδικα):**
- grip + hover **ΣΥΝΥΠΑΡΧΟΥΝ** (hover entity B ενώ A selected) → όχι exclusion, αλλά **z-order layering** (glow κάτω, grips πάνω).
- wallHud + tracking **ΣΥΝΥΠΑΡΧΟΥΝ** (tracking active όλο το `tool==='wall'`, wallHud το subset `&& hasStart`) → ordered passes.
- placement vs wall-pair = genuinely exclusive (single `activeTool`).
→ Ο dispatch ΠΡΕΠΕΙ να είναι **z-ordered multi-pass (pull model)**, ΟΧΙ «ένα τη φορά» switch. (Επιβεβαίωσε το κι εσύ — trace τα `active` gates.)

---

## 4. Σχέδιο υλοποίησης (από design agent — επικύρωσέ το στο plan)

**Νέο primitive** `bim-overlay-pass.ts` (3D αδελφός του `overlay-dispatch-frame.ts`):
```
export interface BimOverlayFrame { ctx; canvas; camera; manager; occluder }
export type BimOverlayPass = (frame: BimOverlayFrame) => void;
export function paintBimOverlayFrame(canvas, container, manager, passes, occluder, isCameraMoving):
  camera = manager.getCamera(); if (!camera) return;
  ctx = sizeCanvasToContainerDpr(canvas, container); if (!ctx) return;   // size+CLEAR ΜΙΑ φορά
  if (isCameraMoving(camera)) return;                                    // ΕΝΑ motion gate για όλους
  for (pass of passes) if (pass) pass({ctx,canvas,camera,manager,occluder});  // z-order
```

**Ένα leaf** `BimOverlayDispatchCanvas` (αντικαθιστά τα 5 στο `BimViewport3DCanvasOverlays.tsx`): ΕΝΑ `<canvas pointer-events-none>`, ΕΝΑ `useRafWhile`, ΕΝΑ `useCameraMotionGate`, ΕΝΑ `useGripDepthOccluder` (grip+placement δεν συνυπάρχουν → ένα instance αρκεί). 5 `use*Pass()` hooks (paint verbatim μεταφορά από τα 5 leaves), z-order: **hover → grips → tracking → wallHud → placement**.

**Phasing (σταδιακά, ΟΧΙ big-bang — shared tree):**
- **Φ-A:** primitive + migrate #4 (grip+hover) → 5→4 canvases. Validate projection/occluder στο απλούστερο ζεύγος.
- **Φ-B:** fold #5 (tracking+wallHud+placement) → 4→1. Εδώ δοκιμάζεται το coexistence (§3).
- **Φ-C:** docs (ADR-551 §5.2 #4/#5/§5.3 → IMPLEMENTED) + finalize ADR-555.

**Risks:** (1) mutual-exclusivity over-assumption → ordered passes (§3). (2) **Behavior change:** το hover σήμερα ΔΕΝ κρύβεται σε camera motion· με κοινό motion-gate θα κρύβεται κατά το orbit → **πρόσθεσε per-pass `hideOnMotion=false` flag** για να κρατήσεις ακριβώς την τωρινή συμπεριφορά (ή τεκμηρίωσε ότι η αλλαγή είναι αποδεκτή). (3) ADR-040 micro-leaf: κράτα ΟΛΑ τα high-freq payloads non-reactive (singletons `grip3DOverlayInteraction`/`wall3DHudData`/`tracking3DData`/`usePlacement3DOverlayStore.getState().meta` διαβασμένα στο `draw`)· μόνο low-freq activation gates κάνουν `useSyncExternalStore`. ΚΑΜΙΑ νέα 60fps subscription → CHECK 6C safe.

**Tests (GOL):** `__tests__/bim-overlay-pass.test.ts` (pure, mock ctx/camera): clear-once, z-order, skip-null, motion-gate (true→0 passes), no-camera/no-ctx, occluder threaded. Τα υπάρχοντα `grip-3d-screen-project`/`placement-overlay-project` tests **αμετάβλητα** (reuse, όχι re-derive).

---

## 5. Big-player verification + escape hatch (κανόνας Giorgio)
Στο plan **τεκμηρίωσε** σύντομα:
- **Three.js editor / `webgl_multiple_views`** + **ADR-552/554** (ίδια app) → ΕΝΑΣ dispatch canvas με ordered passes = επιβεβαιωμένη πρακτική. ✅ υπέρ.
- **Revit / Cinema 4D** → ένα overlay/HUD layer πάνω από το viewport, όχι N ξεχωριστά. ✅ υπέρ.
- **Autodesk APS** → overlay scene/layer ενιαίο.
**Απόφαση:** ένωσέ τα σε ΕΝΑ. **ΑΝ** βρεις ότι κάποιο overlay ΠΡΕΠΕΙ να μείνει ξεχωριστό (π.χ. interactive pointer-events όπως ο `CropRegionOverlay` — που ΗΔΗ εξαιρείται), **κράτησέ το** και **τεκμηρίωσε** γιατί. Μην επιβάλεις χειρότερη λύση.

---

## 6. Constraints / checklist
- **ADR-040 CHECK 6B/6D:** το `BimViewport3DCanvasOverlays.tsx` + τα overlay leaves είναι canvas-critical 3D leaves → αν τα αγγίξεις, **stage ADR-040** + νέο **ADR-555** (precedent: ADR-552/554 staged μαζί ADR-040). Επιβεβαίωσε αν είναι στο CHECK 6B/6D registry.
- **Νέο ADR-555** «Unified 3D Projected-Overlay Dispatch Canvas (5→1)» + εγγραφή `adr-index.md` (**2 πίνακες**) + ενημέρωση **ADR-551 §5.2 #4/#5/§5.3** (→ IMPLEMENTED) + census §2/§4 (3D 2D-overlay canvases 5→1).
- **N.17:** ένα tsc· **commit:** Giorgio· **stage** μόνο συγκεκριμένα αρχεία (shared tree).
- **Διαγραφές:** ο auto-mode classifier μπλοκάρει διαγραφές αρχείων που δεν όνομασε ο Giorgio → ζήτησέ του ρητή εξουσιοδότηση («διάγραψέ τα») για τα 5 leaves πριν τα σβήσεις.

## 7. Διάβασε πρώτα (με σειρά)
1. `docs/centralized-systems/reference/adrs/ADR-551-canvas-viewport-census-2d-3d.md` §3 (census 3D overlays) + §5.2 #4/#5 + §5.3 + §5.4 (no-merge cases)
2. `docs/centralized-systems/reference/adrs/ADR-554-proposal-dispatch-canvas.md` (+ `ADR-552`) — το dispatch pattern + ο shared `overlay-dispatch-frame.ts`
3. `bim-3d/viewport/BimViewport3DCanvasOverlays.tsx` (όλο — ο mount των 5)
4. `bim-3d/viewport/overlay-raf.ts` (useRafWhile/useCameraMotionGate/useGripDepthOccluder)
5. `bim-3d/grips/grip-3d-screen-project.ts` + `bim-3d/placement/placement-overlay-project.ts` (το projection SSoT)
6. Τα 5 overlay leaves (§2 πίνακας) — για το verbatim paint + τα `active` gates (επιβεβαίωσε coexistence)
7. `components/dxf-layout/overlay-dispatch/overlay-dispatch-frame.ts` — το 2D αδελφό primitive

**Deliverable:** ADR-555 + υλοποίηση (ENA unified 3D dispatch canvas, 5→1) σε 3 φάσεις **Ή** τεκμηριωμένη απόφαση διατήρησης κάποιου overlay κατά big-player πρακτική. Plan Mode → έγκριση → υλοποίηση → ADR → (commit: Giorgio).

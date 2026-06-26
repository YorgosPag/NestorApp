# HANDOFF — ADR-535 Φ6: δίδυμες λαβές πάνω + κάτω επιφάνειας (twin grips top/bottom)

**Date:** 2026-06-26 · **ADR:** ADR-535 (`docs/centralized-systems/reference/adrs/ADR-535-3d-viewport-entity-grips.md`)
**Στόχος (εντολή Giorgio):** Όταν επιλέγεις πλάκα/footprint οντότητα στην 3D, οι λαβές reshape εμφανίζονται **μόνο στην ΠΑΝΩ** επιφάνεια. Ο Giorgio θέλει **ΔΙΔΥΜΕΣ** λαβές και στην **ΚΑΤΩ** επιφάνεια: για κάθε κορυφή/μέσο-πλευράς μια λαβή πάνω **και** μια δίδυμη ακριβώς από κάτω, ώστε να πιάνει όποια βολεύει (π.χ. όταν κοιτάς την πλάκα από κάτω) για μεγαλύτερη ακρίβεια. «Όπως οι μεγάλοι — Revit / Maxon (Cinema 4D). FULL ENTERPRISE + FULL SSOT.»

**Επιβεβαιωμένη συμπεριφορά (Giorgio «ναι προχώρα»):** σύρσιμο της **κάτω** λαβής = **ΙΔΙΟ ΑΚΡΙΒΩΣ reshape** με την πάνω (μετακινεί το **plan vertex**· **ΔΕΝ** αλλάζει το πάχος). Top & bottom δίδυμο = ίδιο plan vertex + ίδιο `*GripKind` → **ΙΔΙΟ command**. Διαφέρει **μόνο** το ύψος που ζωγραφίζεται/πιάνεται/σέρνεται.

---

## 0. ⚠️ ΑΠΑΡΑΒΑΤΟΙ ΚΑΝΟΝΕΣ
1. **SHARED WORKING TREE** — δουλεύει **ΚΑΙ άλλος agent** ταυτόχρονα. Τρέξε `git status` ΠΡΩΤΑ. **ΜΗΝ** αγγίξεις/κάνεις stage αρχεία που δεν αναγνωρίζεις. Τη στιγμή του handoff ξένα/uncommitted που ΔΕΝ είναι δικά σου: `bim-3d/scene/section-scene-controller.ts` (M, ξένος agent) και πιθανώς `ADR-535` changelog γραμμή Φ5b (M). **ΘΑ τα διαβάσεις (SSoT audit) αλλά ΔΕΝ τα τροποποιείς χωρίς λόγο.**
2. **COMMIT/PUSH ΤΟΝ ΚΑΝΕΙ Ο GIORGIO — ΕΣΥ ΠΟΤΕ** (όχι `git add`, όχι commit, όχι push — N.(-1)).
3. **ΠΡΙΝ γράψεις ΟΠΟΙΟΝΔΗΠΟΤΕ κώδικα → ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT με grep** (δες §4). Reuse υπάρχον, ΜΗΔΕΝ διπλότυπα. Zero `any`/`as any`/`@ts-ignore` (N.2)· functions ≤40γρ, files ≤500γρ (N.7.1)· μηδέν inline styles (N.3)· zero hardcoded strings i18n (N.11).
4. **tsc: ΕΝΑΣ τη φορά (N.17)** — έλεγξε running tsc ΠΡΙΝ (`Get-CimInstance Win32_Process … '*tsc*'`). Full-project `tsc --noEmit` κάνει OOM → προτίμησε **colocated jest** (ts-jest = full type-check, ΧΩΡΙΣ `isolatedModules` → πραγματικά type diagnostics) + temp `import` smoke test που σβήνεις.
5. **Απάντα στον Giorgio ΣΤΑ ΕΛΛΗΝΙΚΑ** (language rule CLAUDE.md).
6. **ADR-040 / CHECK 6B/6D:** αγγίζεις bim-3d edit + canvas αρχεία → στο commit ο Giorgio κάνει **stage ADR-535 + ADR-040**.

---

## 1. ΤΙ ΥΠΑΡΧΕΙ ΣΗΜΕΡΑ (το grip pipeline — όλα browser-verified + committed, εκτός Φ5b που μόλις μπήκε)

Οι λαβές 3D είναι **Canvas2D overlay** πάνω από το WebGL (Φ5), ζωγραφισμένες με τον **ΙΔΙΟ** 2D `UnifiedGripRenderer`. Pipeline:

| Αρχείο | Ρόλος |
|---|---|
| `bim-3d/animation/bim3d-grip-drag.ts` | `refreshReshapeGrips(ctx, entityIds, bimType)` → `reshapeGripsForFootprint(computeDxfEntityGrips(...))` → **N μοναδικά** plan grips → `useGrip3DOverlayStore.setGrips(grips, elevFor)`. **`gripElevationMmFor(bimType, id, fallbackY)`** δίνει τον **top** resolver ανά τύπο: `slabGripElevationMmFor` (→ `slabTopZmmAt(params,p)+base`), `roofGripElevationMmFor` (→ `roofZmm(planes,...)+base`), `slabOpeningGripElevationMmFor` (host slab top), floor-finish (flat `fallbackY*1000`). **ΕΔΩ προσθέτεις τους bottom resolvers.** |
| `bim-3d/stores/Grip3DOverlayStore.ts` | LOW-freq zustand `{grips, elevFor}` + setGrips/clear. **non-reactive** `grip3DOverlayInteraction {hoverIndex:number\|null, drag:{index,livePlanPos}\|null, visibility:boolean[]\|null}` (ADR-040 zero React state) + `isGrip3DVisible(index)` + `resetGrip3DInteraction`. **ΕΔΩ μπαίνει η `surface:'top'\|'bottom'` διάσταση.** |
| `bim-3d/grips/grip-3d-screen-project.ts` | PURE `makeGripPlanToCanvas(camera, canvas, elevFor)` → `(p:Point2D)=>canvas-px` (κάνει `dxfPlanToWorld(p.x,p.y,elevFor(p))`+`worldToScreen`). `PlanElevationMmFor = (p:Point2D)=>mm`. **ΚΡΙΣΙΜΟ: το elevation είναι keyed ΣΤΟ Point2D** → top & bottom στο ΙΔΙΟ plan σημείο ΔΕΝ διακρίνονται με έναν projector. |
| `bim-3d/grips/grip-3d-screen-hit-test.ts` | PURE `findGripAtScreen(grips, project, x, y, radiusPx, accept?)` nearest-wins, **έχει optional `accept` predicate** (Φ5b occlusion). |
| `bim-3d/grips/bim-grip-controller-3d.ts` | screen-space FSM. `hitTest()` = `makeGripPlanToCanvas(camera,dom,st.elevFor)`+`findGripAtScreen(..., isGrip3DVisible)`. `beginDrag/updateDrag`: elevation από `useGrip3DOverlayStore.getState().elevFor(grip.position)` → ray∩horizontal-plane στο elevation ΑΥΤΟ. `gripAt()` (Φ4 context-menu, χωρίς drag). Commit = plan-mm delta (ανεξάρτητο elevation). |
| `bim-3d/viewport/grips/BimGripOverlay2D.tsx` | React leaf, RAF 60fps. `project = makeGripPlanToCanvas(camera, canvas, elevFor)`· **Φ5b occlusion**: `worlds = liveGrips.map(g=>dxfPlanToWorld(g.position.x,g.position.y,elevFor(g.position)))` → `occluder.computeVisibility(renderer, scene, camera, worlds)` → γράφει `grip3DOverlayInteraction.visibility` → **cull** στο config loop (η σερνόμενη πάντα ορατή)· `new UnifiedGripRenderer(ctx, project).renderGripSetBatched(configs, settings)`. **⚠️ ΠΡΟΣΦΑΤΗ ΑΛΛΑΓΗ (ξένος agent, ADR-535/536):** το overlay τώρα **κρύβει τις λαβές όσο κινείται η κάμερα** (orbit/zoom/pan) — early-return `if (camMoving) return` ΠΡΙΝ το occluder/draw (συγκρίνει `camera.matrixWorld`/`projectionMatrix` με `lastCam*Ref`), επανέρχονται με σωστό occlusion στο settle frame. **Διπλασίασε το `worlds` σε 2N (top+bottom) μέσα σ' αυτή τη ροή — μετά το camMoving guard.** |
| `bim-3d/grips/grip-3d-depth-occluder.ts` + `grip-3d-depth-occlusion-math.ts` | Φ5b GPU depth occlusion. `computeVisibility(renderer, scene, camera, worlds:THREE.Vector3[])→boolean[]` (cached σε κάμερα+count). |
| `hooks/grip-types.ts` | `GripInfo` (entityId, gripIndex, type, position:Point2D, movesEntity, edgeVertexIndices?, `*GripKind` discriminators). |
| `bim-3d/grips/grip-3d-reshape-grips.ts` | PURE `reshapeGripsForFootprint(grips)` φίλτρο (`!movesEntity && hasFootprintGripKind`). |
| `bim-3d/grips/grip-3d-commit.ts` | `commitGrip3DReshape(grip, deltaMm, levels, levelId)` — **type-agnostic** (`commitDxfGripDragModeAware`), ΙΔΙΟ για top & bottom. |
| Context-menu (Φ4) | `bim-3d/viewport/grips/Grip3DVertexContextMenu.tsx` + `Grip3DContextMenuStore` + `systems/grip/footprint-grip-ops.ts buildFootprintVertexOpCommand`. Δεξί-κλικ σε λαβή. |

**Baseline tests (πρέπει να μείνουν GREEN):** `npx jest "src/subapps/dxf-viewer/bim-3d/grips" "src/subapps/dxf-viewer/bim-3d/animation/__tests__" "src/subapps/dxf-viewer/bim-3d/stores"` (~211/211).

---

## 2. ΤΟ ΕΜΠΟΔΙΟ (η αρχιτεκτονική απόφαση)

Το elevation είναι **keyed στο `Point2D`** (`elevFor(p)`). Top & bottom δίδυμο = ΙΔΙΟ `Point2D` → ένας projector keyed-on-Point2D είναι **αμφίσημος**. Δεν αλλάζεις το contract του `UnifiedGripRenderer` (είναι ο 2D SSoT, κοινός με την κάτοψη — `project(config.position:Point2D)→px`).

**ΛΥΣΗ (καθαρή, εντός contract):** **2 render passes** — ένα set «top» με `topElevFor` projector, ένα set «bottom» με `bottomElevFor` projector. Μέσα σε κάθε pass όλα τα grips είναι ίδιας επιφάνειας → `elevFor(position)` **μονοσήμαντο**. Μηδέν αλλαγή στον renderer.

---

## 3. ΣΧΕΔΙΟ ΥΛΟΠΟΙΗΣΗΣ (FULL SSoT)

**Μοντέλο:** το store κρατά τα **N μοναδικά** `grips` (ΑΜΕΤΑΒΛΗΤΑ) + **δύο** elevation resolvers `topElevFor` + `bottomElevFor`. Η αλληλεπίδραση/occlusion δουλεύουν σε **2N εννοιολογικές λαβές** = `{gripIndex, surface:'top'|'bottom'}`.

1. **bottom resolvers (`bim3d-grip-drag.ts`):** `bottom = top − πάχος` ανά τύπο (mirror των top resolvers):
   - slab: `slabTopZmmAt(p) − thicknessMm`. ⚠️ **SSoT audit ΠΡΩΤΑ** για το πεδίο πάχους + τυχόν υπάρχον `slab bottom`/`getEntityZExtents` (§4).
   - roof: `roofZmm(...) − thicknessMm` (κάθετα· browser-verify αν θες κατά-κλίση).
   - floor-finish: flat top − thickness.
   - slab-opening: host slab bottom (= host top − host thickness).
   - `setGrips(grips, topElevFor, bottomElevFor)` (ή ένα `{top,bottom}` object).
2. **Store (`Grip3DOverlayStore.ts`):** κράτα `topElevFor`+`bottomElevFor`. `grip3DOverlayInteraction.hoverIndex` → `{index, surface}|null`· `drag` → `{index, surface, livePlanPos}`· `visibility` → per (index,surface) (π.χ. `{top:boolean[], bottom:boolean[]}` ή 2N array). `isGrip3DVisible(index, surface)`.
3. **Overlay (`BimGripOverlay2D.tsx`):** **2 passes** — `projectTop = makeGripPlanToCanvas(camera, canvas, topElevFor)`, `projectBottom = makeGripPlanToCanvas(camera, canvas, bottomElevFor)`· για κάθε pass: configs (hover/drag/temperature) + cull occluded + `renderGripSetBatched`. Η σερνόμενη λαβή (top ή bottom) πάντα ορατή.
4. **Occlusion Φ5b (ΔΩΡΕΑΝ — αυτό κάνει το «κάτω κρυφό από πάνω»):** `worlds` = **2N** (N top + N bottom). Η κάτω λαβή είναι **πίσω από την πλάκα** όταν κοιτάς από πάνω → το GPU depth την κόβει αυτόματα· από κάτω → ορατή. Πέρασε top+bottom worlds στο `computeVisibility` και γράψε visibility per surface.
5. **Hit-test/controller:** nearest-wins σε **top ΚΑΙ bottom** (δύο projectors), επιστροφή `{index, surface}`. Drag elevation = `surface==='top'?topElevFor:bottomElevFor`. **Commit ΙΔΙΟ** (`commitGrip3DReshape(grip, deltaMm, ...)` — το grip είναι το ίδιο, surface δεν επηρεάζει το command). `gripAt()` (context-menu) επίσης surface-aware αλλά ίδιο vertex op.
6. **Tests:** colocated jest (νέοι bottom resolvers, 2-projector hit-test, store surface). **browser-verify** με Giorgio (πλάκα: λαβές πάνω+κάτω· κοίτα από κάτω → οι κάτω ορατές, οι πάνω κρυφές· σύρε κάτω λαβή → ίδιο reshape με πάνω).
7. **ADR-535:** changelog Φ6 + πίνακας φάσεων (νέα γραμμή Φ6 ✅).

---

## 4. SSoT AUDIT — ΥΠΟΧΡΕΩΤΙΚΟ grep ΠΡΙΝ ΓΡΑΨΕΙΣ (μηδέν διπλότυπα)

| Ανάγκη | grep |
|---|---|
| **Bottom-Z / πάχος ΗΔΗ υπάρχον** (ΜΗΝ φτιάξεις thickness math από το μηδέν) | `slabBottomZmmAt`, `getEntityZExtents`, `hangDownMeshY`, `bottomZ`, `\.thickness`, `slabThickness`, `roofThickness` — δες αν υπάρχει SSoT bottom-surface helper (το `wall-opening-conflict.ts` ίσως χρησιμοποιεί `getEntityZExtents`). |
| Πάχος ανά τύπο (slab/roof/floor-finish) | grep στα params types: `SlabParams`, `RoofParams`, `FloorFinishParams` → ποιο πεδίο = πάχος. |
| Υπάρχει ήδη «twin/bottom grip/both surfaces»; | grep `twin`, `bottomGrip`, `'bottom'`, `surface` στο `bim-3d/grips` + `hooks/grip*`. |
| top resolvers (mirror) | `bim3d-grip-drag.ts` `slabGripElevationMmFor`/`roofGripElevationMmFor` (δες §1). |
| projection/occlusion SSoT | `grip-3d-screen-project.ts`, `grip-3d-depth-occluder.ts` (μην φτιάξεις νέο projection/occluder). |

**Επίσης ξανα-grep ΚΑΘΕ symbol/path του §1 — shared tree, μπορεί να άλλαξε.**

---

## 5. ΠΑΓΙΔΕΣ
1. **2 projectors, ΟΧΙ ένας** — το elevFor keyed-on-Point2D είναι αμφίσημο για top/bottom στο ίδιο σημείο.
2. **Index model N→{index,surface}** — επηρεάζει hoverIndex/drag/visibility/gripAt/context-menu. Πρόσεξε zero-race: η σερνόμενη λαβή (surface-specific) πάντα ορατή.
3. **Occlusion visibility** τώρα είναι `boolean[]` indexed-by-grip → κάνε το per-surface (2N).
4. **slab «κρέμεται» κάτω από το top** (`hangDownMeshY`) → bottom = top − thickness (κάθετα). Roof με κλίση: ξεκίνα κάθετα, browser-verify.
5. **Commit ΑΜΕΤΑΒΛΗΤΟ** — top & bottom ΙΔΙΟ `commitGrip3DReshape`. Μην διπλασιάσεις command/preview path (anti-SSoT).
6. **Context-menu (Φ4)** — δεξί-κλικ σε top ή bottom λαβή = ίδιο vertex op (delete/insert κορυφής).

## 6. ΠΗΓΕΣ
- ADR: `docs/centralized-systems/reference/adrs/ADR-535-3d-viewport-entity-grips.md` (changelog + πίνακας φάσεων).
- Memory: `reference_3d_viewport_entity_grips.md`.
- Προηγ. handoff (occlusion): `HANDOFFS/HANDOFF_2026-06-26_adr535-phase5b-grip-depth-occlusion.md`.

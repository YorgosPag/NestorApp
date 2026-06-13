# HANDOFF — Δυναμική ένδειξη μετακίνησης (γραμμή + απόσταση base→current)

**Date:** 2026-06-13 · **Branch:** main · **Μοντέλο: Opus** · **Shared working tree** (άλλος agent δουλεύει — **`git add` ΜΟΝΟ δικά σου, ΠΟΤΕ `-A`**)

> 🎯 **ΕΝΤΟΛΗ GIORGIO:** Όταν μετακινώ μια οντότητα, θέλω **γραμμή + αριθμό** από το **σημείο βάσης → τρέχον σημείο**, σε πραγματικό χρόνο, ώστε να καταλαβαίνω πόσο μετακινείται. **«Πολύ διακριτικά & εκλεπτυσμένα ώστε να μη γεμίζει η οθόνη.»** Απάντα **ΕΛΛΗΝΙΚΑ**.
>
> ✅ **PLAN ΕΓΚΡΙΘΗΚΕ** από Giorgio (2026-06-13). Scope: **2Δ + 3Δ**, και στα **3 gestures** (Move tool, grip-drag, Alt+drag-from-point).
>
> ⚠️ **ΚΑΝΟΝΕΣ:** Ο Giorgio κάνει commit — ΠΟΤΕ εσύ. `git add` ΜΟΝΟ δικά σου. N.17 ένα tsc τη φορά. function ≤40γρ, file ≤500γρ, **no `any`/`as any`/`@ts-ignore`**, semantic HTML, no inline styles, **no hardcoded strings (N.11)**. Στο τέλος: browser-verify + N.15 docs.

---

## 0. ΣΤΟΧΟΣ
Κατά τη μετακίνηση οντότητας: **διακριτική λεπτή γραμμή** από σημείο βάσης → τρέχον σημείο + **μικρό pill με τον αριθμό** της απόστασης, real-time. Εμφανίζεται ΜΟΝΟ κατά το drag, σβήνει στο release. Ίδια οπτική γλώσσα 2Δ & 3Δ.

**Styling (Revit-grade, ήδη αποφασισμένο):** γραμμή ~1px ημιδιάφανη ουδέτερη (rgba(0,0,0,0.45) 2Δ / discreet 3Δ, χωρίς βέλη)· pill = υπάρχον `drawDimPill` (λευκό 88% bg, μαύρο 75%, 12px)· μία γραμμή π.χ. «1.23 m».

---

## 1. ΑΡΧΙΤΕΚΤΟΝΙΚΗ (FULL SSoT) — εγκεκριμένη

### Φάση 1 — Core formatter (1 NEW, pure, tested)
`src/subapps/dxf-viewer/bim/labels/move-readout.ts`
- `formatMoveDistance(meters): string` → **ΕΝΑ** σημείο για τη μορφή αριθμού. **Wrap του υπάρχοντος** `formatDistanceLocale` (από `rendering/entities/shared/distance-label-utils.ts`) → μηδέν hardcoded unit string (N.11-safe).
- `moveReadoutMid(p1, p2)` helper (midpoint). Ίδιο label look σε 2Δ & 3Δ.
- Test: `bim/labels/__tests__/move-readout.test.ts`.

### Φάση 2 — 2Δ (2 render sites· υπάρχει ήδη dashed leader, προσθέτεις το pill)
- `hooks/tools/useMovePreview.ts` → `drawFrame` (γρ. 109, RAF γρ. 247). **Αντικατέστησε** το πρόχειρο `Δx, Δy` tooltip (γρ. 169: `tooltipText = \`Δ${delta.x.toFixed(1)}, ${delta.y.toFixed(1)}\``) με: διακριτική γραμμή base→cursor + `drawDimPill` στο midpoint με την απόσταση. Base point = `basePoint` state (set στο `handleMoveClick` γρ. 145-148). Current = `effectiveCursor` (γρ. 147, ORTHO-locked) / `cursorWorld` (`useCursorWorldPosition()` γρ. 87).
- `hooks/tools/useGripGhostPreview.ts` → `drawFrame` (γρ. 117, RAF γρ. 220). Πρόσθεσε ίδιο pill στο midpoint του `dragPreview.anchorPos` → `anchorPos + delta` (ο dashed leader υπάρχει ήδη, γρ. 167-178). **Καλύπτει ΚΑΙ grip-drag ΚΑΙ Alt+drag-from-point** (περνούν από το ίδιο ghost). `DxfGripDragPreview` έχει `anchorPos` + `delta` (από `buildDxfDragPreview()` στο `grips/grip-projections.ts` γρ. 29-100· `movesEntity:true` στο alt-move).

### Φάση 3 — 3Δ (1 NEW overlay + 2 wiring sites)
- NEW `src/subapps/dxf-viewer/bim-3d/placement/TempMoveReadoutOverlay.ts` — **mirror**:
  - Γραμμή: pattern `TempAlignmentLineOverlay.ts` (THREE.Line, `BufferGeometry.setFromPoints([a,b])`, `LineDashedMaterial`/απλό, `depthTest:false`, `transparent:true`, `update(a,b)`/`hide()`/`dispose()`).
  - Label: pattern `TempWallMoveDimOverlay.ts` — Sprite/`createDimension3DRenderer` + **`scaleText(handle, camera, canvas)`** για σταθερό pixel μέγεθος (`getPixelWorldSize(dist,camera,canvas)*TEMP_DIM_TEXT_PX`). Group named, added στη scene στον constructor.
- Mount: `bim-3d/animation/use-bim3d-edit-interaction.ts` (γρ. ~77-78, δίπλα στα `new TempWallMoveDimOverlay(manager.scene)` / `new TempAlignmentLineOverlay(...)`).
- Update site #1 (gizmo move — καλύπτει Move tool + gizmo Alt): `bim-3d/animation/bim3d-edit-live-preview-apply.ts` → `applyLivePreview()` (γρ. 63). Base = `ctx.overlay.getPosition()` (gizmo anchor)· current = base + `live.translation` (γρ. 67-74). Πρόσθεσε call δίπλα στο `updateWallMoveDims()` (γρ. 215-229).
- Update site #2 (opening Alt-drag): `bim-3d/viewport/use-bim3d-opening-move.ts` → `onMove` (γρ. 171-210). Base = `drag.basePoint` (γρ. 88, scene units)· current = `currentPos` (γρ. 179).
- Test: `bim-3d/placement/__tests__/TempMoveReadoutOverlay.test.ts` (construct/update/dispose, mirror `TempWallMoveDimOverlay.test.ts`).

---

## 2. ΕΠΑΝΑΧΡΗΣΙΜΟΠΟΙΟΥΜΕΝΑ SSoT (ΜΗ φτιάξεις διπλότυπα)
- **Pill 2Δ:** `bim/labels/bim-dim-labels.ts` → `drawDimPill(ctx, lines: string[], cx, cy)` (γρ. ~122) + consts στο `rendering/utils/canvas-pill.ts` (`PILL_DIM_FONT '12px sans-serif'`, `PILL_BG_COLOR rgba(255,255,255,0.88)`, `PILL_TEXT_COLOR rgba(0,0,0,0.75)`, `PILL_PADDING 3`, `PILL_RADIUS 3`).
- **Απόσταση 2Δ:** `rendering/entities/shared/distance-label-utils.ts` → `calculateWorldDistance(p1,p2)`, `formatDistanceLocale(d, decimals?)`, `renderDistanceLabel(...)` (γρ. 286). Το `formatDistanceLocale` = locale-aware (FormatterRegistry).
- **3Δ label scaling:** `bim-3d/dimensions/Dimension3DRenderer` → `createDimension3DRenderer(dim, AXIS_LAYOUT)` → `{root, textSprite, update(dim), dispose()}`· `scaleText` pattern στο `TempWallMoveDimOverlay`.
- **Μονάδες:** 2Δ delta = scene units (mm όταν `sceneUnits==='mm'`)· 3Δ translation = world meters. Ο core formatter δέχεται **meters** → callers κάνουν conversion (2Δ: mm→m /1000). ΕΝΑ formatter, ίδιο look.

---

## 3. ΣΕΙΡΑ ΥΛΟΠΟΙΗΣΗΣ
1. **PHASE 1 RECOGNITION:** διάβασε τα §1 αρχεία (κυρίως `useMovePreview.ts`, `useGripGhostPreview.ts`, `grip-projections.ts`, `TempWallMoveDimOverlay.ts`, `TempAlignmentLineOverlay.ts`, `use-bim3d-edit-interaction.ts`, `bim3d-edit-live-preview-apply.ts`, `use-bim3d-opening-move.ts`, `bim-dim-labels.ts`, `distance-label-utils.ts`).
2. Φάση 1 (core + test) → Φάση 2 (2Δ) → Φάση 3 (3Δ + overlay + test).
3. Tests πράσινα (`npx jest` στα σχετικά). SKIP/targeted tsc (N.17 — ένα tsc τη φορά).
4. **Browser-verify με Giorgio** (2Δ Move tool / grip / Alt-drag· 3Δ gizmo / opening) — διακριτική γραμμή + αριθμός, σβήνει στο release.
5. **N.15 docs:** ADR-363 changelog (owner move + temp-dims) + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`. **ΟΧΙ adr-index** (shared tree).

---

## 4. ΠΡΟΣΟΧΗ / RISKS
- **ADR-040:** `useMovePreview`/`useGripGhostPreview` είναι preview leaf renderers. Πρόσθεσε ΜΟΝΟ draw μέσα στο υπάρχον `drawFrame` — **ΜΗΝ** προσθέσεις νέα high-freq store subscriptions σε orchestrators. Stage σχετικό ADR αν χρειαστεί (CHECK 6D δεν τα λιστάρει ρητά, αλλά stage ADR για ασφάλεια).
- **N.11:** μην βάλεις hardcoded «m»/«mm» — πέρασε μέσω του locale formatter.
- **Shared tree:** `git add` ΜΟΝΟ τα δικά σου αρχεία.

## 5. ΑΡΧΕΙΑ (~9): 2 NEW (move-readout.ts, TempMoveReadoutOverlay.ts) + 2 NEW tests + ~5 MOD (useMovePreview, useGripGhostPreview, use-bim3d-edit-interaction, bim3d-edit-live-preview-apply, use-bim3d-opening-move) + ADR-363 + ΕΚΚΡΕΜΟΤΗΤΕΣ.

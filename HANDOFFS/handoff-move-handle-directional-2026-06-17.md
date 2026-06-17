# HANDOFF — Revit-grade Directional MOVE Handle (ADR-397, Φάση 2)

**Ημερομηνία:** 2026-06-17 · **Μοντέλο:** Opus 4.8 · **Γλώσσα απαντήσεων στον Giorgio: ΕΛΛΗΝΙΚΑ πάντα.**

---

## 0. ΚΑΝΟΝΕΣ ΣΥΝΕΔΡΙΑΣ (ΑΠΑΡΑΒΑΤΟΙ)
- **ΟΧΙ commit / ΟΧΙ push** — ο Giorgio κάνει commit μόνος του. Εσύ μόνο γράφεις/τεστάρεις.
- **Shared working tree** με άλλον agent → όταν (κι αν) σταγεις, `git add` **ΜΟΝΟ τα δικά σου αρχεία**, **ΠΟΤΕ** `git add -A`/`.`.
- **FULL ENTERPRISE + FULL SSoT**, Revit-grade. Πριν γράψεις κώδικα → **πραγματικό SSoT audit (grep)** για να μη φτιάξεις διπλότυπα.
- `any`/`as any`/`@ts-ignore` ΑΠΑΓΟΡΕΥΟΝΤΑΙ. Hardcoded strings ΑΠΑΓΟΡΕΥΟΝΤΑΙ (i18n SSoT, N.11). Inline styles ΟΧΙ (N.3).
- **N.17 (single-tsc):** πριν τρέξεις `tsc`, έλεγξε ότι δεν τρέχει ήδη άλλος (`Get-CimInstance Win32_Process … *tsc*`). ΕΝΑ tsc τη φορά.
- **ADR-040** (micro-leaf): `BaseEntityRenderer` είναι renderer-coupled → όποια αλλαγή του ΧΡΕΙΑΖΕΤΑΙ stage ADR-040 (CHECK 6B/6D). Orchestrators ΟΧΙ `useSyncExternalStore` σε high-freq stores.

---

## 1. ΣΤΟΧΟΣ (τι θέλει ο Giorgio)
Όταν επιλέγει BIM οντότητα εμφανίζεται στο κέντρο της το **4-βέλο σημάδι μετακίνησης** (σταυρός). Θέλει, **Revit-grade, για ΟΛΕΣ τις BIM οντότητες**:
1. **(Φ1 — DONE)** Κατάργηση του κουμπιού «Έλξη» (hover-menu) στη λαβή μετακίνησης.
2. **(Φ1 — DONE)** Το 4-βέλο **να περιστρέφεται μαζί με την οντότητα** (π.χ. κολώνα στραμμένη 45° → ο σταυρός γέρνει 45°).
3. **(Φ2 — ΕΚΚΡΕΜΕΙ, ΑΥΤΟ ΕΙΝΑΙ ΤΟ ΕΡΓΟ ΣΟΥ)**:
   - **Hover σε ΕΝΑ σκέλος** → φωτίζεται **ΜΟΝΟ αυτό το σκέλος** (όχι όλος ο σταυρός — αυτό είναι το παράπονο που σε έφερε εδώ).
   - **Click σε ΕΝΑ σκέλος** → ανοίγει **πεδίο πληκτρολόγησης τιμής** → η οντότητα μετακινείται **κατά τη διεύθυνση εκείνου του (περιστραμμένου) σκέλους** (τοπικός άξονας, ΟΧΙ απλά δεξιά/αριστερά).
   - **Click στο ΚΕΝΤΡΟ** του σταυρού → ξεκινά η **υπάρχουσα** ροή μετακίνησης (await-base: δήλωσε βάση μετακίνησης). ΜΗΝ την πειράξεις.

---

## 2. ΤΙ ΕΓΙΝΕ ΗΔΗ (UNCOMMITTED — δικά μου αρχεία)

### Φάση 1 (ολοκληρωμένη, tested, tsc-clean)
- **NEW** `src/subapps/dxf-viewer/bim/grips/move-glyph-frame.ts` — SSoT: `resolveMoveGlyphFrame(entity) → {axisX, axisY}` (world unit vectors· box entities από `params.rotation°`, linear wall/beam/segment/strip από `start→end` άξονα, αλλιώς `null`). + `withMoveGlyphRotation(grips, entity, worldToScreen)` που υπολογίζει τη **screen-space** γωνία (project axisX μέσω worldToScreen → handles Y-flip) και τη βάζει στο `glyphRotationRad` ΜΟΝΟ σε `shape:'move'` grips.
- **NEW** `src/subapps/dxf-viewer/bim/grips/__tests__/move-glyph-frame.test.ts` — 11 jest ✅.
- **MOD** `rendering/types/Types.ts` — `GripInfo += glyphRotationRad?: number`.
- **MOD** `rendering/grips/types.ts` — `GripRenderConfig += glyphRotationRad?: number`.
- **MOD** `rendering/entities/BaseEntityRenderer.ts` — `renderGrips`: `grips = withMoveGlyphRotation(this.getGrips(entity), entity as Entity, this.worldToScreen.bind(this))`. **⚠️ ΠΡΟΣΟΧΗ:** το `.bind(this)` είναι ΚΡΙΣΙΜΟ — το `worldToScreen` είναι method που διαβάζει `this.transform`· χωρίς bind → render crash «Cannot read properties of undefined (reading 'transform')». (Έγινε ήδη αυτό το λάθος & διορθώθηκε.) + import `withMoveGlyphRotation`.
- **MOD** `systems/phase-manager/renderers/GripPhaseRenderer.ts` — `renderStandardGrips`: forward `glyphRotationRad` στο config.
- **MOD** `rendering/grips/UnifiedGripRenderer.ts` — `renderGripSetBatched`: το `glyphRotationRad` μπήκε στο **batch group key** (αλλιώς 2 οντότητες διαφορετικής γωνίας ζωγραφίζονται με μία γωνία) + πέρασμα στο `renderShape`. `_renderGripCore` περνά `config.glyphRotationRad`.
- **MOD** `rendering/grips/GripShapeRenderer.ts` — `renderShape(...glyphRotationRad?)` + `renderMoveGlyph` ζωγραφίζει με `translate(pos)+rotate(angle)` γύρω από το origin.
- **MOD** `systems/grip/grip-menu-resolver.ts` — `resolveMenuActions`: `if (grip.movesEntity) return []` → κατάργηση «Έλξη» σε ΟΛΕΣ τις λαβές μετακίνησης.

### Φάση 2 — θεμέλιο (NEW, tested, **inert** — δεν συνδέθηκε ακόμα, app λειτουργικό)
- **NEW** `src/subapps/dxf-viewer/bim/grips/move-glyph-zones.ts` — pure SSoT:
  - `MoveGlyphZone = 'center'|'x+'|'x-'|'y+'|'y-'`
  - `resolveMoveGlyphZone({cursorScreen, centerScreen, screenAngleRad, armPx, tolerancePx}) → MoveGlyphZone|null` (un-rotate στο local screen frame → center disc ή dominant-axis arm). **Ίδιο frame** που ζωγραφίζει το `renderMoveGlyph` → το zone αντιστοιχεί 1:1 στο σχεδιασμένο σκέλος.
  - `isDirectionalZone(zone)` — true για τα 4 βέλη (όχι center).
- **NEW** `src/subapps/dxf-viewer/bim/grips/__tests__/move-glyph-zones.test.ts` — 7 jest ✅.

### Docs ενημερωμένα
- `docs/centralized-systems/reference/adrs/ADR-397-bim-grip-glyph-behavior-ssot.md` §15 Changelog (entry 2026-06-17 Φ1).
- `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (γραμμή ADR-397 directional move handle, Φ1 DONE/Φ2 εκκρεμεί).

---

## 3. ΤΙ ΠΡΕΠΕΙ ΝΑ ΚΑΝΕΙΣ (Φάση 2 wiring)

> **Πρώτα re-grep SSoT** (επιβεβαίωση, μη με εμπιστεύεσαι τυφλά): `resolveMoveGlyphZone`, `move-glyph-frame`, `ImmediatePositionStore`, `hoveredGrip`, `GripColorManager`, dynamic-input open API, repaint/markDirty.

### A. Per-σκέλος HOVER highlight (το άμεσο παράπονο)
1. **Hit-test zone**: εκεί που υπολογίζεται το hover (`hooks/grips/useUnifiedGripInteraction.ts` → `handleMouseMove`/`handleGripMouseMove`, βλ. `grip-hit-testing.findNearestGrip`). Όταν `hoveredGrip` είναι λαβή move (`movesEntity` ή `shape:'move'`): υπολόγισε zone με `resolveMoveGlyphZone`:
   - `cursorScreen` = canvas-space cursor. **ΣΩΣΤΗ ΠΗΓΗ:** `ImmediatePositionStore.getPosition()` (canvas-relative = ίδιο σύστημα με `worldToScreen`). ΟΧΙ `getClientPosition()` (αυτό είναι viewport coords — λάθος σύστημα).
   - `centerScreen` = `worldToScreen(grip.position)`.
   - `screenAngleRad` = η γωνία από `withMoveGlyphRotation` (ή ξανα-υπολόγισέ την από `resolveMoveGlyphFrame(entity)` + worldToScreen — ίδιο SSoT).
   - `armPx` = `max(5, gripSize)` (όπως στο `renderMoveGlyph`: `arm = Math.max(5, size)`).
   - `tolerancePx` = το grip hit tolerance.
2. **State/repaint**: το zone πρέπει να φτάσει στον renderer ΚΑΙ να προκαλεί repaint του DXF canvas όταν αλλάζει (ακόμα και μέσα στην ίδια λαβή, κινώντας μεταξύ σκελών). Δύο δρόμοι — **διάλεξε τον SSoT-καθαρό**:
   - **(προτεινόμενο) Render-time read**: στο `BaseEntityRenderer.renderGrips`, για τη λαβή που είναι `this.gripInteraction.hovered`, υπολόγισε το zone live (cursor από `ImmediatePositionStore.getPosition()`) και πέρασέ το ως `hoveredZone` στο move grip config. **ΠΡΟΒΛΗΜΑ repaint**: το DXF canvas ξανασχεδιάζει μόνο σε `isDirty`. Πρέπει να σιγουρευτείς ότι, όσο hover-άρεται λαβή move, κάθε mousemove μαρκάρει dirty (ψάξε το repaint/`isDirtyRef`/frame-scheduler request στο `dxf-canvas-renderer.ts` + `useCentralizedMouseHandlers`/`mouse-handler-move.ts`).
   - **(εναλλακτικά) State plumbing**: κράτα `hoveredZone` δίπλα στο `hoveredGrip` (React state) → ρέει μέσω `DxfProjection.gripInteractionState` → `renderSingleEntity` options → `renderGrips`. Αλλαγή state → re-render → dirty. Περισσότερο plumbing, αλλά ντετερμινιστικό repaint.
3. **Render highlight**: επέκτεινε `renderMoveGlyph(ctx, pos, size, color, glyphRotationRad?, hoveredZone?, highlightColor?)`:
   - Ζωγράφισε ΟΛΑ τα σκέλη σε **cold** χρώμα.
   - Αν `hoveredZone` είναι σκέλος → ξανα-ζωγράφισε ΕΚΕΙΝΟ το σκέλος (γραμμή+κεφαλή) σε **highlightColor** (warm).
   - Αν `center` → highlight κέντρου/όλου (free move).
   - Χρώματα: reuse `GripColorManager` (cold/warm) — μην hardcode-άρεις. Πέρασέ τα από `UnifiedGripRenderer.renderShape` (έχει `colorManager`).
   - Thread το `hoveredZone` όπως το `glyphRotationRad` (GripInfo → GripRenderConfig → GripPhaseRenderer → UnifiedGripRenderer → renderShape → renderMoveGlyph). **ΠΡΟΣΟΧΗ batch key:** βάλε και το `hoveredZone` στο batch group key του `renderGripSetBatched` (αλλιώς λάθος group sharing, όπως το glyphRotationRad).

### B. Click σε σκέλος → πεδίο τιμής → κατευθυντική μετακίνηση
1. **Routing**: `hooks/grips/grip-mouse-handlers.ts` → `runGripMouseDown`. Στο σημείο που μπαίνει η move hot-grip ροή (γραμμή ~219: `resolveHotGripMouseDown(...)==='enter'` με `hotGripOpForKind(...)==='move'`), **ΠΡΙΝ** μπει στο `await-base`, υπολόγισε zone (ίδιο `resolveMoveGlyphZone`). Αν **directional arm** → άνοιξε dynamic-input αντί await-base. Αν **center** → υπάρχουσα ροή ΟΠΩΣ ΕΙΝΑΙ.
   - ⚠️ Ο `GripMouseDownCtx` ΔΕΝ έχει την οντότητα/scene → χρειάζεσαι το frame. Επιλογές: (α) attach `moveAxisXWorld/moveAxisYWorld` στο `UnifiedGripInfo` στο `useGripRegistry` (έχει την entity, γρ. ~169-181 του `grip-registry.ts`), ή (β) πέρασε resolver στο ctx. Προτίμησε (α) — καθαρό, το frame ταξιδεύει με τη λαβή.
2. **Dynamic input**: **SSoT υπάρχει** → `src/subapps/dxf-viewer/systems/dynamic-input/` (`useDynamicInput`, `DynamicInputOverlay`). Κάνε grep για το open/show API + πώς επιστρέφει committed τιμή (callback/event). ΜΗΝ φτιάξεις νέο input.
3. **Κατευθυντική μετακίνηση**: `delta_world = value × axisUnitWorld` όπου axisUnit = `axisX` (για x+ / −axisX για x-) ή `axisY` (y+ / −y-) από `resolveMoveGlyphFrame`. **ΠΡΟΣΟΧΗ μονάδες:** το `value` (mm που πληκτρολογεί ο χρήστης) → canvas units μέσω `mmScaleFor(params)` (βλ. `utils/scene-units.ts`)· το delta είναι σε canvas/scene units (όπως τα grip deltas). **Commit**: reuse `commitDxfGripDragModeAware(activeGrip, delta, dxfCommitDeps, GripModeStore.getSnapshot())` (ίδιο με τη μετακίνηση) — ΜΗΝ φτιάξεις νέα εντολή.
   - ⚠️ **Mapping zone→world**: το zone είναι σε **screen-local** frame. Το `axisX/axisY` είναι **world**. `x+` → +axisX, `x-` → −axisX. Για `y±` πρόσεξε το screen Y-flip: το local-screen +Y αντιστοιχεί στο −axisY (ή +axisY) ανάλογα με το flip — **γράψε test** που το κλειδώνει (π.χ. κολώνα rotation 0, click y+ → η οντότητα πάει προς τη σωστή κατεύθυνση που βλέπει ο χρήστης).

### C. ADR-040 / staging
- Αλλαγές σε `BaseEntityRenderer`, renderers, cursor/hover → renderer-coupled → όταν σταγεις (ο Giorgio), stage **ADR-397 + ADR-040** μαζί.

---

## 4. TESTS / VERIFY
- Τρέξε: `npx jest move-glyph-frame move-glyph-zones --silent` (πρέπει 18 PASS).
- Πρόσθεσε jest για: zone→world direction mapping, hover-highlight επιλογή σκέλους, directional-move delta (mm→canvas × axis).
- Browser-verify (Giorgio): κολώνα 45° → σταυρός γέρνει· hover ΕΝΑ σκέλος → **μόνο αυτό** φωτίζεται· click σκέλος → πεδίο → τιμή → κολώνα πάει προς εκείνη τη διεύθυνση· click κέντρο → παλιά ροή await-base. Δοκίμασε και τοίχο/δοκό (γραμμικά: άξονας = κατά μήκος).
- **Known pre-existing fail (ΟΧΙ δικό σου):** `grip-commit-alt-bypass.test.ts` (`sceneManager.getEntity` mock gap).

## 5. ΓΝΩΣΤΑ GOTCHAS
- `worldToScreen` = method με `this` → πάντα `.bind(this)` όταν το περνάς ως callback.
- `ImmediatePositionStore.getPosition()` = canvas-space· `getClientPosition()` = viewport-space. Για zone hit-test θες το πρώτο.
- Screen Y-flip: το glyph ζωγραφίζεται σε screen-local (Y κάτω). Το `withMoveGlyphRotation` ήδη χειρίζεται το flip για τη ΓΩΝΙΑ. Για το zone→world direction γράψε test.
- Batch key (`renderGripSetBatched`): κάθε per-grip παράμετρος (rotation, hoveredZone) ΠΡΕΠΕΙ να μπει στο key.

## 6. ΑΡΧΕΙΑ-ΚΛΕΙΔΙΑ (paths)
- SSoT (έτοιμα): `bim/grips/move-glyph-frame.ts`, `bim/grips/move-glyph-zones.ts`
- Render: `rendering/grips/GripShapeRenderer.ts` (`renderMoveGlyph`), `UnifiedGripRenderer.ts`, `systems/phase-manager/renderers/GripPhaseRenderer.ts`, `rendering/entities/BaseEntityRenderer.ts` (`renderGrips`)
- Interaction: `hooks/grips/useUnifiedGripInteraction.ts`, `grip-mouse-handlers.ts`, `grip-hit-testing.ts`, `grip-registry.ts`
- Dynamic input: `systems/dynamic-input/` · Cursor pos: `systems/cursor/ImmediatePositionStore.ts`
- ADR: `docs/centralized-systems/reference/adrs/ADR-397-bim-grip-glyph-behavior-ssot.md`

# HANDOFF — Cursor↔Crosshair lag: Phase 3 (snap decouple + authoritative handler) — FULL ENTERPRISE + FULL SSOT (Revit-grade)

**Ημ/νία:** 2026-06-16 · **Μοντέλο:** Opus (perf hot path, ADR-040-critical, υψηλό regression risk) · **Domain:** DXF Viewer 2Δ cursor/crosshair/snap pipeline

---

## 🚨 ΚΡΙΣΙΜΟΙ ΚΑΝΟΝΕΣ (διάβασε ΠΡΩΤΑ)
1. **Γλώσσα:** Απαντάς ΠΑΝΤΑ **Ελληνικά** στον Giorgio.
2. **COMMIT/PUSH τα κάνει Ο GIORGIO**, ΟΧΙ εσύ (CLAUDE.md N.(-1)). Ποτέ `--no-verify`.
3. **Shared working tree** με άλλον agent + UNCOMMITTED → `git add` **ΜΟΝΟ τα δικά σου** αρχεία (λίστα §6), **ΠΟΤΕ** `-A`.
4. **Στόχος Giorgio (ρητός, επαναλαμβανόμενος):** «όπως οι μεγάλοι παίχτες, όπως η Revit» → **FULL ENTERPRISE + FULL SSOT**. Καμία πρόχειρη λύση, κανένα διπλότυπο — **πριν γράψεις κώδικα, ψάξε αν υπάρχει ήδη SSoT** και πάτησε πάνω του (μην φτιάξεις δεύτερο RAF loop / store / throttle util).
5. N.2/N.3/N.11: ΟΧΙ `any`/`as any`/`@ts-ignore`· ΟΧΙ JSX inline styles (εξαίρεση: imperative `style.transform`/`textContent` σε refs = αποδεκτό compositor pattern)· ΟΧΙ hardcoded strings. N.7.1: code files ≤500 γρ, functions ≤40.
6. **ADR-040 CRITICAL:** ΔΙΑΒΑΣΕ `docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md` (cursor-lag changelog **Φ1→Φ11**) ΠΡΙΝ αγγίξεις οτιδήποτε + **STAGE το** (pre-commit CHECK 6B/6C/6D BLOCK). CHECK 6C = ΜΗΝ προσθέσεις `useSyncExternalStore` σε `CanvasSection`/`CanvasLayerStack`.
7. **N.17 single-tsc:** ΠΟΤΕ 2 ταυτόχρονα tsc — έλεγξε πριν τρέξεις (`Get-CimInstance Win32_Process … '*tsc*'`). Στο τέλος της προηγ. συνεδρίας έτρεχαν 2 tsc (PID 18336, 10216) → το Φ11 ΔΕΝ tsc-verified ακόμη.
8. **Plan file (εγκεκριμένο από Giorgio):** `C:\Users\user\.claude\plans\polymorphic-snacking-sparrow.md` — όλο το phased SSoT-consolidation πλάνο.

---

## 1. ΤΟ ΠΡΟΒΛΗΜΑ
2Δ DXF viewer: ο κέρσορας/σταυρόνημα «καθυστερεί να ακούσει» (lag πίσω από το ποντίκι). Ο σταυρόνημας είναι ΗΔΗ compositor (off-main-thread) → lag-άρει **μόνο** όταν το main thread είναι busy και δεν προλαβαίνει να παρουσιάσει το compositor frame. **Στόχος: Revit/AutoCAD-grade — κέρσορας 1:1.**

**Production (`nestorconstruct.gr/dxf/viewer`) lag-άρει ΠΕΡΙΣΣΟΤΕΡΟ από `localhost:3000` γιατί:** (α) το production τρέχει **ΠΑΛΙΟ build** — τα Φ5–Φ11 είναι UNCOMMITTED/μη-deployed· (β) φορτώνει βαρύτερα πραγματικά σχέδια (περισσότερα entities → βαρύτερο snap/hit-test/move). → **commit + deploy** θα ρίξει το production lag.

---

## 2. ΤΙ ΕΓΙΝΕ ΗΔΗ — ΟΛΑ UNCOMMITTED (δικά μου αρχεία)

**Προηγούμενες συνεδρίες:** Φ5 (pointer-rect-cache), Φ6 (kill body-wide MutationObserver), Φ7 (debug overlay off hot path), Φ8 (crosshair → ΕΝΑ moving layer, Paint→~0), Φ9 (DxfCanvas 60fps re-render σε snap → opt-in `exposeSnapResultsState`). Όλα DONE, tsc+jest clean, UNCOMMITTED.

**Αυτή η συνεδρία — audit (3 Explore + 1 Plan agent) → FULL SSoT consolidation:**

### Φ10 Phase 1+2 — ✅ tsc-clean (δικά μου) + 22 jest GREEN
- **1.1** Reflow kill: 3 tool hooks (`useTrimDragCapture`, `useExtendDragCapture`, `useCanvasContainerHandlers` lasso-crop) → `getCachedClientRect` (Φ5 SSoT) αντί raw `getBoundingClientRect`.
- **1.2** Throttle SSoT: scattered literals → `config/panel-tokens.ts → PANEL_LAYOUT.TIMING` (`HOVER_THROTTLE_MS`/`GRIP_HOVER_THROTTLE_MS`/`COLLAB_CURSOR_THROTTLE_MS`). Consumers: `mouse-handler-move.ts`, `useLayerCanvasMouseMove.ts`, `useUnifiedGripInteraction.ts`, `CollaborationManager.ts`.
- **1.3** ΕΝΑ `screenToWorld`/move στο `mouse-handler-move.ts` (ήταν 2× ίδιο).
- **1.4a** Νεκρό `'crosshair-overlay'` scheduler id αφαιρέθηκε (`ImmediatePositionStore.PAN_SYNC_CANVAS_IDS` + `UnifiedFrameScheduler` canvasIds).
- **2.1** DEL `rendering/ui/cursor/{CursorRenderer,LegacyCursorAdapter}.ts` + barrels (`rendering/ui/index.ts`, `rendering/ui/cursor/index.ts`)· **CursorTypes.ts κρατήθηκε** (UICursorSettings → CanvasSettings).
- **2.2** DEL `canvas-v2/overlays/{CursorTooltipOverlay,SnapModeIndicator}.tsx` (νεκρά).
- **2.3** Αφαίρεση νεκρής canvas-crosshair prop surface (`showCrosshair`/`showCursor`/`crosshairPosition`/`cursorPosition`) από `layer-types.ts` + `layer-canvas-hooks.ts` + `layer-ui-settings.ts` + `LayerCanvas.tsx` + `CanvasLayerStack.tsx` + `LayerRenderer.ts`.
- **2.4** Αφαίρεση νεκρού `overlaySnapEntities` O(n) memo στο `useCentralizedMouseHandlers.ts` (+ unused imports `useMemo`/`Entity`).

### Φ11 Phase 3.1 ⭐ — decouple snap (Η ΚΥΡΙΑ ΛΥΣΗ ΤΟΥ LAG) — 🟡 implemented, 🔴 ΟΧΙ tsc-verified
**Πρόβλημα:** `findSnapPoint` 1-5ms synchronous ΜΕΣΑ στον mousemove handler → κρατούσε τον handler busy → compositor δεν παρουσίαζε το crosshair έγκαιρα.
**Λύση (Revit-grade decoupled channels):** NEW **`systems/cursor/snap-scheduler.ts`** (zero-React singleton SSoT). Ο handler μόνο **arms** (`requestSnapDetection({worldPos, activeTool, findSnapPoint, setSnapResults})` — cheap store+flag) + επιστρέφει αμέσως. Το βαρύ `findSnapPoint` τρέχει σε **ξεχωριστό frame slot** πάνω στον **ΥΠΑΡΧΟΝΤΑ** `UnifiedFrameScheduler` (`registerRenderCallback`, **ΟΧΙ νέο requestAnimationFrame loop** → μηδέν διπλό RAF), coalesced (μόνο latest), κρατώντας ~30fps throttle (`SNAP_DETECTION_THROTTLE`) + όλη τη ADR-398 corner-snap λογική, γράφει `ImmediateSnapStore` (result SSoT). Snap marker ≤1 frame αργότερα (ανεπαίσθητο)· σταυρόνημας 1:1. **Grip-drag snap μένει synchronous** (1:1 ghost). `mouse-handler-move.ts`: snap block → arm/clear· αφαιρέθηκαν imports `findColumnDrawCornerSnap`/`columnToolBridgeStore` (μεταφέρθηκαν στον scheduler).

---

## 3. ΤΙ ΜΕΝΕΙ — Η ΔΟΥΛΕΙΑ ΣΟΥ

### 🥇 ΑΜΕΣΟ: tsc-verify το Φ11
Όταν ελεύθερο tsc (N.17): `npx tsc --noEmit` → έλεγξε **μόνο** `snap-scheduler.ts` + `mouse-handler-move.ts` (τα υπόλοιπα tsc errors είναι ΑΣΧΕΤΑ — bim-3d/proposal/foundation, προϋπάρχοντα άλλων agents). Διόρθωσε ό,τι βγει. Μετά jest: `npx jest crosshair-compositor-layout useCursorWorldPosition-gate pointer-rect-cache`.

### 🥈 Phase 3.2 — ΕΝΑΣ authoritative mousemove handler (ΧΡΕΙΑΖΕΤΑΙ Giorgio sign-off — high blast radius)
Ο `LayerCanvas` mousemove handler είναι **νεκρός** (ο `DxfCanvas` z-10 καλύπτει τα events· επιβεβαιωμένο σχόλιο `hooks/canvas/useCanvasMouse.ts:152-155`). **3.2a (probe, no commit):** logging ότι οι LayerCanvas handlers/onPointerUp/onClick ΠΟΤΕ δεν πυροδοτούνται σε ΟΛΑ τα tools (select/layering/marquee/lasso/grip/guide). **ΖΗΤΑ Giorgio sign-off** πριν το **3.2b**: αφαίρεση του interactive `useCentralizedMouseHandlers` instance + `on*` bindings στο `LayerCanvas.tsx` (ή `pointerEvents:'none'` στο `styles/design-tokens/modules/canvas-ui.ts:84`). Μαζί καθαρίζονται 2 loose ends: `refs.snapThrottleRef` (πλέον unused μετά Φ11) + 2 unused pass-through params `crosshairSettings`/`cursorSettings` στο `LayerRenderer.renderUnified/renderLegacy`.

### 🥉 Phase 3.3 — ΕΝΑ dirty-mark chokepoint σε pan (browser-verify)
Μόνο μετά 1.4a (έγινε). `ImmediateTransformStore.updateImmediateTransform` = ο μόνος `markSystemsDirty` owner σε pan· drop το `markSystemsDirty(PAN_SYNC_CANVAS_IDS)` στο `ImmediatePositionStore.ts` **ΜΟΝΟ** αν επιβεβαιωθεί co-scheduling (αλλιώς pan smear). CHECK 6B → ADR-040.

---

## 4. PHASE 1 RECOGNITION (κάνε ΠΡΙΝ αγγίξεις)
1. Διάβασε ADR-040 cursor-lag changelog Φ1→Φ11 + `snap-scheduler.ts` + `mouse-handler-move.ts` (snap block) + `UnifiedFrameScheduler.ts` (registerRenderCallback API).
2. Δήλωσε μοντέλο (N.14: Opus — perf/ADR-040-critical).
3. ΜΗΝ churn-άρεις τους orchestrators (`CanvasSection`/`CanvasLayerStack`) — audit απέδειξε ότι re-render-άρουν ΜΟΝΟ σε pan (by-design), ΟΧΙ σε mousemove (red herring).

---

## 5. VERIFY (Giorgio, prod build, Firefox profiler, μόνο canvas cursor-move)
- **Φ11:** σταυρόνημας **1:1 χωρίς lag σε πυκνό σχέδιο**· snap marker σωστός & responsive (≤1 frame). main-thread per-move work → ≈0.
- Functional: hover/selection/marquee/lasso/grip-drag/guide-drag/pan/zoom ίδια· trim/extend/lasso-crop picking ακριβές· 60fps. ADR-040 micro-leaf άθικτο (CHECK 6B/6C/6D).

---

## 6. ΑΡΧΕΙΑ — git add ΜΟΝΟ ΑΥΤΑ (ΟΧΙ -A· shared tree· commit κάνει ο Giorgio)

**Φ11 (Phase 3.1):** NEW `systems/cursor/snap-scheduler.ts`· MOD `systems/cursor/mouse-handler-move.ts`.
**Φ10 Phase 1:** MOD `hooks/tools/{useTrimDragCapture,useExtendDragCapture}.ts`, `hooks/canvas/{useCanvasContainerHandlers,useLayerCanvasMouseMove}.ts`, `hooks/grips/useUnifiedGripInteraction.ts`, `config/panel-tokens.ts`, `collaboration/CollaborationManager.ts`, `systems/cursor/{mouse-handler-move,ImmediatePositionStore}.ts`, `rendering/core/UnifiedFrameScheduler.ts`.
**Φ10 Phase 2:** MOD `systems/cursor/useCentralizedMouseHandlers.ts`, `rendering/ui/{index,cursor/index}.ts`, `canvas-v2/layer-canvas/{layer-types,layer-canvas-hooks,layer-ui-settings,LayerRenderer,LayerCanvas}.{ts,tsx}`, `components/dxf-layout/CanvasLayerStack.tsx`· **DEL** `rendering/ui/cursor/{CursorRenderer,LegacyCursorAdapter}.ts`, `canvas-v2/overlays/{CursorTooltipOverlay,SnapModeIndicator}.tsx`.
**Φ9 (προηγ.):** MOD `systems/cursor/useCentralizedMouseHandlers.ts`, `canvas-v2/layer-canvas/LayerCanvas.tsx`.
**Φ5/Φ6/Φ7/Φ8 (προηγ.):** βλ. προηγούμενο handoff (`HANDOFF_2026-06-15_cursor-lag-slice2b…`) — pointer-rect-cache, systems/modal/*, CentralizedAutoSaveStatus, debug/layout-debug/*, FloatingPanelsSection, CrosshairOverlay+crosshair-compositor-layout+test.
**Docs (κοινά — git add ΜΟΝΟ αν δικά σου τα edits):** `docs/.../ADR-040-preview-canvas-performance.md` (changelog Φ5–Φ11)· `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`.

**Tests:** Φ8 15 jest + Φ9 3 + Φ10 22 GREEN. Φ11 χρειάζεται tsc-verify (N.17 block).

---

## 7. SSoT chokepoints (ΕΠΑΝΑΧΡΗΣΙΜΟΠΟΙΗΣΕ — μη φτιάξεις νέα)
Screen pos: `ImmediatePositionStore` (`setImmediatePosition`/`registerDirectRender`)· Transform: `ImmediateTransformStore`· Snap result: `ImmediateSnapStore`· **Snap scheduling: `snap-scheduler.ts` (NEW Φ11)**· RAF orchestrator: `UnifiedFrameScheduler` (`registerRenderCallback`)· Rect: `pointer-rect-cache.ts → getCachedClientRect`· Timing: `PANEL_LAYOUT.TIMING`· Crosshair render: `CrosshairOverlay.tsx` (+`crosshair-compositor-layout.ts`)· Snap indicator: `SnapIndicatorOverlay`/`SnapIndicatorSubscriber`.

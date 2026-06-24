# HANDOFF — ADR-516 Φάση 2: Rewire των bypass → DXF_TIMING + ratchet (Revit-grade, full SSoT)

- **Ημερομηνία**: 2026-06-24
- **ADR**: **ADR-516** (Timing & Latency SSoT) — Status: **Accepted, Phase 1 Implemented**
- **Αρχείο ADR**: `docs/centralized-systems/reference/adrs/ADR-516-timing-latency-ssot.md` (διάβασέ το ΟΛΟ πρώτα — §4 κατηγορίες, §8.bis Phase 1)
- **Status προηγούμενης δουλειάς**: UNCOMMITTED (ο Giorgio κάνει commit, ΟΧΙ εσύ)

---

## 🚨 ΚΑΝΟΝΕΣ ΣΥΝΕΔΡΙΑΣ (απαράβατοι)
1. **COMMIT/PUSH = ΜΟΝΟ ο Giorgio** (N.-1). Ετοίμασε, σταμάτα, ανέφερε.
2. **Working tree μοιράζεται με ΑΛΛΟΝ agent** → ΠΟΤΕ `git add -A`. Άγγιξε ΜΟΝΟ δικά σου αρχεία.
3. **N.17 — ΕΝΑ tsc τη φορά.** Έλεγξε για άλλον tsc πριν τρέξεις (codex agents τρέχουν παράλληλα). Πάντα `run_in_background`.
4. **FULL ENTERPRISE + FULL SSOT (όπως Revit).** ΠΡΙΝ γράψεις κώδικα → **πραγματικό SSoT audit με grep**. Μην φτιάξεις διπλότυπα — όλα δείχνουν στο ΕΝΑ `DXF_TIMING`.
5. **Γλώσσα: Ελληνικά πάντα.**
6. **N.8**: Είναι Orchestrator-level (~45 αρχεία, 3 domains). Ο Giorgio το ΕΝΕΚΡΙΝΕ ρητά ως αφιερωμένη συνεδρία — προχώρα, αλλά κράτα τάξη (commit-able κομμάτια ανά domain).

---

## ✅ ΤΙ ΕΓΙΝΕ ΣΤΗ ΦΑΣΗ 1 (ΗΔΗ UNCOMMITTED — μην το ξανακάνεις)

1. **NEW `config/dxf-timing.ts → DXF_TIMING`** — ΤΟ SSoT, 7 κατηγορίες (0–6):
   - `frame.*` (cat 1: THROTTLE_60=16, THROTTLE_120=8, CURSOR_CONTEXT=50, SNAP_DETECTION=32, HOVER_HITTEST=50, GRIP_HOVER=100, COLLAB_CURSOR_INNER=50, COLLAB_CURSOR_OUTER=100, READOUT=100)
   - `ui.*` (cat 2 debounce: FOCUS_IMMEDIATE=10, FOCUS_DEFAULT=50, TOOL_TRANSITION=50, LAYOUT_STABILIZATION=50, FIELD_RENDER_DELAY=150, SETTINGS_DEBOUNCE=150, INPUT_DEBOUNCE=150, RESIZE_DEBOUNCE=200, SCROLL_DEBOUNCE=100, COMMIT_DEBOUNCE=200, SEARCH_DEBOUNCE=150, MENU_CLICK_GUARD=100, ESCAPE_REACTIVATION_LOCK=200, DRAG_FINISH_RESET=100, OBSERVER_RETRY=100, STATE_TRANSITION=200, FIT_TO_VIEW_DELAY=200)
   - `persist.*` (cat 3: ENTITY_AUTOSAVE=500, SCENE_AUTOSAVE=2000, SETTINGS=500, GRID_GUIDE=1000, LOCALSTORAGE_INTERVAL=5000, AUTOSAVE_INTERVAL=30000, WRITE_GRACE=2000, SAVE_STATUS_DISPLAY=2000, SAVE_STATUS_RESET=3000)
   - `animation.*` (cat 4: FAST=150, DEFAULT=300, SLOW=500, ELEMENT_REMOVE=500, TOOLTIP_DELAY=500, FADE=200, TOAST_SHORT=2000, TOAST_DEFAULT=3000, TOAST_LONG=5000, COPY_FEEDBACK_RESET=2000, PAGE_RELOAD=1500, ANCHOR_DISPLAY=1000)
   - `lifecycle.*` (cat 5: MEASURE_INTERVAL=1000, PERFORMANCE_MONITOR=1000, PRESENCE_HEARTBEAT=5000, SERVICE_INIT=5000, CONNECTION_DELAY=500, HEALTH_CHECK=30000, TEST_TIMEOUT=30000, QUOTA_CHECK=60000, IMPORT_TIMEOUT=60000, CACHE_TTL=300000, CACHE_TTL_EXTENDED=600000, CACHE_CLEANUP=60000, LOCK_TTL=300000, TRACKING_INACTIVITY=5000)
   - `gesture.*` (cat 6: DOUBLE_CLICK=300, LONG_PRESS=500, MENU_HOLD=400, WARM_DELAY=1000, LINGER=140, HOVER_REVEAL=800, CHORD_TIMEOUT=350, ACQUISITION=1000, SETTLE=400, COMMAND_MERGE_WINDOW=500)
   - `threshold.*` (DRAG_PX=5 — px, όχι ms)
   - **Cat 0 (instant path) = ΣΚΟΠΙΜΑ ΑΠΟΥΣΑ** (zero-lag guard τεκμηριωμένος στο τέλος του αρχείου).
2. **Facades (μηδέν αλλαγή τιμής/consumer):** `config/panel-tokens.ts → PANEL_LAYOUT.TIMING`, `config/timing-config.ts → TIMING_CONFIG`, `config/settings-config.ts` → όλα references στο DXF_TIMING.
3. **NEW `hooks/raf-coalesced-throttle.ts`** — SSoT helper (leading-edge + trailing-RAF flush). Χρησιμοποιείται από `useEntityDrag`, `useGripMovement` (grip zero-lag fix) + `mouse-handler-move` (wall-hover coalesce). jest 6/6.
4. tsc 0 στα touched, jest 6/6.

**+ Wall-tool lag fix (ΞΕΧΩΡΙΣΤΟ, επίσης uncommitted):** coalesce του drawing-hover σε per-frame (`mouse-handler-move.ts`) + perf trace στο `drawing-hover-handler.ts`.
⚠️ **`PERF_DRAWHOVER_TRACE = true` στο `drawing-hover-handler.ts` ΕΙΝΑΙ ΑΚΟΜΗ ON** — πρέπει να ξανακλείσει (`= false`) μόλις ο Giorgio επιβεβαιώσει το re-measure. **ΜΗΝ το ξεχάσεις αν αγγίξεις αυτό το αρχείο.**

---

## 🎯 Η ΑΠΟΣΤΟΛΗ — ΦΑΣΗ 2

### Βήμα A — SSoT AUDIT με grep (ΠΡΙΝ κώδικα, υποχρεωτικό)
Τρέξε:
```
grep -rEn "(THROTTLE|DEBOUNCE|_MS|_DELAY|_INTERVAL|_TIMEOUT|_DURATION|_WINDOW)\s*[:=]\s*[0-9]" src/subapps/dxf-viewer
```
Διασταύρωσε με τη λίστα κάτω. Για ΚΑΘΕ raw literal: ταίριασέ το με την ΣΩΣΤΗ έννοια στο `DXF_TIMING`. Αν δεν υπάρχει key για την έννοια → **πρόσθεσε νέο categorized key** (μην force-fit λάθος σημασιολογία· π.χ. 300ms commit-debounce ≠ 300ms double-click).

### Βήμα B — Rewire (κάθε bypass → import από DXF_TIMING)

**Ομάδα 1 — Autosave 500 (→ `DXF_TIMING.persist.ENTITY_AUTOSAVE`) — 24 hooks + 1 const:**
`hooks/data/use{Wall,WallCovering,ThermalSpace,SpaceSeparator,Slab,SlabOpening,Roof,Railing,Opening,MepWaterHeater,MepUnderfloor,MepSegment,MepRadiator,MepManifold,MepFixture,MepBoiler,Hatch,Furniture,Foundation,FloorplanSymbol,FloorFinish,ElectricalPanel,Column,Beam}Persistence.ts`,
`bim/hooks/use-stair-persistence.ts`, `settings-provider/constants.ts` (AUTO_SAVE_DEBOUNCE_MS → χρησιμοποιείται από `settings-provider/storage/useStorageSave.ts`).
*(Όλα `const AUTO_SAVE_DEBOUNCE_MS = 500;` → διαγραφή + import DXF_TIMING.persist.ENTITY_AUTOSAVE. Καθαρό mechanical — ΚΑΛΟ ΠΡΩΤΟ COMMIT.)*

**Ομάδα 2 — persist παραλλαγές (διαφορετική έννοια — πρόσεξε):**
- `hooks/data/useMepFittingAutoReconciliation.ts` RECONCILE_DEBOUNCE_MS=500 → persist.ENTITY_AUTOSAVE (ή νέο persist.RECONCILE)
- `hooks/data/useGridGuidePersistence.ts` SAVE_DEBOUNCE_MS=1000 → persist.GRID_GUIDE
- `hooks/data/useGridGuideSettleEmitter.ts` SETTLE_MS=400 → gesture.SETTLE
- `hooks/data/useHostingReconciler.ts` SETTLE_PERSIST_MS=350 → νέο persist.SETTLE_PERSIST (350)
- `floorplan-background/hooks/useFloorplanBackgroundPersistence.ts` DEBOUNCE_MS=500 → persist.ENTITY_AUTOSAVE
- `hooks/data/useBimFirestoreWriteGrace.ts` WRITE_GRACE_MS=2000 → persist.WRITE_GRACE
- `state/hooks/use{ThermalEnvelope,StructuralSettings,BimRenderSettings}Sync.ts` LOCAL_WRITE_QUIET_WINDOW_MS=2000 → persist.WRITE_GRACE
- `hooks/canvas/useViewportUrlSync.ts` DEBOUNCE_MS=400 → νέο ui.URL_DEBOUNCE (400)

**Ομάδα 3 — Frame 16 (→ `DXF_TIMING.frame.THROTTLE_60`):**
- `systems/cursor/config.ts` throttle_ms=16 (⚠️ ΕΛΕΓΞΕ: είναι το cursor-context throttle, ΟΧΙ ο compositor crosshair — ο crosshair είναι ImmediatePositionStore/registerDirectRender, ανέγγιχτος. Safe.)
- `systems/rulers-grid/config.ts` RENDER_THROTTLE_MS=16
- `hooks/useEnhancedSelection.ts` DEBOUNCE_MS=16

**Ομάδα 4 — Gesture/one-off (→ `DXF_TIMING.gesture.*` ή ui/animation):**
- `hooks/grips/grip-mouse-move-handler.ts` WARM_DELAY_MS=1000 → gesture.WARM_DELAY
- `hooks/grips/useGripHoverMenuController.ts` MENU_HOLD_MS=400 → gesture.MENU_HOLD
- `hooks/gestures/useLongPress.ts` LONG_PRESS_THRESHOLD_MS=500 → gesture.LONG_PRESS
- `systems/properties/QuickPropertiesStore.ts` HOVER_DELAY_MS=800 → gesture.HOVER_REVEAL
- `bim-3d/viewport/use-bim3d-pointer-handlers.ts` HOVER_DEBOUNCE_MS=800 → gesture.HOVER_REVEAL
- `components/dxf-layout/GuideFollowGhostOverlay.tsx` LINGER_MS=140 → gesture.LINGER
- `systems/tracking/TrackingPointStore.ts` ACQUISITION_DURATION_MS=1000 → gesture.ACQUISITION, INACTIVITY_TIMEOUT_MS=5000 → lifecycle.TRACKING_INACTIVITY
- `hooks/useDxfToolbarShortcuts.ts` BIM_CHORD_TIMEOUT_MS=350 + `config/keyboard-shortcuts.ts` GUIDE_CHORD_TIMEOUT_MS=350 → gesture.CHORD_TIMEOUT
- `ui/components/layer-state/LayerStateTemplateBrowser.tsx` SEARCH_DEBOUNCE_MS=150 → ui.SEARCH_DEBOUNCE
- `ui/ribbon/components/RibbonWallDimensionWidget.tsx` COMMIT_DEBOUNCE_MS=200 → ui.COMMIT_DEBOUNCE· `RibbonMepCircuitName/Conductors.tsx` =300 → νέο ui.COMMIT_DEBOUNCE_SLOW (300)
- `bim/services/opening-tag-style-service.ts` DEBOUNCE_MS=200 → ui.COMMIT_DEBOUNCE
- `services/CanvasBoundsService.ts` SCROLL_THROTTLE_MS=100 → ui.SCROLL_DEBOUNCE, RESIZE_DEBOUNCE_MS=150 → νέο ui.RESIZE_DEBOUNCE_FAST (150)· MAX_AGE_MS=5000 → lifecycle
- `debug/layout-debug/CoordinateDebugOverlay.tsx` READOUT_THROTTLE_MS=100 → frame.READOUT

**Ομάδα 5 — Animation/lifecycle (bim-3d, → animation.*/lifecycle.*):**
- `bim-3d/viewport/viewport-constants.ts` PROJECTION_SWITCH_DURATION_MS=500, FRAME_SCENE_DURATION_MS=500, PAN_ANIMATION_DURATION_MS=150, POI_FADE_DELAY_MS=1500, POI_FADE_DURATION_MS=300 → animation.*
- `systems/rulers-grid/config.ts` + `rendering/ui/grid/GridTypes.ts` + `CanvasSettings.ts` smoothFadeDurationMs=200 → animation.FADE
- `bim-3d/viewport/viewport-camera.ts` WHEEL_INTERACTION_IDLE_MS=220 → νέο gesture.WHEEL_IDLE (220)
- `bim-3d/lighting/quality-modulator.ts` + `ssao-modulator.ts` TRANSITION_MS/SSAO_TRANSITION_MS=300 → animation.DEFAULT
- `bim-3d/accessibility/aria-live-bus.ts` IDEMPOTENCY_MS=200, `announcement-protocol.ts` DEBOUNCE_MS=250 → ui/gesture (νέα keys)
- `bim-3d/scene/section-scene-controller.ts` REFINE_DELAY_MS=150, EDGE_TRIM_THROTTLE_MS=50 → ui/frame
- `text-engine/draft/DraftRecoveryService.ts` DEBOUNCE_MS=30000 → νέο persist.DRAFT_DEBOUNCE (30000), EXPIRY_MS=7d → lifecycle.DRAFT_EXPIRY
- Πολλά `CACHE_TTL_MS = 5*60*1000` (family-type, material-library, stair-presets…) → lifecycle.CACHE_TTL· `LOCK_TTL_MS` → lifecycle.LOCK_TTL· telemetry FLUSH_INTERVAL_MS κ.λπ.

### Βήμα C — Κατάργηση facades (σταδιακά)
Αφού migrate-άρουν ΟΛΟΙ οι consumers ενός facade key, αφαίρεσε το από `panel-tokens.ts`/`timing-config.ts`/`settings-config.ts`. (Προαιρετικό αν μένει χρόνος — αλλιώς άστα ως @deprecated.)

### Βήμα D — Ratchet (ADR-294/314)
- Πρόσθεσε module στο `.ssot-registry.json` (Tier κατάλληλο): forbid νέο raw `_MS`/`throttle`/`debounce` numeric literal σε `hooks/`+`components/` (πρέπει να δείχνει στο DXF_TIMING).
- Baseline τα υπάρχοντα (όσα δεν προλάβεις) → `npm run ssot:baseline`. Ratchet: μειώνεται μόνο.
- Δες πώς το κάνουν τα υπάρχοντα modules (π.χ. `addDoc-prohibition`).

### Βήμα E — Κλείσιμο
- tsc background (N.17) 0 errors στα touched· jest για ό,τι logic άγγιξες.
- Ενημέρωσε ADR-516 (§8.bis → Phase 2 done + changelog).
- Ανέφερε στον Giorgio για commit (ΟΧΙ εσύ). Πρότεινε commit-able κομμάτια ανά ομάδα.

---

## ⛔ ΜΗΝ ΚΑΝΕΙΣ
- Μην φτιάξεις 2ο timing config — ΟΛΑ στο `DXF_TIMING`.
- Μην αλλάξεις τιμή κατά το rewire (ίδιο νούμερο, σωστή κατηγορία).
- Μην βάλεις timing const στο zero-lag path (cursor/crosshair/snap/ghost — cat 0).
- Μην `git add -A` / commit / push. Μην 2ο tsc παράλληλα.
- Μην ξεχάσεις το `PERF_DRAWHOVER_TRACE = false` αν αγγίξεις `drawing-hover-handler.ts`.

## 📦 UNCOMMITTED αρχεία αυτής της συνεδρίας (Φάση 1 + wall fix)
`config/dxf-timing.ts` (NEW), `config/panel-tokens.ts`, `config/timing-config.ts`, `config/settings-config.ts`, `hooks/raf-coalesced-throttle.ts` (NEW), `hooks/__tests__/raf-coalesced-throttle.test.ts` (NEW), `hooks/useEntityDrag.ts`, `hooks/useGripMovement.ts`, `systems/cursor/mouse-handler-move.ts`, `hooks/drawing/drawing-hover-handler.ts`, `docs/.../ADR-516-timing-latency-ssot.md`.

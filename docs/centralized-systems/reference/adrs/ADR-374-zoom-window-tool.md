# ADR-374: ZOOM Window Tool (AutoCAD ZOOM W)

| Metadata | Value |
|----------|-------|
| **Status** | ✅ APPROVED |
| **Date** | 2026-05-24 |
| **Last Updated** | 2026-05-24 |
| **Category** | Canvas & Rendering |
| **Canonical Location** | `src/subapps/dxf-viewer/systems/zoom-window/` |
| **Related ADRs** | [ADR-040](./ADR-040-preview-canvas-performance.md), [ADR-372](./ADR-372-relationship-crossings-matrix.md) |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Context

Ο DXF Viewer είχε ribbon button **"Παράθυρο Μεγέθυνσης"** (`activeTool: 'zoom-window'`) με keyboard shortcut **W** + command-line aliases **ZW / ZOOMWINDOW**. Το tool registration υπήρχε ολοκληρωμένο στο `ToolStateManager` (`requiresCanvas: true, canInterrupt: true, allowsContinuous: false`).

Επίσης υπήρχαν:
- `hooks/useZoomWindow.ts` — React hook με `useState<ZoomWindowState>` (zero callers in source — dead code).
- `canvas-v2/overlays/ZoomWindowOverlay.tsx` — presentational rectangle component (zero importers).
- `useViewState.zoomWindow` — state slot στο view state (dead — never read).

**Πρόβλημα**: Όταν ο user ενεργοποιούσε το tool και έσερνε ένα ορθογώνιο στον καμβά, **τίποτα δεν συνέβαινε**: ούτε rubber-band rectangle εμφανιζόταν, ούτε το camera εφάρμοζε fit-to-rect. Half-implemented scaffold.

**Επιπλέον SSoT violation**: η κατάσταση κρατούνταν σε **δύο slots** (`useZoomWindow.state` + `useViewState.zoomWindow`), και ο React `useState` στον hook θα προκαλούσε 60fps re-renders οπουδήποτε χρησιμοποιούνταν (πιθανώς στο CanvasSection orchestrator → ADR-040 §1 violation).

## Decision

Wiring του tool με τρία νέα κομμάτια:

1. **`ZoomWindowStore` singleton** (module-level pub/sub, zero React state) — mirror του `LassoStore` + `WallSplitStore` pattern.
2. **`ZoomWindowSubscriber` micro-leaf** (single `useSyncExternalStore` consumer) — mounted στο `CanvasLayerStack` ως DOM overlay (z-index 20).
3. **`useZoomWindowTool` hook** — owner του tool lifecycle (apply zoom + Escape + tool change). Μπαίνει στο `CanvasSection` με zero νέα subscriptions.

Παράλληλα, **SSoT cleanup** (Boy Scout, ανά CLAUDE.md N.0.2):
- Διαγραφή `hooks/useZoomWindow.ts` (replaced εξ ολοκλήρου).
- Αφαίρεση `zoomWindow` slot από `useViewState`.
- Single πηγή αλήθειας: `ZoomWindowStore`.

**Behavior**: AutoCAD ZOOM W one-shot — drag rect → mouseup → fit-to-rect → return to 'select'. **Δεν** επιλέγει entities μέσα στο rect (καθαρό viewport change, per user requirement).

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Ribbon "W" / shortcut W / cmd ZW / ZOOMWINDOW           │
│   → setActiveTool('zoom-window')                        │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────▼──────────────────────────────┐
        │ useCentralizedMouseHandlers               │
        │                                           │
        │  handleMouseDown (left button only):      │
        │    activeTool === 'zoom-window'           │
        │      → ZoomWindowStore.start(screenPos)   │
        │      → return (skip pan / lasso / grip)   │
        │                                           │
        │  mouse-handler-move:                      │
        │    ZoomWindowStore.isActive()             │
        │      → ZoomWindowStore.update(screenPos)  │
        │      → setImmediatePosition(screenPos)    │
        │      → return (skip snap / hover / pan)   │
        │                                           │
        │  mouse-handler-up:                        │
        │    ZoomWindowStore.finish() → screenRect  │
        │    screenToWorldWithSnapshot × 2 corners  │
        │    EventBus.emit('zoom-window:apply', {   │
        │      worldBounds, viewport })             │
        │                                           │
        │  handleMouseLeave:                        │
        │    ZoomWindowStore.cancel()  (drag drop)  │
        └────────────┬──────────────────────────────┘
                     │
   ┌─────────────────┴────────────────────┐
   │                                      │
┌──▼──────────────────┐    ┌──────────────▼─────────────┐
│ ZoomWindowStore     │    │ ZoomWindowSubscriber       │
│ (singleton, module- │◄───┤ (leaf, useSyncExternalStore)│
│  level, zero React) │    │ Mounted: CanvasLayerStack  │
│                     │    │ Renders: ZoomWindowOverlay │
│ • start(p)          │    │ Z-index: 20                │
│ • update(p)         │    │ pointer-events: none       │
│ • finish() → rect   │    └────────────────────────────┘
│ • cancel()          │
│ • isActive()        │
│ • subscribe(fn)     │    ┌────────────────────────────┐
│ • getSnapshot()     │    │ useZoomWindowTool (hook)   │
└─────────────────────┘    │ Owner: CanvasSection       │
                           │                            │
                           │ EventBus.on('zoom-window:  │
                           │   apply', payload =>       │
                           │   FitToViewService.calcula │
                           │     teFitToViewFromBounds()│
                           │   → onTransformChange()    │
                           │   → onToolChange('select') │
                           │ )                          │
                           │                            │
                           │ window keydown 'Escape'    │
                           │   → ZoomWindowStore.cancel │
                           │   → onToolChange('select') │
                           └────────────────────────────┘
```

## File Structure

| File | Role |
|------|------|
| `systems/zoom-window/ZoomWindowStore.ts` | Singleton pub/sub. State: `{ isActive, isDragging, startPoint, currentPoint, previewRect }`. ~130 LOC. |
| `components/dxf-layout/leaves/ZoomWindowSubscriber.tsx` | Micro-leaf. `useSyncExternalStore` → `ZoomWindowOverlay`. ~45 LOC. |
| `hooks/tools/useZoomWindowTool.ts` | Tool lifecycle hook. EventBus listener + ESC handler. ~75 LOC. |
| `canvas-v2/overlays/ZoomWindowOverlay.tsx` | Pre-existing presentational. Unchanged. |
| `systems/cursor/useCentralizedMouseHandlers.ts` | `handleMouseDown` + `handleMouseLeave` branches. |
| `systems/cursor/mouse-handler-move.ts` | Early-return branch for active drag. |
| `systems/cursor/mouse-handler-up.ts` | Finish + screen→world + EventBus emit. |
| `systems/events/EventBus.ts` | New event type `'zoom-window:apply'`. |
| `components/dxf-layout/CanvasLayerStack.tsx` | Mount `<ZoomWindowSubscriber/>` at z-index 20. |
| `components/dxf-layout/CanvasSection.tsx` | Single `useZoomWindowTool({...})` invocation. |

## Reused Utilities (zero duplication)

| Utility | Path | Purpose |
|---------|------|---------|
| `CoordinateTransforms.screenToWorld` / `screenToWorldWithSnapshot` | `rendering/core/CoordinateTransforms.ts` | Screen-pixel rect → world coords (Y-inverted) |
| `FitToViewService.calculateFitToViewFromBounds` | `services/FitToViewService.ts` | World bounds → ViewTransform (10% padding, max scale 20) |
| `EventBus.emit/on` | `systems/events/EventBus.ts` | Cross-system event (mirror του `'crop:marquee-rect'`) |
| Tool registration `'zoom-window'` | `systems/tools/ToolStateManager.ts:66` | Pre-existing (`requiresCanvas: true, canInterrupt: true, allowsContinuous: false`) |

## Cardinal Rule Compliance (ADR-040)

| Rule | Compliance | How |
|------|------------|-----|
| **§1** (no orchestrator subscriptions) | ✅ | `useSyncExternalStore` ζει ΜΟΝΟ στο `ZoomWindowSubscriber` (leaf). CanvasSection + CanvasLayerStack subscription-free. |
| **§2** (getter-based event reads) | ✅ | `useZoomWindowTool` αποθηκεύει callbacks σε refs, διαβάζει στο event time. Mouse-up reads `transform` από closure στο fire time. |
| **§3** (bitmap cache key untouched) | ✅ | `ZoomWindowStore` state ΔΕΝ μπαίνει στο `dxf-bitmap-cache.ts` key. Overlay είναι separate DOM div. |
| **§4** (≤1 canvas / ≤2 high-freq hooks per leaf) | ✅ | `ZoomWindowSubscriber` = DOM only (zero canvas), 1 store subscription. |

Pre-commit hooks: CHECK 6B (ADR-040 staged with canvas mods), CHECK 6C (no new `useSyncExternalStore` in orchestrators), CHECK 6D (canvas drawing files paired with ADR) → green.

## SSoT Cleanup (Boy Scout, N.0.2)

Πριν:
- `hooks/useZoomWindow.ts` (155 LOC) — dead React hook. 0 callers in source code (grep verified).
- `useViewState.zoomWindow` slot — initialized but never read. Dead state.
- 2 διαφορετικές πηγές αλήθειας για το ίδιο concept.

Μετά:
- 1 πηγή αλήθειας: `ZoomWindowStore` singleton.
- `useZoomWindow.ts` deleted (`git rm`).
- `useViewState.ts` slot αφαιρέθηκε από interface + initial state. Type import καθαρίστηκε.

## Migration / Behavior Changes

- ✅ **Ribbon button "Παράθυρο Μεγέθυνσης"**: τώρα λειτουργικό (πριν: dead).
- ✅ **Keyboard "W"**: τώρα λειτουργικό.
- ✅ **Command line "ZW" / "ZOOMWINDOW"**: τώρα λειτουργικό.
- ❌ **Δεν επιλέγει entities**: per user requirement (καθαρό viewport change).
- ❌ **One-shot**: μετά το zoom επιστρέφει σε `'select'` (per `ToolStateManager.allowsContinuous: false`).
- ✅ **Escape mid-drag**: cancel rect + return to 'select'.
- ✅ **Mouse leave**: cancel rect (drop drag, no zoom).
- ✅ **Rect < 5px**: discarded as accidental (no zoom).

## Verification

1. Activation: πατάς ribbon button → `activeTool === 'zoom-window'`, cursor changes.
2. Drag: mousedown + drag → semi-transparent blue rectangle εμφανίζεται.
3. Mouseup: camera zooms στο rect, fit-to-view με 10% padding.
4. No selection: entities ΔΕΝ γίνονται selected (verify selection panel empty).
5. Tool exit: `activeTool` αυτόματα → 'select'.
6. Keyboard: press `W` → ίδια συμπεριφορά.
7. Command line: type `ZW` ή `ZOOMWINDOW` → ίδια συμπεριφορά.
8. Edge cases: rect < 5px → cancelled. ESC → cancelled. Mouse leave → cancelled.
9. ADR-040: React Profiler → CanvasSection re-render count = 0 during drag.

## Changelog

### 2026-05-24 — Initial wiring (ADR creation)

ZoomWindowStore + ZoomWindowSubscriber + useZoomWindowTool created. Mouse handlers wired. SSoT cleanup (delete useZoomWindow + remove ViewState slot). EventBus typed.

### 2026-05-24 — Hotfix: missing mount sites (rubber-band + camera apply)

**Reported by Γιώργος**: ribbon button "Παράθυρο Μεγέθυνσης" + key W activated the tool, but the user saw **no rubber-band rectangle** during drag and **no camera zoom** on mouseup.

**Root cause**: `ZoomWindowSubscriber` and `useZoomWindowTool` were created in Initial Wiring but **never mounted/called** in any parent — verified by grep (0 importers). Half-wired ADR: mouse handlers correctly called `ZoomWindowStore.start/update/finish` and emitted `'zoom-window:apply'`, but:
- No leaf rendered the overlay → no visual feedback.
- No listener consumed the EventBus event → `FitToViewService` never ran.

**Fix** (3 surgical edits, additive, ADR-040 compliant):
- `components/dxf-layout/CanvasLayerStack.tsx` — imported `ZoomWindowSubscriber` and mounted it inside the canvas-stack at `z-index 20` (per `File Structure` table).
- `components/dxf-layout/CanvasSection.tsx` — imported `useZoomWindowTool` and invoked it once with `{ activeTool, onTransformChange: setTransform, onToolChange: props.onToolChange }`. No new subscriptions in the orchestrator (hook is `useEffect` + EventBus + keydown only — ADR-040 §1 compliant).
- `canvas-v2/overlays/ZoomWindowOverlay.tsx` — Boy Scout fix: line 46 used `className="…${PANEL_LAYOUT.POINTER_EVENTS.NONE}"` (plain string, template literal interpolation silently disabled). Replaced with proper template literal `className={\`…${PANEL_LAYOUT.POINTER_EVENTS.NONE}\`}`. Non-functional impact (outer wrapper already had `pointer-events-none`), but cleanliness + correctness.

**Verification owed**: rerun Verification §1–9 (drag visual + zoom + ADR-040 Profiler).

### 2026-05-24 — Hotfix #2: maxScale clamp parity with wheel zoom

**Reported by Γιώργος**: μετά το Hotfix #1, το tool zoom-άρει αλλά **σταματάει σε κάποιο όριο** — μικρά rects δεν γεμίζουν την οθόνη ενώ το wheel zoom εξακολουθεί να ζουμάρει.

**Root cause**: `useZoomWindowTool.ts:49` καλούσε `FitToViewService.calculateFitToViewFromBounds(..., { maxScale: 20 })`. Το όριο **20×** ταιριάζει σε fit-to-drawing operations (δεν θες να zoom-άρεις 10000× όλο το σχέδιο όταν πατάς "Fit"), αλλά **σπάει το AutoCAD ZOOM W** όπου ο user σκόπιμα επιλέγει μικρή περιοχή για detail view. Wheel zoom χρησιμοποιεί `TRANSFORM_SCALE_LIMITS.MAX_SCALE = 10000` (= `UI_ZOOM_LIMITS.MAX_SCALE`) — async limits πρόκειται για user-driven zoom.

**Fix**: `useZoomWindowTool.ts` — `maxScale: UI_ZOOM_LIMITS.MAX_SCALE` (10000) + `minScale: UI_ZOOM_LIMITS.MIN_SCALE` (0.001). Πλέον το zoom window έχει το ίδιο όριο με το wheel zoom — consistent UX across all user-driven zoom methods.

**Why not `TRANSFORM_SCALE_LIMITS`**: `UI_ZOOM_LIMITS` είναι το semantic SSoT για user-facing zoom controls (toolbar, wheel, zoom-window). `TRANSFORM_SCALE_LIMITS` είναι low-level clamp για raw transform math. Same values today, but `UI_ZOOM_LIMITS` documents the *intent*.

### 2026-05-24 — Hotfix #3: zoomSystem stale-transform sync

**Reported by Γιώργος**: μετά από επιτυχημένο zoom window, το επόμενο **wheel zoom** επανέφερε το σχέδιο μακριά (σαν να γυρνούσε σε pre-zoom-window state).

**Root cause**: στο Initial Wiring + Hotfix #1, ο `useZoomWindowTool` έπαιρνε `onTransformChange: setTransform` (απευθείας από `useViewportManager`). Όμως το `CanvasSection` διατηρεί ένα `zoomSystem = useZoom({...})` με δικό του εσωτερικό transform reference (χρησιμοποιείται από zoom history, ruler controls, wheel zoom calculations). Το `handleTransformChange` στο `CanvasLayerStack:83-86` ήδη κάνει sync το `zoomSystem.setTransform(newTransform)` παράλληλα με το context-level `setTransform` — αλλά αυτό το pattern λείπει από το `useZoomWindowTool` invocation.

Αποτέλεσμα: zoom window → `setTransform` ✅ → React/context ενημερώνεται. Wheel zoom → διαβάζει `zoomSystem` internal state (παλιό) → calculate από pre-zoom-window scale/offset → ξαφνικό zoom-out σαν να ακυρώθηκε το zoom window.

**Fix**: `CanvasSection.tsx` — `useZoomWindowTool` τώρα παίρνει `handleZoomWindowTransform`, ένα `useCallback` που καλεί ΚΑΙ `setTransform` ΚΑΙ `zoomSystem.setTransform`. Mirror του `CanvasLayerStack.handleTransformChange` pattern. Idempotent + Google-level (N.7.2 §1: proactive sync at the right lifecycle moment).

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

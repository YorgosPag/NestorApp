# ADR-556 — Central devicePixelRatio-change sync for all viewport canvases

**Status:** Accepted (implemented, UNCOMMITTED) · **Date:** 2026-06-29 · **Model:** Opus 4.8
**Related:** ADR-549 (3D cursor latency — origin of the investigation), ADR-040 (canvas perf), ADR-117/118/146 (canvas sizing centralization)

---

## Context

Giorgio reported intermittent rendering artifacts: white «trails» that appear **in the exact same
region**, rarely — «for days nothing, then suddenly». This is distinct from the ADR-549 Phase 6
crosshair trails (those were a clear-rect bug, fixed). His hypothesis: the canvases / viewports are
not synchronized / not the same dimensions.

### Root cause (browser-confirmed by code audit)

A full inventory of every live viewport canvas (Explore audit, 2026-06-29) found:

- **No `devicePixelRatio`-change listener anywhere.** The only `matchMedia` usages are for
  reduced-motion / responsive layout — none for resolution.
- Every canvas sizes its backing store as `clientWidth × devicePixelRatio` inside a **ResizeObserver**
  (or a `viewport`-prop effect, or a per-frame pull).

`devicePixelRatio` can change **with no element-size change**:
- dragging the window to a **monitor with different OS scaling**, or
- changing **OS display scaling** (e.g. 125% → 150%) while the app is open.

ResizeObserver does **not** fire on a DPR-only change. → every canvas keeps a backing store sized for
the **old** dpr while the CSS size is unchanged → a permanent **backing-store↔CSS mismatch** (blurry /
stale strip, usually right/bottom edge) until the next genuine resize re-syncs it. This matches the
exact symptom: same region, intermittent, triggered by a monitor/scaling switch, «healed» by a window
resize.

### Big-player practice

Three.js examples, Figma, Google Maps, Excalidraw all re-rasterize on DPR change. The web-canonical
detector is `matchMedia('(resolution: <X>dppx)')` **re-armed on each change** (a single query can only
watch one specific dpr).

---

## Decision

A single SSoT for **DPR-change** notification, wired into the few resize orchestrators that already
own canvas sizing — so a monitor/scaling switch re-sizes **every** viewport canvas automatically.

### SSoT — `systems/cursor/device-pixel-ratio.ts`
`subscribeDevicePixelRatio(cb)` — one shared, re-arming `matchMedia('(resolution: <cur>dppx)')`
listener that fans out the new dpr to all subscribers; the query is torn down after the last
unsubscribe. Reuses the existing `getDevicePixelRatio()` reader (no duplicate DPR source).

### Integration points (reuse existing shared sizers — no new per-canvas code)
| Consumer | Wiring |
|---|---|
| `useCanvasResize` (DxfCanvas + LayerCanvas) | subscribe → `onSetupCanvas()` (re-reads dpr, resizes buffer) |
| `useCanvasSizeObserver` (PreviewCanvas) | subscribe → re-fire `onSizeChange` |
| `CrosshairCompositor` (ADR-549 Phase 6) | subscribe → `resize()` |
| `useViewportManager` (CanvasSection) | subscribe → re-emit viewport object → viewport-prop overlays (FloorUnderlay…) re-size |
| `BimViewport3D` (WebGL) | subscribe → `manager.syncDevicePixelRatio()` (re-applies `setPixelRatio` + size) |
| `BimOverlayDispatchCanvas` | none — per-frame pull already re-reads dpr |

### WebGL pixel-ratio SSoT
`scene-setup.ts` now exports `bimPixelRatio()` (the `min(devicePixelRatio, 2)` clamp), shared by
`createBimRenderer` and the new `ThreeJsSceneManager.syncDevicePixelRatio()` so the live ratio can
never drift between init and re-sync.

---

## Consequences

- ✅ Monitor / OS-scaling switch → all viewport canvases (2D entity/layer/preview/crosshair/overlays +
  3D WebGL) re-rasterize at the new dpr. No stale region.
- ✅ Full SSoT: one DPR source (`getDevicePixelRatio`), one change-listener, one WebGL clamp
  (`bimPixelRatio`). Wired through the EXISTING shared sizers — minimal per-canvas code.
- ⚠️ **Out of scope (flagged, not changed):** the DPR *policy* difference — WebGL clamps to 2, 2D
  canvases use raw dpr. This affects resolution/perf on dpr>2 displays, NOT stale regions. Each canvas
  keeps its existing policy; we only re-run sizing on change. Revisit separately if HiDPI quality
  needs unifying.
- The change-only listener is dormant cost: one `matchMedia` while any viewport canvas is mounted.

---

## Changelog
- **2026-06-29** — ADR created + IMPLEMENTED (UNCOMMITTED). NEW `systems/cursor/device-pixel-ratio.ts`
  (`subscribeDevicePixelRatio`, re-arming matchMedia) + 7 jest. Wired into `useCanvasResize`,
  `useCanvasSizeObserver`, `useViewportManager`, `CrosshairCompositor`, `BimViewport3D`
  (`ThreeJsSceneManager.syncDevicePixelRatio` + `scene-setup.bimPixelRatio` SSoT clamp). Audit
  confirmed zero prior DPR-change handling. 🔴 browser-verify: drag window between monitors with
  different OS scaling → no stale strip / blur. CHECK 6B/6D → stage this ADR + the touched files.

# ADR-639 — DXF Viewer Large-File Performance (worker parsing + progress + spatial-indexed culling + streaming + WebGL line layer)

**Status:** Accepted (Στάδιο 1 implemented — worker-primary routing for large files; Στάδια 2-5 pending)
**Date:** 2026-07-12
**Domain:** dxf-viewer / io (parsing) + rendering (canvas)
**Related:** ADR-040 (preview-canvas-performance — micro-leaf render pipeline; Στάδια 3-5 touch its critical files → CHECK 6B/6D apply, changelog update same-commit), ADR-635 (AutoCAD DXF import coverage — the parser being offloaded; already carries a viewport-culling bugfix Φ C.9 + an open spatial-index bounds gap in `types/entity-bounds.ts`), ADR-636 (professional DXF export), ADR-462 (canonical-mm units — worker already scales entities at parse via `unitsOverride`), ADR-399/400 (viewport auto-fit / state persistence — consume the imported scene), ADR-553 (ViewCube single WebGL context — the only prior WebGL-on-main-canvas precedent), ADR-019 (centralized performance thresholds), ADR-546 (browser performance/memory SSoT)

## Context

Real-world trigger (2026-07-12): a permit floor-plan DXF
`Αδείας.Κάτοψη ισογείου.dxf` — **42 MB, 4.73 million lines, ~215 000 entities**
(209 569 of them plain `LINE`, i.e. 97 %) — **freezes the browser** on import.
This is not a "heavy elements" file (no images, few hatches); it is heavy purely
by **entity count**. It is the canonical stress case for a permit drawing where
everything is exploded into individual LINEs.

A 4-agent read-only survey of the codebase established the exact bottlenecks and,
crucially, **what infrastructure already exists** and can be reused rather than
rebuilt (N.0.2 / N.18).

### Root-cause findings (with file:line)

**1. Parsing runs on the MAIN THREAD, synchronously, blocking the UI.**
`io/dxf-import.ts:38-49` runs `directParseFileWithEncoding` **first** and returns
on success, so the real Web Worker (`workers/dxf-parser.worker.ts`) is a
**fallback-only** path that never runs in the normal flow (comment at
`dxf-import.ts:40-41`: *"direct parse is primary path"*). The direct path
(`dxf-import.ts:139-168`) reads the whole file via
`encodingService.readFileWithAutoDetect` (`readAsArrayBuffer`, entire file) then
calls `runDxfParse` → `DxfSceneBuilder.buildSceneWithDiagnostics` — **100 %
synchronous**, no `await`/`yield`/`requestIdleCallback` anywhere in the parse loop.
For 4.7 M lines the main thread is frozen for the whole parse ⇒ "page unresponsive".

**Key enabler:** both paths call the **same** `runDxfParse` SSoT
(`utils/run-dxf-parse.ts:34`); the worker
(`dxf-parser.worker.ts:17-26`) calls it with `normalizeBounds:false` and the main
thread finishes the normalize (`dxf-import.ts:85`). So flipping the worker to primary
is a **routing change, not a parser rewrite**.

**2. The file is read whole into memory** (`readAsArrayBuffer` / `readAsText`),
no `ReadableStream` / chunked read anywhere. `encoding-service.ts:193-235`.

**3. ≥5 O(n) passes over all entities post-parse** (`dxf-scene-builder.ts`):
convert (`:230-266`), bounds #1 (`:283`), scale-to-mm map (`:312-324`, if
`mmFactor≠1`), bounds #2 (`:325`), then `calculateTightBounds`+`normalizeEntityPositions`
(`run-dxf-parse.ts:46`, `bounds-entity.ts:223-267`). Block/INSERT expansion is
budget-capped at `DEFAULT_SCENE_ENTITY_BUDGET = 500_000` (`dxf-block-expander.ts:46`).

**4. The worker sends NO progress messages** — one final `postMessage` only
(`dxf-parser.worker.ts:62`). No percent/ETA feedback possible today.

**5. Rendering is an O(n) linear scan of ALL entities every frame** with a
**per-entity** bbox cull (`DxfRenderer.ts:157-226`, predicate
`isEntityInViewport` in `dxf-viewport-culling.ts:235-241`). Culling exists, but it
is O(n)-scan-with-early-exit, **not** a spatial-index query returning only visible
entities.

**6. A full QuadTree + Grid spatial index ALREADY EXISTS but only feeds
hit-testing, not rendering.** `core/spatial/QuadTreeSpatialIndex.ts`,
`GridSpatialIndex.ts`, `SpatialIndexFactory.ts`, consumed by
`rendering/hitTesting/HitTester.ts:53` (built when `entities.length > 100`). The
render path (`DxfRenderer`/`dxf-canvas-renderer`) does not import it at all.

**7. The bitmap cache is whole-viewport, not tiled.** `dxf-bitmap-cache.ts`
snapshots the entire scene to an offscreen canvas; **any** pan/zoom changes the
cache key (`scale`/`offsetX`/`offsetY`/`viewport`) ⇒ **full rebuild** re-drawing all
visible entities. Correctly excludes hover/selection/grip from the key (ADR-040
cardinal rule 3). No dirty-rect / per-tile invalidation.

**8. No LOD / simplification / decimation** anywhere. The only `levelOfDetail` flag
lives in dead code (`RenderPipeline.ts:227`, file header says `— DEADCODE`).

**9. Canvas 2D only.** No WebGL on the main entity canvas. But **three.js
`^0.170` is already a dependency** (`package.json:304`) driving the 3D BIM viewport,
and `BimViewport3D.tsx:28-31` already runs a **hybrid WebGL-scene + Canvas2D-overlay**
pattern — a live in-repo precedent for an incremental 2D→WebGL layer. The
world→screen transform is a plain affine (`CoordinateTransforms.ts:100-103`,
sourced from `ImmediateTransformStore`) → trivially expressible as an ortho
projection matrix. An `IRenderContext` abstraction (`type:'canvas2d'|'webgl'|'webgpu'`)
exists but is **functionally dead** for entities (185 files call
`CanvasRenderingContext2D` directly; a full rewrite is not justified).

### Technical debt noted (Boy-Scout candidates, N.0.2)
Three parallel entity-bounds implementations — `Bounds.ts`,
`entity-bounds-ssot.ts`, `dxf-viewport-culling.ts:getEntityBBox` — each self-labelled
"SSoT". A shared bounds SSoT with per-entity memoization is a prerequisite for
Στάδιο 3 (spatial-indexed culling) to avoid recomputing bounds per frame.

## Decision — staged

The fix is **architectural, not "make the parser faster"**. Five phases, ordered by
ROI, each shippable independently. Στάδια 1-2 solve the freeze; 3-5 make it fast
*after* load. **One phase per session** (memory: `feedback_phase_per_session`),
each ≤70 % context.

### Στάδιο 1 — Web Worker as PRIMARY for large files (DONE — 2026-07-12)
Route parsing through the existing `dxf-parser.worker.ts` when the file is large,
keeping the direct path for small files (avoids worker spin-up overhead).
**Implemented:**
- `config/dxf-import-thresholds.ts` — new SSoT: `WORKER_PARSE_MIN_BYTES = 5 MB`
  (the `file.size` branch that finding #5 said was missing).
- `io/dxf-import.ts` — `importDxfFile` now routes `file.size ≥ threshold` to a new
  private `parseViaWorker()`; small files keep the inline `directParseFileWithEncoding`.
  On worker soft-fail (unsupported env / crash / 60 s timeout) it **falls back** to the
  direct main-thread parse (load-with-a-hitch beats fail-to-load).
- **Encoding fix (important):** `parseViaWorker` reads via
  `encodingService.readFileWithAutoDetect` (Greek cp1253 / ISO-8859-7 safe) and posts the
  **already-decoded** string to the worker — replacing the legacy worker-fallback path
  which used `reader.readAsText(UTF-8)` and would corrupt Greek text in older DXF files.
  Bounds normalization (`calculateTightBounds(entities, true)`) still runs on the main
  thread after transfer, matching prior behaviour (worker parses `normalizeBounds:false`).
- Tests: `io/__tests__/dxf-import-worker-routing.test.ts` (3 passing) — pins small→inline,
  large→worker-with-decoded-content, worker-fail→direct-fallback.

**Outcome:** browser stops freezing on large permit plans. Lowest cost, highest value.
_io layer only — does not touch ADR-040 critical render files._

### Στάδιο 2 — Import progress feedback (PENDING)
Worker emits incremental `postMessage({type:'progress', phase, pct})` during parse
(bytes consumed / entities built); UI shows a determinate progress bar + cancel.
Requires threading a progress callback into `runDxfParse`/`DxfSceneBuilder` loops
(finding #4: single final message today). UX only; no render-path impact.

### Στάδιο 3 — Spatial-indexed viewport culling in the render path (PENDING)
Feed the **existing** `QuadTreeSpatialIndex`/`GridSpatialIndex` into
`DxfRenderer.render()` so the per-frame scan becomes `queryBounds(worldViewport)` →
O(log n + k) instead of O(n). Prerequisite: consolidate the 3 bounds
implementations into one memoized SSoT (tech-debt above). **Touches ADR-040
critical files** (`DxfRenderer.ts`, `dxf-canvas-renderer.ts`) → CHECK 6B/6D fire,
ADR-040 changelog updated same-commit.

### Στάδιο 4 — Streaming / chunked parse in the worker (PENDING)
Replace whole-file read with `ReadableStream` chunked read inside the worker;
parse incrementally with periodic yields so progress (Στάδιο 2) is smooth and peak
memory drops. Progressive scene fill. Builds on Στάδια 1-2.

### Στάδιο 5 — WebGL line layer for LINE/POLYLINE (PENDING)
Add a dedicated WebGL `<canvas>` layer in `CanvasLayerStack` (same z-slot, same
`ImmediateTransformStore` → ortho projection matrix) that GPU-batches the
LINE/POLYLINE bulk (97 % of this file) into persistent buffers — continuous
zoom/pan updates only the camera matrix instead of rebuilding the whole bitmap.
Arc/Circle/Spline/Hatch/Text/Dimension stay on Canvas 2D (complex geometry, low
ROI, already helped by the bitmap cache). Mirrors the existing `BimViewport3D`
hybrid pattern; reuses the already-present three.js. **Incremental, NOT a full
rewrite** — do not attempt to revive the dead `IRenderContext`/`RenderPipeline`.
Highest cost; the "professional-grade" ceiling. **Touches ADR-040 critical files.**

## Consequences
- Στάδια 1-2 remove the freeze with minimal risk (io layer, existing worker).
- Στάδια 3-5 are the "fast after load" tier and enter the ADR-040 performance-critical
  zone — each needs its changelog entry and respects the micro-leaf cardinal rules
  (no orchestrator `useSyncExternalStore`, event-time getters, cache-key hygiene).
- Consolidating the triple bounds logic (Στάδιο 3 prerequisite) also closes the open
  ADR-635 spatial-index hatch-bounds gap.

## Changelog
- **2026-07-12** — ADR created. 4-agent read-only codebase survey completed
  (parse pipeline, render pipeline, ADR landscape, WebGL feasibility). Root causes
  #1-#9 documented with file:line. Five-phase plan defined.
- **2026-07-12** — **Στάδιο 1 DONE.** Worker-primary routing for files ≥ 5 MB
  (`config/dxf-import-thresholds.ts` SSoT + `io/dxf-import.ts` `parseViaWorker`), with
  encoding-correct read (fixes latent cp1253/ISO-8859-7 corruption in the old worker
  path) and direct-parse safety-net fallback. 3 routing tests passing. Next: Στάδιο 2
  (import progress feedback).

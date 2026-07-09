# ADR-608 — Vector-PDF backend (print & export, SSoT emitter)

**Status:** Accepted (Φ1+Φ2 implemented, uncommitted) · **Date:** 2026-07-09 · **Owner:** DXF Viewer
**Related:** ADR-453 (print/export engine), ADR-454 (plot style), ADR-505 (BIM→DXF primitives)

> ⚠️ Numbering note: this work was drafted as "ADR-604" in an earlier plan, but ADR-604
> was already taken (family-type command core, commit `fca12141`). Renumbered to the next
> free slot **ADR-608** (highest existing was ADR-607).

## Context

The print and export paths both produced a **raster** PDF: the 2D scene was rendered to an
offscreen canvas → `canvas.toDataURL('image/png')` → `pdf.addImage(...)`. Result: the whole
drawing lands as **one image** — it pixelates on zoom and, on AutoCAD `PDFIMPORT`, imports as a
single picture on `PDF_Images` instead of real entities on `PDF_Geometry`/`PDF_Text`/`PDF_Solid Fills`.

Giorgio's decisions: **native selectable text**, **vector default with a raster fallback**, **all entities**.

**Key SSoT opportunity:** `export/core/bim-to-dxf-primitives.ts flattenSceneEntitiesForDxf()`
already unfolds the whole scene into neutral primitive `Entity[]` (line/arc/polyline/text/hatch/
dimension; BIM→lwpolyline) in world coords — it already feeds the client-side DXF writer. The SAME
flatten now feeds a vector-PDF emitter → DXF and PDF stay in lockstep ("export what you draw").

## Decision

**ONE shared vector emitter** consumes the flattened `Entity[]` and emits native jsPDF primitives
instead of `ctx.*` (raster) or DXF group codes.

### Core — `print/vector/scene-vector-emitter.ts` (Φ1)

`emitSceneToPdf(pdf, { entities, toPaper, worldToPaperScale, colorPolicy })`:
- The caller injects a pure `toPaper(worldPoint) → {x,y}` (jsPDF mm, Y-down, already placed) plus
  `worldToPaperScale` (mm/world-unit, for radii + text height). The emitter reuses **no** screen
  transform of its own.
- Dispatch by `entity.type`: `line`→`pdf.line`; `circle`→`pdf.circle`; `arc`→`tessellateArcDegrees`
  →`pdf.lines`; polyline/lwpolyline/rect→`pdf.lines`; `text`/`mtext`→native `pdf.text`
  (via `projectSceneTextToDxf`); `hatch`→solid-fill faces + boundary outline;
  `dimension`→`buildDimensionBlockPrimitives`.
- Colour/lineweight reuse the raster SSoT (`applyPlotColor` + `parseHex`); lineweight is emitted in
  **mm** (`pdf.setLineWidth`) → resolution-independent.

### Print wiring (Φ2)

1. `print/capture/capture-types.ts` — `CaptureResult` becomes a **discriminated union** on `kind`:
   `RasterCaptureResult {kind:'raster', dataUrl, widthPx, heightPx}` |
   `VectorCaptureResult {kind:'vector', draw:(pdf, area)=>void}`; both share `appliedScaleDenominator`.
2. `print/capture/capture-2d-vector.ts` (NEW) — `captureCurrent2dViewVector(input)`:
   `convertSceneToDxf` + `setLayers` + `resolvePrintTransform` (exported from `capture-2d.ts`) +
   `stampRenderedColors` + `flattenSceneEntitiesForDxf`, then returns a vector `CaptureResult` whose
   `draw(pdf, area)` builds `toPaper` and calls `emitSceneToPdf`.
3. `print/assemble/pdf-assembler.ts` — branch on `capture.kind`: `vector`→`capture.draw(pdf, area)`;
   `raster`→`addImage(...)`. Title block / scale caption / `output('blob')` / routing **unchanged**.
4. `print/print-service.ts` `captureSource` — 2D routes to vector|raster by `request.outputMode`
   (default vector); 3D is always raster.
5. `print/config/paper-types.ts` — `PrintRequest.outputMode?: 'vector'|'raster'` + `PrintOutputMode`.
6. UI — `PrintOutputControls.tsx` + `usePrintDialogState.ts`: new output-mode `Select` (2D-only,
   default vector). i18n `print.outputMode.*` in el + en.

### Coordinate mapping (the bug-risk area)

`toPaper` reuses `CoordinateTransforms.worldToScreen(p, transform, viewport)` (the SAME mapping the
offscreen renderer uses, already Y-down + ruler-margin-consistent), then folds screen px → paper mm
via `pxToMm(px, effectiveDpi)` plus the printable-area offset. Because the offscreen canvas is sized
exactly to the printable area, canvas px map 1:1 into that area — so the vector drawing lands on the
**identical** paper coordinates the raster path would have rasterised. `worldToPaperScale =
pxToMm(transform.scale, effectiveDpi)`.

## Reuse (no duplicate)

`flattenSceneEntitiesForDxf`, `stampRenderedColors` (exported from `dxf-export-adapter.ts`),
`resolvePrintTransform` (exported from `capture-2d.ts`), `pxToMm`/`rasterToViewport`
(`paper-math.ts`), `applyPlotColor` (`print-color-policy.ts`), `CoordinateTransforms.worldToScreen`,
`tessellateArcDegrees`, `buildDimensionBlockPrimitives`, `projectSceneTextToDxf`, `registerGreekFont`.

## Consequences

- ✅ 2D print PDF is vector by default: selectable text, zoom without pixelation, AutoCAD PDFIMPORT →
  real entities. Raster fallback (`outputMode:'raster'`) is byte-for-byte the previous behaviour.
- ✅ DXF, vector PDF and the on-screen render agree entity-for-entity (one flatten, three backends).
- ✅ Tests: 10 emitter (Φ1) + 4 capture-2d-vector + updated assembler/print-service = 26 GREEN.
  jscpd:diff clean. Files <500 lines, functions <40 lines; no `any`/inline-styles/hardcoded strings.
- ⚠️ **Known limitations (DEFER):** (a) hatch v1 = solid-fill faces + boundary outline (pattern lines →
  raster fallback); (b) multi-line text collapsed to one run; (c) font substitution to the registered
  Greek font (minor metric drift vs SHX); (d) 3D has no vector representation → always raster;
  (e) heavy hatched drawings → large/slow vector PDF → keep raster fallback.
- ⏳ **Φ3 (future):** Export-dialog PDF slot (`export/formats/pdf-export-adapter.ts` + paper controls,
  remove the `export-service.ts` `EXPORT_FORMAT_NOT_READY:pdf` throw), reusing the same emitter.

## Changelog

- **2026-07-09** — Φ1 (emitter core + 10 tests) + Φ2 (CaptureResult union, `capture-2d-vector.ts`,
  assembler branch, `outputMode` service/UI/i18n, tests) implemented (Opus). 26 jest GREEN,
  jscpd:diff clean. Renumbered from the planned "604" (collision) to ADR-608. UNCOMMITTED.
  🔴 browser-verify: Print 2D → save PDF → zoom without pixels; AutoCAD PDFIMPORT → entities on
  `PDF_Geometry`/`PDF_Text`/`PDF_Solid Fills` (not one image on `PDF_Images`); raster fallback unchanged.
  Browser-verified GREEN by Giorgio (vector import works). Follow-up fix: emitter now sets round
  `setLineCap`/`setLineJoin` so stroked corners close without the butt-cap/miter notch visible at high
  zoom. (Confirmed: mm lineweights scaling with zoom is correct/desired — model-space pen width.)

# ADR-453 — DXF Viewer Print/Export Engine (2Δ & 3Δ → PDF / Printer / Plotter)

**Status:** Implemented (Slices 0-5) — UNCOMMITTED · browser-verify pending
**Date:** 2026-06-14
**Owner:** DXF Viewer subapp
**Related:** ADR-040 (canvas perf), ADR-267 (Greek font SSoT), ADR-345 (ribbon),
ADR-363 §6 Phase 8 (dialog host pattern), ADR-366 (MP4 offscreen render),
ADR-375 (pen table / plot scale), ADR-418 (view scale)

---

## Context

Η υποεφαρμογή `/dxf/viewer` δεν είχε κανέναν μηχανισμό εκτύπωσης/εξαγωγής σχεδίων.
Απαίτηση: **enterprise + full-SSoT** μηχανισμός που βγάζει σχέδια **και από 2Δ και από 3Δ**
σε **PDF** (προτεραιότητα), εκτυπωτή και plotter (μέσω του ίδιου PDF + OS print dialog).

**Στόχος SSoT:** ΕΝΑ print engine όπου 2Δ και 3Δ τροφοδοτούν τον **ίδιο** PDF assembler
και το **ίδιο** output path — μηδέν duplication.

## Decision

Νέο module `src/subapps/dxf-viewer/print/` με αυστηρό διαχωρισμό:

| Layer | Files | Ευθύνη |
|-------|-------|--------|
| **config** | `config/paper-{types,constants,math}.ts` | ISO A4-A0, DPI, mm↔px, fit-to-paper, 1:N transform (pure, jest) |
| **capture** | `capture/capture-2d.ts` (+offscreen), `capture/capture-3d.ts` | 2Δ re-render & 3Δ snapshot → κοινό `CaptureResult` |
| **assemble** | `assemble/pdf-assembler.ts`, `pdf-image-layout.ts`, `title-block-renderer.ts`, `scale-caption-renderer.ts` | jsPDF → registerGreekFont → addImage → [title block] → blob |
| **facade** | `print-service.ts`, `print-filename.ts` | capture → assemble → output (SSoT orchestrator) |
| **UI** | `ui/components/print/PrintDialog.tsx` (+controls/state), `app/PrintHost.tsx` | Radix dialog + EventBus host (mirror BimScheduleHost) |

### Data flow (SSoT convergence)

- **2Δ→PDF (Option A):** `convertSceneToDxf` → `computePaperRasterPx` → detached canvas
  (+`getBoundingClientRect` stub, +`LayerStore.setLayers`) → fit transform
  (fit-to-page=`FitToViewService.calculateFitToViewTransform`· 1:N=`computeDrawingScaleTransform`)
  → `DxfRenderer.render(...skipInteractive)` → `toDataURL('png')`. **Εκτός ADR-040 hot path.**
- **3Δ→PDF:** offscreen `WebGLRenderer({preserveDrawingBuffer:true})` (mirror MP4Exporter),
  cloned camera (non-mutating), `render` → `toDataURL`, `dispose()` σε `finally`. 1:N N/A.
- **Και τα δύο** → **ίδιος** `assemblePrintPdf` → **ίδιο** routing:
  `triggerExportDownload` (save-pdf) ή `openBlobInNewTab + w.print()` (open-print = εκτυπωτής/plotter).

### Reuse (κανένα duplicate)

`trigger-export-download` (output SSoT), `registerGreekFont` (ADR-267), jsPDF/autotable,
`convertSceneToDxf`, `FitToViewService`, `DxfRenderer`, `LayerStore`, `ThreeJsSceneManager`,
`drawing-scale-store`. Νέο SSoT handle: `bim-3d/scene/active-scene-manager-registry.ts`
(zero-React· BimViewport3D set/clear· print διαβάζει live 3D).

### UI wiring

Ribbon **Ανάλυση → «Εκτύπωση»** (`analyze-tab.ts` PRINT_PANEL, icon `printer`)
→ action `open-print-dialog` → `useDxfViewerCallbacks` → EventBus `dxf:print-dialog-requested`
→ `PrintHost` → `PrintDialog`. i18n: `dxf-viewer-shell.json` `ribbon.*.print` + `print.*` (el+en).

## Slices

- **0** scaffolding (paper config/math) · **1** 2Δ→PDF MVP · **2** PrintDialog+ribbon ·
  **3** 3Δ→PDF · **4** title block + scale caption · **5** printer/plotter (open-print).

## Consequences

- ✅ Ενιαίο SSoT print engine, 2Δ+3Δ → PDF/printer/plotter, A4-A0, fit-to-page & 1:N, title block.
- ✅ 30 jest (paper-math, image-layout, assembler[mocked jsPDF], filename, service SSoT-convergence, title block).
- ✅ tsc clean· αρχεία <500 γρ., functions <40 γρ.· no `any`/inline-styles/hardcoded strings.
- ⚠️ **Known limitations (DEFER):** (α) λευκό background — white/by-layer-white 2Δ entities
  αόρατα σε λευκή σελίδα (pen-table-aware print colours = future)· (β) native HPGL/PLT
  (plotting via PDF→OS dialog)· (γ) live preview· (δ) multi-sheet/layouts· (ε) A0@high-DPI
  clamps DPI (canvas px ceiling 8192).

## Changelog

- **2026-06-14** — Slices 0-5 implemented (Opus). 30 jest GREEN, tsc clean. UNCOMMITTED.
  🔴 browser-verify (Analyze→Εκτύπωση→A3/landscape→Save PDF 2Δ· 3Δ source· Open&Print) + commit.
- **2026-07-09** — **ADR-608 vector-PDF backend** wired into the print engine (Opus). `CaptureResult`
  is now a discriminated union (`raster`|`vector`); 2D print defaults to a native-vector PDF via the
  shared `scene-vector-emitter`, with the previous raster path kept as `outputMode:'raster'` fallback.
  `resolvePrintTransform` exported from `capture-2d.ts` for SSoT transform reuse. Assembler branches on
  `capture.kind`; title block / caption / routing unchanged. See ADR-608 for the full design.

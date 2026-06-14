# ADR-454 — Print Plot Style (AutoCAD CTB / Revit print, 2Δ-only)

**Status:** Implemented (Slices 0-4) — UNCOMMITTED · browser-verify pending
**Date:** 2026-06-14
**Owner:** DXF Viewer subapp
**Related:** ADR-453 (print engine), ADR-040 (canvas perf), ADR-358 §G7 (ByLayer/ByBlock
style resolver), ADR-375/377 (pen table / BIM line weight resolver), ADR-418 (view scale)

---

## Context

Το ADR-453 (print engine) κάνει 2Δ re-render σε offscreen canvas με τα **screen χρώματα
του dark viewer**. Συνέπεια: λευκές / `by-layer`-white / ουδέτερες (neutral) γραμμές
βγαίνουν **αόρατες σε λευκό χαρτί**, και τα πάχη γραμμών υπολογίζονται σε screen-px @96 DPI
αντί για φυσικά ISO mm στο πραγματικό print DPI.

Απαίτηση: σύστημα «Plot Style» (AutoCAD CTB / Revit print) ώστε το τυπωμένο 2Δ να βγαίνει
επαγγελματικά — **λευκό φόντο, ορατό μελάνι, σωστά ISO πάχη**. Ισχύει **μόνο για 2Δ** (το 3Δ
είναι WYSIWYG πραγματικά υλικά).

## Decision

Νέο pure SSoT `config/print-color-policy.ts` + injection σε **2 chokepoints** του render
pipeline. **Μηδέν αλλαγές στα ~17 BIM leaf renderers.**

### Plot-style modes (`PrintPlotStyle`)

| Mode | Συμπεριφορά |
|------|-------------|
| `colour` (**default**) | white-safe: near-white / ACI 7 / null → μαύρο· κάθε άλλο χρώμα ως έχει (κρατά μπλε κολώνες / amber δοκάρια) |
| `monochrome` | όλα μαύρα (Revit default τεχνικών σχεδίων) |
| `grayscale` | luminance → γκρι (near-white / null → μαύρο για ορατότητα) |
| `by-pen` | CTB ACI→pen (Slice 5 — DEFERRED· προς το παρόν fallback σε `colour`) |

### Activation model (ADR-040 compliant by construction)

Module-level singleton, mirror του υπάρχοντος `_activePenTable` / `setPenTableSource`
(`bim-line-weight-resolver.ts`): `getPrintColorPolicy()` / `setPrintColorPolicy(p)` /
`clearPrintColorPolicy()`. Το `capture-2d.ts` κάνει `set` **πριν** το `renderer.render()`
και `clear` σε `finally`. Πλήρως **σύγχρονη** αλυσίδα σε one-shot offscreen canvas → μηδέν
concurrency risk· ο singleton μένει `null` στο live interactive render (single boolean branch,
μηδέν hot-path κόστος, **εκτός** bitmap cache).

### 2 SSoT chokepoints

**Track A — Raw DXF primitives** (`DxfRenderer.resolveStyleForRender`):
όταν policy active → `colorHex = applyPlotColor(resolved.color, resolved.colorAci, policy)`
+ `lineweightToPx(mm, policy.dpi)` αντί 96. Καλύπτει **και** το LINE batch path **και** το
unified path (ίδια πηγή). Καλύπτει και το fallback branch (χωρίς layersById).

**Track B — BIM parametric** (`resolveSubcategoryStyle`):
`effectiveDpi = policy ? policy.dpi : (ctx.dpi ?? 96)` σε όλα τα 5 `lineweightToPx` σημεία
+ wrap του τελικού `color` με `applyPlotColor(rawColor, null, policy)`. **Κρίσιμο:** όταν ο
resolver επιστρέφει `color: null` (= «use canvas token»), το leaf θα έβαζε ουδέτερο/λευκωπό
token (αόρατο σε λευκό)· το `applyPlotColor(null, …)` το κάνει μαύρο.

### Data flow

```
PrintDialog (plotStyle Select, μόνο 2Δ)
  → usePrintDialogState.buildRequest() { plotStyle: src==='2d' ? … : undefined }
  → runPrint → captureCurrent2dView({ plotStyle })
  → setPrintColorPolicy({ style, dpi: raster.effectiveDpi })
  → DxfRenderer.render (Track A + Track B διαβάζουν τον singleton)
  → clearPrintColorPolicy() (finally)
```

`PrintPlotStyle` ορίζεται **μία φορά** στο `print-color-policy.ts`· το `paper-types.ts`
το **re-exports** ως single import surface (μηδέν circular dep).

## Files

| Αρχείο | Αλλαγή |
|--------|--------|
| `config/print-color-policy.ts` (**NEW**) | `PrintPlotStyle`/`PrintColorPolicy` + `applyPlotColor` + singleton set/get/clear |
| `canvas-v2/dxf-canvas/DxfRenderer.ts` | Track A: policy color + print-DPI lineweight (resolved + fallback) — **ADR-040 micro-leaf (CHECK 6B)** |
| `config/bim-line-weight-resolver.ts` | Track B: `effectiveDpi` × 5 + `applyPlotColor` wrap στο `color` |
| `print/capture/capture-2d.ts` | set/clear policy γύρω από render· thread `plotStyle` + `effectiveDpi` |
| `print/config/paper-types.ts` | `plotStyle?` στο `PrintRequest` + re-export `PrintPlotStyle` |
| `print/print-service.ts` | πέρασε `request.plotStyle` στο 2D capture |
| `ui/components/print/usePrintDialogState.ts` | state `plotStyle` (default `colour`)· request μόνο όταν 2Δ |
| `ui/components/print/PrintOutputControls.tsx` | Radix Select plot-style (μόνο 2Δ) |
| `ui/components/print/PrintDialog.tsx` | πέρασε `plotStyle`/`setPlotStyle` |
| `i18n/locales/{el,en}/dxf-viewer-shell.json` | `print.plotStyle.*` (label + 4 modes + hint) |
| `print/__tests__/print-color-policy.test.ts` (**NEW**) | 13 jest |

## Consequences

- ✅ Τυπωμένο 2Δ με ορατό μαύρο μελάνι σε λευκό φόντο + σωστά ISO πάχη στο print DPI.
- ✅ Μηδέν leaf-renderer αλλαγές· μηδέν live hot-path επίπτωση (singleton `null` εκτός print).
- ✅ 4 plot-style modes· default `colour` (white-safe, κρατά BIM χρώματα).
- ⏳ **DEFER (Slice 5)**: CTB by-ACI pen table (`resolveEntityStyle.colorAci` → pen) για
  AutoCAD-grade fidelity· προς το παρόν `by-pen` === `colour`.
- ⏳ DEFER: αδιαφανές white PNG background (προαιρετικό `fillRect`)· grayscale-by-pen.

## Verification

- jest: `npx jest --testPathPatterns="src/subapps/dxf-viewer/print/__tests__"` → 43 GREEN
  (13 νέα print-color-policy).
- Browser `/dxf/viewer`: σχέδιο με λευκές γραμμές → Ανάλυση → «Εκτύπωση» → plot style
  «Μονόχρωμο»/«Έγχρωμο» → Save PDF → γραμμές **ορατές μαύρες σε λευκό**, σωστά ISO πάχη ανά
  κλίμακα (1:50 πιο χοντρές από 1:100).

## Changelog

- **2026-06-14** — Slices 0-4 implemented (Opus). 13 νέα jest (43 print suite GREEN). UNCOMMITTED.

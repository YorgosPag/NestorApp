# HANDOFF — ADR-454 Print Plot Style (Revit/AutoCAD CTB-grade) · 2026-06-14

> Δώσε αυτό το αρχείο (ή το συνοδευτικό μήνυμα) στο prompt της νέας συνεδρίας.
> Γλώσσα απαντήσεων στον Giorgio: **Ελληνικά πάντα** (CLAUDE.md LANGUAGE RULE).
> Μοντέλο: **Opus** (αρχιτεκτονική, 5+ files, 2+ chokepoints).

---

## 0. ΚΑΤΑΣΤΑΣΗ ΠΡΟΗΓΟΥΜΕΝΟΥ (ADR-453 — Print/Export Engine)

✅ **ADR-453 ΟΛΟΚΛΗΡΩΘΗΚΕ & ΔΟΥΛΕΥΕΙ** (browser-verified από Giorgio): 2Δ & 3Δ → PDF / εκτυπωτή / plotter.
SSoT module `src/subapps/dxf-viewer/print/` (config/capture/assemble/facade) + PrintDialog + ribbon Ανάλυση→«Εκτύπωση». 30 jest GREEN, tsc clean.
**UNCOMMITTED** — ο **Giorgio κάνει το commit, ΟΧΙ εσύ**.

🚨 **WORKING TREE ΜΟΙΡΑΖΕΤΑΙ ΜΕ ΑΛΛΟΝ AGENT** → ποτέ `git add -A`. `git add` **ΜΟΝΟ τα δικά σου αρχεία**. Ποτέ commit/push χωρίς ρητή εντολή (N.(-1)).

Γνωστό όριο ADR-453 που λύνει το ADR-454: το 2Δ print κάνει re-render με τα **screen χρώματα του dark canvas** → λευκές / by-layer-white γραμμές γίνονται **αόρατες σε λευκό χαρτί**, και τα πάχη γραμμών είναι screen-px @96DPI (όχι φυσικά ISO mm στο print DPI).

---

## 1. ΣΤΟΧΟΣ ADR-454 (full enterprise + full SSoT, σαν Revit/AutoCAD)

«Plot Style» σύστημα (AutoCAD CTB / Revit print) ώστε το **τυπωμένο 2Δ** να βγαίνει επαγγελματικά:
- **Λευκό φόντο**, μελάνι ορατό: remap λευκών/by-layer-white → μαύρο.
- **Plot style modes**: `colour` (white-safe: κρατά BIM category χρώματα, λευκό→μαύρο) · `monochrome` (όλα μαύρα — Revit default τεχνικών σχεδίων) · `grayscale` (luminance) · `by-pen/CTB` (ACI→pen, Slice 5).
- **ISO πάχη γραμμών στο πραγματικό print DPI** (όχι 96): `lineweightToPx(mm, printDpi)`.
- Ισχύει **μόνο για 2Δ** (το 3Δ είναι WYSIWYG πραγματικά υλικά — το plot style αφορά γραμμικά σχέδια). Το PrintDialog δείχνει το plot-style control **μόνο όταν source=2Δ**.

---

## 2. ΑΡΧΙΤΕΚΤΟΝΙΚΗ — 2 SSoT CHOKEPOINTS (ΜΗΝ αγγίξεις leaf renderers)

Το χρώμα/πάχος αναλύεται σε **δύο μόνο** σημεία· τα ~17 BIM leaf renderers ΔΕΝ χρειάζονται αλλαγή.

**Track A — Raw DXF primitives** (line/arc/circle/polyline/text/xline/ray/dimension):
- Chokepoint: `DxfRenderer.resolveStyleForRender(entity, layersById): { colorHex, lineWidthPx, alpha }`
  σε `canvas-v2/dxf-canvas/DxfRenderer.ts` (~γρ. 312-350). Καλεί `entityToStyleInput` + `resolveEntityStyle` (`systems/properties/resolve-entity-style.ts`, παράγει και `colorAci` για CTB).
- Το `colorHex` ρέει → `buildEntityModelFromDxf` → `entity.color` → `PhaseManager.applyNormalStyle` (`ctx.strokeStyle = entity.color`). Υπάρχει και **LINE batch path** στο `DxfRenderer.render()` (~γρ. 141-180) που θέτει `ctx.strokeStyle = resolved.colorHex` — **ίδια πηγή** (το chokepoint τα καλύπτει και τα δύο).
- Lineweight: `lineweightToPx(resolved.lineweight, 96)` — **hardcoded 96** → για print βάλε `printDpi`.

**Track B — BIM parametric** (wall/column/beam/slab/opening/stair/foundation/MEP/railing/roof):
- Chokepoint: `resolveSubcategoryStyle(ctx): { color, lineWidthPx, ... }` σε `config/bim-line-weight-resolver.ts` (~γρ. 130). 8-level priority stack· τελικό `color` + `lineWidthPx` (μέσω pen-table column `closestScaleColumn(ctx.scaleDenominator)` → ADR-375). Callers περνούν `dpi: 96`.

---

## 3. ΣΧΕΔΙΟ (recommended — επιβεβαίωσε σε Plan Mode, N.0.1)

**Νέο SSoT** `config/print-color-policy.ts` (pure, jest):
```ts
export type PrintPlotStyle = 'colour' | 'monochrome' | 'grayscale' | 'by-pen';
export interface PrintColorPolicy { style: PrintPlotStyle; dpi: number; }
export function applyPlotColor(colorHex: string, colorAci: number|null, policy: PrintColorPolicy): string;
// colour: near-white(#FFF/ACI 7)→#000, αλλιώς ως έχει · monochrome: πάντα #000 ·
// grayscale: luminance→γκρι · by-pen: CTB ACI→print colour (Slice 5)
```
**Module-level singleton** (mirror του ΥΠΑΡΧΟΝΤΟΣ `_activePenTable`/`setPenTableSource` pattern — ADR-040 compliant by construction):
`setPrintColorPolicy(p)` / `clearPrintColorPolicy()` — set ΠΡΙΝ το `renderer.render()` στο print, clear μετά (sync call chain, μηδέν concurrency risk).

**Injection (Option A + C, μηδέν leaf edits):**
- `DxfRenderer.resolveStyleForRender`: αν policy active → `colorHex = applyPlotColor(...)` + `lineweightToPx(mm, policy.dpi)`.
- `bim-line-weight-resolver.resolveSubcategoryStyle`: αν policy active → φίλτραρε `color` με `applyPlotColor` + χρησιμοποίησε `policy.dpi` αντί 96.
- `print/capture/capture-2d.ts`: `setPrintColorPolicy({style, dpi: raster.effectiveDpi})` πριν render, `clearPrintColorPolicy()` σε `finally`.
- `print/config/paper-types.ts` `PrintRequest`: πρόσθεσε `plotStyle?: PrintPlotStyle`. PrintDialog control (Radix Select) + i18n el/en. 3Δ → απενεργοποίησε.

**Background**: το PDF page είναι ήδη λευκό· το transparent PNG → λευκό. Αρκεί το white→black remap. (Προαιρετικό white `fillRect` στο `capture-2d-offscreen-canvas.ts` αν θες αδιαφανές PNG.)

**Default plot style**: πρότεινε `colour` (white-safe — κρατά μπλε κολώνες/amber δοκάρια, λευκό→μαύρο). Επιβεβαίωσε με Giorgio (Revit τεχνικά = monochrome).

---

## 4. ΑΡΧΕΙΑ ΠΟΥ ΑΛΛΑΖΟΥΝ

| Αρχείο | Αλλαγή |
|--------|--------|
| `config/print-color-policy.ts` (NEW) | `PrintPlotStyle`/`PrintColorPolicy` + `applyPlotColor` + singleton set/clear |
| `canvas-v2/dxf-canvas/dxf-types.ts` | (προαιρ.) `plotStyle?` στο `DxfRenderOptions` — ή μόνο singleton |
| `canvas-v2/dxf-canvas/DxfRenderer.ts` | `resolveStyleForRender`: apply policy color + `printDpi` lineweight ⚠️ **CHECK 6B** |
| `config/bim-line-weight-resolver.ts` | apply policy στο `color` + `dpi` όταν active |
| `print/capture/capture-2d.ts` | set/clear policy γύρω από render· thread `effectiveDpi` |
| `print/config/paper-types.ts` + `print-service.ts` | `plotStyle` στο `PrintRequest`· πέρασέ το στο capture |
| `ui/components/print/PrintOutputControls.tsx` + `usePrintDialogState.ts` | plot-style Select (μόνο 2Δ) |
| `i18n/locales/{el,en}/dxf-viewer-shell.json` | `print.plotStyle.*` keys (ΟΧΙ hardcoded, N.11) |

---

## 5. ⚠️ ΚΡΙΣΙΜΑ (μην τα ξεχάσεις)

- **CHECK 6B (BLOCKING)**: το `DxfRenderer.ts` είναι ADR-040 micro-leaf αρχείο → **πρέπει να γίνει staged το `ADR-040-preview-canvas-performance.md`** (changelog note) στο ίδιο commit, αλλιώς το pre-commit hook μπλοκάρει. (Λειτουργικά: μηδέν επίπτωση στο hot path — το print είναι one-shot offscreen, εκτός bitmap cache.) Πιθανό και CHECK 6D — στάγιαρε ADR-454 doc.
- **Δεν αγγίζεις leaf renderers** — όλα μέσω των 2 chokepoints.
- **N.17 single-tsc**: πριν τρέξεις tsc, έλεγξε ότι δεν τρέχει άλλος (shared PC/agent). ΕΝΑ tsc τη φορά.
- **N.(-1) / shared tree**: ΟΧΙ commit/push (Giorgio το κάνει)· `git add` ΜΟΝΟ δικά σου αρχεία.
- **ADR numbering**: επιβεβαίωσε επόμενο free (ADR-453 πιάστηκε τώρα → **ADR-454**).
- **N.15**: μετά την υλοποίηση → update ADR-454 doc + adr-index + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (1-2 γρ.) + memory pointer.

---

## 6. SLICES

- **0** `print-color-policy.ts` + jest (white→black, monochrome, grayscale luminance).
- **1** Track A: `resolveStyleForRender` color + printDpi lineweight (+ stage ADR-040).
- **2** Track B: singleton στο `bim-line-weight-resolver`.
- **3** capture-2d set/clear + thread effectiveDpi.
- **4** PrintDialog plot-style Select (μόνο 2Δ) + `PrintRequest.plotStyle` + i18n.
- **5** (optional) CTB by-ACI table (`resolveEntityStyle.colorAci` → pen) για AutoCAD-grade fidelity.

---

## 7. VERIFICATION

- jest: `npx jest --testPathPatterns="src/subapps/dxf-viewer/print/__tests__"` (νέα: print-color-policy).
- Browser `/dxf/viewer`: φόρτωσε σχέδιο με λευκές γραμμές → Ανάλυση → «Εκτύπωση» → plot style «Μονόχρωμη»/«Έγχρωμη» → Save PDF → οι γραμμές **ορατές μαύρες σε λευκό**, σωστά ISO πάχη ανά κλίμακα. Σύγκρινε 1:50 vs 1:100 (πιο χοντρές στο 1:50).
- tsc (background, N.17).

## 8. ΓΝΩΣΗ ΥΠΟΒΑΘΡΟΥ
- ADR-453 doc: `docs/centralized-systems/reference/adrs/ADR-453-dxf-print-export-engine.md`
- ADR-375 (pen table): `config/bim-pen-table.ts`, `bim-pen-sets.ts`, `config/lineweight-iso-catalog.ts` (`lineweightToPx`), `state/bim-pen-table-store.ts`
- ADR-040: `docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md`
- Memory pointer: `project_adr453_print_export_engine` · `[[reference_2d_dxf_pipeline_bim_entity]]`

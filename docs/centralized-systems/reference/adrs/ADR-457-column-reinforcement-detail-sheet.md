# ADR-457 — Column Reinforcement Detail Sheet (Φύλλο Σχεδίου Οπλισμού Κολώνας)

**Status:** 🟢 Slice 0 (shell) + Slice 1 (PLAN) + Slice 2 (ELEVATION) IMPLEMENTED & browser-verified 2026-06-14 — UNCOMMITTED (🔴 commit). Slices 3-6 PENDING.
**Discipline:** Δομοστατικά / Structural Engineering — Construction Documentation
**Scope:** Όταν επιλέγεται **ορθογωνική RC κολώνα με οπλισμό** → εντολή «Λεπτομέρεια Οπλισμού» στο contextual tab ανοίγει **παράθυρο προεπισκόπησης** = ένα **φύλλο σχεδίου τύπου PDF** (Revit/Tekla-grade) με τον οπλισμό σε **5 ενότητες** + πλήρη διαστασιολόγηση. v1: ορθογωνική κολώνα· circular/πολυγωνικές → DEFER.

---

## 1. Context & Goal

Επέκταση του δομοστατικού σχεδιασμού (ADR-456 ποσότητες & οπλισμός) με **τεκμηρίωση κατασκευής**: ένα ξεχωριστό φύλλο σχεδίου που δείχνει **αποκλειστικά τον οπλισμό** της επιλεγμένης κολώνας, έτοιμο για εκτύπωση/PDF, όπως τα reinforcement detail sheets του Revit/Tekla.

**Διάταξη 5 ενοτήτων — 3 στήλες** (αίτημα Giorgio, browser-verify 2026-06-14):

```
┌──────────────────┬──────────────────┬──────────────────┐
│ (2) ΟΨΗ          │                  │ (4) ΣΤΟΙΧΕΙΑ     │
│   (αρ-πάνω)      │  (3) 3Δ          │     ΟΠΛΙΣΜΟΥ     │
│   στεφάνια/τύπος │  ΠΡΟΟΠΤΙΚΟ        │   (δεξ-πάνω)     │
├──────────────────┤  (κέντρο,        ├──────────────────┤
│ (1) ΚΑΤΟΨΗ       │   full-height —  │ (5) ΣΤΟΙΧΕΙΑ     │
│   (αρ-κάτω)      │   κύριο visual)  │     ΣΧΕΔΙΟΥ      │
│   footprint+dims │                  │   (δεξ-κάτω)     │
└──────────────────┴──────────────────┴──────────────────┘
```

Αριστερή στήλη = ΟΨΗ/ΚΑΤΟΨΗ· μεσαία = 3Δ προοπτικό (full-height, κύριο visual)· δεξιά = schedule/title-block.

---

## 2. Decision — Κεντρική αρχή SSoT: «ΕΝΑ drawing-model → ΔΥΟ backends»

Ένα **καθαρό (pure) Drawing Model** του φύλλου σε **sheet-mm** (γραμμές, πολυγραμμές, κύκλοι, διαστάσεις, κείμενα, raster-slots) παράγεται ΕΝΑ φορά από τον υπάρχοντα **rebar SSoT** (ADR-456). Μετά:

- **Backend A — Canvas** → live preview μέσα στο dialog (WYSIWYG).
- **Backend B — jsPDF** → export/print (το **ΙΔΙΟ** model).

Έτσι **preview === PDF** (καμία απόκλιση) — και καλύπτεται το live-preview που το print engine (ADR-453) άφησε DEFER.

**Επαναχρήση (geometry-is-SSoT, ΔΕΝ ξαναγράφεται):**
- Γεωμετρία οπλισμού → `computeColumnRebarLayout`, `computeStirrupLevelsMm`, `buildStirrupHookEndsMm` (ADR-456).
- Ποσότητες/labels → `computeColumnReinforcementQuantities`, `format*Label`, `computeColumnConfinement`.
- 2Δ rebar κάτοψης → `drawColumnRebar2D` (custom `worldToScreen` που μαπάρει LOCAL-mm → region pixels).
- 3Δ cage → `buildColumnRebarCage` + offscreen WebGL (template `print/capture/capture-3d.ts`).
- PDF → `registerGreekFont`, `drawTitleBlock`, `print/config/paper-math`, `triggerExportDownload`/`openBlobInNewTab`, `buildPrintFilename`.
- Dialog/Host → pattern `PsetEditorHost`/`PrintHost` + `DxfViewerDialogs` lazy mount + EventBus.

---

## 3. Architecture

Νέο pure domain module: `src/subapps/dxf-viewer/bim/structural/detail-sheet/`

```
detail-sheet/
  detail-sheet-types.ts        # DetailSheetModel, SheetRegion, DetailPrimitive (line/polyline/circle/dim/text/raster), DimPrimitive, RectMm (reuse print), DetailSheetLabels
  detail-sheet-layout.ts       # paper+margins → 5 region rects (A3 landscape· left col=elevation/plan· right col=schedule/perspective/title-block)
  column-detail-sheet.ts       # orchestrator: input → DetailSheetModel (Slice 0: regions με titles, κενά primitives)
  detail-sheet-dim.ts          # [Slice 1+] λιτό SSoT dim primitive (ext lines + θέσεις βελών + text), sheet-mm
  column-detail-plan.ts        # [Slice 1] PLAN model
  column-detail-elevation.ts   # [Slice 2] ELEVATION model (στεφάνια ανά τύπο)
  column-detail-schedule.ts    # [Slice 4] rebar schedule model
  column-detail-titleblock.ts  # [Slice 4] title-block content
  render/
    detail-canvas-renderer.ts  # DetailSheetModel → CanvasRenderingContext2D (preview)
    detail-pdf-renderer.ts     # [Slice 5] DetailSheetModel → jsPDF (export Blob)
    column-detail-3d-capture.ts# [Slice 3] mini offscreen WebGL → PNG dataURL
  __tests__/                   # jest σε layout (+builders/dim στα επόμενα slices)
```

UI: `src/subapps/dxf-viewer/ui/components/column-detail/`
- `ColumnDetailDialog.tsx` — Radix Dialog· `<canvas>` preview (scale-to-fit) + κουμπιά Εξαγωγή PDF/Εκτύπωση (Slice 5).
- `ColumnDetailHost.tsx` — EventBus `bim:column-detail-requested` → resolve column → build model → render dialog (mirror `PsetEditorHost`).

**Coordinate convention:** sheet-mm, origin top-left, +y προς τα κάτω — ίδιο με Canvas2D ΚΑΙ jsPDF (μηδέν axis flip μεταξύ backends).

**Wiring (μικρά edits):**
- `column-command-keys.ts`: `COLUMN_RIBBON_KEYS_ACTIONS.reinforcementDetail = 'column.actions.reinforcementDetail'`.
- `contextual-column-tab.ts`: νέο panel `column-detail` (large button), `visibilityKey = structural` (μόνο RC).
- `useRibbonColumnBridge.ts onAction`: emit `bim:column-detail-requested { columnId, levelId }`.
- `drawing-event-map-bim.ts`: +event type.
- `RibbonButtonIcon.tsx`: +icon case `column-reinforcement-detail` (lucide `Ruler`).
- `dxf-viewer-lazy-components.tsx` + `DxfViewerDialogs.tsx`: lazy mount `ColumnDetailHost`.
- i18n `el`+`en` `dxf-viewer-shell.json`: `ribbon.commands.columnEditor.reinforcementDetail(+Tooltip)` · `ribbon.panels.columnDetail` · top-level `columnDetail.*` (titles/buttons/regions).

---

## 4. ADR-040 safety

Το φύλλο σχεδιάζεται **offscreen / μέσα στο dialog** → **ΔΕΝ** αγγίζει τον live `DxfRenderer`/CanvasSection/leaves. Επαναχρησιμοποιεί `drawColumnRebar2D` (το αρχείο **δεν** αλλάζει) → κανένα ADR-040 αρχείο, CHECK 6B/6C/6D δεν σκάνε.

---

## 5. Slices

| Slice | Περιεχόμενο | Status |
|---|---|---|
| **0** | Plumbing & preview shell: types + layout (5 rects) + Host/Dialog (καμβάς με 5 πλαίσια+τίτλους) + ribbon command + bridge emit + EventBus + icon + i18n + lazy mount | 🟢 IMPLEMENTED 2026-06-14 (6 jest) |
| **1** | Κάτοψη (1): `column-detail-plan` (footprint + rebar από `computeColumnRebarLayout` geometry-SSoT → primitives στο model) + `detail-sheet-dim` (ext lines+βέλη+text) + διαστάσεις πλάτος/βάθος/cover + caption κλίμακας (anisotropic fit, 1:5…1:50) | 🟢 IMPLEMENTED & verified 2026-06-14 (15 jest) |
| **2** | Όψη (2): `column-detail-elevation` (περίγραμμα + κατακόρυφες διαμήκεις + στεφάνια **ανά τύπο** hooked/welded/spiral στις στάθμες `computeStirrupLevelsMm` με πύκνωση lcr + height dim + label βήματος) + shared `detail-sheet-fit` (scale SSoT) | 🟢 IMPLEMENTED & verified 2026-06-14 (20 jest) |
| **3** | 3Δ (3): `column-detail-3d-capture` (offscreen WebGL cage) → raster region | ⏳ pending |
| **4** | Schedule (5) + Title block (4): `column-detail-schedule` + `column-detail-titleblock` | ⏳ pending |
| **5** | PDF export/print: `detail-pdf-renderer` (ΙΔΙΟ model → jsPDF) + κουμπιά dialog (reuse output routing) + plot-style mono | ⏳ pending |
| **6** | Polish: chained dims, κλίμακες ανά view, jest στους pure builders, tsc | ⏳ pending |

---

## 6. Changelog

- **2026-06-14 — Slice 2 (ELEVATION view), Opus 4.8.** NEW `column-detail-elevation.ts` (`buildColumnElevationRegion` — faint w×height outline + longitudinal bars as vertical lines at the distinct SSoT bar x-positions + transverse reinforcement **by stirrup type** at the `computeStirrupLevelsMm` levels [closed-hooked = horizontal + 135° end hooks· closed-welded = clean horizontal· spiral = one continuous zig-zag helix]· lcr densification emerges from the levels· overall height dim + `formatStirrupsLabel` caption). Boy-scout: extracted shared scale SSoT `detail-sheet-fit.ts` (`pickScaleDenominator` + `DETAIL_SCALE_DENOMINATORS` [5…100, anisotropic both-axes fit]) — plan refactored to use it. Orchestrator fills the elevation region. **+5 jest** (20 total) GREEN· tsc clean (στα δικά μου). Browser-verified: όψη με στεφάνια+πύκνωση lcr+διαμήκεις+ύψος, αλλάζει με τον τύπο συνδετήρα, γεμίζει το πλαίσιο (1:30). ADR-040-safe.
- **2026-06-14 — Slice 1 (PLAN view), Opus 4.8.** NEW `detail-sheet-dim.ts` (`resolveDimGeometry` — λιτό SSoT linear dim: extension lines + dim line + 2 filled arrowheads + rotation-corrected text, sheet-mm· self-contained, ΟΧΙ coupling στο live `DimensionRenderer`). NEW `column-detail-plan.ts` (`buildColumnPlanRegion` — faint footprint από `materializeColumnLocalPolygonMm` + rebar από `computeColumnRebarLayout` [stirrup ring `stirrupPathMm` + 135° hooks `stirrupHookEndsMm` + longitudinal dots] **geometry-is-SSoT, ίδιο με live 2Δ/3Δ**, LOCAL-mm → sheet-mm fit transform· un-rotated orthographic plan· διαστάσεις width/depth/cover· caption `1:N` με **anisotropic** scale-fit σε standard detail κλίμακες [5/10/15/20/25/50/100]). `detail-canvas-renderer` επεκτάθηκε: per-region clip + `renderPrimitive` switch (line/polyline/circle/text/dim/raster) + dim rendering μέσω `resolveDimGeometry` + scale caption. Orchestrator `buildColumnDetailSheet` δέχεται `params: ColumnParams` → γεμίζει το plan region. Host re-resolves την κολώνα στο `useMemo` (geometry-is-SSoT). **+9 jest** (4 dim + 5 plan· 15 σύνολο) GREEN· tsc clean (στα δικά μου). Browser-verified: κάτοψη με οπλισμό+διαστάσεις γεμίζει το πλαίσιο (1:10). ADR-040-safe (offscreen).
- **2026-06-14 — Slice 0 layout fix (3-column + canvas sizing), Opus 4.8.** Browser-verify #1: το παράθυρο άνοιγε αλλά ο καμβάς ζωγραφιζόταν συρρικνωμένος (`w-full` σε μικρό dialog) → αόρατα πλαίσια. FIX: dialog `size="fullscreen"` + canvas intrinsic μέγεθος υπολογισμένο από **viewport** (`window.innerWidth/innerHeight`, μηδέν DOM-measurement → δεν early-returns στο open-animation commit) + ανεβασμένα line weights. Browser-verify #2 (Giorgio): αλλαγή διάταξης **2→3 στήλες** — αριστερή ΟΨΗ/ΚΑΤΟΨΗ· **μεσαία 3Δ προοπτικό full-height** (κύριο visual)· δεξιά schedule/title-block. `computeDetailSheetLayout` ξαναγράφτηκε (3 cols/2 gutters· LEFT/CENTRE/RIGHT = 0.30/0.40/0.30· right schedule/title = 0.62/0.38). 6 jest επικαιροποιημένα GREEN. Live-verified: 5 πλαίσια+τίτλοι ορατά στη σωστή θέση.
- **2026-06-14 — Slice 0 (plumbing & preview shell), Opus 4.8.** NEW pure domain: `detail-sheet-types.ts` (DetailSheetModel + discriminated DetailPrimitive union, sheet-mm), `detail-sheet-layout.ts` (`computeDetailSheetLayout` — A3 landscape· 52/48 column split· left=elevation/plan· right=schedule/perspective/title-block· margins+gutters reuse print paper-math), `column-detail-sheet.ts` (`buildColumnDetailSheet` orchestrator — Slice 0 regions με injected i18n titles + κενά primitives), `render/detail-canvas-renderer.ts` (`renderDetailSheet` — page+region frames+headings). NEW UI: `ColumnDetailDialog` (Radix· canvas scale-to-fit· dpr-aware· disabled export/print placeholders Slice 5), `ColumnDetailHost` (EventBus `bim:column-detail-requested` → resolve column → build model). Wiring: command key `reinforcementDetail`, contextual panel `column-detail` (large button, RC-gated), bridge emit, event-map type, icon `column-reinforcement-detail` (Ruler), lazy mount, i18n el+en. **6 jest GREEN** (layout geometry). ADR-040-safe (offscreen· μηδέν live-renderer αλλαγή). 🔴 browser-verify (επίλεξε RC κολώνα → «Λεπτομέρεια Οπλισμού» → ανοίγει παράθυρο με 5 πλαίσια+τίτλους) + commit.

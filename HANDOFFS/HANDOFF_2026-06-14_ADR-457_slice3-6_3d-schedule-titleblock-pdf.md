# HANDOFF — ADR-457 Slices 3-6: 3Δ κλωβός + Schedule + Title Block + PDF export

**Ημερομηνία:** 2026-06-14
**ADR:** **ADR-457** — Column Reinforcement Detail Sheet (φύλλο σχεδίου οπλισμού κολώνας, Revit/Tekla-grade)
**Μοντέλο:** Opus (cross-cutting: offscreen WebGL + structural compute + jsPDF + UI)
**Κατάσταση:** 🟢 **Slices 0+1+2 DONE & browser-verified & UNCOMMITTED** (20 jest GREEN, tsc clean στα δικά μου). Μένουν **Slices 3-6**.

---

## 🚨 ΚΡΙΣΙΜΟΙ ΚΑΝΟΝΕΣ (διάβασε ΠΡΩΤΑ)
1. **Γλώσσα:** Απαντάς ΠΑΝΤΑ **Ελληνικά** στον Giorgio.
2. **COMMIT/PUSH:** τα κάνει **Ο GIORGIO**, ΟΧΙ εσύ (CLAUDE.md N.(-1)). Ποτέ `--no-verify`.
3. **Shared working tree:** δουλεύει ΚΑΙ άλλος agent → `git add` **ΜΟΝΟ τα δικά σου** αρχεία, **ΠΟΤΕ** `-A`.
4. **FULL ENTERPRISE + FULL SSOT, Revit-grade.** Καμία πρόχειρη λύση.
5. **N.2/N.3/N.11:** ΟΧΙ `any`/`as any`/`@ts-ignore`· ΟΧΙ inline styles (JSX `style={{}}`)· ΟΧΙ hardcoded Greek/English strings (i18n keys σε `el` **&** `en` ΠΡΩΤΑ· δεδομένα όπως «4Ø16» δεν είναι i18n).
6. **N.7.1:** code files ≤500 γρ, functions ≤40 γρ. Types/config/data files χωρίς όριο.
7. **N.17 single tsc:** process-check ΠΡΙΝ, ένα tsc τη φορά, background.
8. **ADR-040:** το φύλλο ζωγραφίζεται **offscreen / μέσα στο dialog** → ΜΗΝ αγγίξεις `DxfRenderer.ts`/CanvasSection/leaves. Κανένα ADR-040 stage (CHECK 6B/6C/6D δεν σκάνε).
9. **ADR-driven (N.0.1):** Phase 1 Recognition (επαλήθευσε τα reuse points παρακάτω στον τρέχοντα κώδικα) → plan ανά slice → **έγκριση Giorgio ΠΡΙΝ κώδικα** → υλοποίηση → ADR-457 + adr-index + ΕΚΚΡΕΜΟΤΗΤΕΣ + MEMORY στο ίδιο commit.
10. **Δούλεψε σε SLICES**, ζήτα browser-verify (screenshot) μετά από κάθε slice.

---

## 1. ΚΕΝΤΡΙΚΗ ΑΡΧΗ (ΜΗΝ ΤΗΝ ΠΑΡΑΒΕΙΣ) — «ΕΝΑ drawing-model → ΔΥΟ backends»

Υπάρχει ΕΝΑ pure **`DetailSheetModel`** (γεωμετρία σε **sheet-mm**, origin top-left, +y κάτω) που το παράγει ΕΝΑ orchestrator από τον **rebar geometry SSoT** (ADR-456). Δύο backends το καταναλώνουν:
- **Backend A — Canvas** (`render/detail-canvas-renderer.ts`) → live preview στο dialog. **DONE.**
- **Backend B — jsPDF** (`render/detail-pdf-renderer.ts`) → export/print. **Slice 5 — TODO.**

➡️ **ΟΛΟ το περιεχόμενο κάθε ενότητας μπαίνει ως `DetailPrimitive`s στο model** (line/polyline/circle/text/dim/raster). **ΠΟΤΕ** δεν ζωγραφίζεις απευθείας στο ctx παρακάμπτοντας το model — αλλιώς σπας το **preview===PDF**. (Γι' αυτό ΔΕΝ χρησιμοποιήθηκε το `drawColumnRebar2D` αυτούσιο — αναπαράχθηκε ως primitives από το ΙΔΙΟ geometry SSoT.)

**geometry-is-SSoT:** όλη η γεωμετρία οπλισμού έρχεται από `computeColumnRebarLayout` / `computeStirrupLevelsMm` / `buildColumnRebarCage` — **ΜΗΝ** ξαναγράψεις γεωμετρία.

**Μονάδες:** `ColumnParams.width/depth/height` είναι **σε mm**. Το detail σχεδιάζει την κολώνα **un-rotated / orthographic** (αγνοεί rotation/anchor — Revit convention).

---

## 2. ΤΙ ΥΠΑΡΧΕΙ ΗΔΗ (Slices 0-2 DONE) — module `src/subapps/dxf-viewer/bim/structural/detail-sheet/`

| Αρχείο (NEW) | Exports / ρόλος |
|---|---|
| `detail-sheet-types.ts` | `DetailSheetModel{paper,sheetWidthMm,sheetHeightMm,regions[]}`, `SheetRegion{id,rectMm,title,caption?,primitives[]}`, `DetailPrimitive` = union **line/polyline/circle/text/dim/raster**, `DimPrimitive{p1,p2,offsetMm,text,stroke,textHeightMm?}`, `RasterPrimitive{rect,dataUrl:string|null}`, `TextPrimitive{position,text,heightMm,colorHex,align,bold?}`, `SheetStroke{colorHex,widthMm,dashMm?}`, `RectMm` (re-export from print), `DetailSheetLabels`, `SheetRegionId='plan'\|'elevation'\|'perspective'\|'schedule'\|'title-block'` |
| `detail-sheet-layout.ts` | `computeDetailSheetLayout(input)`→`{sheetWidthMm,sheetHeightMm,regions:Record<SheetRegionId,RectMm>}`. **3-COLUMN layout**: αριστερά elevation(πάνω)/plan(κάτω)· μέση **perspective full-height**· δεξιά schedule(πάνω)/title-block(κάτω). `DEFAULT_DETAIL_SHEET_LAYOUT_INPUT`, `DETAIL_SHEET_PAPER`(A3 landscape), `DETAIL_SHEET_MARGIN_MM`(10), `DETAIL_SHEET_GUTTER_MM`(6) |
| `detail-sheet-fit.ts` | `pickScaleDenominator(fpW,fpH,availW,availH)`→denom (anisotropic both-axes fit), `DETAIL_SCALE_DENOMINATORS`=[5,10,15,20,25,30,40,50,75,100]. **SSoT scale — χρησιμοποίησέ το για schedule/3D captions.** |
| `detail-sheet-dim.ts` | `resolveDimGeometry(dim)`→`{extensionLines,dimensionLine,arrowheads[3pt],textPosition,textAngleRad,textHeightMm,text}` (sheet-mm, rotation-corrected). **SSoT linear dim — reuse για κάθε διάσταση.** |
| `column-detail-plan.ts` | `buildColumnPlanRegion(params,region)`→`{primitives,caption}`. ΚΑΤΟΨΗ. **DONE.** |
| `column-detail-elevation.ts` | `buildColumnElevationRegion(params,region)`→`{primitives,caption}`. ΟΨΗ (στεφάνια ανά τύπο). **DONE.** |
| `column-detail-sheet.ts` | `buildColumnDetailSheet(input:{params:ColumnParams,labels:DetailSheetLabels,layoutInput?})`→`DetailSheetModel`. **Orchestrator — εδώ προσθέτεις τα νέα regions (schedule/title-block/perspective).** |
| `render/detail-canvas-renderer.ts` | `renderDetailSheet(ctx,model,{pxPerMm})`. `renderPrimitive` switch (line/polyline/circle/text/dim/raster). ⚠️ **`raster` case = ΤΩΡΑ no-op stub** → υλοποίησέ το στο Slice 3 (drawImage). |
| `__tests__/*` | 4 suites, **20 jest** (layout/dim/plan/elevation) |

| Αρχείο (NEW UI) | ρόλος |
|---|---|
| `ui/components/column-detail/ColumnDetailDialog.tsx` | Radix Dialog `size="fullscreen"`. Canvas **sized από viewport** (`window.innerWidth*0.9 × innerHeight*0.74`, **ΟΧΙ** DOM measurement — clientHeight=0 στο open-animation!). `requestAnimationFrame`+resize listener. Κουμπιά «Εξαγωγή PDF»/«Εκτύπωση» = **disabled** (ενεργοποίηση Slice 5). |
| `ui/components/column-detail/ColumnDetailHost.tsx` | EventBus `bim:column-detail-requested{columnId,levelId}` → re-resolve column στο `useMemo` (geometry-is-SSoT) → `buildColumnDetailSheet({params,labels})` → `<ColumnDetailDialog>`. **Εδώ θα προστεθεί το async 3D state (Slice 3).** |

**MOD (Slice 0 — μικρά, shared-tree):** `ui/ribbon/hooks/bridge/column-command-keys.ts`(+`reinforcementDetail`)· `ui/ribbon/data/contextual-column-tab.ts`(+panel `column-detail`, large button, RC-gated)· `ui/ribbon/hooks/useRibbonColumnBridge.ts`(+emit)· `systems/events/drawing-event-map-bim.ts`(+`'bim:column-detail-requested':{columnId,levelId}`)· `ui/ribbon/components/buttons/RibbonButtonIcon.tsx`(+icon `column-reinforcement-detail`=lucide `Ruler`)· `app/dxf-viewer-lazy-components.tsx`(+`ColumnDetailHost` lazy)· `app/DxfViewerDialogs.tsx`(+`<ColumnDetailHost levelManager={levelManager}/>`)· `src/i18n/locales/{el,en}/dxf-viewer-shell.json`(+`ribbon.commands.columnEditor.reinforcementDetail`(+Tooltip)·`ribbon.panels.columnDetail`·top-level `columnDetail.*`).

**Αισθητικές αρχές που τηρήθηκαν:** αχνό περίγραμμα σκυροδέματος `#b0b0b0`· οπλισμός crimson `#c0392b`· διαστάσεις `#333`· anisotropic scale-fit ώστε κάθε view να γεμίζει το πλαίσιό του· caption `1:N` κάτω-δεξιά.

---

## 3. ΤΙ ΜΕΝΕΙ — Slices 3-6

### 🔷 Slice 3 — 3Δ προοπτικό (μεσαία στήλη, region `perspective`, full-height)
**Στόχος:** περίγραμμα κολώνας (αχνό) + κλωβός οπλισμού σε προοπτική, ως **raster** στο μεσαίο region.

**Reuse (Phase 1 — επαλήθευσε signatures):**
- `bim-3d/converters/column-rebar-3d.ts` → `buildColumnRebarCage(column: ColumnEntity, baseY: number, heightMm: number, levelId?: string): THREE.Group | null` (διαμήκεις κύλινδροι + δαχτυλίδια· InstancedMesh).
- `print/capture/capture-3d.ts` → **template** για offscreen WebGL: `new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,alpha:false})` → setSize → render → `toDataURL('image/png')` → `finally{ renderer.dispose() }`.
- `bim/geometry/column-geometry.ts` → `computeColumnGeometry(params)` (footprint/height) για το αχνό box.

**ΝΕΟ:** `render/column-detail-3d-capture.ts` → `captureColumnDetail3d(column, opts): Promise<string|null>` (data URL). Στήνει **ΔΙΚΗ mini-scene** (ΟΧΙ live): PerspectiveCamera (~ισομετρική γωνία προς το κέντρο), ambient+directional φως, αχνό ημιδιαφανές/wireframe `BoxGeometry(width,height,depth)` + `buildColumnRebarCage(...)`, render → PNG, dispose.

**⚠️ ΚΡΙΣΙΜΟ — async flow (το δυσκολότερο σημείο):** το model build είναι **sync**, το 3D capture **async**. Καθαρή λύση (FULL SSOT):
1. `buildColumnDetailSheet` δέχεται **optional** `perspectiveDataUrl?: string` → βάζει `RasterPrimitive{rect:perspectiveRegion, dataUrl}` στο perspective region (μέσω νέου `column-detail-perspective.ts` builder ή inline).
2. `ColumnDetailHost`: state `perspectiveDataUrl` (αρχικά `null`). Όταν ανοίγει → `useEffect` async: `captureColumnDetail3d(entity,...)` → `setPerspectiveDataUrl(url)`. Το `useMemo` model ξαναχτίζεται με το url → canvas re-render.
3. `detail-canvas-renderer` **raster case**: φόρτωσε `new Image()`, `img.onload → ctx.drawImage` στο `prim.rect` (px). ⚠️ Image load είναι **async** → ο renderer πρέπει είτε να δεχτεί προ-φορτωμένα images, είτε ο Dialog να ξανα-καλεί `draw()` στο `img.onload`. **Καθαρότερο:** ο Dialog προ-φορτώνει τα raster images (Promise.all) ΠΡΙΝ καλέσει `renderDetailSheet`, και τα περνά. Σχεδίασέ το ρητά στο plan.
- Το ΙΔΙΟ dataUrl χρησιμοποιείται και στο PDF (Slice 5: `pdf.addImage`) → preview===PDF.

### 🔷 Slice 4 — Schedule (5, δεξ-πάνω) + Title block (4, δεξ-κάτω)
**Reuse:**
- `bim/structural/reinforcement/column-reinforcement-compute.ts` → `computeColumnReinforcementQuantities(ctx: ColumnSectionContext, r): {longitudinalLengthM,longitudinalWeightKg,stirrupCount,stirrupSingleLengthM,stirrupTotalLengthM,stirrupWeightKg,totalSteelWeightKg,ratio}` + `formatLongitudinalLabel(r)`→«4Ø16» + `formatStirrupsLabel(r)`→«Ø8/100-200».
- ⚠️ `ColumnSectionContext` εξάγεται από **`bim/structural/codes/structural-code-types.ts`** (ΟΧΙ από compute)· = `{widthMm,depthMm,heightMm,grossAreaMm2}` (επαλήθευσε grossAreaMm2 = width*depth).
- `bim/structural/reinforcement/column-confinement.ts` → `computeColumnConfinement(ctx,r): {alphaN,alphaS,alpha,ductilityWarning}` (περίσφιγξη α).
- `bim/structural/concrete-grades.ts` → `CONCRETE_GRADES`, `concreteWeightKg`, `DEFAULT_CONCRETE_GRADE='C25/30'`. Grade από `params.concreteGrade ?? DEFAULT`.
- Κανονισμός (building-level): `useStructuralSettingsStore` → `codeId` (το Host το διαβάζει και το περνά ως label).
- Project/column name: από `levelManager.levels` (βλ. `PrintHost.tsx` projectName pattern).

**ΝΕΟ:** `column-detail-schedule.ts` → `buildColumnScheduleRegion(params,region,labels)` και `column-detail-titleblock.ts` → `buildColumnTitleBlockRegion(input,region,labels)`. **ΟΛΑ ως text+line primitives στο model** (πίνακας = grid από `line` + `text`· title block = `text` rows). ⚠️ **ΜΗΝ** χρησιμοποιήσεις το `print/assemble/title-block-renderer.ts drawTitleBlock` (είναι jsPDF-only → θα έσπαγε το preview===PDF). Φτιάξε primitives.
- Schedule στήλες (Revit/Tekla): **Σύμβολο | Ø | Πλήθος | Μήκος(m) | Βάρος(kg)** — γραμμή ανά είδος (διαμήκης/συνδετήρας) + σύνολο χάλυβα + ρ% + α (περίσφιγξη).
- Title block: Έργο · Κωδικός/όνομα κολώνας · Κλίμακα · Ημερομηνία · Κατηγορία σκυρ. · Κανονισμός.
- **i18n:** headers/labels του schedule & title-block → νέα keys σε `el`+`en` `dxf-viewer-shell.json` namespace `columnDetail.schedule.*` / `columnDetail.titleBlock.*`. Τα labels τα περνά ο Host (resolved) στον orchestrator (N.11-safe, όπως τα region titles).

### 🔷 Slice 5 — PDF export / print (preview===PDF)
**ΝΕΟ:** `render/detail-pdf-renderer.ts` → `renderDetailSheetPdf(model): Promise<Blob>`. jsPDF δουλεύει **σε mm** → τα primitives είναι ήδη sheet-mm → **1:1 mapping** (pdf.line/rect/circle/triangle/text, dim μέσω **ΙΔΙΟΥ** `resolveDimGeometry`, raster μέσω `pdf.addImage`).
**Reuse:** `@/services/pdf/greek-font-loader`→`registerGreekFont(pdf)` (ΠΡΙΝ Ελληνικά)· `print/config/paper-math.ts` (resolvePaperDimensionsMm)· `@/lib/exports/trigger-export-download`→`triggerExportDownload({blob,filename})` / `openBlobInNewTab(blob,{onLoad:w=>w.print()})`· `buildPrintFilename` (print barrel).
**UI:** ενεργοποίησε τα κουμπιά «Εξαγωγή PDF»(→triggerExportDownload) / «Εκτύπωση»(→openBlobInNewTab+print) στο `ColumnDetailDialog` (περνά το `model` ως prop ή callback). ADR-454 plot-style mono = optional/DEFER (τα χρώματα είναι ήδη σχεδιαστικά).

### 🔷 Slice 6 — Polish & tests
Chained dims (αποστάσεις διαμήκων/spacings), κλίμακες captions έλεγχος, jest στους νέους builders (schedule/title-block/3D-input), tsc final.

---

## 4. git add — ΑΝΑΜΕΝΟΜΕΝΑ ΑΡΧΕΙΑ (ΜΟΝΟ δικά σου· shared-tree → ΠΟΤΕ `-A`)
**Slices 0-2 (ήδη γραμμένα, UNCOMMITTED — ο Giorgio θα τα κάνει commit):** όλο το `bim/structural/detail-sheet/**` + `ui/components/column-detail/{ColumnDetailDialog,ColumnDetailHost}.tsx` + τα MOD §2 + ADR-457/adr-index/ΕΚΚΡΕΜΟΤΗΤΕΣ.
**Slices 3-6 (νέα):** `bim/structural/detail-sheet/{column-detail-perspective,column-detail-schedule,column-detail-titleblock}.ts` + `render/{column-detail-3d-capture,detail-pdf-renderer}.ts` + `__tests__/*` + MOD `column-detail-sheet.ts`/`detail-canvas-renderer.ts`(raster)/`ColumnDetailDialog.tsx`(buttons)/`ColumnDetailHost.tsx`(3D async)/i18n.
⚠️ **ΟΧΙ** `DxfRenderer.ts` ή άλλα ADR-040 αρχεία. Πρόσεχε conflicts σε shared (locales/adr-index/DxfViewerDialogs/RibbonButtonIcon).

---

## 5. VERIFY (browser) ανά slice
`/dxf/viewer` → επίλεξε ορθογ. RC κολώνα με οπλισμό (Auto οπλισμός αν χρειάζεται) → contextual tab «Ιδιότητες Κολώνας» → panel «Λεπτομέρειες» → «Λεπτομέρεια Οπλισμού» → fullscreen παράθυρο.
- **Slice 3:** μεσαίο πλαίσιο «3Δ ΠΡΟΟΠΤΙΚΟ» δείχνει κλωβό+περίγραμμα σε προοπτική.
- **Slice 4:** πάνω-δεξιά πίνακας χάλυβα (Ø/πλήθος/μήκη/βάρη/ρ/α)· κάτω-δεξιά title block.
- **Slice 5:** «Εξαγωγή PDF» → **ΙΔΙΟ** φύλλο σε PDF (preview===PDF), Ελληνικά σωστά (Roboto).
Άλλαξε διαστάσεις/οπλισμό/τύπο συνδετήρα → ξανα-άνοιξε → ενημερωμένο (geometry-is-SSoT).

---

## 6. ΜΑΘΗΜΑΤΑ από Slices 0-2 (μην τα ξαναβρείς με τον δύσκολο τρόπο)
1. **Canvas sizing:** ΜΗΝ βασίζεσαι σε `container.clientWidth/Height` — επιστρέφει **0** στο dialog open-animation commit → κενός καμβάς. Χρησιμοποίησε **viewport** (`window.innerWidth/innerHeight`).
2. **primitives-in-model**, ΠΟΤΕ άμεση ctx σχεδίαση → αλλιώς σπας preview===PDF.
3. **geometry-is-SSoT:** reuse `computeColumnRebarLayout`/`computeStirrupLevelsMm`/`buildColumnRebarCage`. `ColumnParams.width/depth/height` = **mm**.
4. **Layout = 3 στήλες** (όχι 2 — ο Giorgio το ζήτησε ρητά): αρ ΟΨΗ/ΚΑΤΟΨΗ· μέση 3Δ full-height· δεξ schedule/title-block.
5. **i18n:** region/schedule/title-block labels = resolved strings που περνά ο Host (όχι i18n keys μέσα στους pure builders). Δεδομένα (4Ø16, 3000) = ΟΧΙ i18n.
6. **`title=` σε JSX** → CHECK 3.23 native-tooltip ratchet· απόφυγέ το.
7. **No inline styles** (N.3): canvas sizing imperative μέσω attributes/Tailwind, ΟΧΙ `style={{}}`.

**Memory σχετικά:** `reference_structural_quantities_ssot.md` (ADR-456 rebar SSoT), `reference_bim_dim_labels_ssot.md`, `project_adr453_print_export_engine.md`, `project_adr454_print_plot_style.md`.
**ADR + tracker:** `docs/centralized-systems/reference/adrs/ADR-457-...md` (τρέχουσα κατάσταση + changelog) · `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`.

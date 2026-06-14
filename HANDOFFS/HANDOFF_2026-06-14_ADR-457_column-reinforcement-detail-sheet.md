# HANDOFF — ADR-457: Column Reinforcement Detail Sheet (Revit-grade, PDF preview 5-ενοτήτων)

**Ημερομηνία:** 2026-06-14
**ADR (νέο):** **ADR-457** (επόμενο ελεύθερο — ο πιο πρόσφατος είναι ADR-456)
**Μοντέλο:** Opus (cross-cutting: structural-detail domain + offscreen 2Δ/3Δ render + jsPDF + ribbon/UI)
**Στόχος:** Όταν επιλέγεται κολώνα → εντολή στο contextual tab «Ιδιότητες Κολώνας» που ανοίγει **παράθυρο προεπισκόπησης** = ένα **φύλλο σχεδίου τύπου PDF** με τον **οπλισμό** της κολώνας, σε **5 ενότητες**, με **πλήρη διαστασιολόγηση**, Revit/Tekla-grade. **FULL ENTERPRISE + FULL SSOT.**

---

## 🚨 ΚΡΙΣΙΜΟΙ ΚΑΝΟΝΕΣ (διάβασε ΠΡΩΤΑ)
1. **Γλώσσα:** Απαντάς ΠΑΝΤΑ Ελληνικά στον Giorgio.
2. **COMMIT/PUSH:** τα κάνει **Ο GIORGIO**, ΟΧΙ εσύ (CLAUDE.md N.(-1)). Ποτέ `--no-verify`.
3. **Shared working tree:** δουλεύει ΚΑΙ άλλος agent → `git add` **ΜΟΝΟ τα δικά σου** αρχεία, **ΠΟΤΕ** `-A`.
4. **N.8 Execution mode:** η δουλειά είναι **5+ αρχεία / 2+ domains** → ΕΝΗΜΕΡΩΣΕ τον Giorgio (Plan Mode ανά slice ή Orchestrator με έγκριση) ΠΡΙΝ μαζική υλοποίηση. **Δούλεψε σε SLICES** (βλ. §7).
5. **N.7.1 μεγέθη:** code files ≤500 γρ., functions ≤40 γρ. → split. Types/config/data files χωρίς όριο.
6. **N.2 / N.11 / N.3 / N.4:** ΟΧΙ `any`/`as any`/`@ts-ignore`· ΟΧΙ hardcoded strings (i18n keys σε `el` **&** `en` ΠΡΩΤΑ)· ΟΧΙ inline styles· semantic HTML.
7. **N.17 single tsc:** process-check πριν, ένα tsc τη φορά, background.
8. **ADR-driven (N.0.1):** Phase 1 Recognition → plan → έγκριση → υλοποίηση → ADR-457 + adr-index + ΕΚΚΡΕΜΟΤΗΤΕΣ + MEMORY στο ΙΔΙΟ commit.
9. **Make Revit-grade decisions yourself** (memory feedback): πάρε εσύ τις enterprise αποφάσεις, ζήτα μόνο έγκριση plan.

---

## 1. ΤΙ ΖΗΤΑΕΙ Ο GIORGIO (ακριβές spec — 5 ενότητες)

Παράθυρο προεπισκόπησης = **ΕΝΑ φύλλο σχεδίου** (PDF-style) **αποκλειστικά για τον ΟΠΛΙΣΜΟ** της επιλεγμένης κολώνας. Διάταξη:

```
┌─────────────────────────────┬──────────────────────────────┐
│  (2) ΟΨΗ (Elevation)        │                              │
│      πάνω-αριστερά          │   (5) ΣΤΟΙΧΕΙΑ ΟΠΛΙΣΜΟΥ      │
│   - οπλισμός σε όψη         │       πάνω-δεξιά             │
│   - στεφάνια ανά τύπο       │   (rebar schedule: Ø/πλήθος/ │
│     (135° hooks / welded /  │    μήκη/βάρη/ρ/περίσφιγξη)   │
│      spiral)                ├──────────────────────────────┤
│   - αχνό περίγραμμα κολώνας │                              │
│   - πλήρης διαστασιολόγηση  │   (3) 3Δ ΠΡΟΟΠΤΙΚΟ           │
│     (ύψος, ζώνες lcr, βήμα) │       κέντρο/δεξιά           │
├─────────────────────────────┤   - περίγραμμα κολώνας +     │
│  (1) ΚΑΤΟΨΗ (Plan)          │     κλωβός οπλισμού          │
│      κάτω-αριστερά          │   - διαστασιολόγηση          │
│   - οπλισμός σε κάτοψη      ├──────────────────────────────┤
│   - αχνό περίγραμμα κολώνας │   (4) ΣΤΟΙΧΕΙΑ ΣΧΕΔΙΟΥ      │
│   - πλήρης διαστασιολόγηση  │       κάτω-δεξιά             │
│     (πλάτος/βάθος, επικάλ., │   (title block: έργο/κολώνα/ │
│      αποστάσεις σιδήρων,    │    κλίμακα/ημ/grade/κανον.)  │
│      μήκη ανά πλευρά)       │                              │
└─────────────────────────────┴──────────────────────────────┘
```

- **(1) Κάτοψη** (κάτω-αριστερά): κάτοψη οπλισμού + αχνό/απαλό περίγραμμα κολώνας περιμετρικά + **πλήρης διαστασιολόγηση**: πλάτος & βάθος κολώνας, αποστάσεις σιδήρων από τα πλευρικά τοιχώματα (επικάλυψη), μεγέθη/μήκη σιδήρων στις δύο πλευρές, αποστάσεις διαμήκων.
- **(2) Όψη** (πάνω-αριστερά): όψη οπλισμού — φαίνεται ο εγκάρσιος ανάλογα με τον τύπο (στεφάνια συγκολλητά / 135° γωνίες / σπιράλ) + αχνό περίγραμμα + **πλήρης διαστασιολόγηση** (ύψος, ζώνες πύκνωσης lcr, βήμα συνδετήρων).
- **(3) 3Δ προοπτικό** (κέντρο/δεξιά των δύο): περίγραμμα κολώνας + κλωβός οπλισμού σε προοπτική, **με διαστασιολόγηση**.
- **(4) Στοιχεία σχεδίου** (κάτω-δεξιά): title block (όνομα έργου, κωδικός κολώνας, κλίμακα, ημερομηνία, κατηγορία σκυροδέματος, κανονισμός).
- **(5) Στοιχεία σιδηρού οπλισμού** (πάνω-δεξιά): πίνακας — διαμήκης (π.χ. 4Ø16), συνδετήρες (Ø8/100-200, τύπος), μήκη/βάρη χάλυβα, ρ%, περίσφιγξη α.

> Σημ.: ο Giorgio είπε «πάνω-δεξιά όλα τα στοιχεία του σιδερένιου οπλισμού και κάτω-δεξιά τα στοιχεία του σχεδίου». Άρα **(5)=schedule πάνω-δεξιά**, **(4)=title block κάτω-δεξιά**, **(3)=3Δ στο κέντρο/μεταξύ τους**.

---

## 2. PHASE 1 RECOGNITION — ΤΙ ΥΠΑΡΧΕΙ ΗΔΗ (code = source of truth)

> Αυτό το Recognition έγινε ήδη (2026-06-14). Επαλήθευσέ το γρήγορα πριν γράψεις κώδικα, αλλά είναι ακριβές.

### 2.1 Print/Export Engine — ADR-453 / ADR-454 (ΤΟ ΘΕΜΕΛΙΟ ΕΠΑΝΑΧΡΗΣΗΣ)
Module: `src/subapps/dxf-viewer/print/`. **UNCOMMITTED** (Slices 0-5 implemented 2026-06-14).
- **`print/index.ts`** (barrel): `runPrint(request, deps)`, `PrintDeps`, `buildPrintFilename`, όλοι οι τύποι `paper-types`.
- **`print/assemble/pdf-assembler.ts`** → `assemblePrintPdf(input): Promise<Blob>`. **ΠΡΟΣΟΧΗ: single-image** (1 PNG ανά σελίδα + προαιρετικό title block). Για 5-region σχέδιο **χρειάζεται ΝΕΟΣ multi-region renderer** (βλ. §3) — αλλά ΕΠΑΝΑΧΡΗΣΙΜΟΠΟΙΗΣΕ τα μικρά κομμάτια του.
- **`print/assemble/title-block-renderer.ts`** → `drawTitleBlock(pdf, content, area)` (bottom-right stamp, 85mm, Roboto). `title-block-types.ts`: `TitleBlockContent`, `TitleBlockInput`.
- **`print/assemble/pdf-image-layout.ts`** → `computeImagePlacementMm(wPx, hPx, area): RectMm` (aspect-fit).
- **`print/config/paper-constants.ts`**: `EXPORT_DPI=150`, `PREVIEW_DPI=72`, `DEFAULT_PAGE_MARGIN_MM=10`, `MAX_CANVAS_DIMENSION_PX=8192`, `PAPER_SIZES_MM_PORTRAIT` (A4..A0), `PAPER_SIZE_ORDER`, `PRINT_SCALE_DENOMINATORS`.
- **`print/config/paper-math.ts`** (όλα pure): `resolvePaperDimensionsMm`, `mmToPx`, `pxToMm`, `resolvePrintableAreaMm(spec, marginMm): PrintableAreaMm{xMm,yMm,widthMm,heightMm}`, `computePaperRasterPx`, `computeDrawingScaleTransform`.
- **`print/capture/capture-2d.ts`** → `captureCurrent2dView(input): CaptureResult{dataUrl,widthPx,heightPx}` (offscreen DOM canvas + DxfRenderer). `capture-2d-offscreen-canvas.ts` → `createOffscreen2dTarget(w,h)`.
- **`print/capture/capture-3d.ts`** → `captureCurrent3dView(sceneManager, raster): CaptureResult`. **Δημιουργεί ΞΕΧΩΡΙΣΤΟ** `new THREE.WebGLRenderer({preserveDrawingBuffer:true})` (ο live δεν είναι readable), clone κάμερας, `toDataURL('png')`, `dispose()`. **ΑΥΤΟ είναι το template για το 3Δ region.**
- **3Δ scene handle:** `bim-3d/scene/active-scene-manager-registry.ts` → `getActiveSceneManager()`.
- **Greek font:** `@/services/pdf/greek-font-loader` → `registerGreekFont(pdf)` (ΠΡΕΠΕΙ πριν από Ελληνικά στο jsPDF).
- **Output routing:** `@/lib/exports/trigger-export-download` → `triggerExportDownload({blob,filename})`· `openBlobInNewTab(blob,{onLoad:w=>w.print()})`.
- **ADR-454 plot-style:** `config/print-color-policy.ts` → `setPrintColorPolicy({style,dpi})` / `applyPlotColor` / `clearPrintColorPolicy`. White-safe colour/mono/grayscale. Για τεχνικό σχέδιο → προτίμησε `'monochrome'`.
- **Live preview:** ΔΕΝ υπάρχει στο print (DEFER). **Εμείς ΘΑ φτιάξουμε live preview** (βλ. §3 SSoT pattern).
- **Dialog precedent:** `app/PrintHost.tsx` (EventBus `dxf:print-dialog-requested` → Radix `PrintDialog`), lazy-mounted στο `app/DxfViewerDialogs.tsx`.

### 2.2 Contextual tab + command/dialog wiring
- **Ribbon data:** `ui/ribbon/data/contextual-column-tab.ts` → `CONTEXTUAL_COLUMN_TAB` (id `column-editor`, `isContextual:true`, panels). Πρότυπο action button (Auto οπλισμός):
  ```ts
  { type: 'simple', size: 'small', command: {
      id: 'column.structural.auto', labelKey: 'ribbon.commands.columnStructural.auto',
      tooltipKey: 'ribbon.commands.columnStructural.autoTooltip', icon: 'struct-auto-reinforce',
      commandKey: COLUMN_RIBBON_KEYS_ACTIONS.autoReinforce, action: COLUMN_RIBBON_KEYS_ACTIONS.autoReinforce } }
  ```
- **Command keys:** `ui/ribbon/hooks/bridge/column-command-keys.ts` → `COLUMN_RIBBON_KEYS_ACTIONS` (πρόσθεσε `reinforcementDetail: 'column.actions.reinforcementDetail'`).
- **Dispatch chain:** click → `useRibbonCommands.ts onAction` → router → `useRibbonColumnBridge.ts onAction(action)` → εκεί κάνεις `EventBus.emit(...)`. Πρότυπο (Pset editor, ίδιο μοτίβο):
  ```ts
  if (action === COLUMN_RIBBON_KEYS_ACTIONS.reinforcementDetail) {
    const column = resolveColumn();
    if (!column || !levelManager.currentLevelId) return;
    EventBus.emit('bim:column-detail-requested', { columnId: column.id, levelId: levelManager.currentLevelId });
    return;
  }
  ```
- **`resolveColumn()`** (ήδη στο bridge): `universalSelection.getPrimaryId()` → scene.entities.find → `isColumnEntity`.
- **EventBus types:** `systems/events/drawing-event-map-bim.ts` → πρόσθεσε `'bim:column-detail-requested': { columnId: string; levelId: string }`.
- **Dialog host pattern (ΑΝΤΙΓΡΑΨΕ):** `app/PsetEditorHost.tsx` — `EventBus.on(...)` → resolve entity από `levelManager.getLevelScene(levelId)` → `setDialogState({open,...})` → render dialog. Mount (lazy `React.Suspense`) στο `app/DxfViewerDialogs.tsx` (δίπλα στο `PrintHost`/`BimScheduleHost`).
- **i18n:** `src/i18n/locales/{el,en}/dxf-viewer-shell.json`, namespace `ribbon.commands.columnEditor.*` + νέο `columnDetail.*` για το dialog.

### 2.3 Rebar SSoT (ΟΛΑ pure, geometry-is-SSoT — ΤΑ ΚΑΤΑΝΑΛΩΝΕΙΣ, ΔΕΝ ΤΑ ΞΑΝΑΓΡΑΦΕΙΣ)
- **`bim/structural/reinforcement/column-rebar-layout.ts`** (UNCOMMITTED Slice 3/3b):
  - `computeColumnRebarLayout(r, widthMm, depthMm): ColumnRebarLayout | null` → `{ longitudinalBarsMm, stirrupRingMm (4 αιχμηρές), stirrupPathMm (rounded κλειστή), stirrupCornerRadiusMm, stirrupHookEndsMm (2 άκρα 135°), barDiameterMm, stirrupDiameterMm }` — **LOCAL mm κεντραρισμένα**.
  - `computeStirrupLevelsMm(r, w, d, h): number[]` → στάθμες z (πύκνωση lcr).
  - `buildRoundedStirrupPath`, `buildStirrupHookEndsMm`, `stirrupCenterlinePerimeterMm`.
  - Constants: `STIRRUP_BEND_CL_FACTOR=2.5`, `STIRRUP_BEND_ARC_SEGMENTS=6`, `STIRRUP_HOOK_EXTENSION_FACTOR=10`.
- **`bim/structural/reinforcement/column-reinforcement-compute.ts`**: `computeColumnReinforcementQuantities(ctx, r): ColumnReinforcementQuantities{longitudinalLengthM, longitudinalWeightKg, stirrupCount, stirrupSingleLengthM, stirrupTotalLengthM, stirrupWeightKg, totalSteelWeightKg, ratio}` + `formatLongitudinalLabel(r)`→«4Ø16» + `formatStirrupsLabel(r)`→«Ø8/100-200». (`ColumnSectionContext` = `{widthMm,depthMm,heightMm,grossAreaMm2}`.)
- **`bim/structural/reinforcement/column-reinforcement-types.ts`**: `ColumnReinforcement{longitudinal{diameterMm,count}, stirrups{diameterMm,spacingMm,spacingCriticalMm?,type?}, coverMm}`, `StirrupType='closed-hooked'|'closed-welded'|'spiral'`, `DEFAULT_STIRRUP_TYPE`.
- **`bim/structural/reinforcement/column-confinement.ts`**: `computeColumnConfinement(ctx, r): {alphaN,alphaS,alpha,ductilityWarning}` (EC8 α).
- **`bim/structural/concrete-grades.ts`**: `CONCRETE_GRADES`, `concreteWeightKg`, `concreteFcdMpa`, `DEFAULT_CONCRETE_GRADE='C25/30'`, `CONCRETE_DENSITY_KGM3=2400`.
- **2Δ rebar draw (ΕΠΑΝΑΧΡΗΣΗ ΑΥΤΟΥΣΙΑ):** `bim/renderers/column-rebar-2d.ts` → `drawColumnRebar2D(ctx, p: ColumnParams, pxPerMm, worldToScreen)`. **Pure ctx** → καλείται με **custom `worldToScreen`** που μαπάρει LOCAL-mm κολώνας → pixels της region «Κάτοψη». Έτσι η κάτοψη του φύλλου = ΙΔΙΑ SSoT με τον live καμβά.
- **3Δ cage (ΕΠΑΝΑΧΡΗΣΗ):** `bim-3d/converters/column-rebar-3d.ts` → `buildColumnRebarCage(column, baseY, heightMm, levelId?): THREE.Group|null`.
- **Transform:** `bim/geometry/column-geometry.ts` → `columnLocalMmToWorld(params, localMm[])`, `computeColumnGeometry(params)` (footprint/area/volume/effective height), `materializeColumnLocalPolygonMm(params)` (για το αχνό περίγραμμα).
- **Params:** `bim/types/column-types.ts` → `ColumnParams{kind,width,depth,height,anchor,rotation,concreteGrade?,reinforcement?,sceneUnits?,...}`.

### 2.4 Διαστασιολόγηση (dimensioning)
- **Pill labels:** `bim/labels/bim-dim-labels.ts` → `formatBimDimLabels`, `drawDimPill(ctx,lines,cx,cy)`, `PILL_DIM_FONT`. (Καλό για κουκκίδες, ΟΧΙ για γραμμές διάστασης.)
- **AutoCAD/Revit dim γραμμές (extension lines + arrows + text):** `rendering/entities/DimensionRenderer.ts` + `systems/dimensions/dim-geometry-builder.ts` (`LinearDimGeometry`) + `rendering/entities/dimension/dim-arrowhead-renderer.ts` → `renderArrowhead(ctx,block,params)` + `dim-text-renderer.ts`. **ΠΡΟΣΟΧΗ:** αυτά είναι coupled σε DXF entity/DIMSTYLE/transform → **ΜΗΝ** τα φορτώσεις ολόκληρα. **ΕΠΑΝΑΧΡΗΣΙΜΟΠΟΙΗΣΕ μόνο** το `renderArrowhead` primitive· για το φύλλο φτιάξε **λιτό SSoT dim primitive** στο drawing-model (βλ. §3).

---

## 3. ΠΡΟΤΕΙΝΟΜΕΝΗ ΑΡΧΙΤΕΚΤΟΝΙΚΗ (FULL SSOT — επιβεβαίωσε/βελτίωσε στο plan)

### 🎯 Κεντρική αρχή SSoT: «ΕΝΑ drawing-model → ΔΥΟ backends»
Φτιάξε ένα **καθαρό (pure) Drawing Model** του φύλλου (γεωμετρία σε **sheet-mm**: γραμμές, πολυγραμμές, κύκλοι, διαστάσεις, κείμενα, raster-slots) που το παράγει ΕΝΑ SSoT από τον rebar SSoT. Μετά:
- **Backend A — Canvas** → **live preview** μέσα στο dialog (WYSIWYG).
- **Backend B — jsPDF** → **export/print** (το ΙΔΙΟ model).

Έτσι **preview === PDF** (καμία απόκλιση), και κερδίζεις το live-preview που το print engine άφησε DEFER.

### Δομή module (pure domain) — `bim/structural/detail-sheet/`
| Αρχείο | Ρόλος |
|---|---|
| `detail-sheet-types.ts` | Τύποι: `DetailSheetModel`, `SheetRegion`, `DetailPrimitive` (line/polyline/circle/dim/text/raster), `RectMm` (reuse print), `DimPrimitive{p1,p2,offset,text,side}` |
| `detail-sheet-layout.ts` | Pure: από paper size+margins → τα **5 region rects** (κάτω-αρ Κάτοψη, πάνω-αρ Όψη, κέντρο 3Δ, πάνω-δε Schedule, κάτω-δε TitleBlock) |
| `column-detail-plan.ts` | Pure: PLAN drawing model (αχνό footprint από `materializeColumnLocalPolygonMm` + rebar από `computeColumnRebarLayout` + διαστάσεις πλάτος/βάθος/cover/spacings) |
| `column-detail-elevation.ts` | Pure: ELEVATION model (διαμήκεις κατακόρυφες + στεφάνια ανά τύπο από `computeStirrupLevelsMm` + ζώνες lcr + βήμα + διαστάσεις ύψους) |
| `column-detail-schedule.ts` | Pure: πίνακας στοιχείων χάλυβα (από `computeColumnReinforcementQuantities` + labels + `computeColumnConfinement` + grade) |
| `column-detail-titleblock.ts` | Pure: title-block content (reuse print `TitleBlockContent`) |
| `column-detail-sheet.ts` | Orchestrator: column → πλήρες `DetailSheetModel` (καλεί τα παραπάνω· το 3Δ region = raster-slot placeholder) |
| `detail-sheet-dim.ts` | Pure SSoT dim helper: γεωμετρία γραμμής διάστασης (ext lines + θέσεις βελών + θέση κειμένου) σε sheet-mm |
| `__tests__/*` | jest για layout + plan/elevation/schedule builders + dim helper |

### Backends (render) — `bim/structural/detail-sheet/render/`
| Αρχείο | Ρόλος |
|---|---|
| `detail-canvas-renderer.ts` | Ζωγραφίζει `DetailSheetModel` σε `CanvasRenderingContext2D` (live preview)· dim = ext lines + `renderArrowhead` (reuse) + text |
| `detail-pdf-renderer.ts` | Ζωγραφίζει `DetailSheetModel` σε jsPDF (reuse `registerGreekFont`, `drawTitleBlock`, paper-math)· export Blob |
| `column-detail-3d-capture.ts` | Offscreen WebGL (template `capture-3d.ts`): mini-scene με αχνό περίγραμμα κολώνας + `buildColumnRebarCage` → PNG dataURL για το 3Δ region (preview & PDF ίδιο raster) |

### UI — `ui/components/column-detail/`
| Αρχείο | Ρόλος |
|---|---|
| `ColumnDetailDialog.tsx` | Radix Dialog: `<canvas>` preview του φύλλου (scale-to-fit) + κουμπιά «Εξαγωγή PDF» / «Εκτύπωση» (reuse print output routing) |
| `ColumnDetailHost.tsx` | EventBus `bim:column-detail-requested` → resolve column → render dialog (πρότυπο `PsetEditorHost`) |

### Wiring (μικρά edits)
- `column-command-keys.ts`: `+reinforcementDetail`.
- `contextual-column-tab.ts`: action button (large) στο panel «Στατικά» ή νέο panel «Λεπτομέρειες» (icon π.χ. `detail`/`drawing`).
- `useRibbonColumnBridge.ts onAction`: emit `bim:column-detail-requested`.
- `drawing-event-map-bim.ts`: +event type.
- `app/DxfViewerDialogs.tsx`: lazy-mount `ColumnDetailHost`.
- `lib/...lazy-components`: lazy entry για το host (όπως PrintHost).
- i18n `el`+`en` `dxf-viewer-shell.json`: `ribbon.commands.columnEditor.reinforcementDetail`(+tooltip) + `columnDetail.*` (τίτλοι ενοτήτων, κουμπιά, headers schedule/title-block).

### ADR-040
Το φύλλο σχεδιάζεται **offscreen / μέσα στο dialog** → **ΔΕΝ** αγγίζει τον live `DxfRenderer`/CanvasSection/leaves. Επαναχρησιμοποιείς `drawColumnRebar2D` (το αρχείο **δεν** αλλάζει) → **κανένα ADR-040 stage** (CHECK 6B/6C/6D δεν σκάνε). Αν για οποιονδήποτε λόγο χρειαστεί να αγγίξεις `DxfRenderer.ts`, ΣΤΑΜΑΤΑ — δεν πρέπει.

---

## 4. ΕΠΑΝΑΧΡΗΣΗ — ΠΙΝΑΚΑΣ (τι reuse, τι new)
| Ανάγκη | ΕΠΑΝΑΧΡΗΣΗ (μην ξαναγράψεις) | NEW |
|---|---|---|
| Γεωμετρία οπλισμού | `computeColumnRebarLayout`, `computeStirrupLevelsMm`, `buildStirrupHookEndsMm` | — |
| Ποσότητες/labels | `computeColumnReinforcementQuantities`, `format*Label`, `computeColumnConfinement`, `CONCRETE_GRADES` | — |
| 2Δ rebar (κάτοψη) | `drawColumnRebar2D` (custom worldToScreen) | αχνό footprint draw |
| 3Δ cage | `buildColumnRebarCage` + offscreen WebGL (template `capture-3d`) | `column-detail-3d-capture` |
| PDF | `registerGreekFont`, `drawTitleBlock`, paper-math, constants, `triggerExportDownload`/`openBlobInNewTab`, `buildPrintFilename` | `detail-pdf-renderer` (multi-region) |
| Διαστάσεις | `renderArrowhead` primitive | `detail-sheet-dim` (λιτό SSoT) |
| Dialog/Host | `PsetEditorHost`/`PrintHost` pattern, `DxfViewerDialogs` mount, EventBus | `ColumnDetailHost/Dialog` |
| Επιλεγμένη κολώνα | `resolveColumn()` στο column bridge | — |

---

## 5. REVIT/TEKLA-GRADE ΛΕΠΤΟΜΕΡΕΙΕΣ (να μην ξεχαστούν)
- **Κλίμακα:** δείξε κλίμακα ανά view (π.χ. 1:20 κάτοψη/όψη) — reuse `PRINT_SCALE_DENOMINATORS` + caption.
- **Αχνό περίγραμμα:** thin light-grey line (π.χ. `#bbb`, 0.13mm) για το σκυρόδεμα· ο οπλισμός έντονος (crimson `#c0392b` ήδη SSoT).
- **Διαστάσεις:** ext lines + arrowheads + κείμενο σε mm ακέραια· συνεχείς αλυσίδες (chained dims) όπου ταιριάζει (πλάτος, αποστάσεις διαμήκων, επικάλυψη).
- **Όψη ανά τύπο συνδετήρα:** closed-hooked → στεφάνια με 135° γαντζάκια· welded → καθαρά κλειστά· spiral → ελικοειδής συνεχής. (Συνεπές με τον 3Δ/2Δ SSoT.)
- **Schedule:** Mark | Ø | Πλήθος | Μήκος (m) | Βάρος (kg) γραμμή ανά είδος (διαμήκης/συνδετήρας) + σύνολο χάλυβα + ρ% + α.
- **Title block:** έργο, κωδικός/όνομα κολώνας, κλίμακα, ημερομηνία, κατηγορία σκυρ., κανονισμός (από `useStructuralSettingsStore.codeId`).
- **Μονάδες:** geometry σε mm· βάρη kg· `columnLocalMmToWorld` δίνει σωστά rotation/anchor.

---

## 6. SLICES (δούλεψε τμηματικά — ζήτα έγκριση plan ανά slice ή orchestrator για όλα)
- **Slice 0 — Plumbing & preview shell:** module skeleton + `detail-sheet-types` + `detail-sheet-layout` (5 rects) + `ColumnDetailHost/Dialog` (κενό canvas με τα 5 πλαίσια) + ribbon command + bridge emit + EventBus + i18n + lazy mount. → **Ανοίγει το παράθυρο με τα 5 περιγράμματα.**
- **Slice 1 — Κάτοψη (1):** `column-detail-plan` + canvas backend· reuse `drawColumnRebar2D` (region worldToScreen) + αχνό footprint + βασικές διαστάσεις πλάτος/βάθος/επικάλυψη.
- **Slice 2 — Όψη (2):** `column-detail-elevation` + στεφάνια ανά τύπο + ζώνες lcr/βήμα + διαστάσεις ύψους.
- **Slice 3 — 3Δ (3):** `column-detail-3d-capture` (offscreen cage) → raster region.
- **Slice 4 — Schedule (5) + Title block (4):** `column-detail-schedule` + `column-detail-titleblock`.
- **Slice 5 — PDF export/print:** `detail-pdf-renderer` (ΙΔΙΟ model → jsPDF) + κουμπιά dialog (reuse `triggerExportDownload`/`openBlobInNewTab`/`buildPrintFilename`) + plot-style mono.
- **Slice 6 — Polish & tests:** chained dims, κλίμακες ανά view, jest στους pure builders, tsc.

Πεδίο v1: **ορθογωνική κολώνα με `reinforcement`** (όπως ο rebar SSoT). Μη-ορθογωνικές/circular → DEFER.

---

## 7. VERIFY (browser)
`/dxf/viewer` → επίλεξε ορθογ. κολώνα με οπλισμό (Auto οπλισμός αν χρειάζεται) → contextual tab «Ιδιότητες Κολώνας» → νέα εντολή «Λεπτομέρεια Οπλισμού» → ανοίγει παράθυρο:
1. Κάτω-αριστερά κάτοψη με οπλισμό + αχνό περίγραμμα + διαστάσεις.
2. Πάνω-αριστερά όψη με στεφάνια **ανά τύπο** (άλλαξε τύπο συνδετήρα → αλλάζει) + διαστάσεις.
3. Κέντρο/δεξιά 3Δ κλωβός.
4. Πάνω-δεξιά πίνακας στοιχείων χάλυβα (Ø/πλήθος/μήκη/βάρη/ρ/α).
5. Κάτω-δεξιά title block.
6. «Εξαγωγή PDF» → το **ίδιο** φύλλο σε PDF (preview===PDF). Ελληνικά σωστά (Roboto).
Άλλαξε διαστάσεις/οπλισμό κολώνας → άνοιξε ξανά → ενημερωμένο (geometry-is-SSoT).

---

## 8. git add (ΜΟΝΟ δικά σου — αναμενόμενα NEW/MOD)
**NEW:** `bim/structural/detail-sheet/**` (types/layout/plan/elevation/schedule/titleblock/sheet/dim + render/* + __tests__), `ui/components/column-detail/{ColumnDetailDialog,ColumnDetailHost}.tsx`.
**MOD (μικρά, ΠΡΟΣΟΧΗ shared-tree):** `ui/ribbon/data/contextual-column-tab.ts`, `ui/ribbon/hooks/bridge/column-command-keys.ts`, `ui/ribbon/hooks/useRibbonColumnBridge.ts`, `systems/events/drawing-event-map-bim.ts`, `app/DxfViewerDialogs.tsx` (+ lazy-components), `src/i18n/locales/{el,en}/dxf-viewer-shell.json`.
**DOCS:** νέο `docs/centralized-systems/reference/adrs/ADR-457-column-reinforcement-detail-sheet.md` + `adr-index.md` (+γραμμή) + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (1-2 γραμμές ΜΟΝΟ τι εκκρεμεί) + MEMORY.
⚠️ **ΟΧΙ** `git add -A`. **ΟΧΙ** `DxfRenderer.ts`/άλλα ADR-040 αρχεία. Πρόσεχε conflicts σε shared αρχεία (locales/adr-index/DxfViewerDialogs).

**Memory σχετικά:** `reference_structural_quantities_ssot.md` (rebar SSoT), `reference_bim_dim_labels_ssot.md`, `project_adr453_print_export_engine.md`, `project_adr454_print_plot_style.md`.
**Master tracker:** `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`. ADR-456 (Slice 3b γάντζοι 135° — DONE, UNCOMMITTED) είναι το αμέσως προηγούμενο — μην το αγγίξεις.

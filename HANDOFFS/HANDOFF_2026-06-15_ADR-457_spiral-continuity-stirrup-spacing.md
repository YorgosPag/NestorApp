# HANDOFF — ADR-457: Spiral (φισούνα) συνέχεια + αποστάσεις στεφανιών (stirrup spacing dims)

**Ημερομηνία:** 2026-06-15
**ADR:** **ADR-457** — Column Reinforcement Detail Sheet (φύλλο σχεδίου οπλισμού κολώνας, Revit/Tekla-grade)
**Μοντέλο:** Opus (cross-cutting: 2Δ elevation + 3Δ cage + dim SSoT)
**Κατάσταση:** 🟢 **Slice 0+1+2+3 DONE & browser-verified & UNCOMMITTED** (tsc clean, 39 jest GREEN). Δύο **ΝΕΑ** θέματα από Giorgio (παρακάτω §3).

---

## 🚨 ΚΡΙΣΙΜΟΙ ΚΑΝΟΝΕΣ (διάβασε ΠΡΩΤΑ)
1. **Γλώσσα:** Απαντάς ΠΑΝΤΑ **Ελληνικά** στον Giorgio.
2. **COMMIT/PUSH:** τα κάνει **Ο GIORGIO**, ΟΧΙ εσύ (CLAUDE.md N.(-1)). Ποτέ `--no-verify`.
3. **Shared working tree:** δουλεύει ΚΑΙ άλλος agent → `git add` **ΜΟΝΟ τα δικά σου** αρχεία, **ΠΟΤΕ** `-A`.
4. **FULL ENTERPRISE + FULL SSOT, Revit-grade.** Ρητό αίτημα Giorgio. Καμία πρόχειρη λύση, κανένας παράλληλος κώδικας.
5. **N.2/N.3/N.11:** ΟΧΙ `any`/`as any`/`@ts-ignore`· ΟΧΙ inline styles· ΟΧΙ hardcoded Greek/English (i18n keys el+en· δεδομένα «4Ø16»/«100» ΔΕΝ είναι i18n).
6. **N.7.1:** code files ≤500 γρ, functions ≤40 γρ.
7. **N.17 single tsc:** process-check ΠΡΙΝ, ένα tsc τη φορά, background.
8. **ADR-040:** το φύλλο ζωγραφίζεται offscreen/μέσα στο dialog → ΜΗΝ αγγίξεις `DxfRenderer.ts`/CanvasSection/leaves.
9. **ADR-driven (N.0.1):** Phase 1 Recognition (επαλήθευσε τα reuse points) → plan → **έγκριση Giorgio ΠΡΙΝ κώδικα** → υλοποίηση → ADR-457 + adr-index + ΕΚΚΡΕΜΟΤΗΤΕΣ + MEMORY στο ίδιο commit.
10. Δούλεψε σε **slices**, ζήτα **browser-verify (screenshot)** μετά από κάθε slice.

---

## 1. ΤΙ ΕΙΝΑΙ ΗΔΗ DONE (Slice 0-3) — module `src/subapps/dxf-viewer/bim/structural/detail-sheet/`

**Κεντρική αρχή:** ΕΝΑ pure `DetailSheetModel` (sheet-mm, origin top-left, +y κάτω) → ΔΥΟ backends (Canvas preview + jsPDF Slice 5) ώστε **preview===PDF**. ΟΛΟ το περιεχόμενο = `DetailPrimitive`s (line/polyline/circle/text/dim/raster). ΠΟΤΕ άμεση ctx σχεδίαση.

| Αρχείο | Ρόλος |
|---|---|
| `detail-sheet-types.ts` | `DetailSheetModel`, `SheetRegion`, `DetailPrimitive` union, `DimPrimitive{p1,p2,offsetMm,text,stroke,textHeightMm}`, `RasterPrimitive{rect,dataUrl}` |
| `detail-sheet-layout.ts` | A3 landscape, 3 στήλες (αρ ΟΨΗ/ΚΑΤΟΨΗ· μέση 3Δ full-height· δεξ schedule/title-block) |
| `detail-sheet-dim.ts` | **`resolveDimGeometry(dim)`** → extension lines + **βελάκια** + rotation-corrected text. **SSoT linear dim — plan+elevation+3Δ το χρησιμοποιούν ΟΛΑ.** |
| `detail-sheet-fit.ts` | `pickScaleDenominator` (anisotropic scale-fit), `DETAIL_SCALE_DENOMINATORS` |
| `column-detail-plan.ts` | **ΚΑΤΟΨΗ** (footprint + rebar dots + stirrup ring + 135° hooks + W/D/cover dims + **bar marks #1…#N** δίπλα σε κάθε dot) |
| `column-detail-elevation.ts` | **ΟΨΗ** (περίγραμμα + διαμήκεις vertical lines + στεφάνια **ανά τύπο** στις στάθμες `computeStirrupLevelsMm` + height dim + stirrup label). ⚠️ **ΕΔΩ είναι το spiral bug §3.A + θα μπουν οι spacing dims §3.B** |
| `column-detail-perspective.ts` | **3Δ region**: raster (μόνο κολώνα+κλωβός) + **2Δ overlay** dims/marks (βλ. §2) |
| `column-rebar-bar-marks.ts` | **`assignColumnBarNumbers(params)→number[]\|null`** — κοινό SSoT αρίθμησης ράβδων #1..#N (αριστερά→δεξιά iso, key=worldX+worldY). Plan+3Δ το ΙΔΙΟ. |
| `column-detail-sheet.ts` | Orchestrator `buildColumnDetailSheet({params,labels,perspective3d?})` |
| `render/detail-canvas-renderer.ts` | `renderDetailSheet(ctx,model,{pxPerMm,rasterImages?})` — per-region clip + primitive switch + raster drawImage (contain-fit) |
| `render/detail-raster-fit.ts` | `containFitRectMm` — aspect-preserving SSoT (canvas+PDF) |
| `render/detail-raster-decode.ts` | async `Image.decode()` → map (Dialog προ-φορτώνει) |
| `render/column-detail-3d-capture.ts` | `captureColumnDetail3d(column,{widthPx,heightPx})→ColumnDetail3dCapture\|null`. Offscreen WebGL SYNC (unlit MeshBasicMaterial one-shot). 🚨 dispose **geometry-only** στον κλωβό (shared `REBAR_MATERIAL` singleton). |
| `render/column-detail-3d-dims.ts` | `computeColumnDimSpecs3d(column)→{a,b,text}[]` (3Δ measured points W/D/H, ΟΧΙ THREE) |
| `render/column-detail-3d-marks.ts` | `computeColumnBarMarkSpecs3d(column)→{pos,text}[]` (3Δ bar-top points) |

UI: `ui/components/column-detail/ColumnDetailDialog.tsx` (canvas, progressive paint, viewport sizing) + `ColumnDetailHost.tsx` (EventBus `bim:column-detail-requested` → resolve column → async capture state `perspective3d` → build model).

---

## 2. 🔑 FULL SSOT ARCHITECTURE (Giorgio το επέβαλε ρητά — ΜΗΝ το σπάσεις)

Οι **διαστάσεις & οι αριθμοί στο 3Δ ΔΕΝ ζωγραφίζονται με THREE**. Το 3Δ **raster φέρει ΜΟΝΟ κολώνα+κλωβό**. Οι W/D/H + bar marks μπαίνουν ως **2Δ `dim`/`text` primitives** στα **camera-projected** σημεία:

1. `computeColumnDimSpecs3d` / `computeColumnBarMarkSpecs3d` → 3Δ σημεία (world).
2. `captureColumnDetail3d` τα **προβάλλει** (`camera.project`) → normalized raster space· επιστρέφει `ColumnDetail3dCapture{dataUrl,widthPx,heightPx,centroid,dims[],marks[]}`.
3. `buildColumnPerspectiveRegion(region, capture)` μαπάρει normalized→sheet-mm στο **ΙΔΙΟ `containFitRectMm`** (ευθυγράμμιση με την εικόνα) → βγάζει `dim` (offset outward μέσω centroid sign· `OVERLAY_DIM_OFFSET_MM=6`, `DIM_TEXT_MM=2.6`) + `text` (bar marks `MARK_TEXT_MM=2.2`, navy `#14387f`).

➡️ Έτσι το 3Δ χρησιμοποιεί **ΑΚΡΙΒΩΣ** το `resolveDimGeometry` (ίδια βελάκια/γραμμές/κείμενα) με ΟΨΗ/ΚΑΤΟΨΗ. **ΜΑΘΗΜΑ:** για annotation πάνω σε raster → project 3D→2D & χρησιμοποίησε τα ΥΠΑΡΧΟΝΤΑ 2Δ primitives, ΜΗΝ φτιάχνεις παράλληλο 3D renderer.

---

## 3. ΤΙ ΜΕΝΕΙ — ΔΥΟ ΝΕΑ ΘΕΜΑΤΑ (Giorgio 2026-06-15, screenshot 012100)

### 🔷 A — Spiral (φισούνα) ΣΥΝΕΧΕΙΑ: η έλικα διακόπτεται βίαια
**Συμπτωμα:** όταν ο τύπος συνδετήρα = **spiral**, η «γραμμή ανάβασης του ελατηρίου» (στην ΟΨΗ ΚΑΙ στο 3Δ) **διακόπτεται βίαια** αντί να είναι συνεχής ομαλή έλικα (ο Giorgio ζωγράφισε με μπλε τη ζητούμενη συνεχή ημιτονοειδή έλικα).

**ΑΙΤΙΑ (διαγνωσμένη):** και η ΟΨΗ και το 3Δ ζωγραφίζουν το spiral πάνω στα **`computeStirrupLevelsMm`**, που είναι **πυκνά στα κρίσιμα άκρα (lcr) / αραιά στη μέση** (σωστό για ΚΛΕΙΣΤΑ στεφάνια, ΛΑΘΟΣ για spiral). Το zig-zag μεταξύ πυκνού→αραιού→πυκνού κάνει το βίαιο άλμα.
- ΟΨΗ: `column-detail-elevation.ts` → `pushStirrupPrimitives`, κλάδος `type==='spiral'`: `points = levels.map((z,i)=> toSheet(i%2? coverX:-coverX, z))`.
- 3Δ: `bim-3d/converters/column-rebar-3d.ts` → `spiralSegments(pathXY, levels, baseY)` (ίδια `levels`).

**ΣΩΣΤΟ (Revit-grade):** το spiral έχει **ΣΤΑΘΕΡΟ ΒΗΜΑ (uniform pitch)** = `r.stirrups.spacingMm` (όχι lcr densification). Φτιάξε **ΚΟΙΝΟ SSoT** helix-level generator (π.χ. `computeSpiralHelixLevelsMm(r, heightMm)` στο `reinforcement/column-rebar-layout.ts` δίπλα στο `computeStirrupLevelsMm`) με σταθερό pitch, και **και η ΟΨΗ και το 3Δ** να το χρησιμοποιούν για spiral (ΟΧΙ τα closed-stirrup levels). Στην ΟΨΗ μια συνεχής smooth έλικα (π.χ. ημιτονοειδής front-strand ή πυκνό zig-zag σταθερού βήματος ώστε να φαίνεται «ελατήριο»). Στο 3Δ ο `spiralSegments` ήδη φτιάχνει συνεχή ανερχόμενη έλικα — απλώς τάισέ τον uniform-pitch levels.
**Reuse:** `computeStirrupLevelsMm` (πρότυπο signature), `r.stirrups.spacingMm`, `column-rebar-layout.ts`. **Geometry-is-SSoT** — ΕΝΑ generator, δύο consumers (ΟΨΗ 2Δ + 3Δ cage).

### 🔷 B — ΑΠΟΣΤΑΣΕΙΣ ΣΤΕΦΑΝΙΩΝ (stirrup spacing dimensions) λείπουν
**Αίτημα:** «δεν υπάρχουν αποστάσεις ανάμεσα στα στεφάνια για να γνωρίζει ο τεχνίτης πώς θα σιδερώσει». Χρειάζονται **dimension strings** (Revit-grade) στην ΟΨΗ που δείχνουν το βήμα/τις ζώνες: π.χ. πυκνή ζώνη lcr `n×100`, μεσαία `@200`, πυκνή lcr `n×100` — ώστε ο τεχνίτης να ξέρει spacing.

**Υλοποίηση (FULL SSOT):** πρόσθεσε στην `column-detail-elevation.ts` **`dim` primitives** (μέσω του ΙΔΙΟΥ `resolveDimGeometry`) σε μια κατακόρυφη γραμμή διαστάσεων στο πλάι (π.χ. δεξιά της ΟΨΗΣ, αντίθετα από το height dim που είναι αριστερά): είτε ένα dim ανά διάστημα στεφανιών, είτε grouped «spacing string» ανά ζώνη (πυκνή/αραιά/πυκνή). Το κείμενο = το spacing σε mm (δεδομένο, ΟΧΙ i18n). Reuse τα `levels` (ήδη υπολογισμένα) + `r.stirrups.spacingMm`/`spacingCriticalMm`. Σκέψου ΚΑΙ προαιρετικά spacing dim στο 3Δ overlay (ίδιος μηχανισμός §2).
**Revit pattern:** confinement zones (lcr) με πυκνά + middle με αραιά· το spacing string δείχνει «5×100=500 / @200 / 5×100=500».

> **Σειρά:** πρότεινε στον Giorgio να ξεκινήσεις από το **A (spiral)** (πιο εντοπισμένο, geometry SSoT) και μετά **B (spacing dims)**. Ζήτα έγκριση plan ΠΡΙΝ κώδικα (N.0.1).

---

## 4. REUSE POINTS (επαλήθευσε signatures στο Phase 1)
- `bim/structural/reinforcement/column-rebar-layout.ts` → `computeColumnRebarLayout(r,width,depth)`, `computeStirrupLevelsMm(r,width,depth,heightMm)`. **ΕΔΩ πρόσθεσε `computeSpiralHelixLevelsMm`.**
- `bim/structural/reinforcement/column-reinforcement-types.ts` → `DEFAULT_STIRRUP_TYPE`, `StirrupType` ('closed-hooked'|'closed-welded'|'spiral'), `r.stirrups.{type,spacingMm,spacingCriticalMm,diameterMm}`.
- `bim/structural/reinforcement/column-reinforcement-compute.ts` → `formatStirrupsLabel(r)` («Ø8/100-200»).
- `bim-3d/converters/column-rebar-3d.ts` → `spiralSegments` / `ringSegments` / `buildColumnRebarCage`.
- `detail-sheet-dim.ts` → `resolveDimGeometry` (το dim SSoT — χρησιμοποίησέ το για τα spacing dims).

---

## 5. git add — ΑΝΑΜΕΝΟΜΕΝΑ ΑΡΧΕΙΑ (ΜΟΝΟ δικά σου· shared tree → ΠΟΤΕ `-A`)
**Ήδη γραμμένα (Slices 0-3, UNCOMMITTED):** όλο το `bim/structural/detail-sheet/**` + `ui/components/column-detail/**` + ADR-457/adr-index/ΕΚΚΡΕΜΟΤΗΤΕΣ.
**Νέα (A/B):** `reinforcement/column-rebar-layout.ts` (spiral generator)· `column-detail-elevation.ts` (spiral fix + spacing dims)· `column-rebar-3d.ts` (spiral uniform-pitch — ⚠️ ADR-040-adjacent αλλά ΟΧΙ leaf· είναι 3Δ converter, ασφαλές)· `__tests__/*`. ⚠️ ΟΧΙ `DxfRenderer.ts`/leaves.

## 6. VERIFY (browser) ανά slice
`/dxf/viewer` → ορθογ. RC κολώνα → contextual «Ιδιότητες Κολώνας» → «Λεπτομέρεια Οπλισμού» → fullscreen.
- **A:** άλλαξε τύπο συνδετήρα σε **spiral/φισούνα** → στην ΟΨΗ ΚΑΙ στο 3Δ η έλικα **συνεχής & ομαλή** (σταθερό βήμα), χωρίς βίαιο άλμα.
- **B:** στην ΟΨΗ φαίνονται **αποστάσεις στεφανιών** (spacing dims/string) με βελάκια ίδιου στυλ με τα υπόλοιπα.

## 7. DEFER (επόμενα Slices ADR-457)
- **Slice 4:** Schedule (πίνακας χάλυβα: Σύμβολο/Ø/πλήθος/μήκος/βάρος + ρ% + α περίσφιγξη) + Title block — ΩΣ primitives (ΟΧΙ jsPDF-only `drawTitleBlock`). Reuse `computeColumnReinforcementQuantities`, `computeColumnConfinement`, `concrete-grades`.
- **Slice 5:** `detail-pdf-renderer.ts` (ΙΔΙΟ model→jsPDF· raster via `pdf.addImage`+ΙΔΙΟ `containFitRectMm`· `registerGreekFont`) + ενεργοποίηση κουμπιών «Εξαγωγή PDF»/«Εκτύπωση».
- **Slice 6:** polish, chained dims, tests.

**Memory:** `reference_column_detail_sheet_ssot.md` (ΕΝΑ model→2 backends + 3D capture gotchas + FULL SSOT overlay), `reference_structural_quantities_ssot.md` (ADR-456 rebar SSoT).
**ADR + tracker:** `docs/centralized-systems/reference/adrs/ADR-457-column-reinforcement-detail-sheet.md` (changelog 2026-06-15) · `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`.

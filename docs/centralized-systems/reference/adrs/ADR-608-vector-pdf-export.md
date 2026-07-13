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

### Annotation-symbol & scale-bar decomposition (Φ-annotations)

`annotation-symbol` (north-arrow / section-mark / grid-bubble / elevation-mark / detail-callout /
revision-tag) and `scale-bar` are **non-BIM** scene entities, so `flattenSceneEntitiesForDxf` passes
them through untouched — but the emitter has no `case` for them → they hit `default` and were silently
**dropped from the vector PDF *and* the `.dxf`**. Big players (Revit / AutoCAD / ArchiCAD) **explode**
annotation symbols into vector geometry on export; we do the same, mirroring the BIM→lwpolyline flatten
(one decompose, two backends).

- **NEW `export/core/annotation-to-primitives.ts`** — `expandAnnotationsToPrimitives(entities, {drawingScale, sceneUnits})`
  replaces each symbol/bar with neutral `Entity[]` the emitter already draws (line / lwpolyline / circle /
  arc / text / solid-fill `hatch`). Geometry is read from the EXISTING SSoT — the catalog glyph
  (`ANNOTATION_SYMBOL_CATALOG`, unit space) folded via `annotationSymbolModelSize`, and the scale-bar
  layout via `buildScaleBarPrimitives`. The unit→world / frame→world maps mirror the on-screen renderers
  exactly, so the export matches the canvas pixel-for-pixel. NO geometry re-derived (N.18).
- **NEW `bim/scale-bar/scale-bar-primitives.ts`** — `buildScaleBarPrimitives(entity, drawingScale, sceneUnits)`
  is the **EXTRACTED** frame-space layout SSoT (body cells + ticks + subdivisions + numerals in `(s,t)`
  frame space). `ScaleBarRenderer` was **rewritten thin** to consume it (via the new
  `rendering/entities/scale-bar/stamp-scale-bar-primitives.ts` canvas stamper, replacing
  `draw-scale-bar-labels.ts`), so the renderer and the export decomposer can never drift — the previous
  structural clone between "draw the bar on canvas" and "explode the bar for export" is eliminated.
- **NEW `export/core/neutral-primitive-factory.ts`** — the single builder path (line/polyline/circle/arc/
  solid-fill/text) both decomposers use, inheriting the source colour/ACI/lineweight/layer. Solid fills
  reuse the ADR-505 §C `hatch` + `dxfFaces` carrier (z = 0 planar faces) → the emitter fills them and the
  DXF writer emits `3DFACE`, no new code path.
- **Emitter text alignment** — `scene-vector-emitter.emitText` now honours `TextEntity.alignment` +
  a `vBaseline` hint so centred glyph letters / scale-bar numerals land on their anchor. Scene text omits
  both → default left / alphabetic (unchanged).
- **Wiring** — the visible fix is a one-line pre-pass in `capture-2d-vector.ts` AFTER the flatten:
  `expandAnnotationsToPrimitives(flat, {drawingScale: liveDrawingScale, sceneUnits})`. The emitter is
  untouched (already knows line/arc/circle/lwpolyline/text/hatch).
- **✅ DXF + TEK parity (implemented):** the same decomposer runs in the `.dxf` path
  (`buildDxfExportRequest`, covering active / per-floor / merged) and the Tekton `.tek` path
  (`assembleTekDocument`, before `collectTekLines`/`collectTekArcs`). Purity is preserved by threading the
  live `drawingScale` as an explicit option (`DxfExportOptions.drawingScale` / `TekExportOptions.drawingScale`),
  resolved once in `export-service.ts` from the store — the pure request builders never read it. Solid
  fills carry BOTH a `hatch` (PDF fill / DXF `3DFACE`) AND a closed outline polyline, so fill-less backends
  (Tekton renders the outline as `<line>` records) still show the triangle. **TEK limitation (DEFER):**
  Tekton has no free-text primitive collector yet, so baked symbol labels (the "N"/"A"/"1" letters,
  scale-bar numerals) are dropped from `.tek` (geometry — arrows/bubbles/ticks — exports fine); PDF/DXF
  keep the text.

### Tekton symbol identification — IMPORT round-trip (Φ-import)

Ο export χάρτης (πάνω) είναι μονόδρομος (δικό μας σύμβολο → `type_res`). Για **πλήρη
ταυτοποίηση** στο **φόρτωμα `.tek`**, ο `tek-symbol-catalog.ts` έγινε **αμφίδρομο SSoT**:
ΕΝΑ `MATCHED_SYMBOLS` array παράγει και τις δύο κατευθύνσεις — `tekSymbolTypeRes` (export,
ανέπαφο) **και** `tekSymbolFromTypeRes` (import: `type_res` → `{symbolId, kind}`). Προστέθηκε
`TEKTON_SYMBOL_NAMES` (index↔Ελληνικό όνομα και για τα 53 `obj/symbols` του `Obj.inf` — **μόνο
ονόματα, καμία ιδιόκτητη `.asc` γεωμετρία LH**· index round-trip = interoperability, νομικά καθαρό).

Import pipeline (καθρέφτης του export, additive πάνω στους υπάρχοντες extractors): νέος
`io/tek/tek-object-extract.ts` (`extractObjectRecords` — type-7 `<object>`, ο `type_res` = το
**2ο** `<type>` του record) → `TekObjectRecord` → νέος mapper `io/tek/tek-object-to-scene.ts`
(`tekObjectToEntity`: reverse-map → `AnnotationSymbolEntity`, θέση/περιστροφή από `<xmatrix>`
με το ΙΔΙΟ Y-flip convention του text mapper). `type_res` **χωρίς** δικό μας equivalent
(άνθρωποι/αυτοκίνητα/βέλη — 43 από τα 53) → **ονομαστικό warning** (`tektonSymbolName`) αντί
σιωπηλής απώλειας (πριν: τα type-7 objects αγνοούνταν εντελώς στο import). Wiring:
`tek-scene-extract.ts` (+`objects`) + `tek-scene-builder.ts` (objects → entities + warnings).

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
- ✅ **Annotation symbols + scale-bars now export as vector** (previously dropped): the same neutral
  primitives feed the emitter, and the scale-bar layout is now a shared SSoT (`buildScaleBarPrimitives`)
  consumed by BOTH the on-screen renderer and the export decomposer.

## Changelog

- **2026-07-13** — **Καμία αλλαγή στο συμβόλαιο** του vector backend, μία στη σημασία της `area`
  (ADR-651 Φάση ΣΤ / ADR-453): όταν το φύλλο φέρει πινακίδα, το `draw(pdf, area)` καλείται με την
  **ωφέλιμη** περιοχή της κορνίζας ISO 5457 (κορνίζα μείον πινακίδα) αντί για τη συμμετρική περιοχή
  περιθωρίου — το διανυσματικό σχέδιο δεν τυπώνεται ποτέ κάτω από την πινακίδα. Η κορνίζα/πινακίδα
  ζωγραφίζεται **μετά**, ως `DetailPrimitive[]` (ADR-622), στην ίδια σελίδα ⇒ όλα τα στοιχεία του PDF
  παραμένουν **native vector** (επιλέξιμο κείμενο, AutoCAD PDF-Import → πραγματικές οντότητες).
- **2026-07-09** — Φ-texts **ANCHOR rewrite → exact native centering** (Opus, acceptance test Giorgio:
  «κύκλος με «1» ΤΑΥΤΙΣΜΕΝΑ ΚΕΝΤΡΑ → το «1» να μείνει ΑΚΡΙΒΩΣ στο κέντρο μετά το export»). **SSoT audit
  (grep):** το alignment encoding ζούσε **διπλό** (export `H_ALIGN` {left0/center1/right2} + import
  `alignmentOf`)· κανένα text-measurement util δεν υπάρχει· ο `scene-vector-emitter` (η δική μας renderer
  αναφορά) θεωρεί για decomposed label το **`position` = alignment anchor** και κεντράρει honoring
  `alignment`+`vBaseline` (declare-and-anchor, big-player). **Απόφαση:** αντικατάσταση της
  offset-with-width-estimation (`textTopLeft`/`estimateTextWidthMeters`/`TEK_CHAR_ADVANCE_PER_CAP`/
  `TEK_TEXT_VMID_FACTOR` — **όλα διεγράφησαν**) με **exact anchoring**: το anchor (Y-flip) μπαίνει
  ΑΚΡΙΒΩΣ στο `(x20,x21)` και δηλώνουμε `hallign`/`vallign` → ο ΙΔΙΟΣ ο Τέκτων κεντράρει το glyph box,
  μηδέν εκτίμηση πλάτους (όπως Revit/Figma). **SSoT:** νέο `tek-text-alignment.ts` (canonical encoding +
  `TEK_HALLIGN`/`TEK_VALLIGN`/`tekHAlignToKey`) — export ΚΑΙ import (`tek-primitive-to-scene`) το
  μοιράζονται (καμία αλλαγή import συμπεριφοράς). `resolveTextAlign` καθρεφτίζει τον emitter: label με
  `vBaseline` hint → τιμά `alignment`+`vBaseline`· «σκέτο» scene text χωρίς hint → left/alphabetic (δεν
  μετατοπίζεται text με insertion-semantics που δεν κατέχουμε). Tests: το «center/middle → offset»
  αντικαταστάθηκε με «center/middle → anchor ακριβώς στο (x20,x21)»· +1 test (hint-less → left/alphabetic)·
  8 Φ-texts GREEN· jscpd:diff clean· files<500/fns<40· no `any`/inline/hardcoded.
  **Browser-verify αποτέλεσμα (Giorgio, 3 iterations):** ο Τέκτων τελικά **ΔΕΝ κεντράρει** native το
  type-3 text — το αγκυρώνει στην **αριστερή-ΠΑΝΩ** ακμή. Το `hallign`/`vallign` παραμένουν δηλωμένα
  (SSoT· round-trip με import) αλλά η ΟΠΤΙΚΗ ταύτιση απαιτεί δικό μας offset. Προστέθηκαν **δύο
  browser-calibrated knobs** (× cap-height, μόνο για `vBaseline` labels): `TEK_TEXT_HSHIFT_PER_HEIGHT`
  **=0.35** (αριστερά· center=½ πλάτος, right=ολόκληρο) + `TEK_TEXT_VSHIFT_PER_HEIGHT` **=0.5** (πάνω·
  Y-flip=αφαίρεση, μόνο `vAlign==='middle'`). ✅ **Browser-verified: N/E/S/W πυξίδας/ρόδας-ανέμων + «1»
  κύκλου κεντραρισμένα ακριβώς** (μέση γράμματος στο anchor). UNCOMMITTED.
- **2026-07-09** — **Φ-fill χρώμα: solid hatch μονόχρωμο (όχι άσπρο φόντο)** (Opus, Giorgio browser:
  «τα solid τρίγωνα εμφανίζουν και άσπρα γεμίσματα, τα native μόνο πράσινο»). Το `HATCH_RECORD_TEMPLATE`
  είχε σταθερό `<raster_bgcolor>FFFFFF</raster_bgcolor>` → ο Τέκτων ζωγράφιζε foreground χρώμα **+**
  άσπρο raster φόντο ανάμεσα στο μοτίβο. **Fix:** νέο `{{BGCOLOR}}` placeholder, ο `buildHatchRecordXml`
  το γεμίζει με το **ίδιο** `colorHex6(h.colorHex)` → background=foreground=μονόχρωμο (verify: βέλη
  Βορρά μονόχρωμα πράσινα). +2 assertions (`raster_bgcolor`=foreground, όχι FFFFFF)· 87/87 GREEN·
  jscpd:diff clean. ✅ **Browser-verified (Giorgio).** UNCOMMITTED.
- **2026-07-09** — Φ1 (emitter core + 10 tests) + Φ2 (CaptureResult union, `capture-2d-vector.ts`,
  assembler branch, `outputMode` service/UI/i18n, tests) implemented (Opus). 26 jest GREEN,
  jscpd:diff clean. Renumbered from the planned "604" (collision) to ADR-608. UNCOMMITTED.
  🔴 browser-verify: Print 2D → save PDF → zoom without pixels; AutoCAD PDFIMPORT → entities on
  `PDF_Geometry`/`PDF_Text`/`PDF_Solid Fills` (not one image on `PDF_Images`); raster fallback unchanged.
  Browser-verified GREEN by Giorgio (vector import works). Follow-up fix: emitter now sets round
  `setLineCap`/`setLineJoin` so stroked corners close without the butt-cap/miter notch visible at high
  zoom. (Confirmed: mm lineweights scaling with zoom is correct/desired — model-space pen width.)
- **2026-07-09** — Φ-annotations: annotation-symbol + scale-bar decomposition (Opus). `annotation-symbol`
  (6 kinds) + `scale-bar` were silently dropped from the vector PDF (emitter `default` case) — now
  exploded to neutral primitives via NEW `export/core/annotation-to-primitives.ts` +
  `export/core/neutral-primitive-factory.ts`. Scale-bar layout EXTRACTED to NEW
  `bim/scale-bar/scale-bar-primitives.ts` (frame-space SSoT); `ScaleBarRenderer` rewritten thin over the
  new `stamp-scale-bar-primitives.ts` (replaces `draw-scale-bar-labels.ts`), killing the renderer↔export
  clone. `emitText` now honours `alignment` + a `vBaseline` hint. Wired into `capture-2d-vector.ts`
  (post-flatten pre-pass, live `drawingScale` + scene units). Tests: +12 (scale-bar-primitives 12,
  annotation-to-primitives 12, emitter +3, capture-2d-vector repaired 4→5) — 300 print/export/scale-bar
  jest GREEN; jscpd:diff clean; files <500 / functions <40; no `any`/inline-styles/hardcoded strings.
  DXF-export parity deferred (purity of `buildDxfExportRequest`; decomposer is DXF-ready). UNCOMMITTED.
  Browser-verified by Giorgio: symbols now export (circles/text/lines/arcs on PDFIMPORT). **Follow-up fix
  (same day):** the solid-filled triangles (arrowheads / elevation triangle) were still missing —
  `makeSolidFill` built `dxfFaces` as a FLAT `Corner[]` instead of an array-OF-faces `Corner[][]`, so
  `emitHatch`'s `for (const f of faces) if (f.length >= 3)` read `undefined` per corner and painted
  nothing. Wrapped as `[ring]`; added a factory-structure guard + an end-to-end decompose→emit test that
  asserts a real filled `pdf.lines(…, 'F')`. 302 jest GREEN.
  ⚠️ Pre-existing (NOT this change): `ScaleBarRenderer.test.ts` `getGrips` expects 3 grips while a
  concurrent `scale-bar-grips.ts` edit now returns 5 — stale test in another agent's uncommitted work.
- **2026-07-09** — DXF + TEK export parity (Opus, follow-up after Giorgio: «στα αρχεία του Τέκτονα δεν
  εξάγονται τα σύμβολα»). The annotation decomposer is now wired into `buildDxfExportRequest` (`.dxf`,
  active/floor/merged) and `assembleTekDocument` (`.tek`, before the line/arc collectors), threading the
  live `drawingScale` via `DxfExportOptions`/`TekExportOptions` (pure builders — the store is read once in
  `export-service.ts`). Solid fills now emit fill + closed outline so Tekton (no solid-fill primitive)
  renders the triangle as `<line>` records. Extracted the duplicated multi-floor `packageArtifacts`
  helper in `export-service.ts` (jscpd:diff flagged the pre-existing twin once the file was touched).
  Tests: +2 (dxf-export-adapter annotation decomposition, tek-export-adapter `<line>` type-4). 315
  export/print/scale-bar jest GREEN; jscpd:diff clean. TEK baked-label text DEFER (no Tekton text
  collector). UNCOMMITTED. 🔴 browser-verify: export `.tek` → Tekton shows north/scale-bar/section-mark
  geometry; export `.dxf` → symbols present.
- **2026-07-09** — Φ-grouping (TEK tags): κάθε σύμβολο = ΜΙΑ ομαδοποιημένη οντότητα στον Τέκτονα, όχι
  σκόρπιες γραμμές (Opus, follow-up after Giorgio). **Έρευνα (ground-truth):** το native Tekton manual
  (`Tekton_Manual.pdf` §18.6 «Δημιουργία αντικειμένου από το χρήστη» + εντολή «Φύλαξη σε γραμμές ως…») +
  verified sample `LIB/Χαρτί σχεδίασης Α0.tek` έδειξαν ότι ο Τέκτων ομαδοποιεί γραμμές σχεδίου με **tags/
  ετικέτες**: registry `<tag_visibility><tag><name>…</name><visible>1</visible></tag>…` + per-record
  `<taglist><s>ΟΝΟΜΑ</s></taglist>`. (Το `<object>` type-7 είναι catalog-reference σε εσωτερική
  βιβλιοθήκη «Χρήστης» — ΔΕΝ self-contained, θα έσπαγε στο άνοιγμα· απορρίφθηκε.) **Υλοποίηση (SSoT):**
  νέο `groupId?` provenance στο `BaseEntity`· ο `neutral-primitive-factory.inheritStyle` σφραγίζει
  `groupId: source.id` σε ΚΑΘΕ decomposed primitive (ΕΝΑ σημείο)· `TekLine/TekArc` απέκτησαν `tag?`·
  `collectTekLines/collectTekArcs` διαβάζουν το `groupId`, γεμίζουν το κενό `<taglist>` (μέσω
  `injectTag`) και επιστρέφουν distinct `tags`· νέο `buildTagVisibilityXml` + registry injection στο
  `injectTekEntities` (throw αν λείπει το block ενώ υπάρχουν tags)· ο `tek-export-adapter` ενώνει τα
  distinct tags → registry. Αποτέλεσμα: όλα τα line/arc ενός συμβόλου μοιράζονται ΕΝΑ tag → +Tags
  επιλογή / show-hide ως ΜΙΑ ομάδα (AutoCAD GROUP parity), κρατώντας crisp 2D vector. Tests: +11
  (dxf-to-tek grouping 5, tek-export registry 6). jscpd:diff clean· files <500 / functions <40· no
  `any`/inline-styles/hardcoded strings. DXF anonymous BLOCK/INSERT parity (AutoCAD) = επόμενο increment.
  UNCOMMITTED. 🔴 browser-verify: export `.tek` → στον Τέκτονα +Tags επιλέγει/κρύβει όλο το σύμβολο μαζί.
  ⚠️ Pre-existing (NOT this change): 4 `collectTekWalls — κουφώματα` tests αποτυγχάνουν
  (`wall.geometry.length` undefined) — concurrent opening-geometry WIP άλλου agent, όχι tag files.
- **2026-07-09** — Φ-grouping v2 (NATIVE Tekton objects + export toggle): ο Giorgio ζήτησε «ΕΝΙΑΙΟ ΠΑΚΕΤΟ»,
  όχι tags-πάνω-σε-σκόρπιες-γραμμές. **Ground-truth (τοπική εγκατάσταση Fespa-Tekton v9.1):** το manual
  `Tekton_Manual.pdf` §18 «Αντικείμενα» + ο κατάλογος `Obj.inf` (`obj/symbols/`) αποκάλυψαν ότι ο Τέκτων
  έχει **built-in βιβλιοθήκη 2D συμβόλων**· κάθε σύμβολο = ΕΝΑ **type-7 `<object>`** που δείχνει στο catalog
  index (`type_res`). Τα type_res **51**/**125** του δείγματος ΣΥΜΒΟΛΑ.tek = «Βορράς 1»/«Σήμα στάθμης 2» —
  δηλ. ο Giorgio ΕΙΧΕ βάλει built-in objects. **Mapping (SSoT `tek-symbol-catalog.ts`):** north-arrow→51
  (variants 124/127/137), section-mark→383 «Σύμβολο τομής», elevation-mark→123/125· grid-bubble/
  detail-callout/revision-tag/scale-bar → κανένα equivalent → αυτούσια γεωμετρία. **Υλοποίηση:** νέο
  `OBJECT_RECORD_TEMPLATE` (AUTO-GEN από ΣΥΜΒΟΛΑ.tek record n=4, placeholders N/TYPE_RES/XMATRIX)·
  `TekObject` type· `buildSymbolObjectXMatrix` (θέση+περιστροφή+scale, Y-flipped· rotation 0 == δείγμα)·
  `buildObjectRecordXml`· `collectTekObjects` (annotation-symbol→object + `consumedIds`)· ο
  `assembleTekDocument` εξαιρεί τα consumed από την αποδόμηση και εγχέει objects στον `<object>` marker.
  **Export toggle (industry-standard native-map vs explode):** νέο `TekSymbolMode = 'native' | 'geometry'`
  (ExportRequest/TekExportOptions, default **native**)· export-service το περνά· `useExportDialogState` +
  `ExportDialog` προσθέτουν dropdown «Σύμβολα: Σύμβολα Τέκτονα (ενιαίο αντικείμενο) / Αυτούσια γεωμετρία
  (ομαδοποιημένη)» (i18n el+en `export.tekSymbolMode(s)`). Tests: +14 (collectTekObjects 5, object writer 3,
  adapter native/geometry 2, + earlier tag 11 stay). ΟΛΑ πράσινα εκτός των 4 pre-existing opening tests·
  jscpd:diff clean (11 files)· files <500 / functions <40· no `any`/inline-styles/hardcoded strings
  (tag/symbol ονόματα = ascii catalog ids / i18n keys). Scale μεγέθους από sizeMm = follow-up (άγνωστη η
  βάση μεγέθους των Tekton συμβόλων· scale=1 = native default). UNCOMMITTED. 🔴 browser-verify: export
  `.tek` (native) → κάθε βορράς/τομή/στάθμη = ΕΝΑ επιλέξιμο αντικείμενο· (geometry) → αυτούσιο + tags.
- **2026-07-09** — Έρευνα «λείπει το πεδίο Σύμβολα (tekSymbolMode) στον Export οδηγό» (Opus, follow-up).
  **Πόρισμα: ΔΕΝ υπάρχει defect στον κώδικα.** SSoT audit (grep όλου του `dxf-viewer`): ένας μόνο
  `ExportDialog` + ένας `ExportHost` + ένα trigger (`open-export-dialog`)· καμία δεύτερη/παλιά dialog ή
  wizard-step wrapper· το native tek export τρέχει ΑΠΟΚΛΕΙΣΤΙΚΑ μέσα από αυτόν τον dialog (⇒ `format='tek'`
  ήταν true κατά το verified export ⇒ το `isTek` block render-άρεται). Επιβεβαίωση: το `{isTek && …
  tekSymbolMode …}` είναι δομικά ίδιο με τα δουλεύοντα `{isDxf && …}`, σωστά μέσα στο `<section>`· i18n
  keys `export.tekSymbolMode(s)` υπάρχουν σε el+en· τύποι σωστοί (`ExportFormat` έχει `'tek'`,
  `TekSymbolMode` exported)· ο `DialogContent size="lg"` ΔΕΝ έχει fixed-height/overflow (κανένα οπτικό
  κόψιμο — το tek έχει ΛΙΓΟΤΕΡΑ πεδία από το dxf). **Regression test (νέο):**
  `ui/components/export/__tests__/ExportDialog-format-fields.test.tsx` (3 tests, GREEN) αποδεικνύει:
  `format='tek'` → εμφανίζει «Σύμβολα»· `dxf` → DXF rows + κρύβει tek· `ifc` → κανένα. Πιθανότερη αιτία της
  αναφοράς: stale dev build / HMR δεν πήρε το νέο conditional όταν προστέθηκε (source σωστό ΤΩΡΑ).
  ➡️ Giorgio: hard-refresh / restart `npm run dev` και re-verify· αν ΞΑΝΑ δεν φανεί → χρειάζεται ακριβές
  repro (καθαρό build). UNCOMMITTED. **ΕΠΙΒΕΒΑΙΩΘΗΚΕ** browser: το «Σύμβολα» εμφανίζεται σωστά (native/geometry).
- **2026-07-09** — Φ-texts (TEK **type-3 `<text>` export**, Opus, follow-up: «στον Τέκτονα δεν φαίνονται
  τα κείμενα N/A/1/0.00 + scale-bar νούμερα»). **Ground-truth:** ο Τέκτων ΕΧΕΙ text primitive (entity
  type 3)· εξήχθη verified standalone `<text>` record από `Θέρμη 2.tek` (`<font>30`, `<s>` inline,
  `<color>`, `<abssize>0`, `<hallign>`, `<vallign>`, `<ttfont><ptsize>`, `<xmatrix>`). Το προηγούμενο
  «no free-text collector» ήταν deferral, ΟΧΙ αδυναμία format. **Υλοποίηση (SSoT):** νέο marker
  `<!--TEK_TEXT_RECORDS-->` στο κενό `<text>` container του skeleton· νέο `TEXT_RECORD_TEMPLATE`
  (καθαρό label: χωρίς leader/margins)· `TekText` type· `buildTextRecordXml` (escape + grouping tag στο
  `<taglist>`, SSoT `injectTag`)· `collectTekTexts` (text primitives → records, θέση Y-flip μέσω SSoT
  `sceneXYToTekMeters`, περιστροφή μέσω SSoT `buildSymbolObjectXMatrix` scale=1 όπως real records,
  `alignment`→`hallign` [validated round-trip με import], `vBaseline`→`vallign`, ptsize από ύψος)·
  `injectTekEntities` +`textsXml`· adapter wiring + merge tags στο registry. Tests: +6 (writer+collector),
  όλα GREEN (εκτός 6 pre-existing κουφώματα)· jscpd clean· files<500/fns<40· no `any`/inline/hardcoded.
  UNCOMMITTED. **Anchor fix (same day, browser-calibrated):** ο Giorgio ανέφερε ότι τα κείμενα έπεφταν
  **ΚΑΤΩ-ΔΕΞΙΑ** του σωστού κέντρου → ο Τέκτων αγκυρώνει το text box στην **πάνω-αριστερή γωνία** στο
  (x20,x21) και **ΔΕΝ** τιμά hallign/vallign για τη θέση. Διόρθωση: το `collectTekTexts` υπολογίζει ΕΜΕΙΣ
  την πάνω-αριστερή γωνία από `position`(=alignment anchor) + `alignment`/`vBaseline` + εκτίμηση
  πλάτους/ύψους (`textTopLeft` + `estimateTextWidthMeters`, advance ≈0.62×cap-height, tunable). +2 tests.
  🔴 re-verify browser. Μέγεθος (ptsize↔μέτρα ανά drawing-scale) + char-advance factor = tunable.
  **Φ-fill (συμπαγή τρίγωνα + scale-bar εναλλαγή) = επόμενο increment** (Tekton δεν έχει solid-fill
  primitive → scanline line-hatch).
- **2026-07-09** — Φ-import (πλήρης ταυτοποίηση native συμβόλων στο ΦΟΡΤΩΜΑ `.tek`, Opus, μετά από
  αίτημα Giorgio «πλήρη ταύτιση με τα native σύμβολα του Τέκτονα σε export ΚΑΙ import»). **Ground-truth
  (τοπική εγκατάσταση Fespa-Tekton v9.1):** ο κατάλογος `Obj.inf` = 1638 εγγραφές
  (`index:lib/*.asc:Ελληνικό όνομα:icon:3D`), όπου ο **index = ο `type_res`** των type-7 `<object>`
  records· 53 από αυτές = σύμβολα σχεδίασης (`obj/symbols`). Επιβεβαιώθηκε ότι η γεωμετρία κάθε
  συμβόλου (`lib/*.asc`) είναι στο ΙΔΙΟ `#!TEKTON` text format. **Απόφαση Giorgio:** index round-trip
  μόνο — καμία αντιγραφή `.asc`/`.icn` της LH Software (IP)· ζωγραφίζουμε ΔΙΚΑ μας σύμβολα.
  **Πρόβλημα:** το export ταύτιζε ήδη (8 σύμβολα → `type_res`), αλλά ο import **αγνοούσε εντελώς**
  τα type-7 `<object>` → native σύμβολα Τέκτονα χάνονταν σιωπηλά στο φόρτωμα. **Υλοποίηση:**
  ο `tek-symbol-catalog.ts` έγινε αμφίδρομο SSoT (ΕΝΑ `MATCHED_SYMBOLS` → `tekSymbolTypeRes` export
  ΚΑΙ `tekSymbolFromTypeRes` import) + `TEKTON_SYMBOL_NAMES` (53 index↔ονόματα, μόνο data)· νέος
  `io/tek/tek-object-extract.ts` (`extractObjectRecords`, ο `type_res` = 2ο `<type>`)· νέο
  `TekObjectRecord` (+`objects` στο `TekSceneParseResult`)· νέος mapper `io/tek/tek-object-to-scene.ts`
  (`tekObjectToEntity` → `AnnotationSymbolEntity` με Y-flip convention του text mapper· unmatched →
  ονομαστικό warning)· wiring σε `tek-scene-extract.ts` + `tek-scene-builder.ts`. Tests: +19
  (object-extract 5, object-to-scene 7, round-trip export→import 7). Τα 3 νέα suites GREEN· όλα τα
  υπόλοιπα TEK suites GREEN (186) εκτός των 4 pre-existing `collectTekWalls — κουφώματα`
  (opening-geometry WIP άλλου agent — ΟΧΙ αυτή η αλλαγή). files<500/fns<40· no `any`/inline/hardcoded.
  UNCOMMITTED. 🔴 browser-verify: φόρτωσε `.tek` με native βορρά/στάθμη/τομή → εμφανίζονται ως δικά
  μας σύμβολα· τα υπόλοιπα (άνθρωποι/αυτοκίνητα/βέλη) καταγράφονται ονομαστικά στα warnings.
  **Follow-up (Φάση 2, αν χρειαστεί):** τα 1638 έπιπλα/αρχιτεκτονικά· placeholder-με-ετικέτα για τα
  ~43 σύμβολα χωρίς δικό μας equivalent· ρύθμιση native μεγέθους από `sizeMm`.
- **2026-07-09** — Φ-import-glyphs Φάση Α (δικά μας «πιστά» βέλη, Opus, μετά από αίτημα Giorgio να
  εμφανίζονται τα ~43 σύμβολα χωρίς equivalent αντί warning). **Νομικό (απόφαση Giorgio):** ΟΧΙ
  αντιγραφή `.asc` γεωμετρίας LH (ούτε «+τελίτσα» — δεν ξεπλένει copyright)· σχεδιάζουμε ΔΙΚΑ μας
  σύμβολα βάσει της σχεδιαστικής σύμβασης (τυποποιημένα → merger doctrine, ελάχιστη προστασία). Web
  app → ο browser δεν διαβάζει τοπικά `.asc`, οπότε bundling μετατραπείσας LH-γεωμετρίας απορρίφθηκε.
  **Αρχιτεκτονική (γιατί μικρό):** ο renderer είναι kind-agnostic + ο import mapper γενικός → ανά νέο
  σύμβολο αλλάζουν ΜΟΝΟ 4 σημεία (union kind + catalog glyph + reverse map + i18n)· mapper/extractor/
  renderer ΑΝΕΠΑΦΑ. **Υλοποίηση:** νέο kind `direction-arrow` (`types/annotation-symbol.ts`, χωρίς
  placement tool — υποστηρίζεται)· 4 glyphs στο `annotation-symbol-catalog.ts` (`directionArrowSingle/
  Double/Outline`, `entranceArrow`· οριζόντια +X όπως `velos1.asc`· νέος helper `rightArrowHead` για
  μη-clone μύτη)· `MATCHED_SYMBOLS` += 380/381/382/126· i18n `annotationSymbol.directionArrow.*` el+en.
  Tests: +8 (catalog direction-arrow 5, round-trip 4 βέλη + 3 προϋπάρχοντα) — 28 tek-object GREEN·
  jscpd:diff clean· no `any`/inline/hardcoded. UNCOMMITTED. 🔴 browser-verify: φόρτωσε
  `test-symbols-tekton.tek` → τα 4 βέλη εμφανίζονται (type_res 380/381/382/126). ⚠️ Ο ΑΚΡΙΒΗΣ
  προσανατολισμός βελών (authored +X vs Tekton) = tunable αν βγει στραμμένο σε πραγματικό αρχείο.
  **Φάση Β (επόμενο):** kinds `person`/`vehicle`/`fixture` για άνθρωπους/αυτοκίνητα/ανελκυστήρες.
- **2026-07-09** — Φ-import-svg (SVG-based σύμβολα από **πρωτότυπα σχέδια χρήστη**, Opus). Ο Giorgio,
  βλέποντας ότι τα δικά μας primitive-σχέδια ≠ οπτικά με του Τέκτονα, επέλεξε να **σχεδιάζει ο ίδιος
  SVG** (δικές του γραμμές, καμία αντιγραφή LH — IP-καθαρό) και να τα αντιστοιχίζουμε στα type_res.
  **Νέα δυνατότητα (γενικεύεται σε ΟΛΑ τα σύμβολα):** νέος primitive τύπος `svg`
  (`config/annotation-symbol-svg-types.ts`: `AnnotationSymbolSvg` = viewBox + elements path/circle/
  line) στο `AnnotationSymbolPrimitive` union· ο `AnnotationSymbolRenderer` απέκτησε `stampSvgGlyph`
  που ζωγραφίζει με native **`Path2D`** (Bézier support) κάτω από affine viewBox→output **υπολογισμένο
  εμπειρικά** από `toScreen` σε [0,0]/[1,0]/[0,1] (δουλεύει με οποιοδήποτε worldToScreen· εφαρμογή ως
  σχετικό `ctx.transform` → συνθέτει με DPR)· lineWidth /svgScale για σταθερό ορατό πάχος. **POC:**
  `family.svg` (άνδρας/γυναίκα/παιδί) → `config/annotation-symbol-svg/family-glyph.ts` → σύμβολο
  `personFamily` (νέο kind `person`)· `MATCHED_SYMBOLS` += 52 (Άνθρωποι 1)· i18n `annotationSymbol.
  person.family`. Tests: +3 (svg-family catalog + reverse map 52). 27 GREEN· jscpd:diff clean· no
  `any`/inline/hardcoded. UNCOMMITTED. 🔴 browser-verify (ΑΠΑΡΑΙΤΗΤΟ — δεν επικυρώθηκε οπτικά):
  φόρτωσε `test-symbols-tekton.tek` → στη θέση type_res 52 πρέπει να δεις την **οικογένεια** (SVG).
  ⚠️ ΓΝΩΣΤΑ tunables: (1) **προσανατολισμός** (SVG-Y-down flip· head-up), (2) **μέγεθος** — τα σύμβολα
  Τέκτονα είναι model-sized (~1.8m άνθρωπος), τα δικά μας paper-annotative (`sizeMm`=15mm) → πιθανό
  μικρό· ίσως χρειαστεί model-space sizing για `person`/`vehicle`, (3) **θέση** (κέντρο viewBox = anchor).
  **Επόμενο:** ο Giorgio σχεδιάζει SVG για τα υπόλοιπα σύμβολα· εμείς 1 data file + 1 catalog entry +
  1 mapping ανά σύμβολο (μηδέν νέος render κώδικας).

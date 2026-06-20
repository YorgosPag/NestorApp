# ADR-505 — Unified Export System (DXF / IFC4 / PDF, scope-filtered, multi-floor)

**Status:** ✅ BROWSER-VERIFIED (Τέκτονας/FESPA 2Δ + AutoCAD 2Δ/3Δ) · DXF πλήρες (active+zip+single, dual-mode polyline/lines, ACI χρώμα, generic BIM/Η-Μ, 3Δ extrusion) · IFC/PDF μέσω delegation — UNCOMMITTED 2026-06-20 · 🔴 ΜΟΝΟ commit (stage ADR-505, CHECK 6B/6D)
**Status (finish/rebar phase, §C):** ⏳ Τέκτονας ✅ (σοβάδες+οπλισμός σωστά) · AutoCAD hardening εφαρμόστηκε (ASCII layers `FINISH`/`REBAR` + closed finish prism + degenerate-circle guard) — UNCOMMITTED 2026-06-20 · 🔴 re-verify AutoCAD + commit
**Date:** 2026-06-20
**Category:** Entity Systems / DXF Viewer Output
**Author:** Γιώργος Παγώνης + Claude Code (Anthropic AI)
**Σχετικά:** ADR-052 (DXF export API contract), ADR-369 (IFC4 exporter), ADR-453 (Print/Export engine), ADR-040 (micro-leaf perf), ADR-001 (Radix Select)

---

## 1. Πρόβλημα (Giorgio)

Στη σελίδα `/dxf/viewer`, με οντότητες **DXF** (line/arc/text…) και **BIM** (wall/column/beam/slab…) μέσα στα επίπεδα ορόφων, **δεν υπήρχε εξαγωγή σε αρχείο** — μόνο Print→PDF (ADR-453). Ζητούμενο (Revit-grade, full enterprise + full SSoT):

1. Εξαγωγή σε **DXF** (προτεραιότητα #1), **IFC4**, **PDF**.
2. **Φίλτρο περιεχομένου**: μόνο DXF / μόνο BIM / και τα δύο.
3. **Scope ορόφων**: ενεργός / όλοι→ZIP (ένα αρχείο ανά όροφο) / όλοι→ένα αρχείο (layer-prefix ανά όροφο).

## 2. Απόφαση — αρχιτεκτονική (Full SSoT)

Νέος φάκελος `src/subapps/dxf-viewer/export/` (mirror του `print/`): pure core → format adapter → service facade → UI. Format routing **χωρίς διπλό engine**:

| Format | Μηχανή | Σημείωση |
|--------|--------|----------|
| **DXF** | νέο unified pipeline | content scope + multi-floor ζουν εδώ |
| **IFC4** | delegation → `bim:ifc-export-requested` (ADR-369 `IfcExportHost`) | whole-project, BIM-only |
| **PDF** | delegation → `dxf:print-dialog-requested` (ADR-453 `PrintHost`) | canvas snapshot |

### Core SSoT (pure)
- `core/export-entity-scope.ts` — content filter `resolveExportEntities`, **reuse `isBimEntity()`** (καμία 2η hardcoded λίστα τύπων).
- `core/bim-to-dxf-primitives.ts` — `decomposeBimEntityToDxfPrimitives`: διαβάζει το **cached `BimEntity.geometry`** (ίδιο που σχεδιάζει ο 2D renderer → «export what you draw») και βγάζει `lwpolyline` (wall=outer+reversed inner· column=footprint· slab=polygon· beam=outline). Άγνωστος τύπος → skip + warning.
- `core/export-floor-scope.ts` — `resolveExportFloors` (active/all-zip/all-single) + `FLnn_` layer prefix.
- `core/zip-pack.ts` — **owned, zero-dependency STORED-zip writer** (CRC-32 + local headers + central dir + EOCD, UTF-8 filenames). Αντί `fflate`: ο host npm/arborist έσπαγε σε κάθε add (`Link.matches` null)· owned writer = μηδέν license surface (N.5) + immune.

### Pipeline / IO
- `core/dxf-ascii-writer.ts` — **client-side DXF writer** (pure, zero-dep), **Tekton (Τέκτονας/FESPA)-compatible minimal dialect**. Το DXF παράγεται **εξ ολοκλήρου στον browser** — κανένα Python/Docker/microservice. **ΚΡΙΣΙΜΟ (reference Tekton .dxf):** ο parser του Τέκτονα διαβάζει ΜΟΝΟ `LINE`/`TEXT`/`CIRCLE` σε bare `ENTITIES` (χωρίς HEADER/TABLES, coords-then-layer, χωρίς Z)· **αγνοεί POLYLINE/LWPOLYLINE/ARC** → η 1η έκδοση «δεν έδειχνε τίποτα» (τα BIM ήταν POLYLINE). Fix: explode κάθε polyline/rectangle/BIM-footprint → `LINE` segments· tessellate `ARC` → `LINE`· κράτα `CIRCLE`/`TEXT`· coords scaled στη μονάδα εξόδου (Tekton=μέτρα) μέσω `coordinateScale` (`mmToSceneUnits(target)/mmToSceneUnits(scene)`). (Ο ezdxf proxy route+client αφαιρέθηκαν: no Docker.)
- `formats/dxf-export-adapter.ts` — `buildDxfExportRequest` (pure) + `renderDxfBlob` (writer→Blob) + `exportFloorToDxf` + `mergeFloorsToSingleDxfScene` (all-single namespacing).
- `export-service.ts` — `runExport` facade: dispatch → multi-floor packaging → `triggerExportDownload`. Throws on error (dialog catches).

### UI (ADR-040-safe — μηδέν high-freq subscription στον dialog)
- `app/ExportHost.tsx` (lazy leaf στο `DxfViewerDialogs`) — EventBus `dxf:export-dialog-requested`, μαζεύει per-level scenes + projectId/buildingId, format routing.
- `ui/components/export/{ExportDialog,useExportDialogState}.tsx` — Radix dialog (ADR-001 Select), 3 άξονες + DXF version/unit. Όλα τα strings i18n (`export.*`, N.11).
- Ribbon: νέο `EXPORT_PANEL` στο `analyze-tab` (action `open-export-dialog` → EventBus, mirror Print).

## 3. Reuse (μηδέν αναπαραγωγή)
`isBimEntity` · `BimEntity.geometry` (wall/column/slab/beam) · `IfcExporter`+`IfcExportHost` (delegation) · `runPrint`/`PrintHost` (delegation) · `triggerExportDownload` · `useLevels().getLevelScene` · Print dialog Host→EventBus→Dialog pattern.

## 4. Tests
44 jest (export core + adapter + zip + DXF writer): scope partition, BIM→primitive, floor resolution + prefix, merge namespacing, CRC-32 vector, EOCD structure, filename safety, Tekton-dialect (bare ENTITIES, LINE-no-Z, POLYLINE→explode, ARC→tessellate, coord-scale, ACI colour code 62). tsc clean (export files).

## 5. Εκκρεμότητες / DEFER
- 🔴 browser-verify (DXF active/zip/single → άνοιγμα σε CAD viewer· IFC/PDF delegation) + commit.
- DXF writer = R12 βασικά primitives (LINE/CIRCLE/ARC/TEXT/POINT/POLYLINE + BIM footprints). DEFER: spline/ellipse/hatch/dimension/leader native serialization (σήμερα skip). Ο ezdxf microservice (`services/dxf-export/`, ADR-052) παραμένει ως προαιρετικός richer path — δεν wired (no Docker στον host).
- DXF content/floor selectors **αγνοούνται** στο IFC/PDF (delegation σε project-scoped/canvas engines).
- BIM→DXF decomposition καλύπτει wall/column/slab/beam/foundation/opening/roof/furniture/floorplan-symbol + όλα τα Η/Μ (footprint/outline/polygon convention)· railing/stair (path/stringer) → skip+warning.
- Y-axis convention: το DXF γράφει raw scene coords — αν φανεί mirrored σε CAD, one-line flip στον writer.

## C. Εξαγωγή σοβάδων (finish) + οπλισμού (reinforcement) — overlay collector (Full SSoT)

Σοβάδες + οπλισμός **ΔΕΝ είναι `scene.entities`** — είναι derived overlays (όπως τα διαγράμματα M/V/N) → ο βασικός pipeline (που διαβάζει `scene.entities`) δεν τα έπιανε. Λύση **full SSoT, μία πηγή γεωμετρίας → canvas + DXF**:

- **NEW shared plan-geometry SSoT** (world coords, ZERO ctx) — εξήχθη από τα «σώματα» των 2Δ draw helpers ώστε να τα καταναλώνουν ΚΑΙ οι renderers ΚΑΙ ο export collector (μηδέν δεύτερη διάσχιση layout):
  - `bim/structural/reinforcement/{rebar-plan-geometry-types, column-rebar-plan-geometry, linear-member-rebar-plan-geometry, footing-rebar-plan-geometry, slab-rebar-plan-geometry}.ts` — καλούν τα ΥΠΑΡΧΟΝΤΑ layout SSoT (`resolveColumnRebarLayout`/`resolveActiveBeamRebarLayout`/footing/slab + `columnLocalMmToWorld`/`samplePolylineFrame`)· slab clip μέσω `coveredIntervals` (αντί ctx.clip).
  - `bim/finishes/structural-finish-plan-geometry.ts` — `collectFinishOutlinePlanPolylines` (world λωρίδες μέσω `computeMiteredOuter`, +χρώμα υλικού +ύψος ζώνης).
- **Refactor 5 renderers → thin consumers** (behavior-preserving): `column-/linear-member-/footing-/slab-rebar-2d.ts` + `structural-finish-outline-2d.ts`.
- **NEW `export/core/overlay-dxf-collector.ts`** — `collectOverlayDxfEntities(entities, {componentVisible})`: gating «export what's visible» (`isStructuralComponentVisible('plaster'|'reinforcement', e)`, per-element override→per-view) → finish (`computeStructuralFinishSilhouette`, ίδιο SSoT με 2Δ/3Δ) ως **extruded** lwpolyline (group-39 ύψος ζώνης) + οπλισμός (κολώνα/δοκάρι/πέδιλο/πλάκα) ως lwpolyline + circle (διαμήκεις κουκκίδες). Layers (Revit subcategories): `FINISH` / `REBAR`.
- **Wiring** στο `dxf-export-adapter.ts` (`buildDxfExportRequest` + `mergeFloorsToSingleDxfScene` με `FLnn_` prefix), gated στο scope (dxf-only → μηδέν overlays).
- **AutoCAD hardening** (Τέκτονας τα διάβαζε, AutoCAD «κολλούσε»): (1) **ASCII** layer names — ο writer βγάζει bare DXF χωρίς HEADER/`$DWGCODEPAGE` → ο AutoCAD υποθέτει ANSI και σκαλώνει σε UTF-8 ελληνικά layer names· (2) finish polyline **closed** (καθαρό extruded prism = verified body μονοπάτι, όχι open-poly-with-thickness)· (3) skip degenerate circle (radius≤ε = invalid AutoCAD audit).

## Changelog
- **2026-06-20 (j)** — **Finish/rebar phase (§C):** εξαγωγή σοβάδων + οπλισμού ως derived-overlay collector, full SSoT (5 NEW plan-geometry modules + 1 finish + collector· 5 renderers → thin consumers· wiring adapter). Gating «what's visible». Browser-verify: **Τέκτονας ✅** σοβάδες+οπλισμός σωστά· **AutoCAD «κολλούσε»** → hardening (ASCII layers `FINISH`/`REBAR`, closed finish prism, degenerate-circle guard). 22 jest (8 NEW finish-plan-geo + overlay-collector, 14 affected GREEN), tsc clean. 🔴 re-verify AutoCAD + commit.
- **2026-06-20** — Αρχική υλοποίηση: DXF pipeline (active/zip/single) + scope filter + owned zip writer + UI dialog/ribbon + i18n el/en + IFC/PDF delegation. **Client-side DXF writer** αντί ezdxf proxy → μηδέν backend (no Docker στον host)· route+client αφαιρέθηκαν.
- **2026-06-20 (b)** — Tekton-compat fix: reference `.dxf` του Τέκτονα έδειξε ότι ο parser του διαβάζει μόνο LINE/TEXT/CIRCLE (bare ENTITIES, no Z)· η 1η έκδοση «δεν έδειχνε τίποτα» (BIM=POLYLINE αγνοούμενο). Writer ξαναγράφτηκε: explode polyline/rect/BIM→LINE· ARC→tessellation· coord scaling στη μονάδα εξόδου. 39 jest, tsc clean. UNCOMMITTED.
- **2026-06-20 (c)** — Browser-verify #1: Τέκτονας ΔΙΑΒΑΣΕ τις οντότητες αλλά warning «ορατές οντότητες >4.000μ από κέντρο» — coords σε mm (~11185) διαβάζονται ως μέτρα. Fix: dialog default unit `millimeters`→`meters` (`DEFAULT_EXPORT_UNIT` στο `useExportDialogState`· Tekton/FESPA δουλεύει σε μέτρα).
- **2026-06-20 (d)** — Browser-verify #2: δουλεύει & σωστή κλίμακα, αλλά **όλες οι γραμμές κόκκινες** (ο writer δεν έγραφε χρώμα). Fix: per-entity ACI colour (code 62)· **reuse SSoT `hexToAci`** (Euclidean nearest-match, `ui/text-toolbar/controls/aci-palette`)· exploded BIM segments κληρονομούν το χρώμα.
- **2026-06-20 (e)** — Browser-verify #3: «όλες λευκές» — τα BIM δεν έχουν `entity.color` hex (το χρώμα τους = category/visual-style στον renderer, ADR-445) → cascade έπεφτε σε ACI 7. Fix: ο adapter κάνει **stamp του rendered hex πριν το decomposition** μέσω SSoT `resolveEntityColorHex` (`systems/selection/select-similar-by-color`· χειρίζεται BIM category + ByLayer/ACI/TrueColor όπως ο canvas).
- **2026-06-20 (h)** — Browser-verify #6: «γιατί τα BIM δεν είναι 3Δ στο AutoCAD;» — εξάγαμε 2Δ footprint. Fix: **pseudo-3D extrusion** (DXF group 39 thickness στο POLYLINE → AutoCAD το σηκώνει σε 3Δ πρίσμα). ΜΟΝΟ polyline mode (Τέκτονας/lines=2Δ).
- **2026-06-20 (i)** — Browser-verify #7: extrusion έβγαινε `39=0.003` (3mm!) — λάθος πηγή ύψους: το `geometry.bbox` είναι **2Δ footprint (z≈0)**, ΟΧΙ το ύψος. Fix: `extractHeightMm` διαβάζει από **params** (mm SSoT): `geometry.height`(column)→`params.height`(wall)→`depth`(beam)→`thickness`(slab)→`thicknessMm`(foundation)→`bodyHeightMm`(MEP)· νέο `mmScale=mmToOutputScale` (mm→μονάδα εξόδου, ανεξάρτητο από coord scale· το ύψος είναι mm ενώ τα coords canvas-units). 55 jest. Re-verify pending.
- **2026-06-20 (g)** — Browser-verify #5: AutoCAD έβγαζε τα πάντα **LINE αντί POLYLINE** (το explode του Τέκτονα έσπασε το AutoCAD experience). Fix χωρίς trade-off: **dual-mode writer** + dialog selector «Συμβατότητα» — `polyline` (default, AutoCAD: POLYLINE/VERTEX/SEQEND + native ARC) / `lines` (Τέκτονας: explode→LINE + tessellate ARC). `DxfLineMode` type· threaded request→dialog→adapter→writer· i18n el/en. Κανένα mode δεν χαλάει το άλλο (ίδια data, διαφορετική granularity). 50 jest. Re-verify pending.
- **2026-06-20 (f)** — Browser-verify #4: «δεν εξάγει αρχιτεκτονικά BIM / Η/Μ» — το decomposition κάλυπτε μόνο wall/column/slab/beam. Fix: **γενίκευση** — όλοι οι BIM τύποι cache-άρουν plan polygon σε `footprint`/`outline`/`polygon` (Polygon3D)· ένας generic extractor (`extractFootprintVertices`) καλύπτει foundation/opening/roof/furniture/floorplan-symbol + **ΟΛΑ τα Η/Μ** (mep-fixture/segment/fitting/manifold/electrical-panel) + future types. wall=special outer+inner. 47 jest. DEFER: railing (path-based)/stair (stringer) — δεν ακολουθούν τη convention. Re-verify pending.

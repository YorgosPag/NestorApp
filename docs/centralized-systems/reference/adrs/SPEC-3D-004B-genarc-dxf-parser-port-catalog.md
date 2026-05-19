# SPEC-3D-004B — GenArc DXF Parser Port Catalog

| Πεδίο | Τιμή |
|---|---|
| **Status** | 🟢 **COMPLETE** 2026-05-19 — full catalog, conclusion: ZERO port from GenArc DXF domain |
| **Date** | 2026-05-19 |
| **Category** | DXF Viewer — 3D Rendering / GenArc Port Sub-Spec |
| **Location** | `docs/centralized-systems/reference/adrs/SPEC-3D-004B-genarc-dxf-parser-port-catalog.md` |
| **Author** | Claude Opus 4.7 + Γιώργος Παγώνης |
| **Parent ADR** | ADR-366 (3D BIM Viewer & Photorealistic Rendering) |
| **Source** | `C:\genarc\src\engines\dxf\` (6 files) + `C:\genarc\src\types\dxf*.types.ts` (2 files) — total **8 files, ~1.250 LOC** |
| **Sibling SPECs** | SPEC-3D-004A ✅ (Viewport), SPEC-3D-004C (Utils/Snap/Picking, TBD), SPEC-3D-004D (Geometry Helpers, TBD), SPEC-3D-004E (Materials/Shaders, TBD) |

---

## Executive Summary

Πλήρης διερεύνηση και των 8 αρχείων του `engines/dxf/` + `types/dxf*.types.ts` στο GenArc. **Αποτέλεσμα: 0 PORT_AS_IS, 0 PORT_WITH_ADAPTATION, 0 EXTRACT_CONCEPT για ADR-366. 8 EXCLUDE.**

**Κεντρικό εύρημα**: Το GenArc DXF domain είναι **εξειδικευμένο σε topographic plot boundary extraction** (ΕΓΣΑ'87 ελληνικό τοπογραφικό σύστημα, χρήση npm `dxf-parser` + GPT-4o για παραγωγή ΝΟΚ-ready JSON). **Δεν είναι generic DXF parser, δεν είναι rendering pipeline, και δεν παράγει 3D output.** Ο σκοπός του είναι: «πάρε DXF τοπογραφικού οικοπέδου, βρες το πολύγωνο του οικοπέδου + τα πρόσωπα + τα P= πλάτη δρόμων, και στείλε τα στο GPT-4o για παραγωγή `topographic.json` συμβατό με το site.store του GenArc».

**Nestor ήδη έχει mature DXF parser** με πολύ μεγαλύτερη επιφάνεια:

| Διάσταση | Nestor parser | GenArc parser |
|---|---|---|
| **Library** | Custom `DxfSceneBuilder` + Web Worker | npm `dxf-parser` |
| **Supported entities** | 15 (LINE/LWPOLYLINE/CIRCLE/ARC/TEXT/MTEXT/INSERT/SPLINE/ELLIPSE/DIMENSION/HATCH/SOLID/XLINE/RAY/MULTILINETEXT) | 3 γεωμετρίας (LINE/LWPOLYLINE/POLYLINE) + 3 annotations (TEXT/MTEXT/DIMENSION) |
| **HEADER parsing** | $INSUNITS, $DIMSCALE, $DIMTXT, $CANNOSCALEVALUE, $MEASUREMENT | — (τίποτα) |
| **DIMSTYLE table** | Full ~40 fields (ADR-362 H1 roundtrip) | — |
| **LAYER table** | ACI colors + visibility + frozen state | Layer names only |
| **Unit conversion** | INSUNITS_TO_MM 20-entry table | — (units αγνοούνται, υποθέτει μέτρα) |
| **Coordinate system** | Generic (mm internal, INSUNITS-aware) | ΕΓΣΑ'87-specific (assumes x>100.000 → real-world) |
| **Output** | `DxfScene` με `DxfEntityUnion` (rich entity wrappers + BIM wrappers: stair/dimension/slab/opening) | `DxfIntermediate` (compact polygons + texts) για GPT-4o |
| **Rendering** | Πλήρες pipeline ADR-040 (bitmap cache, micro-leaf, 60fps target) | SVG-based 2D wizard (single-purpose UI) |
| **3D readiness** | Point3D-ready entities (ADR-363 §G11) | Καθαρά 2D, καμία υποστήριξη Z |

**Συμπέρασμα για ADR-366 SPEC-3D-001 (DXF→Three.js Pipeline)**: Το mapping table του ADR-366 §5.1 (LINE→LineSegments, ARC→EllipseCurve, κ.λπ.) **πρέπει να χτιστεί από scratch** ως **converter** πάνω στο `DxfEntityUnion` του Nestor (`canvas-v2/dxf-canvas/dxf-types.ts:188`), **όχι** ως νέος parser. **Καμία αξία port από `engines/dxf/` του GenArc για ADR-366.**

| Κατηγορία | Files | LOC | Λόγος |
|---|---:|---:|---|
| **PORT_AS_IS** | 0 | 0 | — |
| **PORT_WITH_ADAPTATION** | 0 | 0 | — |
| **EXTRACT_CONCEPT** | 0 | 0 | Σημείωση: 2 αλγόριθμοι (greedy chain assembly, multi-signal polygon scoring) έχουν αξία αλλά **σε εντελώς διαφορετικό domain** (μελλοντικό Topographic Import Wizard για Nestor) — βλ. §6. **Δεν αφορούν ADR-366.** |
| **EXCLUDE** | 8 | ~1.250 | Νestor έχει mature parser + GenArc είναι topographic/ΝΟΚ/AI-pipeline, εκτός scope ADR-366 |

---

## 1. Methodology

Ίδια με SPEC-3D-004A:

| Κατηγορία | Κριτήριο |
|---|---|
| **PORT_AS_IS** | Zero GenArc deps, καθαρή utility, immediate value για ADR-366 SPEC-3D-001 |
| **PORT_WITH_ADAPTATION** | 1-3 GenArc-specific deps που μπορούν να αλλάξουν σε Nestor equivalents |
| **EXTRACT_CONCEPT** | Heavy coupling αλλά algorithm/pattern πολύτιμο για 3D pipeline |
| **EXCLUDE** | (a) Nestor ήδη έχει mature equivalent (canvas-v2/dxf-canvas, utils/dxf-entity-parser, workers/dxf-parser.worker), ή (b) GenArc-specific (τοπογραφικό/ΕΓΣΑ'87/ΝΟΚ/GPT-4o pipeline) |

**Έλεγχοι που έγιναν ανά αρχείο**:
1. Imports analysis — `grep -E "from '@/engines/ai|@/stores|@/types/dxf|dxf-parser"` 
2. Full read του αρχείου (όλα ≤ 440 LOC)
3. Διασταύρωση με Nestor parser surface (`utils/dxf-parser-types.ts`, `workers/dxf-parser.worker.ts`, `utils/dxf-entity-parser.ts`)

---

## 2. PORT_AS_IS Files

**Κανένα αρχείο.** Όλα έχουν τουλάχιστον μία από:
- Εξάρτηση από `@/engines/ai/aiService` (GPT-4o client)
- Εξάρτηση από `@/types/dxf.types` (GenArc-specific `DxfIntermediate`/`FrontageHint` types)
- Domain coupling με ΕΓΣΑ'87 / ΝΟΚ / topographic-only logic

---

## 3. PORT_WITH_ADAPTATION Files

**Κανένα αρχείο.** Adaptation cost > rewrite cost σε όλες τις περιπτώσεις, επειδή το data model του Nestor (`DxfEntityUnion`) είναι πλουσιότερο και ασύμβατο με το GenArc `DxfIntermediate`.

---

## 4. EXTRACT_CONCEPT Files

**Κανένα αρχείο για ADR-366 scope.** Δύο αλγόριθμοι έχουν θεωρητική αξία για **μελλοντικό, ξεχωριστό feature** (Topographic Import Wizard), αλλά δεν αφορούν 3D BIM rendering — βλ. §6 "Out-of-scope extractable algorithms".

---

## 5. EXCLUDE Files (8 files, ~1.250 LOC)

### 5.1 `engines/dxf/dxfParser.ts` — 322 LOC

**Σκοπός**: Topographic-only parser. Παίρνει DXF text → `DxfIntermediate` (compact JSON για GPT-4o).

**Τι κάνει**:
- Καλεί npm `dxf-parser` για raw entities
- Φιλτράρει σε 3 entity types: LWPOLYLINE/POLYLINE/LINE (γεωμετρία) + TEXT/MTEXT/DIMENSION (annotations)
- Greedy chain assembly: συναρμολογεί closed polygons από disconnected LINE entities (Greek topographic DXFs συχνά σχεδιάζουν τα όρια οικοπέδων ως ξεχωριστές LINEs)
- Καλεί `sortByPlotScore` (multi-signal heuristic για ranking) + `computeFrontageHints` (P= annotations → edge matching)
- Επιστρέφει top-10 polygons + top-80 texts + top-30 dimensions

**Γιατί EXCLUDE**:
1. Nestor `utils/dxf-entity-parser.ts` parses **15 entity types** (vs GenArc's 6), με full HEADER/DIMSTYLE/LAYER table support
2. Nestor parsing γίνεται **σε Web Worker** (off-main-thread), GenArc τρέχει sync στο main thread
3. ΕΓΣΑ'87-specific code paths (`x > 100_000` checks) δεν έχουν νόημα για generic BIM viewer
4. Output format `DxfIntermediate` είναι compact summarisation για AI prompt — όχι rendering pipeline input

**Effort να αντικατασταθεί ο Nestor parser με αυτόν**: Αρνητική αξία (regression).

---

### 5.2 `engines/dxf/dxfSceneParser.ts` — 440 LOC

**Σκοπός**: Παράγει `DxfScene` (flat segments για SVG rendering) **και** `DxfIntermediate` (για wizard fallback / GPT-4o). Επιπλέον helpers: `assembleSegmentsToPolygon`, `assembleSegmentsToPolyline`, `findCollinearChainIds`.

**Τι κάνει**:
- Παίρνει DXF text → flat `DxfSegment[]` (μόνο LINE/LWPOLYLINE/POLYLINE → line segments)
- `findCollinearChainIds` — BFS chain που ακολουθεί collinear segments (±15°) στο ίδιο layer, με optional radius/length filters. Χρήσιμο για detection διακεκομμένων γραμμών (dashed lines στις περιφέρειες οδών)
- `assembleSegmentsToPolygon` — greedy chain για closed polygon από user-selected segments (wizard step 1)
- `stripMtextCodes` — απογυμνώνει RTF-like control codes από MTEXT content

**Γιατί EXCLUDE**:
1. `DxfSegment` flat data model = downgrade σε σχέση με Nestor's `DxfEntityUnion` (που διατηρεί entity identity + style metadata)
2. SVG-rendering oriented, όχι Three.js / Canvas2D bitmap pipeline (ADR-040)
3. Το `assembleSegmentsToPolygon` είναι wizard UX helper (συναρμολόγηση ορίου οικοπέδου από clicks) — εκτός scope ADR-366
4. Το `findCollinearChainIds` είναι **legitimately interesting algorithm** για dashed-line consolidation, αλλά: (a) εφαρμόζεται σε topographic context (διακεκομμένη ρυμοτομική γραμμή), (b) Nestor's BIM workflow δεν χρειάζεται dashed-to-continuous merge σε parse-time, (c) `stripMtextCodes` το έχει ήδη η Nestor μέσω του `text-engine/`

**Σημείωση gap analysis**: Nestor's MTEXT pipeline υποστηρίζει rich text styles (ADR-344 Phase 6.E). GenArc's `stripMtextCodes` είναι naive regex strip — υποδιάστατη implementation.

---

### 5.3 `engines/dxf/dxfPolygonScore.ts` — 127 LOC

**Σκοπός**: Multi-signal scoring για ranking candidate polygons ως plot boundary.

**Τι κάνει**:
- **Layer name scoring**: +100 αν περιέχει "ΟΙΚΟΠΕΔ"/"PLOT"/"BOUND"/"ΟΡΙΟ", −100 αν "ΠΛΑΙΣΙ"/"FRAME"/"TITLE"/"BUILDING"
- **Coordinate scoring**: +50 αν vertices σε ΕΓΣΑ'87 range (`x>100_000 OR y>1_000_000`), −50 αν drawing-units (`<1_000`)
- **Aspect ratio penalty**: −30 για 4-vertex rectangles με √2 ratio (A-paper title block)
- **Area scoring**: +10 αν 50-50.000 m², −20 αν >200.000 m²

**Γιατί EXCLUDE**:
1. **100% topographic domain**: Greek keywords (ΟΙΚΟΠΕΔ/ΟΡΙΟ), ΕΓΣΑ'87 coordinate ranges, ΝΟΚ-style plot area limits
2. ADR-366 viewer **δεν χρειάζεται plot detection** — όλα τα entities renderaρονται ομοιόμορφα στη σκηνή, χωρίς classification
3. Εφαρμόζεται **μόνο** στο GenArc Topographic Import Wizard (ADR-018 / ADR-021)

**Πιθανή μελλοντική αξία**: Αν η Nestor αναπτύξει **ξεχωριστό** Topographic Import feature, το pattern (multi-signal additive scoring) αξίζει αναφοράς. Δεν αφορά ADR-366.

---

### 5.4 `engines/dxf/dxfFrontageHints.ts` — 96 LOC

**Σκοπός**: Pre-compute frontage hints για GPT-4o, αντί να αφήνει το AI να κάνει spatial math.

**Τι κάνει**:
- Παίρνει το πολύγωνο του οικοπέδου + texts + dimensions
- Ψάχνει P= annotations (regex: `[PΠ]\s*[=:]\s*[\d.,]+` ή bare numbers 3-50 m)
- Για κάθε annotation, βρίσκει το nearest edge midpoint του πολυγώνου (snap tolerance 100m)
- Επιστρέφει `FrontageHint[] = { edgeIndex, P_m }[]`

**Γιατί EXCLUDE**:
1. **Pure ΝΟΚ domain**: P= = πλάτος δρόμου σε μέτρα, frontage = πρόσωπο οικοπέδου σε δρόμο
2. ADR-366 viewer **δεν έχει concept** "frontage" — αυτό είναι building code logic
3. Greek annotation regex (`Π=`) είναι domain-specific

---

### 5.5 `engines/dxf/dxfToTopographic.ts` — 114 LOC

**Σκοπός**: Στέλνει το `DxfIntermediate` στο GPT-4o και επιστρέφει topographic JSON συμβατό με `site.store importFromJson()`.

**Τι κάνει**:
- Sερialize `DxfIntermediate` → compact JSON string (2-decimal rounding, ~2K tokens)
- POST σε `client.chat.completions.create({ model: 'gpt-4o', response_format: 'json_object' })`
- System prompt 800 χαρακτήρων ελληνικά — οδηγίες για παραγωγή `{ identity, plot, faces, terrain, zone, vertices, frontageEdges }`
- Returns parsed JSON αντικείμενο

**Γιατί EXCLUDE**:
1. **AI pipeline καλούσε GPT-4o** — out of scope ADR-366 (το ADR ζητάει deterministic rendering, όχι AI)
2. Output `topographic.json` schema είναι GenArc-specific (ΝΟΚ-aware: KAEK, prefecture, SD, coverage_pct, maxHeight_m)
3. Nestor's AI Pipeline (ADR-080 series) χρησιμοποιεί δικά της pipeline + provider abstractions — δεν χρειάζεται port

---

### 5.6 `engines/dxf/wizardToTopographic.ts` — 114 LOC

**Σκοπός**: Καθαρή converter από `WizardPayload` (user wizard selections) → topographic JSON, χωρίς GPT-4o.

**Τι κάνει**:
- Παίρνει `WizardPayload = { plotVertices, frontageEdges, roadInfos, oppositeRgVertices? }`
- Υπολογίζει shoelace area + perimeter + edge lengths
- Παράγει `faces[]` με `roadName`/`P_m`/`plotFrontage_m`/`curbLevel_m`/`RG_equals_OG`/`prassia_m`/`oppositeSetback_m`
- Παράγει `plot.type` based on frontage count: 1 → mesaio, 2 → goniako, ≥3 → diamperes

**Γιατί EXCLUDE**:
1. **100% ΝΟΚ domain**: ΡΓ (ρυμοτομική γραμμή), ΟΓ (οικοδομική γραμμή), πρασιά, mesaio/goniako/diamperes — όλα ελληνικά οικοδομικά concepts
2. Output schema είναι site.store schema του GenArc — δεν υπάρχει στο Nestor
3. ADR-366 viewer **δεν έχει wizard** — direct DXF rendering

---

### 5.7 `types/dxf.types.ts` — 69 LOC

**Σκοπός**: Internal types για το GenArc DXF pipeline.

**Περιεχόμενο**: `DxfPolyline { vertices, area, layer }`, `DxfText { content, layer, x?, y?, angle?, height? }`, `DxfDimension { value, x?, y? }`, `FrontageHint { edgeIndex, P_m }`, `DxfIntermediate { polylines, texts, layers, dimensions, frontageHints }`.

**Γιατί EXCLUDE**:
1. Αυτά είναι **compact summary types για GPT-4o prompt** (max 10 polylines, max 80 texts, max 30 dimensions) — όχι rendering input
2. Nestor's `DxfEntityUnion` (line 188 του `canvas-v2/dxf-canvas/dxf-types.ts`) έχει 13 variant types με rich metadata (`colorMode`, `colorAci`, `colorTrueColor`, `linetypeName`, `lineweightMm`, `transparency`, layer references, BIM entity wrappers)
3. Mixing τους θα προκαλούσε type confusion + parallel SSoT (αντίθετο στο N.0 / SSoT rule)

---

### 5.8 `types/dxfScene.types.ts` — 98 LOC

**Σκοπός**: Wizard state machine types + flat scene types για SVG viewer.

**Περιεχόμενο**: `DxfSegment { id, entityIdx, start, end, layer }`, `DxfScene { segments, texts, bounds, layers }`, `WizardStep = 'boundary' | 'frontages' | 'road_info' | 'confirm'`, `FrontageRoadInfo { edgeIndex, P_m, roadName, og_isEqualToRg?, prassia_m?, opp_rg_equals_opp_og?, opp_og_setback_m? }`, `WizardPayload { plotVertices, frontageEdges, roadInfos, oppositeRgVertices? }`.

**Γιατί EXCLUDE**:
1. `DxfSegment` flat type = data model downgrade vs Nestor's entity wrappers
2. `WizardStep`/`WizardPayload`/`FrontageRoadInfo` είναι **GenArc Topographic Import Wizard FSM** — out of scope ADR-366
3. `DxfScene` εδώ είναι **διαφορετικό** από Nestor's `DxfScene` (line 191 του `canvas-v2/dxf-canvas/dxf-types.ts`) — naming clash με incompatible semantics

---

## 6. Nestor Parser Gap Analysis

**Goal**: Identify αν υπάρχει feature που Nestor's parser **δεν** καλύπτει αλλά GenArc καλύπτει, και είναι relevant για ADR-366 SPEC-3D-001 (DXF→Three.js Pipeline).

### 6.1 Nestor's parser inventory (already-have surface)

| Feature | Location | Notes |
|---|---|---|
| 15 entity types parser | `utils/dxf-entity-parser.ts` (κλάση `DxfEntityParser`) | LINE/LWPOLYLINE/CIRCLE/ARC/TEXT/MTEXT/INSERT/SPLINE/ELLIPSE/DIMENSION/HATCH/SOLID/XLINE/RAY/MULTILINETEXT |
| Web Worker parsing | `workers/dxf-parser.worker.ts` | Off-main-thread, χρησιμοποιεί `DxfSceneBuilder` |
| HEADER parsing | `DxfEntityParser.parseHeader()` | $INSUNITS, $DIMSCALE, $DIMTXT, $CANNOSCALEVALUE, $MEASUREMENT |
| DIMSTYLE table | `utils/dxf-table-parsers.ts` (`parseDimStyles`) | ~40 fields (ADR-362 Phase H1 roundtrip) |
| LAYER table | `utils/dxf-table-parsers.ts` (`parseLayerColors`) | ACI colors + visibility + frozen |
| Unit conversion | `INSUNITS_TO_MM` (20-entry table) | Inches/Feet/m/cm/mm/μm/parsecs/light years/AU |
| Floorplan import (high-level) | `components/useFloorplanImport.ts` + `io/dxf-import.ts` | Top-level orchestration |
| Rich entity wrappers | `canvas-v2/dxf-canvas/dxf-types.ts:188` | `DxfEntityUnion` — 13 variants, BIM entity wrappers (stair/dimension/slab/slab-opening/opening/xline/ray) |
| ByLayer/ByBlock cascade | ADR-358 §G7 (colorMode/colorAci/colorTrueColor/linetypeName/lineweightMm) | Full DXF property inheritance |

### 6.2 GenArc's parser inventory (potentially additive)

| Feature | Location | Relevance to ADR-366 |
|---|---|---|
| 3 geometry entity types | `dxfParser.ts` / `dxfSceneParser.ts` | ❌ Subset of Nestor |
| Greedy chain polygon assembly (LINE → closed polygon) | `dxfParser.ts:greedyChain` + `dxfSceneParser.ts:assembleSegmentsToPolygon` | ⚠️ **Possibly useful for Topographic Import** (separate future feature), **not** για 3D BIM viewer |
| Multi-signal polygon scoring | `dxfPolygonScore.ts` | ❌ ΕΓΣΑ'87 / ΝΟΚ specific |
| Frontage P= regex matching | `dxfFrontageHints.ts` | ❌ ΝΟΚ specific |
| Collinear chain BFS (dashed line detection) | `dxfSceneParser.ts:findCollinearChainIds` | ⚠️ Theoretical interest — Nestor doesn't merge dashed lines at parse-time (per-frame linetype rendering instead, ADR-358 §G7) |
| MTEXT RTF code stripping | `dxfSceneParser.ts:stripMtextCodes` | ❌ Naive regex strip — Nestor's `text-engine/edit/marks/` does proper MTEXT parsing (ADR-344) |
| GPT-4o topographic JSON pipeline | `dxfToTopographic.ts` | ❌ AI pipeline, out of ADR-366 scope |
| Wizard FSM (4 steps) | `dxfScene.types.ts` | ❌ Wizard UX, out of ADR-366 scope |

### 6.3 Gaps που είναι ΥΠΑΡΚΤΟΙ αλλά δεν καλύπτονται από GenArc port

Όλα τα ακόλουθα **πρέπει να χτιστούν από scratch** για ADR-366 SPEC-3D-001 και **δεν** προσφέρονται από GenArc:

| Gap | Need | GenArc offer? |
|---|---|---|
| DXF entity → Three.js `BufferGeometry` mapping (ADR-366 §5.1 table) | LINE → `LineSegments`, ARC → `EllipseCurve`, HATCH → `ShapeGeometry`, INSERT → recursive Group, SPLINE → `CatmullRomCurve3`, ELLIPSE → `EllipseCurve`, SOLID → triangulated Mesh, TEXT → `Sprite` billboard | ❌ Όχι |
| 2D plan → 3D world coordinate transform (mm → m, XY → XZ με Y-up convention) | `dxfPlanToWorld(x, y, elevation) → THREE.Vector3` (ADR-366 §4.2) | ❌ Όχι |
| BufferGeometry merging per layer για performance (≥10k entities → instancing) | LOD strategy για large scenes | ❌ Όχι |
| Disposal lifecycle (mode toggle 3D→2D) | `geometry.dispose()` + `material.dispose()` ανά object | ❌ Όχι |
| HATCH boundary triangulation σε 3D flat surface | Three.js `Shape` + `ShapeGeometry` με elevation = entity Z | ❌ Όχι (GenArc αγνοεί HATCH εντελώς) |

**Συμπέρασμα §6**: GenArc DXF domain **δεν προσφέρει τίποτα additive** για το SPEC-3D-001 mapping. Όλη η dxf→three.js δουλειά πρέπει να γραφτεί από scratch πάνω στο Nestor `DxfEntityUnion`.

---

## 7. Coordinate System / Units

| Σύστημα | X axis | Y axis | Units | Source |
|---|---|---|---|---|
| **GenArc DXF input** | World East (assumed ΕΓΣΑ'87 αν >100.000) | World North | Metres (assumed, no INSUNITS parsing) | npm `dxf-parser` raw |
| **Nestor DXF input** | World East | World North | INSUNITS-aware (`INSUNITS_TO_MM` 20-entry table → internal mm) | `DxfEntityParser.parseHeader()` |
| **Three.js target (ADR-366 §4.2)** | World East | Height (Y-up) | Metres | `dxfPlanToWorld(x_mm, y_mm, elev_mm) → THREE.Vector3(x/1000, elev/1000, y/1000)` |

**Critical mismatch**: GenArc assumes units = metres (παράγει drawing-units detection μέσω `x < 1.000` heuristic). Nestor parses **πραγματικά** $INSUNITS και κάνει deterministic conversion. **Nestor approach είναι σωστό** για generic BIM viewer — GenArc heuristic θα έσπαγε σε inch-based αρχιτεκτονικά DXF (αμερικάνικα όπου INSUNITS=1).

**Coordinate transform για ADR-366 Phase 1**: Όλα τα Nestor entities είναι ήδη σε mm (canonical internal unit). Το `dxfPlanToWorld` του ADR-366 §4.2 παίρνει directly mm → m + axis swap. **Καμία προσαρμογή από GenArc απαραίτητη.**

---

## 8. License Audit (SOS N.5)

| Module | License | Status |
|---|---|---|
| GenArc `engines/dxf/*` | Custom Γιώργου | MIT-compatible ✅ (αν decidedAreThe Apple ports — irrelevant εδώ) |
| GenArc `types/dxf*.types.ts` | Custom Γιώργου | MIT-compatible ✅ |
| npm `dxf-parser` (transitive dep του GenArc) | MIT ✅ (already used in Nestor too) | OK |

**Συμπέρασμα §8**: Καμία license risk. Όμως **καμία port** => audit irrelevant for this SPEC.

---

## 9. Port Execution Plan

**Δεν υπάρχει port plan.** ZERO files port-άρονται από αυτό το domain.

**Phase 1 ADR-366 (DXF → Three.js Pipeline)** χτίζεται **πάνω στο Nestor `DxfEntityUnion`** ως νέο module `src/subapps/dxf-viewer/bim-3d/converters/DxfToThreeConverter.ts`. Reference implementation: ADR-366 §5.1 mapping table + §4.2 coordinate transform.

**Πιθανή ελαφριά reference value** από GenArc:
- `dxfSceneParser.ts:stripMtextCodes` — naive regex pattern για RTF cleanup (αν χρειαστεί ως quick fallback). Nestor's `text-engine` ήδη το κάνει σωστά → unlikely to be needed.

---

## 10. Cross-Domain Dependencies Spotted

(Section as required by task spec — flag GenArc cross-domain coupling discovered during investigation without entering those domains.)

Κατά τη διερεύνηση του `engines/dxf/`, εντοπίστηκαν τα εξής cross-domain edges που αξίζει να αναφερθούν στα αδελφά SPECs:

| Edge | Source file | Target domain | Relevance |
|---|---|---|---|
| `dxfPolygonScore.ts` → `@/types/dxf.types` (DxfPolyline) | local | **types/** — μηχανισμός αναφέρεται σε ΕΓΣΑ'87 thresholds (X_MIN=100k, Y_MIN=1M) | SPEC-3D-004C (utils): αν εξεταστούν topographic utils, αυτές οι σταθερές πιθανότατα ξανα-εμφανίζονται |
| `dxfFrontageHints.ts` → `@/types/dxf.types` (FrontageHint) | local | **types/** | Όχι ADR-366 relevant |
| `dxfToTopographic.ts` → `@/engines/ai/aiService` | GenArc AI engine | **engines/ai/** (out-of-scope κατά CLAUDE.md `engines/ai` exclusion του ADR-366) | Σημείωση: SPEC-3D-004E (Materials/Shaders) **δεν** πρέπει να εισέλθει στο `engines/ai`. AI pipeline του GenArc είναι ΝΟΚ-classifier για εφαρμογή Eurocode rules — out of scope. |
| `dxfSceneParser.ts:assembleSegmentsToPolygon` καλείται από `components/dxf/DxfCanvas.tsx` (wizard step 1) | GenArc UI components | **components/dxf/** (NOT in ADR-366 port scope) | Confirmation: το `engines/dxf/` έχει zero coupling με `engines/viewport/` ή `engines/snap/` — clean domain isolation |
| Καμία αναφορά σε `engines/snap`, `engines/bom`, `engines/sdf`, `engines/structural`, `engines/nok` από το `engines/dxf/` | — | — | ✅ Καθαρή απομόνωση — επιβεβαιώνει ότι GenArc DXF parser είναι standalone topographic feature |

**Συμπέρασμα §10**: Το `engines/dxf/` του GenArc είναι **καθαρά απομονωμένο** topographic domain, χωρίς leakage σε άλλα GenArc engines. Αυτό κάνει την απόφαση EXCLUDE ασφαλή — δεν υπάρχει "hidden coupling" που θα έπαιρνε port indirectly.

---

## 11. Σχέση με Open Question Q2 του SPEC-3D-004A

**Q2 του SPEC-3D-004A** ρωτά: "navProxy ως primary Phase 2 ή ως alternative;"

**Εύρημα αυτού του SPEC**: Όχι, το GenArc `engines/dxf/` **δεν παρέχει bridge** DXF → Three.js. Είναι αμιγώς 2D → JSON pipeline για AI prompts.

**Implication**: Το navProxy του SPEC-3D-004A παραμένει η πιθανή πηγή για **BIM → Three.js** (όχι DXF → Three.js). Η DXF → Three.js γέφυρα (SPEC-3D-001) **πρέπει να γραφτεί από scratch** ως νέο `DxfToThreeConverter` που καταναλώνει το Nestor `DxfEntityUnion`.

Συμπέρασμα: Q2 του SPEC-3D-004A παραμένει ανοιχτό, αλλά εδώ ξεκαθαρίζει ότι **καλύπτει μόνο BIM entities** (Wall/Column/Beam/Slab/Opening), **όχι** raw DXF entities (LINE/ARC/POLYLINE/...).

---

## 12. Open Questions για Γιώργο

> Μία ερώτηση τη φορά. Απάντησε A / B / C ή δώσε άλλη επιλογή.

### Q1 — Greedy chain polygon assembly: αξίζει να κρατήσουμε reference για μελλοντικό Topographic Import Wizard του Nestor;

Παράδειγμα τι κάνει ο αλγόριθμος: Φαντάσου ότι σου δίνω ένα DXF τοπογραφικού όπου το όριο του οικοπέδου ΔΕΝ είναι μία κλειστή πολυγραμμή, αλλά **12 ξεχωριστές γραμμές** που η μία τελειώνει εκεί που αρχίζει η επόμενη. Ο αλγόριθμος ξεκινάει από την πρώτη γραμμή, βρίσκει την επόμενη που "κουμπώνει" στο τέλος της (μέσα σε ανοχή 5 εκατοστών), προχωράει, και έτσι μέχρι να κλείσει ο κύκλος. Παράγει το ολοκληρωμένο πολύγωνο του οικοπέδου.

**A) Ναι, να γραφτεί ξεχωριστό ADR** "Topographic Import for Nestor" όπου θα κρατήσουμε reference αυτόν τον αλγόριθμο (και το multi-signal scoring + frontage P= matching) για μελλοντικό import wizard. Effort: ~1-2h να γραφτεί το ADR proposal.

**B) Όχι, αγνόησέ τα.** Το Nestor δεν έχει στα πλάνα topographic import — focus 100% στο BIM 3D viewer. Αυτές οι αλγόριθμοι μένουν στο GenArc και τέλος.

**C) Σημείωσέ τα μόνο** σε ένα μικρό note (3-5 γραμμές) μέσα στο master ADR-366 §8 ή σε νέο "future features" registry. Καμία επιπλέον δουλειά τώρα.

*Πρόταση: **B** — αγνόησε εντελώς. Είναι domain που δεν αφορά το roadmap του Nestor. Αν προκύψει ποτέ ανάγκη, ο κώδικας θα είναι ακόμα στο `C:\genarc`.*

---

### Q2 — DXF parser για ADR-366 SPEC-3D-001: επιβεβαιώνεις την προσέγγιση "build from scratch επάνω σε Nestor `DxfEntityUnion`";

Παράδειγμα: Το Nestor parser σου δίνει ήδη για κάθε γραμμή του DXF ένα έτοιμο αντικείμενο τύπου `DxfLine` με `start`, `end`, χρώμα, layer κλπ. Ο νέος converter θα είναι μια απλή συνάρτηση: `dxfLine → THREE.LineSegments`. Δεν χρειάζεται να ξανα-διαβάσει το DXF text — απλά να μετατρέπει το έτοιμο entity.

**A) Ναι, build from scratch** ως νέο `bim-3d/converters/DxfToThreeConverter.ts`. Παίρνει `DxfEntityUnion[]` (Nestor type), επιστρέφει `THREE.Object3D[]`. Καμία αναφορά σε GenArc DXF code.

**B) Όχι, θέλω να ξανα-σκεφτείς αν κάτι από το GenArc αξίζει port** πριν προχωρήσουμε. Πες μου τι συγκεκριμένα.

*Πρόταση: **A**. Το GenArc DXF domain είναι 100% topographic AI pipeline — δεν προσφέρει τίποτα reuseable για 3D BIM rendering. Καμία πιθανή αξία προς όφελος του ADR-366.*

---

## 13. Changelog

| Ημ/νία | Αλλαγή | Author |
|---|---|---|
| 2026-05-19 | **Initial draft v1.0** — Full catalog of 8 GenArc DXF files (engines/dxf/ + types/dxf*.types.ts). **Result: 0 PORT / 0 ADAPT / 0 EXTRACT / 8 EXCLUDE.** Reasoning: GenArc DXF domain είναι topographic plot boundary detection (ΕΓΣΑ'87 / ΝΟΚ / GPT-4o), Nestor έχει mature 15-entity custom parser με Web Worker + DIMSTYLE/LAYER table support. ADR-366 SPEC-3D-001 (DXF→Three.js Pipeline) πρέπει να γραφτεί from scratch ως converter πάνω στο Nestor `DxfEntityUnion`. Section §10 confirms clean domain isolation (zero coupling με άλλα GenArc engines). 2 open questions για Γιώργο (topographic feature parking, parser approach confirmation). | Claude Opus 4.7 |

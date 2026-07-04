# ADR-563 — Auto-Dimension Engine (αυτόματη περιμετρική διαστασιολόγηση κάτοψης)

- **Status:** 🟢 Φ1 (perimeter) + Φ2 (BIM associativity) + Φ3 (interior) + Φ4-Δ (interior witness lines) + Φ4-Β (aligned skewed) + Φ4-Α (interactive cut-line) IMPLEMENTED — UNCOMMITTED
- **Date:** 2026-07-02
- **Domain:** DXF Viewer → Dimensions
- **Σχετικά:** ADR-362 (Enterprise Dimension System — core), ADR-397 / ADR-511
  (batch entity commit / CompoundCommand undo), ADR-049 (grid-snap SSoT),
  ADR-436 / ADR-363 (BIM 2D bounds SSoT), ADR-010 (bounds union SSoT)

---

## Context

Το DXF Viewer είχε πλήρες **χειροκίνητο** dimension system (ADR-362: 14 τύποι,
styles, associativity, DXF export) αλλά **καμία αυτόματη διαστασιολόγηση** — ο
χρήστης έπρεπε να διαστασιολογήσει κάθε τοίχο/κολόνα/πέδιλο ένα-ένα με κλικ.

Ζητούμενο (Giorgio): με **μία ενέργεια**, αυτόματη τοποθέτηση διαστάσεων
περιμετρικά μιας ολοκληρωμένης κάτοψης — «όπως οι μεγάλοι».

**Έρευνα των μεγάλων (συγκλίνον μοτίβο):**
- **ArchiCAD** *Automatic Exterior Dimensioning*: επιλογή τοίχων → dialog (overall /
  structures / openings / composite reference outer-vs-core faces / «place on 4
  sides of bounding box» / distance between lines) → τοποθέτηση.
- **Revit** aligned auto-dim: options bar *Wall faces / Wall centerlines / Center of
  core*, *Entire Wall*, Options → *Openings (centers/widths) / Intersecting Walls /
  Intersecting Grids*.
- **AutoCAD** *QDIM*: επιλογή αντικειμένων → arrangement mode *Continuous / Baseline /
  Staggered / Ordinate*.

Κοινός πυρήνας: **selection-driven → reference basis → πολλαπλές παράλληλες
αλυσίδες ανά πλευρά → associative έξοδος**. Οι αρχιτεκτονικές κατόψεις χρησιμοποιούν
**3 σειρές ανά πλευρά**: (1) ανοίγματα/επιμέρους, (2) άξονες/τοίχος↔τοίχος, (3) ολική.

**Αποφάσεις:** 3 σειρές · **περιμετρικό πρώτα** (εσωτερικό = Φ2) · **έξυπνη βάση
αναφοράς** (δομικά→άξονες/κέντρα, τοίχοι→όψεις, ανοίγματα→κέντρα) · **ArchiCAD-style
dialog** με options πριν την τοποθέτηση.

---

## Decision

Νέο **orchestration layer** πάνω στο υπάρχον dimension SSoT — καμία επανεγγραφή του
πυρήνα παραγωγής/render/export διαστάσεων. Παράγει **αληθινά `LinearDimensionEntity`**
που περνούν από ΟΛΟ το υπάρχον pipeline (render, grips, edit, DXF export).

### Αρχιτεκτονική — pure engine (systems/dimensions/auto/)

Pipeline 3 σταδίων, καθένα pure (no React/store/Firestore), SRP ≤500 LOC:

1. **`auto-dimension-reference-extraction.ts`** — `extractReferencePoints(elements, options, overall)`
   → `ReferencePoint[]` (scalar coords ανά μετρούμενο άξονα, ανά side/tier).
   - **Έξυπνη βάση:** detail tier → όψεις/άκρα (walls→faces, structural→element extent),
     openings→κέντρο· axes tier → κέντρα (structural grid). `referenceBasis: 'axes'`
     συμπτύσσει το detail σε κέντρα· `'faces'` σε άκρα.
   - Reuse `calculateBimEntity2DBounds` (bim/utils — bbox→2D SSoT) + type guards
     (`isWallEntity`/`isColumnEntity`/`isFoundationEntity`/`isBeamEntity`/`isOpeningEntity`).
2. **`auto-dimension-chain-planner.ts`** — `planChains(refPoints, overall, options)` →
   `PlannedSegment[]`. Ομαδοποίηση ανά (side, tier), dedup near-coincident coords
   (**reuse `snapToGrid` ADR-049**, 1mm), ταξινόμηση, ένα segment ανά διαδοχικό ζεύγος,
   fixed outward offset ανά tier (detail 0· axes +DIMDLI· overall +2·DIMDLI).
3. **`auto-dimension-entity-factory.ts`** — `buildAutoDimensionEntities(segments, ctx)` →
   `LinearDimensionEntity[]`. `id` από **`generateDimensionId()` (N.6)**, `styleId` από
   active style, `associations` ανά anchored defPoint, optional sanity via
   `buildDimensionGeometry` (drop degenerate).
4. **`auto-dimension-engine.ts`** — `runAutoDimension(elements, options, ctx)` = extract →
   plan → factory· `computeOverallBounds` reuse **`unionBounds` (ADR-010)**.
5. **`auto-dimension-types.ts`** — `AutoDimensionOptions`, `AUTO_DIMENSION_DEFAULTS`,
   `ReferencePoint`, `PlannedSegment`, side/tier helpers.

### Commit (undoable batch)

- **`bim/scene/add-dimensions-to-scene.ts`** (mirror `add-column-to-scene.ts`) →
  `appendEntitiesToScene(accessor, dims, 'dim-auto', 'Αυτόματη διαστασιολόγηση')`.
  Reuse ADR-397/511: **1 Ctrl+Z** αναιρεί όλο το batch, κάθε dim εκπέμπει
  `drawing:entity-created` (persistence), και το ήδη-mounted `useDimAssociationObserver`
  πιάνει το batch για host→dim tracking.

### UI (ArchiCAD-style)

- **`ui/dimensions/AutoDimensionDialogStore.ts`** + **`AutoDimensionDialog.tsx`** — options
  panel (3 tiers, reference basis, openings, 4 sides, distance) → confirm.
- **`ui/ribbon/hooks/bridge/auto-dim-command-keys.ts`** (mirror `wall-command-keys.ts`) —
  `isAutoDimActionKey('auto-dimension')` → ανοίγει το dialog store· wired στο
  `routeRibbonAction` ΠΡΙΝ το generic `wrappedHandleAction`.
- Ribbon button «Αυτόματη Διαστασιολόγηση» στα dimension panels (home + contextual).
- Confirm: source = `SelectedEntitiesStore.count()>0 ? επιλεγμένα : όλη η κάτοψη`.

---

## Associativity — Φ2 (BIM-aware, ΥΛΟΠΟΙΗΘΗΚΕ)

Το `recomputeAssociatedDefPoint` (ADR-362 J3) καταλάβαινε **μόνο** line/polyline/
circle/arc. Η Φ2 πρόσθεσε **νέο associationType `'bimExtent'`** (+ `bimAnchor: { axis,
edge }` στο `DimensionAssociation`) και ένα **axis-aware branch** στον resolver:

- Κάθε anchored defPoint (extOrigin) των auto-dims αποθηκεύεται ως `bimExtent` με
  `axis` (X για N/S, Y για E/W) + `edge` (`min`/`max`/`center` του host bbox).
- Στο host geometry change ο resolver διαβάζει το **τρέχον** `calculateBimEntity2DBounds`
  (ίδιο SSoT με την extraction → preview≡commit≡recompute), παίρνει `edge` στον `axis`,
  και **διατηρεί την κάθετη συνιστώσα** (η baseline της προέκτασης μένει, το μετρούμενο
  coordinate ακολουθεί). Άρα: μετακίνηση τοίχου/κολόνας/πεδίλου → οι διαστάσεις **ακολουθούν**.
- Το point-based contract του service για primitives (line/circle/arc) **δεν αλλάζει** —
  το `bimExtent` είναι ξεχωριστό case· 54/54 dim-association tests πράσινα (μηδέν regression).
- **Delete** host → orphan (defPoint preserved, `orphanCount++`) όπως πριν.

**Περιορισμός:** το bbox είναι axis-aligned· σε **περιστροφή** host η προσκόλληση ακολουθεί
το bbox extent (όχι την πραγματική λοξή παρειά) — αποδεκτό για translation (η κύρια χρήση).

## Εσωτερική διαστασιολόγηση — Φ3 (ΥΛΟΠΟΙΗΘΗΚΕ)

Το Φ1 καλύπτει **περιμετρική** (bounding-box, 4 πλευρές). Η Φ3 προσθέτει τον **εσωτερικό
δομικό κάναβο**, μοντέλο των μεγάλων = ArchiCAD *Interior Dimensioning* (γραμμή τομής →
αλυσίδα των κέντρων που τη διασχίζουν). **Απόφαση Giorgio:** αυτόματη «γραμμή τομής»
στο **centroid** → **2 ορθογώνιες αλυσίδες** (μία οριζόντια που μετρά X, μία κατακόρυφη
που μετρά Y) που τρέχουν **μέσα** από την κάτοψη (όχι offset έξω).

- **Νέο pure module** `auto-dimension-interior-planner.ts` (αδελφός του chain-planner):
  `planInteriorChains(elements, options, overall)` → `PlannedSegment[]`.
- **Στοιχεία:** δομικά (κολόνες/τοιχία/πέδιλα/δοκοί) **+ εσωτερικοί τοίχοι**· **ανοίγματα
  εκτός** (αυτά ζουν στο perimeter detail tier).
- **Βάση:** ακολουθεί το dialog `referenceBasis` — `axes`/`smart` → **κέντρα** (centerline
  grid, default look), `faces` → **παρειές**. Το `smart` για interior διαβάζεται ως κέντρα
  (delegate στο `detailCoordsFor` με `axes`) — μηδέν διπλότυπο.
- **Reuse:** `classifyElement`/`detailCoordsFor`/`projectBoundsOntoAxis` (extraction),
  `dedupSorted` (chain-planner, `snapToGrid` quantize), `calculateBimEntity2DBounds`.
- **Associativity δωρεάν:** ίδιο `bimExtent` — νέο ρητό πεδίο `PlannedSegment.axis` (SSoT
  του μετρούμενου άξονα, ο factory δεν το συμπεραίνει πλέον από το `side`). Εσωτερικές
  αλυσίδες ακολουθούν κολόνα στο move. Witness lines μηδενικές στη Φ3 (dim line πάνω στο
  centroid) → **αναβαθμίστηκαν στη Φ4-Δ** (βλ. κάτω).
- **UI:** νέο checkbox «Εσωτερικές διαστάσεις (κάναβος)» (`options.interior`, default
  **off** — opt-in, διατηρεί το perimeter-only default) + i18n el/en.
- **Factory/commit/dialog store/flow δεν αλλάζουν** — μόνο ο engine κάνει concat.

---

## Εσωτερικά witness lines — Φ4-Δ (ΥΛΟΠΟΙΗΘΗΚΕ)

Η Φ3 άφησε τις εσωτερικές αλυσίδες με **μηδενικά** witness (`defPoints[0] == defPoints[2]`,
dim line πάνω στο centroid) — καθαρές αλλά «γυμνές», χωρίς οπτική σύνδεση με τα στοιχεία.
Η Φ4-Δ προσθέτει **Gap-to-Element witness lines**, το default μοντέλο των μεγάλων:
**Revit «Witness Line Control → Gap to Element»** (ArchiCAD: «witness = κάθετη γραμμή
στοχευμένη στο μετρούμενο σημείο») → κάθε προέκταση φτάνει την **πλησιέστερη παρειά** του
host, με μικρό κενό, μεταβλητού μήκους.

- **Πυρήνας (`auto-dimension-interior-planner.ts`):** ανά quantized συντεταγμένη κρατά την
  **παρειά** του host (κάθετος άξονας) που είναι **πλησιέστερη στο baseline** (`perpByKey`,
  `nearest-wins` σε κοινές συντεταγμένες). Το extension origin κάθεται σε αυτή την παρειά·
  ο **dim line ref μένει στο centroid** → ο υπάρχων `buildExtLine` (linear-aligned-builder)
  ζωγραφίζει witness με **DIMEXO gap + DIMEXE overshoot**. **Μηδέν νέα witness geometry.**
- **Reuse:** `projectBoundsOntoAxis(bounds, !measuresX)` (παρειές κάθετου άξονα) + νέο export
  `quantizeCoord()` (single-source quantization, ίδιο με `dedupSorted`/`snapToGrid` ADR-049).
  `dedupSorted`/factory/associativity **αμετάβλητα**· ο μετρούμενος άξονας (`edge='center'`)
  ίδιος.
- **Γνωστός περιορισμός (follow-up):** το `bimExtent` associativity ενημερώνει **μόνο τον
  μετρούμενο άξονα** (κρατά την κάθετη baseline). Σε **κάθετη** μετακίνηση host, το endpoint
  του witness μένει «παγωμένο» μέχρι επόμενο auto-dimension· η **τιμή** διάστασης παραμένει
  σωστή. Πλήρες associative witness θα απαιτούσε νέο perpendicular anchor στο shared
  `dim-association-service` — εκτός scope του μικρού Δ.

---

## Λοξές διαστάσεις — Φ4-Β (ΥΛΟΠΟΙΗΘΗΚΕ)

Όλο το engine ήταν **axis-aligned (X/Y)**: κάθε στοιχείο προβάλλεται στο global bbox, οπότε ένας
**διαγώνιος τοίχος** έπαιρνε λάθος διάσταση = το πλάτος του bounding box, όχι το **πραγματικό μήκος**
του. Η Φ4-Β διαστασιολογεί **παράλληλα στον άξονα του στοιχείου** (Revit «Add Aligned Dimensions to
Walls», ArchiCAD aligned) για τα **στραμμένα** γραμμικά μέλη.

- **Νέο pure module** `auto-dimension-aligned-planner.ts`: `planAlignedChains(elements, options)` →
  ένα aligned segment ανά **λοξό** τοίχο/δοκό (offset κάθετα στον άξονα κατά `offsetFromModel`).
  **Skew gate:** axis-aligned μέλη (γωνία ~0/90° εντός `AXIS_ALIGNED_EPS≈sin0.5°`) → **SKIP** (τα
  καλύπτει ήδη σωστά το περιμετρικό).
- **Reuse (μηδέν νέα geometry):** `unitAxis` (`bim/walls/wall-grip-math.ts`) για τοίχους,
  `beamAxisSceneFrame` (`bim/beams/beam-axis-scene-frame.ts`) για δοκούς, `perpUnit`/`project2D`
  (`bim/grips/grip-math.ts`) για το offset. **Κολόνες εκτός** (δεν έχουν axis SSoT — point/footprint).
- **Downstream «δουλεύει ήδη»:** νέο `PlannedSegment.dimensionType:'aligned'` → ο factory εκπέμπει
  `AlignedDimensionEntity`· `buildAlignedGeometry` (dim line ∥ defPoints) + ο renderer (`kind:'linear'`
  path) + hit-test + spacing + chaining **το υποστηρίζουν ήδη** — μηδέν αλλαγή σε renderer/geometry.
- **UI:** νέο checkbox «Λοξές διαστάσεις (στραμμένοι τοίχοι)» (`options.alignedSkewed`, default **off**)
  + i18n el/en. **Perimeter/interior αμετάβλητα.**
- **Γνωστός περιορισμός (follow-up):** το αρχικό slice είναι **μη-associative** σε λοξό άξονα (χωρίς
  `source1/2`). Follow-on-move σε στραμμένο τοίχο θα απαιτούσε **vector `bimAnchor`** + νέο branch στο
  **κοινό** `dim-association-service` (το `bimExtent` σήμερα μόνο x/y) — εκτός scope, ξεχωριστό βήμα.

---

## Διαδραστική γραμμή τομής — Φ4-Α (ΥΛΟΠΟΙΗΘΗΚΕ)

Το εσωτερικό μοντέλο (Φ3) βάζει **auto** cut line στο centroid στους X/Y άξονες. Η Φ4-Α το κάνει
**διαδραστικό σε αυθαίρετο άξονα**: ο χρήστης τραβά μια **γραμμή τομής** και ό,τι τη διασχίζει
διαστασιολογείται σε **μία aligned αλυσίδα** κατά μήκος της (ArchiCAD «Interior Dimensioning» /
Revit aligned pick-line). Απόφαση Giorgio (AskUserQuestion): **3-click ArchiCAD placement** (κλικ1=αρχή,
κλικ2=τέλος → κλειδώνουν στοιχεία+άξονας, κλικ3=τοποθέτηση σε κάθετο offset) + **διάλογος πρώτα**
(reuse `AutoDimensionOptionsDialog` για referenceBasis/openings).

- **Νέο pure module** `auto-dimension-cutline-planner.ts`: `planCutLineChain(elements, cutStart,
  cutEnd, dimLinePoint, options)` → aligned `PlannedSegment[]`. Γενίκευση interior/aligned σε
  **διάνυσμα άξονα** = η γραμμή τομής. **Reuse (μηδέν νέα geometry, N.0.2):** `lineIntersectsRectangle`
  (crossing test), `projectPointOnAxis`/`projectPolygonOnAxis` (προβολή σε λοξό άξονα),
  `unitVector`/`perpUnit`/`dotProduct`, `calculateBimEntity2DBounds`, **`detailCoordsFor`** (ίδια
  απόφαση κέντρα/παρειές με perimeter/interior — `smart→axes` όπως ο interior κάναβος), `dedupSorted`.
  Offset = signed `dot(dimLinePoint − cutStart, perp)` → η αλυσίδα κάθεται στην πλευρά/απόσταση του 3ου κλικ.
- **Downstream «δουλεύει ήδη»:** `dimensionType:'aligned'` → `buildAutoDimensionEntities` +
  `addDimensionsToScene` (1 undoable batch) — **ίδιο pipeline** με τη dialog-driven ροή.
- **Interactive tool (κεντρικοποιημένη υποδομή, μηδέν νέο tool/preview framework):**
  - Νέο `ToolType 'auto-dim-cutline'` (category `drawing` → mouse-up skip-selection + grips skipped).
  - 3-click FSM σε **zero-React store** (`auto-dimension-cutline-store.ts`, ADR-040 leaf).
  - **Click** μέσω του κεντρικού `useCanvasClickHandler` (έχει τον `levelManager`/`SceneAppendAccessor`
    για το batch commit· ίδιο pattern με hatch-select/finish-paint) → `advanceCutlineClick`.
    Το `worldPoint` έρχεται **ήδη snapped** (κεντρικό `findSnapPoint` στο mouse-up).
  - **Live preview** (`useAutoDimCutlineTool` σε `useDrawingHandlers`): RAF `registerRenderCallback`
    (mirror `dim-preview-persist`) → rubber-band γραμμή (`drawPreview`) + ghost αλυσίδα μέσω του
    **υπάρχοντος** `drawGhostFaceDimensions` (array of aligned overlay dims → `renderPreviewDimension`)
    — **μηδέν αλλαγή σε renderer/PreviewCanvas**. Cursor via `getImmediateWorldPosition`.
  - Ribbon κουμπί «Γραμμή τομής» (ToolType, routes μέσω `onToolChange`) + i18n el/en. Esc → escape-bus.
- **Raw (non-BIM) γεωμετρία (2026-07-04):** εκτός από BIM walls/structural/openings, η γραμμή τομής
  διαστασιολογεί πλέον και **σκέτες `line`/`polyline`/`lwpolyline`** (exploded DXF) — ακριβές
  segment-segment σημείο τομής (`rawLinearCutCoords`, reuse `segmentIntersection`), όχι AABB. Βλ. changelog.
- **Γνωστός περιορισμός (follow-up, ίδιο με Φ4-Β):** **μη-associative** σε αυθαίρετο άξονα. Επίσης
  witness lines κάθονται στη γραμμή τομής (Gap-to-Element ανά στοιχείο = follow-up, όπως Φ4-Δ).

---

## Consequences

- ✅ Μηδέν διπλότυπο: reuse dimension entity/style/geometry/commit/id SSoT.
- ✅ Google-level undo (batch = 1 step), persistence, edit/grips/DXF export δωρεάν.
- ✅ Pure engine → πλήρως unit-tested (interior/extraction/planner/factory/engine + bimExtent recompute).
- ✅ Associativity-follow στο move (Φ2/Φ3, `bimExtent` σε περιμετρικά & εσωτερικά).
- ✅ Εσωτερικός κάναβος (Φ3) = 2 αλυσίδες μέσα από centroid, opt-in.
- ✅ Εσωτερικά witness lines (Φ4-Δ) = Gap-to-Element, reuse `buildExtLine` (μηδέν νέα geometry).
- ✅ Λοξές διαστάσεις (Φ4-Β) = aligned στον άξονα μέλους, reuse `unitAxis`/`beamAxisSceneFrame`/
  `buildAlignedGeometry` (μηδέν αλλαγή σε renderer/geometry).
- ✅ Διαδραστική γραμμή τομής (Φ4-Α) = 3-click aligned αλυσίδα σε αυθαίρετο άξονα, reuse
  `lineIntersectsRectangle`/`projectPointOnAxis`/`detailCoordsFor` + `drawGhostFaceDimensions` για το
  live preview (μηδέν νέο tool/preview/geometry framework· κεντρικός click dispatcher για το commit).

## Verification

- **Jest:** `npx jest "src/subapps/dxf-viewer/systems/dimensions/auto" "dim-association"` → 96/96 GREEN.
- **Browser (περιμετρικό):** κάτοψη με τοίχους+κολόνες+πέδιλα → κουμπί → dialog → confirm →
  3 σειρές και στις 4 πλευρές· 1 Ctrl+Z αναιρεί όλες· επιλογή υποσυνόλου → μόνο αυτό.
- **Browser (Φ3 interior):** check «Εσωτερικές διαστάσεις» → 2 αλυσίδες (οριζόντια+κατακόρυφη)
  μέσα από το κέντρο· μετακίνηση εσωτερικής κολόνας → η αλυσίδα ακολουθεί· `faces` → παρειές.
- **Browser (Φ4-Δ witness):** εσωτερική αλυσίδα → witness lines φτάνουν τις παρειές των
  κολόνων/στοιχείων με μικρό κενό (DIMEXO), χωρίς overlap· μεταβλητό μήκος ανά στοιχείο.
- **Browser (Φ4-Β aligned):** κάτοψη με **διαγώνιο** τοίχο → dialog → check «Λοξές διαστάσεις» →
  aligned dim **παράλληλη** στον τοίχο με πραγματικό μήκος· axis-aligned τοίχοι αμετάβλητοι.
- **Browser (Φ4-Α cut-line):** ribbon «Γραμμή τομής» → dialog → τράβα γραμμή μέσα από 3 κολόνες →
  κλικ1/κλικ2 (rubber-band) → μετακίνηση: **live ghost αλυσίδα** ακολουθεί τον κέρσορα σε offset →
  κλικ3 commit → **1 Ctrl+Z** αναιρεί όλη την αλυσίδα· Esc ακυρώνει· λοξή γραμμή → σωστά μήκη.

## Changelog

- **2026-07-02** — Φ1 (perimeter) implemented: pure engine (5 αρχεία) + batch commit
  wrapper + dialog + ribbon/command wiring + 23 jest.
- **2026-07-02** — Φ2 (BIM associativity) implemented: νέο `bimExtent` associationType
  (+`bimAnchor`) στο `types/dimension.ts` + axis-aware branch στο `dim-association-service.ts`
  (reuse `calculateBimEntity2DBounds`)· engine emits `edge`/`axis`. Auto-dims ακολουθούν
  τον host στο move. 30 auto jest + 54 dim-association jest (μηδέν regression). Εσωτερική
  διαστασιολόγηση = Φ3 (PROPOSED).
- **2026-07-02** — Φ3 (interior) implemented: νέο pure `auto-dimension-interior-planner.ts`
  (2 ορθογώνιες αλυσίδες μέσα από centroid, ArchiCAD Interior-Dimensioning μοντέλο) +
  `options.interior` toggle (default off) + checkbox/i18n el/en. Ρητό `PlannedSegment.axis`
  (SSoT μετρούμενου άξονα· factory διαβάζει `seg.axis` αντί `sideMeasuresX(side)`· `side`/`tier`
  → optional perimeter metadata). Reuse `classifyElement`/`detailCoordsFor`/`projectBoundsOntoAxis`/
  `dedupSorted`· `bimExtent` associativity δωρεάν. 87 jest (auto+dim-association) GREEN.
- **2026-07-02** — Φ4-Δ (interior witness lines) implemented: Gap-to-Element witness (Revit
  «Witness Line Control» default). `auto-dimension-interior-planner.ts` κρατά ανά coord την
  πλησιέστερη-στο-baseline **παρειά** του host (`perpByKey`, nearest-wins)· ext origin στην
  παρειά, dim line στο centroid → reuse `buildExtLine` DIMEXO/DIMEXE (**μηδέν νέα geometry**).
  Νέο export `quantizeCoord()` (single-source quantization). `dedupSorted`/factory/associativity
  αμετάβλητα. Γνωστός περιορισμός: witness endpoint stale σε κάθετη μετακίνηση host (η τιμή
  σωστή) — πλήρες associative witness = follow-up. 90 jest (auto+dim-association) GREEN.
- **2026-07-02** — Φ4-Β (aligned skewed) implemented: νέο pure `auto-dimension-aligned-planner.ts`
  (`planAlignedChains` — ένα aligned dim ανά **λοξό** τοίχο/δοκό, κατά μήκος του δικού του άξονα·
  skew gate ~0/90°). Reuse `unitAxis`/`beamAxisSceneFrame`/`perpUnit`/`project2D` + `buildAlignedGeometry`
  (**μηδέν αλλαγή σε renderer/geometry** — 'aligned' ήδη supported end-to-end). Νέο
  `PlannedSegment.dimensionType:'aligned'` + factory branch (`AlignedDimensionEntity`, χωρίς rotation/
  associations) + `options.alignedSkewed` toggle (default off) + checkbox/i18n el/en. Κολόνες εκτός
  (no axis SSoT). Γνωστός περιορισμός: μη-associative σε λοξό άξονα (vector `bimAnchor` = follow-up,
  shared service). 96 jest (auto+dim-association) GREEN.
- **2026-07-02** — Φ4-Α (interactive cut-line) implemented: νέο pure `auto-dimension-cutline-planner.ts`
  (`planCutLineChain` — γενίκευση interior/aligned σε **αυθαίρετο άξονα** = γραμμή τομής χρήστη· reuse
  `lineIntersectsRectangle`/`projectPointOnAxis`/`projectPolygonOnAxis`/`detailCoordsFor`/`dedupSorted`/
  `dotProduct`, **μηδέν νέα geometry**). 3-click ArchiCAD flow (Giorgio) + διάλογος πρώτα (reuse
  `AutoDimensionOptionsDialog`). Interactive tool μέσω κεντρικοποιημένης υποδομής: νέο `ToolType
  'auto-dim-cutline'` + tool-definition (category `drawing`)· zero-React FSM store
  (`auto-dimension-cutline-store.ts`)· click μέσω `useCanvasClickHandler` (`levelManager` accessor →
  `advanceCutlineClick` → `buildAutoDimensionEntities`+`addDimensionsToScene`, 1 undoable batch)· live
  preview μέσω `useAutoDimCutlineTool` (RAF `registerRenderCallback` + **υπάρχον** `drawGhostFaceDimensions`,
  **μηδέν αλλαγή σε renderer/PreviewCanvas**)· ribbon «Γραμμή τομής» + i18n el/en + escape-bus. Μη-associative
  slice (follow-up: vector `bimAnchor`). 104 jest (auto+dim-association, +8 cut-line planner) GREEN.
- **2026-07-04** — Φ4-Α **επέκταση σε raw (non-BIM) γεωμετρία** (Giorgio: «δεν λειτουργεί» σε **exploded**
  DXF). **Ρίζα**: το `crossedCoords` αγνοούσε σιωπηλά κάθε οντότητα όπου `classifyElement`→null (δηλ.
  σκέτες `line`/`polyline`/`lwpolyline`) → 0 crossings → 0 διαστάσεις χωρίς μήνυμα. Τα exploded σχέδια
  έχουν **γραμμές, όχι BIM τοίχους**. **Fix** (`auto-dimension-cutline-planner.ts`): νέο branch
  `rawLinearCutCoords` — για κάθε non-BIM entity υπολογίζει το **ακριβές** segment-segment σημείο τομής με
  τη γραμμή τομής (reuse `segmentIntersection` SSoT από `GeometryUtils`, **σωστό για κάθε κλίση** αντί για
  AABB projection) → προβολή στον άξονα (`projectPointOnAxis`), edge `'center'` (zero-thickness). Το BIM path
  αμετάβλητο (early-`continue`). LINE → 1 τομή· POLYLINE/LWPOLYLINE → ανά segment (closed-aware)· η exploded
  παρειά-παρειά αλυσίδα (πάχος+κενά) προκύπτει φυσικά. +6 jest (raw lines / exploded wall / rect lwpolyline /
  mixed BIM+raw / parallel-skip) → **55/55 auto GREEN**, μηδέν regression. tsc SKIP (N.17).

# ADR-449 — Structural Finish Skin (σοβάς κολόνας/δοκαριού, per-face adjacency-driven)

**Status:** 🟢 Slice 1 (data model + resolver + BOQ) + Slice 2 (3D band skin) + Slice 3 (2D finished outline) implemented, ΚΟΛΟΝΕΣ — pending browser-verify + commit (2026-06-13)
**Discipline:** DXF Viewer · BIM finishes · BOQ/ΑΤΟΕ · structural columns/beams
**Related:** ADR-363 (column/beam types + wall DNA), ADR-447 (wall plaster materials/catalog), ADR-396 (ETICS thermal envelope — exterior/interior classification, building footprint), ADR-401 (wall host-plan `coveredIntervals` — εξήχθη εδώ σε shared SSoT), ADR-445 (structural colour identity), ADR-413 (PBR textures), ADR-175/ΑΤΟΕ (BOQ)

---

## 1. Context / Problem

Τα στατικά δίνουν π.χ. κολόνα 50×50cm. Στην πραγματικότητα σοβατίζεται περιμετρικά → αν αλλάξουμε το `width/depth` για να «χωρέσει» ο σοβάς, **αλλοιώνουμε τα στατικά**. Θέλουμε ταυτόχρονα:
- (α) **αμετάβλητο στατικό πυρήνα** (50×50, ό,τι έδωσε ο μηχανικός),
- (β) **πραγματική σοβατισμένη όψη**,
- (γ) **ποσότητες σοβά** για επιμετρήσεις (BOQ).

**Κρίσιμο (Giorgio):** ο σοβάς **ΔΕΝ είναι ομοιόμορφος**. Κάθε παρειά κολόνας/δοκαριού μπορεί να είναι:
- **εσωτερική** → σοβάς Knauf (`mat-plaster-int`),
- **εξωτερική** → εξωτ. σοβάς (`mat-plaster-ext`) ή θερμοπρόσοψη (ETICS),
- **καλυμμένη από τοίχο** → καθόλου σοβάς,
- **ΜΕΡΙΚΩΣ καλυμμένη**: παρειά 50cm όπου δύο τοίχοι ακουμπάνε 25+25 → σοβατίζεται μόνο το εκτεθειμένο μεσαίο κομμάτι.

Δοκάρια ομοίως: πάνω=πλάκα, κάτω=κορυφές τοίχων, άκρα=κολόνες → συνήθως μένουν 2 πλάγιες όψεις.

**Revit / big-player:** Structural Columns = single-material πυρήνας (immutable· το αναλυτικό μοντέλο ποτέ δεν αλλάζει)· τα finishes είναι **πρόσθετα αρχιτεκτονικά** (additive skin), η «πραγματική» όψη (πυρήνας+2×σοβάς) είναι **derived** (display/BOQ), ΟΧΙ αποθηκευμένη στατική διάσταση.

## 2. Decision

### 2.1 Αρχή SSoT
- `ColumnParams.width/depth` (& `BeamParams`) = **στατικός πυρήνας, immutable**. Ο σοβάς ΠΟΤΕ δεν τον αλλάζει.
- Ο σοβάς = additive metadata (`finish?: StructuralFinishSpec`, stored) + **derived** geometry/ποσότητες (resolver, ποτέ stored).
- **Δεν** επαναχρησιμοποιεί το `envelopeLayer` (ETICS): εκείνο είναι meters/zone/exterior-only — τα δύο **συνυπάρχουν** (εξωτ. όψη = ETICS, εσωτ. = Knauf).

### 2.2 Κεντρικός resolver (ΕΝΑ SSoT για 3D/2D/BOQ)
`bim/finishes/structural-finish-resolver.ts` — pure. Για κάθε ακμή του footprint:
1. `covered = ⋃ coveredIntervals(edge, wallFootprint)` (REUSE shared SSoT),
2. `exposed = exposedComplement(covered)`,
3. ανά exposed υπο-τμήμα: midpoint + outward normal `(dy,−dx)` (CCW) → injected `classify` → interior/exterior → υλικό από spec → μήκος×scale → m.

Output `StructuralFinishFaces` = εκτεθειμένες υπο-ακμές + `interiorAreaM2`/`exteriorAreaM2`. Η ταξινόμηση εγχέεται ως callback → resolver 100% testable με stub.

### 2.3 Classification (scene adapter)
`bim/finishes/structural-finish-scene.ts` χτίζει obstacles (footprints τοίχων) + classifier:
1. ρητό `column.params.envelopeFunction` ('exterior'/'interior') υπερισχύει (Revit Wall-Function-style override),
2. αλλιώς γεωμετρικά: παρειά **exterior** όταν το midpoint της βρίσκεται στο εξώτατο όριο (outer ring) component που **περικλείει χώρο** (holes>0 = πραγματικό περίγραμμα κτιρίου, REUSE `computeBuildingFootprint`). Μεμονωμένη εσωτερική κολόνα (δικό της component χωρίς holes) → όλες interior (Knauf), σωστά.

### 2.4 BOQ (ξεχωριστές γραμμές, εξαιρώντας καλυμμένα)
`bim/services/structural-finish-boq.ts` (mirror `boq-multi-layer-builder`):
- **parent** = στατικός πυρήνας (κολόνα `OIK-2.03` m³ σκυρόδεμα, αμετάβλητο, `isGroupParent:true`),
- **child interior** = εσωτ. σοβάς (`OIK-4.01` m², `interiorAreaM2`) — αν >0,
- **child exterior** = εξωτ. σοβάς (`OIK-4.03` m², `exteriorAreaM2`) — αν >0.

Deterministic IDs: `boq_bim_${id}` / `_finish_int` / `_finish_ext`. Hook στο `BimToBoqBridge.upsertWithFinish` (dispatch: opening → multiLayerWall → **finish** → single-entry). Contribution υπολογίζεται upstream στο `column-boq-feed` (έχει πρόσβαση στη σκηνή). Delete cascade ΗΔΗ καλύπτει finish children (parentBoqItemId).

## 3. Files (Slice 1)

**NEW:**
- `bim/geometry/shared/segment-polygon-coverage.ts` — `coveredIntervals` (εξήχθη από `wall-host-plan-builder`, N.0.2) + `mergeIntervals`/`exposedComplement` + `Pt2`.
- `bim/finishes/structural-finish-types.ts` — `StructuralFinishSpec` (stored) + `StructuralFinishFaces` (derived) + defaults (15mm, Knauf/σοβάς).
- `bim/finishes/structural-finish-resolver.ts` — pure resolver.
- `bim/finishes/structural-finish-scene.ts` — scene adapter (obstacles + classifier).
- `bim/services/structural-finish-boq.ts` — pure BOQ payload builder.
- tests: `structural-finish-resolver.test.ts` (8) + `structural-finish-boq.test.ts` (5).

**MOD:**
- `bim/geometry/wall-host-plan-builder.ts` — import shared `coveredIntervals`, re-export `Pt2` (μηδέν αλλαγή σε importers).
- `bim/services/boq-multi-layer-builder.ts` — `export buildBaseRow` (SSoT reuse).
- `bim/services/BimToBoqBridge.ts` — `BimEntityForBoq.finishContribution` + `upsertWithFinish`.
- `bim/types/column-types.ts` — `finish?: StructuralFinishSpec`.
- `hooks/data/column-boq-feed.ts` — attach `finishContribution` (μέσω `computeColumnFinishContribution`).

## 3.bis Files (Slice 2 — 3D band skin)

**NEW:**
- `bim-3d/converters/structural-finish-3d.ts` — `buildColumnFinishSkin(column, walls, baseY, levelId)`: ανά exposed segment → plan band quad (παρειά μετατοπισμένη ΕΞΩ κατά το πάχος, CCW outward normal) → `stripPrismGeometry` (REUSE — ο καθαρός geometry SSoT του `envelope-three-mesh`) → `THREE.Mesh` με `getMaterial3D(seg.materialId)`. Tags `structuralFinish:true` + κοινό `bimId`/`bimType:'column'`.
- tests: `bim-3d/converters/__tests__/structural-finish-3d.test.ts` (10).

**MOD:**
- `bim/finishes/structural-finish-scene.ts` — εξαγωγή SSoT core `computeColumnFinishFaces(column, coreFootprint, heightMm, walls)` (obstacles + classifier + resolver). Το `computeColumnFinishContribution` (BOQ) ΚΑΙ το 3D το διαβάζουν → ΕΝΑ σημείο face-resolution.
- `bim-3d/converters/bim-three-structural-converters.ts` — `columnToMesh` νέα προαιρετική `walls` param + return `THREE.Mesh | THREE.Group | null`· flat-path: αν υπάρχει σοβάς → composite `Group { πυρήνας + finish }`. Attached-prism path = πυρήνας-only (κεκλιμένες κορυφές = μετέπειτα).
- `bim-3d/scene/bim-scene-attach-syncs.ts` — `syncColumns` περνά `entities.walls`.
- `bim-3d/placement/ColumnPlacementGhost.ts` — type guard `instanceof THREE.Mesh` (ghost δεν περνά walls → πάντα πυρήνας-only Mesh).

**Σημείωση SSoT (απόκλιση από handoff):** χρησιμοποιήθηκε `stripPrismGeometry` αντί `addBandPrism` — το `addBandPrism` δένει `makeEnvelopeMesh` → envelope material/tags (λάθος catalog για σοβά)· το `stripPrismGeometry` είναι ο καθαρός geometry sibling στο ίδιο αρχείο (ίδιο `ROT_X_NEG_90`) → σωστότερο SSoT-reuse.

## 3.ter Files (Slice 3 — 2D finished outline)

**MOD:**
- `bim/finishes/structural-finish-scene.ts` — `computeColumnFinishFaces` στενεύτηκε σε **structural-subset interfaces** `ColumnFinishSource` / `WallFinishObstacle` (depend-on-minimal-interface) ώστε να το τροφοδοτούν ΚΑΙ τα BIM `ColumnEntity`/`WallEntity` (3D) ΚΑΙ τα canvas `DxfColumn`/`DxfWall` (2D, direct entities χωρίς `ifcType`) — μηδέν cast. `buildColumnClassifier` παίρνει `envelopeFunction` αντί ολόκληρης κολόνας.
- `bim/renderers/ColumnRenderer.ts` — `FinishFacesByColumn` type + `setColumnFinishFaces()` injection (mirror `WallRenderer.setOpeningsByWall`) + `drawFinishOutline()`: ανά εκτεθειμένη υπο-ακμή → offset «λωρίδα» (CCW outward normal × πάχος, με end-caps) σε plaster flat colour (`getMaterialFlatColorHex`, SSoT). Καλυμμένες παρειές → καμία γραμμή. ADR-040: pure ctx, zero subscriptions.
- `canvas-v2/dxf-canvas/dxf-renderer-frame-builders.ts` — `buildFinishFacesByColumn(entities)`: per-frame index (μόνο ενεργές κολόνες· walls lazily· reuse `computeColumnFinishFaces`).
- `canvas-v2/dxf-canvas/DxfRenderer.ts` — inject `buildFinishFacesByColumn(scene.entities)` (δίπλα στο `setOpeningsByWall`· ADR-040 orchestrator-drives pattern).
- `rendering/core/EntityRendererComposite.ts` — `setColumnFinishFaces()` pass-through.
- tests: `bim/renderers/__tests__/ColumnRenderer-finish.test.ts` (6).

Πλέον ο **ίδιος** `computeColumnFinishFaces` τροφοδοτεί **BOQ + 3D + 2D** — ΕΝΑ σημείο face-resolution.

## 3.quater Files (Slice 4 — ΔΟΚΑΡΙΑ, full mirror)

**Κεντρική απόφαση (Revit-grade):** για το δοκάρι σοβατίζονται **μόνο οι 2 πλάγιες όψεις** (ακμές ∥ άξονα, ύψος = structural depth). Τα **άκρα** (ακμές ⊥ άξονα) είναι δομική σύνδεση/frame-into → **ποτέ σοβατισμένα** — αποκλείονται **σημασιολογικά** (`includeEdge`), όχι μέσω obstacle (το trimmed άκρο είναι *coincident* με την παρειά κολόνας, όχι *μέσα* → η coverage θα ήταν αναξιόπιστη). Η πάνω όψη (πλάκα) + κάτω όψη (soffit/κορυφές τοίχων) είναι ΟΡΙΖΟΝΤΙΕΣ → εκτός του vertical-band μοντέλου του resolver (bottom-coverage = DEFER).

**MOD:**
- `bim/finishes/structural-finish-resolver.ts` — `+ optional includeEdge?(a,b,i)` (generic, default = όλες οι ακμές → byte-for-byte για κολόνες).
- `bim/finishes/structural-finish-scene.ts` — `buildColumnClassifier` → **`buildStructuralFinishClassifier`** (entity-agnostic, κοινό κολόνα+δοκάρι) + `+ BeamFinishSource` + `computeBeamFinishFaces` (heightMm=depth, obstacles=walls, includeEdge ∥-άξονα) + `computeBeamFinishContribution`.
- `bim/types/beam-types.ts` — `+ finish?: StructuralFinishSpec` (mirror column).
- `bim-3d/converters/structural-finish-3d.ts` — extract pure **`buildFinishSkinFromFaces`** (entity-agnostic core)· `buildColumnFinishSkin` + νέο `buildBeamFinishSkin` το καλούν.
- `bim-3d/converters/bim-three-structural-converters.ts` — `beamToMesh(+walls)` → composite `Group {πυρήνας+σοβάς}` (flat-path· depth ΑΜΕΤΑΒΛΗΤΟ). *(MIXED αρχείο με ADR-448)*
- `bim-3d/scene/BimSceneLayer.ts` — περνά `entities.walls` στο beam call.
- `bim/renderers/structural-finish-outline-2d.ts` *(NEW)* — extract pure SSoT `drawStructuralFinishOutline` (offset «λωρίδα» ανά εκτεθειμένη όψη, plaster colour). `column-renderer-overlays.ts:drawColumnFinishOutline` + `BeamRenderer` το καλούν → μηδέν διπλασιασμός. *(overlays = MIXED· split από άλλο agent)*
- `bim/renderers/BeamRenderer.ts` — `FinishFacesByBeam` + `setBeamFinishFaces()` + draw call.
- `canvas-v2/dxf-canvas/dxf-renderer-frame-builders.ts` — `buildFinishFacesByBeam(entities)`.
- `canvas-v2/dxf-canvas/DxfRenderer.ts` — inject `buildFinishFacesByBeam` (ADR-040 orchestrator-drives).
- `rendering/core/EntityRendererComposite.ts` — `setBeamFinishFaces()` pass-through.
- `hooks/data/beam-boq-feed.ts` *(NEW)* — `beamBoqEntity(beam, scene)` (mirror `column-boq-feed`)· `useBeamPersistence` persist/restore wired (finish-inactive → byte-identical single-entry).
- tests *(NEW)*: `structural-finish-scene-beam` (7) · `structural-finish-3d-beam` (7) · `BeamRenderer-finish` (5) · `beam-boq-feed` (3) — 22/22.

## 3.quinquies Files (Slice 5 — toggle + ενεργοποίηση + per-element override)

**Κεντρικές αποφάσεις (Giorgio):** (1) master toggle = **scalar boolean `showFinishSkin`** στο BIM render settings store (mirror `showHeatLoad`/ADR-422), **default ON**· (2) **visibility-only** — το factory δίνει ΠΑΝΤΑ `finish.enabled:true`, ο διακόπτης ελέγχει μόνο εμφάνιση· (3) **BOQ μετράει πάντα** (Revit schedule = model, όχι view) → ο διακόπτης είναι καθαρά visual, μηδέν αλλαγή σε BOQ feeds/persistence.

**SSoT gate:** `bim/finishes/structural-finish-visibility.ts` *(NEW)* `isStructuralFinishVisible()` (event-time `getState().showFinishSkin ?? true`) — ΕΝΑ σημείο, το διαβάζουν ΚΑΙ ο 2D orchestrator ΚΑΙ ο 3D converter (οι pure builders/leaves μένουν ανέγγιχτοι, ADR-040).

**MOD (core/state):**
- `bim/finishes/structural-finish-types.ts` — `+ STRUCTURAL_FINISH_INTERIOR_MATERIAL/_EXTERIOR/_DEFAULT_THICKNESS_MM` + `createDefaultStructuralFinishSpec()` (enabled:true) + per-element override core `FinishParamField` / `readFinishParamValue` / `applyFinishParam` (entity & UI agnostic).
- `config/bim-render-settings-types.ts` — `+ showFinishSkin?` (BimRenderSettings) + `showFinishSkin` (ResolvedBimSettings) + resolve `?? true`.
- `state/bim-render-settings-store.ts` (+`-store-types.ts`) — `setShowFinishSkin` (idempotent + debounceWrite) + buildRaw/loadForLevel/standalone-write wiring.
- `hooks/drawing/column-completion.ts` + `beam-completion.ts` — factory δίνει `finish: createDefaultStructuralFinishSpec()`.

**MOD (gate — render):**
- `canvas-v2/dxf-canvas/DxfRenderer.ts` — 2D gate: `isStructuralFinishVisible()` false → κενά finish Maps (ADR-040 orchestrator-drives· changelog ενημερώθηκε).
- `bim-3d/converters/bim-three-structural-converters.ts` — 3D gate στα `buildColumn/BeamFinishSkin` call sites. *(MIXED αρχείο με ADR-448)*

**NEW/MOD (UI — master toggle):**
- `ui/ribbon/components/ShowFinishSkinToggle.tsx` *(NEW)* — mirror `ShowHeatLoadToggle` (button + aria-pressed, reactive selector).
- `ui/ribbon/data/view-tab-bim-settings.ts` — `FINISH_SKIN_BUTTON` στο BIM Graphics panel.
- `ui/ribbon/components/RibbonPanel.tsx` — dispatcher case `show-finish-skin-toggle`.

**NEW/MOD (UI — per-element override, κοινό SSoT column+beam):**
- `ui/ribbon/hooks/bridge/finish-param.ts` *(NEW)* — combobox options (enabled/υλικά plaster IDs/πάχος) + generic `resolveFinishComboboxState` / `applyFinishComboboxChange` (πάνω στον pure core).
- `ui/ribbon/hooks/bridge/{column,beam}-command-keys.ts` — `*_FINISH_KEYS` + `*_FINISH_KEY_TO_FIELD` + `is*FinishKey`.
- `ui/ribbon/hooks/{useRibbonColumnBridge,useRibbonBeamBridge}.ts` — delegate read/write (≤6 γρ./bridge → <500).
- `ui/ribbon/data/{contextual-column-tab,contextual-beam-tab}.ts` — panel «Σοβάς» (4 comboboxes).
- `src/i18n/locales/{el,en}/dxf-viewer-shell.json` — `ribbon.commands.finishSkin.*` (toggle) + `ribbon.commands.finishEditor.*` + `ribbon.panels.{column,beam}FinishSkin`.
- tests *(NEW)*: `structural-finish-types` (factory+override core) · `structural-finish-visibility` (gate) · `finish-param` (combobox helpers) — 75/75 ADR-449 σύνολο. Slice 1-4 fixtures: ρητό `finish` override (factory πλέον δίνει default).

## 4. Roadmap (slices)

- **Slice 1** ✅ — data model + resolver + BOQ (ΚΟΛΟΝΕΣ).
- **Slice 2** ✅ — 3D render (band skin κολόνας, REUSE `stripPrismGeometry`). Flat-path μόνο· attached/κεκλιμένες κορυφές = μετέπειτα.
- **Slice 3** ✅ — 2D render (finished outline offset ανά εκτεθειμένη παρειά + core = διπλή γραμμή). Per-frame index injection (mirror openings-by-wall).
- **Slice 4** ✅ — Δοκάρια (2 πλάγιες όψεις· άκρα σημασιολογικά εκτός· 3D band skin + 2D outline + BOQ· FULL SSoT reuse). Static depth ΑΜΕΤΑΒΛΗΤΟ.
- **Slice 5** ✅ — View toggle «Σοβατισμένη όψη» (`showFinishSkin` per-view, default ON) + ενεργοποίηση στο factory (νέα στοιχεία γεννιούνται με σοβά) + per-element override (enabled/υλικά/πάχος) στα contextual ribbon tabs. Visibility-only semantics (BOQ μετράει πάντα).

## 5. Known / Deferred
- **beam↔column junction (#2):** ο σοβάς κολώνας εφαρμόζεται σε ΟΛΕΣ τις 4 παρειές, ακόμη κι εκεί που καρφώνεται δοκάρι (το δοκάρι δεν είναι obstacle όπως ο τοίχος). Revit-grade refinement = mutual obstacle column↔beam στη σύνδεση (frame-into δεν σοβατίζεται). Υπό επανέλεγχο μετά το fix #3.
- Όχι αναδρομικό: υπάρχουσες persisted κολόνες/δοκάρια χωρίς `finish` δεν αποκτούν σοβά (μόνο νέα στοιχεία μετά το Slice 5)· retroactive backfill = DEFER.
- Stale finish children όταν ο χρήστης απενεργοποιεί τον σοβά (single-entry path δεν τα καθαρίζει — ίδιο με wall multi-layer shrink· deferred re-sync).
- Beam coverage κάτω-όψης (soffit) από κορυφές τοίχων = refinement (οριζόντια όψη, εκτός vertical-band μοντέλου).
- Beam obstacle κολόνας mid-span σε πλάγια όψη (rare) + curved-beam ακριβές cap exclusion (chord-based v1) = μετέπειτα.
- ETICS-grade per-element exterior detection (πέρα από outer-ring proximity) = μετέπειτα slice.

## 6. Changelog
- **2026-06-13** — Slice 1: data model + pure resolver (per-face, partial-coverage) + BOQ multi-layer (parent πυρήνας + interior/exterior σοβάς) + scene classifier. `coveredIntervals` εξήχθη σε shared SSoT (N.0.2). 13/13 jest. Pending browser-verify + commit.
- **2026-06-13** — Slice 2: 3D band skin κολόνας. SSoT core `computeColumnFinishFaces` (κοινό BOQ+3D). `buildColumnFinishSkin` ανά exposed segment → vertical band prism (REUSE `stripPrismGeometry`) με `getMaterial3D`. `columnToMesh` → composite `Group {πυρήνας+σοβάς}` (flat-path)· πυρήνας `width/depth` αμετάβλητος. Ghost guard. 10/10 jest + tsc καθαρό. Pending browser-verify + commit.
- **2026-06-13** — Slice 3: 2D finished outline. SSoT core στενεύτηκε σε `ColumnFinishSource`/`WallFinishObstacle` (κοινό BOQ+3D+2D, μηδέν cast για DxfColumn/DxfWall). Per-frame `buildFinishFacesByColumn` → `EntityRendererComposite.setColumnFinishFaces` → `ColumnRenderer.drawFinishOutline` (offset «λωρίδα» ανά εκτεθειμένη παρειά, plaster colour SSoT, ADR-040 orchestrator-drives). 6/6 jest + tsc καθαρό. ADR-040 changelog ενημερώθηκε. Pending browser-verify + commit.
- **2026-06-13** — Slice 5 fixes (browser-verify γύρος 1, Giorgio): **(#3 φορά)** το `buildOutlineRect` του δοκαριού παράγει **CW** outline → ο resolver `(dy,−dx)` έδειχνε ΜΕΣΑ → ο σοβάς εμφανιζόταν εντός σώματος. Fix: `ensureCCW` (shoelace signed-area) στον resolver → κανονικοποίηση winding· διορθώνει **2D ΚΑΙ 3D, κολόνα+δοκάρι** ταυτόχρονα (η κολόνα ήδη CCW → no-op). **(#1 γωνίες)** το 3D έχτιζε ένα band ανά παρειά χωρίς σύνδεση → οι 4 γωνίες κολώνας έμεναν ανοιχτές. Fix: `addFinishCornerFills` — παραλληλόγραμμο γεμίσματος [v,v+n1,v+n0+n1,v+n0] σε κάθε **convex** κοινή κορυφή (reflex → skip, bands overlap)· δοκάρι (2 χωριστές όψεις) → μηδέν γωνίες. Tagged `finishCorner`. Regression: beam outward-extent test + corner-count test. **(#2 μικρές πλευρές δοκαριού)** = υπό επανέλεγχο μετά το #3 (πιθανό artifact)· πιθανή μελλοντική εργασία = beam↔column mutual obstacle στη σύνδεση (frame-into δεν σοβατίζεται). 76/76 ADR-449 jest + tsc καθαρό. Pending re-verify.
- **2026-06-13** — Slice 5: **toggle + ενεργοποίηση + per-element override**. Master view toggle `showFinishSkin` (scalar boolean, mirror `showHeatLoad`, **default ON**)· SSoT gate `isStructuralFinishVisible()` (event-time, κοινό 2D orchestrator + 3D converter — pure builders/leaves ανέγγιχτοι, ADR-040)· factory δίνει πλέον `createDefaultStructuralFinishSpec()` (enabled:true, plaster defaults 15mm)· **visibility-only** (BOQ μετράει πάντα — schedule=model)· per-element override (enabled/υλικά/πάχος) στα contextual ribbon tabs μέσω κοινού `finish-param` helper + pure override core (`read/applyFinishParam`)· master toggle UI `ShowFinishSkinToggle` (View tab). i18n el+en ΠΡΩΤΑ (N.11), Radix-free combobox (υπάρχον ribbon SSoT). 75/75 ADR-449 jest + 31/31 store regression. Slice 1-4 fixtures ενημερώθηκαν (ρητό `finish` override). ADR-040 changelog ενημερώθηκε. Pending browser-verify + commit. *(MIXED file με ADR-448: bim-three-structural-converters)*
- **2026-06-13** — Slice 4: **ΔΟΚΑΡΙΑ** (full mirror, FULL SSoT). `BeamParams.finish?`· resolver `+ includeEdge` (generic, default no-op)· scene adapter `computeBeamFinishFaces`/`computeBeamFinishContribution` (heightMm=depth· **2 πλάγιες όψεις ∥ άξονα· άκρα ⊥ άξονα σημασιολογικά εκτός**· classifier γενικεύτηκε `buildStructuralFinishClassifier`)· 3D pure core `buildFinishSkinFromFaces` extract + `buildBeamFinishSkin` + `beamToMesh(+walls)` composite (depth ΑΜΕΤΑΒΛΗΤΟ)· 2D pure `drawStructuralFinishOutline` extract (column overlays + beam το καλούν, μηδέν διπλασιασμός) + `buildFinishFacesByBeam` → `setBeamFinishFaces` (ADR-040)· BOQ `beam-boq-feed` wired (finish-inactive → byte-identical). 22/22 jest + 29/29 column regression + tsc καθαρό στα δικά μου. ADR-040 changelog ενημερώθηκε. Pending browser-verify + commit. *(MIXED files με ADR-448: bim-three-structural-converters, BimSceneLayer, column-renderer-overlays)*

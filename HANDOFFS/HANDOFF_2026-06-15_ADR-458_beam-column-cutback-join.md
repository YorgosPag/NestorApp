# HANDOFF — ADR-458: Beam-to-Column **Cutback** (column cuts beam, Revit join-geometry) + ADR-449 Slice 12 **2Δ completion**

**Ημερομηνία:** 2026-06-15 · **Quality bar:** FULL ENTERPRISE + FULL SSOT, **Revit-grade (big-player)**. **Firestore-first. Confirm-repro πριν re-implement.**
**Κανόνες (ΑΠΑΡΑΒΑΤΑ):** Commit/push **ΜΟΝΟ ο Giorgio** (N.(-1)). **Working tree SHARED με άλλους agents → `git add` ΜΟΝΟ δικά σου αρχεία, ΠΟΤΕ `-A`/`--no-verify`.** tsc: **ο Giorgio** (`! npx tsc --noEmit`, N.17 — ΕΝΑ tsc τη φορά). **Ελληνικά πάντα.** N.15: ΕΚΚΡΕΜΟΤΗΤΕΣ + ADR + adr-index + MEMORY ίδιο commit με κώδικα.

---

## 0. ΑΠΟΣΤΟΛΗ (Giorgio, verbatim πρόθεση)

Ο Giorgio τοποθέτησε **κολόνα που τέμνει δοκάρι υπό λοξή γωνία (15°)** και παρατήρησε **2 προβλήματα**:

1. **(ΚΥΡΙΟ) Ο πυρήνας του δοκαριού μπαίνει ΜΕΣΑ στο σώμα της κολόνας και ΔΕΝ κόβεται αυτόματα** (διπλο-μετρημένος όγκος + βρώμικη γεωμετρία). «Τι κάνουν οι μεγάλοι;» → **Revit join-geometry: η ΚΟΛΟΝΑ ΝΙΚΑΕΙ, το δοκάρι κόβεται στην παρειά της κολόνας** (priority στήλες > δοκάρια). Net volume = overlap μετριέται ΜΙΑ φορά (ανήκει στην κολόνα).
2. **(δευτερεύον) 2Δ κάτοψη: ο σοβάς του δοκαριού δεν αναπαρίσταται σωστά, ενώ στο 3Δ είναι σωστός.**

---

## 1. ΤΟ PLAN (εγκεκριμένο από Giorgio)

### Part A — ADR-449 **Slice 12 completion** (2Δ σοβάς fix) · ΜΙΚΡΟ, ΓΡΗΓΟΡΟ, ΞΕΚΙΝΑ ΑΠΟ ΕΔΩ

**Root cause (διαγνωσμένο):** Το committed Slice 12 πρόσθεσε storey-aware `columnExtents` ΜΟΝΟ στο **3Δ** path. Το **2Δ** path δεν τα περνά:
- `canvas-v2/dxf-canvas/dxf-renderer-frame-builders.ts:97` → `computeStructuralFinishSilhouette(columns, beams, walls, 0)` — **λείπει το 5ο όρισμα `columnExtents`** + hardcoded `floorElevationMm=0`.
- → η storey-ceiling κολόνα (height=4000, storey ceiling=3000) παίρνει **raw 4000** στο 2Δ (legacy fallback στο `structural-finish-scene-silhouette.ts` `columnZExtent`) → λάθος band grouping (επιπλέον band [3000,4000] με κολόνα-μόνο) → **αποκλίνον outline 2Δ vs 3Δ**.

**Fix:** Στο `buildStructuralFinishSilhouette2D` (`dxf-renderer-frame-builders.ts`):
1. Χτίσε `columnExtents` (`ColumnVerticalExtentLookup`) **ακριβώς** όπως το 3Δ `buildColumnVerticalExtents` (`bim-3d/scene/bim-scene-structural-finish-sync.ts:67–120`) — κάλεσε `resolveColumnVerticalExtentMm` per column (`bim/geometry/column-vertical-profile.ts`).
2. Πέρασέ το ως 5ο όρισμα.
3. Πέρασε το **πραγματικό** `floorElevationMm` (από το active-storey context / `useActiveStoreyStore`) αντί για hardcoded `0` (αλλιώς λάθος σε ορόφους με FFL≠0).

⚠️ Το 2Δ είναι ADR-040-critical path (`DxfRenderer` / frame-builders) → **CHECK 6D: stage ADR-040** στο commit. Reuse το ΙΔΙΟ `resolveColumnVerticalExtentMm` (μηδέν duplication).

### Part B — NEW **ADR-458** «Structural join / cutback — column cuts beam» (Revit-grade, FULL SSOT)

**Αρχή:** **DERIVED** (ΠΟΤΕ persisted — structural params `width/depth/axis` = immutable SSoT, ίδια σύμβαση με σοβά ADR-449 + foundation net-volume ADR-441 Slice 4), **column wins**, via boolean `safeDifference`. Ρέει σε **2Δ κάτοψη + 3Δ + BOQ (net volume)**. Ο σοβάς silhouette **μένει αμετάβλητος** (το union κολόνα+δοκάρι ήδη χειρίζεται την επικάλυψη — μην τον αγγίξεις).

| Βήμα | Αρχείο | Τι |
|---|---|---|
| **B1** pure SSoT | NEW `bim/geometry/beam-column-cutback.ts` | `computeBeamCutbackOutline(beamOutlineVerts, columnFootprints[]) → Pt2[][]` (MultiPolygon· `safeDifference`)· + `computeBeamCutbackNetAreaM2`. Handles λοξές/composite κολόνες (world footprint **ήδη rotated**) + multi-piece output. **Fast-path identity** όταν μηδέν τομή (zero regression). Pure + unit-testable. |
| **B2** 3Δ | `bim-3d/converters/bim-three-structural-converters.ts` `beamToMesh` (~L239, rectangular path, πριν το `buildShape(verts)`) | local `effectiveVerts = trimmed ?? verts`. Τα `columns` **ΗΔΗ περνιούνται** (5ο param, ADR-449 Slice 6). `buildShape`+`extrudeAndRotate` δέχονται **ήδη** αυθαίρετο polygon → multi-piece = πολλά shapes. **Μηδέν αλλαγή στο `syncBeams`** (`BimSceneLayer.ts:328–340` ήδη δίνει `entities.columns`). |
| **B3** BOQ | `hooks/data/beam-boq-feed.ts` `beamBoqEntity` | net geometry (override `geometry.volume`/`area`) — **mirror** `foundationStripNetGeometry` (`bim/geometry/foundation-grid-boq.ts:62–78`) + `applyFoundationGridNet` (`hooks/data/foundation-boq-feed.ts:31–36`). |
| **B4** 2Δ κάτοψη | level-scene assembly → `BeamRenderer` | derived **trimmed effective outline** που διαβάζει ο `BeamRenderer` (fill/stroke/hatch-clip/**hit-test** L107/119/136-137/212/312) → **μηδέν αλλαγή στον leaf renderer** (ADR-040-safe). **Design choice να κλειδωθεί στην αρχή του impl:** (α) derived `geometry.outline` override σε scene-reconcile spot (zero renderer change, αλλά χρειάζεται cross-element reconcile timing) **Ή** (β) `displayOutline?: Polygon3D` derived prop στο `BeamEntity` (renderer reads `beam.displayOutline ?? beam.geometry.outline`). Πρότασή μου: **(α)** αν βρεθεί καθαρό scene-assembly spot· αλλιώς (β). |

**Revit-grade αποφάσεις (ΗΔΗ παρμένες — μην τις ξανα-ρωτήσεις):**
- **Column wins** (priority στήλες > δοκάρια), πάντα.
- **Exact cut** v1 (χωρίς clearance/bearing setback → **DEFER**).
- **Derived, ΠΟΤΕ persisted** (geometry recomputed on-load· βλ. §4).

---

## 2. SSoT HELPERS ΠΡΟΣ REUSE (N.0.2 — ΜΗΝ φτιάξεις νέα)

| Helper | Path | Χρήση |
|---|---|---|
| `safeDifference`/`safeUnion`/`safeIntersection` | `bim/geometry/shared/safe-polygon-boolean.ts` | boolean (polygon-clipping, MIT)· επιστρέφει **MultiPolygon** (iterate pieces)· winding-agnostic· robust pipeline· fail→`[]` |
| `convexPolygonDifference`/`isConvexRing` | `bim/geometry/shared/convex-polygon-difference.ts` | πιο robust alternative αν η κολόνα είναι **κυρτή** (rectangular)· degenerate-flush-safe |
| `multiPolygonArea` | `bim/geometry/shared/polygon-utils.ts` | net area από MultiPolygon |
| `computeColumnGeometry` | `bim/geometry/column-geometry.ts:91` | world footprint κολόνας (composite Γ + rotation **ήδη baked** στο `entity.geometry.footprint.vertices` → `[[x,y],…]`) |
| `computeBeamGeometry` / `buildOutlineRect` | `bim/geometry/beam-geometry.ts:39,165` | beam outline (CCW)· **το `geometry.outline.vertices` είναι το μόνο plan-footprint SSoT** |
| `ColumnFinishObstacle` precedent | `bim/finishes/structural-finish-scene.ts:139-142,390-435` (`computeBeamFinishFaces(beam, outline, depth, walls, columns[], floorElev)`) | **ΤΟ ΚΟΝΤΙΝΟΤΕΡΟ precedent**: cross-element column-footprint data flow στο beam processing. `const columns = scene.entities.filter(isColumnEntity)` |
| `columnSupportAlong` | `bim/columns/column-face-trim.ts:44` | scalar projection footprint→direction (world-space, rotation-safe)· χρήσιμο για 1D «πόσο μπαίνει», ΟΧΙ για 2D boolean |
| `resolveColumnVerticalExtentMm` | `bim/geometry/column-vertical-profile.ts` | (Part A) storey-aware z-extent· ΙΔΙΟ με τον πυρήνα |

---

## 3. FIRESTORE BASELINE (αναπαράξιμη σκηνή — confirm-repro)

- company `comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757` · project `proj_1d45b55b-e5ea-41fb-9466-bda795361e65`
- floorplan `file_f6b1782f-9e78-4ef6-a461-11ae41724d45` · floor `flr_4e7868ba-32b3-4327-9a24-b2de5320adb5` (Ισόγειο, elevation 0, **height 3 → storey ceiling 3000mm**) · level `lvl_aec46939-c091-4eb9-955a-2b3be650e71a`
- **Κολόνα** `col_fb3215e9-cabc-4c35-bc79-61669775d5a1`: `kind:rectangular` με **`composite` Γ-shape (6 κορυφές)**, **`rotation:15`**, width 753.7 / depth 568, `position(21.710, 4.0645)`, `topBinding:storey-ceiling`, **`height:4000`** (αλλά storey ceiling=3000 → ο σοβάς ΠΡΕΠΕΙ 3000 — Slice 12), `baseBinding:storey-floor`, `attachTopToIds:[]` (ΟΧΙ attached — μόνο γεωμετρική τομή), finish enabled 15mm. **`geometry` ΑΠΟΥΣΑ στο Firestore** (recomputed on-load — βλ. §4).
  World footprint (υπολ. composite+15°+pos): `P1(21.598,3.516) P2(22.082,3.646) P3(22.015,3.887) P4(21.774,3.822) P5(21.580,4.546) P6(21.338,4.483)`.
- **Δοκάρι** `beam_d9d8da55-4586-40b0-9f85-16424228dc31`: straight, άξονας `(21.885,4.0127)→(23.588,4.0127)` (οριζόντιος +X), width 250 / depth 500, `topElevation:3000` (z 2.5→3.0), finish enabled 15mm. Outline `x[21.885,23.588]×y[3.8877,4.1377]`.
- **Η τομή:** η λοξή ακμή κολόνας **P3→P5** κόβει τη **ΝΔ γωνία** του δοκαριού (τέμνει δυτική παρειά x=21.885 στο y≈4.084, νότια παρειά y=3.8877 στο x≈22.015). Ο beam άξονας μπαίνει στην κολόνα στο x≈21.932 → το δυτικό ~47mm+ του δοκαριού πρέπει να **κοπεί** στη λοξή παρειά της κολόνας.
- **MCP:** `firestore_get_document` collections `floorplan_columns`/`floorplan_beams`· `firestore_query` filter `[{field:"floorplanId",operator:"==",value:"file_f6b1782f…"}]` (ΠΡΟΣΟΧΗ `operator` ΟΧΙ `op`). ⚠️ Η query με `floorId` γύρισε 0 (πιθανό index)· χρησιμοποίησε `floorplanId`.

---

## 4. PERSISTENCE (κρίσιμο για το «DERIVED»)

Beam **ΚΑΙ** column geometry είναι **recomputed on-load** (`useBeamPersistence.docToEntity`: `doc.geometry ?? computeBeamGeometry(doc.params)`· ίδιο για columns — γι' αυτό η `col_fb3215e9` δεν είχε `geometry` στο Firestore). Ο serializer σκόπιμα παραλείπει geometry (`Re-derivable fields omitted`). → **Το trimmed outline ΔΕΝ persist-άρεται ΠΟΤΕ** — πάντα derived client-side από persisted `params` + live column footprints. Re-derive όταν αλλάζει κολόνα (scene reconcile).

---

## 5. UNCOMMITTED STATE (τι ΜΗΝ ξανακάνεις / τι είναι δικό μου)

**✅ ADR-449 Slice 12 (finish height-SSoT, 3Δ) = ΗΔΗ COMMITTED** (commits `ea548f7e` + `fc7430e5` — άλλος agent με `git add -A`, ΟΧΙ Giorgio· ο γνωστός shared-tree pattern). Περιλαμβάνει: `resolveColumnVerticalExtentMm`, `buildColumnVerticalExtents`, finish scene adapters columnExtents (3Δ), tests. **Part A (2Δ) ΔΕΝ μπήκε → είναι η εκκρεμότητα.**

**🔴 ADR-451 Slice 4 (storey height ribbon + column «Ύψος» read-only) = UNCOMMITTED, ΔΙΚΟ ΜΟΥ** (15 jest GREEN). `git add` ΜΟΝΟ:
```
NEW src/subapps/dxf-viewer/ui/ribbon/hooks/bridge/storey-command-keys.ts
NEW src/subapps/dxf-viewer/ui/ribbon/hooks/bridge/storey-height-bridge.ts
NEW src/subapps/dxf-viewer/ui/ribbon/hooks/bridge/column-height-display.ts
NEW src/subapps/dxf-viewer/ui/ribbon/hooks/bridge/__tests__/storey-height-bridge.test.ts
NEW src/subapps/dxf-viewer/ui/ribbon/hooks/bridge/__tests__/column-height-display.test.ts
MOD src/subapps/dxf-viewer/ui/ribbon/hooks/bridge/column-bridge-combobox-resolvers.ts
MOD src/subapps/dxf-viewer/ui/ribbon/hooks/useRibbonCommands.ts
MOD src/subapps/dxf-viewer/ui/ribbon/data/contextual-column-tab.ts
MOD src/i18n/locales/el/dxf-viewer-shell.json + en/dxf-viewer-shell.json
MOD docs/centralized-systems/reference/adrs/ADR-451-building-vertical-setup-floor-ssot.md
MOD local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt
```
🔴 Εκκρεμεί: browser-verify (storey-ceiling κολόνα→«Ύψος» greyed=3000· «Ύψος Ορόφου»→3300→όλο το πλαίσιο τεντώνεται) + commit (Giorgio).

**⚠️ ΞΕΝΑ uncommitted bundles (ΜΗΝ τα αγγίξεις, άλλος agent ADR-456 dynamic reinforcement):** `bim/structural/codes/{eurocode-provider,greek-legacy-provider,structural-code-types,suggest-reinforcement}.ts`, `bim/structural/__tests__/structural-quantities.test.ts`, `HANDOFFS/HANDOFF_2026-06-15_ADR-456_*`. ⚠️ Τα `contextual-column-tab.ts`/`column-bridge-combobox-resolvers.ts`/`useRibbonCommands.ts` είναι **MIXED** (δικές μου ADR-451 γραμμές + πιθανόν ADR-456) → stage ΜΟΝΟ τις δικές σου γραμμές.

---

## 6. ΠΡΩΤΟ ΒΗΜΑ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ
1. **Recognition (Firestore-first §3):** re-fetch κολόνα+δοκάρι (επιβεβαίωσε ότι ισχύει η σκηνή· ο Giorgio ίσως άλλαξε κάτι). Confirm repro: δοκάρι μπαίνει στην κολόνα.
2. **Part A** (2Δ σοβάς fix) — γρήγορο, κλείνει το Issue #2 + ολοκληρώνει το Slice 12 στο 2Δ. jest + ADR-449 changelog.
3. **Part B** (ADR-458 cutback) — B1 pure (+jest) → B2 3Δ → B3 BOQ → B4 2Δ. Νέο ADR-458 + adr-index + ΕΚΚΡΕΜΟΤΗΤΕΣ + MEMORY.
4. **Browser-verify** ανά part (Giorgio). **tsc+commit = Giorgio.** `git add` ΜΟΝΟ δικά σου.

**MEMORY topics (διάβασε):** `project_adr449_structural_finish_skin` (Slice 12) · `project_adr451_building_vertical_setup` (Slice 4) · `reference_2d_dxf_pipeline_bim_entity` · `feedback_make_revit_grade_decisions_yourself` · `feedback_confirm_repro_before_reimplementing`.

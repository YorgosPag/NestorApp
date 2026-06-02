# ADR-406 — Point-Based MEP Fixture (Light Fixture) — Vertical Slice (Step 3)

| Field | Value |
|---|---|
| Status | ✅ **DONE** — πρώτο MEP στοιχείο end-to-end (2026-06-02, Opus 4.8). Σημειακό φωτιστικό οροφής (discipline `electrical`): placement tool (2D + 3D) → 2D render (family symbol) + 3D solid → discipline visibility (ADR-405) → persist (Firestore + enterprise-id). 43/43 νέα tests PASS, tsc clean. 🔴 Εκκρεμεί browser verify + commit (Giorgio) |
| Date | 2026-06-02 |
| Owner | Giorgio / Claude (Opus 4.8) |
| Related | ADR-405 (discipline taxonomy & MEP foundation — **θεμέλιο, Step 3 εδώ**), ADR-403 (3D BIM placement — **πρότυπο 3D placement**), ADR-363 (BIM drawing mode — **πρότυπο entity pipeline**), ADR-382 (visibility resolver — **reuse**), ADR-375/377 (object styles), ADR-040 (canvas perf — micro-leaf renderer) |

---

## Context

Το ADR-405 έστησε τη **Discipline** ως πρώτης τάξης διάσταση (Revit/ArchiCAD/IFC «Discipline»)
και τη γέφυρα entity→discipline + 5η visibility source. Το ADR-405 §Step 3 ζητά **το πρώτο
MEP στοιχείο** ως **vertical slice** που αποδεικνύει την αρχιτεκτονική end-to-end πριν χτιστούν
routing/systems (Steps 4-5).

**Επιλογή (Giorgio 2026-06-02):** **φωτιστικό οροφής** (`electrical`), **point-based** —
η μικρότερη σταθερή μονάδα (όπως Revit/ArchiCAD ξεκινούν με family placement).

### Πώς το λύνουν οι μεγάλοι (industry convergence)

| Παίκτης | Μηχανισμός |
|---|---|
| **Revit** | Lighting Fixture family, **work-plane / face placement**. Σύμβολο κάτοψης = family 2D representation. |
| **ArchiCAD MEP** | MEP fixture object, σημειακή τοποθέτηση με 2D symbol + 3D model. |
| **IFC** | `IfcLightFixture` (subtype του `IfcFlowTerminal`). |

**Κοινός παρονομαστής:** σημειακό family, **work-plane placement** (όχι routing), 2D σύμβολο +
3D solid, κρεμασμένο από την οροφή σε ύψος τοποθέτησης.

---

## Decision

Νέο **generic point-based MEP entity** (`type: 'mep-fixture'`) με `kind` discriminator
(`'light-fixture'` πρώτο· επεκτείνεται σε `'air-terminal'` κ.λπ. **χωρίς νέο EntityType**).

### Locked αποφάσεις (Giorgio 2026-06-02 — «full enterprise + full SSoT»)

| Θέμα | Απόφαση |
|---|---|
| EntityType | `'mep-fixture'` (generic, render-dispatch key) |
| BimCategory | `'light-fixture'` (granular ανά τύπο → V/G + discipline control) |
| Discipline | `DISCIPLINE_BY_CATEGORY['light-fixture'] = 'electrical'` |
| 2D σύμβολο | παραμετρικό family-symbol (outline + διαγώνιο «X» luminaire), SSoT `mep-fixture-symbol.ts`, μηδέν εξωτερικά assets |
| 3D μορφή | παραμετρικό solid (extrude footprint × `bodyHeightMm`), top face στο `mountingElevationMm` (κρέμεται από οροφή — όπως δοκάρι) |
| Placement | **free-point με ceiling-relative elevation** (2D κάτοψη + 3D raycast στο δάπεδο, μετατροπή σε scene units· OSNAP reuse ADR-403). Host-attach cascade = **deferred** (hook `params.hostId`) |

### SSoT — αρχεία

**NEW (data/geometry):**
- `bim/types/mep-fixture-types.ts` — `MepFixtureKind`/`Shape`/`Params`/`Geometry`/`Entity` + defaults
- `bim/types/mep-fixture.schemas.ts` — Zod (strict)
- `bim/mep-fixtures/mep-fixture-geometry.ts` — `computeMepFixtureGeometry` + `validateMepFixtureParams`
- `bim/mep-fixtures/mep-fixture-symbol.ts` — `buildFixtureSymbol` (2D family symbol SSoT, shared renderer↔ghost)

**NEW (command/audit/persistence):**
- `core/commands/entity-commands/UpdateMepFixtureParamsCommand.ts`
- `bim/mep-fixtures/mep-fixture-audit-client.ts` — `recordMepFixtureChange` (ADR-195)
- `bim/mep-fixtures/mep-fixture-firestore-service.ts` — `setDoc` + `generateMepFixtureId` (N.6)
- `hooks/data/useMepFixturePersistence.ts` + `app/MepFixturePersistenceHost.tsx`
- `services/factories/mep-fixture.factory.ts` — `createMepFixture`

**NEW (tool 2D + 3D):**
- `hooks/drawing/useMepFixtureTool.ts` + `hooks/drawing/mep-fixture-completion.ts`
- `bim/mep-fixtures/add-mep-fixture-to-scene.ts` (wrapper over `appendEntityToScene` SSoT)
- `ui/ribbon/hooks/bridge/mep-fixture-tool-bridge-store.ts`
- `bim-3d/placement/use-bim3d-mep-fixture-placement.ts` + `MepFixturePlacementGhost.ts`

**NEW (render):**
- `bim/renderers/MepFixtureRenderer.ts` (ADR-040 micro-leaf, registered στο `EntityRendererComposite`)
- `fixtureToMesh()` στο `bim-3d/converters/BimToThreeConverter.ts`

**MODIFIED (registrations / taxonomy):**
- `types/base-entity.ts` (`EntityType`), `bim/types/bim-base.ts` (`BimElementType`),
  `types/entities.ts` (`Entity` union + `isMepFixtureEntity`)
- `config/bim-object-styles.ts` (`BimCategory`/arrays/`DEFAULT_OBJECT_STYLES` += `light-fixture`)
- `bim/discipline/bim-discipline.ts` (`DISCIPLINE_BY_CATEGORY['light-fixture']='electrical'`)
- `services/enterprise-id-{prefixes,class,convenience}.ts` + facade (`MEP_FIXTURE: 'mepfix'`)
- `config/firestore-collections.ts` (`FLOORPLAN_MEP_FIXTURES`)
- `config/audit-tracked-fields.ts` (`MEP_FIXTURE_TRACKED_FIELDS` + dispatch)
- `bim/types/ifc-entity-mixin.ts` (`IfcLightFixture`)
- `systems/events/EventBus.ts` (`bim:place-mep-fixture-3d`, `bim:mep-fixture-{params-updated,delete-requested}`, restore union += `mep-fixture`)
- `ui/toolbar/types.ts` (`ToolType`) + `systems/tools/tool-definitions.ts`
- `hooks/canvas/{canvas-click-types,useCanvasClickHandler}.ts` + `hooks/tools/useSpecialTools.ts` + `components/dxf-layout/CanvasSection.tsx`
- `bim-3d/{stores/Bim3DEntitiesStore,scene/BimSceneLayer,scene/bim3d-resync,viewport/BimViewport3D}.ts` + `hooks/data/useFloors3DAggregator.ts`
- `bim-3d/materials/MaterialCatalog3D.ts` (`elem-mep-fixture`)
- `core/commands/entity-commands/DeleteEntityCommand.ts` (restore-eligible set)
- `ui/ribbon/{data/home-tab-draw,components/buttons/RibbonButtonIcon}.tsx` + i18n el+en

---

## Discipline visibility (reuse ADR-405)

Μηδέν νέος κώδικας ορατότητας: ο 2D renderer + το 3D `resolveEntity` καλούν `resolveIsEntityVisible`
με `category: 'light-fixture'`· το discipline (`electrical`) προκύπτει από `DISCIPLINE_BY_CATEGORY`.
Toggle «Ηλεκτρολογικά» (ADR-405 multi-toggle) κρύβει/δείχνει το φωτιστικό σε 2D **και** 3D.

---

## Consequences

- ✅ Πλήρης vertical slice: η αρχιτεκτονική «προσθήκη point-based MEP entity» αποδείχθηκε end-to-end.
- ✅ Generic `mep-fixture` type → επόμενα MEP families (στόμια/sprinklers/sockets) χωρίς νέο EntityType.
- ✅ Discipline visibility «δωρεάν» (ADR-405).
- ⚠️ **Deferred:** (α) host-attach cascade (φωτιστικό ακολουθεί ceiling/slab) — hook `params.hostId`·
  (β) contextual ribbon tab για επεξεργασία shape/dims εν ώρα placement (το bridge store υπάρχει)·
  (γ) ~~2D ghost leaf wiring~~ ✅ DONE v0.5· (δ) Firestore composite
  index για `floorplan_mep_fixtures` (projectId+floorplanId) — αν το pre-commit CHECK 3.15 το ζητήσει.
- ⚠️ Steps 4-5 (MEP routing/systems με connectors) = μελλοντικά ADRs.

---

## Changelog

- **v0.1 (2026-06-02, Opus 4.8):** Αρχική υλοποίηση — full vertical slice (φωτιστικό οροφής).
  43/43 tests PASS, tsc clean. Pending browser verify + commit.
- **v0.2 (2026-06-02, Opus 4.8) — 🐛 canvas-invisible fix:** Το φωτιστικό committed-άριζε (audit
  POST πυροδοτούνταν) αλλά **δεν εμφανιζόταν στον 2D καμβά**. Δύο root causes, και τα δύο 1:1 mirror
  της κολώνας:
  - **BUG #1 (audit 400):** `'mep-fixture'` έλειπε από το server-side `VALID_ENTITY_TYPES` του
    `POST /api/audit-trail/record` → 400 «Invalid entityType». Fix: +`'mep-fixture'` στο record route
    set + στον τύπο `AuditEntityType`. (Το column κάνει POST μόνο στο `record`· τα `global`/`[entityType]`
    routes δεν περιέχουν κανένα BIM type — δεν τα αγγίξαμε, code=source-of-truth.) Fire-and-forget,
    δεν ήταν η αιτία του «αόρατο».
  - **BUG #2 (το κύριο — render drop):** ο scene→DXF converter `convertEntity` (`useDxfSceneConversion.ts`)
    δεν είχε `case 'mep-fixture'` → το entity έπεφτε στο `default` → dropped (`return null`) → ποτέ δεν
    έφτανε στον canvas-v2 `DxfRenderer`. Ίδιο pattern με το παλιό column bug. Το 3D δούλευε γιατί
    διαβάζει params απευθείας. Fix (όλα mirror column): NEW `DxfMepFixture` type + entry στο
    `DxfEntityUnion`/`DxfEntity.type` (`dxf-types.ts`)· `case 'mep-fixture'` στο `convertEntity`
    (`useDxfSceneConversion.ts`) + στο `buildEntityModelFromDxf` (`dxf-renderer-entity-model.ts`).
  - **Completeness (hit-test/selection/marquee/zoom):** +`'mep-fixture'` στα BIM-bbox cases των
    `rendering/hitTesting/Bounds.ts`, `types/entity-bounds.ts`, `bim/utils/bim-bounds.ts`, και NEW
    `case 'mep-fixture'` με geometry-recompute fallback στο `HitTestingService.convertToEntityModel`.
  - NEW regression test `useDxfSceneConversion-mep-fixture.test.ts` (2 tests — fixture επιβιώνει του
    `convertSceneToDxf`). Σύνολο 45/45 MEP-related PASS, tsc clean. 🔴 pending browser verify + commit.
- **v0.3 (2026-06-02, Opus 4.8) — 🐛 delete + 3D-placement fixes:**
  - **BUG #3 (δεν διαγράφονται):** το φωτιστικό επιλεγόταν αλλά επανεμφανιζόταν. Root cause: ο
    `useSmartDelete` emit-άρει per-type Firestore-delete events (wall/slab/column/beam/stair/opening/
    slab-opening) αλλά **έλειπε το mep-fixture** → η `DeleteEntityCommand` το έβγαζε από το scene, αλλά
    το Firestore doc έμενε και το `subscribeFixtures` το **ξανα-πρόσθετε** (δεν μπήκε στο `deletedIdsRef`).
    Fix (mirror column/stair): συλλογή `fixtureIdsInBatch` + emit `bim:mep-fixture-delete-requested`
    (το `useMepFixturePersistence` το ακούει ήδη → deleteFixture: Firestore + scene + audit + dedupe-guard).
  - **BUG #4 (3D placement μακριά από κέρσορα):** σε γωνιακή 3D προβολή το φωτιστικό εμφανιζόταν «πολύ
    μακριά» από τον κέρσορα. Root cause: το raycast γινόταν στο **επίπεδο πατώματος** αλλά το
    `fixtureToMesh` το ανεβάζει `mountingElevationMm` (~2.7m) στην οροφή → parallax offset (η κολώνα
    δεν το έδειχνε γιατί κάθεται στο πάτωμα). SSoT fix (Revit work-plane placement): το `raycastFloorPoint`
    κατευθύνεται πλέον στο **work-plane της mounting elevation** (`floorElev + mountingElevationMm`,
    διαβασμένο από το bridge store override ή `DEFAULT_FIXTURE_MOUNTING_ELEVATION_MM`)· η ΙΔΙΑ elevation
    τροφοδοτεί raycast (work-plane) + `fixtureToMesh` (FFL+mounting) → ghost==κέρσορας (WYSIWYG). Το
    `ghost.update` εξακολουθεί να δέχεται το FLOOR elevation (το `fixtureToMesh` ξανα-προσθέτει το mounting).
  - NEW regression test `use-bim3d-mep-fixture-placement.test.ts` (5 — incl. assertion ότι το raycast
    plane = mounting elevation). 50/50 MEP PASS, tsc 0. 🔴 pending browser verify + commit.
- **v0.4 (2026-06-02, Opus 4.8) — 🐛 BUG #5 placement cursor «χεράκι» αντί «σταυρουδάκι»:** στο 3D
  placement εμφανιζόταν το orbit-grab «χεράκι» αντί για crosshair → δύσκολη ακριβής τοποθέτηση. Root
  cause = **δύο ανεξάρτητα προβλήματα**:
  (α) **λάθος element:** τα hooks έγραφαν `canvasEl.style.cursor`, αλλά ο εμφανιζόμενος cursor ανήκει
  στο **`role="application"` overlay div** (`BimViewport3D`) που κρατά το Tailwind `cursor-grab` — ο
  renderer `<canvas>` ζει μέσα του (Three.js επαναφέρει το δικό του style), οπότε το crosshair στον
  canvas δεν φαινόταν. Fix: τα hooks στοχεύουν πλέον το overlay (`canvasEl.closest('[role="application"]')`)
  — inline style νικά πάντα το class στο ΙΔΙΟ element.
  (β) **παραβίαση SSoT (race):** ΚΑΙ τα δύο placement hooks (column ADR-403 + fixture) έγραφαν στο ίδιο
  element· σε αλλαγή εργαλείου το `teardown()` του ανενεργού hook μηδένιζε τον cursor που μόλις έβαλε το
  ενεργό (order-dependent — το ένα εργαλείο πάντα έχανε). Fix: NEW `bim-3d/placement/placement-cursor.ts`
  = ref-counted owner ανά element (crosshair όσο ≥1 placement ενεργό, clear ακριβώς μία φορά στο τελευταίο
  release, **order-independent**)· και τα δύο hooks → `acquire/releasePlacementCursor` με balanced
  `wasActive` guard. NEW test `placement-cursor.test.ts` (6, incl. και τις δύο σειρές hand-off). Διορθώνει
  ΚΑΙ την κολώνα. 56/56 PASS, tsc 0. 🔴 pending browser verify + commit.
- **v0.5 (2026-06-02, Opus 4.8) — ✨ 2D placement ghost (ήταν DEFERRED):** στο 2Δ η κολώνα έδειχνε ghost
  preview κατά την τοποθέτηση, το φωτιστικό όχι (το `getGhostFootprint` API υπήρχε στο tool αλλά δεν ήταν
  wired σε leaf). Υλοποιήθηκε mirror του column 2D ghost (ADR-040 micro-leaf, zero CanvasSection re-render):
  NEW `bim/mep-fixtures/MepFixtureGhostRenderer.ts` (footprint fill+outline+anchor marker, amber palette =
  MepFixtureRenderer)· NEW `hooks/tools/useMepFixtureGhostPreview.ts` (RAF, `useCursorWorldPosition` +
  OSNAP-aware effective cursor = WYSIWYG με commit)· NEW micro-leaf `canvas-layer-stack-mep-fixture-ghost.tsx`.
  Wiring (4 layers, mirror columnGhost): `canvas-layer-stack-types.ts` (`mepFixtureGhostPreview` payload)
  → `CanvasSection` (`mepFixtureTool.getGhostFootprint`) → `CanvasLayerStack` → `PreviewCanvasMounts`. NEW
  test `MepFixtureGhostRenderer.test.ts` (2). 58/58 PASS, tsc 0. 🔴 pending browser verify + commit.

- **v0.6 (2026-06-02, Opus 4.8) — ✨ 2D parametric grips (move + rotation + 4-corner resize):** επιλεγμένο
  φωτιστικό δείχνει πλέον στην κάτοψη **4 γωνιακές λαβές + σημάδι περιστροφής + σημάδι μετακίνησης** (αίτημα
  Giorgio). Επαναχρησιμοποιεί ΠΛΗΡΩΣ το column parametric-grip μοτίβο (ADR-397) — zero νέα υποδομή:
  `UpdateMepFixtureParamsCommand` (ήδη υπήρχε, merge→single-undo), grip render leaf + glyph registry, ADR-040
  micro-leaf. **Συμπεριφορά:** κάθε γωνιακή λαβή κάνει **resize σε δύο διευθύνσεις** με τη **διαγώνια απέναντι
  γωνία πακτωμένη** (anchor)· `width`/`length` μεγαλώνουν προς τη συρόμενη γωνία και το `position` re-centre-άρει
  στο νέο κέντρο· clamp στο `MIN_FIXTURE_DIMENSION_MM` (20mm)· σέβεται το `rotation`. **ORTHO (F8)** περιορίζει
  το corner-drag στον κυρίαρχο τοπικό άξονα (καθαρό width Ή length) — διαβάζεται από το non-React
  `cadToggleState.isOrthoOn()` (ίδια πηγή με το BIM drawing commit path). Σημάδι περιστροφής = swept-angle γύρω
  από το κέντρο (mirror `wall-rotation`)· σημάδι μετακίνησης = translate `position`. Circular kind (μη-ζωντανό):
  ελάχιστο fallback κέντρο + διάμετρος. **Files:** NEW `bim/mep-fixtures/mep-fixture-grips.ts` (pure SSoT:
  `getMepFixtureGrips` + `applyMepFixtureGripDrag`) + NEW `__tests__/mep-fixture-grips.test.ts` (10)· core grip
  system (κοινό): `grip-types.ts` (+`MepFixtureGripKind` + `mepFixtureGripKind` σε GripInfo/UnifiedGripInfo),
  `useGripMovement.ts` (re-export), `grip-computation.ts` (case + DxfGripDragPreview field), `grip-glyph-registry.ts`
  (move/rotation glyphs), `grip-registry.ts` + `grip-projections.ts` (forward discriminator), `grip-parametric-commits.ts`
  (`commitMepFixtureGripDrag`), `grip-commit-adapters.ts` (dispatch), `apply-entity-preview.ts` (live ghost branch).
  **Δεν** άλλαξαν τα `mep-fixture-types.ts`/`-geometry.ts` (width/length/rotation/position ήδη υπήρχαν). tsc 0.
  🔴 pending browser verify + commit. Deferred: circular full grips, snap-during-resize.

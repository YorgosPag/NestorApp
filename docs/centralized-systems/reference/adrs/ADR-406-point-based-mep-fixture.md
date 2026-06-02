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
  (γ) 2D ghost leaf wiring (το `getGhostFootprint` API υπάρχει στο tool)· (δ) Firestore composite
  index για `floorplan_mep_fixtures` (projectId+floorplanId) — αν το pre-commit CHECK 3.15 το ζητήσει.
- ⚠️ Steps 4-5 (MEP routing/systems με connectors) = μελλοντικά ADRs.

---

## Changelog

- **v0.1 (2026-06-02, Opus 4.8):** Αρχική υλοποίηση — full vertical slice (φωτιστικό οροφής).
  43/43 tests PASS, tsc clean. Pending browser verify + commit.

# 🚰 HANDOFF — ADR-408 Φ14: Floor Drain (Σιφώνι/Στόμιο Δαπέδου Αποχέτευσης)

> **Σύνταξη:** Opus 4.8, 2026-06-07. Session σε Plan Mode — έγινε ΜΟΝΟ research + design, **ΚΑΜΙΑ αλλαγή κώδικα** για το floor drain.
> **Ρόλος επόμενου agent:** agent της ΑΠΟΧΕΤΕΥΣΗΣ (ADR-408 Φ14). ΟΧΙ θέρμανση/ύδρευση (codex agent, ίδιο tree).
> **Πηγή plan:** `~/.claude/plans/typed-conjuring-snowflake.md` (εγκεκριμένο από Giorgio).

---

## ⚠️ ΚΡΙΣΙΜΟΙ ΚΑΝΟΝΕΣ (αμετάβλητοι)
- **SHARED working tree** με codex (heating) → `git add` **ΜΟΝΟ δικά σου** αρχεία, **ΠΟΤΕ** `git add -A`.
- **ΟΧΙ commit / ΟΧΙ push** — ο Giorgio κάνει commit (N.(-1)). Εσύ μόνο προετοιμάζεις + αναφέρεις.
- Απαντάς στα **Ελληνικά**. Quality: **FULL ENTERPRISE + FULL SSOT, Revit-grade** (ρητή εντολή Giorgio «όπως οι μεγάλοι παίχτες, όπως η Revit»).
- N.14: είσαι ήδη Opus + το plan εγκρίθηκε. Μπορείς να προχωρήσεις κατευθείαν σε υλοποίηση (δεν χρειάζεται νέο Plan Mode — το design είναι κλειδωμένο παρακάτω).
- **STAGE ADR-040** (CHECK 6D) όταν αγγίξεις `MepFixtureRenderer.ts`. **ΜΗΝ** αγγίξεις `adr-index.md` (shared).

## ⚠️ ΕΚΚΡΕΜΕΣ ΑΠΟ ΠΡΟΗΓΟΥΜΕΝΗ ΔΟΥΛΕΙΑ (ίδιο tree, uncommitted)
Στο working tree υπάρχει **ΗΔΗ uncommitted** το **STEP 2 = Drainage Fittings V/G** (8 αρχεία: `mep-fitting-types.ts`, `mep-fitting.schemas.ts`, `mep-fitting-resolve.ts`, `MepFittingRenderer.ts`, `sync-mep-elements.ts`, 2 tests, ADR-040). Ο Giorgio θα το commit-άρει. **ΜΗΝ το αναιρέσεις** — είναι δικό μας drainage work, ολοκληρωμένο (46+181 PASS, tsc 0). Δες `HANDOFFS/handoff-drainage-fittings-vg-step2-2026-06-07.md`.

---

## 1) CONTEXT — γιατί γίνεται

Το βασικό σύστημα αποχέτευσης ΟΛΟΚΛΗΡΩΘΗΚΕ: αγωγός `mep-drain-pipe`, φρεάτιο `drainage-collector`, δίκτυο, V/G toggle «Αποχέτευση», auto-fittings V/G. **Επόμενο Revit-grade βήμα = floor drain** (σιφώνι/στόμιο δαπέδου): το τερματικό σημείο όπου το νερό μπαίνει στο δίκτυο αποχέτευσης από το δάπεδο. Revit «Plumbing Fixture», IFC `IfcSanitaryTerminal`.

**Επιθυμητό αποτέλεσμα:** ένα κλικ τοποθετεί σιφώνι (τετράγωνη σχάρα/grating σε κάτοψη, καφέ), που συνδέεται με σωλήνα αποχέτευσης (snap + κανένα spurious cap), κρύβεται με το toggle «Αποχέτευση» (2D+3D), και έχει contextual tab «Ιδιότητες Σιφωνιού».

---

## 2) ΑΡΧΙΤΕΚΤΟΝΙΚΗ ΑΠΟΦΑΣΗ (ΚΛΕΙΔΩΜΕΝΗ — μετά exploration 4 agents)

**ΟΧΙ νέο entity type** (~69 αρχεία). **ΝΑΙ νέο `kind: 'floor-drain'` του υπάρχοντος `mep-fixture`** (~15-20 αρχεία, κυρίως modifications).

**Γιατί `mep-fixture` (και ΟΧΙ manifold/floorplan-symbol/νέο entity):**
- **Revit-true:** floor drain = Plumbing Fixture → `IfcSanitaryTerminal`. Ανήκει στο `mep-fixture` (γενικό point-based MEP fixture). Το `mep-manifold` = fitting/distributor (λάθος IFC class `IfcPipeFitting`). Το `floorplan-symbol` = ΧΩΡΙΣ connectors (dead-end για δίκτυο).
- Ο `mep-fixture` σχεδιάστηκε **ρητά** για επέκταση: `mep-fixture-types.ts:38-43` «future MEP families append here (air-terminal, sprinkler) **without a new EntityType**».
- **Ίδιο entity type `'mep-fixture'`** ⇒ reuse ΑΥΤΟΜΑΤΟ: collection (`floorplan_mep_fixtures`), enterprise-id (`generateMepFixtureId`), persistence host, firestore service, ΟΛΕΣ οι πύλες καταγραφής (entities union, **dxf-scene-entity-converter** silent-drop, bounds×N, hit-test, 3D sync, selection, grips, audit). **Μηδέν registration churn** — δεν χρειάζεται να αγγίξεις καμία από τις ~47 πύλες που θα ήθελε νέο entity type.
- `collectHostConnectorEndpoints` (`mep-host-connector-endpoints.ts:67`) **ήδη** σκανάρει `isMepFixtureEntity` + φιλτράρει `domain==='pipe'` (γρ.81) → το floor-drain pipe connector γίνεται host endpoint **ΔΩΡΕΑΝ** → host incident → `classifyJunction` kind null → **κανένα spurious cap** (`mep-fitting-classify.ts`).

---

## 3) LOCKED DEFAULTS (αποφασισμένα)
- **1 connector**: `flow:'out'`, `domain:'pipe'`, `systemClassification:'sanitary-drainage'`, Ø50 default. (Το νερό φεύγει από το σιφώνι προς τον σωλήνα — gravity one-way, ΔΕΝ υπάρχει return όπως ο radiator.)
- **Shape** `'rectangular'`, default **150×150mm**, `bodyHeightMm` **100**, `mountingElevationMm` **0** (floor-level, ΟΧΙ ceiling 2700 όπως light-fixture).
- **2D σύμβολο**: τετράγωνο outline + **grid σχάρα** (διπλό grating X+Y), reuse `buildDrainageGratingStrokes` ×2.
- **V/G category**: `'drain-pipe'` (κρύβεται/χρωματίζεται μαζί με όλη την αποχέτευση — καφέ).
- **IFC**: `IfcSanitaryTerminal` (ήδη στο `ifc-entity-mixin.ts` γρ.45/80/139 — **μηδέν αλλαγή mixin**).

---

## 4) IMPLEMENTATION — βήμα-βήμα (~15-20 αρχεία)

### A. Core data model (γενίκευση `mep-fixture` kind-aware)
1. **`bim/types/mep-fixture-types.ts`**
   - `MepFixtureKind` (γρ.43) += `'floor-drain'` (από single literal → union).
   - NEW `MepFixtureIfcType = 'IfcLightFixture' | 'IfcSanitaryTerminal'`· `MepFixtureEntity.ifcType` (γρ.127) literal → `MepFixtureIfcType`.
   - NEW SSoT `resolveFixtureIfcType(kind): MepFixtureIfcType`.
   - NEW SSoT `resolveFixtureBimCategory(params): BimCategory` — **mirror** `resolveSegmentBimCategory` (`mep-segment-types.ts:361`) / `resolveFittingBimCategory` (`mep-fitting-types.ts`, μόλις φτιάχτηκε στο STEP 2): floor-drain → `'drain-pipe'`, αλλιώς `'light-fixture'`. Import `BimCategory` από `../../config/bim-object-styles`.
   - NEW defaults: `DEFAULT_FLOOR_DRAIN_SIZE_MM=150`, `DEFAULT_FLOOR_DRAIN_BODY_HEIGHT_MM=100`, `FLOOR_DRAIN_MOUNTING_ELEVATION_MM=0`, `DEFAULT_FLOOR_DRAIN_CONNECTOR_DIAMETER_MM=50`.
2. **`bim/types/mep-fixture.schemas.ts`**
   - `MepFixtureKindSchema` += `'floor-drain'`.
   - `MepFixtureIfcTypeSchema` (γρ.35): `z.literal('IfcLightFixture')` → `z.enum(['IfcLightFixture','IfcSanitaryTerminal'])`. **ΠΡΟΣΟΧΗ:** χωρίς αυτό η persistence floor-drain ΑΠΟΡΡΙΠΤΕΤΑΙ silently (μάθημα από #5 IfcFlowStorageDevice φρεατίου).
3. **`services/factories/mep-fixture.factory.ts`**: ifcType hardcoded literal → `resolveFixtureIfcType(input.params.kind)`.

### B. Connector + network wiring
4. **`bim/types/mep-connector-types.ts`**: NEW `FLOOR_DRAIN_CONNECTOR_ID = 'fd-drain'` + `buildFloorDrainConnector(localPosition, diameterMm)` → `flow:'out'`, `domain:'pipe'`, `pipe:{ diameterMm, systemClassification:'sanitary-drainage' }`. Mirror `buildRadiatorSupplyConnector` (γρ.333-414 ίδιου αρχείου).
5. **`hooks/drawing/mep-fixture-completion.ts`** (`buildDefaultMepFixtureParams`, γρ.75-109): ΗΔΗ δέχεται `overrides.kind` (γρ.80). Κάν' το kind-aware: floor-drain → `connectors:[buildFloorDrainConnector(...)]` (ΟΧΙ `buildDefaultLightingConnector()` γρ.103) + defaults floor-drain (size/bodyHeight/mountingElevation=0). **Διατήρησε light-fixture path ανέπαφο.**
6. **`bim/mep-systems/mep-host-connector-endpoints.ts`** — **VERIFY only** (αναμένεται μηδέν αλλαγή): fixture ήδη scanned + domain pipe filter. Επιβεβαίωσε ότι floor-drain connector εκτίθεται.
7. **`bim/mep-segments/mep-connector-elevation.ts`** — **VERIFY**: `pointHostMountingElevationMm` αναγνωρίζει fixture; Αν kind-agnostic (fixture-wide), μηδέν αλλαγή· το snapped pipe κληρονομεί `mountingElevationMm=0`. Αν ΟΧΙ, πρόσθεσε fixture/floor-drain branch.

### C. 2D σύμβολο + renderer
8. **`bim/mep-fixtures/mep-fixture-symbol.ts`** (`buildFixtureSymbol`, γρ.44-73): kind-aware. `params.kind==='floor-drain'` → outline + **grid σχάρα**. Reuse `buildDrainageGratingStrokes` από `bim/mep-manifolds/mep-manifold-symbol.ts` (γρ.94-108) **ΔΥΟ φορές** (X-axis + Y-axis με εναλλαγμένα v0/v1/v2/v3) = grid, μηδέν copy-paste. Light-fixture "X" path ανέπαφο.
9. **`bim/renderers/MepFixtureRenderer.ts`** — **STAGE ADR-040 (CHECK 6D)**:
   - category: hardcoded `'light-fixture'` (γρ.59) → `resolveFixtureBimCategory(fixture.params)`.
   - χρώμα: precedence `systemColor ?? resolveSegmentClassificationColor(floor-drain ? 'sanitary-drainage' : undefined) ?? domain default` — **mirror του MepFittingRenderer** που φτιάχτηκε στο STEP 2 (καφέ drainage). Light-fixture χρώμα ανέπαφο.

### D. 3D
10. **`bim-3d/converters/bim-three-point-converters.ts`** (`fixtureToMesh`): kind-aware — floor-drain = λεπτός δίσκος floor-level + grating overlay 3D (reuse `buildDrainageGrating3D` αν υπάρχει στο ίδιο αρχείο, αλλιώς απλό box). Material καφέ.
11. **3D sync** (`BimSceneLayer.ts` fixture loop): category resolution → `resolveFixtureBimCategory` ώστε floor-drain να κρύβεται με «Αποχέτευση» στο 3D (mirror `syncMepSegments`/`syncFittings` που χρησιμοποιούν resolveSegmentBimCategory/resolveFittingBimCategory).

### E. UI (tool / ribbon / contextual / i18n)
12. **`hooks/drawing/useMepFixtureTool.ts`**: προαιρετικό `initialKind` option· bridge publish `kind` (όχι hardcoded `'light-fixture'` γρ.197). Floor-drain instance ξεκινά με kind override (μοτίβο drainage-collector→manifold).
13. **`hooks/tools/useSpecialTools-placement-tools.ts`** + **`useSpecialTools.ts`**: νέο tool `'mep-floor-drain'` που reuse-άρει `useMepFixtureTool({ initialKind:'floor-drain' })`.
14. **`systems/tools/tool-definitions.ts`** + **`ui/toolbar/types.ts`**: `'mep-floor-drain'` tool id/definition.
15. **`hooks/canvas/useCanvasClickHandler.ts`**: routing `activeTool==='mep-floor-drain'`.
16. **`ui/ribbon/data/home-tab-draw.ts`**: 3ο subVariant `'mep-floor-drain'` στο `mepDrainage` submenu (γρ.609-634, δίπλα σε `mep-drain-pipe` + `mep-drainage-collector`).
17. **`ui/ribbon/data/contextual-mep-floor-drain-tab.ts`** (NEW) + bridge: contextual tab «Ιδιότητες Σιφωνιού» (Γεωμετρία width/bodyHeight/mountingElevation + connectorDiameter + Actions). Πρότυπο `contextual-mep-radiator-tab.ts` (non-factory). Trigger registration στο **`app/ribbon-contextual-config.ts`** (γρ.267 περιοχή): fixture με kind floor-drain → floor-drain trigger. + bridge wiring `useDxfBimBridges.ts` + `useDxfViewerRibbon.ts`.
18. **`i18n/locales/el|en/dxf-viewer-shell.json`**: keys `tools.mepFloorDrain.statusPosition`, `ribbon.tabs.mepFloorDrainProperties`, `ribbon.panels.mepFloorDrain*`, `ribbon.commands.bim.mepFloorDrain.{label,tooltip}`, `ribbon.commands.mepFloorDrainEditor.*`. **el+en parity, ΟΧΙ defaultValue (N.11).**

### F. Tests
- NEW `bim/mep-fixtures/__tests__/mep-fixture-floor-drain.test.ts` (ή append σε υπάρχοντα): `resolveFixtureBimCategory` (floor-drain→drain-pipe, light→light-fixture), `resolveFixtureIfcType`, `buildFloorDrainConnector` (flow/domain/classification), `buildDefaultMepFixtureParams({kind:'floor-drain'})` (connector pipe + mountingElevation 0), `buildFixtureSymbol` floor-drain (grid strokes).
- Append schema test (`mep-fixture.schemas.test.ts`): floor-drain kind + IfcSanitaryTerminal round-trip.

---

## 5) CRITICAL SSoT REUSE (import, ΜΗΝ αντιγράψεις)
- `buildDrainageGratingStrokes` — `bim/mep-manifolds/mep-manifold-symbol.ts:94-108` (σχάρα ×2 για grid).
- `resolveSegmentClassificationColor` — `bim/mep-systems/mep-system-color.ts:92` (καφέ `#b45309`· ήδη υπάρχει).
- `resolveFixtureBimCategory` = NEW αλλά **mirror** `resolveSegmentBimCategory`/`resolveFittingBimCategory` (ίδια λογική drain-pipe).
- Connector/junction/snap infrastructure — reuse αυτούσια (fixture ήδη host-scanned).
- `buildRadiatorSupplyConnector` — `mep-connector-types.ts:333` (πρότυπο για `buildFloorDrainConnector`).

## 6) ΕΚΤΟΣ scope (flag ΜΟΝΟ → `.claude-rules/pending-ratchet-work.md`, ΟΧΙ fix)
- Γνωστό κενό: `collectHostConnectorEndpoints` σκανάρει ΜΟΝΟ manifold+fixture, ΟΧΙ radiator/boiler → σωλήνας πάνω σε radiator/boiler παράγει spurious cap. **Δεν αφορά floor-drain** (=fixture, ήδη scanned). Απλά flag-άρισέ το.

## 7) ΕΛΕΓΧΟΙ
- `npx tsc --noEmit 2>&1 | rg "mep-fixture|MepFixtureRenderer|floor-drain"` → 0 δικά σου (αγνόησε pre-existing `mesh-to-object3d.ts:124` ADR-411 + τυχόν codex radiator/boiler).
- `npx jest src/subapps/dxf-viewer/bim/mep-fixtures src/subapps/dxf-viewer/bim/types src/subapps/dxf-viewer/bim/mep-systems --silent` → όλα PASS.
- **Browser verify (Giorgio):** ribbon «Αποχέτευση»→«Σιφώνι Δαπέδου»→κλικ· (α) τετράγωνη σχάρα καφέ 2D· (β) drain-pipe καταλήγει στο σιφώνι → snap + κανένα spurious cap· (γ) toggle «Αποχέτευση» κρύβει & το σιφώνι 2D+3D· (δ) contextual tab «Ιδιότητες Σιφωνιού»· (ε) 3D λεπτός δίσκος floor-level με σχάρα.

## 8) TRACKERS @ commit boundary (N.15 — κάνει ο Giorgio με το commit)
ADR-408 changelog (additive) + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` ομάδα Φ14 + memory `project_adr408_phi14_drainage.md`. **ΟΧΙ adr-index.md** (shared tree).

## 9) Σχετικές μνήμες
`project_adr408_phi14_drainage` (master αποχέτευσης), `project_adr408_eyros_b_radiator` (πρότυπο τερματικού entity), `project_adr408_phi12_plumbing_manifold` (kind-aware contextual tab), `project_adr408_mep_connectors_systems` (connectors/network).

---

## 📌 ΠΡΩΤΗ ΕΝΕΡΓΕΙΑ ΕΠΟΜΕΝΟΥ AGENT (νέα session)
1. Διάβασε αυτό το handoff + το plan `~/.claude/plans/typed-conjuring-snowflake.md`.
2. Δεν χρειάζεται νέο Plan Mode (design κλειδωμένο). Υλοποίησε §4 A→F με σειρά (data model → connector → 2D → 3D → UI → tests).
3. Έλεγχοι §7 → ανάφερε (ΟΧΙ commit). Trackers §8 ετοιμάζεις, commit-άρει ο Giorgio.

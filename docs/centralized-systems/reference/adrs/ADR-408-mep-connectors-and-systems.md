# ADR-408 — MEP Connectors & Systems (Connectivity Backbone)

| Field | Value |
|---|---|
| Status | 🟢 **Φ1 + Φ2 + Φ3 DONE** — κορμός + πρώτη «πηγή» (2026-06-02, Opus 4.8). Φ1+Φ2: connector model (embedded) + MepSystem (persisted, geometry-less) + coordinator. **Φ3: ηλεκτρικός πίνακας** = full point-based BIM element (mirror ADR-406 fixture pipeline· IfcElectricDistributionBoard· outgoing power connector· units-safe panelToMesh). ✅ **BROWSER-VERIFIED 2026-06-02** (2D place→3D· persistence/refresh· delete/refresh· 3D place· click-select· ribbon/discipline visibility). Φ4–Φ5 = roadmap. 🔴 Εκκρεμεί commit (Giorgio) |
| Date | 2026-06-02 |
| Owner | Giorgio / Claude (Opus 4.8) |
| Related | ADR-405 (discipline taxonomy & MEP foundation — **θεμέλιο**), ADR-406 (point-based MEP fixture — **πρότυπο pipeline + ο πρώτος connector host**), ADR-401 (wall attach-to-structural — **πρότυπο coordinator: reference-list + warning event, no mutation**), ADR-195 (entity audit), ADR-355/361 (Firestore service SSoT) |

---

## Context

Το ADR-405 έστησε τη **Discipline** ως πρώτης τάξης διάσταση και το ADR-406 το **πρώτο MEP
στοιχείο** (σημειακό φωτιστικό). Το επόμενο επίπεδο της Revit είναι ο **κορμός
συνδεσιμότητας**: typed σημεία σύνδεσης (**Connectors**) + λογικά δίκτυα (**Systems**). Χωρίς
αυτόν, τα MEP στοιχεία είναι «βουβά σύμβολα» — δεν συμμετέχουν σε κύκλωμα/δίκτυο.

**Greenfield**: δεν υπήρχε καμία προηγούμενη έννοια connector/system/circuit/network (zero SSoT
conflict). Αυτό το ADR υλοποιεί **μόνο τον κορμό** (Φ1 + Φ2)· ο ηλεκτρικός πίνακας (Φ3), η
ακεραιότητα cascade (Φ4) και το UI ανάθεσης (Φ5) είναι roadmap.

### Πώς το λύνουν οι μεγάλοι (industry convergence)

| Παίκτης | Connector | System |
|---|---|---|
| **Revit** | Connector ⊂ Family (domain electrical/duct/pipe, flow, system classification) | Electrical Circuit / Duct System / Piping System — first-class, no geometry, source + members |
| **ArchiCAD MEP** | MEP port στο object | Logical MEP system |
| **IFC** | `IfcDistributionPort` | `IfcDistributionSystem` / `IfcDistributionCircuit` |

**Κοινός παρονομαστής:** ο connector ανήκει στο στοιχείο (embedded)· το System είναι λογικό
δίκτυο (χωρίς γεωμετρία) που κατέχει τη λίστα μελών.

---

## Decision

### 1. Connector = embedded sub-object (όχι entity)
Ο `MepConnector` ζει στα `params` του host στοιχείου (`MepConnectorHostParams.connectors`) —
ποτέ standalone entity / Firestore doc / enterprise-id. `connectorId` host-local· παγκόσμια
ταυτότητα = `(entityId, connectorId)`. Παγκόσμια θέση **παράγεται** από `position`+`rotation`
του host (`connectorWorldPosition`, mirror του `transformFootprint`) — καμία persisted γεωμετρία.
Domain electrical πρώτα· duct/pipe reserved.

### 2. MepConnectorHostParams interface
Mixed στα `params` κάθε MEP στοιχείου (additive/optional → zero migration). Το φωτιστικό
(ADR-406) έγινε retrofit· ο πίνακας (Φ3) θα το επεκτείνει ομοιόμορφα.

### 3. MepSystem = first-class persisted doc, χωρίς geometry, εκτός `Entity` union
Collection `floorplan_mep_systems`, enterprise-id `mepsys_*`. Δεν είναι σχήμα στον καμβά →
φορτώνεται σε δικό του store (`MepSystemStore`), όχι στο scene.

### 4. SSoT ownership — το System κατέχει την αλήθεια

| Concept | Owner of truth | Derived/cache |
|---|---|---|
| Connector definition | host `params.connectors` (embedded) | connector world position (από host `position`+`rotation`) |
| Circuit membership | `MepSystem.params.members` (το System doc) | `MepConnector.systemId` back-reference |
| Circuit source | `MepSystem.params.sourceEntityId/sourceConnectorId` | — |
| Reconciliation | **System → connector** (System always wins) | stale `systemId` ανεκτό (όπως dangling `attachTopToIds`) |

Ο `mep-system-coordinator` είναι το ΜΟΝΟ σημείο που reconcile-άρει το cache + τρέχει τα
integrity reverse-lookups + εκπέμπει `bim:mep-system-member-missing` (mirror του
`wall-structural-attach-coordinator`, pattern ADR-401 C: pure detection + signal, no mutation).

---

## Implementation (Φ1 + Φ2)

### Φ1 — Connector model
- **NEW** `bim/types/mep-connector-types.ts` — `MepConnectorDomain`/`MepFlowDirection`/
  `ElectricalSystemClassification`/`MepElectricalConnectorParams`/`MepConnector` +
  `connectorWorldPosition` (pure) + `buildDefaultLightingConnector`.
- **NEW** `bim/types/mep-component-types.ts` — `MepConnectorHostParams`.
- **NEW** `bim/types/mep-connector.schemas.ts` — Zod (reused από fixture + system).
- **Retrofit** `MepFixtureParams extends MepConnectorHostParams` + schema optional `connectors`
  + `buildDefaultMepFixtureParams` δίνει default lighting connector.

### Φ2 — System model + persistence + coordinator
- **NEW** `bim/types/mep-system-types.ts` (`MepSystemEntity`/`Params`/`Member`,
  `buildDefaultCircuitParams`) + `mep-system.schemas.ts`.
- **NEW** `bim/mep-systems/`: `mep-system-firestore-service.ts` (setDoc N.6 + subscribe +
  update/delete, no geometry), `mep-system-audit-client.ts` (ADR-195), `mep-system-coordinator.ts`
  (`buildConnectorSystemIndex`/`reconcileEntityConnectors`/`findSystemsBySource`/
  `findSystemMembershipsByEntity`/`detectMissingSystemMembers`/`notifyMissingSystemMembers`),
  `mep-system-store.ts` (zustand), `connector-access.ts` (`getEntityConnectors`/`isMepConnectorHost`).
- **NEW** `hooks/data/useMepSystemPersistence.ts` (subscribe→store + imperative
  create/update/delete) + `app/MepSystemPersistenceHost.tsx` (mounted στο `DxfViewerTopBar`).
- **Registrations:** enterprise-id `MEP_SYSTEM='mepsys'` (4 αρχεία)· `FLOORPLAN_MEP_SYSTEMS`
  collection· `MEP_SYSTEM_TRACKED_FIELDS` + switch· `AuditEntityType 'mep-system'`· route
  `VALID_ENTITY_TYPES` + `ENTITY_COLLECTION_MAP` (**+ Boy-Scout fix: `mep-fixture` έλειπε από το
  map → fixture audit 400-άριζε σιωπηλά**)· EventBus `bim:mep-system-changed` +
  `bim:mep-system-member-missing`· `firestore.rules floorplan_mep_systems` + coverage-manifest
  (CHECK 3.16)· exhaustive maps σε `propagate-entity-rename`/`incremental-backup`.

**Tests:** 25 νέα (connector world-pos 8, coordinator 12, system schemas 5) PASS· 38/38 fixture
regression PASS· tsc clean.

---

## Implementation (Φ3 — Ηλεκτρικός Πίνακας)

Το πρώτο MEP **«πηγή»** στοιχείο — full point-based BIM element, **mirror 1:1 του ADR-406
fixture pipeline**, με δύο εσκεμμένες διαφορές: (1) ο connector ρέει **out** (`flow:'out'`,
classification `power`) — τροφοδοτεί κύκλωμα· (2) είναι **wall-mounted** (το 3D box κεντράρεται
κατακόρυφα στο `mountingElevationMm`, αντί να κρέμεται από οροφή).

- **NEW types:** `bim/types/electrical-panel-types.ts` (`ElectricalPanelKind='distribution-board'`,
  `ElectricalPanelParams extends MepConnectorHostParams`, geometry cache, `ElectricalPanelEntity`
  με `type:'electrical-panel'` + `ifcType:'IfcElectricDistributionBoard'`) + `.schemas.ts` (Zod).
- **NEW** `bim/types/mep-connector-types.ts` → `buildDefaultPanelOutgoingConnector` (+ `connector-access`).
- **NEW** `bim/electrical-panels/`: `electrical-panel-geometry` (compute+validate), `-symbol`
  (panelboard divider strokes SSoT), `-firestore-service` (setDoc N.6 + subscribe/update/delete),
  `-audit-client` (ADR-195), `add-electrical-panel-to-scene`, `ElectricalPanelGhostRenderer`.
- **NEW** `hooks/drawing/electrical-panel-completion` + `useElectricalPanelTool` (FSM) +
  `ui/ribbon/.../electrical-panel-tool-bridge-store` + `UpdateElectricalPanelParamsCommand` +
  `services/factories/electrical-panel.factory`.
- **NEW 2D:** `bim/renderers/ElectricalPanelRenderer` (ADR-040 leaf) + `useElectricalPanelGhostPreview`
  + `canvas-layer-stack-electrical-panel-ghost` (+ CanvasSection/CanvasLayerStack/leaves wiring).
- **NEW 3D:** `panelToMesh` (BimToThreeConverter — **units-safe `sceneUnitsToMeters` stair pattern**,
  ΟΧΙ buggy fixtureToMesh) + `MaterialCatalog3D 'elem-electrical-panel'` + `BimSceneLayer.syncPanels`
  + `Bim3DEntitiesStore.panels[]` + `use-bim3d-electrical-panel-placement` + `ElectricalPanelPlacementGhost`.
- **NEW persistence:** `hooks/data/useElectricalPanelPersistence` + `app/ElectricalPanelPersistenceHost`
  (mounted στο `DxfViewerTopBar`).
- **Registrations:** EntityType/BimElementType/`Entity`+`isElectricalPanelEntity`· BimCategory
  `'electrical-panel'`→`DISCIPLINE_BY_CATEGORY=electrical` (+object-styles/subcategories)· enterprise-id
  `ELECTRICAL_PANEL='elecpnl'`· `FLOORPLAN_ELECTRICAL_PANELS`· `ELECTRICAL_PANEL_TRACKED_FIELDS`+switch·
  `AuditEntityType`+route `VALID_ENTITY_TYPES`/`ENTITY_COLLECTION_MAP`· EventBus (place-3d/params/delete/restore)·
  ToolType+tool-definitions+useSpecialTools+useCanvasClickHandler· dxf-types `DxfElectricalPanel`+2 converters·
  hit-test bounds ×4· DeleteEntityCommand+restore effect+useSmartDelete· useFloors3DAggregator·
  backup/propagate/dxf-export maps· ribbon (Server icon, shortcut EP)+i18n el/en· firestore.rules+coverage-manifest+indexes.
- **Tests:** geometry/symbol/schemas/completion/panel-mesh (units-safe assertion) PASS.

## Roadmap (Φ4–Φ5, επόμενα push)

- **Φ4** Cascade/integrity — διαγραφή πίνακα→διαλύει τα κυκλώματά του· διαγραφή μέλους→βγαίνει
  από το κύκλωμα· `UpdateMepSystemParamsCommand` (undo/redo)· επέκταση `bim-cascade-resolver`.
- **Φ5** UI ανάθεσης («Δημιουργία ηλεκτρικού κυκλώματος» από selection) + color-by-system +
  scene-time reconciliation wiring (γράφει `connector.systemId` στα fixtures).
- duct/pipe domains & systems — reserved στα types, no pipeline.

---

## Changelog
- **2026-06-02 (Opus 4.8)** — **Φ3 DONE** (ηλεκτρικός πίνακας — η πρώτη circuit «πηγή»). Full
  point-based BIM element mirror του ADR-406 fixture pipeline: ~20 νέα αρχεία + ~40 registration
  touch-points (EntityType→rules→ribbon→3D). `IfcElectricDistributionBoard`, outgoing power
  connector, wall-mounted units-safe `panelToMesh` (stair `sceneUnitsToMeters` pattern). geometry/
  symbol/schemas/completion/panel-mesh tests. ✅ browser-verified (place 2D/3D, persistence/refresh,
  delete/refresh, click-select, ribbon/discipline visibility). Pending commit. Φ4–Φ5 roadmap.
- **2026-06-02 (Opus 4.8)** — Φ1 + Φ2 DONE (αρχιτεκτονικός κορμός). Connector embedded model +
  MepSystem persisted abstraction + coordinator reconciliation + πλήρεις registrations + rules.
  Boy-Scout: διορθώθηκε latent `mep-fixture` ENTITY_COLLECTION_MAP gap. 25 νέα tests, tsc 0.
  Pending commit + browser verify. Φ3–Φ5 roadmap.

# ADR-408 — MEP Connectors & Systems (Connectivity Backbone)

| Field | Value |
|---|---|
| Status | 🟢 **Φ1 + Φ2 + Φ3 + Φ4 DONE** — κορμός + πρώτη «πηγή» + ακεραιότητα δικτύου (2026-06-02, Opus 4.8). Φ1+Φ2: connector model (embedded) + MepSystem (persisted, geometry-less) + coordinator. **Φ3: ηλεκτρικός πίνακας** = full point-based BIM element (mirror ADR-406 fixture pipeline· IfcElectricDistributionBoard· outgoing power connector· units-safe panelToMesh) ✅ **BROWSER-VERIFIED 2026-06-02**. **Φ4: cascade/integrity** — delete πίνακα-πηγής→διαλύει τα κυκλώματά του· delete μέλους→βγαίνει από το κύκλωμα· **coherent single-undo** (CompoundCommand bundle) + 2 SSoT commands (Update/Dissolve) μέσω mutator port. **Φ5 DONE + ✅ BROWSER-VERIFIED + COMMITTED** (Circuit UI + colour-by-system + reconciliation). **Φ6 DONE** (2026-06-02, Opus 4.8): Circuit-Management Panel — rename/colour (κεντρικός ColorDialogTrigger)/add-remove member μέσω έτοιμου `UpdateMepSystemParamsCommand`· panel-centric trigger· 144/144 MEP PASS, tsc 0. **Φ7 DONE** (2026-06-03, Opus 4.8): ορατά καλώδια / home-run wires — παράγωγη γεωμετρία (ΟΧΙ persisted), 2D annotation overlay (ADR-040 micro-leaf) + 3D conduit (units-safe TubeGeometry)· daisy-chain + home-run· routing SSoT `computeCircuitWirePaths` (κοινό 2D+3D)· νέα κατηγορία `mep-wire` + View toggle· 115/115 MEP PASS, tsc 0. 🔴 Εκκρεμεί commit (Giorgio) + browser verify Φ6/Φ7 |
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

## Implementation (Φ4 — Cascade / Integrity)

Κλείδωμα ακεραιότητας του δικτύου **πριν** το UI ανάθεσης (Φ5). Δύο κανόνες «σαν Revit»:
**delete πίνακα-πηγής → διαλύει τα κυκλώματά του**· **delete μέλους → βγαίνει από το κύκλωμα**
(αφαίρεση από `MepSystem.params.members`). Απόφαση Giorgio: **coherent single-undo** (ένα Ctrl+Z
επαναφέρει ΚΑΙ entity ΚΑΙ κυκλώματα) + **full enterprise / full SSoT** (command-based, όχι
side-effects).

- **Detection (pure SSoT)** — **NEW** `resolveMepCascadeOnDelete(deletedIds, systems): MepCascadePlan`
  στον `mep-system-coordinator.ts` (reuse `findSystemsBySource`). Επιστρέφει `{ dissolve[],
  memberRemovals[] }`· system που διαλύεται εξαιρείται από member-edits (δεν πειράζουμε doomed doc).
  Καμία side effect.
- **Mutator port (SSoT bridge)** — **NEW** `bim/mep-systems/mep-system-mutator.ts`
  (`setMepSystemMutator`/`getMepSystemMutator` + `MepSystemMutator` interface). Module-level bridge
  hook↔command (mirror `wall-cascade-delete-store`). Τα commands ΔΕΝ γράφουν Firestore — καλούν τον
  port, που προωθεί στο `useMepSystemPersistence` (sole writer). Null-safe → headless no-op.
- **Commands (undoable, SSoT primitives)** — **NEW** `UpdateMepSystemParamsCommand`
  (member-removal τώρα· rename/assign Φ5· drag-merge) + `DissolveMepSystemCommand` (κρατά πλήρες
  `MepSystemEntity` snapshot· undo = **id-preserving** `restoreSystem` αφού `saveSystem` δέχεται `id`).
  Target = mutator port, ΟΧΙ `ISceneManager` (το System δεν είναι scene entity).
- **Coherent undo (CompoundCommand)** — στο `useSmartDelete` η διαγραφή MEP entity + τα cascade
  commands τυλίγονται σε ΕΝΑ `CompoundCommand('Delete MEP', …)` → ένα atomic undo unit. Τα
  υπάρχοντα `bim:*-delete-requested` emits (Firestore delete panel/fixture) μένουν ανέπαφα·
  `bim:entity-restore-requested` (undo) επαναφέρει το entity, η `CompoundCommand.undo` επαναφέρει τα
  systems — coherent.
- **Persistence** — `useMepSystemPersistence` + `restoreSystem` (id-preserving `saveSystem` + audit
  `'restored'` + un-suppress deletedIds) + register/unregister του mutator port (useEffect).
- **Safety net (belt-and-suspenders)** — το resync-time `notifyMissingSystemMembers` παραμένει για
  τυχόν dangling references εκτός cascade path.
- **Tests:** coordinator cascade-plan (5) + commands/compound integration (10) PASS· `tsc` 0·
  zero νέα Firestore query (καμία αλλαγή rules/indexes/coverage).

## Implementation (Φ5 — Circuit UI + colour-by-system + reconciliation)

Εδώ «καταναλώνεται» ο κορμός: ο χρήστης φτιάχνει κυκλώματα από το UI, τα βλέπει χρωματισμένα (2D+3D),
και το `connector.systemId` cache συγχρονίζεται («System always wins»). Απόφαση Giorgio:
**full enterprise / full SSoT, Revit-grade** → το **System κατέχει το χρώμα του** (persisted, editable).

### Φ5.A — Create-circuit UI από selection
- **Colour SSoT** — `MepSystemParams.color?` (persisted hex· `.strict()` Zod schema + `regex`). **NEW**
  `bim/mep-systems/mep-system-color.ts`: `MEP_SYSTEM_PALETTE` + `pickNextSystemColor` (least-used,
  deterministic) + `buildEntitySystemColorIndex`/`resolveEntitySystemColor` (entityId→colour, source+
  members) + `hexToThreeInt`/`buildEntitySystemColorIntIndex`/`hexToRgba` + reference-memo
  `getEntitySystemColorIndexCached`. Firestore rules valid-άρουν μόνο top-level keys → **zero** αλλαγή
  rules/indexes.
- **Resolution (pure SSoT)** — **NEW** `bim/mep-systems/mep-circuit-from-selection.ts`:
  `resolveCircuitFromSelection(selected, systems)` → source (πίνακας `flow:'out'`) + members (φωτιστικά
  `flow:'in'`) + **reassignRemovals** (Revit single-circuit rule: μέλος ήδη σε κύκλωμα → **μεταφέρεται**,
  βγαίνει από το παλιό). Typed errors (`no-source`/`multiple-sources`/`no-members`).
- **Command (undoable)** — **NEW** `CreateMepSystemCommand` (inverse του `DissolveMepSystemCommand`:
  pre-minted enterprise id· `execute/redo → mutator.createSystem`· `undo → dissolveSystem`).
  `MepSystemMutator += createSystem(entity)`· `useMepSystemPersistence` shared `persistSystemEntity`
  (id-preserving, audit `'created'`/`'restored'`) + `createSystemEntity` + port register.
- **Ribbon UI (clone beam pattern)** — **NEW** contextual tab `contextual-mep-circuit-tab.ts`
  (trigger όταν selection έχει ≥1 πίνακα ΚΑΙ ≥1 φωτιστικό, `ribbon-contextual-config.ts`) +
  `mep-circuit-command-keys.ts` + `useRibbonMepCircuitBridge` (resolve→`CompoundCommand(create +
  reassign UpdateMepSystemParamsCommand)`→`executeCommand`)· wired σε `useDxfBimBridges`/
  `useDxfViewerRibbon`/`useRibbonCommands`. Feedback = EventBus → `useDxfViewerNotifications` toasts
  (decoupled). i18n el+en.

### Φ5.B — Scene-time reconciliation
- **NEW** `hooks/data/useMepConnectorReconciliation.ts`: subscribe `useMepSystemStore` + scene change →
  `buildConnectorSystemIndex` → `reconcileEntityConnectors` ανά fixture/panel → ΕΝΑ `setLevelScene` μόνο
  σε πραγματική αλλαγή (idempotent, referential-stable → κανένα render loop). **Scene-only (όχι
  Firestore)** — derived cache, ξαναχτίζεται από truth σε κάθε load. Mount στο `MepSystemPersistenceHost`.

### Φ5.C — Colour-by-system (2D + 3D)
- **Industry-faithful rule (research-backed):** χρωματίζονται **ΜΟΝΟ τα μέλη/φορτία (φωτιστικά)**· ο
  **πίνακας-πηγή ΔΕΝ** παίρνει χρώμα κυκλώματος (κοινή πηγή πολλών — Revit: το Electrical Equipment δεν
  φέρει Circuit Number/Panel parameter, τα filters το πιάνουν με `Supply From`). SSoT:
  `buildEntitySystemColorIndex` χαρτογραφεί **μόνο** `members[].entityId` (ΟΧΙ `sourceEntityId`).
- **2D (ADR-040 micro-leaf)** — `MepFixtureRenderer`: μετά το visibility guard, read
  `useMepSystemStore.getState()` (zero-subscription), override stroke/fill με το χρώμα του system
  (`getEntitySystemColorIndexCached` + `hexToRgba`)· unassigned → amber default. `ElectricalPanelRenderer`
  ΔΕΝ χρωματίζεται (μένει equipment teal).
- **3D** — `SyncContext += systemColorIndex` (entityId→THREE int)· `BimSceneLayer.buildContext` το χτίζει
  (`buildEntitySystemColorIntIndex`)· `syncFixtures` το περνά στον `fixtureToMesh += systemColor?` →
  **NEW** `getSystemTintedMaterial3D` (cache per `${type}:${colorInt}`, **ΠΟΤΕ** mutate singleton)·
  `syncPanels`/`panelToMesh` ΔΕΝ χρωματίζονται· `use-bim3d-vg-resync` subscription (d) → resync σε αλλαγή
  systems.
- **Always-on** (assigned vs unassigned)· toggle «colour by system» = roadmap.
- **Tests:** `mep-circuit-from-selection` (6) + `mep-system-color` (8) + `CreateMepSystemCommand` (3) +
  `useMepConnectorReconciliation` (3) + `MaterialCatalog3D-system-tint` (2)· `tsc` 0· 124/124 MEP
  regression PASS. (25 pre-existing wall-fixture 3D failures = ΟΧΙ regression.)

## Implementation (Φ6 — Circuit-Management Panel)

Διαχείριση **υπάρχοντος** κυκλώματος (Revit "Electrical Circuits" properties) — όλα μέσω του ΕΤΟΙΜΟΥ
undoable `UpdateMepSystemParamsCommand` (καμία νέα command/mutator/rules αλλαγή). UI = επέκταση του Φ5
contextual ribbon tab (απόφαση Giorgio), **panel-centric** (Revit-faithful: το φωτιστικό κρατά το δικό
του fixture tab· το κύκλωμα διαχειρίζεται από τον πίνακα/system browser).

- **Active managed circuit (SSoT):** NEW `mep-circuit-editor-store.ts` (zustand `activeSystemId`) — γνήσια
  ephemeral UI state (δεν παράγεται όταν ένας πίνακας τροφοδοτεί >1 κύκλωμα → ο χρήστης διαλέγει).
  NEW `useMepCircuitEditorSync` (always-on, mount στο `MepSystemPersistenceHost`): από το primary selection
  → `resolveManagedCircuits` → reconcile `activeSystemId` (κρατά έγκυρη επιλογή, αλλιώς πρώτος candidate).
- **Pure SSoT:** NEW `mep-circuit-editor.ts` — `resolveManagedCircuits` (member-of ∪ source-of, reuse
  `findSystemMembershipsByEntity` + `findSystemsBySource`)· `buildAddMembersUpdate` (union + Revit reassign)
  · `buildRemoveMembersUpdate` (idempotent). **Boy-scout:** το `computeReassignRemovals` εξήχθη στον
  `mep-system-coordinator` (SSoT) και το `mep-circuit-from-selection` το κάνει reuse (dedupe).
- **UI:** 3 leaf widgets (ADR-040) — `RibbonMepCircuitPickerWidget` (1 candidate → read-only label· >1 →
  dropdown → `setActiveSystemId`)· `RibbonMepCircuitNameWidget` (rename, debounced `isDragging` merge σε 1
  undo, blur/Enter flush, ESC revert· μοτίβο `RibbonWallDimensionWidget`)· `RibbonMepCircuitColorWidget`
  (**κεντρικός** `ColorDialogTrigger`/`EnterpriseColorDialog` hex in/out, ίδιος picker με opening-tag/grid).
  Νέο panel `mep-circuit-properties` στο tab + actions `addMembers`/`removeMembers` (bridge handlers,
  selection-driven, CompoundCommand update+reassign). EventBus `bim:mep-circuit-members-added/-removed/
  -edit-failed` → toasts.
- **Trigger:** `useActiveContextualTrigger` subscribe `useMepSystemStore`· surfaces το tab όταν primary =
  electrical-panel που τροφοδοτεί ≥1 κύκλωμα (πέρα από το Φ5 create-case πίνακας+φωτιστικά). Colour edit →
  αυτόματο resync (2D leaf store-read· 3D `use-bim3d-vg-resync`), μηδέν νέο render code.
- **SSoT διατηρείται:** System κατέχει `members[]`+`color`· πίνακας-πηγή ΔΕΝ χρωματίζεται· colour resolver =
  ένα SSoT· connector cache διορθώνεται από το Φ5 reconciliation.
- **Tests:** `mep-circuit-editor` (15) + `mep-circuit-editor-store` (3)· `tsc` 0· 144/144 MEP regression
  PASS. (25 pre-existing wall-fixture 3D failures = ΟΧΙ regression.)

## Implementation (Φ7 — Ορατά καλώδια / Home-Run Wires)

Η **οπτική** αναπαράσταση του κυκλώματος (Revit home-run wiring) — ο χρήστης «βλέπει» ποιο φωτιστικό
τροφοδοτεί ποιος πίνακας. **Παράγωγη γεωμετρία, ΟΧΙ persisted** (το `MepSystem` παραμένει geometry-less):
υπολογίζεται render-time από τα live host transforms, οπότε ακολουθεί move/rotate πίνακα/φωτιστικών δωρεάν.
Scope = 2D annotation + 3D conduit· τοπολογία = **daisy-chain + home-run** (nearest-neighbor, πίνακας πρώτος).

- **Routing SSoT (καρδιά):** NEW `bim/mep-systems/mep-wire-routing.ts` — `computeCircuitWirePaths(systems,
  resolve)` (greedy nearest-neighbor αλυσίδα από τον πίνακα, ντετερμινιστικό tie-break = σειρά members,
  skip off-scene hosts)· `WireHostPoint {x,y (canvas units), zMm (mm above FFL)}` ώστε **ΜΙΑ** υπολογιστική
  διαδρομή να τροφοδοτεί ΚΑΙ το 2D (x/y) ΚΑΙ το 3D (x/y/zMm)· `WireStyle` **per-circuit** (Φ7 follow-up #1:
  και τα τρία `'straight'`/`'orthogonal'`/`'arc'` ship· το `'arc'` = quadratic-Bézier sampled-σε-polyline
  στο `expandSegment`, άρα 2D `lineTo` & 3D `LineCurve3` το παίρνουν ίδιο, μηδέν curve maths στους renderers).
  Το style ζει στο `MepSystemParams.wireStyle` (SSoT), διαχέεται ως `CircuitWirePath.style`, διαβάζεται στο
  `buildWirePolyline(path)` — οι renderers δεν κρατούν default. Χρώμα =
  `systemColor` (το System κατέχει το χρώμα). Pure (no store/React/Date/Math.random).
- **2D micro-leaf (ADR-040):** NEW `components/dxf-layout/HomeRunWiresOverlay.tsx` (clone `EnvelopeOverlay`) +
  NEW pure `bim/renderers/MepWireRenderer.ts` (`drawCircuitWires`: polyline σε system colour + **home-run
  arrowhead** στον πίνακα). Leaf subscriptions ΜΟΝΟ εδώ (`useMepSystemStore` + objectStyles slice)· ο shell
  `CanvasLayerStack` δεν αποκτά νέο `useSyncExternalStore` (CHECK 6C safe)· mount inline (όπως EnvelopeOverlay).
- **3D conduit (units-safe):** NEW `bim-3d/converters/mep-wire-to-three.ts` (`wirePathToMesh`: `CurvePath` of
  `LineCurve3` → `TubeGeometry`, **stair/railing pattern** `sceneUnitsToMeters` — ΟΧΙ το buggy fixture path·
  χρώμα = `getSystemTintedMaterial3D('mep-wire', int)` no-singleton-mutation) + `BimSceneLayer.syncWires`
  (μετά το `syncPanels`· resolver από **ορατούς** hosts μόνο → hide φωτιστικού κόβει το leg, hide πίνακα κόβει
  όλο το κύκλωμα) + `MaterialCatalog3D` `elem-mep-wire`. Αυτόματο resync: το Φ5 `use-bim3d-vg-resync`
  (systems + V/G) ξαναχτίζει και τα wires — μηδέν νέα subscription.
- **Visibility (reuse SSoT):** NEW `BimCategory 'mep-wire'` (`bim-object-styles` + `MODEL_BIM_CATEGORIES` →
  το «Μόνο DXF» το κρύβει) + `DISCIPLINE_BY_CATEGORY['mep-wire']='electrical'` (το electrical toggle το κρύβει).
  NEW View-tab toggle `MepWireToggle` (mirror `HideBimToggle`, flips `objectStyles['mep-wire'].visible` μέσω
  του έτοιμου `setObjectStyleVisibility` — κανένας bespoke flag). i18n `ribbon.commands.mepWire.*`.
- **SSoT διατηρείται:** καμία νέα persisted οντότητα/command/rule/index· το χρώμα ανήκει στο System·
  ο πίνακας-πηγή ΔΕΝ χρωματίζεται (μόνο τα καλώδια+μέλη).
- **Tests:** `mep-wire-routing` (15) + `mep-wire-to-three` (5, units-safe mm/m parity)· `tsc` 0· 115/115 MEP
  PASS. (25 pre-existing wall-fixture 3D failures = ΟΧΙ regression.)

## Roadmap (επόμενο push)

- ✅ «colour by system» view toggle **DONE** (2026-06-03)· ✅ per-circuit edit από φωτιστικό **DONE** (2026-06-03)· ✅ seed legacy connectors **DONE** (2026-06-03) — **ο κορμός ADR-408 «MEP σαν Revit» (electrical) πλήρης.**
- Φ7 follow-ups: ✅ `orthogonal`/`arc` wire styles **DONE** (#1, 2026-06-03)· ✅ waypoints **DONE** (#3,
  2026-06-03)· ✅ conductor-count ticks **DONE** (2026-06-03)· ✅ colour-by-system toggle **DONE** (2026-06-03)· ✅ per-circuit edit από φωτιστικό **DONE** (2026-06-03)· ✅ seed legacy connectors **DONE** (2026-06-03).
- ✅ duct/pipe **element pipeline** (Φ8) **DONE** (2026-06-03) — ΕΝΑ ενοποιημένο `mep-segment` entity (domain `duct|pipe` + sectionKind `rectangular|round`), placement/γεωμετρία/2D/3D/persistence/BOQ/grips, mirror του δοκαριού. **❌ υπόλοιπο:** duct/pipe **systems** (grouping segments σε δίκτυα + routing — αντίστοιχο των Φ2/Φ7 electrical· επόμενο frontier)· contextual props tab (edit size/elevation)· 3D 2-click placement· connectors στο segment (forward hook, empty).

---

## Changelog
- **2026-06-04 (Opus 4.8, Plan Mode — εγκεκριμένο)** — **Φ-A — PER-ENDPOINT Z FOUNDATION (πραγματική 3D σύνδεση «σαν Revit», στρώμα 1/4) DONE** (pending commit, 🔴 browser verify). Θεμέλιο για συνεχές 3D δίκτυο συλλέκτης→σωλήνας→μούφα→σωλήνας (το screenshot έδειχνε σκόρπια στοιχεία σε διαφορετικά ύψη: συλλέκτης floor-mounted 400mm vs σωλήνας default 2800mm, snap μόνο σε κάτοψη, junctions επίπεδα, σωλήνες αυστηρά οριζόντιοι). **Απόφαση Giorgio: «σαν Revit, FULL ENTERPRISE + FULL SSOT, τέλειο».** **Αρχιτεκτονική:** τα `startPoint.z`/`endPoint.z` (mm) γίνονται η **αυθεντική** στάθμη κάθε άκρου — ο σωλήνας μπορεί να **ανεβαίνει/κλίνει** (riser/sloped, αληθινό 3D τμήμα μεταξύ 2 σημείων). Το `centerlineElevationMm` → **derived/back-compat** (= midpoint). **SSoT resolver `resolveSegmentEndpointElevationsMm(params)`** (+`deriveCenterlineElevationMm`/`isSegmentInclined`): self-healing migration **χωρίς destructive Firestore migration** — «both ends z=0 ⇒ ανέβα στο centreline» (legacy/οριζόντιο default) αλλιώς «κάθε z με fallback centreline»· **idempotent & ασφαλές** (νέο doc με δύο μηδενικά z έχει πάντα centreline=0 ⇒ no-op· ένας riser με start στο δάπεδο z=0/end≠0 ΔΕΝ διαβρώνεται). **Consumers (όλοι μέσω resolver):** `mep-segment-geometry` (bbox z-range = span(start,end)±h/2)· `mep-segment-connectors` (κάθε connector z = το **δικό του** άκρο, όχι κοινό centreline)· `mep-segment-to-mesh` (**η ουσία:** swept solid μεταξύ 2 αληθινών 3D σημείων — cylinder/extrude κατά 3D άξονα + stable horizontal-width basis για near-vertical risers + trim κατά 3D άξονα)· `mep-pipe-junctions` (incident/junction elevation από per-endpoint z· z-matching παραμένει planar — 3D matching = Φ-B)· `mep-segment-completion` (νέο segment `start.z=end.z=centerlineElevationMm` authoritative). **UI:** segment tab — «Ύψος άξονα» ανεβάζει **και τα δύο** άκρα (whole-run lift) + **2 νέα πεδία «Υψόμετρο αρχής»/«Υψόμετρο τέλους»** (per-endpoint riser/slope, Revit-style) με derived centreline sync (`buildElevationParams`)· keys/tab/bridge + i18n `mepSegmentEditor.startElevation/endElevation` el+en. **Tests:** NEW `mep-segment-elevation.test.ts` (resolver migration cases/derive/inclined) + riser cases σε connectors/geometry/junctions/bridge — **81/81 affected PASS** (18 νέα). tsc 0 δικά μου. ΕΚΤΟΣ ADR-040 (`mep-segment-to-mesh` ζει στο `bim-3d/converters/` — εκτός CHECK 6B/6D pattern). ⚠️ SHARED tree (ADR-415 floorplan-symbol agent· git add ΜΟΝΟ δικά μου· **ΜΗΝ adr-index**)· τα contextual tabs της προηγ. συνεδρίας μένουν uncommitted (Giorgio τα κάνει commit). **❌ ΕΠΟΜΕΝΑ:** Φ-B (connector-mate snap inherit xyz + 3D junctions + γενίκευση `MepFittingIncident` `segmentId`→`entityId+connectorId` ώστε ο συλλέκτης/φωτιστικό να γίνονται incidents)· Φ-C (risers/fittings 3D)· Φ-D (polish).
- **2026-06-04 (Opus 4.8, Plan Mode — εγκεκριμένο)** — **CONTEXTUAL PROPERTY TABS «Ιδιότητες Συλλέκτη» (Φ12) + «Ιδιότητες Σωλήνα/Αεραγωγού» (Φ8) DONE** (pending commit, 🔴 browser verify). Οι δύο deferred contextual tabs ώστε ο χρήστης να επεξεργάζεται παραμέτρους **μετά** την τοποθέτηση (πρότυπο 1:1 = «Ιδιότητες Φωτιστικού» ADR-406 v0.7). **FULL ENTERPRISE + FULL SSOT — ΜΗΔΕΝ νέο command** (reuse `UpdateMepManifoldParamsCommand`/`UpdateMepSegmentParamsCommand`). **(A) Συλλέκτης (`mep-manifold`):** panels Geometry (width/length/bodyHeight/mountingElevation) + Έξοδοι (outletCount 1-12/inletDiameter/outletDiameter) + **«Δίκτυο» (fold-in)** + Actions. **Decision Giorgio (AskUserQuestion): fold-in «σαν Revit»** — ο επιλεγμένος συλλέκτης δείχνει ΠΑΝΤΑ «Ιδιότητες Συλλέκτη», με το pipe-network management **folded** ως self-hiding panel (visibilityKey `hasNetwork` → `resolveManagedSystems([manifold]).length>0`), reuse των ίδιων domain-agnostic `mep-circuit-picker/name/color` widgets + `MEP_PIPE_NETWORK_RIBBON_ACTIONS` (καθρέφτης του panel «Κύκλωμα» μέσα στο fixture tab). Ο **manifold→network-tab manage branch** στο `ribbon-contextual-config` **αφαιρέθηκε** (αντικαθίσταται από το fold-in)· ο multi-select **create** branch (manifold+pipes) **μένει**. ⚠️ **Re-seed connectors:** ο `UpdateMepManifoldParamsCommand` δεν ξανακάνει seed connectors → ο bridge ξαναχτίζει `connectors: buildMepManifoldConnectors(nextParams)` (idempotent SSoT) μέσα στο patch ΠΡΙΝ το dispatch, ώστε outlets↔connectors να μένουν σε συγχρονισμό (outletCount clamp [1,12]). **(B) Σωλήνας/Αεραγωγός (`mep-segment`, ΕΝΑ tab duct+pipe):** panels Διατομή (sectionKind — self-hide για pipe, πάντα round) + Διαστάσεις (width+height rect / diameter round, gated) + Γεωμετρία (centerlineElevation) + Actions. `domain` **ΟΧΙ editable** (αλλάζει discipline/IFC/BOQ) — απλώς gate-άρει το section choice. Ο `UpdateMepSegmentParamsCommand` δεν emit-άρει → ο bridge κάνει emit `bim:mep-segment-params-updated` (το `useMepSegmentPersistence` auto-save ακούει το event)· ο manifold auto-save είναι scene-diff (το command emit-άρει ήδη). **6 NEW:** `mep-manifold-command-keys.ts`/`contextual-mep-manifold-tab.ts`/`useRibbonMepManifoldBridge.ts` + `mep-segment-command-keys.ts`/`contextual-mep-segment-tab.ts`/`useRibbonMepSegmentBridge.ts` + 2 test suites (21/21 PASS). **MOD wiring:** `ribbon-contextual-config` (register 2 tabs + 2 `resolveContextualTrigger` cases + αφαίρεση manifold manage branch)· `useRibbonCommands`/`useDxfBimBridges`/`useDxfViewerRibbon` (compose 2 bridges: combobox/state/action/visibility routing)· i18n `mepManifoldEditor.*`/`mepSegmentEditor.*` + tabs/panels el+en parity. ΕΚΤΟΣ ADR-040 (καθαρά ui/bim logic, κανένα canvas-drawing αρχείο). tsc 0 δικά μου. ⚠️ SHARED tree (ADR-415 floorplan-symbol agent· git add ΜΟΝΟ δικά μου· **ΜΗΝ adr-index**). 🟡 follow-ups: manifold grips add/remove outlet· duct (air) systems· Φ14 system browser/sizing.
- **2026-06-04 (Opus 4.8, Plan Mode — εγκεκριμένο)** — **Φ13 — ΔΙΚΤΥΟ ΥΔΡΕΥΣΗΣ ΑΠΟ ΣΥΛΛΕΚΤΗ (Pipe network from manifold) DONE + ✅ BROWSER-VERIFIED** (pending commit· Giorgio: «Δημιουργήθηκε δίκτυο ύδρευσης — σωλήνες: 2. OLA OK»). Η **explicit, «σαν Revit»** διαδρομή: επιλέγεις **συλλέκτη (`mep-manifold`) + σωλήνες (`mep-segment` domain `pipe`)** → δημιουργείται plumbing `MepSystem` (`systemType:'pipe-network'`) με **source = ο συλλέκτης** (outlet connector, flow `out`, fallback `m-out-0`) και **members = οι σωλήνες** (καθρέφτης του ηλεκτρικού circuit-from-selection Φ5.A + management panel Φ6). Συμπληρώνει το `derivePipeNetworks` (Φ10, implicit topology): εδώ η πηγή είναι ρητά ο συλλέκτης, όχι το lex-smallest segment. **FULL ENTERPRISE + FULL SSOT — ΜΗΔΕΝ fork** (απόφαση Giorgio). **Reuse ως έχει:** `CreateMepSystemCommand`/`UpdateMepSystemParamsCommand`/`mep-system-coordinator` (computeReassignRemovals/findSystemsBySource/findSystemMembershipsByEntity/memberKey)/`mep-system-color` (`classificationDefaultColor`/`buildDefaultPipeNetworkParams`)/`useMepConnectorReconciliation`/`mep-circuit-editor-store` (`activeSystemId` κοινό)/`useMepCircuitEditorSync` (κοινό) **και τα widgets picker/name/color** (ήδη system-agnostic — διαβάζουν `activeSystemId`+`UpdateMepSystemParamsCommand`, ΟΧΙ electrical params). **Γενίκευση (1 pure fn, χωρίς fork):** `resolveManagedCircuits` → **`resolveManagedSystems`** (entity-type-agnostic 2-pass: όλα member-of, μετά όλα source-of — **διατηρεί ΑΚΡΙΒΩΣ την electrical σειρά**· καλύπτει electrical [panel/fixture] + plumbing [manifold/pipe] με ΕΝΑ SSoT· members resolve BY id όχι kind). Picker label = systemType-aware (`networkPicker`=«Δίκτυο» για pipe, `circuitPicker`=«Κύκλωμα» για electrical). **5 NEW:** `mep-pipe-network-from-selection.ts` (`resolvePipeNetworkFromSelection` source=manifold+members=pipes· **κάθε σωλήνας=2 endpoint members** seg-start+seg-end, καθρέφτης derive· `buildAddPipeMembersUpdate`· `pipeSegmentMembers`)· `contextual-mep-pipe-network-tab.ts` (reuse widgetIds `mep-circuit-picker/name/color`, ΟΧΙ wireStyle/conductors)· `mep-pipe-network-command-keys.ts`· `useRibbonMepPipeNetworkBridge.ts` (create→`buildDefaultPipeNetworkParams`+`classificationDefaultColor`+reassigns· add/remove· close· toasts αναφέρουν **σωλήνες** distinct-host όχι endpoints)· `__tests__/mep-pipe-network-from-selection.test.ts`. **MOD wiring:** `ribbon-contextual-config` (register tab + 2 triggers: create=manifold+pipe· manage=manifold sources network)· `useRibbonCommands`+`useDxfBimBridges`+`useDxfViewerRibbon` (compose bridge)· `drawing-event-map`+`useDxfViewerNotifications` (5 `bim:mep-network-*` events + pipe toasts)· i18n `mepPipeNetwork.*` el+en (notifications + tab/panels/commands + `mepCircuit.networkPicker`). **Source ΔΕΝ tint-άρεται** (members-only color index — ο συλλέκτης δεν μπαίνει στα members). **Επαλήθευση:** tsc 0 δικά μου· **62/62 MEP pure tests PASS** (νέο pipe-network suite + γενικευμένο editor/coordinator/from-selection regression). ΕΚΤΟΣ ADR-040 (καθαρά bim/ui logic, κανένα canvas-drawing αρχείο). ⚠️ SHARED tree (ADR-415 floorplan-symbol agent· git add ΜΟΝΟ δικά μου· **ΜΗΝ adr-index**). **ΕΚΤΟΣ (επόμενα):** contextual «Ιδιότητες Συλλέκτη»/«Ιδιότητες Σωλήνα» tabs (deferred Φ12/Φ8)· duct (air) systems· Φ14 system browser/sizing.
- **2026-06-04 (Opus 4.8, Plan Mode — εγκεκριμένο + 8 subagents)** — **Φ12 — ΣΥΛΛΕΚΤΗΣ ΥΔΡΕΥΣΗΣ (Plumbing Manifold) DONE** (pending commit, 🔴 browser verify + firebase deploy rules+indexes). Νέο point-based BIM entity «σαν Revit Plumbing Equipment» = η **πηγή διανομής ύδρευσης**, καθρέφτης 1:1 του Ηλεκτρικού Πίνακα (Φ3). EntityType `'mep-manifold'`, kind `'floor-manifold'`, shape rectangular (μπάρα), BimCategory `'mep-manifold'`→**plumbing**, IfcType **`IfcPipeFitting`** (reuse — multi-branch JUNCTION fitting, −1 registration vs νέο type), prefix `'mfld'`, collection `FLOORPLAN_MEP_MANIFOLDS`. **Connectors: 1 inlet (`flow:'in'`, domain pipe, `domestic-cold-water`) στη −X άκρη + N outlets (`flow:'out'`) κατανεμημένοι κατά μήκος της +Y front edge** (default `outletCount=4`, MAX 12)· παράγονται από `buildMepManifoldConnectors(params)` (SSoT scene-unit offsets) — καλείται ΚΑΙ στο completion ΚΑΙ στο `seedDefaultConnectors`. Pipes κουμπώνουν μέσω `MepConnectorSnapEngine` (προστέθηκε `isMepManifoldEntity` στον point-host κλάδο — connectorWorldPosition χειρίζεται ΟΛΑ τα outlets αυτόματα). **floor-mounted**: 3D box κεντράρεται κατακόρυφα στο `mountingElevationMm` default 400· `manifoldToMesh` = **units-safe stair `sceneUnitsToMeters` pattern** (ΟΧΙ buggy fixtureToMesh — mesh test pins 0.4m σε mm==m scene). Grips = reuse `centred-box-grips.ts` SSoT (thin adapter, μηδέν fork — move 3-click/rotate 6-click/4 corners· εγγραφή στις ΙΔΙΕΣ entity-agnostic πύλες με `mepManifoldGripKind`). Manifold = source → **ΔΕΝ tint-άρεται** από color-by-system (members-only index, precedent πίνακα) → μόνο 2D renderer + 3D material `elem-mep-manifold` (cyan 0x0891b2). **~22 NEW files** (`bim/mep-manifolds/*`, `bim/types/mep-manifold-types`+`.schemas`, completion/tool/command/bridge/persistence/host/ghost-hook/ghost-leaf, factory, 3D placement-ghost+hook, 4 test files) **+ ~40 registrations σε 15 κατηγορίες** (entity union+guard+isBimEntity, base-entity/bim-base, BimCategory ×4 + subcategories + discipline, enterprise-id ×4, audit ×3 + MEP_MANIFOLD_TRACKED_FIELDS, eventbus ×4, tool ×5, dxf-types+converters ×3, **bounds/hit-test ×5 — silent-drop μάθημα**, delete/restore/smart-delete, aggregator+Bim3DEntitiesStore(`manifolds`/`setManifolds`)+bim-move-geometry, BimSceneLayer.syncManifolds+MaterialCatalog+bim3d-edit-math, grips ~15 gates, connector-access/seed/snap ×3, ribbon `Συλλέκτης`/Split icon/i18n el+en, firestore rules+indexes ×2+collections+coverage-manifest, EntityRendererComposite, CanvasSection/CanvasLayerStack/leaves ghost threading, DxfViewerTopBar host, BimViewport3D). **Επαλήθευση:** tsc 0 δικά μου (μόνο γνωστό `mesh-to-object3d:124` non-mine)· 39 νέα tests PASS (geometry/connectors/symbol/grips/mesh-units) + 178 MEP regression + 487 grip/ghost/bounds PASS. **Boy-Scout:** `bim-discipline.test.ts` ήταν stale (mechanical/plumbing `toEqual([])` ενώ duct/pipe/sanitary ήδη mapped) → διορθώθηκε στις πραγματικές τιμές + `mep-manifold`. **STAGE ADR-040** (BimSceneLayer CHECK 6B + ghost leaves 6D). ⚠️ SHARED tree (ADR-415 floorplan-symbol agent· git add ΜΟΝΟ δικά μου· ΜΗΝ adr-index). **ΕΚΤΟΣ (επόμενο Φ):** «δίκτυο ύδρευσης από συλλέκτη» UI (mirror `mep-circuit-from-selection`)· grips add/remove outlet· hosted wall-attach· catalog/sizing.
- **2026-06-04 (Opus 4.8, orchestrator — 8 agents)** — **Φ11 — AUTO-FITTINGS «ΣΑΝ REVIT» (persisted) DONE** (pending commit, 🔴 browser verify). Όταν ενώνονται σωλήνες (`mep-segment` domain `pipe`), μπαίνει αυτόματα **persisted εξάρτημα** (`mep-fitting` entity) στον κόμβο — κλικάρεται/μετριέται/BOQ, όπως Revit Routing Preferences. **Απόφαση Giorgio (AskUserQuestion):** lifecycle = πλήρως αυτόματα & ζωντανά· scope = **και τα 6** (elbow/coupling/reducer/tee/cross/cap)· elbow = παραμετρικό (`elbowStyle: 'radiused'|'mitered'`, default radiused). **3 στρώματα:** (A) `mep-pipe-junctions.ts` `derivePipeJunctions` (επέκταση union-find του `mep-pipe-network-derive`: junction nodes = {key, position, incidents[]{segmentId, connectorId, directionUnit, diameterMm}})· (B) `mep-fitting-classify.ts` τοπολογία→kind (1=cap· 2 collinear same-Ø=coupling/diff-Ø=reducer· 2 angled=elbow· 3=tee· 4=cross· ≥5=null) + `mep-fitting-geometry.ts` + `mep-fitting-resolve.ts` (pure, deterministic, idempotent· `MepFittingDraft` χωρίς id)· (Γ) `useMepFittingAutoReconciliation.ts` host: subscribe `floorplan_mep_fittings`→scene + debounced reconcile (topology→desired set→**diff BY `junctionKey`**: create/update/delete). **Idempotency = `junctionKey`** (quantized node position)· echo-loop defences mirror `useMepSegmentPersistence` (pending/deleted guards + 500ms debounce + hydration gate + no-op `desiredSignature` short-circuit — **μάθημα snap-fix**). Undo: auto-fittings = derived state, ΟΧΙ στο user undo stack (self-heal on next topology change). **~35 αρχεία** (πρότυπο `mep-segment`): types/schemas/junctions/classify/geometry/resolve/factory + 2D `MepFittingRenderer` (EntityRendererComposite) + 3D units-safe `mep-fitting-to-mesh` (stair `sceneUnitsToMeters`, radiused=TubeGeometry/arc) + firestore-service/audit/add-to-scene + reconciliation host + `MepFittingPersistenceHost` + registrations (entities union+`isMepFittingEntity`+`isPersistedBimEntity`, enterprise-id `mepfit`, `FLOORPLAN_MEP_FITTINGS`, rules, indexes, audit-tracked-fields, audit-trail union, backup, i18n `mepFitting.*` el+en, `elem-mep-fitting` material, **3 σημεία bounds** Bounds/HitTestingService/selection-duplicate-utils — μάθημα furniture, `BimSceneLayer.syncFittings`). 32/32 pure tests PASS (junctions/classify/resolve-idempotency), tsc 0 δικά μου (4 project errors = άλλου agent floorplan-symbol/sanitary + 1 γνωστό mesh-to-object3d:124). **STAGE ADR-040** (BimSceneLayer CHECK 6B). ⚠️ SHARED tree (enterprise-id/collections/rules co-edited με floorplan-symbol agent· git add ΜΟΝΟ δικά μου). 🟡 Known follow-up (Φ12): transient orphan fitting σε πολύ γρήγορη μετακίνηση σωλήνα μέσα στο async-write window (self-heal επόμενη αλλαγή)· manual grips/delete fitting· duct fittings· catalog/sizing.
- **2026-06-04 (Opus 4.8)** — **🐛 FIX Φ9 — MEP connector snap «δεν κουμπώνει» → ✅ browser-verified.** Ο snap engine έπαιρνε scene **χωρίς** τα mep-segments (`initialize segments=0`) και δεν ξανα-αρχικοποιούνταν ποτέ μετά το σχεδίασμα. **Root cause ήταν στο ADR-040 SSoT `useGlobalSnapSceneSync`** (όχι στον MEP κώδικα): το deferred `requestIdleCallback` re-init ακυρωνόταν από το per-run effect cleanup σε κάθε benign no-op re-render (Firestore `subscribeSegments` echo). Fix: cleanup μόνο σε unmount· superseding μέσω cancel-before-schedule. **Γενικό fix — αφορά όλα τα BIM snap.** Λεπτομέρειες: ADR-040 changelog 2026-06-04. Τα Φ9 leaves (connector resolver/engine/registry/types/tolerances) ήταν σωστά εξ αρχής. Snap τώρα κουμπώνει (◇), endpoints ενώνονται, «Δίκτυα σωλήνων» → δίκτυα:N. 8/8 MepConnectorSnap PASS, tsc 0. ❌ ΕΠΟΜΕΝΟ (απόφαση Giorgio): Φ11 auto-fittings **σαν Revit** (persisted elements — elbow/coupling/tee/reducer) ώστε οι ενώσεις να μη φαίνονται «άσχημες».
- **2026-06-04 (Opus 4.8)** — **Φ9/Φ10 ΣΤΡΩΜΑ Β — Plumbing network leaves (connectors + snap + auto-system + colour + UI)** (pending commit, 🔴 browser verify).
  Ολοκλήρωση του φυσικού δικτύου πάνω στο θεμέλιο τύπων του Στρώματος Α. **5 leaves, full SSOT, 196/196 MEP PASS, tsc 0 νέα.** ΕΚΤΟΣ ADR-040
  ΕΚΤΟΣ τα 3D-scene αρχεία (BimSceneLayer = CHECK 6B → STAGE ADR-040· SnapIndicatorOverlay = CHECK 6D → STAGE ADR-040).
  - **Leaf 1 — Segment endpoint connectors:** NEW `bim/mep-segments/mep-segment-connectors.ts` `segmentConnectorWorldPosition(connectorId, params)`
    (seg-start→`startPoint`, seg-end→`endPoint`, z=`centerlineElevationMm`· ΟΧΙ point-host `connectorWorldPosition` — ο σωλήνας ΔΕΝ έχει position+rotation).
    `connector-access.ts` (getEntityConnectors/isMepConnectorHost) + `mep-connector-seed.ts` (2 connectors start+end, domain mirror duct/pipe) +
    `useMepConnectorReconciliation.ts` (widen generic + segment arm) — όλα +`isMepSegmentEntity` arm.
  - **Leaf 2 — Snap-to-connect:** NEW `snapping/engines/MepConnectorSnapEngine.ts` (πρότυπο WallCornerSnapEngine· segment→2 endpoints direct,
    fixture/panel→`connectorWorldPosition`). `ExtendedSnapType.BIM_MEP_CONNECTOR` (priority **-1.5**: πάνω από endpoint/column-centre, κάτω από face corners) +
    enabledTypes/priority/tolerance + register SnapEngineRegistry + ◇ SnapIndicatorOverlay symbol + `'mep_connector'` στο querySnap union (ISpatialIndex/QuadTree/Placeholder) +
    ProSnapToolbar Record/BIM_MODES + i18n `snapModes.labels.bim.mepConnector`. Το snap εφαρμόζεται κεντρικά (mouse-handler-up) → start/end click του segment tool κουμπώνουν δωρεάν.
  - **Leaf 3 — Φ10 auto-system (pure):** NEW `bim/mep-systems/mep-pipe-network-derive.ts` `derivePipeNetworks(entities, tol, defaultClass)` — union-find connected
    components στα **pipe** endpoints (≤1 scene-unit tolerance), 1 network/component, deterministic source = lexικά-μικρότερο segment seg-start, members = όλοι οι
    endpoint connectors. Default classification = `domestic-cold-water` (re-classify στο UI). Πρότυπο `mep-circuit-from-selection.ts` αλλά topology αντί selection.
  - **Leaf 4 — Colour-by-classification:** NEW `classificationDefaultColor(PlumbingSystemClassification)` (cold=#2563eb, hot=#dc2626, drainage=#b45309,
    hydronic-supply=#dc2626, hydronic-return=#2563eb — CIBSE/Revit convention). 2D gate στον `MepSegmentRenderer` (resolveEntitySystemColor + colorBySystem toggle,
    segment.id = colour-index key). 3D: `getSystemTintedMaterial3D` += duct/pipe, `mepSegmentToMesh` += `systemColor` param, `BimSceneLayer.syncMepSegments` passthrough.
  - **Leaf 5 — UI «Δίκτυα σωλήνων»:** action key `mepCircuit.actions.deriveNetworks` (folded στο υπάρχον `useRibbonMepCircuitBridge` → μηδέν νέο prop-threading στο
    useRibbonCommands) + `handleDeriveNetworks` (derivePipeNetworks → 1 CompoundCommand CreateMepSystemCommand/draft, single undo) + home-tab-draw button +
    EventBus `bim:mep-networks-derived` + toast + i18n el/en (button label/tooltip, networkDefaultName, networksDerived). Reuse buildDefaultPipeNetworkParams + classificationDefaultColor.
  - **Roadmap:** Φ11 auto-fittings (elbow/tee/reducer)· Φ12 inline valves· Φ13 manifold/water-heater (multi-connector equipment)· Φ14 system browser/sizing· duct (air) systems.
- **2026-06-03 (Opus 4.8)** — **Φ9 ΣΤΡΩΜΑ Α — Θεμέλιο τύπων plumbing (discriminated union)** (pending commit, 🔴 browser verify· Στρώμα Β leaves εκκρεμούν).
  Πρώτο βήμα του υδραυλικού δικτύου (ύδρευση/αποχέτευση/θέρμανση — επιλογή Giorgio). Recognition: 4 παράλληλοι χαρτογράφοι →
  ο πυρήνας (commands/coordinator/mutator/color) είναι ΗΔΗ domain-agnostic· μόνο οι **τύποι** ήταν hard-typed στο ηλεκτρολογικό.
  **Αλλαγή:** `MepSystemParams` έγινε **discriminated union** σε `systemType` (`MepElectricalSystemParams | MepPipeSystemParams`):
  τα electrical-only πεδία (`wireStyle`/`wireWaypoints`/`conductors`/`ratedVoltage`/`poles`) ζουν ΜΟΝΟ στο electrical arm →
  ο compiler αναγκάζει guards ώστε pipe-network να μην μπει ποτέ στο `computeCircuitWirePaths`. ΝΕΑ: `PlumbingSystemClassification`
  (cold/hot-water, sanitary-drainage, hydronic-supply/return), `PipeFluid`, `MepPipeConnectorParams` (diameter/fluid/**slopePercent** για
  αποχέτευση/flowLps), `MepConnector.pipe?`, `MepSystemType += 'pipe-network'`, `buildDefaultPipeNetworkParams`, type-guards
  `isElectricalSystemParams`/`isPipeSystemParams`, segment endpoint connector builders (`buildSegmentEndpointConnector` start/end,
  `flow:'bidirectional'`, ΧΩΡΙΣ classification στο seed — η κλάση ανήκει στο System). Zod: `MepSystemParamsSchema` = `z.discriminatedUnion`,
  `MepPipeConnectorParamsSchema`. Narrowing guards σε 6 consumers (mep-wire-routing filter· waypoint gesture/2D+3D interaction → narrowed
  `params`· HomeRunWiresOverlay· 2 ribbon widgets). tsc 0 νέα, **151/151 MEP PASS** (ηλεκτρολογικό ανέπαφο). ΕΚΤΟΣ ADR-040.
  **Στρώμα Β (επόμενο, παραλληλοποιήσιμο):** segment endpoint connectors wiring (seed/connector-access/reconciliation + `segmentConnectorWorldPosition`)·
  `MepConnectorSnapEngine` (snap-to-connect)· `mep-pipe-network-derive.ts` (connected-component auto-system, Φ10)· `classificationDefaultColor` +
  color-by-system στον MepSegmentRenderer (2D+3D)· UI «Δίκτυο σωλήνων».
- **2026-06-03 (Opus 4.8)** — **Φ8 FIX — pipe midpoint tick units bug** (pending commit, 🔴 browser verify).
  Σύμπτωμα Giorgio: σχεδιάζοντας **σωλήνα**, τεράστια κάθετη γραμμή στο μέσον. Root: το pipe symbol tick στο
  `mep-segment-symbol.ts` υπολόγιζε `tickHalf` σε **world units** με absolute clamp `[4, 20]` → σε σχέδιο **μέτρων**
  το `MIN_TICK_HALF=4` σήμαινε **4 μέτρα** (ίδια κλάση με τα meter-scale bugs). **Fix (screen-constant, «σαν Revit»):**
  το tick βγήκε από το pure SSoT (`buildSegmentSymbol` πλέον επιστρέφει ΜΟΝΟ centerline, domain-agnostic) και
  ζωγραφίζεται render-time στον `MepSegmentRenderer` με **σταθερό μήκος pixels** (`PIPE_TICK_HALF_PX=7`) μέσω ΝΕΟΥ pure
  `buildPipeTickScreen(startScreen, endScreen)` — ίδιο μοτίβο με `mep-wire-conductor-ticks.ts` (zoom- & scene-independent).
  NEW `mep-segment-symbol.test.ts` (unit-parity mm vs m + screen-constant + perpendicular· 6 tests). 21/21 mep-segment
  PASS, tsc 0 (δικά μου). MepSegmentRenderer ζει στο `bim/renderers/` → ΕΚΤΟΣ CHECK 6D → ΟΧΙ ADR-040 staging.
- **2026-06-03 (Opus 4.8, orchestrator)** — **Φ8 — DUCT/PIPE ELEMENT PIPELINE DONE** (pending commit, 🔴 browser verify).
  Πρώτο **μηχανολογικό/υδραυλικό** BIM στοιχείο — ο counterpart του point-based electrical fixture/panel. **Απόφαση
  Giorgio (AskUserQuestion):** ΕΝΑ **ενοποιημένο** linear MEP entity (`type: 'mep-segment'`) με δύο ορθογώνιους
  discriminators — `domain` (`'duct'` μηχανολογικά / `'pipe'` υδραυλικά → discipline + BimCategory + IFC class + BOQ) και
  `sectionKind` (`'rectangular'` duct / `'round'` round-duct/pipe → swept διατομή) — ακριβώς όπως το δοκάρι ενοποίησε
  rectangular+I-shape κάτω από ΕΝΑ `sectionKind` (data, όχι 2ο entity type). Κόβει στη μέση τα ~34 vs 68 registration
  points, καθαρό SSoT, ικανοποιεί «όλο μαζί» (ΕΝΑ pipeline καλύπτει ΚΑΙ duct ΚΑΙ pipe). **Template = ΔΟΚΑΡΙ** (όχι
  fixture): γραμμικό 2-click με διατομή σαρωμένη κατά άξονα· units-safe `MM_TO_M` (basis-matrix sweep όπως
  `buildSweptIBeamGeometry`, ΟΧΙ buggy `fixtureToMesh`). Elevation = **centreline** (Revit «Middle Elevation», η διατομή
  κεντράρεται κάθετα — όχι top-face). **Υλοποίηση (ΜΙΑ orchestrator συνεδρία, 4 parallel subagents + main):**
  Foundation NEW `mep-segment-types`/`.schemas`/`mep-segment-geometry`/`shared/round-profile`/`mep-segment-completion`/
  `mep-segment.factory`. 3D NEW `mep-segment-to-mesh` (rect+round sweep) + `MaterialCatalog3D` elem-mep-duct/pipe +
  `BimSceneLayer.syncMepSegments` + `Bim3DEntitiesStore.mepSegments`. 2D NEW `MepSegmentRenderer` + `mep-segment-symbol`
  + `EntityRendererComposite`. Ghost+grips NEW `mep-segment-grips`/`MepSegmentGhostRenderer`/ghost-preview/mount + grip
  registrations. Data NEW `mep-segment-firestore-service` (setDoc + `generateMepSegmentId`, N.6) + `useMepSegmentPersistence`
  + `MepSegmentPersistenceHost` + `mep-segment-audit-client` + `add-mep-segment-to-scene` + `UpdateMepSegmentParamsCommand`
  + `useMepSegmentTool` (2-click FSM). **~34 global registrations** (EntityType/BimElementType/entities union+guard·
  BimCategory `duct`/`pipe`+styles+subcat+discipline mechanical/plumbing· audit type+tracked-fields+route maps· IFC
  `IfcDuctSegment`/`IfcPipeSegment`· EventBus· ToolType `mep-duct`/`mep-pipe`+tool-defs· dxf-types+2 converters· hit-test ×4·
  delete/restore/smart-delete· aggregator· backup×3· move/selection/edit-math· enterprise-id `mepseg`+collection·
  firestore.rules+indexes×2). Ribbon: 2 home-tab buttons (Αεραγωγός/Σωλήνας)+icons+i18n el/en. **Connectivity:** το
  segment κρατά το `MepConnectorHostParams` mixin ως **forward hook** (empty) — duct/pipe **systems** = επόμενο Φ.
  Tests: NEW `mep-segment-geometry.test` 15/15 PASS (geometry + round-profile + unit-parity + validation), tsc 0 (δικά
  μου αρχεία). **STAGE ADR-040** (CHECK 6B `BimSceneLayer`/`canvas-layer-stack-leaves` + 6D ghost renderers). ⚠️ SHARED
  TREE με ADR-412 (enterprise-id/collections/rules co-edited)· `git add` ΜΟΝΟ specific, ΠΟΤΕ -A. **❌ DEFERRED:**
  contextual props tab· 3D 2-click placement· duct/pipe systems+routing.
- **2026-06-03 (Opus 4.8)** — **Φ5 roadmap — SEED LEGACY CONNECTORS DONE** (pending commit, 🔴 browser verify).
  Κλείνει το τελευταίο Φ5 caveat: φωτιστικά/πίνακες που φτιάχτηκαν **πριν** το connector model (Φ1/Φ2) δεν είχαν
  `params.connectors`, οπότε δεν συμμετείχαν πλήρως σε reconciliation / wire-routing / `connector.systemId` cache.
  **Απόφαση Giorgio:** «όπως οι μεγάλοι παίκτες (Revit), FULL ENTERPRISE + FULL SSOT» → **scene-only seed**: σε Revit
  οι connectors είναι μέρος του **family definition** — υλοποιούνται ντετερμινιστικά από τον τύπο κατά το load, **δεν**
  αποθηκεύονται ως per-instance mutable data. Persisted backfill θα δημιουργούσε **δεύτερο αντίγραφο** στο Firestore
  που μπορεί να αποκλίνει (drift) → παραβίαση SSoT. **Υλοποίηση:** NEW pure SSoT `bim/mep-systems/mep-connector-seed.ts`
  → `seedDefaultConnectors(entity)` re-materialises τον default connector του host type από τους builders
  (`buildDefaultLightingConnector` / `buildDefaultPanelOutgoingConnector` — η ΜΟΝΑΔΙΚΗ πηγή του default connector
  shape)· same ref όταν ο host έχει ήδη connectors ή δεν είναι connector host (idempotent, pure). **Folded σε ΕΝΑ
  scene pass** μέσα στο `useMepConnectorReconciliation` (seed-then-reconcile → ένα `setLevelScene` diff): κάθε host
  πρώτα seed-άρεται, μετά reconcile-άρεται το `systemId` cache του. Scene-only — μηδέν Firestore write / migration /
  companyId-rules / idle ping-pong κίνδυνος, ακριβώς όπως το `systemId` cache που τροφοδοτεί. **ΕΚΤΟΣ ADR-040** (state
  hook + pure helper, όχι canvas micro-leaf). Tests: NEW `mep-connector-seed.test` (5: fixture→c1 in· panel→c1 out·
  host-με-connector→same ref· non-host→same ref· no-mutation) + integration `useMepConnectorReconciliation.test` (+4:
  seed-then-reconcile σε ένα pass· seed χωρίς systems· idempotent μετά το seed) → 11/11 νέα, 322/322 MEP+types+data
  PASS, tsc 0. ⚠️ SHARED TREE — `git add` ΜΟΝΟ specific, ΠΟΤΕ -A.
- **2026-06-03 (Opus 4.8, Plan Mode)** — **Φ7 roadmap — PER-CIRCUIT EDIT ΑΠΟ ΦΩΤΙΣΤΙΚΟ DONE** (pending commit, 🔴
  browser verify). Revit «device → Electrical Circuits»: επιλέγεις φωτιστικό → βλέπεις σε ποιο κύκλωμα ανήκει + jump
  στη διαχείρισή του. Giorgio (AskUserQuestion): **«Select Panel → jump»** (όχι in-place tab switch) → σέβεται την
  panel-centric αρχή του Φ6. **FULL SSOT, μηδέν νέα command/routing.** Νέο panel **«Κύκλωμα»** στο
  `contextual-mep-fixture-tab` (self-hides μέσω `visibilityKey hasCircuit`): (1) read-only info widget NEW
  `RibbonMepFixtureCircuitWidget` (όνομα κυκλώματος + colour swatch· διαβάζει το **ήδη συγχρονισμένο** `activeSystemId`
  + `resolveManagedCircuits([fixture])`· self-hide null)· (2) action button «Επεξεργασία Κυκλώματος» → bridge
  `editCircuit` → `setActiveSystemId(circuit.id)` + `universalSelection.select(circuit.params.sourceEntityId,
  'dxf-entity')` → ο πίνακας-πηγή επιλέγεται → το panel-centric circuit tab (Φ6) εμφανίζεται σε manage mode με ενεργό
  το κύκλωμα του φωτιστικού (το `useMepCircuitEditorSync` κρατά το `activeSystemId` έγκυρο). **Reuse:** το
  `resolveManagedCircuits` ήδη χειρίζεται member-of (fixture → το ένα του κύκλωμα, Revit single-circuit)· `select`
  ήδη στο `useUniversalSelection`· `sourceEntityId` ήδη στα `MepSystemParams`. Bridge: widen `universalSelection`
  slice +`select`· νέο action `editCircuit`· `getPanelVisibility('hasCircuit')`. i18n el/en
  `ribbon.panels.mepFixtureCircuit` + `ribbon.commands.mepFixtureEditor.{circuit.label,editCircuit,editCircuitTooltip}`.
  **ΕΚΤΟΣ ADR-040** (ribbon data/components/bridge — όχι CHECK 6B/6D micro-leaf). Tests: +4 στο
  `useRibbonMepFixtureBridge.test` (hasCircuit visible/hidden· editCircuit selects source panel + sets active· no-op
  χωρίς κύκλωμα) → 17/17 + 128/128 MEP regression PASS, tsc 0. **🐛 BROWSER-VERIFY FIX (Giorgio): το "Edit Circuit"
  πήγαινε στην «Αρχική» αντί στο circuit tab.** ROOT = **γενικό ribbon bug** στο `RibbonRoot` auto-activation effect
  (ADR-345 §5.4): χειριζόταν μόνο persistent→contextual & contextual→none· σε **contextual→ΑΛΛΟ contextual** (fixture
  tab → circuit tab) καμία branch δεν έτρεχε → το `activeTabId` έμενε στο εξαφανισμένο `mep-fixture-editor` →
  `findRibbonTabById`→undefined→`orderedTabs[0]`=home. FIX: όταν το visible contextual set αλλάζει σε μη-κενό,
  activate το πρώτο visible contextual tab εκτός αν είναι ήδη ενεργό (καλύπτει ΚΑΙ persistent→contextual ΚΑΙ
  contextual→contextual)· διορθώνει επίσης κάθε entity→entity contextual μετάβαση (π.χ. wall→column). ΕΚΤΟΣ ADR-040
  (ribbon shell, όχι canvas micro-leaf). ⚠️ SHARED TREE — `git add` ΜΟΝΟ specific, ΠΟΤΕ -A.
  Αρχεία: NEW `ui/ribbon/components/RibbonMepFixtureCircuitWidget.tsx`· MOD `ui/ribbon/hooks/bridge/mep-fixture-command-keys.ts`
  + `ui/ribbon/data/contextual-mep-fixture-tab.ts` + `ui/ribbon/hooks/useRibbonMepFixtureBridge.ts`
  + `ui/ribbon/components/RibbonPanel.tsx` + `ui/ribbon/components/RibbonRoot.tsx` + i18n el/en + `useRibbonMepFixtureBridge.test.tsx`.
- **2026-06-03 (Opus 4.8, Plan Mode)** — **Φ7 roadmap — COLOUR-BY-SYSTEM TOGGLE DONE** (pending commit, 🔴 browser
  verify). View-tab ON/OFF master switch για το colour-by-system (Revit "Color circuits by system") — μέχρι τώρα
  **πάντα ON, χωρίς flag**. OFF → φωτιστικά/πίνακες/καλώδια πέφτουν στο default χρώμα. **FULL ENTERPRISE + FULL SSOT.**
  **ΜΙΑ SSoT πηγή:** νέο `colorBySystem: boolean` (default `true`) στο `ResolvedBimSettings`/`BimRenderSettings`
  (`config/bim-render-settings-types.ts`, resolver `?? true` → legacy views παραμένουν χρωματισμένα) + στο
  `useBimRenderSettingsStore` (state + `buildRaw` persist + idempotent `setColorBySystem` setter, mirror
  `setDisciplineVisibility`· Firestore-persisted per-view· `commitObjectStyles` helper +`colorBySystem` ώστε
  subcategory writes να μην το χάνουν). **4 gate points διαβάζουν το ΙΔΙΟ flag** (τα 3 του handoff + το 3D-wire που
  προστέθηκε για πλήρες 2D/3D parity): (1) **2D φωτιστικό** `MepFixtureRenderer` — gate του `resolveEntitySystemColor`
  (OFF → amber default)· (2) **2D καλώδια** `MepWireRenderer.drawCircuitWires(..., colorBySystem=true)` + νέα export
  `DEFAULT_WIRE_COLOR='#b45309'` (mirror του 3D `elem-mep-wire` material)· `HomeRunWiresOverlay` leaf-subscribe το flag
  & το περνά (+waypoint handle colour)· **το pure routing SSoT `mep-wire-routing.ts` ΔΕΝ άλλαξε** (gate στον renderer)·
  (3) **3D φωτιστικά/πίνακες** `BimSceneLayer.buildContext` — OFF → **κενό** `systemColorIndex` (converters πέφτουν σε
  default material, μηδέν αλλαγή converter)· (4) **3D καλώδια** `SyncContext.colorBySystem` → `sync-circuit-wires` →
  `wirePathToMesh(..., colorBySystem)` → OFF: `getElementMaterial3D('mep-wire')` αντί system-tinted. **UI:** NEW
  `ColorBySystemToggle.tsx` (1:1 mirror `MepWireToggle`, Palette/Ban icon) + `view-tab-bim-settings.ts`
  (`COLOR_BY_SYSTEM_BUTTON` στο `BIM_GRAPHICS_PANEL`) + `RibbonPanel.tsx` dispatch. i18n el/en
  `ribbon.commands.colorBySystem.{label,enable,disable,tooltipEnable,tooltipDisable}`. **STAGE ADR-040**
  (`HomeRunWiresOverlay` overlay CHECK 6D + `BimSceneLayer` critical CHECK 6B). Tests: store default/toggle/idempotent/
  rehydrate (5 νέα) + `mep-wire-to-three` OFF→default-material + νέο `MepWireRenderer.color` suite (4) → 41/41 PASS,
  tsc 0 (δικά μου). ⚠️ 25 pre-existing wall-attach 3D failures (`syncWalls` topBinding, ADR-401/404 άλλου agent) =
  ΟΧΙ regression. Αρχεία: NEW `ui/ribbon/components/ColorBySystemToggle.tsx` + `MepWireRenderer.color.test.ts`· MOD
  `config/bim-render-settings-types.ts` + `state/bim-render-settings-store.ts` + `bim/renderers/MepFixtureRenderer.ts`
  + `bim/renderers/MepWireRenderer.ts` + `components/dxf-layout/HomeRunWiresOverlay.tsx` + `bim-3d/scene/bim-scene-context.ts`
  + `bim-3d/scene/BimSceneLayer.ts` + `bim-3d/scene/sync-circuit-wires.ts` + `bim-3d/converters/mep-wire-to-three.ts`
  + `ui/ribbon/data/view-tab-bim-settings.ts` + `ui/ribbon/components/RibbonPanel.tsx` + i18n el/en + 2 test files.
- **2026-06-03 (Opus 4.8, Plan Mode)** — **Φ7 roadmap — CONDUCTOR-COUNT TICKS DONE** (pending commit, 🔴 browser
  verify). Giorgio (AskUserQuestion): πλήρης Revit προσέγγιση — ξεχωριστά hot/neutral/ground με long/short ticks,
  FULL ENTERPRISE + FULL SSOT. Τα home-run «tick marks» του Revit: λοξές γραμμές που διασχίζουν το home-run leg
  κοντά στο βελάκι, μία ανά αγωγό — **μακριά** ανά φάση (hot/ungrounded), **κοντή** ανά ουδέτερο (neutral/grounded),
  **κοντή + κουκκίδα** ανά γείωση (equipment ground). SSoT ροή: `MepSystemParams.conductors` (persisted, +Zod
  0–12 strict· ΑΝΕΞΑΡΤΗΤΟ από το `poles` rollup — annotation, όχι load calc· `DEFAULT_CONDUCTORS={hot:1,neutral:1,
  ground:1}`) → `computeCircuitWirePaths` το βάζει στο `CircuitWirePath.conductors` (mirror `colorHex`/`style`) →
  NEW pure SSoT `mep-wire-conductor-ticks.ts` (`buildConductorTicks(tip,from,conductors)` → screen-space tick
  segments + kind, zoom-independent όπως το βελάκι· ticks march panel→fixture, hots→neutrals→grounds) → ο
  `MepWireRenderer` μόνο στρώνει (+ κουκκίδα ground). Επεξεργασία: NEW `RibbonMepCircuitConductorsWidget`
  (hot/neutral/ground number inputs, mirror name-widget lifecycle: debounced isDragging merge / blur-Enter flush /
  Esc revert) → υπάρχον undoable `UpdateMepSystemParamsCommand` (μηδέν νέο command). **2D annotation μόνο** (όπως
  το home-run βελάκι — Revit τα δείχνει σε κάτοψη). **Εκτός ADR-040 scope** (`bim/renderers/`, όχι CHECK 6B/6D).
  +1 NEW test suite (conductor ticks) + extend routing/schema tests → 76/76 MEP-wire + 4/4 overlay PASS, tsc 0.
  Αρχεία: NEW `bim/mep-systems/mep-wire-conductor-ticks.ts` + `ui/ribbon/components/RibbonMepCircuitConductorsWidget.tsx`
  + tick test· MOD `bim/types/mep-system-types.ts` (ConductorBreakdown+DEFAULT_CONDUCTORS) + `mep-system.schemas.ts`
  + `bim/mep-systems/mep-wire-routing.ts` (path.conductors) + `bim/renderers/MepWireRenderer.ts` (draw) +
  `ui/ribbon/components/RibbonPanel.tsx` (wiring) + `ui/ribbon/data/contextual-mep-circuit-tab.ts` (Row 5) + i18n
  el/en (`ribbon.commands.mepConductors.*`) + routing/schema tests.
- **2026-06-03 (Opus 4.8)** — **🐛 Φ7 FU#3 3D — waypoint handle ξεκολλά από το καλώδιο FIX** (pending commit,
  🔴 browser verify). Bug (Giorgio): η λευκή σφαίρα-λαβή ενός waypoint, όταν περιστρέφεις τη θέα 3D, σε πολλές
  περιπτώσεις δεν κάθεται πάνω στη γραμμή του καλωδίου. ROOT CAUSE: **δύο διαφορετικές z-interpolations** για το
  ΙΔΙΟ σημείο. Ο conduit (`splicedSegmentInterior`) δίνει το `zMm` του waypoint με **arc-length** fraction
  (`cum[i+1]/total` = πραγματικό μήκος polyline)· ο handle (`collectHandleNodes` στο 3D hook) χρησιμοποιούσε
  **ομοιόμορφο index fraction** `(i+1)/(N+1)`. Όταν τα άκρα του segment διαφέρουν σε ύψος (φωτιστικό@οροφή vs
  πίνακας@τοίχο), τα δύο z αποκλίνουν → η σφαίρα επιπλέει πάνω/κάτω· το orbit αποκαλύπτει το κάθετο offset.
  FIX (FULL SSOT): εξαγωγή `splicedSegmentInterior` (τώρα δέχεται `WireHostPoint` αντί `RoutedHost`) από το
  `mep-wire-routing.ts`· το `collectHandleNodes` καλεί ΤΗΝ ΙΔΙΑ συνάρτηση → handle z === wire z πάντα, για όλα
  τα styles (straight/orthogonal/arc — η σφαίρα κάθεται σε vertex της polyline). **Εκτός ADR-040 scope.** +3
  routing regression tests (arc-length vs index-fraction) → 27/27 routing + 62/62 MEP-wire PASS, tsc 0. Αρχεία:
  MOD `bim/mep-systems/mep-wire-routing.ts` (export + signature) + `bim-3d/animation/use-bim3d-wire-waypoint-interaction-3d.ts`
  (reuse) + `mep-wire-routing.test.ts`.
- **2026-06-03 (Opus 4.8)** — **🐛 Φ7 P2 live-move — meter-scene 1000× fly-off FIX** (pending commit, 🔴 browser
  verify). Bug (Giorgio): σε live drag του 3D gizmo πάνω σε φωτιστικό/πίνακα, το καλώδιο του κυκλώματος
  «πετάγεται στο άπειρο» κατά το drag και επανέρχεται σωστά στο release. ROOT CAUSE = ίδια κλάση με το
  ADR-402/404 meter-scale fix: στο `bim3d-wire-preview-rebuild.applyDragXform` η live μετατόπιση (`worldToDxfPlan`
  → **mm**) προστίθεται κατευθείαν στα plan points που είναι σε **scene units** (mm/cm/m, ό,τι σκαλώνει το
  `wirePathToMesh` με `sceneToM`). Σε σχέδιο μέτρων → +5m έδινε +5000 → εκτόξευση ×1000· το release ήταν σωστό
  γιατί το committed `sync-circuit-wires` διαβάζει consistent units. FIX: μετατροπή του X/Y delta + του rotate
  pivot mm→scene units μέσω του SSoT `mmToSceneUnits(units)` (`mmScale`· mm→1/cm→0.1/m→0.001) πριν αγγίξουν το
  point· το `zMm` μένει πάντα mm (καμία μετατροπή). Καλύπτει ΚΑΙ move ΚΑΙ plan-rotate (ίδιος root). **Εκτός
  ADR-040 scope** (bim-3d/animation, όχι CHECK 6B/6D). +1 meter-scene regression test → 10/10 PASS, tsc 0.
  Αρχείο: MOD `bim-3d/animation/bim3d-wire-preview-rebuild.ts` (+test).
- **2026-06-03 (Opus 4.8)** — **Φ7 follow-up #3 — 3D EDITING DONE** (pending commit, 🔴 browser verify). Giorgio
  (AskUserQuestion): πρόσθεσε editing και μέσα στο 3D viewport (όχι μόνο κάτοψη). Πλήρης επαναχρησιμοποίηση
  του 2D plan-space SSoT — **μηδέν** νέα routing/persistence/command λογική: NEW hook
  `use-bim3d-wire-waypoint-interaction-3d.ts` (mirror των placement hooks: AbortController listeners στο renderer
  canvas, store reads at event time, OrbitControls off μόνο κατά το drag, armed σε 3D + `select` tool) + NEW
  `WireWaypointHandles3D.ts` (σφαίρες-λαβές screen-constant + insert «+» ghost, mirror `PlacementSnapMarker`,
  added στο `manager.scene` ΕΚΤΟΣ bimLayer group). Raycast: σφαίρες για node grab/delete· conduit tube για insert.
  Μετατροπή world↔plan με τα ADR-403 SSoT (`worldToPlanMm`/`planMmToScenePoint`/`resolveActiveFloorElevationMm`)
  → reuse `computeCircuitHostSegments`/`hitTestInsertion`/`deleteWaypointOriented`/`applyWaypointGesture` +
  optimistic `upsertSystem` (live resync μέσω `use-bim3d-vg-resync`) + undoable `UpdateMepSystemParamsCommand`.
  **Boy-Scout (N.0.2):** εξαγωγή `applyWaypointGesture` σε NEW `mep-wire-waypoint-gesture.ts` (κοινό 2D+3D)· και
  ενοποίηση του resolver — `resolverFromHosts` πήρε optional `zMm` ώστε ΕΝΑ SSoT να σερβίρει 2D overlay + 3D
  conduit sync + 3D editor (το `sync-circuit-wires` σταμάτησε να διπλασιάζει το resolver lambda). Mount στο
  `BimViewport3D`. **Εκτός ADR-040 scope** (bim-3d/ files, όχι CHECK 6B/6D). 123/123 MEP + 13/13 overlay/preview
  regression PASS, tsc 0. Αρχεία: NEW `bim-3d/animation/use-bim3d-wire-waypoint-interaction-3d.ts` +
  `bim-3d/animation/WireWaypointHandles3D.ts` + `bim/mep-systems/mep-wire-waypoint-gesture.ts` + gesture test· MOD
  `bim/mep-systems/mep-wire-resolver.ts` (+zMm) + `bim-3d/scene/sync-circuit-wires.ts` (reuse resolver) +
  `bim-3d/viewport/BimViewport3D.tsx` (mount) + `hooks/canvas/use-mep-wire-waypoint-interaction.ts` (reuse gesture).
- **2026-06-03 (Opus 4.8, Plan Mode)** — **Φ7 follow-up #3: WAYPOINTS DONE** (pending commit, 🔴 browser verify).
  Χειροκίνητα ενδιάμεσα σημεία στη διαδρομή ενός κυκλώματος (Revit «Wire Vertex») — direct-manipulation:
  **drag** πάνω σε segment → γεννά + σέρνει νέο vertex· **drag** υπάρχον vertex → move· **right-click** vertex →
  delete. **FULL SSoT, Revit-grade:** τα waypoints persist-άρουν ως `MepSystemParams.wireWaypoints` (+ Zod, mirror
  του `wireStyle`/`color`), **per-segment topology με order-independent key** (sorted host-pair `entityId:connectorId`)
  → επιβιώνουν όταν η nearest-neighbour daisy-chain ξανα-σειροθετείται. **Μία ένεση στο routing:** το
  `computeCircuitWirePaths` κάνει splice τα oriented waypoints (+ **linear zMm interpolate** κατά μήκος του
  σπασμένου polyline) στα `points[]`, ώστε `buildWirePolyline`/`expandSegment` εφαρμόζουν το `wireStyle` **per
  sub-segment** δωρεάν — **2D + 3D αμετάβλητα** (`mep-wire-to-three` δεν αγγίχτηκε· διαβάζει `buildWirePolyline`).
  Interaction = mirror του ADR-376 C.1 opening-tag drag: null-render leaf `MepWireWaypointDragMount` +
  `useMepWireWaypointInteraction` (raw pointer listeners στο viewport, capture + setPointerCapture + RAF), pure FSM
  `MepWireWaypointDragController`· **optimistic** `upsertSystem` κατά το drag (overlay re-routes) + undoable
  `UpdateMepSystemParamsCommand` στο release (μηδέν νέο command). Επεξεργάσιμο **μόνο το ενεργό κύκλωμα**
  (`activeSystemId`). NEW pure SSoT: `mep-wire-waypoints.ts` (key/orientation/builders) + `mep-wire-waypoint-hit.ts`
  + `mep-wire-resolver.ts` (Boy-Scout: εξαγωγή του host-resolver glue, κοινό overlay + interaction) +
  `mep-wire-waypoint-ui-store.ts` (hover highlight leaf). Handles+hover ζωγραφίζονται στο `MepWireRenderer`
  (`drawWaypointHandles`). **STAGE ADR-040** (αγγίχτηκαν `HomeRunWiresOverlay` 6D + `canvas-layer-stack-leaves` 6B·
  μηδέν `useSyncExternalStore` σε orchestrator). 132/132 MEP+overlay+preview regression PASS (incl. 3 νέα suites),
  tsc 0. Αρχεία: NEW `mep-wire-waypoints.ts`/`mep-wire-waypoint-hit.ts`/`mep-wire-resolver.ts`/
  `mep-wire-waypoint-ui-store.ts`/`mep-wire-waypoint-drag-controller.ts`/`use-mep-wire-waypoint-interaction.ts`/
  `canvas-layer-stack-mep-wire-waypoint.tsx` + 3 test files· MOD `mep-wire-routing.ts`/`mep-system-types.ts`/
  `mep-system.schemas.ts`/`MepWireRenderer.ts`/`HomeRunWiresOverlay.tsx`/`canvas-layer-stack-leaves.tsx`/
  `mep-wire-routing.test.ts`.
- **2026-06-03 (Opus 4.8, Plan Mode)** — **Φ7 follow-up #1: orthogonal/arc wire styles DONE** (pending commit,
  🔴 browser verify). Per-circuit «Wiring Type» (Revit) — ο χρήστης επιλέγει `straight`/`orthogonal`/`arc`
  ανά κύκλωμα, εφαρμόζεται ταυτόχρονα 2D + 3D. **FULL SSoT, μηδέν διπλασιασμός geometry:** το style ζει ως
  `MepSystemParams.wireStyle` (+ Zod enum, persisted), διαχέεται ως `CircuitWirePath.style` στο
  `computeCircuitWirePaths` (αδελφός του `colorHex`), και διαβάζεται **σε ΕΝΑ σημείο** στο `buildWirePolyline(path)`
  — αφαιρέθηκε το dead `style` param από `drawCircuitWires`/`wirePathToMesh`, οπότε **κανένα call-site δεν
  άλλαξε** (overlay/3D περνούν ήδη systems). Το `'arc'` έγινε **πραγματική καμπύλη**: quadratic-Bézier
  sampled-σε-polyline στο `expandSegment` (control = midpoint + κάθετο bulge), άρα 2D (`lineTo`) & 3D
  (`LineCurve3` tube) ζωγραφίζουν ίδια καμπύλη χωρίς curve maths στους renderers. UI: NEW leaf widget
  `RibbonMepCircuitWireStyleWidget` (canonical Radix `@/components/ui/select`, ADR-001· mirror color widget) στο
  contextual circuit tab (Row 4)· dispatch μέσω **έτοιμου** `UpdateMepSystemParamsCommand` (generic patch,
  undoable — μηδέν νέο command). i18n `ribbon.commands.mepWireStyle.*` (el+en). Live-follow P2/P2b ανέπαφα
  (το style ρέει μέσω `path.style`). **Δεν αγγίχτηκαν** `HomeRunWiresOverlay`/`CanvasLayerStack`/
  `sync-circuit-wires`/`bim3d-wire-preview-rebuild` → ADR-040 6B/6C καθαρά· `MepWireRenderer` (canvas) → stage
  ADR-040 (6D). 95/95 MEP + 118/118 fixture/panel/3D-preview regression PASS, tsc 0. Αρχεία: `mep-wire-routing.ts`
  + `MepWireRenderer.ts` + `mep-wire-to-three.ts` + `mep-system-types.ts` + `mep-system.schemas.ts` +
  `RibbonMepCircuitWireStyleWidget.tsx` (NEW) + `RibbonPanel.tsx` + `contextual-mep-circuit-tab.ts` + i18n el/en
  + `mep-wire-routing.test.ts`.
- **2026-06-03 (Opus 4.8, Plan Mode)** — **🐛 IDLE PING-PONG FIX DONE** (pending commit, 🔴 browser verify).
  Σε ηρεμία ο viewer εκτελούσε ~2490 React fibers/idle commit. **Root cause:** ping-pong δύο writers που
  διαφωνούσαν για το derived `MepConnector.systemId`. Ο `useMepConnectorReconciliation` (Φ5) σφραγίζει
  `systemId` στα scene fixtures/panels («System wins»)· το `useMepFixturePersistence` diff-merge έκανε
  `dequal(existing.params, doc.params)` — το Firestore doc **δεν** φέρει authoritative `systemId` (type
  contract `mep-connector-types.ts`), άρα existing(με)≠doc(χωρίς) → `docToEntity` **έσβηνε** το systemId →
  `setLevelScene` → νέα `LevelsContext` identity → re-subscribe ΟΛΩΝ των listeners → re-deliver → ∞ (+δεύτερη
  ακμή: stale persisted systemId). Ο τοίχος δεν loop-άρει γιατί δεν έχει derived-field divergence (ο
  `mutated`/`dequal` guard επιστρέφει σωστά `false` στο echo). **Fix (System-wins, persistence ΠΟΤΕ δεν
  κατέχει το cache):** NEW pure SSoT `projectConnectorSystemIds(fresh, live)` στον `mep-system-coordinator`
  (συμμετρικός αδελφός του `reconcileEntityConnectors` — οδηγείται από το **live scene cache** αντί system
  index· αγνοεί τελείως το doc's systemId· referential-stable). Καλείται στο diff-merge των fixture + panel
  persistence hooks πριν το `dequal` → echo γίνεται no-op → ο loop σπάει. **Defense-in-depth:** idempotent
  `setSystems` στο `mep-system-store` (dequal bail σε identical Firestore re-deliveries → δεν ειδοποιεί
  reconcile subscribers). 7 νέα coordinator tests / 66 MEP PASS, tsc 0. ΟΧΙ ADR-040 staging (κανένα micro-leaf
  αρχείο). RC-1/RC-3 (re-subscribe identity churn / per-render reconcile) = out-of-scope pre-existing,
  αβλαβή με σωστό guard. 5 αρχεία: `mep-system-coordinator.ts` + `useMepFixturePersistence.ts` +
  `useElectricalPanelPersistence.ts` + `mep-system-store.ts` + coordinator test.
- **2026-06-03 (Opus 4.8, Plan Mode)** — **Φ7 P2b DONE** (3D **rotate**-follow — κλείνει την ιστορία του
  live-follow). Το καλώδιο ακολουθούσε live μόνο στο 3D **move** gizmo· τώρα ακολουθεί και στο **plan-rotate**
  (Y-ring). Generalize NEW `bim3d-wire-preview-rebuild.ts`: `buildCircuitWirePreviewObjects(draggedIds, xform)`
  με discriminated `WireDragXform` (`move`{translation} | `rotate`{pivot, angleRad})· για rotate, η resolved
  connector plan-θέση **orbit-άρει** το pivot μέσω canonical `rotatePoint` (geometry-vector-utils, ADR-188,
  μηδέν raw cos/sin)· world +Y ↔ DXF-plan CCW 1:1 (επαληθεύτηκε με `applyRotate`)· `worldToDxfPlan` linear
  (μηδέν offset) → valid και σε point pivot. `interaction-handlers`: `captureCircuitWires` (πρώην
  `captureMoveWires`) καλείται τώρα **και** στο rotate· νέο rotate re-route block στο `applyLivePreview`. +1
  rotate test (orbit bbox). 28/28 (rebuild+live-preview) + 141/141 regression PASS, `tsc` 0. 🔴 Pending commit
  (Giorgio) + browser verify (rotate φωτιστικό/πίνακα gizmo 3D → καλώδιο ακολουθεί live).
- **2026-06-03 (Opus 4.8, Plan Mode)** — **Φ7 P2 DONE** (το καλώδιο ακολουθεί **LIVE** το drag, 2D + 3D —
  πριν ενημερωνόταν μόνο στο release). Root: το live move ζωγραφιζόταν μέσω preview/ghost ξεχωριστά από το
  committed scene· η λύση ξαναϋπολογίζει τη διαδρομή ανά frame με resolver που, για τους dragged hosts,
  επιστρέφει τη **live preview** θέση (override) — **πλήρες SSoT, μηδέν διπλασιασμός routing**
  (`computeCircuitWirePaths`/`wirePathToMesh` αμετάβλητα). **2D (store-free):** ο `HomeRunWiresOverlay` παίρνει
  νέο prop `gripDragPreview` (ήδη διαθέσιμο στο `CanvasLayerStack` γρ.410 → μηδέν νέο subscription, CHECK 6C
  safe)· ο resolver λύνει τον dragged host από το **previewed entity** μέσω `applyEntityPreview` (ΙΔΙΑ SSoT με
  το ghost → wire endpoint === ghost, **move + rotation + corner** ομοιόμορφα). Boy-Scout: εξαγωγή NEW
  `hooks/tools/grip-drag-preview-transform.ts` (`toEntityPreviewTransform`) — το snapshot→transform mapping που
  διπλασιαζόταν inline στο `useGripGhostPreview`, τώρα κοινό SSoT ghost+wire. **3D (mirror ADR-401 dependent
  re-clip, move-first):** NEW `bim-3d/animation/bim3d-wire-preview-rebuild.ts` (`affectedWireSystemIds` +
  `buildCircuitWirePreviewObjects`: resolver με `worldToDxfPlan` delta override μόνο στους dragged → reuse
  routing+converter SSoT· rebuild ΜΟΝΟ τα affected circuits· 'all' scope → commit-on-release) + νέο wire
  channel στο `Bim3DEditLivePreview` (`captureWires` by `mepWireSystemId` / `applyWires` swap, mirror του
  dependent μηχανισμού· reset/commit/isActive) + `bim3d-edit-interaction-handlers` (`captureMoveWires` στο
  pointerDown move branch + `applyWires` per-frame στο `applyLivePreview`). **Stage ADR-040** (CHECK 6B/6D —
  `HomeRunWiresOverlay`/`CanvasLayerStack`). Tests: NEW `bim3d-wire-preview-rebuild` (9) + `grip-drag-preview-
  transform` (4) + `HomeRunWiresOverlay.resolver` (4) + wire cases στο `bim3d-edit-live-preview` (5)·
  116/116 MEP + 130/130 move/grip regression PASS, `tsc` 0. **3D rotate-follow = P2b** (βλ. entry παραπάνω·
  το 2D καλύπτει rotate δωρεάν μέσω `applyEntityPreview`). 🔴 Pending commit (Giorgio) + browser verify (drag
  φωτιστικό/πίνακα gizmo 3D + 2D → καλώδιο ακολουθεί live).
- **2026-06-03 (Opus 4.8, Giorgio review)** — **Φ3 grip SSoT κεντρικοποίηση** (follow-up στο «wall-parity»).
  Ο Giorgio εντόπισε σε review ότι το `electrical-panel-grips.ts` ήταν ~90% διπλότυπο του
  `mep-fixture-grips.ts`. **Boy-Scout N.0.2:** εξαγωγή NEW `bim/grips/centred-box-grips.ts` (entity-agnostic
  centred rotatable-box grip SSoT — `getCentredBoxGrips` + `applyCentredBoxGripDrag`, role-based, παραμετρικό
  `minDimensionMm`)· **ΚΑΙ** fixture (ADR-406) **ΚΑΙ** panel γίνανε thin role↔kind adapters (το fixture κρατά
  μόνο το `circular`/`diameter` extension που δεν έχει box equivalent). ~200 γρ. διπλότυπο → ΕΝΑΣ SSoT. Βλ.
  ADR-397 §D3.1. 11 νέα SSoT tests + 118 PASS regression (fixture circular+rectangular / panel / hot-grip /
  ghost / glyph), tsc 0, μηδέν raw cos/sin. Pending commit (Giorgio).
- **2026-06-03 (Opus 4.8)** — **Φ3 grip UX «wall-parity» DONE** (Ηλεκτρικός Πίνακας — πλήρες 2D grip UX
  «όπως ο τοίχος/φωτιστικό/κολώνα»). Ο πίνακας απέκτησε παραμετρικές λαβές (move-κέντρο + rotation-handle +
  4 γωνίες resize opposite-corner-anchored) + hot-grip UX (move 3-click, rotation 6-click ROTATE→Reference,
  γωνίες 2-click) + status-bar μηνύματα + οδηγητικές/rubber-band γραμμές + live ghost + Ctrl-copy.
  **ΚΡΙΣΙΜΗ ΑΡΧΗ:** μηδέν fork — ΕΓΓΡΑΦΗ στις ίδιες entity-agnostic πύλες grip (κανένα παράλληλο pipeline).
  **FULL SSOT, μηδέν raw cos/sin:** reuse `grip-math` (`rotateVector`/`projectToLocalFrame`/
  `sweptAngleDegAboutPivot`) + canonical `rotatePoint` (ADR-188). 1:1 mirror του `mep-fixture-grips`
  ΜΕΙΟΝ circular (ο πίνακας είναι **μόνο rectangular** → ΟΧΙ diameter grip). **NEW:**
  `bim/electrical-panels/electrical-panel-grips.ts` (`getElectricalPanelGrips` + `applyElectricalPanelGripDrag`) +
  `commitElectricalPanelGripDrag` (grip-parametric-commits, `UpdateElectricalPanelParamsCommand` + emit
  `bim:electrical-panel-params-updated`) + `commitElectricalPanelCopy` (grip-parametric-copy, fresh
  enterprise id N.6 via `buildElectricalPanelEntity`+`addElectricalPanelToScene`) + 2 test files. **MOD
  (πρόσθεσε panel row, δεν έσβησε άλλες):** `grip-types` (`ElectricalPanelGripKind` + field) +
  `useGripMovement` re-export + `unified-grip-types` + `grip-computation` (case + DxfGripDragPreview field) +
  `grip-registry` (forward) + `grip-projections` (buildDxfDragPreview + buildRotateReferencePreview) +
  `useGripGhostPreview` + `apply-entity-preview` (interface + grip branch + movesEntity case) +
  `draw-ghost-entity` (footprint polygon) + `grip-glyph-registry` (move/rotation rows) +
  `ElectricalPanelRenderer.getGrips` (rewrite mirror MepFixtureRenderer) + `grip-commit-adapters` (branch) +
  `wall-hot-grip-fsm` (6 rows + `?? electricalPanelGripKind`). 58/58 grip/ghost tests PASS, `tsc` 0, grep
  cos/sin = 0. **Stage ADR-408 (+ ADR-397)** — CHECK 6D (ghost renderers). 🔴 Pending commit (Giorgio) +
  browser verify (move/rotate/corners/copy/ghost).
- **2026-06-03 (Opus 4.8)** — **Φ7 DONE** (ορατά καλώδια / home-run wires, 2D + 3D). Παράγωγη γεωμετρία
  (ΟΧΙ persisted· το `MepSystem` μένει geometry-less). Routing SSoT NEW `mep-wire-routing.ts`
  (`computeCircuitWirePaths` daisy-chain + home-run, nearest-neighbor· `WireHostPoint` x/y/zMm κοινό 2D+3D·
  `WireStyle` seam straight/orthogonal/arc). 2D: NEW `HomeRunWiresOverlay` (ADR-040 micro-leaf, clone
  EnvelopeOverlay) + NEW `MepWireRenderer` (polyline + home-run arrow), mount στο `CanvasLayerStack`
  (**stage ADR-040**, CHECK 6B/6D). 3D: NEW `mep-wire-to-three.ts` (`CurvePath`→`TubeGeometry`, units-safe
  `sceneUnitsToMeters`) + `BimSceneLayer.syncWires` (ορατοί hosts μόνο) + `MaterialCatalog3D` `elem-mep-wire`·
  resync μέσω του Φ5 `use-bim3d-vg-resync`. Visibility: NEW `BimCategory 'mep-wire'` (+MODEL/DISCIPLINE) +
  View-tab `MepWireToggle` (reuse `setObjectStyleVisibility`). 115/115 MEP PASS, tsc 0. Pending commit (Giorgio)
  + browser verify. Follow-ups: orthogonal/arc styles (seam), conductor ticks, waypoints.
- **2026-06-02 (Opus 4.8)** — **Φ6 DONE** (Circuit-Management Panel — rename / colour / add-remove member).
  Διαχείριση υπάρχοντος κυκλώματος μέσω του ΕΤΟΙΜΟΥ `UpdateMepSystemParamsCommand` (zero νέα command/
  mutator/rules). NEW `mep-circuit-editor` (pure: `resolveManagedCircuits` + add/remove builders) +
  `mep-circuit-editor-store` (active circuit) + `useMepCircuitEditorSync` (selection→active, mount στο
  `MepSystemPersistenceHost`). Boy-scout: `computeReassignRemovals` → SSoT στον coordinator (reuse από
  `mep-circuit-from-selection`). 3 leaf widgets (picker/name/**κεντρικός** `ColorDialogTrigger`/color) +
  properties panel + addMembers/removeMembers bridge actions (CompoundCommand) + EventBus toasts + i18n
  el+en. Trigger panel-centric (electrical-panel που τροφοδοτεί ≥1 κύκλωμα). `tsc` 0· 144/144 MEP PASS
  (20 νέα). 🔴 Pending commit (Giorgio) + browser verify.
- **2026-06-02 (Opus 4.8)** — **Φ5 DONE** (Circuit UI + colour-by-system + scene-time reconciliation).
  «Καταναλώνεται» ο κορμός. **Φ5.A:** persisted `MepSystemParams.color` (Revit System Colour, zero αλλαγή
  rules)· NEW `mep-system-color` (palette/pick/index SSoT) + `mep-circuit-from-selection` (source+members+
  Revit single-circuit reassign) + `CreateMepSystemCommand` (mutator `createSystem`, undoable) +
  contextual ribbon tab «Δημιουργία κυκλώματος» (clone beam, trigger=πίνακας+φωτιστικά) + EventBus toasts.
  **Φ5.B:** NEW `useMepConnectorReconciliation` (scene-only, idempotent, System→connector «System wins»),
  mount στο `MepSystemPersistenceHost`. **Φ5.C:** colour-by-system 2D (Mep/Panel renderers, ADR-040
  leaves) + 3D (`SyncContext.systemColorIndex` + `getSystemTintedMaterial3D` no-singleton-mutation +
  resync sub). 22 νέα tests, tsc 0, 124/124 MEP regression PASS. Pending commit· browser verify. **Stage
  ADR-040 (CHECK 6B/6D).** Roadmap: per-circuit edit panel + colour-by-system toggle.
  **Post-verify διορθώσεις (browser):** (1) **legacy-safe create** — `resolveCircuitFromSelection`
  canonical-id fallback (φωτιστικό/πίνακας χωρίς embedded connector γίνεται member/source με
  `FIXTURE_POWER_CONNECTOR_ID`/`PANEL_OUT_CONNECTOR_ID`)· (2) **toast i18n** — το `created` έγινε απλό
  key (το plural `_one`/`_other` δεν resolve-άρισε runtime)· (3) **panel ΟΧΙ χρωματισμένος** — research
  (Revit Electrical Equipment δεν φέρει circuit colour): `buildEntitySystemColorIndex` χαρτογραφεί μόνο
  members· καθαρίστηκαν `ElectricalPanelRenderer`/`panelToMesh`/`syncPanels`.
- **2026-06-02 (Opus 4.8)** — **Φ4 DONE** (cascade / integrity). Delete πίνακα-πηγής→διαλύει τα
  κυκλώματά του· delete μέλους→βγαίνει από το κύκλωμα. **Coherent single-undo** μέσω `CompoundCommand`
  bundle (entity delete + system commands). NEW pure `resolveMepCascadeOnDelete` (coordinator, reuse
  `findSystemsBySource`)· NEW `mep-system-mutator` port (hook↔command bridge, SSoT-preserving)· NEW
  `UpdateMepSystemParamsCommand` + `DissolveMepSystemCommand` (target mutator port, id-preserving
  restore)· `useMepSystemPersistence.restoreSystem` + mutator registration· `useSmartDelete` compound
  wiring. 15 νέα tests (cascade-plan 5 + commands/compound 10), tsc 0, zero νέα Firestore query.
  Pending commit. Φ5 roadmap.
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

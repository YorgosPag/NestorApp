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
  διαδρομή να τροφοδοτεί ΚΑΙ το 2D (x/y) ΚΑΙ το 3D (x/y/zMm)· `WireStyle` seam (`'straight'` ships,
  `'orthogonal'`/`'arc'` plug μέσω `expandSegment`/`buildWirePolyline` χωρίς αλλαγή renderers). Χρώμα =
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

- «colour by system» view toggle (τώρα always-on)· per-circuit edit από φωτιστικό (system-browser panel).
- Φ7 follow-ups: `orthogonal`/`arc` wire styles (seam έτοιμο)· conductor-count ticks στο home-run· waypoints.
- duct/pipe domains & systems — reserved στα types, no pipeline.

---

## Changelog
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

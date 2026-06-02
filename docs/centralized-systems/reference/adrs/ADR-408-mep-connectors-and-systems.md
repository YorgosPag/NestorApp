# ADR-408 — MEP Connectors & Systems (Connectivity Backbone)

| Field | Value |
|---|---|
| Status | 🟢 **Φ1 + Φ2 + Φ3 + Φ4 DONE** — κορμός + πρώτη «πηγή» + ακεραιότητα δικτύου (2026-06-02, Opus 4.8). Φ1+Φ2: connector model (embedded) + MepSystem (persisted, geometry-less) + coordinator. **Φ3: ηλεκτρικός πίνακας** = full point-based BIM element (mirror ADR-406 fixture pipeline· IfcElectricDistributionBoard· outgoing power connector· units-safe panelToMesh) ✅ **BROWSER-VERIFIED 2026-06-02**. **Φ4: cascade/integrity** — delete πίνακα-πηγής→διαλύει τα κυκλώματά του· delete μέλους→βγαίνει από το κύκλωμα· **coherent single-undo** (CompoundCommand bundle) + 2 SSoT commands (Update/Dissolve) μέσω mutator port. Φ5 = roadmap. 🔴 Εκκρεμεί commit (Giorgio) |
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

## Roadmap (επόμενο push)

- Per-circuit **rename / colour-edit / add-remove member** panel (καταναλώνει το έτοιμο
  `UpdateMepSystemParamsCommand`)· «colour by system» view toggle.
- duct/pipe domains & systems — reserved στα types, no pipeline.

---

## Changelog
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

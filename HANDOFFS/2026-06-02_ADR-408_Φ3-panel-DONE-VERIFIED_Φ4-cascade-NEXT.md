# HANDOFF — ADR-408 MEP Connectors & Systems
**Φ1+Φ2+Φ3 DONE (pending commit) · Φ3 ✅ BROWSER-VERIFIED · Φ4 Cascade/Integrity = NEXT**
Ημερομηνία: 2026-06-02 · Μοντέλο: Opus 4.8 · Mode: Plan→Implement

---

## §0 — ΚΡΙΣΙΜΟΙ ΚΑΝΟΝΕΣ (διάβασέ τους ΠΡΩΤΑ)

- 🚫 **COMMIT/PUSH τα κάνει Ο GIORGIO, ΟΧΙ ο agent** (N.(-1)). Μην κάνεις commit μόνος σου.
- 🚫 **ΠΟΤΕ `--no-verify`** (N.(-1.1)). Αν κολλήσει pre-commit hook → ανάφερε, μη bypass.
- ⚠️ **SHARED WORKING TREE** — δουλεύει ΚΑΙ άλλος agent ταυτόχρονα (railings). **ΠΟΤΕ `git add -A`**. Μόνο specific `git add <file>` + `git diff --cached` πριν από οτιδήποτε.
- 🌐 Απαντάς **στα Ελληνικά** πάντα (LANGUAGE RULE).
- 📋 N.14 (δήλωσε μοντέλο) + N.8 (execution mode) πριν γράψεις κώδικα. N.0.1 ADR-driven (code=SoT). N.15 (ενημέρωσε ΕΚΚΡΕΜΟΤΗΤΕΣ+ADR+adr-index+memory μαζί).

---

## §1 — ΤΙ ΕΓΙΝΕ (Φ3 — Ηλεκτρικός Πίνακας, η circuit «πηγή»)

Χτίζουμε MEP «σαν Revit» σε επίπεδα: ADR-405 disciplines → ADR-406 πρώτο στοιχείο (φωτιστικό) → **ADR-408 connectivity backbone**. Επιλογή Giorgio: **βάθος** (connectors+systems) αντί πλάτος.

- **Φ1+Φ2** (προηγ. session): connector embedded model + MepSystem (first-class persisted, geometry-less) + coordinator reconciliation. DONE, pending commit.
- **Φ3** (αυτή η session): **ηλεκτρικός πίνακας** = full point-based BIM element, **mirror 1:1 του ADR-406 fixture pipeline** (νέος φάκελος `bim/electrical-panels/`). 2 εσκεμμένες διαφορές από το φωτιστικό:
  1. **outgoing** connector (`flow:'out'`, classification `power` — τροφοδοτεί κύκλωμα· `buildDefaultPanelOutgoingConnector`).
  2. **wall-mounted** — 3D box **κεντράρεται κατακόρυφα** στο `mountingElevationMm` (~1500), δεν κρέμεται από οροφή.
  - EntityType `'electrical-panel'`· BimCategory `'electrical-panel'`→electrical· `IfcElectricDistributionBoard`· prefix `'elecpnl'`· collection `FLOORPLAN_ELECTRICAL_PANELS`· kind `'distribution-board'`· shape rectangular-only.
  - **units-safe** `panelToMesh` = stair `sceneUnitsToMeters` pattern (ΟΧΙ buggy `fixtureToMesh`). Test pins mm-scene==m-scene==0.6m.

**Επαλήθευση:** `npx tsc --noEmit` = **0**. 16 MEP suites / **90 tests PASS** (5 νέα panel test files + fixture/connector/system regression). ✅ **BROWSER-VERIFIED 5/5 (Giorgio):** 2D place→3D εμφάνιση · persistence/refresh · delete/refresh · 3D placement · click-select · ribbon/discipline visibility.

⚠️ 25 pre-existing failures σε `BimSceneLayer-visibility-resolver-3d`/`-vg-visibility`/`-multifloor` = param-less wall fixtures στο `syncWalls` (ADR-401/404 test debt — **ΟΧΙ regression**· `syncWalls` τρέχει πριν το νέο `syncPanels`).

---

## §2 — ΑΡΧΕΙΑ Φ3 ΓΙΑ COMMIT (ΑΚΡΙΒΗΣ ΛΙΣΤΑ — shared tree!)

### ✅ ΝΕΑ (25)
```
src/services/factories/electrical-panel.factory.ts
src/subapps/dxf-viewer/bim/types/electrical-panel-types.ts
src/subapps/dxf-viewer/bim/types/electrical-panel.schemas.ts
src/subapps/dxf-viewer/bim/types/__tests__/electrical-panel.schemas.test.ts
src/subapps/dxf-viewer/bim/electrical-panels/electrical-panel-geometry.ts
src/subapps/dxf-viewer/bim/electrical-panels/electrical-panel-symbol.ts
src/subapps/dxf-viewer/bim/electrical-panels/electrical-panel-firestore-service.ts
src/subapps/dxf-viewer/bim/electrical-panels/electrical-panel-audit-client.ts
src/subapps/dxf-viewer/bim/electrical-panels/add-electrical-panel-to-scene.ts
src/subapps/dxf-viewer/bim/electrical-panels/ElectricalPanelGhostRenderer.ts
src/subapps/dxf-viewer/bim/electrical-panels/__tests__/electrical-panel-geometry.test.ts
src/subapps/dxf-viewer/bim/electrical-panels/__tests__/electrical-panel-symbol.test.ts
src/subapps/dxf-viewer/bim/renderers/ElectricalPanelRenderer.ts
src/subapps/dxf-viewer/hooks/drawing/electrical-panel-completion.ts
src/subapps/dxf-viewer/hooks/drawing/useElectricalPanelTool.ts
src/subapps/dxf-viewer/hooks/drawing/__tests__/electrical-panel-completion.test.ts
src/subapps/dxf-viewer/hooks/data/useElectricalPanelPersistence.ts
src/subapps/dxf-viewer/hooks/tools/useElectricalPanelGhostPreview.ts
src/subapps/dxf-viewer/app/ElectricalPanelPersistenceHost.tsx
src/subapps/dxf-viewer/ui/ribbon/hooks/bridge/electrical-panel-tool-bridge-store.ts
src/subapps/dxf-viewer/core/commands/entity-commands/UpdateElectricalPanelParamsCommand.ts
src/subapps/dxf-viewer/components/dxf-layout/canvas-layer-stack-electrical-panel-ghost.tsx
src/subapps/dxf-viewer/bim-3d/placement/use-bim3d-electrical-panel-placement.ts
src/subapps/dxf-viewer/bim-3d/placement/ElectricalPanelPlacementGhost.ts
src/subapps/dxf-viewer/bim-3d/converters/__tests__/electrical-panel-mesh.test.ts
```

### ✅ MODIFIED — δικά μου (Φ3 registrations)
```
src/subapps/dxf-viewer/bim/types/mep-connector-types.ts
src/subapps/dxf-viewer/bim/mep-systems/connector-access.ts
src/subapps/dxf-viewer/types/base-entity.ts
src/subapps/dxf-viewer/bim/types/bim-base.ts
src/subapps/dxf-viewer/types/entities.ts
src/subapps/dxf-viewer/config/bim-object-styles.ts
src/subapps/dxf-viewer/config/bim-subcategories.ts
src/subapps/dxf-viewer/bim/discipline/bim-discipline.ts
src/services/enterprise-id-prefixes.ts
src/services/enterprise-id-class.ts
src/services/enterprise-id-convenience.ts
src/services/enterprise-id.service.ts
src/types/audit-trail.ts
src/config/audit-tracked-fields.ts
src/app/api/audit-trail/record/route.ts
src/config/firestore-collections.ts
src/services/backup/incremental-backup.service.ts
src/app/api/files/propagate-entity-rename/route.ts
src/subapps/dxf-viewer/systems/events/drawing-event-map.ts
src/subapps/dxf-viewer/bim-3d/converters/BimToThreeConverter.ts
src/subapps/dxf-viewer/bim-3d/materials/MaterialCatalog3D.ts
src/subapps/dxf-viewer/bim-3d/scene/BimSceneLayer.ts
src/subapps/dxf-viewer/bim-3d/stores/Bim3DEntitiesStore.ts
src/subapps/dxf-viewer/bim-3d/scene/bim3d-resync.ts
src/subapps/dxf-viewer/bim-3d/viewport/BimViewport3D.tsx
src/subapps/dxf-viewer/hooks/data/useFloors3DAggregator.ts
src/subapps/dxf-viewer/hooks/canvas/useCanvasClickHandler.ts
src/subapps/dxf-viewer/hooks/canvas/canvas-click-types.ts
src/subapps/dxf-viewer/hooks/canvas/useSmartDelete.ts
src/subapps/dxf-viewer/hooks/tools/useSpecialTools.ts
src/subapps/dxf-viewer/services/HitTestingService.ts
src/subapps/dxf-viewer/rendering/hitTesting/Bounds.ts
src/subapps/dxf-viewer/rendering/core/EntityRendererComposite.ts
src/subapps/dxf-viewer/types/entity-bounds.ts
src/subapps/dxf-viewer/types/dxf-export.types.ts
src/subapps/dxf-viewer/bim/utils/bim-bounds.ts
src/subapps/dxf-viewer/core/commands/entity-commands/DeleteEntityCommand.ts
src/subapps/dxf-viewer/hooks/data/useBimEntityRestoredPersistEffect.ts
src/subapps/dxf-viewer/ui/toolbar/types.ts
src/subapps/dxf-viewer/systems/tools/tool-definitions.ts
src/subapps/dxf-viewer/ui/ribbon/data/home-tab-draw.ts
src/subapps/dxf-viewer/ui/ribbon/components/buttons/RibbonButtonIcon.tsx
src/subapps/dxf-viewer/app/DxfViewerTopBar.tsx
src/subapps/dxf-viewer/components/dxf-layout/CanvasSection.tsx
src/subapps/dxf-viewer/components/dxf-layout/CanvasLayerStack.tsx
src/subapps/dxf-viewer/components/dxf-layout/canvas-layer-stack-types.ts
src/subapps/dxf-viewer/components/dxf-layout/canvas-layer-stack-leaves.tsx
src/i18n/locales/el/dxf-viewer-shell.json
src/i18n/locales/en/dxf-viewer-shell.json
firestore.rules
firestore.indexes.json
tests/firestore-rules/_registry/coverage-manifest.ts
docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
docs/centralized-systems/reference/adr-index.md
```

### ✅ MODIFIED — test fixtures (additive `panels: []`)
```
src/subapps/dxf-viewer/bim-3d/scene/__tests__/BimSceneLayer-multifloor.test.ts
src/subapps/dxf-viewer/bim-3d/placement/__tests__/raycast-floor-point.test.ts
src/subapps/dxf-viewer/bim-3d/scene/__tests__/BimSceneLayer-visibility-resolver-3d.test.ts
src/subapps/dxf-viewer/bim-3d/scene/__tests__/BimSceneLayer-vg-visibility.test.ts
```

### ⚠️ SHARED με railing agent (περιέχουν ΚΑΙ Φ3 ΚΑΙ railing αλλαγές)
```
src/subapps/dxf-viewer/canvas-v2/dxf-canvas/dxf-types.ts
src/subapps/dxf-viewer/canvas-v2/dxf-canvas/dxf-renderer-entity-model.ts
src/subapps/dxf-viewer/hooks/canvas/dxf-scene-entity-converter.ts
```

> ΣΗΜ: `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (ενημερωμένο) είναι gitignored. Το memory είναι εκτός repo. **Επίσης pending commit από προηγ. sessions:** Φ1+Φ2 (ADR-408) + ADR-405/406/407.

**Προτεινόμενο commit message:**
```
feat(bim): ADR-408 Φ3 electrical panel (circuit source)

Full point-based BIM element mirroring ADR-406 fixture pipeline.
IfcElectricDistributionBoard, outgoing power connector, wall-mounted
units-safe panelToMesh (stair sceneUnitsToMeters pattern). ~40
registrations (EntityType→rules→ribbon→3D). tsc 0, 90 MEP tests pass,
browser-verified 5/5.
```

---

## §3 — ΕΠΟΜΕΝΗ ΦΑΣΗ: Φ4 — Cascade / Integrity (μέγεθος M)

**Στόχος:** κλείδωμα ακεραιότητας του δικτύου MEP πριν φτιάξουμε UI πάνω του.

**Locked design (από ADR-408 §Roadmap):**
- **Delete πίνακα → διαλύει τα κυκλώματά του.** Το `findSystemsBySource` (στο `mep-system-coordinator.ts`) είναι ΗΔΗ έτοιμο από το Φ2 — βρίσκει τα systems που έχουν τον πίνακα ως `sourceEntityId`.
- **Delete μέλους → βγαίνει αυτόματα από το κύκλωμα** (αφαίρεση από `MepSystem.params.members`).
- **NEW `UpdateMepSystemParamsCommand`** (undo/redo για το System doc — mirror `UpdateMepFixtureParamsCommand`/`UpdateElectricalPanelParamsCommand`).
- Επέκταση `bim-cascade-resolver` (ή/και coordinator pattern ADR-401 C — pure detection + EventBus signal, no scene mutation· το `mep-system-coordinator` ήδη ακολουθεί αυτό).

**ΠΡΟΣΟΧΕΣ:**
- SSoT (μη το σπάσεις): **System κατέχει `members[]`** · `connector.systemId` = derived cache · reconciliation **System→connector (System always wins)**. Βλ. §4 του ADR-408 doc.
- Το `MepSystem` **ΔΕΝ** μπαίνει ποτέ στο scene `Entity` union (geometry-less, δικό του zustand store `mep-system-store.ts`).
- Hook-in points έτοιμα: `findSystemsBySource`, `findSystemMembershipsByEntity`, `detectMissingSystemMembers`/`notifyMissingSystemMembers`, EventBus `bim:mep-system-member-missing`.

**Workflow:** Plan Mode → recognition (πρότυπο: `mep-system-coordinator.ts` + `wall-structural-attach-coordinator.ts` για cascade pattern + `UpdateElectricalPanelParamsCommand` για το command) → εκτέλεση. Δήλωσε μοντέλο (N.14, Opus για cross-cutting) + execution mode (N.8).

> ΕΝΑΛΛΑΚΤΙΚΑ ο Giorgio μπορεί να ζητήσει **Φ5** (UI «Δημιουργία ηλεκτρικού κυκλώματος» + color-by-system + scene-time reconciliation wiring που γράφει `connector.systemId`) — μέγεθος L. **ΡΩΤΑ τον Giorgio Φ4 ή Φ5 αν δεν το έχει διευκρινίσει στο prompt.**

---

## §4 — ROADMAP μετά το Φ4
- **Φ5** UI ανάθεσης κυκλώματος + color-by-system + scene-time reconciliation (εδώ «καταναλώνεται» ο κορμός Φ1+Φ2: γράφεται `connector.systemId` στα fixtures/panels).
- duct / pipe domains & systems — reserved στα types, no pipeline.

## §5 — VERIFY ΕΝΤΟΛΕΣ
```
npx jest "electrical-panel" "mep-fixture" "mep-connector" "mep-system"
npx tsc --noEmit
```
Για Φ4: πρόσθεσε test για cascade (delete source→system dissolved, delete member→removed) + UpdateMepSystemParamsCommand undo/redo. Pre-commit: file ≤500 / func ≤40 (CHECK 4)· αν αγγίξεις νέα collection query → indexes (CHECK 3.15)/rules (CHECK 3.16).

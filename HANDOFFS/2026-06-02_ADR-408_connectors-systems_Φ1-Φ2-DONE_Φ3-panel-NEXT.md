# HANDOFF — ADR-408 MEP Connectors & Systems
**Φ1 + Φ2 DONE (pending commit) · Φ3 Ηλεκτρικός Πίνακας = NEXT**
Ημερομηνία: 2026-06-02 · Μοντέλο: Opus 4.8 · Mode: Plan→Implement

---

## §0 — ΚΡΙΣΙΜΟΙ ΚΑΝΟΝΕΣ (διάβασέ τους ΠΡΩΤΑ)

- 🚫 **COMMIT/PUSH τα κάνει Ο GIORGIO, ΟΧΙ ο agent** (N.(-1)). Μην κάνεις commit μόνος σου.
- 🚫 **ΠΟΤΕ `--no-verify`** (N.(-1.1)). Αν κολλήσει pre-commit hook → ανάφερε, μη bypass.
- ⚠️ **SHARED WORKING TREE** — δουλεύει ΚΑΙ άλλος agent ταυτόχρονα. **ΠΟΤΕ `git add -A`**. Μόνο specific `git add <file>` + `git diff --cached` πριν από οτιδήποτε.
- 🌐 Απαντάς **στα Ελληνικά** πάντα (LANGUAGE RULE).

---

## §1 — ΤΙ ΕΓΙΝΕ (Φ1 + Φ2, ο αρχιτεκτονικός κορμός)

Χτίζουμε το MEP «σαν Revit» σε επίπεδα (ADR-405 disciplines → ADR-406 πρώτο στοιχείο → **ADR-408 connectivity backbone**). Επιλογή Giorgio: **βάθος** (connectors+systems) αντί πλάτος. Αυτό το push = **μόνο Φ1+Φ2** (Plan Mode). Φ3–Φ5 = roadmap.

**Φ1 — Connector model:** `MepConnector` = **embedded sub-object** στα params (Revit: Connector⊂Family· ΟΧΙ entity/Firestore/id). Παγκόσμια θέση **derived** από host `position`+`rotation` (`connectorWorldPosition`, mirror `transformFootprint`). `MepConnectorHostParams` interface → φωτιστικό retrofit + default lighting connector.

**Φ2 — System model:** `MepSystem` = **first-class persisted doc, ΧΩΡΙΣ geometry, ΕΚΤΟΣ `Entity` union** (δικό του zustand store, `mepsys_*`). **SSoT: το System κατέχει `members[]`**· `connector.systemId`=derived cache· reconciliation **System→connector (System always wins)**· coordinator pattern ADR-401 C (pure + `bim:mep-system-member-missing` event, no scene mutation). Full persistence + audit (ADR-195) + firestore.rules + όλες οι registrations.

**🐛 Boy-Scout fix:** το `'mep-fixture'` έλειπε από το `ENTITY_COLLECTION_MAP` του `/api/audit-trail/record` → fixture audit 400-άριζε σιωπηλά (fire-and-forget το κατάπινε). Προστέθηκε + το `'mep-system'`.

**Επαλήθευση:** 25 νέα tests PASS (connector world-pos 8 + coordinator 12 + system schemas 5) + 38/38 fixture regression PASS · `npx tsc --noEmit` = **0 σφάλματα συνολικά**.

---

## §2 — ΑΡΧΕΙΑ ΓΙΑ COMMIT (ΑΚΡΙΒΗΣ ΛΙΣΤΑ — shared tree!)

### ✅ ΔΙΚΑ ΜΟΥ — ΚΑΝΕ STAGE ΑΥΤΑ (ADR-408 Φ1+Φ2)

**Modified (17):**
```
docs/centralized-systems/reference/adr-index.md
firestore.rules
src/app/api/audit-trail/record/route.ts
src/app/api/files/propagate-entity-rename/route.ts
src/config/audit-tracked-fields.ts
src/config/firestore-collections.ts
src/services/backup/incremental-backup.service.ts
src/services/enterprise-id-class.ts
src/services/enterprise-id-convenience.ts
src/services/enterprise-id-prefixes.ts
src/services/enterprise-id.service.ts
src/subapps/dxf-viewer/app/DxfViewerTopBar.tsx
src/subapps/dxf-viewer/bim/types/mep-fixture-types.ts
src/subapps/dxf-viewer/bim/types/mep-fixture.schemas.ts
src/subapps/dxf-viewer/hooks/drawing/mep-fixture-completion.ts
src/subapps/dxf-viewer/systems/events/drawing-event-map.ts
src/types/audit-trail.ts
tests/firestore-rules/_registry/coverage-manifest.ts
```
**New (11):**
```
docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
src/subapps/dxf-viewer/app/MepSystemPersistenceHost.tsx
src/subapps/dxf-viewer/bim/mep-systems/connector-access.ts
src/subapps/dxf-viewer/bim/mep-systems/mep-system-audit-client.ts
src/subapps/dxf-viewer/bim/mep-systems/mep-system-coordinator.ts
src/subapps/dxf-viewer/bim/mep-systems/mep-system-firestore-service.ts
src/subapps/dxf-viewer/bim/mep-systems/mep-system-store.ts
src/subapps/dxf-viewer/bim/types/__tests__/mep-connector-types.test.ts
src/subapps/dxf-viewer/bim/types/__tests__/mep-system.schemas.test.ts
src/subapps/dxf-viewer/bim/types/mep-component-types.ts
src/subapps/dxf-viewer/bim/types/mep-connector-types.ts
src/subapps/dxf-viewer/bim/types/mep-connector.schemas.ts
src/subapps/dxf-viewer/bim/types/mep-system-types.ts
src/subapps/dxf-viewer/bim/types/mep-system.schemas.ts
src/subapps/dxf-viewer/hooks/data/useMepSystemPersistence.ts
```

### 🚫 ΟΧΙ ΔΙΚΑ ΜΟΥ — ΜΗΝ ΤΑ ΑΓΓΙΞΕΙΣ (άλλος agent / ADR-407 railings)
```
docs/centralized-systems/reference/adrs/ADR-407-bim-railings.md
src/subapps/dxf-viewer/bim-3d/converters/railing-to-three.ts
src/subapps/dxf-viewer/canvas-v2/dxf-canvas/dxf-renderer-entity-model.ts
src/subapps/dxf-viewer/canvas-v2/dxf-canvas/dxf-types.ts
src/subapps/dxf-viewer/hooks/canvas/dxf-scene-entity-converter.ts
HANDOFFS/2026-06-02_ADR-407_railings_VERIFY-FIXES_DONE_deep-research-BIM-libraries-NEXT.md
```

> ΣΗΜ: `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (ενημερώθηκε, ΟΜΑΔΑ ADR-408) είναι gitignored — δεν μπαίνει σε commit. Το memory (`~/.claude/.../project_adr408_mep_connectors_systems.md` + MEMORY.md) είναι εκτός repo.

**Έτοιμη εντολή stage (αντί για -A):** κάνε `git add` ΜΟΝΟ τη λίστα ✅ παραπάνω, μετά `git diff --cached --stat` για επιβεβαίωση πριν το commit.

**Προτεινόμενο commit message:**
```
feat(bim): ADR-408 Φ1+Φ2 MEP connectors & systems backbone

Connector embedded model + MepSystem persisted abstraction (geometry-less,
System owns membership truth, connector.systemId derived cache). Full
persistence/audit/rules/registrations. Boy-Scout: fix latent mep-fixture
audit ENTITY_COLLECTION_MAP gap. 25 new + 38 fixture tests pass, tsc 0.
```

---

## §3 — ΕΠΟΜΕΝΗ ΦΑΣΗ: Φ3 — Ηλεκτρικός Πίνακας (μέγεθος L)

**Στόχος:** το πρώτο **«πηγή»** στοιχείο — full point-based BIM element, **mirror 1:1 του ADR-406 φωτιστικού pipeline**. Είναι η βάση εξοπλισμού (Revit "Power Source") που το `MepSystem` αναφέρει ως `sourceEntityId`/`sourceConnectorId`.

**Locked design (από ADR-408 §Roadmap + Plan agent):**
- Νέος `EntityType 'electrical-panel'`, `BimCategory 'electrical-panel'` → `DISCIPLINE_BY_CATEGORY['electrical-panel']='electrical'` (visibility δωρεάν).
- `IfcType 'IfcElectricDistributionBoard'` (IFC4 panelboard — ΟΧΙ IfcElectricalElement).
- `ElectricalPanelParams extends MepConnectorHostParams` — φέρει **outgoing** connector(s) (`flow:'out'`, η πηγή κυκλώματος). Wall-mounted → default `mountingElevationMm ≈ 1500`.
- enterprise-id prefix `'elecpnl'`, collection `FLOORPLAN_ELECTRICAL_PANELS`.

**ΠΡΟΤΥΠΟ = ADR-406 (κολώνα/φωτιστικό).** Ο πλήρης κατάλογος των ~14 νέων + ~38 registration touch-points είναι στο memory `project_adr406_mep_fixture.md` + στο ADR-406 doc §Pipeline. Νέος φάκελος `bim/electrical-panels/` (mirror `bim/mep-fixtures/`).

**ΠΡΟΣΟΧΗ — units:** το `fixtureToMesh` έχει latent meter-scene bug (βλ. memory). Χρησιμοποίησε το **stair `sceneUnitsToMeters` pattern** για το panel-to-three, ΟΧΙ τυφλό copy του fixture.

**ΠΡΟΣΟΧΗ — 2D converter:** ΚΑΘΕ νέος BIM EntityType πρέπει να μπει στο `convertEntity` switch (`dxf-scene-entity-converter.ts`) + `dxf-types.ts` (`DxfElectricalPanel`) + hit-test bounds, αλλιώς **αόρατο στο 2D** (το 3D κρύβει το bug — μάθημα ADR-406 BUG#2). ⚠️ αυτά τα αρχεία είναι **shared** με railing agent — συντόνισε / stage μόνο δικά σου.

**Workflow:** Plan Mode → recognition (ADR-406 ως πρότυπο) → εκτέλεση. Είναι L (5+ files, 2+ domains) → δήλωσε execution mode (N.8). Δήλωσε μοντέλο (N.14, Opus για το cross-cutting).

---

## §4 — ΑΡΧΙΤΕΚΤΟΝΙΚΕΣ ΑΠΟΦΑΣΕΙΣ ΝΑ ΣΕΒΑΣΤΕΙΣ (μη τις σπάσεις στο Φ3+)

| Concept | Owner of truth | Derived |
|---|---|---|
| Connector | host `params.connectors` (embedded) | world pos (από host position+rotation) |
| Circuit membership | `MepSystem.params.members` | `MepConnector.systemId` |
| Circuit source | `MepSystem.params.sourceEntityId/Connector` | — |
| Reconciliation | **System → connector (System wins)** | stale systemId ανεκτό |

- Ο πίνακας **extends `MepConnectorHostParams`** (όπως το φωτιστικό) → ομοιόμορφοι connectors. Πρόσθεσέ τον στο `connector-access.ts` (`getEntityConnectors`/`isMepConnectorHost`).
- Το `MepSystem` **ΔΕΝ** μπαίνει ποτέ στο scene `Entity` union (geometry-less).

---

## §5 — ROADMAP μετά το Φ3
- **Φ4** Cascade/integrity: delete πίνακα→διαλύει τα κυκλώματά του (`findSystemsBySource` έτοιμο)· delete μέλους→βγαίνει· `UpdateMepSystemParamsCommand` (undo/redo)· επέκταση `bim-cascade-resolver`.
- **Φ5** UI «Δημιουργία ηλεκτρικού κυκλώματος» (select μέλη+πίνακα→action) + color-by-system + **scene-time reconciliation wiring** (γράφει `connector.systemId` στα fixtures — εδώ καταναλώνεται το `reconcileEntityConnectors`/`connector-access`).
- duct/pipe domains+systems = reserved στα types, no pipeline.

---

## §6 — VERIFY ΕΝΤΟΛΕΣ (Φ1+Φ2 ήδη πράσινα)
```
npx jest "mep-connector-types" "mep-system-coordinator" "mep-system.schemas" "mep-fixture"
npx tsc --noEmit
```
Pre-commit για Φ3 (νέα collection): θα χρειαστείς **firestore.indexes.json** composite indexes (CHECK 3.15, mirror ADR-407 railings: companyId+floorplanId+projectId & super_admin variant) + firestore.rules block (CHECK 3.16) + coverage-manifest entry. File-size ≤500 / func ≤40 (CHECK 4).

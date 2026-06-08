# HANDOFF — ADR-408 Ύδρευση: υποδοχές→δίκτυο ✅ DONE · ΕΠΟΜΕΝΟ: Πηγή Ζεστού Νερού Χρήσης (Θερμοσίφωνας / DHW water heater)

**Ημερομηνία:** 2026-06-08
**Μοντέλο:** Opus 4.8 (Plan Mode)
**Γλώσσα:** Ελληνικά πάντα.
**Commit:** ΘΑ ΤΟ ΚΑΝΕΙ Ο GIORGIO — όχι ο agent (N.(-1)). **Το working tree μοιράζεται με άλλον/ους agent(s).**
**Ποιότητα:** «όπως οι μεγάλοι, σαν Revit — FULL ENTERPRISE + FULL SSOT».

---

## 🟢 ΜΕΡΟΣ Α — ΤΙ ΟΛΟΚΛΗΡΩΘΗΚΕ (αυτή η συνεδρία)

**ADR-408 — Υδραυλικές υποδοχές → σύνδεση στο δίκτυο ύδρευσης (Revit Plumbing Fixture water connectors + System membership).**
Οι sanitary υποδοχές (νιπτήρας/WC/ντουζιέρα/μπανιέρα/μπιντές = `mep-fixture` SanitaryKind) απέκτησαν **water-supply connectors** (cold/hot) ώστε σωλήνες ύδρευσης να κουμπώνουν (Revit «Connect To») + **membership** στο plumbing `MepSystem`.

### Κρίσιμο εύρημα (code = SoT)
Η connector/system υποδομή είναι **domain-agnostic** → snap (`MepConnectorSnapEngine` ήδη `isMepFixtureEntity`), elevation-στο-snap (`resolveMepConnectorElevationMmAt`/`pointHostMountingElevationMm`), cap-suppression (`collectHostConnectorEndpoints`), reconciliation (`reconcileEntityConnectors`) + `resolveManagedSystems` **δούλευαν ΗΔΗ generic** — μηδέν αλλαγή. Μόνο 2 κενά:
- **ΦΑΣΗ 1 (connectors):** `SANITARY_SPEC += supply{cold,hot,diameterMm}` + NEW builders `buildSanitaryCold/HotWaterConnector` (ids `san-cold`/`san-hot`) + **NEW SSoT factory** `bim/mep-fixtures/sanitary-fixture-connectors.ts` `buildSanitaryFixtureConnectors(kind, sceneUnits)` → `[drain, cold?, hot?]` (unit-safe distinct positions μέσω `mmToSceneUnits`, z=0 floor stubs). Wired completion + seed (kind-aware self-heal).
- **ΦΑΣΗ 2 (membership):** NEW `fixtureMembersForClassification(fixture, classification)` (classification-aware: cold inlet→cold network, hot→hot, drain→sanitary) · `resolvePipeNetworkFromSelection` + `buildAddPipeMembersUpdate` δέχονται fixtures · `useRibbonMepPipeNetworkBridge.handleAddMembers` περνά ΟΛΕΣ τις επιλεγμένες οντότητες. Reuse create-from-selection (multi-select) + add-members flow.

**Tests:** NEW `sanitary-fixture-connectors.test` + EXT `mep-fixture-sanitary`/`mep-connector-seed`/`mep-pipe-network-from-selection` → **143/143 MEP PASS** (μηδέν regression). **ΕΚΤΟΣ ADR-040.**

### ⚠️ Κατάσταση commit (ΔΙΑΒΑΣΕ — μπερδεμένη λόγω shared tree)
**Άλλος agent έκανε commit μέρος της δουλειάς μου** χωρίς συνεννόηση:
- **ΦΑΣΗ 1 source αρχεία ΗΔΗ committed** στο HEAD `80b86fa9` («feat(bim): sanitary fixture mesh library + riser overlay + credits»): `mep-connector-types.ts`, `sanitary-symbol-spec.ts`, `sanitary-fixture-connectors.ts`, `mep-fixture-completion.ts`, `mep-connector-seed.ts`. **ΕΠΙΣΗΣ ο ίδιος agent γενίκευσε** το `SANITARY_SPEC`/`isSanitaryKind` σε **NEW `bim/mep-fixtures/plumbing-fixture-spec.ts`** (`isPlumbingFixtureKind`/`resolvePlumbingFixtureSpec`) για να καλύψει και **συσκευές (Δρόμος B: πλυντήριο κ.λπ.)** — και refactor-άρισε completion+seed να το χρησιμοποιούν. **ΜΗΝ το πειράξεις.**
- **ΕΚΚΡΕΜΟΥΝ για commit (Giorgio) — δικά μου, μόνο αυτά:**
  - `M src/subapps/dxf-viewer/bim/mep-systems/mep-pipe-network-from-selection.ts`
  - `M src/subapps/dxf-viewer/ui/ribbon/hooks/useRibbonMepPipeNetworkBridge.ts`
  - `?? src/subapps/dxf-viewer/bim/mep-fixtures/__tests__/sanitary-fixture-connectors.test.ts`
  - `M src/subapps/dxf-viewer/bim/mep-fixtures/__tests__/mep-fixture-sanitary.test.ts`
  - `M src/subapps/dxf-viewer/bim/mep-systems/__tests__/mep-connector-seed.test.ts`
  - `M src/subapps/dxf-viewer/bim/mep-systems/__tests__/mep-pipe-network-from-selection.test.ts`
  - `M docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md`
- **ΜΗΝ** βάλεις: `ADR-411`, `el/en dxf-viewer-shell.json`, `sanitary-fixture-mesh-catalog.ts`, `_wip_underfloor_backup/`, `plumbing-fixture-spec.ts` (άλλων agents). **ΠΟΤΕ `git add -A`**, **ΜΗΝ adr-index**.

### 🔴 Εκκρεμεί ΜΕΡΟΥΣ Α
1. **Browser verify**: νιπτήρας→σωλήνας ύδρευσης κουμπώνει· WC=cold-only, μπανιέρα=cold+hot· συλλέκτης+σωλήνες+υποδοχές→«Δίκτυο σωλήνων»→μέλη· legacy νιπτήρας reload→self-heal connectors.
2. **tsc**: ΔΕΝ έτρεξε (ο N.17 process-check είναι PowerShell, denied μέσω Bash). Τα jest (TS transform) πέρασαν όλα τα modules. Τρέξε `! npx tsc --noEmit` (αφού δεις ότι δεν τρέχει άλλος tsc — N.17).
3. **🟡 deferred follow-up (όχι μέρος του DHW task):** read-only «Δίκτυο» indicator panel στο sanitary fixture tab (mirror `RibbonMepFixtureCircuitWidget`)· πραγματικό supply-stub elevation (τώρα z=0 floor αντί ~500mm).

---

## 🎯 ΜΕΡΟΣ Β — ΕΠΟΜΕΝΗ ΕΡΓΑΣΙΑ: Πηγή Ζεστού Νερού Χρήσης (Θερμοσίφωνας / Domestic Hot Water heater)

### Το πρόβλημα (γιατί αυτό είναι το επόμενο λογικό βήμα)
Οι υποδοχές απέκτησαν **hot-water inlets** (`domestic-hot-water`, flow:'in'), ΑΛΛΑ **δεν υπάρχει πηγή ζεστού νερού χρήσης**: ο **λέβητας** (`mep-boiler`, Εύρος Β #2) είναι **hydronic θέρμανση χώρου** (`hydronic-supply`/`hydronic-return`) — ΟΧΙ ζεστό νερό χρήσης. Άρα το `domestic-hot-water` δίκτυο έχει **τερματικά χωρίς πηγή**. Χρειάζεται θερμοσίφωνας (electric/solar/gas water heater) = η πηγή που τροφοδοτεί το δίκτυο ζεστού νερού χρήσης.

### 🔑 Πρώτο βήμα: RECOGNITION (code = source of truth, N.0.1)
**ΕΠΙΒΕΒΑΙΩΣΕ ΠΡΩΤΑ** ότι δεν υπάρχει ήδη πηγή `domestic-hot-water` (grep: `domestic-hot-water`, `water-heater`, `θερμοσίφων`, `IfcUnitaryEquipment`/WATER_HEATER). Το handoff μπορεί να είναι out-of-date.

### Πρότυπο 1:1 = ο ΛΕΒΗΤΑΣ (`mep-boiler`) — δομικά ΤΑΥΤΟΣΗΜΟ
Ο θερμοσίφωνας είναι **point-based source** ίδιας δομής με τον boiler:
- **Boiler:** `hydronic-supply` OUT (πηγάζει δίκτυο) + `hydronic-return` IN. `isPipeNetworkSourceEntity = manifold | boiler`.
- **Θερμοσίφωνας (DHW):** `domestic-cold-water` **IN** (τροφοδοσία κρύου) + `domestic-hot-water` **OUT** (πηγάζει το δίκτυο ζεστού χρήσης). Δηλαδή **μέλος του cold network + πηγή του hot network** (membership per-(entity,connector), όπως ο boiler).

### Reuse points (SSoT — ΜΗΝ ξαναγράψεις)
- **Source registry:** `bim/mep-systems/pipe-network-source.ts` — `isPipeNetworkSourceEntity` + `findPipeNetworkSourceConnectorId` → **πρόσθεσε το νέο entity** (ώστε `resolvePipeNetworkFromSelection` να το δέχεται ως source). ΚΡΙΣΙΜΟ: ο source connector του hot network = το `domestic-hot-water` outlet.
- **Connector builders:** `bim/types/mep-connector-types.ts` — mirror `buildBoilerSupplyConnector`/`buildBoilerReturnConnector` → νέα `buildWaterHeaterColdInletConnector` (`flow:'in'`, `domestic-cold-water`) + `buildWaterHeaterHotOutletConnector` (`flow:'out'`, `domestic-hot-water`) + ids.
- **Geometry/connectors factory:** mirror `bim/mep-boilers/mep-boiler-geometry.ts` `buildBoilerConnectors`.
- **Seed:** `bim/mep-systems/mep-connector-seed.ts` — πρόσθεσε `isMepWaterHeaterEntity` branch (legacy self-heal).
- **Source-classification inheritance:** `resolvePipeNetworkFromSelection` ΗΔΗ κληρονομεί `source.params.systemClassification` → ο θερμοσίφωνας ως source δίνει `domestic-hot-water` στο δίκτυο.

### ⚠️ ΜΑΘΗΜΑ από προηγούμενα entities (ΚΡΙΣΙΜΟ για νέο point-based BIM entity)
Νέο entity = **πλήρης registration σε ΠΟΛΛΑ σημεία** (memory: λέβητας ~55 αρχεία, καλοριφέρ):
1. **`bim/types/base-entity.ts` EntityType union** (αλλιώς «incorrectly extends BimEntity» — ΜΑΘΗΜΑ Εύρος Β #2).
2. Νέο `*-types.ts` + zod `*.schemas.ts` (runtime).
3. Factory `@/services/factories/*.factory.ts` + **enterprise-id prefix** (N.6, π.χ. `wheat`/`dhw`) στο `enterprise-id.service.ts`.
4. Geometry + connectors builder.
5. Completion (`hooks/drawing/*-completion.ts`) + tool (`useMep*Tool.ts`) + register σε `useSpecialTools`/placement.
6. Ribbon: button στο `home-tab-draw.ts` + i18n (el+en) ⚠️ **το `en/dxf-viewer-shell.json` ήταν σπασμένο** — επιβεβαίωσε ή βάλε keys σε ασφαλές block.
7. Contextual tab + bridge (mirror boiler «Ιδιότητες Λέβητα»: Geometry/Δίκτυο fold-in/Actions).
8. 2D symbol (`*-symbol.ts`) — αν το θες στην κάτοψη: **5 σημεία** (dxf-scene-entity-converter ΚΡΙΣΙΜΟ+silent-drop! + dxf-renderer-entity-model + Bounds + HitTestingService + selection-duplicate). ΜΑΘΗΜΑ ADR-415.
9. 3D mesh converter (`bim-3d/converters/*-to-mesh.ts` ή `-to-three.ts`) + `BimSceneLayer` sync.
10. Persistence hook (Firestore collection + rules + index — deploy).
11. `Bim3DEntitiesStore` (αν θες 3D placement + connector snap σε 3D, βλ. ADR-403).

### Αποφάσεις προς λήψη στο RECOGNITION/Plan (Revit-grade — πάρ' τες μόνος σου, ζήτα μόνο έγκριση plan)
- **Νέο dedicated entity `mep-water-heater`** (σύσταση, Revit-true: IfcUnitaryEquipment/WATER_HEATER — distinct plumbing equipment) **vs** reuse boiler με DHW mode. Σύσταση: **νέο entity** (καθαρός διαχωρισμός θέρμανσης χώρου ↔ ζεστού χρήσης).
- Connectors: 1 cold-in + 1 hot-out (v1). Προαιρετικά recirculation return (follow-up).
- 2D placement + 3D placement: mirror boiler.

### 🚨 EXECUTION MODE (N.8) — ΑΞΙΟΛΟΓΗΣΕ ΣΤΗΝ ΑΡΧΗ
Νέο point-based entity = **~40-55 αρχεία, 3+ domains** → **Orchestrator-scale**. Στην αρχή της συνεδρίας: αξιολόγησε + **ΕΝΗΜΕΡΩΣΕ τον Giorgio** «Orchestrator (~ZK tokens) ή Plan Mode + subagents;» πριν προχωρήσεις (ο λέβητας έγινε Plan Mode + 6 subagents). ΜΗΝ τρέξεις Orchestrator χωρίς έγκριση.

### Κανόνες session
- **SHARED tree** → git add ΜΟΝΟ δικά σου, **ΠΟΤΕ `-A`**, **ΜΗΝ adr-index** (το πειράζουν άλλοι). Commit/push **ΜΟΝΟ ο Giorgio** (N.(-1)).
- **N.17:** ΕΝΑ tsc τη φορά — έλεγξε πρώτα ότι δεν τρέχει άλλος (PowerShell process-check· αν είναι blocked μέσω Bash, ζήτα από Giorgio ή skip με jest-only verify).
- `any`/inline styles/hardcoded i18n **απαγορεύονται**. Enterprise IDs (N.6) για κάθε νέο Firestore doc.
- **N.15:** μετά την υλοποίηση → ΕΚΚΡΕΜΟΤΗΤΕΣ + ADR-408 + memory (ΟΧΙ adr-index).
- **ADR-040:** το νέο entity είναι BIM (όχι DXF canvas micro-leaf). Αν αγγίξεις 2D renderers/canvas leaves → διάβασε ADR-040 (CHECK 6B/6C/6D).

### Πρώτα βήματα νέας συνεδρίας
1. Αξιολόγηση execution mode (N.8) → ενημέρωσε Giorgio (Orchestrator vs Plan Mode).
2. Recognition: `mep-boiler` πλήρες pipeline (template) + `pipe-network-source.ts` + `mep-connector-types` boiler builders + επιβεβαίωση ότι ΔΕΝ υπάρχει ήδη DHW source.
3. Plan Mode → AskUserQuestion μόνο αν υπάρχει πραγματικό fork (αλλιώς decide Revit-grade) → ExitPlanMode.
4. Υλοποίηση mirror boiler· tests· tsc (ένα run).

**Memory:** `project_adr408_plumbing_fixture_connect.md` (ΜΕΡΟΣ Α) · `project_adr408_eyros_b2_boiler.md` (το πρότυπο) · `MEMORY.md`.

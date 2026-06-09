# 🧠 HANDOFF — ADR-434 Αέριο / Gas Auto-Design (8η & ΤΕΛΕΥΤΑΙΑ MEP discipline) — ΥΛΟΠΟΙΗΣΗ

> **Σύνταξη:** Opus 4.8, 2026-06-09. **Στόχος νέας συνεδρίας:** η **8η & ΤΕΛΕΥΤΑΙΑ MEP discipline = Αέριο (Gas)**, πλήρες κάθετο vertical slice (Slice 0 foundation → 0b fixtures/recognizer → 1 headless engine → 2 preview/commit). **FULL ENTERPRISE + FULL SSOT, όπως Revit / MagiCAD / 4M FINE.** Κλείνει το πλέγμα **8/8 disciplines** — ο φυσικός τελευταίος κρίκος, με **μισή θεμελίωση έτοιμη** (ο `fuel` connector domain + ο λέβητας-ως-terminal υπάρχουν ήδη από τη δουλειά στον λέβητα).

---

## ⚠️ ΠΡΩΤΗ ΕΝΕΡΓΕΙΑ — ΔΙΑΒΑΣΕ ΠΡΙΝ ΓΡΑΨΕΙΣ ΚΩΔΙΚΑ
1. **Μνήμη:** `~/.claude/projects/C--Nestor-Pagonis/memory/MEMORY.md` (index) + `project_adr423_mep_auto_design.md` (framework + locked roadmap· το αέριο=8η/τελευταία) + **`project_adr432_hvac_auto_design.md` (ΤΟ ΑΚΡΙΒΕΣ ΠΡΟΤΥΠΟ** — το αέριο είναι HVAC-style νέα system-family) + `project_adr433_fire_protection.md` (το πιο πρόσφατο vertical slice — δείχνει το full μοτίβο).
2. **ADR (Code=SoT — διάβασέ τα ΟΛΟΚΛΗΡΑ):**
   - `ADR-432-hvac-auto-design.md` — **ΤΟ ΠΡΟΤΥΠΟ** (νέα system-family `duct-network`· ο segment ΔΕΝ κρατά classification→το System owns· connector-driven source· νέο fixture kind source+terminal). Το αέριο = mirror αυτού 1:1 με `'duct'`→`'fuel'`.
   - `ADR-433-fire-protection-auto-design.md` — το φρέσκο full slice (foundation + fixtures + recognizer + engine + preview/commit + shared wiring). Δείξε ΟΛΑ τα touch-points.
   - `ADR-423-mep-auto-design-framework.md` §4 (Registry), §6 (Roadmap — αέριο=8η/τελευταία), §2.1 (gas taxonomy).
3. **Code = SoT — διάβασε ΟΛΟΚΛΗΡΟ το HVAC discipline ως ΠΡΟΤΥΠΟ** `src/subapps/dxf-viewer/systems/mep-design/hvac/`:
   `hvac-design-types.ts`, `air-flow-standard.ts`, `hvac-air-demand.ts`, `duct-sizing.ts`, `hvac-source-resolve.ts`, `hvac-discipline.ts`, `design-hvac.ts`, `hvac-proposal-store.ts`, `commit/build-hvac-commit.ts`, `index.ts` + τα tests.
4. **Η ΗΔΗ-ΥΠΑΡΧΟΥΣΑ θεμελίωση (recon 2026-06-09 — ΜΗΝ την ξαναφτιάξεις):**
   - `MepConnectorDomain` ΗΔΗ έχει `'fuel'` (γρ.43 `mep-connector-types.ts`).
   - `FuelSystemClassification = 'fuel-gas' | 'fuel-oil'` ΗΔΗ υπάρχει (γρ.117) + `MepFuelConnectorParams` + `.fuel` branch στο `MepConnector` + zod schema.
   - `buildBoilerFuelConnector(localPosition, diameterMm, classification)` ΗΔΗ υπάρχει (γρ.681) — domain `'fuel'`, flow `'in'`, fuel-gas/fuel-oil. **Ο λέβητας ΕΙΝΑΙ ΗΔΗ gas terminal** (όταν fuelType=gas).

---

## ⚠️ ΚΑΝΟΝΕΣ (αμετάβλητοι — πάγια εντολή Giorgio)
- **Ελληνικά** όλες οι απαντήσεις (LANGUAGE RULE CLAUDE.md).
- **FULL ENTERPRISE + FULL SSOT «όπως Revit»** — μηδέν `any`/`as any`/`@ts-ignore`· αρχεία ≤500 γρ.· functions ≤40 γρ.· ΠΑΝΤΑ Grep/Glob για υπάρχον πριν γράψεις (reuse/mirror, ΜΗΝ duplicate). Μηδέν hardcoded χρώματα/strings — SSoT.
- **Decide-yourself (memory feedback):** ΜΗΝ ρωτάς standard professional επιλογές· πάρε εσύ την enterprise/Revit απόφαση + ζήτα ΜΟΝΟ έγκριση plan.
- **SHARED working tree με άλλον agent (codex).** `git add` **ΜΟΝΟ δικά σου** αρχεία, **ΠΟΤΕ** `git add -A`. **ΠΑΝΤΑ `git status` + `git diff <file>` πριν αγγίξεις shared αρχείο** (ribbon integration = κοινά).
- **COMMIT/PUSH τα κάνει ΜΟΝΟ ο Giorgio** (N.(-1)). Εσύ ΔΕΝ κάνεις commit/push, ΟΥΤΕ `--no-verify`. **ΜΗΝ αγγίξεις adr-index** (shared tree).
- **N.11 i18n:** ΚΑΘΕ νέο user-facing string → ΠΡΩΤΑ key σε `src/i18n/locales/el/dxf-viewer-shell.json` ΚΑΙ `en/...`. ΟΧΙ hardcoded/defaultValue με κείμενο.
- **ADR-040:** Slice 2 ghost = leaf στο `canvas-layer-stack-leaves.tsx` → **STAGE το ADR-040** (CHECK 6B/6D μπλοκάρουν αλλιώς). Ο proposal-store + ghost hook θέλουν ⚠️ ADR-040 header (όπως water/hvac/fire).
- **N.17:** ΕΝΑΣ tsc τη φορά — έλεγξε με `Get-CimInstance Win32_Process` ότι δεν τρέχει άλλος tsc (ο codex συχνά τρέχει 2!)· τρέξε ΕΝΑΝ στο background, ΜΗΝ μπλοκάρεις. Bash tool = /usr/bin/bash.
- **N.14 Model:** Opus (cross-cutting· νέα discipline + νέα system-family· αγγίζει shared ribbon).
- **N.15 (στο ΤΕΛΟΣ, μαζί):** **ADR-434 NEW doc** + ADR-423 changelog + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + `MEMORY.md`/νέο `project_adr434_gas.md`. **ΜΗΝ adr-index** (shared).
- **ADR number = 434** (επιβεβαιωμένο: ADR-433 = το τρέχον υψηλότερο).

---

## 🔑 ΚΡΙΣΙΜΗ ΑΡΧΙΤΕΚΤΟΝΙΚΗ ΑΠΟΦΑΣΗ (γιατί mirror HVAC, ΟΧΙ fire/water)
Το αέριο είναι **`flowModel: 'pressurised'`** (registry γρ.127-135) ΑΛΛΑ ο connector domain του είναι **`'fuel'`** (ΟΧΙ `'pipe'`) — σκόπιμα disjoint από plumbing (αποφυγή μόλυνσης water switches· έγινε στη δουλειά λέβητα). Άρα ΔΕΝ είναι pure-reuse όπως το fire· είναι **HVAC-style νέα system-family** (mirror `duct-network`):

- **Λείπει η network θεμελίωση** (recon): `MepSegmentDomain = 'duct' | 'pipe'` (ΟΧΙ `'fuel'`)· δεν υπάρχει `fuel-network` MepSystemType· δεν υπάρχει gas-meter source. **Πρέπει να χτιστούν** (mirror του τι έκανε το HVAC για τον αέρα).
- **Ο fuel segment ΔΕΝ θα κρατά classification** → το **`fuel-network` MepSystem** το owns (mirror duct: μόνο 2 classifications fuel-gas/fuel-oil, ένα κτίριο=ένα → το System owns). `buildDefaultFuelNetworkParams(name, classification: FuelSystemClassification, ...)`.
- **MepSystemType** = **NEW `'fuel-network'`** (mirror `duct-network`· ΟΧΙ reuse pipe-network — fuel disjoint).
- Routing = ο **shared** `routeWallAware` (ADR-429), root-outward cumulative. **ΚΑΜΙΑ νέα μηχανή.**
- Members = `pipeSegmentMembers` (domain-agnostic) ∪ `servedConnectors`.

**Γνήσια νέα κομμάτια (το «brain» + foundation):**
1. **NEW `MepSegmentDomain += 'fuel'`** (`mep-segment-types.ts`) — ⚠️ ΕΛΕΓΞΕ για exhaustive `switch(domain)` (η δουλειά λέβητα είπε «κανένα exhaustive switch(domain)» αλλά ΕΠΑΛΗΘΕΥΣΕ ξανά τώρα που μπαίνει segment domain). Widen `buildSegmentEndpointConnector(role, domain: 'duct'|'pipe'|'fuel')` + `completeMepSegmentFromTwoClicks(...domain: MepSegmentDomain...)` (ήδη παίρνει MepSegmentDomain → δωρεάν μόλις widen-άρεις το type· ΕΛΕΓΞΕ `defaultSectionKind`).
2. **NEW `fuel-network` system-family** (`mep-system-types.ts`): `MepFuelSystemParams{systemType:'fuel-network'}` + `isFuelSystemParams` + `buildDefaultFuelNetworkParams` + `MepSystemType += 'fuel-network'`. **Mirror ΑΥΤΟΛΕΞΕΙ το `MepDuctSystemParams`/`isDuctSystemParams`/`buildDefaultDuctNetworkParams` (γρ.119/150/243).** Όλα τα `isPipe`/`isDuct`/`isElectrical` guards = if-checks (όχι exhaustive switch) → zero-regression.
3. **NEW `fuelClassificationDefaultColor`** (`mep-system-color.ts`, mirror `ductClassificationDefaultColor`): `fuel-gas` **κίτρινο `#eab308`** (gas convention) / `fuel-oil` **καφέ-κόκκινο `#92400e`**· widen `resolveSegmentClassificationColor` με fuel branch (όπως έγινε για duct).
4. **NEW source fixture kind `'gas-meter'`** (μετρητής αερίου): fuel-gas OUT connector (`buildGasMeterOutletConnector`, domain `'fuel'`, flow `'out'`, fuel-gas)· `IfcFlowMeter`· glyph (κύκλος «G» ή metering symbol). **Mirror `ahu-symbol-spec` (source).**
5. **TERMINALS — ο λέβητας ΗΔΗ είναι terminal δωρεάν** (boiler-fuel connector, fuel-gas IN). **ΑΠΟΦΑΣΗ (flag for veto):** πρόσθεσε ΚΑΙ νέο appliance terminal `'gas-cooker'` (εστία/κουζίνα αερίου, fuel-gas IN) για πλουσιότερο demo + σημασιολογική πληρότητα — mirror `air-terminal-symbol-spec` αλλά domain fuel. Ο επόμενος agent επιλέγει: μόνο boiler-as-terminal (minimum viable) **ή** +gas-cooker (πρότεινε +gas-cooker).
6. **NEW recognizer** `gas-recognizer.ts` (flow-aware: fuel INLET flow:in fuel-gas → terminal [πιάνει boiler+cooker]· gas-meter OUT ΔΕΝ recognized ως terminal). Mirror `air-terminal-recognizer`/`sprinkler-recognizer`. Register στο `mep-recognition.ts` (recognition.test count +1 → 7).
7. **Demand** `GasDemandStandard` (pluggable): m³/h ανά συσκευή. v1 = από thermalOutputW→m³/h μέσω calorific value φ.αερίου (~9.5–10 kWh/m³) **ή** constant ανά kind. Pluggable σαν το HVAC constant 150 cmh. **ΜΗΝ hardcode στη μηχανή.**
8. **Sizing** `GasSizingStandard` (pluggable): cumulative flow (m³/h) → DN. v1 = velocity-limited (DVGW G600 / EN 1775· low-pressure ~ v≤6 m/s) ή simplified pressure-drop table. Trunk κοντά στον μετρητή = μεγάλο DN, branch σε 1 συσκευή = μικρό → diminishing (Revit-correct).
9. **Registry flip:** `gas` reserved→**active** + `classifications:[]` (fuel όχι plumbing, όπως HVAC) + `demandStandardId`/`sizingStandardId` (`mep-discipline-registry.ts` γρ.127-135). **8/8 active!**

---

## 📦 ΑΡΧΕΙΑ ΠΟΥ ΘΑ ΦΤΙΑΞΕΙΣ/ΑΓΓΙΞΕΙΣ (mirror HVAC ADR-432 + fire ADR-433)

**Slice 0 — foundation (ΕΚΤΟΣ ADR-040):**
- MOD `bim/types/mep-segment-types.ts` (`MepSegmentDomain += 'fuel'`· έλεγξε `defaultSectionKind` + exhaustive switches).
- MOD `bim/types/mep-connector-types.ts` (`buildSegmentEndpointConnector` domain += 'fuel'· NEW `buildGasMeterOutletConnector`).
- MOD `bim/types/mep-system-types.ts` (NEW `MepFuelSystemParams` + `isFuelSystemParams` + `buildDefaultFuelNetworkParams` + `MepSystemType += 'fuel-network'`· mirror duct-network) + schema `mep-system.schemas.ts`.
- MOD `bim/mep-systems/mep-system-color.ts` (`fuelClassificationDefaultColor` + widen `resolveSegmentClassificationColor`· τεστ +case).
- ⚠️ ΕΛΕΓΞΕ `Record<MepSegmentDomain,...>` / `Record<MepSystemType,...>` exhaustive (όπως το ATOE `Record<PlumbingSystemClassification>` που με έσπασε στο fire — ΨΑΞΕ ΤΑ ΠΡΩΤΑ).

**Slice 0b — fixtures + recognizer (ΕΚΤΟΣ ADR-040):**
- NEW `bim/mep-fixtures/gas-meter-symbol-spec.ts` (+ `gas-cooker-symbol-spec.ts` αν appliance terminal).
- MOD `bim/types/mep-fixture-types.ts` (MepFixtureKind union +`GasMeterKind`/`GasCookerKind`· `IfcFlowMeter`/`IfcElectricAppliance`? — gas cooker=`IfcGasTerminal`? δες IFC· **+ τα νέα IfcType στο `bim/types/ifc-entity-mixin.ts` `IfcEntityType` ΚΑΙ `IFC_ENTITY_TYPE_VALUES`** — ΜΑΘΗΜΑ fire: αλλιώς tsc TS2430 «incorrectly extends IfcEntityMixin») + BimCategory (πρότεινε νέα `'fuel'` ή reuse `'pipe'`· δες `resolveSegmentBimCategory` τι δίνει σε fuel segment) + `mep-fixture.schemas.ts`.
- Wire τα 11 fixture rails (symbol dispatch· connector-seed `mep-fixture-completion`· `useMepFixtureTool` status· `useSpecialTools-placement-tools` + `useCanvasClickHandler` tool→kind· `tool-definitions.ts` + **`ui/toolbar/types.ts` ToolType union (ΚΡΙΣΙΜΟ — αλλιώς tsc TS2353)**· ribbon `home-tab-draw.ts` buttons «Μετρητής Αερίου»/«Εστία Αερίου», icon `bim-pipe` ή νέο).
- NEW `systems/recognition/recognizers/gas-recognizer.ts` + register στο `mep-recognition.ts`.
- i18n el+en (tools + ribbon.commands.bim.mepGasMeter/mepGasCooker).

**Slice 1 — headless engine (ΕΚΤΟΣ ADR-040), `systems/mep-design/gas/`:**
- `gas-design-types.ts` (GasService='gas'· GAS_SERVICE_CLASSIFICATION→'fuel-gas'· ProposedFuelSegment/Network mirror hvac duct)· `gas-flow-standard.ts` (`GasDemandStandard` m³/h)· `gas-demand.ts`· `gas-sizing.ts` (`GasSizingStandard` flow→DN)· `gas-source-resolve.ts` (connector-driven gas-meter, fuel OUT fuel-gas)· `gas-discipline.ts` (descriptor)· `design-gas.ts` (REUSE `routeWallAware`+`wallObstacles`)· `index.ts`.
- MOD `registry/mep-discipline-registry.ts` (flip active + standard ids → **8/8 active**).
- Tests: `__tests__/gas-design.test.ts` (demand/sizing/source/orchestrator, mirror hvac-design.test).

**Slice 2 — preview/commit (STAGE ADR-040), `systems/mep-design/gas/`:**
- NEW `gas-proposal-store.ts` (low-freq, ⚠️ ADR-040 header)· `commit/build-gas-commit.ts` (pure· **domain `'fuel'`** segments via `completeMepSegmentFromTwoClicks(...,'fuel',{sectionKind:'round',diameter})` flat @ sourceElevationMm + `buildDefaultFuelNetworkParams('fuel-gas',...,fuelClassificationDefaultColor)` MepSystem· members `pipeSegmentMembers` ∪ servedConnectors· **mirror build-hvac-commit ΑΥΤΟΛΕΞΕΙ** — ο fuel segment ΔΕΝ κρατά classification)· `hooks/tools/useGasProposalGhostPreview.ts` (⚠️ ADR-040· domain `'fuel'`· stroke SSoT `resolveSegmentClassificationColor('fuel-gas')`)· `components/dxf-layout/canvas-layer-stack-gas-proposal-ghost.tsx` leaf.
- NEW `ui/ribbon/hooks/useRibbonGasAutoBridge.ts` + `bridge/gas-auto-command-keys.ts` (Generate/Accept/Reject, mirror useRibbonHvacAutoBridge).
- **SHARED (⚠️ git diff ΠΡΩΤΑ — codex):** `canvas-layer-stack-leaves.tsx` (mount + STAGE ADR-040)· `useDxfBimBridges.ts` (+`gasAutoBridge`)· `useDxfViewerRibbon.ts` (destructure + thread)· `useRibbonCommands.ts`(+`-types`) (import `isGasAutoActionKey` + prop + branch + deps)· `home-tab-draw.ts` (submenu «Αυτόματο Αέριο»)· `systems/events/drawing-event-map.ts` (3 events `bim:gas-generated/-empty/-committed`)· `hooks/useDxfViewerNotifications.ts` (3 toasts)· i18n el+en (`ribbon.commands.bim.gasAuto*` + `ribbon.commands.gas.networkName`/`service.gas` + top-level `gas` toasts).
- Tests: `commit/__tests__/build-gas-commit.test.ts` (mirror build-hvac-commit: fuel segments ΧΩΡΙΣ classification, 1 fuel-network MepSystem/network, members, flat elevation, store).

---

## ✅ DEFINITION OF DONE
- jest πράσινο: νέα gas suites + zero regression σε ΟΛΑ τα `mep-design` + `recognition` + `mep-fixtures` + `mep-system` suites.
- tsc --noEmit μηδέν σφάλματα στα δικά σου αρχεία (ΕΝΑΣ tsc, background, N.17· αγνόησε προϋπάρχοντα codex errors π.χ. `annual-gains-config.ts`).
- Browser smoke (αν ζητηθεί): μετρητής αερίου + λέβητας(gas) [+εστία] → «Αυτόματο Αέριο → Generate» → κίτρινο ghost σωλήνων → Accept → πραγματικά fuel segments + 1 fuel-network MepSystem (1 atomic undo).
- **N.15 docs:** ADR-434 NEW doc + ADR-423 changelog (**8/8 disciplines ΟΛΟΚΛΗΡΩΘΗΚΑΝ!**) + ΕΚΚΡΕΜΟΤΗΤΕΣ + MEMORY.md (+ νέο `project_adr434_gas.md`). **ΜΗΝ adr-index.**
- Λίστα δικών σου αρχείων + context indicator (N.9) + Google-level declaration (N.7.2). **ΜΗΝ commit** — άσε τον Giorgio.

---

## 🧩 ΚΑΤΑΣΤΑΣΗ ΠΟΥ ΚΛΗΡΟΝΟΜΕΙΣ (7 disciplines DONE — μένει 1)
- **Active (7):** water-supply, sanitary-drainage, heating, electrical-strong, electrical-weak, hvac, **fire-protection (μόλις, ADR-433 DONE)**. **Reserved (1):** **gas (ΕΣΥ = ο τελευταίος!)**.
- **Κοινός εγκέφαλος:** Stage 0 Recognition (ADR-425) + Routing Brain (ADR-429· A* wall-aware) + preview/commit layer (proposal-store + ghost + CompoundCommand) **shared verbatim και στις 7**.
- Το αέριο = **HVAC-style** (νέα `fuel-network` system-family· ο segment ΔΕΝ κρατά classification) → mirror ADR-432 1:1 με `'duct'`→`'fuel'`, `DuctSystemClassification`→`FuelSystemClassification`, AHU→gas-meter, air-terminal→boiler/cooker fuel inlet.
- **Μισή θεμελίωση ΗΔΗ ΕΤΟΙΜΗ:** `fuel` connector domain + `FuelSystemClassification` + `MepFuelConnectorParams` + `buildBoilerFuelConnector` (ο λέβητας=terminal δωρεάν). Λείπει: fuel SEGMENT domain + fuel-network SYSTEM + gas-meter source + engine.
- **ΜΗΝ commit· shared tree με codex.** Πρότυπα: ADR-432 (HVAC new-system-family) + ADR-433 (φρέσκο full slice + όλα τα touch-points).
- **ΜΑΘΗΜΑΤΑ από fire (μην τα ξαναπατήσεις):** (1) νέο IfcType → πρόσθεσέ το στο `IfcEntityType` **ΚΑΙ** `IFC_ENTITY_TYPE_VALUES` (αλλιώς TS2430). (2) Ψάξε exhaustive `Record<...>` (το ATOE `Record<PlumbingSystemClassification>` έσπασε το tsc — εδώ ψάξε `Record<MepSegmentDomain>`/`Record<MepSystemType>`). (3) ToolType union (TS2353). (4) recognition.test count +1.

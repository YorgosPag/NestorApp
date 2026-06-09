# 🧠 HANDOFF — ADR-433 Πυρόσβεση / Fire-Protection Auto-Design (7η MEP discipline) — ΥΛΟΠΟΙΗΣΗ

> **Σύνταξη:** Opus 4.8, 2026-06-09. **Στόχος νέας συνεδρίας:** η **7η MEP discipline = Πυρόσβεση (sprinklers)**, πλήρες κάθετο vertical slice (Slice 0 foundation → 0b fixtures/recognizer → 1 headless engine → 2 preview/commit). **FULL ENTERPRISE + FULL SSOT, όπως Revit / MagiCAD / 4M FINE / Hydratec.** Ξεκινά από το μηδέν (μηδέν κώδικας πυρόσβεσης σήμερα) αλλά είναι **πιστό pipe-style mirror της Ύδρευσης (ADR-426)** — όχι νέα μηχανή.

---

## ⚠️ ΠΡΩΤΗ ΕΝΕΡΓΕΙΑ — ΔΙΑΒΑΣΕ ΠΡΙΝ ΓΡΑΨΕΙΣ ΚΩΔΙΚΑ
1. **Μνήμη:** `~/.claude/projects/C--Nestor-Pagonis/memory/MEMORY.md` (index) + `project_adr423_mep_auto_design.md` (framework) + `project_adr426_water_supply_auto_design.md` (το ΑΚΡΙΒΕΣ pipe template) + `project_adr432_hvac_auto_design.md` (το πιο πρόσφατο — δείχνει το μοτίβο «νέα classification + νέο fixture kind + recognizer + registry flip»).
2. **ADR (Code=SoT — διάβασέ τα ΟΛΟΚΛΗΡΑ):**
   - `ADR-426-water-supply-auto-design.md` — **ΤΟ ΠΡΟΤΥΠΟ** (pressurised pipe pilot, και τα 4 stages + Slice 2). Η πυρόσβεση = pipe 1:1 με αυτό.
   - `ADR-432-hvac-auto-design.md` — το μοτίβο foundation (Slice 0 νέα classification + Slice 0b fixture kinds + recognizer + Slice 2). **ΜΟΛΙΣ ΕΓΙΝΕ — φρέσκο reference.**
   - `ADR-423-mep-auto-design-framework.md` §4 (Registry), §6 (Roadmap), §7 (Standards).
3. **Code = SoT — διάβασε ΟΛΟΚΛΗΡΟ το Water discipline ως ΠΡΟΤΥΠΟ** `src/subapps/dxf-viewer/systems/mep-design/water/`:
   `water-design-types.ts`, `water-demand.ts`, `water-loading-units.ts`, `water-sizing.ts`, `water-source-resolve.ts`, `water-supply-discipline.ts`, `design-water-supply.ts`, `water-proposal-store.ts`, `commit/build-water-supply-commit.ts`, `index.ts` + τα tests.
4. **Το HVAC Slice 0b/2 (μόλις έγινε) ως δεύτερο template** (νέο fixture kind + recognizer + ghost): `bim/mep-fixtures/air-terminal-symbol-spec.ts` + `ahu-symbol-spec.ts`, `systems/recognition/recognizers/air-terminal-recognizer.ts`, `systems/mep-design/hvac/commit/build-hvac-commit.ts`, `ui/ribbon/hooks/useRibbonHvacAutoBridge.ts`, `hooks/tools/useHvacProposalGhostPreview.ts`.

---

## ⚠️ ΚΑΝΟΝΕΣ (αμετάβλητοι — πάγια εντολή Giorgio)
- **Ελληνικά** όλες οι απαντήσεις (LANGUAGE RULE CLAUDE.md).
- **FULL ENTERPRISE + FULL SSOT «όπως Revit»** — μηδέν `any`/`as any`/`@ts-ignore`· αρχεία ≤500 γρ.· functions ≤40 γρ.· ΠΑΝΤΑ Grep/Glob για υπάρχον πριν γράψεις (reuse/mirror, ΜΗΝ duplicate). Μηδέν hardcoded χρώματα/strings — SSoT (`resolveSegmentClassificationColor`/`classificationDefaultColor`).
- **Decide-yourself (memory feedback):** ΜΗΝ ρωτάς standard professional επιλογές· πάρε εσύ την enterprise/Revit απόφαση + ζήτα ΜΟΝΟ έγκριση plan.
- **SHARED working tree με άλλον agent (codex).** `git add` **ΜΟΝΟ δικά σου** αρχεία, **ΠΟΤΕ** `git add -A`. **ΠΑΝΤΑ `git status` + `git diff <file>` πριν αγγίξεις shared αρχείο** (ribbon integration = κοινά).
- **COMMIT/PUSH τα κάνει ΜΟΝΟ ο Giorgio** (N.(-1)). Εσύ ΔΕΝ κάνεις commit/push, ΟΥΤΕ `--no-verify`. **ΜΗΝ αγγίξεις adr-index** (shared tree).
- **N.11 i18n:** ΚΑΘΕ νέο user-facing string → ΠΡΩΤΑ key σε `src/i18n/locales/el/dxf-viewer-shell.json` ΚΑΙ `en/...`. ΟΧΙ hardcoded/defaultValue με κείμενο.
- **ADR-040:** Slice 2 ghost = leaf στο `canvas-layer-stack-leaves.tsx` → **STAGE το ADR-040** (CHECK 6B/6D μπλοκάρουν αλλιώς). Ο proposal-store + ghost hook θέλουν ⚠️ ADR-040 header (όπως water/hvac).
- **N.17:** ΕΝΑΣ tsc τη φορά — έλεγξε με `Get-CimInstance Win32_Process` ότι δεν τρέχει άλλος tsc (codex)· τρέξε ΕΝΑΝ στο background, ΜΗΝ μπλοκάρεις. Ο Bash tool = /usr/bin/bash (ΟΧΙ PowerShell).
- **N.14 Model:** Opus (cross-cutting· νέα discipline· αγγίζει shared ribbon).
- **N.15 (στο ΤΕΛΟΣ, μαζί):** **ADR-433 NEW doc** + ADR-423 changelog + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + `MEMORY.md`/νέο `project_adr433_fire_protection.md`. **ΜΗΝ adr-index** (shared).
- **ADR number = 433** (επιβεβαιωμένο: ADR-432 = το τρέχον υψηλότερο).

---

## 🔑 ΚΡΙΣΙΜΗ ΑΡΧΙΤΕΚΤΟΝΙΚΗ ΑΠΟΦΑΣΗ (γιατί mirror water, ΟΧΙ HVAC/electrical)
Η πυρόσβεση είναι **`flowModel: 'pressurised'`** (ΗΔΗ έτσι στο registry, γρ. 118-126) → **pipe-style, πιστό mirror της Ύδρευσης**:
- Παράγει **φυσικούς σωλήνες** `mep-segment` **domain `'pipe'`** (ΟΧΙ duct, ΟΧΙ logical circuit).
- Commit μέσω `completeMepSegmentFromTwoClicks(...,'pipe',{classification:'fire-sprinkler',diameter})` + `buildDefaultPipeNetworkParams(...)` (ο σωλήνας **κρατά** classification — pipe-only πεδίο, σε αντίθεση με το duct του HVAC).
- Routing = ο **shared** `routeWallAware` (ADR-429), root-outward cumulative. **ΚΑΜΙΑ νέα μηχανή.**
- Members = `pipeSegmentMembers` (domain-agnostic) ∪ `servedConnectors`.
- `MepSystemType` = **`'pipe-network'`** (ΥΠΑΡΧΕΙ — δεν θέλει νέο system type, σε αντίθεση με το HVAC που χρειάστηκε duct-network). Απλώς νέα `PlumbingSystemClassification`.

**Γνήσια νέα κομμάτια (το «brain» + foundation):**
1. **NEW classification** `'fire-sprinkler'` στο `PlumbingSystemClassification` (`mep-connector-types.ts` γρ.64-69 + `mep-connector.schemas.ts`) + **χρώμα** στο `mep-system-color.ts` (`classificationDefaultColor` — πρότεινε φωτιά-κόκκινο, π.χ. `#dc2626`/`#ef4444`· **ΔΙΑΦΟΡΕΤΙΚΟ** από hot-water red — δες τι ήδη χρησιμοποιείται, π.χ. `#b91c1c` βαθύ κόκκινο fire). Το `resolveSegmentClassificationColor` το πιάνει αυτόματα (plumbing branch).
2. **NEW terminal fixture kind** `'sprinkler'` (κεφαλή καταιονητήρα): ΕΝΑΣ pressurised inlet connector (`buildSprinklerSupplyConnector`, domain `'pipe'`, flow `'in'`, classification `'fire-sprinkler'`)· `IfcFireSuppressionTerminal`· οροφής glyph (κύκλος + deflector σταυρός). **Mirror air-terminal-symbol-spec (Slice 0b).**
3. **NEW source** = στήλη/συγκρότημα πυρόσβεσης. **ΑΠΟΦΑΣΗ (flag for veto):** νέο fixture kind `'fire-riser'` (κατακόρυφη στήλη / wet riser) με `'fire-sprinkler'` OUT connector → connector-driven source resolve (mirror AHU-as-fixture του HVAC Slice 0b· promote σε standalone fire-pump entity = future). Ο επόμενος agent επιλέγει: νέο `'fire-riser'` kind **ή** reuse `manifold` (συλλέκτης) — πρότεινε `'fire-riser'` για σημασιολογική καθαρότητα.
4. **NEW recognizer** `sprinkler-recognizer.ts` (flow-aware: pressurised inlet flow:in classification fire-sprinkler → terminal· fire-riser OUT ΔΕΝ recognized ως terminal). Mirror `air-terminal-recognizer`. Register στο `mep-recognition.ts` (recognition.test count +1).
5. **Demand** `FireDemandStandard` (pluggable): NFPA 13 / EN 12845 — design flow ανά κεφαλή. v1 = **constant design flow per head** (π.χ. ~80 L/min ≈ light-hazard density 5 mm/min × ~12 m² coverage, ή K-factor Q=K√P) — pluggable σαν το HVAC constant 150 cmh. **ΜΗΝ hardcode στη μηχανή.**
6. **Sizing** `FireSizingStandard` (pluggable): cumulative flow (L/min) → DN. v1 = velocity-limited (v≤ ~6 m/s wet pipe) ή simplified pipe-schedule table. Trunk κοντά στη στήλη = μεγάλο DN, branch σε 1 κεφαλή = μικρό → diminishing (Revit-correct).
7. **Registry flip:** `fire-protection` reserved→**active** + `classifications:['fire-sprinkler']` + `demandStandardId`/`sizingStandardId` (`mep-discipline-registry.ts` γρ.118-126).

---

## 📦 ΑΡΧΕΙΑ ΠΟΥ ΘΑ ΦΤΙΑΞΕΙΣ/ΑΓΓΙΞΕΙΣ (mirror water + hvac)

**Slice 0 — foundation (ΕΚΤΟΣ ADR-040):**
- MOD `bim/types/mep-connector-types.ts` (+`'fire-sprinkler'` στο PlumbingSystemClassification) + `mep-connector.schemas.ts`.
- MOD `bim/mep-systems/mep-system-color.ts` (`classificationDefaultColor` +fire-red case· τεστ `mep-system-color.test.ts` +case).
- NEW connector builder `buildSprinklerSupplyConnector` (+ `buildFireRiserSupplyConnector` αν fire-riser) στο connector-seed path (mirror `buildAirTerminalSupplyConnector`/`buildAhuSupplyAirConnector`).

**Slice 0b — fixtures + recognizer (ΕΚΤΟΣ ADR-040):**
- NEW `bim/mep-fixtures/sprinkler-symbol-spec.ts` (+ `fire-riser-symbol-spec.ts` αν νέο source kind).
- MOD `bim/types/mep-fixture-types.ts` (MepFixtureKind union +`SprinklerKind`/`FireRiserKind`· IfcType· BimCategory) + `mep-fixture.schemas.ts`.
- Wire: symbol dispatch· connector-seed (load-time)· `hooks/drawing/mep-fixture-completion.ts` (placement)· `useMepFixtureTool` status· `useSpecialTools-placement-tools` + `useCanvasClickHandler` (tool→kind)· `tool-definitions.ts` + **`ui/toolbar/types.ts` ToolType union (ΚΡΙΣΙΜΟ — αλλιώς tsc TS2353)**· ribbon `home-tab-draw.ts` buttons (νέα ομάδα «Πυρόσβεση» «Sprinkler»/«Στήλη Πυρόσβεσης», icon `bim-pipe` ή νέο fire icon).
- NEW `systems/recognition/recognizers/sprinkler-recognizer.ts` + register στο `mep-recognition.ts`.
- i18n el+en (tools + ribbon.commands.bim.mepSprinkler/mepFireRiser).

**Slice 1 — headless engine (ΕΚΤΟΣ ADR-040), `systems/mep-design/fire/`:**
- `fire-design-types.ts` (FireService='sprinkler'· FIRE_SERVICE_CLASSIFICATION· ProposedSegment/Network mirror water)· `fire-demand.ts` (`buildFireDemandModel`)· `fire-flow-standard.ts` (`FireDemandStandard` constant/K-factor)· `fire-sizing.ts` (`FireSizingStandard` flow→DN)· `fire-source-resolve.ts` (connector-driven fire-riser)· `fire-protection-discipline.ts` (descriptor)· `design-fire.ts` (REUSE `routeWallAware`+`wallObstacles`)· `index.ts`.
- MOD `registry/mep-discipline-registry.ts` (flip active + standard ids).
- Tests: `__tests__/fire-design.test.ts` (demand/sizing/source/orchestrator, mirror water-design.test).

**Slice 2 — preview/commit (STAGE ADR-040), `systems/mep-design/fire/`:**
- NEW `fire-proposal-store.ts` (low-freq, ⚠️ ADR-040 header, mirror water/hvac)· `commit/build-fire-commit.ts` (pure· **domain `'pipe'`** segments via `completeMepSegmentFromTwoClicks(...,'pipe',{classification:'fire-sprinkler',diameter})` flat @ sourceElevationMm + `buildDefaultPipeNetworkParams` MepSystem· members `pipeSegmentMembers` ∪ servedConnectors)· `hooks/tools/useFireProposalGhostPreview.ts` (⚠️ ADR-040· domain `'pipe'`· stroke SSoT `resolveSegmentClassificationColor('fire-sprinkler')`)· `components/dxf-layout/canvas-layer-stack-fire-proposal-ghost.tsx` leaf.
- NEW `ui/ribbon/hooks/useRibbonFireAutoBridge.ts` + `bridge/fire-auto-command-keys.ts` (Generate/Accept/Reject, mirror useRibbonWaterAutoSupplyBridge).
- **SHARED (⚠️ git diff ΠΡΩΤΑ — codex):** `canvas-layer-stack-leaves.tsx` (mount + STAGE ADR-040)· `useDxfBimBridges.ts` (+`fireAutoBridge = useRibbonFireAutoBridge(p)` + return· pattern hvacAutoBridge — ΧΩΡΙΣ νέο Props type)· `useDxfViewerRibbon.ts` (destructure + thread)· `useRibbonCommands.ts`(+`-types`) (import `isFireAutoActionKey` + prop + action branch + deps)· `home-tab-draw.ts` (submenu «Αυτόματη Πυρόσβεση» Generate/Accept/Reject)· `systems/events/drawing-event-map.ts` (3 events `bim:fire-generated/-empty/-committed`)· `hooks/useDxfViewerNotifications.ts` (3 toasts)· i18n el+en (`ribbon.commands.bim.fireAuto*` + `ribbon.commands.fire.networkName`/`service.sprinkler` + top-level `fire` toasts).
- Tests: `commit/__tests__/build-fire-commit.test.ts` (mirror build-hvac-commit/water test: pipe segments **ΜΕ** classification, 1 MepSystem/network, members, flat elevation, store).

---

## ✅ DEFINITION OF DONE
- jest πράσινο: νέα fire suites + zero regression σε ΟΛΑ τα `mep-design` + `recognition` + `mep-fixtures` suites.
- tsc --noEmit exit 0 (ΕΝΑΣ tsc, background, N.17).
- Browser smoke (αν ζητηθεί): στήλη πυρόσβεσης + 2-3 sprinkler heads → «Αυτόματη Πυρόσβεση → Generate» → κόκκινο ghost σωλήνων → Accept → πραγματικοί pipe segments + 1 pipe-network MepSystem (1 atomic undo).
- **N.15 docs:** ADR-433 NEW doc + ADR-423 changelog + ΕΚΚΡΕΜΟΤΗΤΕΣ + MEMORY.md (+ νέο `project_adr433_fire_protection.md`). **ΜΗΝ adr-index.**
- Λίστα δικών σου αρχείων + context indicator (N.9) + Google-level declaration (N.7.2). **ΜΗΝ commit** — άσε τον Giorgio.

---

## 🧩 ΚΑΤΑΣΤΑΣΗ ΠΟΥ ΚΛΗΡΟΝΟΜΕΙΣ (6 disciplines DONE)
- **Active:** water-supply, sanitary-drainage, heating, electrical-strong, electrical-weak, **hvac (μόλις, ADR-432 Slice 2 DONE)**. **Reserved:** fire-protection (ΕΣΥ), gas (8η, επόμενο).
- **Κοινός εγκέφαλος:** Stage 0 Recognition (ADR-425) + Routing Brain (ADR-429· A* wall-aware + supply/return pairing) + preview/commit layer (proposal-store + ghost + CompoundCommand) **shared verbatim και στις 6**.
- Η πυρόσβεση = ο **3ος καθαρά pressurised-pipe** consumer (μετά water + heating-2pipe) → mirror water 1:1, ελάχιστο ρίσκο.
- **ΜΗΝ commit· shared tree με codex.** Πρότυπα: ADR-426 (pipe pilot) + ADR-432 (φρέσκο foundation pattern).

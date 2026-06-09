# 🧠 HANDOFF — ADR-432 **HVAC / Αερισμός** Auto-Design (5η MEP discipline, child ADR-423): υλοποίηση

> **Σύνταξη:** Opus 4.8, 2026-06-09. **Στόχος νέας συνεδρίας:** η **5η MEP discipline — HVAC / Αερισμός auto-design** (αυτόματη δημιουργία δικτύου αεραγωγών: AHU → trunk-branch αεραγωγοί → στόμια προσαγωγής/επιστροφής, με duct sizing ASHRAE), **όπως Revit / MagiCAD / 4M FINE — FULL ENTERPRISE + FULL SSOT**. Είναι το κενό στη σειρά ADR-423 §6: *Ύδρευση→Αποχ→Θέρμ→Ηλεκτρ.ΙΣΧΥΡΑ→**HVAC**→Ηλεκτρ.ΑΣΘΕΝΗ(✅ ADR-431)→Πυρ→Αέριο*. Το προσπεράσαμε· τώρα το πιάνουμε.

---

## ⚠️ ΤΟ ΚΛΕΙΔΙ — ΤΟ HVAC ΕΙΝΑΙ PIPE-STYLE (ΠΑΡΑΓΕΙ SEGMENTS), ΟΧΙ ΣΑΝ ΤΟ ΗΛΕΚΤΡΟΛΟΓΙΚΟ (διάβασέ το ΠΡΩΤΟ)

**ΠΡΟΣΟΧΗ — αντίθετο από το ADR-430/431.** Το ηλεκτρολογικό (ισχυρό+ασθενές) παρήγαγε **λογικά κυκλώματα** (MepSystem, μηδέν geometry). Το **HVAC παράγει ΦΥΣΙΚΟΥΣ ΑΕΡΑΓΩΓΟΥΣ = `mep-segment` (domain `'duct'`)**, ακριβώς όπως ύδρευση/αποχέτευση/θέρμανση. Άρα:

- Η **σωστή οικογένεια προτύπων είναι οι PIPE disciplines** (`water`/`drainage`/`heating`), ΟΧΙ το electrical. Reuse: ο **shared trunk-branch router** `routeOrthogonalTrunkBranch` (+ A* wall-aware ADR-429) + το **segment-based preview/commit** (`*-proposal-store` + `build-*-commit` με `completeMepSegmentFromTwoClicks` + segment ghost + ribbon bridge). ΟΧΙ ο circuit/wire core του ηλεκτρολογικού.
- Η μηχανή = Demand (air-flow) → Source resolve (AHU) → Routing (αεραγωγοί δέντρο) → **Duct Sizing (ASHRAE, αfloat→διατομή)**. Το `flowModel` στο registry είναι ήδη **`'air'`**.
- **Η ΓΕΝΙΚΕΥΣΗ (Boy-Scout N.0.2):** μην κάνεις copy-paste τον water engine. Δες αν ο `routeOrthogonalTrunkBranch` + το segment commit/proposal layer είναι ΗΔΗ discipline-agnostic (το ADR-427/428 τα γενίκευσαν: `routing/orthogonal-router.ts`, `MepDisciplineRegistry`)· το HVAC = νέος consumer με δικό του discipline descriptor (duct demand + ASHRAE sizing + air classifications). Η γνήσια νέα μηχανική: **duct sizing** (equal-friction / velocity) + **air-flow demand** + στόμια/AHU.

**Η ΓΝΗΣΙΑ ΔΙΑΦΟΡΑ HVAC vs PIPE (το νέο):**
1. **Μέσο = αέρας** (m³/h ή L/s), domain `'duct'` (ΥΠΑΡΧΕΙ από καπναγωγό ADR-408)· classifications `supply-air`/`return-air` (το enum `DuctSystemClassification='exhaust'` έχει comment «future HVAC append supply-air/return-air **without a type change**» → απλά πρόσθεσέ τα).
2. **Sizing = duct διατομή** (ΟΧΙ DN νερού/breaker): ASHRAE **equal-friction** (~0.8–1.0 Pa/m σταθερό) ή **velocity method** (όρια ταχύτητας ανά χρήση)· σωρευτικό air-flow → round Ø (ή rect W×H). Pluggable standard.
3. **Πηγή = AHU / FCU** (όχι λέβητας/πίνακας)· **τερματικά = στόμια/diffusers** (νέο fixture kind με duct connector).

---

## ⚠️ ΚΑΝΟΝΕΣ (αμετάβλητοι — πάγια εντολή Giorgio)
- **Ελληνικά** όλες οι απαντήσεις (LANGUAGE RULE CLAUDE.md).
- **FULL ENTERPRISE + FULL SSOT «όπως Revit / MagiCAD / 4M FINE»** — μηδέν `any`/`as any`/`@ts-ignore`, αρχεία ≤500 γρ., functions ≤40 γρ. ΠΑΝΤΑ Grep/Glob για υπάρχον πριν γράψεις (extend/γενίκευσε, ΜΗΝ duplicate).
- **SHARED working tree** με άλλον agent (codex). `git add` **ΜΟΝΟ δικά σου** αρχεία, **ΠΟΤΕ** `git add -A`. ΠΑΝΤΑ `git status` + `git diff <file>` πριν αγγίξεις shared αρχείο.
- **COMMIT/PUSH τον κάνει ΜΟΝΟ ο Giorgio** (N.(-1)). Εσύ ΔΕΝ κάνεις commit/push, ΟΥΤΕ `--no-verify`. **ΜΗΝ αγγίξεις adr-index** (shared tree).
- **N.8 Execution mode:** 5+ αρχεία / 2+ domains → Orchestrator-scale. **ΞΕΚΙΝΑ ΜΕ Plan Mode** (child-ADR ADR-432), παρουσίασε πλάνο, πάρε έγκριση πριν υλοποιήσεις. **ΠΑΡΕ ΕΣΥ τις Revit αποφάσεις** (μνήμη «make Revit-grade decisions yourself»), ζήτα μόνο έγκριση plan.
- **N.14 Model:** Opus (αρχιτεκτονικό/cross-cutting).
- **N.17:** ΕΝΑΣ tsc τη φορά — έλεγξε με ps1 αρχείο (`Get-CimInstance Win32_Process`, το bash τρώει το `$_`) ότι δεν τρέχει άλλος tsc· τρέξε ΕΝΑΝ στο background, μην μπλοκάρεις. Ο Bash tool τρέχει **/usr/bin/bash** (ΟΧΙ PowerShell) — για cmdlets χρησιμοποίησε `powershell -File <ps1>`.
- **N.11 i18n:** ΚΑΘΕ νέο user-facing string → ΠΡΩΤΑ key σε `el/*.json` ΚΑΙ `en/*.json`. ΟΧΙ hardcoded.
- **ADR-040:** Slice 1 (headless) = **ΕΚΤΟΣ**. Slice 2 (ghost στο `canvas-layer-stack-leaves.tsx`) = **STAGE ADR-040** (CHECK 6B/6D).
- **N.15:** μετά υλοποίηση → ADR-432 (NEW doc) + ADR-423 changelog + registry flip (`hvac` reserved→active) + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + μνήμη `MEMORY.md`. **ΜΗΝ adr-index** (shared tree).
- **N.6 Enterprise IDs:** αν δημιουργείς νέα source entity (AHU), νέο prefix + generator στο `enterprise-id.service` (mirror boiler/water-heater).

---

## 0) ΚΑΤΑΣΤΑΣΗ — ΤΙ ΥΠΑΡΧΕΙ ΗΔΗ (code = SoT)

| Συστατικό | Αρχείο | Reuse / Gap |
|---|---|---|
| **duct domain** (connector) | `bim/types/mep-connector-types.ts`: `MepConnectorDomain` έχει `'duct'`· `DuctSystemClassification='exhaust'`· `MepDuctConnectorParams{systemClassification,diameterMm}`· `.duct` branch στο MepConnector | 🟢 ΥΠΑΡΧΕΙ (από καπναγωγό λέβητα ADR-408)· 🔴 GAP: πρόσθεσε `supply-air`/`return-air` στο enum (comment το προβλέπει ρητά) |
| **PIPE engine (router + segment commit)** | `systems/mep-design/{water,drainage,heating}/design-*.ts` + `routing/orthogonal-router.ts` (`routeOrthogonalTrunkBranch`) + `routing/route-wall-aware.ts` (A*) + `MepDisciplineRegistry` | 🟢 ΓΕΝΙΚΕΥΣΕ→HVAC = νέος consumer (duct descriptor)· segment commit `completeMepSegmentFromTwoClicks` reuse |
| **Slice-2 preview/commit (segment-style)** | water/drainage/heating: `*-proposal-store` + `build-*-commit` + `*ProposalGhostPreview` + `canvas-layer-stack-*-proposal-ghost` + `useRibbon*AutoBridge` | 🟢 REUSE pattern (HVAC μιμείται· segments αντί κυκλωμάτων· ghost χρώμα αέρα) |
| **mep-segment duct drawing** | `bim/types/mep-segment-types.ts` (domain 'pipe'/'duct')· `mep-segment-tool`/`mep-duct` tool ΥΠΑΡΧΕΙ (`tool-definitions.ts` 'mep-duct') | 🟡 VERIFY: υποστηρίζει duct segment sizing/render· τι DN-equivalent κρατά ο duct segment |
| **registry slot `hvac`** reserved | `systems/mep-design/registry/mep-discipline-registry.ts` (~97, `flowModel:'air'`, classifications:[], status:'reserved') | 🟢 flip→active + standard ids |
| **AHU / FCU πηγή** | — | 🔴 GAP: NEW source entity «ahu» (mirror boiler/water-heater point-based source· connector duct flow:out supply-air) ή reuse — απόφασε στο Plan |
| **στόμια / diffusers τερματικά** | — | 🔴 GAP: NEW mep-fixture kind 'air-terminal' (diffuser/grille· duct connector flow:in supply-air / flow:out return-air)· mirror socket/data-outlet pipeline |
| **duct sizing (ASHRAE) + air-flow demand** | — | 🔴 GAP ΤΟΤΑΛ: NEW hvac demand (air-flow ανά στόμιο/χώρο) + sizing (equal-friction/velocity → διατομή) |
| **HVAC recognizer** | `systems/recognition/recognizers/` | 🔴 GAP: NEW air-terminal recognizer (mirror electrical/sanitary)· source recognizer για AHU |

---

## 1) ΑΡΧΙΤΕΚΤΟΝΙΚΗ (Revit-grade)

```
RecognitionModel ─▶ Source resolve (AHU) ─▶ Demand (air-flow m³/h ανά στόμιο/χώρο)
   ─▶ Routing (shared trunk-branch + A* — δέντρο αεραγωγών από AHU)
   ─▶ Duct Sizing (ASHRAE equal-friction: σωρευτικό flow → διατομή) ─▶ DuctNetworkProposal { segments }
   ─▶ (supply + return = 2 δίκτυα, mirror heating supply/return· pairing optional)
```

Όπως οι pipe disciplines, αλλά: medium=αέρας, sizing=duct διατομή (ASHRAE), source=AHU, terminals=στόμια. Το preview/commit είναι segment-style (ΟΧΙ circuit).

---

## 2) ΟΙ ΑΠΟΦΑΣΕΙΣ (Revit-grade — πάρ' τες ΕΣΥ, lock στο plan)
1. **Πρότυπο:** ASHRAE Fundamentals — **equal-friction** (σταθερό ~0.8–1.0 Pa/m· pluggable) ή **velocity method** (όρια ταχύτητας ανά χρήση main/branch). Πρότεινε equal-friction pilot.
2. **v1 scope:** **προσαγωγή (supply-air)** δίκτυο από AHU σε στόμια· return-air = 2ο δίκτυο (mirror heating supply/return) ή επόμενο slice — απόφασε.
3. **Πηγή:** NEW `ahu` source entity (mirror boiler point-based: connector duct flow:out supply-air) **ή** reuse — κρίνε κόστος (boiler/water-heater pipeline = πρότυπο).
4. **Τερματικά v1:** NEW mep-fixture kind **`air-terminal`** (diffuser προσαγωγής, duct connector flow:in supply-air· grille επιστροφής flow:out return-air)· mirror socket/data-outlet 1:1 (kind/connector/seed/symbol/3D/tool/schema/i18n).
5. **Demand:** air-flow ανά στόμιο (σταθερό π.χ. 150 m³/h) **ή** per-space (εμβαδόν × ACH/ρυθμό αερισμού ASHRAE 62.1) — απόφασε· pluggable. Πρότεινε per-terminal pilot.
6. **Sizing:** equal-friction → round Ø (ή rect W×H· pilot round)· σωρευτικό flow στο trunk· όρια ταχύτητας advisory. Pluggable `HVAC_SIZING_STANDARD`.
7. **Classifications:** πρόσθεσε `'supply-air'`+`'return-air'` στο `DuctSystemClassification` (το enum comment το προβλέπει· regression-free — μόνο ο flue χρησιμοποιεί 'exhaust', δες exhaustive switches).
8. **Output/commit:** Ν duct `mep-segment` (domain 'duct') + MepSystem (duct network)· reuse `completeMepSegmentFromTwoClicks` + atomic `CompoundCommand`. Ghost χρώμα αέρα (SSoT `resolveSegmentClassificationColor` — πρόσθεσε supply-air/return-air χρώματα).

---

## 3) SLICING (πρόταση — κλείδωσε στο plan)
- **Slice 0 — foundation (ΕΚΤΟΣ ADR-040):** classifications supply-air/return-air στο enum + connector builders (`buildDefaultSupplyAirConnector` κ.λπ.)· NEW `air-terminal` fixture kind (mirror socket pipeline)· NEW `ahu` source entity (ή reuse decision)· air-terminal + AHU recognizers. Tests.
- **Slice 1 — headless engine (ΕΚΤΟΣ ADR-040):** **REUSE/ΓΕΝΙΚΕΥΣΕ** το pipe routing + segment pipeline· NEW `systems/mep-design/hvac/` (hvac-demand air-flow + hvac-discipline ASHRAE + design-hvac orchestrator που καλεί τον shared router + duct sizing)· **registry flip→active.** Tests (demand/sizing/routing/integration). ΜΗΝ adr-index.
- **Slice 2 — preview/commit (STAGE ADR-040):** mirror pipe Slice 2 — hvac proposal-store + build-hvac-commit (duct segments) + ghost (χρώμα αέρα) + ribbon «Αυτόματος Αερισμός / HVAC» Generate/Accept/Reject + i18n el+en + toasts. Tests.

**Σειρά:** Plan Mode (ADR-432) → έγκριση → Slice 0 → Slice 1 (jest πράσινο) → Slice 2 → N.15.

---

## 4) ΤΙ ΝΑ ΜΗΝ ΣΠΑΣΕΙΣ (regression invariants)
- **Pipe disciplines (water/drainage/heating)** + **electrical (strong/weak)** + **shared recognition** ΑΝΕΓΓΙΧΤΑ functionally. Αν γενικεύσεις τον router/segment commit → zero-regression (delegate-style, byte-identical όπου δεν υπάρχουν αλλαγές).
- **Καπναγωγός λέβητα (flue, 'exhaust' duct connector)** ΑΝΕΓΓΙΧΤΟΣ — αν επεκτείνεις `DuctSystemClassification`, βρες όλους τους exhaustive switches/guards (discriminated unions → compiler δείχνει).
- ΜΗΝ `git add -A`· ΜΗΝ commit/push/adr-index/`--no-verify`· ΜΗΝ 2ο tsc· κάθε string → i18n el+en.

---

## 5) ΠΡΩΤΗ ΕΝΕΡΓΕΙΑ (νέα session, Opus, Plan Mode)
1. Διάβασε αυτό + (code=SoT): **ένα ολόκληρο pipe discipline ως πρότυπο** — `systems/mep-design/heating/` (design-heating + discipline + demand + proposal-store + commit) ή `water/` (πιο απλό supply-only)· `routing/orthogonal-router.ts` (`routeOrthogonalTrunkBranch`) + `route-wall-aware.ts`· `mep-discipline-registry.ts` (hvac slot)· `bim/types/mep-connector-types.ts` (duct domain + flue builder ως πρότυπο connector)· `bim/mep-fixtures/socket-symbol-spec.ts`/`data-outlet-symbol-spec.ts` (terminal πρότυπο)· `bim/mep-boilers/` (point-based source πρότυπο για AHU)· `mep-segment-types.ts` (duct segment support). Μνήμη `[[project_adr431_electrical_weak_auto_design]]` `[[project_adr428_heating_auto_design]]` `[[project_adr423_mep_auto_design]]`.
2. **Plan Mode**: child-ADR ADR-432 (verify next-free· πιθανώς 432). Κλείδωσε τις §2 αποφάσεις (πάρ' τες ΕΣΥ Revit-grade), ΑΠΟΦΑΣΙΣΕ source (AHU vs reuse) + sizing method (equal-friction) + engine reuse strategy, παρουσίασε slice plan, πάρε έγκριση.
3. Υλοποίηση Slice 0→1→2. jest πράσινο σε κάθε slice.
4. N.15 (ADR-432 NEW + ADR-423 changelog + registry flip + ΕΚΚΡΕΜΟΤΗΤΕΣ + μνήμη). **ΜΗΝ commit** — άσε τον Giorgio. Δώσε λίστα δικών σου αρχείων + context indicator (N.9) + Google-level declaration (N.7.2).

---

## 6) ΣΥΝΟΨΗ ΟΛΟΚΛΗΡΩΜΕΝΟΥ ADR-431 (Ηλεκτρ. ΑΣΘΕΝΗ — context για συνέχεια)
Ηλεκτρ. ΑΣΘΕΝΗ Slices 0+1+2 DONE 2026-06-09 (Opus): Boy-Scout ΓΕΝΙΚΕΥΣΗ του strong engine σε `circuit-grouping-core.ts` (generic over service S + rule R)· weak=2ος consumer (comms-rack=NEW ElectricalPanelKind· data-outlet kind· 90m channel/24-port· reuse proposal-store/ghost· «Αυτόματα Ασθενή»). 59 electrical jest + tsc 0 πράσινα. ΕΚΤΟΣ ADR-040 (0+1)· Slice2 STAGE ADR-040. 🔴 ΕΚΚΡΕΜΕΙ: browser-verify + commit (Giorgio). ADR-431 doc + ADR-423 changelog + ΕΚΚΡΕΜΟΤΗΤΕΣ + MEMORY.md ✅. **ΜΗΝ adr-index.**

(Εναλλακτικά deferred αν ο Giorgio το αλλάξει: Panel/Comms Schedule + single-line· physical conduit/cable-tray· Πυρόσβεση 7η· Αέριο 8η.)

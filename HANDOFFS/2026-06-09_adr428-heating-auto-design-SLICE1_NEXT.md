# 🧠 HANDOFF — ADR-428 Heating (Hydronic) Auto-Design **Slice 1** (headless engine): PLAN MODE → υλοποίηση

> **Σύνταξη:** Opus 4.8, 2026-06-09. **Στόχος νέας συνεδρίας:** η **3η discipline** του ADR-423 MEP Auto-Design = **Θέρμανση (κλειστό υδρονικό κύκλωμα)**. Ξεκινάς από το **Slice 1 (headless engine)**: από αναγνωρισμένο όροφο → `HeatingNetworkProposal` (pure data), όπως ακριβώς έγιναν ύδρευση (ADR-426) και αποχέτευση (ADR-427). **Καμία UI/canvas σε αυτό το slice** (το preview+commit = Slice 2 μετά).
>
> **Η μεγάλη ιδέα (FULL SSOT):** η θέρμανση είναι **2-pipe closed loop** — αλλά **δεν χρειάζεται νέα μηχανή routing**. Το **supply** (λέβητας→σώματα, φθίνουσα Ø) είναι **ακριβώς το engine της ύδρευσης**· το **return** (σώματα→λέβητας, αύξουσα Ø προς τη ρίζα) είναι **ακριβώς το engine της αποχέτευσης**. Ο λέβητας είναι ΚΑΙ source (supply out) ΚΑΙ sink (return in). Το μόνο γνήσια νέο: (α) demand από θερμικό φορτίο, (β) heating terminal recognizer, (γ) sizing flow→DN, (δ) orchestrator που βγάζει 2 networks.

---

## ⚠️ ΚΑΝΟΝΕΣ (αμετάβλητοι — πάγια εντολή Giorgio)
- **Ελληνικά** όλες οι απαντήσεις (LANGUAGE RULE CLAUDE.md).
- **FULL ENTERPRISE + FULL SSOT, «όπως οι μεγάλοι παίχτες / η Revit / MagiCAD / 4M FINE»** — μηδέν `any`/`as any`/`@ts-ignore`, αρχεία ≤500 γρ., functions ≤40 γρ., semantic HTML, no inline styles.
- **SHARED working tree** με άλλον agent (codex). `git add` **ΜΟΝΟ δικά σου** αρχεία, **ΠΟΤΕ** `git add -A`.
- **COMMIT/PUSH τον κάνει ΜΟΝΟ ο Giorgio** (N.(-1)). Εσύ ΔΕΝ κάνεις commit/push. **ΜΗΝ αγγίξεις adr-index** (shared tree — εκκρεμεί ήδη για 423/424/425/426/427).
- **Plan Mode πρώτα.** Πάρε ΕΣΥ τις Revit/SSOT αποφάσεις (μην ρωτάς τετριμμένα)· ζήτα μόνο έγκριση plan + slicing.
- **N.17:** ΕΝΑΣ tsc τη φορά — έλεγξε ότι δεν τρέχει ήδη άλλος (ο codex τρέχει συχνά tsc· περίμενε, μην τον σκοτώσεις). PowerShell process-check: `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | ? { $_.CommandLine -like '*tsc*' }`.
- **N.11 i18n:** Slice 1 είναι headless → ΜΗΔΕΝ i18n (τα strings έρχονται στο Slice 2). Τυχόν warnings = `logger`/comments, όχι UI.
- **N.15:** μετά υλοποίηση → ΝΕΟ ADR-428 doc + ADR-423 changelog + μνήμη + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (ο Giorgio committάρει).
- **ADR-040:** Slice 1 είναι **transient/headless** → **ΕΚΤΟΣ ADR-040** (καμία canvas/store αλλαγή· το ghost mount έρχεται στο Slice 2).
- **Επόμενος ελεύθερος ADR = 428.** Child του ADR-423 (όπως 426/427).

---

## 0) ΚΑΤΑΣΤΑΣΗ — ΤΙ ΕΙΝΑΙ ΗΔΗ ΕΤΟΙΜΟ (reuse, μην το ξαναχτίσεις)

**🟢 Stage 0 Recognition (ADR-425)** — `systems/recognition/`. Agnostic kernel + registry.
- `registerMepRecognition()` (`recognizers/mep-recognition.ts`) δηλώνει σήμερα: `sanitaryTerminalRecognizer` + `mepSourceRecognizer` + `sanitarySpaceClassifier`. **Ο λέβητας ΑΝΑΓΝΩΡΙΖΕΤΑΙ ΗΔΗ ως source** (`mep-source-recognizer.ts`: `isMepBoilerEntity → 'boiler'`).
- ❗ **Λείπει heating terminal recognizer** (σώματα/ενδοδαπέδια). Θα φτιάξεις `heating-terminal-recognizer.ts` (mirror 1:1 του `sanitary-terminal-recognizer.ts`) και θα το προσθέσεις στο `registerMepRecognition()` recognizers array.

**🟢 ADR-426 ύδρευση = ΤΟ ΠΡΟΤΥΠΟ ΓΙΑ ΤΟ SUPPLY** — `systems/mep-design/water/` (διάβασέ τα ΟΛΑ):
- `design-water-supply.ts` (orchestrator), `water-design-types.ts`, `water-demand.ts`, `water-source-resolve.ts` (← το `resolveWaterSource(entities, classification)` είναι **classification-generic** και ο λέβητας είναι ήδη `isWaterSourceHost` → `resolveWaterSource(entities, 'hydronic-supply')` δουλεύει ΧΩΡΙΣ αλλαγή), `water-sizing.ts`, `index.ts`.

**🟢 ADR-427 αποχέτευση = ΤΟ ΠΡΟΤΥΠΟ ΓΙΑ ΤΟ RETURN** — `systems/mep-design/drainage/`:
- `design-drainage.ts`, `outfall-resolve.ts` (← collector-rooted, αύξουσα Ø· το return του λέβητα είναι ο «collector»), `gravity-router.ts`, `slope-assignment.ts` (⚠️ **το return ΔΕΝ έχει slope** — closed loop υπό πίεση, όχι gravity· χρησιμοποίησε μόνο το routing+sizing, ΟΧΙ το slope).

**🟢 Shared engine (γεννήθηκε από drainage)** — `systems/mep-design/`:
- `routing/orthogonal-router.ts` — `routeOrthogonalTrunkBranch(root, targets, ...)` + `RouteTarget {point, loadingUnits, minBranchDiameterMm?}`. Σωρευτικό loading→διαμέτρους. **ΑΥΤΟΥΣΙΟ και για τα δύο heating networks** (το `loadingUnits` γίνεται «flow proxy»).
- `shared/connector-resolve.ts` — `resolveConnectorWorldPoint`.
- `registry/mep-discipline-registry.ts` — **2 active + 6 reserved**· η **heating** είναι ένα από τα reserved slots → θα το κάνεις active (descriptor με demand/sizing standards, όπως water/drainage).

**🟢 ADR-422 Θερμικό φορτίο (L1–L4) = Η ΠΗΓΗ ΤΟΥ DEMAND** — `bim/thermal/`:
- `heat-load/derive-space-heat-loads.ts` → per-space `Φ` (W) + building total. `heat-load-engine.ts` (pure EN12831-style).
- `heating-equipment-sizing.ts` (L2 — απαιτούμενο vs εγκατεστημένο).
- ⚠️ **ΠΡΟΣΟΧΗ μονάδες/inputs:** το `deriveSpaceHeatLoads` θέλει `SpaceHeatLoadDeriveInputs` (walls/openings/exteriorWallIds/storeyPosition/outdoorTempC/tol) που σήμερα τα παράγει το **React hook `useHeatLoadInputs`**. Για headless engine πρέπει να αποφασίσεις (Plan Mode): είτε (Α) demand από τα **`thermalOutputW` των ίδιων των σωμάτων** (απλό, self-contained, δεν χρειάζεται heat-load inputs — προτεινόμενο για Slice 1), είτε (Β) πέρασμα των heat-load inputs μέσα στο engine. **Σύσταση: (Α)** — ο όρος demand ανά τερματικό = το `thermalOutputW` του σώματος (η L2 διαστασιολόγηση το έχει ήδη κάνει πραγματικό).

**🟢 Τα MEP primitives ΛΕΙΤΟΥΡΓΟΥΝ** (ADR-408 Εύρος Β):
- **Σώμα/καλοριφέρ** (`mep-radiator`): FIXED connectors `buildRadiatorConnectors` → supply inlet (`flow:'in'`, `hydronic-supply`) + return outlet (`flow:'out'`, `hydronic-return`)· `params.thermalOutputW`, `params.connectorDiameterMm`. Guard `isMepRadiatorEntity`.
- **Ενδοδαπέδια** (`mep-underfloor`): 2 connectors hydronic supply+return (σαν καλοριφέρ). Guard `isMepUnderfloorEntity`.
- **Λέβητας** (`mep-boiler`): hydronic-supply out + hydronic-return in (combi: +DHW connectors — αγνόησέ τα εδώ, μόνο τα hydronic). Guard `isMepBoilerEntity`.

---

## 1) ΤΙ ΘΑ ΦΤΙΑΞΕΙΣ (Slice 1 = headless heating engine)

**ΑΡΧΙΤΕΚΤΟΝΙΚΗ (Revit «Heating Loads → Equipment → Distribution»):** `RecognitionModel → Demand(Φ→mass-flow→l/s) → Source+Sink resolve (boiler supply-out + return-in) → Routing ×2 (supply=water-mode φθίνον, return=drainage-mode αύξον) → Sizing (flow→DN) → HeatingNetworkProposal { networks: [supply, return] }`.

**NEW αρχεία (δικά σου — git add ΜΟΝΟ αυτά):** `systems/mep-design/heating/`
| Αρχείο | Ρόλος (πρότυπο) |
|---|---|
| `heating-design-types.ts` | `HeatingNetworkProposal`, `ProposedHeatingNetwork` (×2: hydronic-supply/return), `ProposedHeatingSegment` (classification, diameterMm, cumulativeFlowLps, role). Mirror water/drainage design-types. **ΟΧΙ slope** (closed loop). |
| `heating-demand.ts` | per-radiator `thermalOutputW → mass flow → l/s` (Q = m·c·ΔT· νερό c=4187 J/kgK· ΔT σωμάτων ~20K· υπολόγισε l/s). Mirror `water-demand.ts`/`drainage-demand.ts`. |
| `heating-source-resolve.ts` | boiler supply-out (`resolveWaterSource(entities,'hydronic-supply')` reuse ή thin wrapper) + boiler return-in (mirror `outfall-resolve` αλλά flow:'in' hydronic-return). |
| `heating-sizing.ts` | ΣflowLps → DN (πίνακας velocity-based, π.χ. ≤0.5 m/s· LOCKED Revit-grade). Mirror `water-sizing.ts`. |
| `heating-discipline.ts` | descriptor (demand/sizing standards) — όπως `water-supply-discipline.ts`/`drainage-discipline.ts`. |
| `design-heating.ts` | orchestrator → `HeatingNetworkProposal` με 2 networks (supply via water-mode router, return via drainage-mode router root=λέβητας-return). Mirror `design-drainage.ts`. |
| `index.ts` | barrel. |
| `__tests__/heating-design.test.ts` + `heating-design.integration.test.ts` | demand (W→l/s), supply diminishing Ø, return growing Ø προς λέβητα, 2 networks, classifications σωστά. Mirror drainage tests. |

**NEW recognizer:** `systems/recognition/recognizers/heating-terminal-recognizer.ts` (mirror `sanitary-terminal-recognizer.ts`· narrow σε `isMepRadiatorEntity || isMepUnderfloorEntity`· διάβασε hydronic connectors· προαιρετικά heating space classifier).

**MOD shared (additive, ΜΟΝΟ δικές σου γραμμές):**
- `systems/recognition/recognizers/mep-recognition.ts` — πρόσθεσε `heatingTerminalRecognizer` στο recognizers array.
- `registry/mep-discipline-registry.ts` — κάνε active το heating reserved slot.

---

## 2) ΟΙ ΑΠΟΦΑΣΕΙΣ ΠΟΥ ΠΡΕΠΕΙ ΝΑ ΠΑΡΕΙΣ ΣΤΟ PLAN MODE (πάρ' τες ΕΣΥ, Revit-grade)
1. **Demand basis:** σύσταση (Α) `thermalOutputW` ανά σώμα (self-contained). Επιβεβαίωσε με code-read ότι τα radiators έχουν `thermalOutputW` set μετά την L2.
2. **ΔΤ σχεδιασμού:** 70/50 (ΔΤ=20K) Revit default — LOCK το στο discipline descriptor (pluggable).
3. **Sizing:** velocity-based DN (max velocity ~1.0 m/s για κεντρικούς, ~0.5 για κλάδους) ή σταθερό pressure-drop. Διάλεξε velocity-based v1 (απλό, standard).
4. **Closed-loop topology v1:** supply & return ως **2 ανεξάρτητα routed networks** (honest pilot — όπως cold/hot στην ύδρευση)· **true parallel pairing (offset runs) = επόμενο slice**. Δήλωσέ το ως deferred.
5. **Underfloor:** v1 → χειρισμός σαν σημειακό τερματικό (manifold-fed)· η σερπαντίνα γεωμετρία υπάρχει ήδη (ADR-408 underfloor) — μην την ξαναϋπολογίσεις.

---

## 3) ΤΙ ΝΑ ΜΗΝ ΚΑΝΕΙΣ
- ΜΗ γράψεις κώδικα πριν την έγκριση του plan.
- ΜΗΝ ξαναγγίξεις τα engines ύδρευσης/αποχέτευσης (κράτα 14 drainage + 15 water tests πράσινα)· κάνε **reuse**, όχι fork. Αν χρειαστεί γενίκευση shared helper → behaviour-preserving (όπως έκανε η drainage με τον router).
- ΜΗΝ βάλεις slope στο return (closed loop, όχι gravity).
- ΜΗΝ φτιάξεις νέο router/connector-resolver — υπάρχουν.
- ΜΗΝ αγγίξεις canvas/store/ribbon (Slice 1 = headless· αυτά είναι Slice 2).
- ΜΗΝ commit/push/adr-index. ΜΗΝ `git add -A`. ΜΗΝ `--no-verify`. ΜΗΝ 2ο tsc (N.17).

## 4) ΠΡΩΤΗ ΕΝΕΡΓΕΙΑ (νέα session, Opus)
1. Διάβασε αυτό το handoff + ADR-423 (umbrella, §6 roadmap + §2.1 taxonomy heating slots) + μνήμη [[project_adr423_mep_auto_design]] [[project_adr427_drainage_auto_design]] [[project_adr426_water_supply_auto_design]] [[project_adr422_thermal_space]].
2. Διάβασε ΟΛΑ τα water + drainage design αρχεία (§0) — τα δύο πρότυπα.
3. Επιβεβαίωσε signatures: `resolveWaterSource(entities,'hydronic-supply')`, `resolveDrainageOutfall`-pattern για return, `routeOrthogonalTrunkBranch` + `RouteTarget`, `buildRadiatorConnectors` classifications, `isMepRadiatorEntity/isMepUnderfloorEntity/isMepBoilerEntity`, `RecognitionModel`/`recognizeSceneFromRegistry`, `params.thermalOutputW`.
4. **Plan Mode** → plan (8 NEW heating files + 1 NEW recognizer + 2 MOD shared· demand basis· velocity sizing· 2-network closed loop· deferred parallel pairing) + ζήτα έγκριση.
5. Μετά έγκριση → υλοποίηση → `npx jest "systems/mep-design/heating"` (νέα) + `npx jest "systems/mep-design/water"` + `"systems/mep-design/drainage"` + `"systems/recognition"` (regression). tsc background (N.17 guard). N.15 updates.

## 5) ΜΕΤΑ ΑΠΟ ΑΥΤΟ
- **Heating Slice 2** = preview + commit (mirror water/drainage Slice 2: proposal-store + κόκκινο/μπλε ghost από SSOT `resolveSegmentClassificationColor('hydronic-supply'|'hydronic-return')` + ribbon «Αυτόματη Θέρμανση» → atomic CompoundCommand· **ΕΝΤΟΣ ADR-040**).
- **Heating Slice 3** = true parallel supply/return pairing (offset runs).
- Παράλληλα/αργότερα: **A\* wall-aware router** (Slice 3 κοινό ΟΛΩΝ των disciplines).
- Επόμενη discipline κατά σειρά (ADR-423 §6): **Ηλεκτρολογικά ΙΣΧΥΡΑ**.

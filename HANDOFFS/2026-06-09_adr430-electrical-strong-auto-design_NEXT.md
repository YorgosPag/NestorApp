# 🧠 HANDOFF — ADR-430 **Ηλεκτρολογικά ΙΣΧΥΡΑ Auto-Design** (4η discipline, child ADR-423): υλοποίηση

> **Σύνταξη:** Opus 4.8, 2026-06-09. **Στόχος νέας συνεδρίας:** η **4η MEP discipline — Electrical STRONG-current auto-design** (αυτόματη δημιουργία κυκλωμάτων φωτισμού + ρευματοδοτών από αναγνωρισμένα φωτιστικά/πρίζες + πίνακα), **όπως Revit/MagiCAD/4M FINE — FULL ENTERPRISE + FULL SSOT**. Είναι το επόμενο βήμα στη σειρά ADR-423 §6: *Ύδρευση→Αποχέτευση→Θέρμανση→**Ηλεκτρ. ΙΣΧΥΡΑ**→HVAC→Ασθενή→Πυρ→Αέριο*.

---

## ⚠️ ΚΡΙΣΙΜΗ ΔΙΑΦΟΡΑ — ΤΟ ΗΛΕΚΤΡΟΛΟΓΙΚΟ ΔΕΝ ΕΙΝΑΙ pipe discipline (διάβασέ το ΠΡΩΤΟ)

Τα 3 προηγούμενα disciplines (ύδρευση/αποχέτευση/θέρμανση) παράγουν **φυσικά `mep-segment`s** μέσω trunk-branch router + A* + pairing. **ΤΟ ΗΛΕΚΤΡΟΛΟΓΙΚΟ ΟΧΙ.**

- Η καλωδίωση στο app είναι **ΛΟΓΙΚΗ / DERIVED** — το κύκλωμα αποθηκεύει `sourceEntityId` + `members[]`, και η γραμμή του καλωδίου **παράγεται στο render** από `computeCircuitWirePaths` (ΠΟΤΕ δεν persist-άρεται γεωμετρία). Δεν υπάρχουν conduit/cable-tray geometry objects.
- **Άρα: το output του electrical auto-design ΔΕΝ είναι segments — είναι Ν κυκλώματα (`MepElectricalSystemParams` / MepSystem entities) με members.** Τα καλώδια ζωγραφίζονται ΔΩΡΕΑΝ από το υπάρχον render path.
- **Ο A\* router + ο pairing core ΔΕΝ είναι η μηχανή εδώ** (είναι για φυσική γεωμετρία σωλήνων). Γίνονται relevant ΜΟΝΟ αν αργότερα μοντελοποιήσουμε φυσικό cable-tray/conduit (όχι v1).
- **Ο πραγματικός «εγκέφαλος» του ηλεκτρολογικού = CIRCUIT-GROUPING + SIZING** (ομαδοποίηση φορτίων σε κυκλώματα με όρια ασφάλειας/σημείων + phase balance + διατομή αγωγού + πτώση τάσης). Αυτό είναι **εξ ολοκλήρου νέο** (καμία ηλεκτρολογική sizing/demand δεν υπάρχει στον κώδικα — confirmed code sweep).

**Τι ΟΝΤΩΣ είναι έτοιμο (ο reusable «εγκέφαλος» για το ηλεκτρολογικό):**
1. **Stage 0 Recognition** — ο `mepSourceRecognizer` **ΗΔΗ αναγνωρίζει τον πίνακα** ως `RecognizedSource` (`sourceKind:'panel'`). Λείπει terminal recognizer για φωτιστικά/πρίζες.
2. **Discipline Registry** — slot `'electrical-strong'` (status `'reserved'`, `flowModel:'electrical'`) έτοιμο να γίνει `active`.
3. **Preview/Commit Slice-2 pattern** — ribbon Generate/Accept/Reject + low-freq proposal store + ghost + atomic `CompoundCommand` (κοινό και στα 3 disciplines· το ηλεκτρολογικό το μιμείται ΑΛΛΑ commit-άρει κυκλώματα αντί segments).
4. **Circuit model + wire rendering** — `MepElectricalSystemParams` + `computeCircuitWirePaths` + `HomeRunWiresOverlay` + 3D wire sync **ΗΔΗ δουλεύουν** (manual circuit-from-selection). Το auto-design απλώς δημιουργεί τα κυκλώματα· τα καλώδια render-άρονται μόνα τους.

---

## ⚠️ ΚΑΝΟΝΕΣ (αμετάβλητοι — πάγια εντολή Giorgio)
- **Ελληνικά** όλες οι απαντήσεις (LANGUAGE RULE CLAUDE.md).
- **FULL ENTERPRISE + FULL SSOT, «όπως οι μεγάλοι παίχτες / Revit / MagiCAD / 4M FINE»** — μηδέν `any`/`as any`/`@ts-ignore`, αρχεία ≤500 γρ., functions ≤40 γρ. ΠΑΝΤΑ Grep/Glob για υπάρχον πριν γράψεις (extend, μην duplicate).
- **SHARED working tree** με άλλον agent (codex/boiler). `git add` **ΜΟΝΟ δικά σου** αρχεία, **ΠΟΤΕ** `git add -A`. ΠΑΝΤΑ `git status` + `git diff <file>` πριν αγγίξεις shared αρχείο.
- **COMMIT/PUSH τον κάνει ΜΟΝΟ ο Giorgio** (N.(-1)). Εσύ ΔΕΝ κάνεις commit/push, ΟΥΤΕ `--no-verify`. **ΜΗΝ αγγίξεις adr-index** (shared tree).
- **N.8 Execution mode:** 5+ αρχεία / 2+ domains → **Orchestrator-scale**. ΞΕΚΙΝΑ ΜΕ **Plan Mode** (child-ADR ADR-430), παρουσίασε πλάνο στον Giorgio, πάρε έγκριση πριν υλοποιήσεις. ΠΑΡΕ ΕΣΥ τις Revit αποφάσεις (μνήμη: «make Revit-grade decisions yourself»), ζήτα μόνο έγκριση plan.
- **N.14 Model:** Opus (αρχιτεκτονικό/cross-cutting).
- **N.17:** ΕΝΑΣ tsc τη φορά — έλεγξε ότι δεν τρέχει ήδη codex tsc· αν μπλοκάρει ο έλεγχος, πρότεινε `! npx tsc --noEmit` ή defer (jest αρκεί για headless).
- **N.11 i18n:** ΚΑΘΕ νέο user-facing string → ΠΡΩΤΑ key σε `src/i18n/locales/el/*.json` ΚΑΙ `en/*.json` (ribbon labels, toasts, classification labels). ΟΧΙ hardcoded.
- **ADR-040:** Slice 1 (headless engine) = **ΕΚΤΟΣ**. Slice 2 (ghost/canvas mount) = **STAGE ADR-040** (CHECK 6B/6D) αν αγγίξεις canvas leaves.
- **N.15:** μετά υλοποίηση → ADR-430 (NEW doc) + ADR-423 changelog + registry flip + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + μνήμη. **ΜΗΝ adr-index** (shared tree).
- **N.6 Enterprise IDs:** αν δημιουργείς νέες entities/circuits, ID από `enterprise-id.service` (υπάρχει generator για mep-system; verify).

---

## 0) ΚΑΤΑΣΤΑΣΗ — ΤΙ ΥΠΑΡΧΕΙ ΗΔΗ (code = SoT, verified 2026-06-09 Explore)

| Συστατικό | Αρχείο | Reuse / Gap |
|---|---|---|
| **Σύστημα κυκλώματος** `MepElectricalSystemParams` (wireStyle/conductors/ratedVoltage/poles/systemClassification) + `isElectricalSystemParams` + `buildDefaultCircuitParams` | `bim/types/mep-system-types.ts` (~77-123) | 🟢 REUSE (auto-design παράγει αυτό). GAP: ratedVoltage/poles ποτέ auto-filled |
| **Πηγή** `ElectricalPanelEntity` (`electrical-panel`, kind `distribution-board`, power-OUT connector `c1` classification `'power'`) | `bim/types/electrical-panel-types.ts` + `bim/electrical-panels/` | 🟢 REUSE (source). `isElectricalPanelEntity` guard υπάρχει |
| **Φορτίο φωτισμού** `light-fixture` (mep-fixture kind, `buildDefaultLightingConnector` electrical/flow:in/`'lighting'`) | `bim/types/mep-fixture-types.ts` + `mep-systems/mep-connector-seed.ts` | 🟢 REUSE (lighting terminal). |
| **Φορτίο πρίζας** socket/receptacle | — | 🔴 GAP: ΔΕΝ υπάρχει kind. NEW `MepFixtureKind 'socket'` (ή 'receptacle') + `buildDefaultPowerConnector` (electrical/flow:in/`'power'`) |
| **Wire routing (logical)** `computeCircuitWirePaths`, `computeCircuitHostSegments`, `WireStyle`, `expandSegment` | `bim/mep-systems/mep-wire-routing.ts` | 🟢 REUSE (render καλωδίων ΔΩΡΕΑΝ) |
| **2D/3D wire render** `HomeRunWiresOverlay.tsx`, `sync-circuit-wires.ts`, `mep-wire-to-three.ts` | ως άνω paths | 🟢 REUSE (always-on derive) |
| **Manual circuit creation** `mep-circuit-from-selection.ts`, `mep-circuit-editor-store.ts`, `mep-circuit-editor.ts`, `CreateMepSystemCommand` | `bim/mep-systems/` | 🟢 REUSE (το accept commit-άρει κυκλώματα μέσω αυτού· verify exact API) |
| **Recognition source** `mepSourceRecognizer` (panel→`sourceKind:'panel'`) | `systems/recognition/recognizers/mep-source-recognizer.ts` | 🟢 REUSE |
| **Recognition registration** `registerMepRecognition` (sanitary+heating terminals + source) | `systems/recognition/recognizers/mep-recognition.ts` | 🟢 REUSE pattern. GAP: NEW `electricalTerminalRecognizer` |
| **Discipline registry slot** `'electrical-strong'` reserved | `systems/mep-design/registry/mep-discipline-registry.ts` (87-95) | 🟢 flip→active + fill standards |
| **Classifications** `ElectricalSystemClassification = 'power'|'lighting'|'data'|'controls'` | `bim/types/mep-connector-types.ts` (~52) | 🟢 v1 χρησιμοποιεί `'lighting'`+`'power'`. (Φινό taxonomy `power-sockets`/`motor-power`/`earthing` = ADR-423 §2.1, defer) |
| **Demand / sizing / voltage-drop** | — | 🔴 GAP ΤΟΤΑΛ: ΚΑΜΙΑ ηλεκτρ. sizing. NEW `electrical-demand.ts`, `electrical-circuit-grouping.ts`, `electrical-sizing.ts` |
| **3 pipe disciplines (template)** | `systems/mep-design/{water,heating,drainage}/` | 🟢 ΔΙΑΒΑΣΕ ως πρότυπο δομής (types/discipline/demand/sizing/design-*/index + Slice 2 store/commit/ghost/bridge) |

**Discipline pattern (αντίγραψε τη ΔΟΜΗ, ΟΧΙ τη μηχανή):** δες `heating/` ως πληρέστερο πρότυπο — `heating-design-types.ts` (proposal types), `heating-discipline.ts` (descriptor = standards), `heating-demand.ts`, `heating-sizing.ts`, `design-heating.ts` (orchestrator), `index.ts`, + Slice 2: `heating-proposal-store.ts`, `commit/build-heating-commit.ts`, ghost leaf, `useRibbonHeating*Bridge`.

---

## 1) Η ΑΡΧΙΤΕΚΤΟΝΙΚΗ ΤΟΥ ELECTRICAL AUTO-DESIGN (pipeline, Revit-grade)

```
RecognitionModel (Stage 0)
  → Demand:    VA ανά terminal (φωτιστικό / πρίζα)  [electrical-demand.ts]
  → Grouping:  φορτία → ΚΥΚΛΩΜΑΤΑ  (ο πραγματικός εγκέφαλος)  [electrical-circuit-grouping.ts]
       · χωριστά lighting vs sockets (ελληνική πρακτική / Revit)
       · όριο φορτίου ανά κύκλωμα (breaker A) + όριο σημείων/κύκλωμα
       · ομαδοποίηση ανά χώρο/ζώνη (pointInPolygon — reuse ADR-419/recognition spaces)
       · phase balancing L1/L2/L3 round-robin
  → Sizing:    διατομή αγωγού + breaker + έλεγχος πτώσης τάσης  [electrical-sizing.ts]
  → Output:    ElectricalNetworkProposal = Ν circuits (members + classification + breaker/conductor/VD)
                ΟΧΙ segments. Commit = δημιουργία Ν MepSystem κυκλωμάτων.
```

**Daisy-chain σειρά μέσα στο κύκλωμα:** το `computeCircuitWirePaths` ΗΔΗ κάνει greedy nearest-neighbour panel→members στο render. Το auto-design ΔΕΝ χρειάζεται να την προ-υπολογίσει — απλώς ορίζει membership (Revit: assign-to-circuit). (Optional later: optimal ordering.)

---

## 2) ΟΙ ΑΠΟΦΑΣΕΙΣ (Revit-grade — πάρ' τες ΕΣΥ, lock στο plan· πρότυπες τιμές ελληνικής πρακτικής)

1. **Πρότυπο:** **ΕΛΟΤ HD 384 / IEC 60364** (η ελληνική εφαρμογή· Revit/4M FINE το χρησιμοποιούν). Pluggable standard descriptor όπως EN806/EN12056.
2. **v1 scope:** **κυκλώματα φωτισμού + γενικών ρευματοδοτών** (lighting + sockets). Κινητήρες/HVAC-power/γείωση/ασθενή = reserved/επόμενα slices.
3. **Terminals v1:** φωτιστικά (`light-fixture` ✅) + **NEW kind πρίζα** (`socket`). Διακόπτες φωτισμού = lighting-control (defer ή ως annotation).
4. **Demand (VA):** φωτιστικό ~ από fixture ή default (π.χ. 100 VA· pluggable)· πρίζα ~ 200 VA/σημείο (ελληνική πρακτική, pluggable). 230V μονοφασικό default.
5. **Όρια κυκλώματος (LOCK, pluggable):** φωτισμός 10A MCB / 1.5mm² / ≤ ~? σημεία ή ≤ load· πρίζες 16A MCB / 2.5mm² / ≤ ~? σημεία ή ≤ load. (Διάλεξε Revit-grade defaults + τεκμηρίωσε.)
6. **Phase balance:** round-robin L1/L2/L3 ανά κύκλωμα (ή μονοφασικό v1 αν θες απλό — αλλά 3-phase balance = Revit-grade· απόφαση δική σου).
7. **Sizing:** διατομή→ampacity (HD 384 πίνακας) ≥ breaker· **πτώση τάσης** I·L·R ≤ όριο (φωτισμός ~3%, λοιπά ~? — ελληνικό όριο). Advisory readout (όπως L6 ΚΕΝΑΚ).
8. **Output/commit:** Ν κυκλώματα ως `MepElectricalSystemParams` (classification `lighting`/`power`, poles=1, ratedVoltage=230, conductors). Commit reuse circuit-creation path (`CreateMepSystemCommand`) σε ΕΝΑ atomic `CompoundCommand`. **Μηδέν segments.**
9. **Classifications v1:** χρησιμοποίησε `'lighting'`+`'power'` (υπάρχουν). Αν χρειαστεί διάκριση πρίζας από γενική ισχύ, σκέψου fine classification σε registry level (ΟΧΙ αναγκαστικά expand το connector enum — δες ADR-423 §2.1 note· απόφαση δική σου, κράτα regression-free το manual circuit).

---

## 3) SLICING (πρόταση — κλείδωσε στο plan)

- **Slice 0 — foundation:** NEW `socket` terminal kind (+ `buildDefaultPowerConnector` electrical/flow:in/`'power'`, seed, 2D symbol spec, ribbon tool «Πρίζα» — mirror light-fixture) + **NEW `electricalTerminalRecognizer`** (light-fixture + socket → `RecognizedTerminal` με serviceClassifications) registered στο `mep-recognition.ts`. Tests.
- **Slice 1 — headless engine (ΕΚΤΟΣ ADR-040):** `systems/mep-design/electrical/`: `electrical-design-types.ts` (ElectricalNetworkProposal = circuits), `electrical-strong-discipline.ts` (descriptor + HD384 standards), `electrical-demand.ts` (VA), `electrical-circuit-grouping.ts` (ο εγκέφαλος), `electrical-sizing.ts` (conductor/breaker/VD), `design-electrical-strong.ts` (orchestrator), `index.ts`. **Registry flip→active** + fill standard ids. Tests (demand/grouping/sizing + integration print). ΜΗΝ adr-index.
- **Slice 2 — preview/commit (STAGE ADR-040):** mirror heating Slice 2 — `electrical-proposal-store` (low-freq), pure `commit/build-electrical-commit` (proposal→Ν circuits via CreateMepSystemCommand, 1 atomic CompoundCommand), ghost leaf (highlight circuits / wire preview reusing `computeCircuitWirePaths` με χρώμα ανά classification), ribbon «Αυτόματος Ηλεκτρολογικός» Generate/Accept/Reject bridge, i18n el+en, toasts. Tests.

**Σειρά εκτέλεσης:** Plan Mode (ADR-430) → έγκριση → Slice 0 → Slice 1 (jest πράσινο) → Slice 2 → N.15.

---

## 4) ΤΙ ΝΑ ΜΗΝ ΣΠΑΣΕΙΣ (regression invariants)
- **Manual circuits**: `computeCircuitWirePaths` / circuit-from-selection / wire overlays πρέπει να μείνουν ΑΝΕΓΓΙΧΤΑ functionally. Αν επεκτείνεις `ElectricalSystemClassification` ή `MepFixtureKind` → κράτα όλους τους υπάρχοντες callers πράσινους (discriminated unions → ο compiler θα δείξει τα guards).
- **MEP test suites** (`npm run test:ai-pipeline` ΟΧΙ· αλλά τα MEP jest suites): φωτιστικά/connector seed/circuit tests να μείνουν πράσινα. Πρόσθεσε, μην αλλάξεις συμπεριφορά.
- **Pipe disciplines** (water/heating/drainage) ΑΝΕΓΓΙΧΤΑ — το ηλεκτρολογικό είναι ξεχωριστός φάκελος.
- ΜΗΝ `git add -A`· ΜΗΝ commit/push/adr-index/`--no-verify`· ΜΗΝ 2ο tsc (N.17)· κάθε νέο string → i18n el+en (N.11).

## 5) ΠΡΩΤΗ ΕΝΕΡΓΕΙΑ (νέα session, Opus, Plan Mode)
1. Διάβασε αυτό + (code=SoT): `bim/types/mep-system-types.ts` (electrical system), `bim/types/electrical-panel-types.ts` + `bim/types/mep-fixture-types.ts` (light-fixture), `bim/mep-systems/mep-wire-routing.ts` + `mep-circuit-from-selection.ts` (circuit creation API), `systems/recognition/recognizers/mep-recognition.ts` + `mep-source-recognizer.ts`, `systems/mep-design/registry/mep-discipline-registry.ts`, και **`systems/mep-design/heating/`** (πλήρες πρότυπο δομής Slice1+2). ADR-423 §2.1/§6/§7. Μνήμη `[[project_adr423_mep_auto_design]]` `[[project_adr425_stage0_recognition]]`.
2. **Plan Mode**: child-ADR ADR-430 (verify next-free number· πιθανώς 430). Κλείδωσε τις §2 αποφάσεις (πάρ' τες ΕΣΥ Revit-grade), παρουσίασε slice plan, πάρε έγκριση.
3. Υλοποίηση Slice 0→1→2. jest πράσινο σε κάθε slice.
4. N.15 (ADR-430 NEW + ADR-423 changelog + registry flip + ΕΚΚΡΕΜΟΤΗΤΕΣ + μνήμη). **ΜΗΝ commit** — άσε τον Giorgio. Δώσε λίστα δικών σου αρχείων + context indicator (N.9) + Google-level declaration (N.7.2).

## 6) ΜΕΤΑ ΑΠΟ ΑΥΤΟ
- 5η discipline: **HVAC/Ventilation** (χρειάζεται duct sizing + diffuser terminals — υπάρχει duct primitive από boiler flue).
- Electrical WEAK-current (6η· ίδια radial/star μηχανή + νέα terminal kinds/classifications data/cctv/intercom...).
- Electrical: voltage-drop report (μηχανολογική μελέτη ΗΛΜ) + panel schedule / single-line diagram (ADR-423 §"deliverables").
- Φυσικό conduit/cable-tray geometry (τότε ΝΑΙ A* router + pairing core γίνονται relevant).

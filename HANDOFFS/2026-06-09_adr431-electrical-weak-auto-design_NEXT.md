# 🧠 HANDOFF — ADR-431 **Ηλεκτρολογικά ΑΣΘΕΝΗ** Auto-Design (6η discipline, child ADR-423): υλοποίηση

> **Σύνταξη:** Opus 4.8, 2026-06-09. **Στόχος νέας συνεδρίας:** η **6η MEP discipline — Electrical WEAK-current / ΑΣΘΕΝΗ auto-design** (αυτόματη δημιουργία κυκλωμάτων δομημένης καλωδίωσης / data / TV / CCTV / intercom από αναγνωρισμένα ασθενή τερματικά + rack/patch-panel), **όπως Revit/MagiCAD/4M FINE — FULL ENTERPRISE + FULL SSOT**. Είναι το επόμενο βήμα μετά τα **Ηλεκτρολογικά ΙΣΧΥΡΑ (ADR-430, μόλις ολοκληρώθηκε)**. Σειρά ADR-423 §6: *Ύδρευση→Αποχέτευση→Θέρμανση→Ηλεκτρ. ΙΣΧΥΡΑ→HVAC→**Ηλεκτρ. ΑΣΘΕΝΗ**→Πυρ→Αέριο*.

---

## ⚠️ ΤΟ ΚΛΕΙΔΙ — ΤΟ ΑΣΘΕΝΕΣ ΕΙΝΑΙ Ο «ΑΔΕΛΦΟΣ» ΤΟΥ ΙΣΧΥΡΟΥ (διάβασέ το ΠΡΩΤΟ)

Το ασθενές ρεύμα είναι **η ίδια μηχανή με το ισχυρό (ADR-430)**, με διαφορετικά terminals/classifications και ΔΙΑΦΟΡΕΤΙΚΟ sizing. Όπως το ηλεκτρολογικό γενικά:

- Η καλωδίωση είναι **ΛΟΓΙΚΗ / DERIVED** — output = **Ν κυκλώματα (`MepSystem`s), ΟΧΙ segments**· το `computeCircuitWirePaths` ζωγραφίζει το home-run ΔΩΡΕΑΝ. Ο A*/pairing core **ΔΕΝ** είναι η μηχανή (μένει για physical conduit/tray, μελλοντικά).
- **Η ΤΕΡΑΣΤΙΑ ΕΠΑΝΑΧΡΗΣΗ:** ολόκληρο το pipeline του ADR-430 (`systems/mep-design/electrical/`) είναι σχεδόν αυτούσια αξιοποιήσιμο — demand → grouping (split-by-service → group-by-zone → bin-pack) → phase/χ → sizing → proposal → Slice-2 preview/commit (proposal-store + pure commit + ghost + ribbon bridge). **Η σωστή ENTERPRISE κίνηση είναι να ΓΕΝΙΚΕΥΣΕΙΣ τον ADR-430 engine σε agnostic core (Boy-Scout N.0.2) και το ασθενές = 2ος consumer με δικό του discipline descriptor** — ΟΧΙ copy-paste νέου φακέλου.

**Η ΓΝΗΣΙΑ ΔΙΑΦΟΡΑ ΑΣΘΕΝΟΥΣ vs ΙΣΧΥΡΟΥ (αυτό είναι το νέο):**
1. **Πηγή:** ΟΧΙ ηλεκτρικός πίνακας — το ασθενές ξεκινά από **rack / patch-panel / comms cabinet** (Revit "Communication"/"Data Panel"). 🔴 GAP: δεν υπάρχει τέτοια οντότητα. Απόφαση (δική σου): (α) NEW source entity «comms-rack» (mirror `electrical-panel`), ή (β) reuse `electrical-panel` με weak classification στον connector. Πρότεινω **(α)** για καθαρό Revit-grade (ξεχωριστή οικογένεια), αλλά κρίνε το κόστος.
2. **Sizing — ΕΝΤΕΛΩΣ ΔΙΑΦΟΡΕΤΙΚΟ:** δεν υπάρχει breaker/πτώση τάσης. Αντί αυτών: **όριο μήκους καναλιού δομημένης καλωδίωσης (Cat6 channel ≤ 90 m permanent link, ISO/IEC 11801 / TIA-568)** + **port-count grouping** (ένα κύκλωμα/τερματικό ανά port του switch· star topology στο rack). Ο «εγκέφαλος» του ασθενούς = group-by-zone + **έλεγχος 90m home-run length** + port budget. Advisory readout (όπως το ΔU% του ισχυρού).
3. **Classifications:** ο connector enum `ElectricalSystemClassification = 'power'|'lighting'|'data'|'controls'` έχει **'data' + 'controls' reserved-but-unwired**. v1 ασθενούς → χρησιμοποίησε `'data'` (δομημένη καλωδίωση/RJ45) + `'controls'` (BMS/security). Η πλήρης ταξινομία (TV/SAT, τηλέφωνο, CCTV, intercom, audio, alarm) είναι ADR-423 §2.1 — απόφαση enum-vs-registry split: **κράτα τον connector enum coarse + finer classification σε registry level** (όπως σημειώνει το ADR-423 §2.1), ΜΗΝ φουσκώσεις το enum χωρίς λόγο (regression-free για ισχυρό + manual circuits).

---

## ⚠️ ΚΑΝΟΝΕΣ (αμετάβλητοι — πάγια εντολή Giorgio)
- **Ελληνικά** όλες οι απαντήσεις (LANGUAGE RULE CLAUDE.md).
- **FULL ENTERPRISE + FULL SSOT, «όπως οι μεγάλοι παίχτες / Revit / MagiCAD / 4M FINE»** — μηδέν `any`/`as any`/`@ts-ignore`, αρχεία ≤500 γρ., functions ≤40 γρ. ΠΑΝΤΑ Grep/Glob για υπάρχον πριν γράψεις (extend/γενίκευσε, ΜΗΝ duplicate).
- **SHARED working tree** με άλλον agent (codex). `git add` **ΜΟΝΟ δικά σου** αρχεία, **ΠΟΤΕ** `git add -A`. ΠΑΝΤΑ `git status` + `git diff <file>` πριν αγγίξεις shared αρχείο.
- **COMMIT/PUSH τον κάνει ΜΟΝΟ ο Giorgio** (N.(-1)). Εσύ ΔΕΝ κάνεις commit/push, ΟΥΤΕ `--no-verify`. **ΜΗΝ αγγίξεις adr-index** (shared tree).
- **N.8 Execution mode:** 5+ αρχεία / 2+ domains → Orchestrator-scale. ΞΕΚΙΝΑ ΜΕ **Plan Mode** (child-ADR ADR-431), παρουσίασε πλάνο, πάρε έγκριση πριν υλοποιήσεις. **ΠΑΡΕ ΕΣΥ τις Revit αποφάσεις** (μνήμη: «make Revit-grade decisions yourself»), ζήτα μόνο έγκριση plan.
- **N.14 Model:** Opus (αρχιτεκτονικό/cross-cutting).
- **N.17:** ΕΝΑΣ tsc τη φορά — έλεγξε με `Get-CimInstance Win32_Process` (μέσω ps1 αρχείου — το bash τρώει το `$_`) ότι δεν τρέχει codex tsc· τρέξε ΕΝΑΝ στο background, μην μπλοκάρεις.
- **N.11 i18n:** ΚΑΘΕ νέο user-facing string → ΠΡΩΤΑ key σε `el/*.json` ΚΑΙ `en/*.json`. ΟΧΙ hardcoded.
- **ADR-040:** Slice 1 (headless) = **ΕΚΤΟΣ**. Slice 2 (ghost/canvas mount σε `canvas-layer-stack-leaves.tsx`) = **STAGE ADR-040** (CHECK 6B/6D).
- **N.15:** μετά υλοποίηση → ADR-431 (NEW doc) + ADR-423 changelog + registry flip + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + μνήμη `MEMORY.md`. **ΜΗΝ adr-index** (shared tree).
- **N.6 Enterprise IDs:** αν δημιουργείς νέα source entity (comms-rack), νέο prefix + generator στο `enterprise-id.service`.

---

## 0) ΚΑΤΑΣΤΑΣΗ — ΤΙ ΥΠΑΡΧΕΙ ΗΔΗ (code = SoT, ADR-430 μόλις ολοκληρώθηκε)

| Συστατικό | Αρχείο | Reuse / Gap |
|---|---|---|
| **Ηλεκτρ. ΙΣΧΥΡΑ engine (ΟΛΟΚΛΗΡΟ pipeline)** | `systems/mep-design/electrical/` (design-types, strong-discipline, demand, **circuit-grouping [brain]**, sizing, source-resolve, design-electrical-strong, index) | 🟢 ΓΕΝΙΚΕΥΣΕ → agnostic core· ασθενές = 2ος consumer (νέο `electrical-weak-discipline` descriptor + δικά του demand/sizing standards) |
| **Slice-2 preview/commit** | `electrical-proposal-store`, `commit/build-electrical-commit`, `useElectricalProposalGhostPreview`, `canvas-layer-stack-electrical-proposal-ghost`, `useRibbonElectricalAutoBridge`, `electrical-auto-command-keys` | 🟢 REUSE pattern (το ασθενές μιμείται· circuits = MepSystem, ίδιο `CreateMepSystemCommand` + `CompoundCommand`) |
| **Circuit model + wire render** | `MepElectricalSystemParams`, `computeCircuitWirePaths`, `HomeRunWiresOverlay`, `drawCircuitWires` | 🟢 REUSE (home-run ΔΩΡΕΑΝ· classification color SSoT `ELECTRICAL_CLASSIFICATION_COLOR` έχει ήδη data/controls) |
| **socket terminal pattern** | `bim/mep-fixtures/socket-symbol-spec.ts` + όλα τα touch points (ADR-430 Slice 0) | 🟢 ΠΡΟΤΥΠΟ για νέα ασθενή terminals (data-outlet/cctv/…) — mirror 1:1 |
| **terminal recognizer pattern** | `systems/recognition/recognizers/electrical-terminal-recognizer.ts` | 🟢 REUSE pattern· GAP: NEW weak terminals recognition (ή επέκταση: service από connector classification → data/controls) |
| **Discipline registry slot** `'electrical-weak'` reserved | `systems/mep-design/registry/mep-discipline-registry.ts` (~105) | 🟢 flip→active + standard ids (flowModel ήδη 'electrical', classifications []) |
| **Classifications** `'data'|'controls'` reserved | `bim/types/mep-connector-types.ts` (~52) | 🟢 v1 χρησιμοποίησε αυτά· φινό taxonomy = registry level |
| **Πηγή ασθενούς (rack/patch-panel)** | — | 🔴 GAP: NEW source entity ή reuse panel (απόφαση Plan) |
| **Channel-length / port-count sizing** | — | 🔴 GAP ΤΟΤΑΛ: NEW `electrical-weak` demand/sizing (90m Cat6 channel + port budget) |

---

## 1) ΑΡΧΙΤΕΚΤΟΝΙΚΗ (Revit-grade)

```
RecognitionModel ─▶ Source resolve (rack) ─▶ Demand (ports/τερματικό) ─▶ skip already-circuited
   ─▶ Grouping (split-by-classification · group-by-zone · bin-pack ΑΝΑ port budget)
   ─▶ Sizing (channel length ≤ 90m advisory + cable type) ─▶ ElectricalNetworkProposal { N κυκλώματα }
```

Όπως το ισχυρό, αλλά: bin-pack ΑΝΑ **ports** (όχι VA/breaker)· sizing = **μήκος καναλιού** (Cat6 ≤ 90m) αντί breaker/ΔU%. Star topology στο rack (το `computeCircuitWirePaths` ΗΔΗ κάνει greedy daisy-chain — για star μπορεί να μείνει ως έχει v1, ή optional «home-run per outlet» αργότερα).

---

## 2) ΟΙ ΑΠΟΦΑΣΕΙΣ (Revit-grade — πάρ' τες ΕΣΥ, lock στο plan)
1. **Πρότυπο:** ISO/IEC 11801 / EN 50173 (δομημένη καλωδίωση) — pluggable descriptor όπως HD384.
2. **v1 scope:** δομημένη καλωδίωση **data (RJ45)** + ένα γενικό **weak/controls** (π.χ. security/BMS). TV/SAT/intercom/CCTV/audio = reserved/επόμενα.
3. **Source:** NEW `comms-rack` entity (πρότυπο `electrical-panel`) **ή** reuse panel — απόφασέ το.
4. **Terminals v1:** NEW `data-outlet` (RJ45, classification `'data'`) — mirror socket 1:1· optional 2ο γενικό weak terminal.
5. **Demand:** ports/τερματικό (data-outlet = 1-2 ports). Bin-pack ανά port budget switch (π.χ. 24/48, pluggable).
6. **Sizing:** channel length ≤ **90 m** (advisory warning αν ξεπεραστεί)· cable type (Cat6/Cat6A). Daisy-chain length reuse `daisyChainLengthM` (ΗΔΗ υπάρχει στο `electrical-sizing.ts`).
7. **Classifications v1:** `'data'`+`'controls'` (υπάρχουν). Φινό taxonomy → registry level, ΟΧΙ enum expansion.
8. **Output/commit:** Ν `MepElectricalSystemParams` (classification data/controls, color SSoT)· reuse `CreateMepSystemCommand` σε 1 atomic `CompoundCommand`. **Μηδέν segments.**

---

## 3) SLICING (πρόταση — κλείδωσε στο plan)
- **Slice 0 — foundation:** NEW `comms-rack` source (ή reuse decision) + NEW `data-outlet` terminal kind (mirror socket: kind/connector `'data'`/seed/symbol/3D/tool/schema/i18n) + weak terminal recognizer (ή επέκταση electrical recognizer να διακρίνει data/controls). Tests.
- **Slice 1 — headless engine (ΕΚΤΟΣ ADR-040):** **ΓΕΝΙΚΕΥΣΕ** το `systems/mep-design/electrical/` σε agnostic core (demand/grouping κοινά, sizing ανά discipline) + NEW `electrical-weak-discipline` (port budget + 90m channel standard) + `design-electrical-weak` orchestrator. **Registry flip→active.** Tests (port grouping/channel length/integration). ΜΗΝ adr-index.
- **Slice 2 — preview/commit (STAGE ADR-040):** mirror ισχυρό Slice 2 — weak proposal-store (ή κοινό parametrized) + commit + ghost (χρώμα data/controls) + ribbon «Αυτόματα Ασθενή» Generate/Accept/Reject + i18n el+en + toasts. Tests.

**Σειρά:** Plan Mode (ADR-431) → έγκριση → Slice 0 → Slice 1 (jest πράσινο) → Slice 2 → N.15.

---

## 4) ΤΙ ΝΑ ΜΗΝ ΣΠΑΣΕΙΣ (regression invariants)
- **Ηλεκτρ. ΙΣΧΥΡΑ (ADR-430)**: αν γενικεύσεις τον engine, ΚΡΑΤΑ το ισχυρό byte-identical (zero-regression· τα 55+105 tests πράσινα). Η γενίκευση = Boy-Scout, ΟΧΙ rewrite συμπεριφοράς.
- **Manual circuits / `computeCircuitWirePaths` / wire overlays** ΑΝΕΓΓΙΧΤΑ functionally. Αν επεκτείνεις `ElectricalSystemClassification` ή `MepFixtureKind` → όλοι οι callers πράσινοι (discriminated unions → compiler δείχνει guards).
- **Pipe disciplines** (water/heating/drainage) + **shared recognition** ΑΝΕΓΓΙΧΤΑ (κάθε demand stage φιλτράρει ανά classification).
- ΜΗΝ `git add -A`· ΜΗΝ commit/push/adr-index/`--no-verify`· ΜΗΝ 2ο tsc· κάθε string → i18n el+en.

---

## 5) ΠΡΩΤΗ ΕΝΕΡΓΕΙΑ (νέα session, Opus, Plan Mode)
1. Διάβασε αυτό + **ADR-430** (`docs/.../ADR-430-electrical-strong-auto-design.md`) + (code=SoT): ΟΛΟΚΛΗΡΟ το `systems/mep-design/electrical/` (engine προς γενίκευση), `bim/mep-fixtures/socket-symbol-spec.ts` (terminal πρότυπο), `systems/recognition/recognizers/electrical-terminal-recognizer.ts`, `bim/types/mep-connector-types.ts` (classifications), `bim/types/electrical-panel-types.ts` (source πρότυπο για rack), `mep-discipline-registry.ts`. ADR-423 §2.1/§6. Μνήμη `[[project_adr430_electrical_strong_auto_design]]` `[[project_adr423_mep_auto_design]]`.
2. **Plan Mode**: child-ADR ADR-431 (verify next-free· πιθανώς 431). Κλείδωσε τις §2 αποφάσεις (πάρ' τες ΕΣΥ Revit-grade), ΑΠΟΦΑΣΙΣΕ source (rack vs panel) + engine γενίκευση strategy, παρουσίασε slice plan, πάρε έγκριση.
3. Υλοποίηση Slice 0→1→2. jest πράσινο σε κάθε slice.
4. N.15 (ADR-431 NEW + ADR-423 changelog + registry flip + ΕΚΚΡΕΜΟΤΗΤΕΣ + μνήμη). **ΜΗΝ commit** — άσε τον Giorgio. Δώσε λίστα δικών σου αρχείων + context indicator (N.9) + Google-level declaration (N.7.2).

---

## 6) ΕΝΑΛΛΑΚΤΙΚΑ ΑΝΤΙΚΕΙΜΕΝΑ (αν ο Giorgio το αλλάξει στο prompt)
Ο Giorgio μπορεί να σε κατευθύνει σε άλλο deferred item αντί για το ασθενές:
- **Panel Schedule / Single-Line Diagram** (ΗΛΜ deliverable): διαβάζει τα κυκλώματα που ΗΔΗ φτιάχνει το ADR-430 → πίνακας διανομής ανά phase/breaker/load + μονογραμμικό. Revit "Panel Schedule view". Καθαρή προστιθέμενη αξία, μηδέν νέα μηχανική.
- **HVAC (5η discipline, ADR-423 §6 σειρά)**: χρειάζεται duct sizing + diffuser terminals (το duct primitive υπάρχει από boiler flue ADR-408).
- **Physical conduit/cable-tray geometry**: ΤΟΤΕ ο A*/pairing core γίνεται relevant (φυσικές οδεύσεις καλωδίων).
- **Multi-panel / 3-phase loads / motors / γείωση**: επεκτάσεις του ADR-430 (per-zone panel selection, motor circuits, earthing system).

---

## 7) ΣΥΝΟΨΗ ΟΛΟΚΛΗΡΩΜΕΝΟΥ ADR-430 (context για συνέχεια)
Ηλεκτρ. ΙΣΧΥΡΑ Slices 0+1+2 DONE 2026-06-09 (Opus): NEW kind `'socket'` + `electricalTerminalRecognizer` + `systems/mep-design/electrical/` (demand 100/200VA · grouping split-by-service/zone/bin-pack · phase LPT · sizing conductor/breaker/ΔU% HD384) + Slice-2 (proposal-store/commit/ghost/«Αυτόματος Ηλεκτρολογικός» bridge). 217/30 suites + tsc exit 0 πράσινα. ΕΚΤΟΣ ADR-040 (0+1)· Slice2 STAGE ADR-040. 🔴 ΕΚΚΡΕΜΕΙ: browser-verify + commit (Giorgio). ADR-430 doc + ADR-423 changelog + ΕΚΚΡΕΜΟΤΗΤΕΣ + MEMORY.md ✅. **ΜΗΝ adr-index.**

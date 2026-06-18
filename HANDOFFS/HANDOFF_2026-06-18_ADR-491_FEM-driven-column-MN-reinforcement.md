# HANDOFF — ADR-491: FEM-driven οπλισμός κολώνας στήριξης (M-N από τον φορέα, ΟΧΙ μόνο ονομαστική εκκεντρότητα)

**Ημ/νία:** 2026-06-18 · **Από:** Opus session (μόλις ολοκλήρωσε ADR-486 §C auto-design προβόλου + ADR-488 proactive FEM + ADR-490 warning overlay) · **Γλώσσα:** ΠΑΝΤΑ Ελληνικά.
**Τύπος:** 🔴 PLAN-FIRST. **SSoT AUDIT (GREP) ΥΠΟΧΡΕΩΤΙΚΟ ΠΡΙΝ ΚΩΔΙΚΑ.** ΜΗΝ γράψεις πριν εγκριθεί το plan από τον Giorgio.

> ⚠️ **Shared working tree** με άλλον agent. **git add ΜΟΝΟ τα δικά σου αρχεία, ΠΟΤΕ -A.** **commit = ο Giorgio (ΟΧΙ εσύ). tsc = ο Giorgio** (N.17, ένα tsc τη φορά). **jest = τρέξε από repo ROOT** (αλλιώς πιάνει το λάθος subapp jest config → invalid-regex error).
> **Full Enterprise + Full SSOT + Revit/Robot-grade (GOL).** ≤40γρ/func, ≤500γρ/file, μηδέν `any`/`as any`/`@ts-ignore`, μηδέν hardcoded strings (i18n el+en), Select=`@/components/ui/select` (ADR-001).
> 🧭 **ΔΙΑΒΑΣΕ ΠΡΩΤΑ ΤΟ ΟΡΑΜΑ:** `docs/centralized-systems/reference/adrs/ADR-487-living-structural-organism-vision.md` (§3 «ΕΝΑΣ οργανισμός», §4 «σε κάθε κίνηση recompute»). Αυτό το task = το §4 για την **κολώνα στήριξης προβόλου**.

---

## 0. ΤΟ ΣΕΝΑΡΙΟ (γιατί υπάρχει το task)

Κάτοψη: 2 κολώνες + 1 δοκάρι. Ο Giorgio μετακίνησε/αποσύνδεσε τη μία κολώνα → το δοκάρι έγινε **πρόβολος** (στηρίζεται μόνο στη δεξιά κολώνα). 

- **Phase 1 (ΕΓΙΝΕ, ADR-486 §C):** το **δοκάρι** πλέον αυτο-διαστασιολογείται σιωπηλά (ύψος μεγαλώνει με wL²/2 ώστε ρ≤ρ_max) + κανένα μήνυμα για έγκυρο πρόβολο.
- **Phase 2 (ΕΣΥ, ADR-491):** ο **πρόβολος μεταφέρει ροπή M=wL²/2 στην κολώνα στήριξης**. Σήμερα η κολώνα **ΔΕΝ** οπλίζεται γι' αυτή τη ροπή → ανεπαρκής. Πρέπει αυτόματα (ο «στατικός» = εφαρμογή) να **οπλίζει την κολώνα για τη ροπή του φορέα** (M-N), σιωπηλά, σε κάθε κίνηση.

---

## 1. 🔑 ΤΟ ΚΛΕΙΔΙ (επιβεβαιωμένο από grep — ΜΗΝ φτιάξεις νέο engine)

**Ο M-N οπλισμός κολώνας ΥΠΑΡΧΕΙ ΗΔΗ** (ADR-472 S4):
- `bim/structural/codes/structural-code-types.ts` → `ColumnSectionContext` έχει **ΗΔΗ** `designAxialKn` **ΚΑΙ** `designMomentKnm` (σχόλιο: «ADR-472 S4 — Ροπή σχεδιασμού M_Ed για M-N σχεδιασμό»).
- `suggestColumnReinforcement(ctx)` (eurocode-provider / greek-legacy-provider) **ΗΔΗ** κάνει M-N design όταν υπάρχει `designMomentKnm`.
- `section-context.ts` → `buildColumnSectionContextFromParams` σήμερα θέτει `designMomentKnm` = **ονομαστική εκκεντρότητα** EC2 §6.1(4): `M_Ed = N_Ed·e₀, e₀=max(h/30, 20mm)`. Το `column applied load` έχει **ΗΔΗ** πεδία `momentXKnm/momentYKnm` (βλ. `section-context.ts:77`).

**ΤΟ ΚΕΝΟ:** κανείς δεν τροφοδοτεί την **πραγματική ροπή του FEM φορέα** (η wL²/2 του προβόλου στο άκρο της κολώνας) στο `designMomentKnm`. Άρα η κολώνα οπλίζεται μόνο για e₀ (μικρή), όχι για τη ροπή του προβόλου.

**Ο FEM ΗΔΗ υπολογίζει την κολώνα-ροπή** (ADR-481, proactive μέσω ADR-488):
- `bim/structural/analytical/solver/frame-solver.ts` + `member-diagrams.ts` + `solver-types.ts` → end-forces/diagrams ανά μέλος (M/V/N).
- `bim/structural/analytical/solver/analysis-results-store.ts` → `AnalysisResultsStore.get()` κρατά το έτοιμο `AnalysisResult` (τώρα proactive σε κάθε κίνηση, ADR-488).
- Το analytical member έχει `entityId` (→ map στο column entity).

→ **Phase 2 = ΓΕΦΥΡΑ:** FEM column end-moment (από `AnalysisResultsStore`) → `designMomentKnm` της κολώνας (max με την ονομαστική e₀) → ο **υπάρχων** `suggestColumnReinforcement` οπλίζει σωστά. **ΜΗΔΕΝ νέος M-N engine.**

---

## 2. ⚖️ ΑΡΧΙΤΕΚΤΟΝΙΚΗ ΕΝΤΑΣΗ (απάντησέ τη ΠΡΙΝ το plan)

Σήμερα δύο **παράλληλες, ανεξάρτητες** πηγές φορτίου ζουν μαζί (ADR-486/467 memory: «tributary↔FEM convergence DEFER»):
- **Tributary takedown** (ADR-467) → δίνει **αξονικό N** στην κολώνα (+ ονομαστική ροπή e₀). Proactive (`useProactiveStructuralLoads`).
- **FEM solver** (ADR-481) → δίνει **πραγματικά M/V/N** του φορέα. Proactive (ADR-488).

**Η ένταση:** πώς συγκλίνουν χωρίς διπλομέτρηση/oscillation; Επιλογές προς αξιολόγηση (διάλεξε Revit-grade & τεκμηρίωσε):
- **(A)** Το FEM column end-moment **υπερισχύει** της ονομαστικής e₀ (`designMomentKnm = max(e₀·N, M_FEM)`), αξονικό N **παραμένει** από tributary (ο FEM v1 δεν βάζει gravity column axial αξιόπιστα — βλ. ADR-481 «αξονική κολόνας προκύπτει από πλαίσιο»). **Πιθανώς το πιο ασφαλές & σταδιακό.**
- **(B)** Πλήρης μετάβαση σε FEM για M **ΚΑΙ** N κολώνας (εγκαταλείπεις tributary για κολώνες). Ρίσκο regression (ο FEM v1 = μόνο beam loads).
- **(C)** Hybrid με ρητό gate «analysis engaged» (ADR-488 latch) — FEM moment μόνο όταν ο μηχανικός «κοιτά» στατικά.

> Σύσταση προηγούμενου agent (όχι δεσμευτική): **(A)** — superpose το FEM moment πάνω στο υπάρχον tributary axial, idempotent, μηδέν regression όταν δεν υπάρχει FEM result. Loop-safe (ο οπλισμός δεν αλλάζει τον φορέα → ο FEM δεν ξανα-τρέχει από τον οπλισμό).

**Κρίσιμα sub-ζητήματα να λύσεις στο plan:**
1. **Mapping FEM member → column entity + άξονας:** το column end-moment του FEM είναι σε ποιον τοπικό άξονα; Πώς γίνεται `momentXKnm` vs `momentYKnm` της κολώνας (η `column-section-axial-utilization` στο `section-context.ts:77` διαβάζει `load.momentXKnm/Y`). Πρόσεξε άξονες/μονάδες (kNm).
2. **Ποιος συνδυασμός;** ο FEM δίνει envelope ανά συνδυασμό — πάρε το dominant ULS moment.
3. **Πού γίνεται η γέφυρα (SSoT):** στο `buildColumnSectionContextFromParams`; (αλλά είναι pure, δεν διαβάζει store). Mirror του ADR-486 §C: πέρασε **override** (`designMomentOverrideKnm?`) στο context builder, και ο **proactive hook / command** διαβάζει το `AnalysisResultsStore` και το περνά (όπως ο sizing command περνά `resolveActiveBeamSupportType`). Σκέψου ένα `resolveActiveColumnFemMoment(columnId)` SSoT (mirror `resolveActiveBeamSupportType`) που διαβάζει το FEM store — transient, ADR-040 safe.
4. **Proactive trigger:** ο οπλισμός κολώνας ξανα-τρέχει σε `bim:analysis-solved` (ή `bim:structural-organism-updated`)· coalesced· σιωπηλά (μηδέν toast). Mirror `useProactiveOrganismReinforce`.

---

## 3. 🔴 SSOT AUDIT (GREP) — ΤΡΕΞΕ ΟΛΑ ΠΡΙΝ ΓΡΑΨΕΙΣ. Παραδοτέο: πίνακας reuse vs new + απάντηση §2.

### 3.1 Ο M-N engine κολώνας (ΥΠΑΡΧΕΙ — REUSE)
```
src/subapps/dxf-viewer/bim/structural/codes/structural-code-types.ts   ← ColumnSectionContext.designMomentKnm/designAxialKn (ADR-472 S4)
src/subapps/dxf-viewer/bim/structural/codes/suggest-reinforcement.ts   ← asStrengthColumn / M-N λογική
src/subapps/dxf-viewer/bim/structural/codes/eurocode-provider.ts       ← suggestColumnReinforcement
src/subapps/dxf-viewer/bim/structural/codes/greek-legacy-provider.ts   ← suggestColumnReinforcement (ΕΚΩΣ/ΕΑΚ)
src/subapps/dxf-viewer/bim/structural/section-context.ts               ← buildColumnSectionContextFromParams (εδώ μπαίνει το e₀· εδώ θα γεφυρώσεις το FEM moment ως override)
grep -rn "designMomentKnm\|designAxialKn\|suggestColumnReinforcement\|momentXKnm" src/subapps/dxf-viewer
```

### 3.2 Η πηγή της FEM ροπής (ΥΠΑΡΧΕΙ — REUSE, ΜΗΝ ξανα-λύσεις)
```
src/subapps/dxf-viewer/bim/structural/analytical/solver/analysis-results-store.ts  ← AnalysisResultsStore.get() (proactive, ADR-488)
src/subapps/dxf-viewer/bim/structural/analytical/solver/solver-types.ts            ← AnalysisResult / member end-forces / MemberForceExtrema shape
src/subapps/dxf-viewer/bim/structural/analytical/solver/member-diagrams.ts         ← M/V/N ανά μέλος (πώς διαβάζεις column end-moment)
src/subapps/dxf-viewer/bim/structural/analytical/analytical-model-types.ts         ← AnalyticalMember.entityId (map FEM member → column entity)
grep -rn "AnalysisResultsStore\|MemberForceExtrema\|endForces" src/subapps/dxf-viewer
```

### 3.3 Το proactive πρότυπο οπλισμού (REUSE — mirror, ΜΗΝ εφεύρεις)
```
src/subapps/dxf-viewer/hooks/useProactiveOrganismReinforce.ts          ← PROACTIVE_REINFORCE_EVENTS + coalesce (mirror)
src/subapps/dxf-viewer/hooks/structural-auto-reinforce-core.ts         ← runOrganismAutoReinforce
src/subapps/dxf-viewer/bim/structural/reinforce-patch.ts               ← buildReinforcePatch (column path — εδώ μπαίνει το FEM moment)
src/subapps/dxf-viewer/bim/structural/active-reinforcement.ts          ← resolveActiveColumnReinforcement* + resolveActiveBeamSupportType (το ΠΡΟΤΥΠΟ override που έκανα στο §C)
src/subapps/dxf-viewer/hooks/proactive-coalescer.ts                    ← createMicrotaskCoalescer (ΝΕΟ SSoT μου — χρησιμοποίησέ το, ΜΗΝ αντιγράψεις boilerplate)
```
🔑 **Mirror ADR-486 §C:** εκεί έβαλα `supportTypeOverride` στο context + ο command πέρασε `resolveActiveBeamSupportType(id)`. **ΚΑΝΕ ΤΟ ΙΔΙΟ:** `designMomentOverrideKnm` στο column context + ένα `resolveActiveColumnFemMoment(columnId)` (διαβάζει `AnalysisResultsStore`) που το περνά ο reinforce path.

### 3.4 Utilization (να δείξει σωστά την επάρκεια κολώνας — ADR-485)
```
src/subapps/dxf-viewer/bim/structural/utilization/member-utilization.ts  ← columnUtilization (As_req/As_prov — θα ακολουθήσει τον νέο M-N οπλισμό αυτόματα)
```

### 3.5 ADR-040 (αν αγγίξεις store/overlay)
```
docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md  ← ο FEM store είναι low-freq· ΠΟΤΕ high-freq read
```

---

## 4. ΣΧΕΤΙΚΑ ADR (διάβασε όσα αγγίζεις· code = source of truth)
**ADR-487 (ΟΡΑΜΑ — ΠΡΩΤΟ)** · **ADR-472** (load-aware reinforcement — M-N κολώνας S4, ο engine σου) · **ADR-481** (FEM solver — η πηγή ροπής) · **ADR-488** (proactive FEM — τρέχει σε κάθε κίνηση) · **ADR-486 §C** (το πρότυπο override που έκανα Phase 1) · ADR-467 (tributary load-path) · ADR-471 (unified reinforcement) · ADR-485 (utilization).

## 5. ΚΑΤΑΣΤΑΣΗ TREE (UNCOMMITTED — ΜΗΝ τα πειράξεις, είναι άλλων/προηγούμενων)
- **Δικά μου (Phase 1 + προηγούμενα, UNCOMMITTED):** ADR-486 §C (beam-size-patch + AutoSizeMembersCommand + organism-checks), ADR-488 (proactive FEM: useProactiveStructuralAnalysis + proactive-coalescer + analysis-diagram-view-store latch + structural-analysis-core silent), ADR-490 (StructuralWarningOverlay + diagnostic-highlight + diagnostic-severity-style + member-footprint-2d). **ΜΠΟΡΕΙΣ να τα REUSE· ΜΗΝ τα αλλάξεις χωρίς λόγο.**
- **Άλλου agent (shared tree, ΜΗΝ ΑΓΓΙΞΕΙΣ):** ADR-489 (column-footing continuity + dynamic foundation depth), ADR-483/484. 
- **Επόμενος ελεύθερος ADR = 491** (487=όραμα, 488/490=δικά μου, 489=άλλου, Phase 1=§C δεν πήρε νούμερο). **ΕΠΙΒΕΒΑΙΩΣΕ με `ls docs/centralized-systems/reference/adrs/` πριν δεσμεύσεις** — ο άλλος agent είναι ενεργός.
- Γνωστά **pre-existing jest failures** (ΟΧΙ δικά σου): 2 raft/slab (`maxFreeSpanM` undefined fixture, ADR-476).

## 6. ΚΑΝΟΝΕΣ (ΑΠΑΡΑΒΑΤΟΙ — CLAUDE.md)
- **PLAN-FIRST:** ADR-487 read → SSoT audit (grep §3) → πίνακας reuse vs new + απάντηση §2 (ποια A/B/C & γιατί) → plan → **περίμενε «προχώρα»** → code.
- **ADR-driven (N.0.1):** PHASE 1 read CURRENT code (code wins) → PHASE 3 update ADR-491 + ADR-472 cross-ref + adr-index + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + MEMORY (ίδιο commit).
- **Full SSoT:** ΜΗΝ φτιάξεις νέο M-N engine (υπάρχει, ADR-472 S4)· ΜΗΝ αντιγράψεις coalesce boilerplate (χρησιμοποίησε `createMicrotaskCoalescer`)· mirror το override pattern του ADR-486 §C.
- **Κόστος/ADR-040:** ο FEM store είναι low-freq· coalesce per microtask· ΠΟΤΕ high-freq read· σιωπηλά (μηδέν toast στο proactive).
- **commit/tsc = ο Giorgio.** jest = από ROOT. **Shared tree: git add ΜΟΝΟ δικά σου.** **Απάντα ΠΑΝΤΑ Ελληνικά.**

## 7. ΕΡΓΑΛΕΙΟ ΕΠΑΛΗΘΕΥΣΗΣ
2 κολώνες + δοκάρι → αποσύνδεσε τη μία (πρόβολος, engaged: άναψε «Διαγράμματα M/V/N» ή «Ανάλυση») → η **κολώνα στήριξης** πρέπει να **αυξήσει αυτόματα τον οπλισμό της** (As) για τη ροπή M=wL²/2 (όχι μόνο e₀)· το `columnUtilization` (ADR-485) πρέπει να δείχνει επάρκεια ≤1 μετά· **καμία toast** σε κάθε κίνηση. Σύγκρινε: χωρίς πρόβολο (αμφιέρειστο) → η κολώνα οπλίζεται με ονομαστική e₀ (λιγότερο).

## 8. ΑΡΧΗ ΣΧΕΔΙΑΣΗΣ (ADR-487 §3-§4)
«ΕΝΑΣ οργανισμός»: το δοκάρι-πρόβολος + η κολώνα στήριξης + το πέδιλο = ένα σύνολο. Η ροπή ρέει δοκάρι→κολώνα→πέδιλο. Phase 2 κλείνει τον κρίκο **δοκάρι→κολώνα** (το §C έκλεισε το δοκάρι). Καθαρός διαχωρισμός: ο FEM υπολογίζει (ADR-481), ο engine οπλίζει (ADR-472), η γέφυρα τα ενώνει — ΕΝΑ source of truth ανά concern, μηδέν διπλομέτρηση, coalesced.

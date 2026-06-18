# ADR-491 — FEM-driven οπλισμός κολώνας στήριξης (M-N από τον φορέα, ΟΧΙ μόνο ονομαστική εκκεντρότητα)

**Status:** ✅ Implemented (UNCOMMITTED 2026-06-18) — browser-verify εκκρεμεί
**Date:** 2026-06-18
**Author:** Opus session (συνέχεια ADR-486 §C + ADR-488)
**Υλοποιεί:** ADR-487 §3-§4 (Ζωντανός Οργανισμός — «σε κάθε κίνηση recompute») για την **κολώνα στήριξης προβόλου**.
**Phase:** 2 (Phase 1 = ADR-486 §C, αυτο-διαστασιολόγηση του ίδιου του δοκαριού-προβόλου).

---

## 1. Πλαίσιο / Πρόβλημα

Κάτοψη: 2 κολώνες + 1 δοκάρι. Ο μηχανικός αποσυνδέει τη μία κολώνα → το δοκάρι γίνεται **πρόβολος** (στηρίζεται μόνο στη δεξιά κολώνα). Ο πρόβολος μεταφέρει ροπή **M = wL²/2** στην κολώνα στήριξης.

- **Phase 1 (ADR-486 §C):** το δοκάρι αυτο-διαστασιολογείται σιωπηλά (ύψος μεγαλώνει ώστε ρ≤ρ_max).
- **Το κενό (Phase 2, αυτό το ADR):** η κολώνα στήριξης **ΔΕΝ** οπλιζόταν για τη ροπή του προβόλου — μόνο για την **ονομαστική εκκεντρότητα** EC2 §6.1(4) (`M_Ed = N_Ed·e₀`, μικρή). Άρα ανεπαρκής σε κάμψη.

**Code = source of truth — επιβεβαιωμένο με grep ΠΡΙΝ τον κώδικα:**
- Ο **M-N engine κολώνας ΥΠΑΡΧΕΙ ΗΔΗ** (ADR-472 S4): `asMomentColumnMm2(ctx)` διαβάζει `ctx.designMomentKnm` και προσθέτει καμπτική As· ο `suggestColumnReinforcement` το καταναλώνει.
- Ο **FEM ΥΠΟΛΟΓΙΖΕΙ ΗΔΗ** την κολώνα-ροπή (ADR-481, proactive μέσω ADR-488): `AnalysisResultsStore.get().envelopeByMember.get(columnId).maxAbsMoment` (kNm).
- **Το κενό = καμία γέφυρα** ανάμεσα στις δύο. Κανείς δεν τροφοδοτούσε τη FEM ροπή στο `designMomentKnm`.

→ **Phase 2 = ΓΕΦΥΡΑ, ΟΧΙ νέος engine.** Mirror του override pattern του ADR-486 §C (`resolveActiveBeamSupportType`).

---

## 2. Απόφαση — αρχιτεκτονική (η ένταση tributary ↔ FEM)

Δύο παράλληλες πηγές φορτίου συνυπάρχουν: **tributary takedown** (ADR-467, αξονικό N κολόνας) και **FEM solver** (ADR-481, πραγματικά M/V/N). Επιλογή: **(A) superposition με ρητό engaged-gate (στοιχείο C)**.

| Μέγεθος | Πηγή | Λόγος |
|---|---|---|
| **Αξονικό N** | tributary (ADR-467) | Ο FEM v1 δεν δίνει gravity column axial αξιόπιστα (ADR-481: «η αξονική κολόνας προκύπτει από το πλαίσιο»). |
| **Ροπή M** | `designMomentKnm = max(N_Ed·e₀, M_FEM)` | Superposition, ΟΧΙ διπλομέτρηση: η e₀ = κατώφλι, η FEM = πραγματική ροπή φορέα. |
| **Gate** | `isAnalysisEngaged` (ADR-488) | Η FEM ροπή εφαρμόζεται μόνο όταν ο μηχανικός «παρατηρεί στατικά». Εκτός engaged → e₀ (αποφυγή stale FEM όταν κλείσουν τα overlays). Revit «analytical results enabled». |

**Loop-safety (κρίσιμο):** ο additive οπλισμός δεν αλλάζει δυσκαμψία → ο FEM δεν επηρεάζεται· ο proactive FEM (`useProactiveStructuralAnalysis`) ΔΕΝ ακούει `bim:structural-auto-reinforced`/`bim:entities-attached` → η αλυσίδα `analysis-solved → reinforce` είναι **terminal**. Διπλό δίχτυ: `columnReinforcementMateriallyDiffers` convergence guard (ίδια ροπή → μηδέν patch → μηδέν undo storm).

**Idempotent / μηδέν regression:** χωρίς FEM result ή μη-engaged → override `undefined` → ακριβώς η σημερινή e₀ συμπεριφορά.

Απορρίφθηκε (B) πλήρης μετάβαση σε FEM για M+N (regression ρίσκο — ο FEM v1 = μόνο beam loads).

---

## 3. Υλοποίηση (SSoT — reuse, ΜΗΔΕΝ νέος engine)

### Νέα modules
- `bim/structural/analytical/column-fem-moment.ts` (pure) — `resolveColumnFemMomentKnm(result, columnId)` + `buildColumnFemMomentMap(result, columnIds)`. Καθαρό read του `AnalysisResult` (unstable/missing/μηδέν → undefined). Mirror του `buildBeamSupportTypeMap`.
- `bim/structural/analytical/engaged-analysis-result.ts` (store-coupled) — `resolveEngagedAnalysisResult()`: **ΕΝΑ SSoT για το engaged gate** «engaged → `AnalysisResultsStore.get()`, αλλιώς `EMPTY`». Το μοιράζονται render path (`resolveActiveColumnFemMoment`) ΚΑΙ persisted path (`structural-auto-reinforce-core`) → μηδέν διπλό gate, εγγυημένη parity render≡persisted.

### Γέφυρα (override, mirror ADR-486 §C `supportTypeOverride`)
- `section-context.ts` — `designMomentOverrideKnm?` σε `resolveColumnDesignLoad` (`M_Ed = max(e₀, M_FEM)`) → `buildColumnSectionContext(FromParams)` → `resolveActiveColumnReinforcement`. Παραμένει **pure**.
- `active-reinforcement.ts` — `resolveActiveColumnFemMoment(columnId)` (engaged-gated store read, mirror `resolveActiveBeamSupportType`) + `resolveActiveColumnReinforcementForEntity(column)` (FEM-aware, mirror `…BeamForEntity`). Το `…ForParams` μένει graphless fallback (ghost).

### Persisted path (ΜΟΝΟ ρητό κουμπί «Αυτόματος Οπλισμός» — one-shot, ΟΧΙ proactive)
- `reinforce-patch.ts` — `buildReinforcePatch(entity, provider, supportType?, columnFemMomentKnm?)` → column branch.
- `AutoReinforceOrganismCommand` — ctor `columnFemMomentById?` (mirror `supportTypeByBeamId`).
- `structural-auto-reinforce-core.ts` — χτίζει τον χάρτη (engaged-gated μέσω `resolveEngagedAnalysisResult`) → command.
- ⚠️ **Ο proactive auto-reinforce ΔΕΝ ακούει `bim:analysis-solved`** (βλ. §4 — θα έκλεινε infinite loop). Η ζωντανή
  ενημέρωση γίνεται read-only μέσω των active resolvers· το persisted M-N βάφεται μόνο στο ρητό κουμπί.

### Live display (read-only, ΧΩΡΙΣ persisted mutation — ο πραγματικός «ζωντανός» μηχανισμός)
- Active resolvers (`resolveActiveColumnReinforcementForEntity`, engaged-gated) → render 2Δ/3Δ + utilization δείχνουν τη FEM-aware τιμή ζωντανά (`auto:true` → re-derive σε κάθε read· μηδέν Firestore churn).

### Utilization (ADR-485, εργαλείο επαλήθευσης)
- `member-utilization.ts` — `columnUtilization(column, reinforcement, designMomentOverrideKnm?)` → As,req FEM-aware (mirror beam `supportType`).
- `StructuralUtilizationOverlay.tsx` — η ΙΔΙΑ engaged-gated ροπή τροφοδοτεί As,prov (`…ForEntity`) ΚΑΙ As,req (3ο arg) → req & prov συμφωνούν. **Leaf subscription στο `AnalysisResultsStore`** (`useSyncExternalStore`, low-freq → ADR-040 safe) → repaint όταν λύνει ο FEM.

### Render parity (5 call-sites `…ForParams` → `…ForEntity`)
- `column-rebar-3d.ts`, `joint-rebar-3d.ts`, `ColumnDetailHost.tsx`, `StructuralUtilizationOverlay.tsx`, `column-rebar-2d.ts` (+optional `columnId`· ghost μένει e₀). Caller `dxf-renderer-structural-overlays.ts` περνά `entity.id`.

**Καθαρός διαχωρισμός:** ο FEM υπολογίζει (ADR-481), ο engine οπλίζει (ADR-472), η γέφυρα (αυτό το ADR) τα ενώνει — ΕΝΑ source of truth ανά concern, μηδέν διπλομέτρηση, coalesced.

---

## 4. Συνέπειες

- ✅ Ο πρόβολος → η κολώνα στήριξης δείχνει ζωντανά (engaged) τον FEM-aware M-N οπλισμό (render + utilization)· το `columnUtilization` δείχνει >1 πριν την επάρκεια, ≤1 όταν ο οπλισμός καλύπτει το M=wL²/2.
- ✅ Μηδέν νέος M-N engine· πλήρες mirror του ADR-486 §C.
- 🐞 **INFINITE LOOP (διορθώθηκε):** η πρώτη υλοποίηση πρόσθεσε `bim:analysis-solved` στους proactive reinforce triggers → κύκλος `analysis-solved → reinforce → bim:structural-auto-reinforced → useStructuralOrganism rebuild → bim:structural-organism-updated → FEM solve (engaged) → analysis-solved → …`. Αυτοσυντηρούνταν ακόμη και σε steady state επειδή ο `runOrganismAutoReinforce` εκπέμπει event και σε no-op (count:0). **FIX:** ο proactive reinforce ΔΕΝ ακούει `bim:analysis-solved`· η ζωντανή ενημέρωση γίνεται **read-only** μέσω active resolvers + leaf subscription του overlay στο `AnalysisResultsStore` (μηδέν persisted mutation → μηδέν βρόχος, μηδέν Firestore churn). Το persisted M-N βάφεται μόνο στο ρητό κουμπί «Αυτόματος Οπλισμός» (one-shot).
- ⚠️ Τα 2Δ/3Δ rebar drawings ενημερώνονται FEM-aware στο επόμενο repaint (scene interaction)· μόνο το utilization overlay κάνει άμεσο repaint-on-solve (verification tool). Άμεσο rebar repaint-on-solve = DEFER.
- ⚠️ Ο `asStrengthColumnMm2` (ADR-472) early-returns 0 χωρίς αξονικό → η FEM ροπή προσθέτει χάλυβα μόνο όταν υπάρχει αξονικό (πάντα ισχύει για κολώνα στήριξης προβόλου). Moment-only column = engine limitation, εκτός scope.

**Google-level:** ✅ YES (μετά τη διόρθωση loop) — read-only live display (μηδέν persisted churn), loop-free (terminal chains), single source of truth ανά concern, engaged-gated (μηδέν stale), idempotent.

---

## 5. Tests (jest από ROOT)

- `column-fem-moment.test.ts` (7) — pure reader + map (unstable/missing/μηδέν/θετική).
- `column-fem-moment-bridge.test.ts` (6) — override → `designMomentKnm = max(e₀, M_FEM)` + περισσότερος χάλυβας + reinforce-patch.
- Regression GREEN: `active-column-reinforcement`, `suggest-reinforcement-*`, `reinforce-patch`/`utilization-color`/`AutoReinforceOrganismCommand`/`structural-auto-reinforce-core`.

---

## 6. Σχετικά ADR

ADR-487 (ΟΡΑΜΑ) · **ADR-472** (M-N engine κολόνας S4 — ο engine) · **ADR-481** (FEM solver — η πηγή ροπής) · **ADR-488** (proactive FEM) · **ADR-486 §C** (το override pattern που γίνεται mirror) · ADR-467 (tributary) · ADR-485 (utilization).

---

## 7. Changelog

| Ημ/νία | Αλλαγή |
|---|---|
| 2026-06-18 | **Δημιουργία + υλοποίηση.** Γέφυρα FEM column end-moment → `designMomentKnm` (max με e₀), engaged-gated, mirror ADR-486 §C. 2 νέα modules (`column-fem-moment` + `engaged-analysis-result` SSoT gate) + 10 modified. 13 νέα jest GREEN. UNCOMMITTED. |
| 2026-06-18 | **Διόρθωση INFINITE LOOP (browser freeze στο «Ανάλυση»).** Αφαιρέθηκε ο proactive trigger `bim:analysis-solved → reinforce` (έκλεινε κύκλο FEM↔reinforce). Η ζωντανή ενημέρωση γίνεται read-only μέσω active resolvers + leaf subscription του utilization overlay στο `AnalysisResultsStore`. Persisted M-N μόνο στο ρητό κουμπί. |

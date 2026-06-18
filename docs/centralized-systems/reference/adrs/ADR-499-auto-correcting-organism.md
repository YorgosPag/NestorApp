# ADR-499 — Αυτο-διορθούμενος Οργανισμός: capacity ceiling + auto-size διατομών + στρέψη + global feasibility

**Status:** 🟡 IN PROGRESS — Slice A DONE (UNCOMMITTED), Slice B/C/D PLANNED
**Date:** 2026-06-19
**Author:** Opus session (συνέχεια ADR-498)
**Υλοποιεί:** ADR-487 §3-§5 (Living Structural Organism — δυναμική επανα-διαστασιολόγηση)
**Cross-ref:** ADR-475 (auto member sizing), ADR-472 (load-aware N-M οπλισμός), ADR-486/498 (topology-aware support / cantilever slab), ADR-491/497 (FEM-driven), ADR-481/483 (FEM διαγράμματα).

---

## 1. Πρόβλημα (repro-confirmed, live DB Firestore proj_12788b6a)

2 κολώνες 400×400 + πέδιλα + δοκάρι 250×400 + **πλάκα-πρόβολος**. Μεγαλώνοντας τον πρόβολο 2.77m → 7.48m:

| Πρόβολος | Slab top σχάρα | Beam οπλισμός | Beam ύψος | Κολώνες |
|---|---|---|---|---|
| 2.77m | Ø10/75 | 2Ø22 | 400 | 400×400 |
| 7.48m | **Ø25/75** (σε πλάκα 200mm!) | **4Ø32** | **400 (ίδιο)** | **400×400 (ίδιο)** |

Ο app **οπλίζει μέλη σε απομόνωση** χωρίς: **(A)** έλεγχο αν η διατομή αντέχει την καμπτική ροπή (`M_Ed ≤ M_Rd,lim`), **(B)** μεγέθυνση διατομών (πάχος πλάκας / διατομή κολώνας δεν μεγαλώνουν ποτέ — μόνο ο οπλισμός, απεριόριστος), **(C)** στρέψη δοκαριού από μονόπλευρο πρόβολο, **(D)** global feasibility. Παράγει «οπλισμό που ικανοποιεί τη ροπή» ενώ οι **διατομές μένουν φυσικά αδύνατες**.

**Όραμα (ADR-487 §2-§4):** ο «στατικός» (η εφαρμογή) **αυτο-διορθώνει** διατομές+σίδηρο+οντότητες σε κάθε κίνηση· warning ΜΟΝΟ στην έσχατη, αποδεδειγμένα-αδύνατη περίπτωση. Η προειδοποίηση «αύξησε το πάχος» = αποτυχία του οράματος.

---

## 2. Απόφαση — 4 slices (A → B → C → D)

### A — Flexural-capacity ceiling (η ΦΥΣΙΚΗ ΠΥΛΗ) ✅ DONE (UNCOMMITTED)
NEW SSoT `codes/flexural-capacity.ts`: `M_Rd,lim = μ_lim·f_cd·b·d²` (EC2 Annex A, μ_lim≈0.295). Ο suggester (δοκάρι **και** πλάκα) **κορεστεί** τον εφελκυόμενο χάλυβα στο `A_s,lim` όταν `M_Ed > M_Rd,lim` — δεν παράγει ψεύτικη λύση (4Ø32 σε 250×400 / Ø25/75 σε 200mm). Η ανεπάρκεια διορθώνεται με μεγαλύτερη διατομή (Slice B), όχι περισσότερο σίδερο.

**Μηχανική:** ο cap εκφράζεται ως συντελεστής `min(1, M_Rd,lim/M_Ed)` επί του `A_s,strength` — ο μοχλοβραχίονας `z=0.9·d` απλοποιείται (`A_s,strength·M_Rd,lim/M_Ed = A_s,lim`), άρα το cap module δεν χρειάζεται `z`/`f_yd` ⇒ μηδέν circular import, μηδέν duplicate λεβιέ. `cap=1` όταν επαρκεί ⇒ **μηδέν regression**.

**SSoT:** `μ_lim` = provider method `flexuralLimitMuLim()` (code-specific, EC2 vs ΕΚΩΣ· τώρα 0.295 και τα δύο)· ο τύπος `μ·f_cd·b·d²` κοινός. Extracted `beamDesignMomentNmm` / `slabDesignMomentNmmPerM` = ΕΝΑ M_Ed που μοιράζονται οπλισμός + πύλη.

### B — Auto-size ΔΙΑΤΟΜΩΝ (το κύριο ζητούμενο) — PLANNED
EXTEND `member-sizing` (member-generic by design): NEW `suggestSlabThickness` (`d_req = max(L/d serviceability [ADR-498], √(M_Ed/(μ_lim·f_cd·b)) capacity)`) + `suggestColumnSection` (N-M + λυγηρότητα). NEW `slab-size-patch`/`column-size-patch` (mirror `beam-size-patch`). `AutoSizeMembersCommand` → member-generic (dispatch by kind). NEW `SlabParams.autoSized` / `ColumnParams.autoSized`. Hook στον proactive κύκλο ΠΡΙΝ τον auto-reinforce (resize → οπλισμός στη ΝΕΑ διατομή). **🚨 convergence guard** (materiallyDiffers quantized → null patch) + coalescer — μηδέν infinite-loop (μαθήματα ADR-491/488).

### C — Beam torsion από μονόπλευρο πρόβολο — PLANNED
`T_Ed = q_Ed·L_cant²/2` (reuse `computeSlabSupportConditions.cantileverLengthM`, ADR-498) → έλεγχος/σχεδίαση στρέψης EC2 §6.3 → επηρεάζει διατομή δοκαριού + συνδετήρες.

### D — Global feasibility escalation (warning ΜΟΝΟ εδώ) — PLANNED
Όταν το auto-size (B) φτάσει πρακτικό μέγιστο και ΑΚΟΜΑ δεν επαρκεί → escalate diagnostic «ανέφικτο — απαιτείται αλλαγή σχεδιασμού». Reuse `StructuralDiagnostic` + `runSlabChecks` (ADR-498). Η έσχατη παρέμβαση.

---

## 3. Αρχιτεκτονική — The auto-correction loop (ADR-487 §4)

Ο proactive κύκλος **υπάρχει ήδη** (`useProactiveMemberSizing` mount ΠΡΙΝ `useProactiveOrganismReinforce`) και τερματίζει στον convergence guard. Το B επεκτείνεται **μέσα** σ' αυτόν (slab/column patches), ΧΩΡΙΣ νέο self-sustaining trigger. Το `flexural-capacity` γίνεται η **ΕΝΑ** πηγή που οδηγεί ΚΑΙ το cap (A) ΚΑΙ το required depth (B).

---

## 4. Αρχεία

### Slice A (DONE, UNCOMMITTED)
- **NEW** `bim/structural/codes/flexural-capacity.ts` — `limitMomentNmm`, `flexuralCapacityCapFactor`.
- **NEW** `bim/structural/codes/__tests__/flexural-capacity-ceiling.test.ts` — 13 jest.
- **MOD** `codes/structural-code-types.ts` — `flexuralLimitMuLim()` στο `StructuralCodeProvider`.
- **MOD** `codes/eurocode-provider.ts` + `greek-legacy-provider.ts` — μ_lim = 0.295.
- **MOD** `codes/suggest-reinforcement.ts` — extracted `beamDesignMomentNmm` + cap στο `suggestBeamReinforcementFrom`.
- **MOD** `codes/suggest-slab-reinforcement.ts` — extracted `slabDesignMomentNmmPerM` + cap στο suspended branch.

---

## 5. Changelog

| Ημ/νία | Αλλαγή |
|---|---|
| 2026-06-19 | **Δημιουργία + Slice A.** Flexural-capacity ceiling (`M_Ed ≤ M_Rd,lim`). NEW `flexural-capacity.ts` SSoT + provider `flexuralLimitMuLim()`. Cap στον οπλισμό δοκαριού & πλάκας (saturation αντί ψεύτικου Ø25/75). 13 jest GREEN, 51 στο cluster, μηδέν regression. Roadmap B/C/D plan-first. UNCOMMITTED. |

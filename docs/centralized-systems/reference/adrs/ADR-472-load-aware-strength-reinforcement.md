# ADR-472 — Load-Aware Strength Reinforcement Design (As από N/M)

**Status:** 🟡 IN PROGRESS — **S2 DONE** (load-aware suggester, UNCOMMITTED 2026-06-17 Opus) · **S3 PENDING** (gated, μετά browser-verify + έγκριση)
**Ημ/νία:** 2026-06-17 · **Σχετικά:** ADR-459 (Στατικός Οργανισμός Φ9), ADR-467 (Load Path Engine), ADR-456/460/471 (reinforcement engines), ADR-464 (footing strength design).

---

## 1. Context — γιατί

Το όραμα του ADR-459 Φ9 (real-time στατικός βοηθός): *όταν αλλάζει η τοπολογία, ξανα-διαστασιολογείται **ο
οπλισμός όλων** των μελών.* Σήμερα **δεν** συμβαίνει για κολόνες/δοκούς, γιατί ο suggester οπλισμού είναι
**αμιγώς geometry-based**:

- `ColumnSectionContext` = `{ widthMm, depthMm, heightMm, grossAreaMm2, ... }` — **καμία αξονική/ροπή**.
- `BeamSectionContext` = `{ widthMm, depthMm, spanMm, grossAreaMm2, supportType }` — **κανένα φορτίο**.
- `suggestColumnReinforcement` / `suggestBeamReinforcement` → επιστρέφουν **ελάχιστο οπλισμό λεπτομερειών**
  (ρ_min·Ac, EC2 §9 / EC8 §5). Ίδια γεωμετρία → ίδιος οπλισμός, **ανεξάρτητα φορτίων**.

**Συνέπεια:** μετά το ADR-459 Φ9 Slice 1 (proactive φορτία), η αξονική των κολόνων ανανεώνεται όταν προστεθεί
δοκάρι — αλλά ο **οπλισμός τους δεν αλλάζει ποτέ**. Μόνο τα πέδιλα (ADR-464, ήδη A_req=N/σ) ξανα-μελετώνται.
Αυτό είναι placeholder, όχι Revit-grade enterprise μελέτη.

**Στόχος:** ο οπλισμός κολόνας/δοκαριού να γίνει **παράγωγο της αντοχής** (strength design από N/M), με κάτω
όριο τον ρ_min — ώστε «re-design ήδη-οπλισμένων σε αλλαγή τοπολογίας» να είναι **πραγματικό**.

**Αρχή «Revit-without-Robot»** (ίδια με ADR-464): conservative, code-based (EC2/ΕΚΩΣ), **FEM-free** — τα φορτία
έρχονται από τον υπάρχοντα tributary load-path engine (ADR-467), όχι από επίλυση φορέα.

---

## 2. Decision — load-aware suggester, `max(strength, min-detailing)`

### 2.1 Επέκταση SectionContext (SSoT — ΟΧΙ νέος τύπος)

Προστίθεται **optional** πεδίο φορτίου στους **υπάρχοντες** contexts (absent ⇒ σημερινή min-detailing
συμπεριφορά — backward-compatible, μηδέν regression):

```ts
interface ColumnSectionContext {
  // ... υπάρχοντα geometry πεδία ...
  readonly designAxialKn?: number;   // N_Ed (= γ_G·G + γ_Q·Q) — από LoadCombinationFactors (ULS)
  readonly designMomentKnm?: number; // M_Ed ονομαστική (αρχικά nominal eccentricity· βλ. §4)
}

interface BeamSectionContext {
  // ... υπάρχοντα geometry πεδία ...
  readonly designLineLoadKnM?: number; // w_Ed (kN/m) — tributary από ADR-467
}
```

Πηγή: το `appliedLoad` (service G/Q) **υπάρχει ήδη** σε κάθε μέλος (ADR-464/467). Ο combination factor SSoT
(`LoadCombinationFactors`, `bim/structural/loads/load-combinations.ts`) μετατρέπει service → ULS design.

### 2.2 Strength design στους providers (eurocode-provider / greek-legacy-provider)

- **Κολόνα** (EC2 §6.1, axial + nominal moment):
  As,required ≈ `(N_Ed − α_cc·f_cd·A_c) / f_yd` (όταν θετικό· αλλιώς ελάχιστο)· πλήθος/Ø από το ίδιο
  distribution SSoT (ADR-460 `distributeRectBarsBySpacing`). **Κάτω όριο: ρ_min·A_c** (το σημερινό
  `suggestColumnReinforcement`). Αρχική έκδοση = uniaxial + nominal eccentricity (e_0 = max(h/30, 20mm),
  EC2 §6.1(4)). **Biaxial / slenderness (§5.8) = DEFER.**
- **Δοκός** (EC2 §6.1, κάμψη):
  M_Ed,span ≈ `w_Ed·L²/c` (c=8 αμφιέρειστη / 12 συνεχής — υπάρχει ήδη supportType)· As ≈ `M_Ed / (0.9·d·f_yd)`.
  As,support αντίστοιχα. **Κάτω όριο: ρ_min**. Τέμνουσα V_Ed → βήμα συνδετήρων (EC2 §6.2) — προαιρετικό S3.
- **Output αμετάβλητο:** `ColumnReinforcement` / `BeamReinforcement` (ίδια interfaces) → **μηδέν αλλαγή** σε
  layout/2Δ/3Δ/PDF/auto (όλα κατάντη του suggester παραμένουν ως έχουν).

### 2.3 Stale-intent invalidation + re-study (Slice 3)

`buildReinforcePatch` σήμερα: `if (params.reinforcement) return null` (idempotent). Νέα συμπεριφορά **μόνο για
`reinforcement.auto === true`**:

1. Re-derive την strength suggestion από το **τρέχον** `appliedLoad` + γεωμετρία.
2. Αν διαφέρει **ουσιωδώς** από την stored (π.χ. ΔAs > tolerance ή πλήθος ράβδων αλλάζει) → patch με τη νέα.
3. **`auto !== true` (χειροκίνητη υπέρβαση μηχανικού) → ΠΟΤΕ overwrite** (Revit: user override wins).
4. **Convergence guard:** το re-study ενεργοποιείται **μόνο σε topology/load change**, με max-iterations
   fixed-point (π.χ. 3) ώστε ο κύκλος `φορτία → οπλισμός → (self-weight) → φορτία` να μη ταλαντώνεται.
   Ο οπλισμός αλλάζει το ίδιο βάρος ελάχιστα → πρακτικά συγκλίνει σε 1 iteration.

Wiring: ο proactive trigger είναι **ήδη εκεί** (`useProactiveOrganismReinforce` Φ8 ακούει τα geometry/load
events). Χρειάζεται μόνο: (α) ο πυρήνας `runOrganismAutoReinforce` να μην κάνει skip τα `auto:true` ήδη-
οπλισμένα όταν άλλαξε το φορτίο, (β) `bim:structural-loads-computed` ∈ τα events του (ώστε re-reinforce μετά
τα φρέσκα φορτία), με loop-guard.

---

## 3. Slices

| Slice | Περιεχόμενο | Domain | Ρίσκο |
|---|---|---|---|
| **S2** | Load-aware suggester: SectionContext += φορτίο· providers strength design (κολόνα N, δοκός M)· `max(strength, ρ_min)`· combination SSoT. jest-heavy (EC2 reference cases). | structural codes | 🟡 engineering-grade |
| **S3** | Stale-intent invalidation (`auto:true` re-derive on load change)· convergence guard· `bim:structural-loads-computed` → re-reinforce με loop-guard. | organism orchestration | 🔴 oscillation risk |

Κάθε slice ανεξάρτητα verifiable· κάθε provider αλλαγή έχει EC2 reference jest.

---

## 4. Όρια / DEFER (100% ειλικρίνεια — ΟΧΙ over-promise)

- **Biaxial bending, slenderness/buckling (EC2 §5.8), capacity design (EC8 §5.4.2.2)** = εκτός — αρχική έκδοση
  uniaxial + nominal eccentricity. Conservative, αλλά **όχι** πλήρης σεισμική ικανοτική.
- **Δεν** είναι πιστοποιημένη στατική μελέτη — είναι **preliminary auto-sizing** (όπως Revit χωρίς Robot). Ο
  μηχανικός παραμένει υπεύθυνος· κάθε χειροκίνητη υπέρβαση (`auto:false`) διατηρείται.
- M_Ed από `w·L²/c` (απλοποιημένο)· συνεχείς δοκοί χωρίς moment redistribution.
- Self-weight feedback στα φορτία = αμελητέο (convergence σε 1 iter)· δεν λύνουμε iterative coupling.

---

## 5. SSoT reuse (μηδέν διπλότυπα)

- Providers: **επέκταση** `eurocode-provider.ts` / `greek-legacy-provider.ts` (ΟΧΙ νέο σύστημα).
- Combinations: υπάρχον `LoadCombinationFactors` (`load-combinations.ts`).
- Φορτία: υπάρχον `appliedLoad` (ADR-464/467) + proactive engine (ADR-459 Φ9 Slice 1).
- Bar distribution: υπάρχον ADR-460 `distributeRectBarsBySpacing` / `rectRestrainedBarIntervals`.
- Re-study trigger: υπάρχον `useProactiveOrganismReinforce` + `structural-auto-reinforce-core` (Φ8).
- Output types: αμετάβλητα `ColumnReinforcement` / `BeamReinforcement` → όλο το render/PDF/auto pipeline intact.

---

## 6. Υλοποίηση S2 (2026-06-17, UNCOMMITTED) — αποκλίσεις/διευκρινίσεις από το spec

100% ειλικρίνεια — τι έγινε ΑΚΡΙΒΩΣ vs §2:

1. **Η strength logic ΖΕΙ στον SSoT πυρήνα, ΟΧΙ στους providers.** Οι `eurocode-provider`/`greek-legacy-provider`
   κάνουν pure delegation στο `codes/suggest-reinforcement.ts` (`resolveLongitudinalDesign`,
   `suggestBeamReinforcementFrom`, `resolveBarSet`). Εκεί προστέθηκαν οι `asStrengthColumnMm2` /
   `asStrengthBeamMm2` + `max(ρ_min·…, strength)`. Οι providers έμειναν ανέγγιχτοι (πλην του SSoT factors dedupe).
2. **`designMomentKnm` ΑΝΑΒΛΗΘΗΚΕ** (δεν προστέθηκε στο context). Λόγος: το axial-governed As του S2 δεν το
   χρησιμοποιεί, ο auto load-takedown (ADR-467) δίνει αξονικά-μόνο φορτία, και το moment/biaxial είναι ήδη DEFER
   (§4) — προστίθεται στο S3 μαζί με M-N interaction (αποφυγή unused field, YAGNI). **Context S2:**
   `ColumnSectionContext += designAxialKn? + concreteGrade?`· `BeamSectionContext += designLineLoadKnM?` (όλα optional).
3. **`concreteGrade` ΑΝΑΓΚΑΙΟ στο context** (δεν ήταν στο §2.1 spec): το `As = (N_Ed − α_cc·f_cd·A_c)/f_yd`
   απαιτεί `f_cd` → grade per-element (`ColumnParams.concreteGrade`). `f_yd` = global B500C (`rebarFydMpa`).
   Η δοκός (`As = M_Ed/(0.9d·f_yd)`) χρειάζεται μόνο `f_yd` → όχι grade.
4. **ULS combination SSoT:** νέα σταθερά `EN1990_ULS_FACTORS` (1.35/1.5) στο `loads/load-combinations.ts`· τα
   `footingDesignFactors()` ΚΑΙ των δύο providers + ο builder την αναφέρουν (boy-scout: αφαιρέθηκε το διπλό
   literal 1.35/1.5). Η combination γίνεται **μέσα στον builder** (`section-context.ts`, params-is-SSoT,
   provider-agnostic) → load-awareness συνεπές σε ΟΛΟΥΣ τους consumers (suggest + auto + read-time re-derive +
   ribbon + detail-sheet) χωρίς threading provider.
5. **Δοκός w_Ed:** το load-path (ADR-467) αποθηκεύει το ΣΥΝΟΛΙΚΟ tributary φορτίο της δοκού ως αξονικές G/Q
   (kN)· `designLineLoadKnM = W_Ed(ULS)/άνοιγμα`. `M_Ed = w·L²/c` (c=8 αμφιέρειστη / 12 αμφίπακτη / 2 πρόβολος).
6. **Output types αμετάβλητα** (`ColumnReinforcement`/`BeamReinforcement`) → μηδέν αλλαγή σε layout/2Δ/3Δ/PDF/auto.
   **Backward-compat:** απών/μικρό φορτίο ⇒ strength ≤ ρ_min ⇒ ταυτόσημο με σήμερα (επαληθευμένο σε jest).
7. **Άμεσο όφελος χωρίς S3:** ο `resolveActiveColumn/BeamReinforcement` (read-time re-derive των `auto:true`)
   χρησιμοποιεί τον ίδιο builder → οι auto-οπλισμένες κολόνες/δοκοί γίνονται **load-aware στην οθόνη/BOQ άμεσα**.
   Το S3 κάνει το **persisted** value durable + ενεργοποιεί re-study/διαγνωστικά σε load change.

**Αρχεία S2:** `loads/load-combinations.ts`, `codes/eurocode-provider.ts`, `codes/greek-legacy-provider.ts`,
`codes/structural-code-types.ts`, `section-context.ts`, `codes/suggest-reinforcement.ts`,
`codes/__tests__/suggest-reinforcement-load-aware.test.ts` (NEW, 7 tests). **Tests:** 33 codes-suggest GREEN +
253 structural sweep GREEN (μηδέν regression). tsc = Giorgio (N.17).

## 7. Changelog

- **2026-06-17 (S2 υλοποίηση, UNCOMMITTED):** Load-aware suggester — κολόνα (αξονική EC2 §6.1) + δοκός (κάμψη
  `w·L²/c`), `max(strength, ρ_min)`, output types αμετάβλητα. SSoT `EN1990_ULS_FACTORS` + providers dedupe.
  `designMomentKnm` → S3. Λεπτομέρειες §6. S3 (stale-intent re-study) gated μετά browser-verify + έγκριση.
- **2026-06-17:** Spec δημιουργήθηκε (PROPOSED) ως Slices 2/3 του ADR-459 Φ9, μετά το Slice 1 (proactive φορτία).

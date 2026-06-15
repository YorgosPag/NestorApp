# HANDOFF — Δυναμικός υπολογισμός οπλισμού κολώνας (code-driven, Revit-grade)

**Ημερομηνία:** 2026-06-15
**ADR:** **ADR-456** (Στατικά — ποσότητες/οπλισμός)· νέα φάση «Dynamic Reinforcement DESIGN». (Αν προτιμάς, νέο ADR με επόμενο ελεύθερο νούμερο από `adr-index.md` — αλλά το domain ανήκει στο ADR-456· δες Phase 1.)
**Μοντέλο:** Opus (cross-cutting: structural compute + 2Δ/3Δ render + UI + persist).
**Αίτημα Giorgio (αυτολεξεί):** «ΘΕΛΩ ΔΥΝΑΜΙΚΟ ΥΠΟΛΟΓΙΣΜΟ ΟΠΛΙΣΜΟΥ, ΟΧΙ ΤΥΧΑΙΟ/ΣΚΛΗΡΟΚΩΔΙΚΟΠΟΙΗΜΕΝΟ, ΜΕ ΒΑΣΗ ΤΟΥΣ ΕΠΙΣΗΜΟΥΣ ΚΑΝΟΝΙΣΜΟΥΣ, ΟΠΩΣ ΟΙ ΜΕΓΑΛΟΙ ΠΑΙΧΤΕΣ (REVIT). FULL ENTERPRISE + FULL SSOT.»

---

## 🚨 ΚΡΙΣΙΜΟΙ ΚΑΝΟΝΕΣ (διάβασε ΠΡΩΤΑ)
1. **Γλώσσα:** Απαντάς ΠΑΝΤΑ **Ελληνικά** στον Giorgio.
2. **COMMIT/PUSH:** τα κάνει **Ο GIORGIO**, ΟΧΙ εσύ (CLAUDE.md N.(-1)). Ποτέ `--no-verify`.
3. **Shared working tree:** δουλεύει ΚΑΙ άλλος agent → `git add` **ΜΟΝΟ τα δικά σου** αρχεία, **ΠΟΤΕ** `-A`.
4. **FULL ENTERPRISE + FULL SSOT, Revit/κανονισμός-grade.** Ρητό αίτημα. Καμία πρόχειρη/τυχαία λύση, κανένα hardcode, κανένας παράλληλος κώδικας.
5. **N.2/N.3/N.11:** ΟΧΙ `any`/`as any`/`@ts-ignore`· ΟΧΙ inline styles· ΟΧΙ hardcoded Greek/English (i18n keys el+en· δεδομένα/αριθμοί ΔΕΝ είναι i18n).
6. **N.7.1:** code files ≤500 γρ, functions ≤40 γρ.
7. **N.17 single tsc:** process-check ΠΡΙΝ, ΕΝΑ tsc τη φορά, background.
8. **N.8 EXECUTION MODE:** το task είναι **5+ αρχεία / 2+ domains (structural + 2Δ/3Δ render + UI + persist)** → **ΣΤΑΜΑΤΑ & ρώτα τον Giorgio** Orchestrator vs Plan Mode ΠΡΙΝ ξεκινήσεις κώδικα.
9. **ADR-driven (N.0.1):** Phase 1 Recognition (επαλήθευσε reuse points παρακάτω) → plan σε slices → **έγκριση Giorgio ΠΡΙΝ κώδικα** → υλοποίηση → ADR-456 + adr-index + ΕΚΚΡΕΜΟΤΗΤΕΣ + MEMORY στο ίδιο commit.
10. Δούλεψε σε **slices**, ζήτα **browser-verify (screenshot)** μετά από κάθε slice.

---

## 1. ΤΟ ΠΡΟΒΛΗΜΑ (τι παρατήρησε ο Giorgio)

Μεγάλωσε κολώνα σε **~2×2 m** και ο οπλισμός παρέμεινε **4Ø32 στις 4 γωνίες** + συνδετήρες **Φ8**. Αυτό είναι **μηχανικά λάθος**:

- **ρ (ποσοστό διαμήκους):** 4Ø32 = 3.217 mm² σε Ac=4.000.000 mm² → **ρ=0,08%**. Το EC2/ο provider απαιτεί **ρ_min** (στον κώδικα `minRatio=0.01` = 1% → As_min=40.000 mm²!). Το 4Ø32 είναι **>10× κάτω**.
- **Μέγιστη απόσταση διαμήκων (περίσφιγξη):** EC8 §5.4.3.2.2(11) — κάθε διαμήκης ράβδος συγκρατείται από συνδετήρα/**συνδετήριο**, max απόσταση **≤200 mm (DCM) / 150 mm (DCH)**. Πλευρά 2000 → **~11 ράβδοι/πλευρά + εσωτερικά cross-ties**, ΟΧΙ 4 γωνιακές.
- **Διάμετρος συνδετήρα:** EC2 §9.5.3 `dbw ≥ max(6, dbL/4)` → για Ø32 ≥8mm (οριακά)· μεγάλη DCH διατομή θέλει Φ10–Φ12 + **πολλά σκέλη/συνδετήρια**.

---

## 2. 🎯 Η ΑΚΡΙΒΗΣ ΑΙΤΙΑ (διαγνωσμένη — μη την ξανα-ψάξεις)

Ο **suggester ΥΠΑΡΧΕΙ ήδη** (καλό — επέκτεινέ τον, ΜΗΝ φτιάξεις νέο· N.0.2):
`bim/structural/codes/suggest-reinforcement.ts → suggestColumnReinforcementFrom(provider, ctx)`.

**Τι κάνει σήμερα (τα 4 κενά):**
```ts
const count = seed.minBarCount;            // ⛔ ΚΕΝΟ #1: ΣΤΑΘΕΡΟ minBarCount (=4) — ΠΟΤΕ δεν κλιμακώνεται με τη διατομή
let diameterMm = nextRebarDiameterMm(seed.minBarDiameterMm);
while (count * barAreaMm2(diameterMm) < ρ_min·Ac) diameterMm = next;  // ανεβάζει ΜΟΝΟ διάμετρο → κορεσμός στη μέγιστη εμπορική, μένει 4 ράβδοι
// ⛔ ΚΕΝΟ #2: ΚΑΜΙΑ εφαρμογή max-bar-spacing (ράβδος κάθε ≤200/150mm περιμετρικά)
// ⛔ ΚΕΝΟ #3: ΚΑΝΕΝΑ cross-tie / πολυσκελής συνδετήρας
stirrups: { diameterMm: minStirrupDiameterMm, spacingMm, spacingCriticalMm }  // single perimeter ring μόνο
```
**⛔ ΚΕΝΟ #4 (UX):** ο suggester καλείται **ΜΟΝΟ** από το «Auto» κουμπί στο `ui/ribbon/hooks/bridge/column-structural-bridge.ts` (γρ. 57, 137) — **ΟΧΙ στο resize**. Άρα αλλάζεις διατομή → ο οπλισμός μένει stale.

➡️ Γι' αυτό μια 2×2m δείχνει 4Ø32: το πλήθος είναι κλειδωμένο στο 4 και δεν επανυπολογίζεται.

---

## 3. ΤΙ ΘΕΛΕΙ Ο GIORGIO — Dynamic, code-driven design (Revit-grade)

Στόχος: **δεδομένης διατομής + κανονισμού** (χωρίς ακόμη structural analysis M-N — αυτό είναι DEFER), παράγεται **πλήρως κανονισμός-συμβατός** οπλισμός που **κλιμακώνεται δυναμικά**:

1. **Διαμήκεις:** πλήθος από **ΚΑΙ ρ_min ΚΑΙ max-bar-spacing** (= max(όσες για ρ_min, περίμετρος/max_spacing, minBarCount)), κατανεμημένες περιμετρικά (η `distributeBars` ήδη το κάνει για όποιο count δοθεί). Διάμετρος εμπορική. Σεβασμός ρ_max.
2. **Συνδετήρες/συνδετήρια (cross-ties):** όταν υπάρχουν ενδιάμεσες ράβδες → **πολυσκελείς συνδετήρες / εσωτερικά συνδετήρια** ώστε κάθε (ή κάθε δεύτερη, EC8) ράβδος να συγκρατείται. **Νέα γεωμετρία** (επέκταση `ColumnRebarLayout`).
3. **dbw** code-derived (ήδη), βήμα από confinement (ήδη).
4. **Auto-recompute στο resize** (mode «Auto») με **διατήρηση χειροκίνητης παράκαμψης** (intent) — κρίσιμη απόφαση αρχιτεκτονικής (βλ. Phase 1).
5. **FULL SSOT:** ΕΝΑ designer module που τρέφει ΚΑΙ τη ζωντανή οντότητα (create/edit/resize) ΚΑΙ το φύλλο σχεδίου ADR-457. geometry-is-SSoT διατηρείται.

**Revit benchmark:** Revit/Tekla → rebar από rules/section ή ανάλυση· εμείς (φάση 1) = **detailing-code-compliant** (ελάχιστος έγκυρος + max-spacing + cross-ties). M-N capacity design = DEFER.

---

## 4. REUSE POINTS (επαλήθευσε signatures στο Phase 1 — ΜΗΝ διπλασιάσεις)

**Κανονισμοί / suggester (εδώ είναι η καρδιά):**
- `bim/structural/codes/structural-code-types.ts` → `StructuralCodeProvider` interface· `ColumnSectionContext{widthMm,depthMm,heightMm,grossAreaMm2}`· `ColumnReinforcementLimits{minRatio,maxRatio,minBarCount,minBarDiameterMm,minStirrupDiameterMm,maxStirrupSpacingMm,criticalStirrupSpacingMm,nominalCoverMm}`· `suggestColumnReinforcement(ctx)`.
- `bim/structural/codes/eurocode-provider.ts` (limits: `minRatio:0.01`, `maxRatio:0.04`, `minBarDiameterMm:12`, `maxStirrupSpacingMm=min(20·dbL, bMin, 400)`, `criticalStirrupSpacingMm=min(bMin/2,175,8·dbL)`) + `greek-legacy-provider.ts` + `index.ts` (`resolveStructuralCode(id)`, `DEFAULT_STRUCTURAL_CODE='eurocode'`).
- `bim/structural/codes/suggest-reinforcement.ts` → **ΕΔΩ επέκτεινε** τον αλγόριθμο (count από max-spacing + cross-ties decision). ⚠️ Πιθανώς χρειάζεται **νέο πεδίο στα limits** `maxBarSpacingMm` (δεν υπάρχει — πρόσθεσέ το και στους 2 providers).
- `bim/structural/structural-settings.ts` + `state/structural-settings-store.ts` + `services/structural-settings.service.ts` + `state/hooks/useStructuralSettingsSync.ts` → building-level κανονισμός (eurocode/greek-legacy) persist σε `buildings/{id}`.

**Γεωμετρία οπλισμού (geometry-is-SSoT):**
- `bim/structural/reinforcement/column-rebar-layout.ts` → `computeColumnRebarLayout(r,w,d)` (longitudinalBarsMm, stirrupRingMm, stirrupPathMm, stirrupHookEndsMm), `distributeBars` (ήδη κατανέμει N ράβδες περιμετρικά), `computeStirrupLevelsMm`. **ΕΔΩ πρόσθεσε cross-tie geometry** (νέα πεδία στο `ColumnRebarLayout`).
- `bim/structural/reinforcement/column-reinforcement-types.ts` → `ColumnReinforcement{longitudinal{diameterMm,count}, stirrups{diameterMm,spacingMm,spacingCriticalMm,type}, coverMm}`. ⚠️ Ίσως χρειαστεί `legs`/`crossTies` πεδίο.
- `column-reinforcement-compute.ts` (quantities), `column-confinement.ts` (α), `rebar-catalog.ts` (`barAreaMm2`, `barMassPerMeterKg`, `nextRebarDiameterMm`, `REBAR_GRADE='B500C'`), `concrete-grades.ts`.

**Κατανάλωση γεωμετρίας — αν προσθέσεις cross-ties πρέπει να ρέουν παντού (δες `reference_2d_dxf_pipeline_bim_entity` — 6 render + 3 selection σημεία):**
- 2Δ: `bim/structural/reinforcement/column-rebar-2d.ts` (αν υπάρχει) + `detail-sheet/column-detail-plan.ts` + `column-detail-elevation.ts`.
- 3Δ: `bim-3d/converters/column-rebar-3d.ts` (`buildColumnRebarCage`).
- Schedule: `detail-sheet/column-detail-schedule.ts` (πλήθος/μήκος/βάρος συνδετηρίων).

**Call sites για auto-recompute:**
- `ui/ribbon/hooks/bridge/column-structural-bridge.ts` (γρ. 57/137 — «Auto»).
- `core/commands/entity-commands/UpdateColumnParamsCommand.ts` (εδώ περνά το resize → υποψήφιο hook για auto-recompute).

---

## 5. ΠΡΟΤΕΙΝΟΜΕΝΑ SLICES (πρότεινε στον Giorgio, ζήτα έγκριση)

- **Slice 1 — Δυναμικό πλήθος διαμήκων:** πρόσθεσε `maxBarSpacingMm` στα limits (eurocode+greek)· στον suggester `count = max(minBarCount, ceil(perimeter/maxBarSpacing με round σε άρτιο/συμμετρικό), όσες για ρ_min)`· διάμετρος για ρ_min ΕΝΤΟΣ ρ_max. (structural-only· tests· browser-verify: 2×2m → πολλές ράβδοι.)
- **Slice 2 — Cross-ties / πολυσκελείς συνδετήρες:** νέα γεωμετρία στο `column-rebar-layout` (εσωτερικά συνδετήρια ανά EC8) → ρέει σε 2Δ plan/elevation + 3Δ cage + schedule (μήκη/βάρη). (cross-cutting.)
- **Slice 3 — Auto-recompute on resize:** mode «Auto» (flag στο reinforcement ή structural-settings) → στο `UpdateColumnParamsCommand`/bridge re-derive όταν αλλάζει διατομή· **διατήρηση manual override**. Απόφαση persist: store `auto` flag + derive on the fly (geometry-is-SSoT) **VS** store computed. → **ρώτα τον Giorgio στο Phase 1.**
- **Slice 4 — Warnings:** flag ρ<ρ_min / spacing>max στο schedule/UI.
- **DEFER:** M-N capacity design (απαιτεί φορτία/ανάλυση).

---

## 6. PHASE 1 RECOGNITION CHECKLIST (πριν το plan)
1. Διάβασε `suggest-reinforcement.ts` + `eurocode-provider.ts` + `structural-code-types.ts` (limits) — επιβεβαίωσε τα 4 κενά.
2. Βρες αν υπάρχει `column-rebar-2d.ts` και πώς το `distributeBars` τρέφει 2Δ/3Δ.
3. Επιβεβαίωσε πού περνά το resize (`UpdateColumnParamsCommand`) → σημείο για auto-recompute.
4. Απόφαση architecture: (α) auto-flag+derive vs store computed· (β) νέο `maxBarSpacingMm` limit· (γ) cross-tie model στο `ColumnRebarLayout`. → ρώτα Giorgio όπου είναι product/architectural.
5. **N.8:** δήλωσε execution mode + ρώτα.

---

## 7. ΚΑΤΑΣΤΑΣΗ TREE — ADR-457 (προηγούμενη δουλειά, UNCOMMITTED)

Στο ίδιο working tree υπάρχουν **UNCOMMITTED** αλλαγές ADR-457 (φύλλο σχεδίου οπλισμού — DONE & browser-verified, ο Giorgio θα κάνει commit):
- Slices 0–5 + spiral-continuity(A) + spacing-dims(B) + 3Δ enlargement (`FIT_MARGIN 1.06`). 56 detail-sheet jest GREEN, tsc clean.
- Αρχεία: `bim/structural/detail-sheet/**`, `bim-3d/converters/column-rebar-3d.ts`, `bim/structural/reinforcement/column-rebar-layout.ts`, `ui/components/column-detail/**`, `i18n/locales/{el,en}/dxf-viewer-shell.json`, ADR-457, ΕΚΚΡΕΜΟΤΗΤΕΣ.
- ⚠️ **`git add` ΜΟΝΟ τα ΔΙΚΑ ΣΟΥ νέα αρχεία** — μην αγγίξεις/κάνεις stage τα παραπάνω αν δεν είναι δικά σου.
- ⚠️ Θα **αγγίξεις ξανά** `column-rebar-layout.ts` (cross-ties) που είναι ήδη modified από το ADR-457 → συντόνισε (MIXED file· stage προσεκτικά).

---

## 8. VERIFY (browser) ανά slice
`/dxf/viewer` → φτιάξε/επίλεξε RC κολώνα → άλλαξε διατομή σε **μεγάλη (π.χ. 2000×2000)**:
- **Slice 1:** ο οπλισμός γίνεται **πολλές διαμήκεις περιμετρικά** (όχι 4), ρ ≥ ρ_min, ράβδος κάθε ≤200mm.
- **Slice 2:** φαίνονται **εσωτερικά συνδετήρια** σε 2Δ κάτοψη + 3Δ + στον πίνακα χάλυβα.
- **Slice 3:** αλλάζεις διατομή → ο οπλισμός **επαναϋπολογίζεται αυτόματα** (Auto), αλλά χειροκίνητη τιμή παραμένει.

**Memory:** `reference_structural_quantities_ssot.md` (ADR-456), `reference_column_detail_sheet_ssot.md` (ADR-457), `reference_2d_dxf_pipeline_bim_entity.md` (σημεία render/selection για νέα BIM γεωμετρία).
**ADR + tracker:** `docs/centralized-systems/reference/adrs/ADR-456-structural-quantities-reinforcement.md` · `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` · `adr-index.md`.

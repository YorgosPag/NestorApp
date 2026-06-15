# HANDOFF — Structural Organism: DEFER backlog (Phase 4e + 4f + Phase 3 + Phase 5)

**Ημερομηνία:** 2026-06-15
**Συντάκτης:** Opus 4.8 (συνεδρία Phase 4d + contextual parity)
**Θέμα νέας συνεδρίας:** Τα **DEFER** items του ADR-459 «Στατικός Οργανισμός», ομαδοποιημένα σε συνεκτικές φάσεις. **FULL ENTERPRISE + FULL SSoT + Revit-grade** (πρότυπο Revit Structural / Analytical Model + EC2/EC8).

> ⚠️ **ΓΛΩΣΣΑ:** Απαντάς ΠΑΝΤΑ Ελληνικά (CLAUDE.md LANGUAGE RULE).
> ⚠️ **COMMIT:** Ο Giorgio κάνει τα commit/push, ΟΧΙ εσύ. Ποτέ `git commit`/`push` χωρίς ρητή εντολή (N.(-1)).
> ⚠️ **SHARED WORKING TREE:** Δουλεύει κι άλλος agent ταυτόχρονα (ADR-460 multishape columns/walls — αγγίζει `codes/*`, `column-section-outline`, column/wall reinforcement). `git add` ΜΟΝΟ τα δικά σου αρχεία — **ΠΟΤΕ** `git add -A`.
> ⚠️ **TSC (N.17):** Πριν τρέξεις `tsc` έλεγξε ότι δεν τρέχει ήδη άλλος (`Get-CimInstance Win32_Process … *tsc*`). Ένα tsc τη φορά, σειριακά.
> ⚠️ **MODEL (N.14):** cross-cutting (compute + checks + command + ribbon + i18n) → **Opus**. Δήλωσέ το.
> ⚠️ **i18n (N.11):** ΚΑΘΕ νέο `t('key')` → πρώτα keys σε `el` ΚΑΙ `en` locale JSON, ΜΕΤΑ κώδικας. ICU single-brace `{x}` (ΟΧΙ `{{x}}`, CHECK 3.9).
> ⚠️ **ADR-driven (N.0.1):** PHASE 1 (διάβασε CURRENT CODE) → πρότεινε plan → ΕΓΚΡΙΣΗ ΠΡΙΝ κώδικα → υλοποίηση → ADR update.

---

## ΜΕΡΟΣ 0 — ΚΑΤΑΣΤΑΣΗ ΤΩΡΑ (τι είναι committed vs uncommitted)

- **Phase 0+1+2 = COMMITTED `f23becb8`** (graph + «λείπει το πέδιλο» + explicit FK κολόνα↔πέδιλο).
- **Phase 4a+4b+4c+4d + contextual parity = DONE, UNCOMMITTED** (284 structural/bridge jest GREEN, tsc-clean). Ο Giorgio κάνει browser-verify + commit. **Ιδανικά αυτή η νέα δουλειά χτίζεται πάνω σε committed 4d**· αν δεν έχει γίνει commit, δουλεύεις στο ίδιο working tree.
- **Όλη η reinforcement υποδομή ΗΔΗ ΥΠΑΡΧΕΙ** (μην την ξαναφτιάξεις — REUSE, N.0.2):
  - `bim/structural/section-context.ts` — SSoT entity→SectionContext (κολόνα shape-aware/δοκάρι/πέδιλο) + `buildReinforcePatch`.
  - `bim/structural/codes/` — providers EC/legacy + `*Limits` + `suggest*` + `lapLengthMm`/`anchorageLengthMm` + `resolveStructuralCode`.
  - `bim/structural/codes/suggest-reinforcement.ts` — `resolveBarSet`/`resolveMatMesh` SSoT bar-selection.
  - `bim/structural/reinforcement/{column,beam,footing}-reinforcement-{types,compute}.ts`.
  - `bim/structural/organism/`: `structural-graph.ts` (graph), `organism-checks.ts` (geometry checks), `reinforcement-checks.ts` (Φ4d διαγνωστικά), `reinforcement-continuity.ts` (Φ4c).
  - `core/commands/entity-commands/AutoReinforceOrganismCommand.ts` + `AttachColumnFootingCommand.ts`.
  - `hooks/useStructuralOrganism.ts` (surfacing) + `useStructuralAutoReinforce.ts` (auto-apply).

---

## ΜΕΡΟΣ 1 — GROUND TRUTH (διάβασε ΠΡΙΝ κώδικα — code = source of truth)

### Diagnostics signature (Φ4d, η βάση για νέα warnings)
- `organism/reinforcement-checks.ts` → `runReinforcementChecks(graph, entities, provider)`. **ΕΔΩ προσθέτεις** νέους checks (νέο code στο `StructuralDiagnosticCode` + i18n el+en + push στο runner). `StructuralDiagnostic` έχει ΗΔΗ `severity 'error'|'warning'|'info'` + optional `messageParams`.
- Surfacing: `useStructuralOrganism` ήδη κάνει `store.set([...runOrganismChecks, ...runReinforcementChecks])` με active code. ΚΑΘΕ νέος check φαίνεται αυτόματα στο `EntityWarningsSection` (info/warning/error tone υπάρχουν).

### Continuity (Φ4c — η βάση για E1/E2)
- `organism/reinforcement-continuity.ts` → `computeOrganismReinforcementContinuity(graph, entities, provider)`. Per-edge handlers: `footingBearingContinuity`/`columnBearingContinuity`/`topAttachmentContinuity`. Επιστρέφει `items`/`byMember`/`columnDevelopmentMm`/`beamDevelopmentMm`.
- **E1 σημείο:** `topAttachmentContinuity` επιστρέφει `null` αν ένα από τα 2 μέλη ΔΕΝ είναι κολόνα (host=δοκάρι/πλάκα). Εκεί λείπει (α) η αγκύρωση των διαμήκων της κολόνας ΜΕΣΑ στον host + (β) warning.
- **E2 σημείο:** το πέδιλο (pad) δεν τροφοδοτεί δικές του ράβδους στο continuity — μόνο φιλοξενεί dowels. Pad own-bar continuity = ανάπτυξη/γάντζοι των ράβδων σχάρας στα άκρα (ήδη το `footing-reinforcement-compute` βάζει `MAT_END_ANCHORAGE_FACTOR=12·Ø` flat· το organism-aware refinement = DEFER).

### Foundation vs Slab (E3)
- `FoundationEntity` (pad/strip/tie-beam) έχει πλήρες `FootingReinforcement` (Φ4b).
- **ΑΛΛΑ** η εδαφόπλακα/raft = `SlabEntity` kind `'foundation'`/`'ground'`. Το `SlabParams.reinforcement` είναι **μόνο hint enum** (`'one-way'|'two-way'|'waffle'|'flat'`) — ΟΧΙ πραγματικό μοντέλο ποσοτήτων. Στον graph η raft είναι ήδη `footing` node (entityType `'foundation-slab'`). **E3 = νέο πραγματικό slab reinforcement model** (δι-διευθυντική σχάρα top+bottom· REUSE `resolveMatMesh`) + suggester + compute + ένταξη στο `buildReinforcePatch` + checks.

### Section adequacy — ΣΥΝΟΡΟ (Phase 3)
- **Υπάρχουν ήδη per-entity validators:** `bim/validators/{column,beam,foundation,slab}-validator.ts` που flag-άρουν code violations (min dims, slenderness, span/depth — π.χ. `MAX_SPAN_DEPTH_RATIO`, `MIN_BEAM_WIDTH_MM`). Αυτά γράφουν στο `entity.validation` (per-entity, badge στο ribbon).
- **Άρα η Phase 3 ΔΕΝ ξαναφτιάχνει min-dims** — είναι **organism-level ADVISORY**: «η διατομή είναι μικρή για τον ρόλο της + ΠΡΟΤΑΣΗ μεγαλύτερης» (Revit «Check» + auto-suggest). Χωρίς φορτία (Phase 5) = detailing/heuristic adequacy (slenderness λ, span/depth, ρ-headroom). **SSoT:** πρόσθεσε `sectionAdequacy*` στον provider (μην διασκορπίσεις thresholds).

### Manual attach/detach (Phase 4f)
- **Pattern ΕΤΟΙΜΟ:** `AttachColumnFootingCommand` (attach FK) + `DetachColumnsCommand`/`DetachWallsCommand` (πρότυπο detach). Manual wall attach/detach από ribbon = ADR-401 Phase E.1 (`bim:columns-attached-manual`/`bim:columns-detached` + toasts στο `structural-attach-notifications.ts`).
- **4f = NEW `DetachColumnFootingCommand`** (clear `footingId`) + ribbon UX στην κολόνα/πέδιλο: «Σύνδεση σε πέδιλο» / «Αποσύνδεση». Selection-pair (επίλεξε κολόνα + πέδιλο → attach) ή contextual. Mirror του wall manual flow.

---

## ΜΕΡΟΣ 2 — ΟΙ ΦΑΣΕΙΣ (ομαδοποίηση + Revit-grade + SSoT design)

### 🟢 Phase 4e — Ολοκλήρωση οργανικής συνέχειας οπλισμού (ΣΥΝΙΣΤΩΜΕΝΟ ΠΡΩΤΟ — μικρό, καθαρό, χτίζει στο 4c/4d)
- **E1 — top-attachment host μη-κολόνα:** στο `topAttachmentContinuity`, όταν ο host είναι δοκάρι/πλάκα: (α) πρόσθεσε `anchorage` item των διαμήκων κολόνας μέσα στον host (lbd, EC8 §5.6) αντί lap· (β) νέος warning code `columnTopAnchorageUnverified` (info/warning) στο `reinforcement-checks` όταν ο host δεν έχει reinforcement/δεν επαληθεύεται η αγκύρωση. SSoT: reuse `anchorageLengthMm`.
- **E2 — footing pad own-bar continuity:** organism-aware ανάπτυξη ράβδων σχάρας πεδίλου στα άκρα (αντικαθιστά το flat `MAT_END_ANCHORAGE_FACTOR` όπου ο graph δίνει πραγματικό edge). Προαιρετικό `continuity` param στο `computePadQuantities`. Μικρό.
- **E3 — footing-slab (raft/εδαφόπλακα) reinforcement:** NEW `SlabFoundationReinforcement` μοντέλο (top+bottom δι-διευθυντική σχάρα· REUSE `resolveMatMesh`) + provider `suggestSlabFoundationReinforcement` + compute + ένταξη στο `buildReinforcePatch` (isSlabEntity foundation/ground) + reinforcement-checks (missing/ratio). Προσοχή: το `SlabParams.reinforcement` (hint enum) μένει· το structural μοντέλο είναι ξεχωριστό πεδίο (π.χ. `structuralReinforcement?`) ώστε να μη σπάσει το υπάρχον BOQ-hint. **Το μεγαλύτερο κομμάτι του 4e.**

### 🟢 Phase 4f — Manual connectivity UX (ribbon)
- NEW `DetachColumnFootingCommand` (mirror `AttachColumnFootingCommand`· undoable· clear `footingId`).
- Ribbon στην κολόνα (contextual): «Σύνδεση σε πέδιλο» (selection-pair ή pick) + «Αποσύνδεση πεδίλου». Events `bim:column-footing-attached-manual`/`bim:column-footing-detached` + toasts (`structural-attach-notifications.ts`). Mirror ADR-401 E.1.

### 🟡 Phase 3 — Section adequacy (DERIVED advisory + auto-suggest μεγαλύτερης διατομής)
- NEW `organism/section-adequacy-checks.ts` (ή επέκταση reinforcement-checks): `sectionTooSmall` (info/warning) με ΠΡΟΤΑΣΗ διαστάσεων. Heuristic χωρίς φορτία: slenderness, span/depth, ρ-headroom (ρ κοντά σε ρ_max → πρότεινε μεγαλύτερη διατομή). **SSoT:** `provider.sectionAdequacyLimits(ctx)`. ΣΥΝΟΡΟ: ΜΗΝ διπλασιάσεις τα per-entity validators (min dims ζουν εκεί) — εδώ μόνο organism advisory + suggestion. Προαιρετικά `SuggestLargerSectionCommand` (undoable).

### 🔴 Phase 5 — Loads / M-N analysis (ΜΕΓΑΛΟ — ΞΕΧΩΡΙΣΤΟ ADR, πιθανώς πολλαπλές συνεδρίες)
- Πραγματική στατική επάρκεια: μοντέλο φορτίων (G/Q/W/E), συνδυασμοί EC0, M-N interaction diagram, διάτμηση, βελτιστοποίηση οπλισμού βάσει εντατικών. **ΜΗΝ το ξεκινήσεις σε αυτή τη συνεδρία** — πρότεινε νέο ADR (π.χ. ADR-46x «Structural Analysis & Loads»). Εδώ μόνο ως roadmap.

---

## ΜΕΡΟΣ 3 — ENTERPRISE/SSoT ΑΡΧΕΣ (ΑΠΑΡΑΒΑΤΕΣ)
- **Diagnostics = DERIVED** (store/panel, ΠΟΤΕ `entity.validation` — αυτό ανήκει στους per-entity validators). **Reinforcement intent = persisted** (μόνο μέσω command). **Continuity/adequacy = DERIVED**.
- **ΕΝΑ SSoT** για: bar-selection (`resolveBarSet`/`resolveMatMesh`), lap/anchorage (provider), code-selection (`resolveStructuralCode`+building `structural-settings`), entity→SectionContext (`section-context.ts`), reinforce dispatch (`buildReinforcePatch`). **REUSE — μην ξαναγράψεις.**
- **N.7.1:** αρχεία ≤500 γρ., functions ≤40 (σπάσε per-check/per-kind handlers). **N.2:** no `any`/`as any`. **N.6:** command id μέσω `generateEntityId`. **ADR-040 safe** (organism = low-freq EventBus).
- **Tests:** mirror `reinforcement-checks.test.ts` + `AutoReinforceOrganismCommand.test.ts` (hand-built graph + realistic entity fixtures + DERIVED invariant). Μηδέν browser.
- **Provider:** νέες μέθοδοι → υλοποίηση ΚΑΙ στους 2 (eurocode + greek-legacy). ⚠️ τα `codes/*` files είναι MIXED με ADR-460 → git add ΜΟΝΟ δικά σου.

---

## ΜΕΡΟΣ 4 — ΠΡΩΤΑ ΒΗΜΑΤΑ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ
1. Διάβασε αυτό το handoff + **ADR-459** (§6c/6e/6f + Phase tables) + τα ground-truth αρχεία (ΜΕΡΟΣ 1: reinforcement-checks, reinforcement-continuity, section-context, suggest-reinforcement, structural-code-types, footing-reinforcement-compute, slab-types, AttachColumnFootingCommand + DetachColumnsCommand, column/beam/foundation validators).
2. **Δήλωσε μοντέλο** (Opus).
3. **PHASE 1 (N.0.1):** επιβεβαίωσε ground truth — ειδικά (α) πού επιστρέφει `null` το `topAttachmentContinuity` (E1), (β) το slab structural reinforcement κενό (E3), (γ) το manual attach pattern (DetachColumnsCommand + ADR-401 E.1).
4. **ΣΥΝΙΣΤΩΜΕΝΗ ΣΕΙΡΑ** (πρότεινε plan + ζήτα έγκριση — ΜΗΝ γράψεις κώδικα πριν):
   - **Phase 4e πρώτα** (E1→E2→E3): ολοκληρώνει την οργανική συνέχεια, καθαρό SSoT, χτίζει απευθείας στο 4c/4d.
   - **Phase 4f** (manual attach/detach) — ανεξάρτητο, ribbon-focused.
   - **Phase 3** (adequacy advisory) — μετά, με προσοχή στο σύνορο validators.
   - **Phase 5** (loads) — ΞΕΧΩΡΙΣΤΟ ADR, μην το πιάσεις εδώ.
   - ⚠️ Αν ο Giorgio δεν ορίσει αλλιώς, πρότεινε να γίνει **ΜΟΝΟ η Phase 4e** σε αυτή τη συνεδρία (μία συνεκτική παράδοση), και οι υπόλοιπες σε επόμενες.
5. commit = Giorgio· shared tree → `git add` ΜΟΝΟ δικά σου (⚠️ `codes/*` MIXED με ADR-460)· ένα tsc τη φορά (N.17).
6. Μετά την υλοποίηση: ενημέρωσε ADR-459 (νέο §6g + changelog + status) + `adr-index.md` + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + MEMORY (N.15).

**ADR αναφορές:** ADR-459 (master), ADR-456 (στατικά/ποσότητες SSoT), ADR-458 (DERIVED philosophy), ADR-401 (manual attach pattern), ADR-040 (canvas perf — μην αγγίξεις high-freq), ADR-017/210/294 (enterprise IDs).

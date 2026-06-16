# HANDOFF — ADR-464 Advanced Footing Reinforcement (Revit-grade)

**Ημερομηνία:** 2026-06-16 · **Συντάκτης:** Opus 4.8 (συνεδρία ADR-463) · **Μοντέλο νέας συνεδρίας:** Opus
**Στόχος (Giorgio):** Να ενσωματώσουμε στην εφαρμογή τις **προηγμένες περιπτώσεις οπλισμού θεμελίωσης** που σήμερα λείπουν — **άνω σχάρα** (top mesh), **έκκεντρα πέδιλα**, **κοιτοστρώσεις/raft**, **ειδικές εδαφικές συνθήκες** — όπως οι μεγάλοι παίκτες (Revit). **FULL ENTERPRISE + FULL SSOT.**

---

## ⚠️ ΚΑΝΟΝΕΣ (απαράβατοι)
- **Ελληνικά** πάντα στις απαντήσεις.
- **COMMIT/PUSH τα κάνει ο Giorgio**, ΟΧΙ ο agent. **Shared working tree με άλλον agent → `git add` ΜΟΝΟ τα δικά σου αρχεία**, ΠΟΤΕ `git add -A`.
- **GOL + SSOT**: πριν γράψεις κώδικα → `grep`/`Glob` για υπάρχοντα (το reuse-map παρακάτω), ΜΗΔΕΝ διπλότυπα, function ≤40 γρ., file ≤500 γρ., zero `any`/`as any`/`@ts-ignore`, i18n keys (όχι hardcoded strings).
- **PLAN-FIRST**: research → πρότεινε Revit-grade σχέδιο (πάρε ΕΣΥ τις enterprise αποφάσεις, μη ρωτάς τον Giorgio να διαλέξει standard options) → ζήτα έγκριση plan → υλοποίηση.
- **N.17 single-tsc**: ΕΝΑ `tsc` τη φορά — έλεγξε ότι δεν τρέχει άλλος πριν ξεκινήσεις.
- **ADR νούμερο = ADR-464** (το 463 είναι το τελευταίο). Νέο αρχείο: `docs/centralized-systems/reference/adrs/ADR-464-advanced-footing-reinforcement.md` + ενημέρωση adr-index + tracker.

## 📌 ΠΡΟΑΠΑΙΤΟΥΜΕΝΟ (κατάσταση tree)
Το **ADR-463 (Slices 0-7 + 2 browser-fixes)** είναι **UNCOMMITTED** — ο Giorgio θα το κάνει commit. Χτίζεις ΠΑΝΩ σε αυτό. Σχετικά αρχεία ADR-463 που αγγίζεις πιθανώς (μην τα σπάσεις):
`footing-reinforcement-types.ts`, `footing-reinforcement-compute.ts`, `section-context.ts`, `active-footing-reinforcement.ts`, `footing-rebar-2d.ts`, `footing-rebar-3d.ts`, `footing-detail-*`, `foundation-advanced-panel/`, `foundation-structural-*`.

---

## 🔍 REUSE-MAP (έρευνα ΗΔΗ έγινε — ΧΡΗΣΙΜΟΠΟΙΗΣΕ τα, ΜΗΝ διπλασιάσεις)

### Suggester (η καρδιά της αυτοματοποίησης)
`bim/structural/codes/suggest-reinforcement.ts`:
- `suggestFootingReinforcementFrom(provider, ctx)` (γρ. 238) — **ΕΔΩ ΕΙΝΑΙ ΤΟ ΚΕΝΟ**: για `pad` παράγει **ΜΟΝΟ** `bottomMeshX` + `bottomMeshY` — **ΠΟΤΕ `topMesh`**. Για `strip` → εγκάρσιες + διαμήκεις (όχι συνδετήρες). `tie-beam` → delegate στον beam suggester.
- `resolveMatMesh(asPerMetre, seedDia, maxSpacing)` — SSoT spacing-based επιλογή σχάρας (reuse για κάθε νέα σχάρα/στρώση· ΜΗΝ ξαναγράψεις).
- `resolveBarSet(...)` — SSoT bar-count/diameter.
- `suggestSlabFoundationReinforcementFrom(...)` (γρ. 286) — **raft/κοιτόστρωση ΗΔΗ ΠΛΗΡΗΣ**: δίνει `bottomMeshX/Y` + `topMeshX/Y` δι-διευθυντικά. (Ο raft είναι `SlabEntity` kind `foundation`/`ground`, ΟΧΙ `FoundationEntity` — βλ. `isFoundationSlabEntity`.) Άρα «κοιτόστρωση με άνω+κάτω σχάρα» = ΗΔΗ ΕΓΙΝΕ· ίσως θέλει μόνο UI parity/ανάδειξη.

### Types
- `bim/structural/reinforcement/footing-reinforcement-types.ts` — `PadReinforcement.topMesh?: RebarMesh` **ΥΠΑΡΧΕΙ ΗΔΗ** (απλώς δεν προτείνεται αυτόματα). `StripReinforcement.stirrups?`. `formatMeshLabel`/`formatFootingMainLabel`.
- `bim/structural/codes/structural-code-types.ts` — `PadSectionContext {widthMm,lengthMm,thicknessMm,grossAreaMm2}`, `StripSectionContext`, `TieBeamSectionContext`. **ΔΕΝ έχουν** eccentricity/loads/soil πεδία. `StructuralCodeProvider.footingReinforcementLimits(ctx)` → `FootingReinforcementLimits` (minRatio/minBarDiameter/maxBarSpacing/nominalCover/minLongitudinalBarCount).
- Providers: `codes/eurocode-provider.ts` + `codes/greek-legacy-provider.ts` (delegate στο suggest-reinforcement· μόνο τα LIMITS διαφέρουν).

### Compute / Section-context / Render / UI (όλα ADR-463, reuse)
- `footing-reinforcement-compute.ts` — `computeFootingReinforcementQuantities` (ήδη χειρίζεται `topMesh` → secondary· βλ. `computePadQuantities`).
- `section-context.ts` — `buildFootingSectionContext(entity)` + `buildFoundationReinforcePatch(entity, provider)` (auto-reinforce· idempotent skip αν υπάρχει ήδη).
- `active-footing-reinforcement.ts` — passthrough stored design.
- 2Δ `footing-rebar-2d.ts` (`drawPad` ΗΔΗ ζωγραφίζει `topMesh` αν υπάρχει), 3Δ `footing-rebar-3d.ts` (`buildPadCage` ΗΔΗ χτίζει top σχάρα αν υπάρχει), detail `footing-detail-*` (schedule/titleblock/elevation ΗΔΗ δείχνουν secondary/top).
- UI: `ui/foundation-advanced-panel/foundation-property-fields.ts` (descriptor — έχει ήδη `padTopEnabled`/`padTopDiameter`/`padTopSpacing` keys), `foundation-structural-param.ts`/`-bridge.ts`, `foundation-command-keys.ts` (`FOUNDATION_STRUCTURAL_KEYS`).
- Auto-reinforce: `hooks/useStructuralAutoReinforce.ts` + `core/commands/entity-commands/AutoReinforceOrganismCommand.ts`.
- Organism FK (για εκκεντρότητα): `bim/structural/organism/` — η κολώνα→πέδιλο σύνδεση (`footingId`/`columnId`) υπάρχει (ADR-459 Phase 2). Η **γεωμετρική εκκεντρότητα** (offset κέντρου κολώνας από κέντρο πεδίλου) είναι παραγώγιμη ΧΩΡΙΣ φορτία.

---

## 🧱 ΚΟΜΒΙΚΟ ΕΜΠΟΔΙΟ / SCOPE DECISION (αποφάσισε στο plan)
**Τα φορτία/ροπές είναι DEFERRED** (ADR-459 Phase 5 — δεν υπάρχει analysis engine). Πραγματική διαστασιολόγηση «έκκεντρου/εδαφικών συνθηκών» κατά EC2 θέλει φορτία. Ο Revit ΔΕΝ αυτο-σχεδιάζει χωρίς analysis link — δίνει **έλεγχο + code-driven defaults** (rebar types/rules), και η ανάλυση (Robot) κάνει το design.

→ **Προτεινόμενο enterprise scope ΧΩΡΙΣ loads engine** (πρότεινέ το, εκλέπτυνε):
- **A. Top mesh first-class (pad):** auto-enable με **code-driven γεωμετρικό κανόνα** (π.χ. πάχος/overhang ratio, ή «δομικά απαιτείται» flag) + manual override. Η υδραυλική υπάρχει ολόκληρη (type/compute/2Δ/3Δ/detail/panel) — λείπει ΜΟΝΟ ο **κανόνας στον suggester** (`suggestFootingReinforcementFrom` pad branch → πρόσθεσε `topMesh` υπό συνθήκη) + ίσως πλουσιότερο limits (`topMeshMinRatio`).
- **B. Έκκεντρο πέδιλο:** παράγωγη γεωμετρική εκκεντρότητα από τη φιλοξενούμενη κολώνα (organism FK) → ενεργοποίηση/ενίσχυση άνω σχάρας (hogging) + Revit-grade detailing. Καθαρά γεωμετρικό, ΧΩΡΙΣ φορτία.
- **C. Raft/κοιτόστρωση:** ήδη πλήρες (slab-foundation top+bottom) — parity/ανάδειξη στο UI (πιθανώς μηδέν νέος compute).
- **D. Εδαφικές συνθήκες:** νέο building/footing-level `soilBearingCapacity` setting (reuse `structuralSettingsStore` pattern) → advisory έλεγχος επάρκειας έδρασης (μήνυμα/badge), **πλήρης design DEFERRED στο loads phase**.

**Εναλλακτικά** (αν ο Giorgio θέλει πλήρες design τώρα): πρώτα χρειάζεται mini loads model — μεγαλύτερο, ξεχωριστό ADR. Ανάδειξέ το στο plan ως trade-off.

---

## ✅ ΒΗΜΑΤΑ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ
1. Διάβασε ADR-456/459 (§Phase 4b/4e) + αυτό το handoff + τα reuse αρχεία.
2. Επιβεβαίωσε scope με τον Giorgio (A-D vs full loads) — πρότεινε A+B+C+D (Revit-grade χωρίς analysis), εξήγησε το loads trade-off.
3. Plan mode → έγκριση.
4. Υλοποίηση SSoT (επέκταση suggester + limits + section-context εκκεντρότητα + UI/auto-reinforce· reuse compute/render/detail) + jest + ADR-464 + adr-index + tracker + memory.
5. `git add` ΜΟΝΟ δικά σου (shared tree). Ενημέρωσε τον Giorgio να κάνει commit/browser-verify.

# HANDOFF — ADR-459 Αυτόματος Σχεδιασμός Θεμελίωσης (auto-decide μεμονωμένο vs ενιαίο πέδιλο)

**Ημ/νία:** 2026-06-17 · **Από:** Opus session · **Γλώσσα:** ΠΑΝΤΑ Ελληνικά στις απαντήσεις.

---

## 0. ΤΟ ΟΡΑΜΑ ΤΟΥ GIORGIO (το ζητούμενο — ΑΥΤΟ είναι το νέο task)

> «ΔΕΝ θέλω να το αποφασίζω εγώ. Θέλω **πάντοτε να το αποφασίζει αυτόματα η εφαρμογή** με βάση **το σύνολο
> των στατικών BIM** που υπάρχουν εκείνη τη στιγμή στο επίπεδο. Οι υπολογισμοί με βάση **διεθνείς πρακτικές
> στατικών** (φορτία, τάσεις εδάφους, είδος κατασκευής — προς το παρόν **οπλισμένο σκυρόδεμα**). Να
> υπολογίζει **αν τα πέδιλα μένουν μεμονωμένα ή ενώνονται**. Οι **διαστάσεις** πεδίλων υπολογίζονται αυτόματα
> (τάσεις/φορτία)· **ο οπλισμός** υπολογίζεται αυτόματα. **Κατά τη σύνδεση οντοτήτων πάντα τρέχει αυτόματα ο
> οπλισμός** και οπλίζονται οι οντότητες αυτόματα.»

Δηλαδή: μετάβαση από «proactive **ερώτηση** (toast με κουμπιά)» → σε **Αυτόματο Σχεδιασμό Θεμελίωσης**
(engineering-driven, level-wide, Revit/auto-design grade). Η απόφαση «μεμονωμένο vs combined» γίνεται από
την εφαρμογή με στατικά κριτήρια, ΟΧΙ με σταθερό όριο απόστασης, ΟΧΙ με ερώτηση.

---

## 1. 🚨 ΚΡΙΣΙΜΟ — SSOT AUDIT (GREP) ΠΡΩΤΑ. FULL ENTERPRISE + FULL SSOT. ΜΗΔΕΝ ΔΙΠΛΟΤΥΠΑ.

**ΠΡΙΝ γράψεις ΟΤΙΔΗΠΟΤΕ:** μπες σε **PLAN MODE**, διάβασε ADR-459 + ADR-464, και κάνε **πραγματικό grep
audit**. Το ~85% της υποδομής ΥΠΑΡΧΕΙ ήδη (cross-level Phase 6 + footing-design engine ADR-464 + organism +
auto-reinforce). Το ζητούμενο είναι **ένας νέος engineering reconciler** πάνω στα υπάρχοντα, ΟΧΙ νέος μηχανισμός.

### ADRs να διαβάσεις
- `docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md` (ιδίως **§6i Phase 6** = αυτό που μόλις χτίστηκε).
- `docs/centralized-systems/reference/adrs/ADR-464-advanced-footing-reinforcement.md` (footing-design engine: bearing/flexure/punching/takedown).
- `docs/centralized-systems/reference/adrs/ADR-467-*` (load path engine — appliedLoad ανά μέλος).

### Τι ΥΠΑΡΧΕΙ ήδη (reuse — ΜΗΝ ξαναφτιάξεις· grep & διάβασε):

| Υπάρχον | Path | Τι κάνει |
|---|---|---|
| **Footing design engine (EC7/EC2)** | `bim/structural/footing-design/` | `footing-bearing.ts` (`computeBasePressure`/`computeFootingBearing`/`BearingResult`), `footing-design-input.ts` (`buildPadFootingDesignInput`), `footing-flexure/shear/punching.ts`, `raft-bearing.ts`, `footing-load-takedown.ts`, `footing-design-checks.ts` (`runFootingDesignChecks`) |
| Pad sizer (βασικός, δικός μου) | `bim/structural/footing-design/suggest-pad-dimensions.ts` | `suggestPadDimensions` (√(N/σ_allow) + γεωμετρικό min) — **πιθανώς να γίνει authoritative ή να αντικατασταθεί** από το design-engine output |
| **Cross-level infra (Phase 6.0/6.1)** | `systems/levels/building-foundation-level.ts`, `bim/structural/organism/cross-level-organism-scene.ts`, `state/foundation-level-store.ts`, `hooks/useFoundationLevelSync.ts`, `bim/foundations/foundation-cross-level-writer.ts` | resolve foundation level + merge cross-level entities (absolute-Z) + foundation-scoped Firestore/scene writer |
| **Absolute-Z SSoT (ΚΡΙΣΙΜΟ)** | `bim/foundations/footing-element-summary.ts` → `footingAbsoluteZ(summary, floorElev)` | FoundationEntity=ΑΠΟΛΥΤΟ topElevationMm (+0)· slab/column/beam=floor-relative (+floorElev). **ΜΗΝ το ξεχάσεις στους υπολογισμούς Z.** |
| Detection (covered/extend/create) | `bim/foundations/column-footing-suggestion.ts` | `suggestColumnFooting` — **σταθερό όριο 3m· ΘΑ ΑΝΤΙΚΑΤΑΣΤΑΘΕΙ** από engineering reconciler |
| Coverage κριτήριο | `bim/foundations/footing-column-coverage.ts` | `footingSupportsColumnBase` |
| Combined-pad geometry | `bim/foundations/pad-extend.ts` | `buildExtendedPadParams` (axis-aligned bbox — **να γενικευθεί** σε load-centroid combined footing) |
| Footing build SSoT | `hooks/drawing/foundation-completion.ts` | `buildDefaultFoundationParams`/`buildFoundationEntity`/`completeFoundationFromClick` |
| Cross-level commands | `core/commands/entity-commands/CreateColumnFootingCommand.ts`, `ExtendFootingToColumnCommand.ts`, `ReinforceColumnFootingCommand.ts`, `AttachColumnFootingCommand.ts`, `AutoReinforceOrganismCommand.ts` | undoable· συνθέτουν writer + FK + reinforce |
| Foundation single-pad commands | `CreateFoundationsCommand.ts`, `UpdateFoundationParamsCommand.ts`, `DeleteFoundationsCommand.ts` | |
| Proactive hooks (toast — **ΘΑ ΓΙΝΟΥΝ AUTO**) | `hooks/useColumnFootingNotification.tsx` (create/extend prompt), `hooks/useStructuralOrganismNotification.tsx` (reinforce prompt) | mounted στο `app/DxfViewerContent.tsx` |
| Auto-reinforce + continuity | `hooks/useStructuralAutoReinforce.ts`, `AutoReinforceOrganismCommand`, `bim/structural/organism/reinforcement-continuity.ts`, `section-context.ts` (`buildReinforcePatch`) | |
| Organism graph + checks | `bim/structural/organism/structural-graph.ts` (`buildStructuralGraph(entities,{floorElevationByEntityId})`), `organism-checks.ts`, `reinforcement-checks.ts`, `useStructuralOrganism.ts` | cross-level πλέον |
| Στατικές ρυθμίσεις | `state/structural-settings-store.ts` | `soilBearingCapacityKpa`, `deadAreaLoadKpa`, `liveAreaLoadKpa`, `codeId` (Ευρωκώδικες/ΕΚΩΣ) |
| Φορτία | `bim/structural/loads/structural-loads-types.ts` (`AppliedMemberLoad` G/Q), `ComputeLoadPathCommand` (ADR-467) | |
| Code providers | `bim/structural/codes/` (`StructuralCodeProvider`: bearing/reinforcement limits + suggesters EC2/EC8 + ΕΚΩΣ/ΕΑΚ) | |

### Grep στόχοι (ενδεικτικά — κάνε το δικό σου audit):
`computeFootingBearing|computeBasePressure|buildPadFootingDesignInput|suggestPadDimensions|footingAbsoluteZ|
buildExtendedPadParams|AppliedMemberLoad|soilBearingCapacityKpa|combined.*footing|growFootprint|polygonBbox|
runFootingDesignChecks|resolveBuildingFoundationLevel|foundation-cross-level-writer|union.?find|connected.?component`

---

## 2. ΤΟ ΠΡΑΓΜΑΤΙΚΟ DELTA — ΤΙ ΝΑ ΧΤΙΣΕΙΣ (Revit-grade auto-design)

### A) NEW: Auto-Foundation-Layout reconciler (pure engine, SSoT)
Level-wide, DERIVED. Δοθέντων ΟΛΩΝ των κολωνών του επιπέδου (+ φορτία) + σ_allow + κανονισμός:
1. Διαστασιολόγησε το **απαιτούμενο μεμονωμένο πέδιλο** κάθε κολώνας (A_req = N_service/σ_allow, EC7 —
   reuse `footing-bearing`/`suggestPadDimensions`). N_service = G+Q χαρακτηριστικά (allowable bearing).
2. **Κανόνας ένωσης (διεθνής πρακτική):** δύο κολώνες ενώνονται όταν τα **απαιτούμενα μεμονωμένα πέδιλά τους
   επικαλύπτονται** (ή το καθαρό κενό < ελάχιστη απόσταση κατασκευής). Grouping **transitive** (connected
   components / union-find: A∩B, B∩C → ομάδα {A,B,C}).
3. Για κάθε ομάδα ≥2 → **combined footing**: ορθογώνιο, εμβαδόν ≥ ΣN/σ_allow, **κεντραρισμένο στο κέντρο
   βάρους των φορτίων** (ομοιόμορφη πίεση → μηδέν καθαρή ροπή)· άξονας κατά τη γραμμή των κολωνών. (v1
   ορθογώνιο· trapezoidal αν τα φορτία διαφέρουν πολύ = DEFER, κατέγραψέ το.)
4. Για μονές κολώνες → **μεμονωμένο** pad.
5. Επαλήθευση με `runFootingDesignChecks` (bearing/punching/flexure).

**Έξοδος:** ένα DERIVED «foundation layout plan» (ομάδες + διαστάσεις + θέσεις). Pure, testable, ΠΟΤΕ persisted.

### B) NEW: Auto-apply (αντικαθιστά τα «ερώτησης» toasts με αυτόματη ενέργεια + info feedback)
- Σε στατική μεταβολή (νέα/μετακινημένη κολώνα, αλλαγή φορτίων) → τρέξε τον reconciler → **δημιούργησε/ένωσε/
  ενημέρωσε** τα πέδιλα στον όροφο **Θεμελίωσης** (cross-level writer) αυτόματα, σε **ΕΝΑ undoable batch**.
- **Info toast** (όχι ερώτηση): π.χ. «Δημιουργήθηκαν N πέδιλα / ενώθηκαν M σε combined».
- Idempotent: αν το layout δεν αλλάζει → no-op. Μην ξαναδημιουργείς ίδια πέδιλα.
- ⚠️ Προσοχή race/ADR-040: low-freq, coalesced (mirror `useStructuralOrganism` microtask), ΟΧΙ 60fps.

### C) Always auto-reinforce on connection
- Κατά τη σύνδεση κολόνα↔πέδιλο (`bim:column-footing-attached*`) → **πάντα** τρέχει ο αυτόματος οπλισμός
  (κολόνα + πέδιλο + συνέχεια), **χωρίς ερώτηση**. Reuse `ReinforceColumnFootingCommand` /
  `useStructuralAutoReinforce`. Το `useStructuralOrganismNotification` (που σήμερα ρωτάει) → γίνεται auto.

### Αποφάσεις που παίρνεις ΕΣΥ (Revit-grade, ΜΗΝ ρωτάς τον Giorgio):
- Ακριβής κανόνας overlap/clearance (π.χ. combine αν gap < 0, ή < ~100-150mm κατασκευαστικό).
- Combined footing: ορθογώνιο vs trapezoidal (v1 ορθογώνιο, document το trapezoidal ως DEFER).
- Πότε «σπάει» ένα combined αν μετακινηθεί κολώνα (re-derive καθαρά κάθε φορά = DERIVED layout· μην κρατάς stale).
- Eccentric/strap footing (όριο οικοπέδου) = DEFER (δεν υπάρχουν property lines ακόμα — κατέγραψέ το).

---

## 3. ΤΡΕΧΟΥΣΑ ΚΑΤΑΣΤΑΣΗ (UNCOMMITTED — ΜΗΝ ΤΑ ΧΑΛΑΣΕΙΣ· commit = Giorgio)

**ADR-459 Phase 6 (μόλις χτίστηκε & verified Σενάριο #1):** proactive «βάλε πέδιλο» (✅ browser-verified —
πέδιλο εφάπτεται σωστά στη βάση κολόνας μετά το absolute-Z bugfix), «επέκταση» (toast 3m), «ενιαίος οπλισμός»
(toast). 35 jest πράσινα. Αυτά είναι η **βάση** πάνω στην οποία χτίζεις το auto-design — κράτα ό,τι δουλεύει,
εξέλιξε τα toasts «ερώτησης» σε αυτόματη απόφαση.

**Δικά μου αρχεία Phase 6 (git add ΜΟΝΟ δικά σου — shared tree):**
- NEW: `systems/levels/building-foundation-level.ts`, `bim/structural/organism/cross-level-organism-scene.ts`,
  `state/foundation-level-store.ts`, `hooks/useFoundationLevelSync.ts`, `bim/foundations/foundation-cross-level-writer.ts`,
  `bim/foundations/column-footing-suggestion.ts`, `bim/foundations/pad-extend.ts`,
  `bim/structural/footing-design/suggest-pad-dimensions.ts`, `hooks/useColumnFootingNotification.tsx`,
  `hooks/useStructuralOrganismNotification.tsx`, `core/commands/entity-commands/CreateColumnFootingCommand.ts`,
  `ExtendFootingToColumnCommand.ts`, `ReinforceColumnFootingCommand.ts` (+6 `__tests__`).
- MOD: `bim/structural/organism/structural-graph.ts`, `bim/foundations/footing-element-summary.ts`,
  `hooks/useStructuralOrganism.ts`, `app/DxfViewerContent.tsx`, `src/i18n/locales/{el,en}/dxf-viewer-shell.json`,
  `docs/.../ADR-459-...md`, `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`.

**⚠️ 2 pre-existing failures** στο `foundation-preview-helpers.test.ts` — ΑΣΧΕΤΑ (δεν τα αγγίξαμε· πιθανώς
από uncommitted ADR-463 στο shared tree). ΜΗΝ μπερδευτείς.

---

## 4. ΚΑΝΟΝΕΣ (ΑΠΑΡΑΒΑΤΟΙ)
- **COMMIT/PUSH = Giorgio**, ΟΧΙ εσύ (N.(-1)). **Shared working tree** → `git add` **ΜΟΝΟ τα δικά σου** αρχεία, ΠΟΤΕ `-A`.
- **tsc = Giorgio** (PowerShell process-check denied για τον agent). **jest** τρέχει κανονικά μέσω Bash (node).
- **PLAN MODE πρώτα** (5+ αρχεία, cross-cutting): SSOT audit → plan → έγκριση Giorgio → υλοποίηση → jest → docs.
- **GOL:** 40-line functions / 500-line files / zero race / no `any` / no `@ts-ignore`.
- Μετά την υλοποίηση (N.15): ADR-459 changelog + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + adr-index + memory.
- Απαντάς **Ελληνικά**.

## 5. TEST SCENE (browser-verify)
Project `proj_12788b6a-ea19-41cd-90a0-a340e6bacaab` · όροφος **Ισόγειο** (`flr_215e39f3-d958-4f97-ac59-6639131767d1`) ·
κάναβος 5×5m, κολώνες 400×400×3000 (κάποιες με appliedLoad G596/Q150). Υπάρχει ξεχωριστός όροφος **Θεμελίωση**
(εκεί πάνε τα πέδιλα, `floorplan_foundations`, filter `floorId`). Firestore MCP διαθέσιμο.
**Verify:** 2 κολώνες κοντά → 1 combined αυτόματα· 2 κολώνες μακριά (5m) → 2 μεμονωμένα· διαστάσεις από
φορτία/σ_allow· οπλισμός αυτόματος στη σύνδεση· undo· καμία ερώτηση (μόνο info feedback).

## 6. ΠΡΩΤΟ ΒΗΜΑ ΝΕΑΣ SESSION
1. Διάβασε ADR-459 (§6i) + ADR-464 + grep audit (§1).
2. PLAN MODE → plan (engineering κανόνες + reuse map + αρχεία) → έγκριση Giorgio.
3. Υλοποίηση → jest → (tsc=Giorgio) → docs → browser-verify.

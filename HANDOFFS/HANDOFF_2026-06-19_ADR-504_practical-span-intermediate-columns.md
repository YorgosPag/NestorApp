# HANDOFF — ADR-504 (NEW): Practical-span advisory + opt-in ενδιάμεσες κολώνες (Revit-grade)

> 🧭 **ΔΙΑΒΑΣΕ ΠΡΩΤΑ (με τη σειρά):**
> 1. `docs/centralized-systems/reference/adrs/ADR-487-living-structural-organism-vision.md` — §4 (σε κάθε κίνηση), §7 (αυτο-διόρθωση), **§8.4 (ο άνθρωπος υπογράφει, το σύστημα προειδοποιεί)**, §9 (scope guard: Revit-grade, ΟΧΙ Robot/SAP).
> 2. `docs/centralized-systems/reference/adrs/ADR-499-auto-correcting-organism.md` — Slice D (feasibility escalation· το pattern που κάνεις mirror).
> 3. Αυτό το handoff ΟΛΟΚΛΗΡΟ.

**Ημ/νία:** 2026-06-19 · **Γλώσσα:** ΠΑΝΤΑ Ελληνικά · **PLAN-FIRST** (plan σε φάσεις → «προχώρα» → κώδικας).
**🚨 commit + tsc = ο GIORGIO (ΟΧΙ εσύ). jest = repo ROOT. Επαλήθευση: live DB Firestore MCP `proj_12788b6a`.**
**⚠️ SHARED TREE (μοιράζεται με άλλον agent):** `git add` ΜΟΝΟ τα δικά σου. **ΜΗΝ** αγγίξεις `bim/columns/column-beam-align*` (ADR-496), `bim-3d/diagrams/*` (ADR-483), ούτε τα uncommitted αρχεία του ADR-503 (sizing lock-gate) εκτός αν χρειαστεί ρητά.
**🚨 N.0.2 / FULL SSOT:** ΠΡΙΝ γράψεις ΟΤΙΔΗΠΟΤΕ, **ξανα-grep** — η §3 παρακάτω είναι το audit μου (2026-06-19), αλλά **επιβεβαίωσέ το** (shared tree αλλάζει). Revit-grade, full enterprise, μηδέν `any`/inline-style, ≤40γρ/func, ≤500γρ/file, i18n keys ΠΡΩΤΑ (N.11).
**🆔 ADR:** δημιούργησε **ΝΕΟ** ADR — επόμενος ελεύθερος **ADR-504** (έλεγχος 2026-06-19: highest = 503). **ΞΑΝΑ-VERIFY** στο `adr-index.md` + `adrs/` πριν· αν το 504 το άρπαξε άλλος agent → πάρε το επόμενο. **ΑΠΟΦΥΓΕ ADR-145** (διπλό ήδη).

---

## 0. ΑΠΟΦΑΣΗ / ΑΙΤΗΜΑ GIORGIO (verbatim παράφραση)

Στιγμιότυπο (`Στιγμιότυπο οθόνης 2026-06-19 180435.jpg`): αρχικό πλαίσιο ~5×5m, 4 κολώνες, 2 δοκάρια. Ο Giorgio έσυρε τις 2 κολώνες ~11m δεξιά → η μελέτη υπολόγισε **δοκάρι 250×1450mm σε άνοιγμα 16.46m** (tooltip). Παρατήρηση: **κατασπατάληση χώρου+υλικών+χρημάτων** (1.45m βάθος = δεν περνάς από κάτω).

**Αίτημα:** πάνω από ένα όριο ύψους δοκαριού, η εφαρμογή να **προτείνει** (ή προαιρετικά να **τοποθετεί**) **ενδιάμεσες κολώνες** ώστε αντί για 2 τεράστια δοκάρια να έχουμε π.χ. 6 κολώνες + λογικά δοκάρια. **ΑΛΛΑ** σε ειδικές περιπτώσεις (αίθριο, αίθουσα) ο μηχανικός **θέλει** το μεγάλο δοκάρι → η λύση **ΔΕΝ** πρέπει να επιβάλλεται σιωπηλά.

**Τι κάνουν οι μεγάλοι (Revit κ.λπ.) — η σωστή φιλοσοφία (επιβεβαιωμένη):**
- Η Revit (base) **ΔΕΝ** βάζει αυτόματα κολώνες ούτε αυτο-διαστασιολογεί από φορτία· **ο μηχανικός ορίζει τον κάναβο**. Το πιο κοντινό = **Beam Systems** (ορίζεις max-spacing, κατανέμει μέλη).
- Robot/ETABS/SAP/RAM/Tekla: αναλύουν, δείχνουν **utilization + βέλος**, **προειδοποιούν** — ο άνθρωπος αλλάζει τον κάναβο.
- Generative Design: **προτείνει** εναλλακτικούς κανάβους ως **opt-in μελέτη** — ποτέ σιωπηλά.
- **Κοινός κανόνας:** layout = απόφαση μηχανικού· το λογισμικό **βελτιστοποιεί μέσα του + προειδοποιεί**. Ταιριάζει 1:1 με ADR-487 §8.4. ⇒ **πρότεινε/καθοδήγησε, ΜΗΝ επιβάλλεις.**

---

## 1. ΤΙ ΕΙΝΑΙ «ΣΩΣΤΟ» ΕΔΩ (διάγνωση)

- Ο auto-sizer (ADR-475/499) κάνει σωστά τη δουλειά του: 16.46m άνοιγμα → EC2 §7.4.2 (βέλος, span/depth) απαιτεί ~1450mm. Είναι **οριακά κάτω από το hard cap** `BEAM_MAX_PRACTICAL_DEPTH_MM = 1500`.
- **Άρα: μηχανικά σωστό, σχεδιαστικά ελλιπές.** Λείπει το επίπεδο «αυτό το άνοιγμα είναι **μη-πρακτικό** (όχι απλώς ανέφικτο) → η λογική λύση είναι ενδιάμεση στήριξη».
- Το feasibility (ADR-499 Slice D) βγάζει `error` ΜΟΝΟ όταν είναι **ανέφικτο στο max** (1500mm). Το 1450mm **δεν** πιάνεται. Χρειάζεται ένα **practical** (soft `warning`) επίπεδο **κάτω** από το hard cap.

---

## 2. ΣΤΟΧΟΣ — δύο φάσεις (ξεκίνα ΑΥΣΤΗΡΑ από τη Φάση 1)

### ΦΑΣΗ 1 — Practical-span advisory (PURE, LOW risk) ← ΥΛΟΠΟΙΗΣΕ ΠΡΩΤΑ
Soft, **μη-blocking** `warning` diagnostic όταν το AUTO ύψος δοκαριού ξεπερνά ένα **practical threshold** (κάτω από το hard cap), **μαζί με computed πρόταση**: «πόσες ενδιάμεσες κολώνες χρειάζονται ώστε το ύψος να πέσει σε λογικό όριο». Μηδέν mutation σκηνής — μόνο διάγνωση + μήνυμα στο `StructuralWarningOverlay`.

### ΦΑΣΗ 2 — Opt-in action «Πρόσθεσε ενδιάμεσες κολώνες» (HIGHER risk, ξεχωριστή συνεδρία/απόφαση)
Κουμπί/💡 που, **με τη συγκατάθεση** του μηχανικού, **εκτελεί** την πρόταση: δημιουργεί K κολώνες (+ αυτόματα πέδιλα μέσω του υπάρχοντος reconciler) και κάνει τον δοκό να τις **αναγνωρίζει ως στηρίξεις** ώστε ο sizer να μικρύνει. **⚠️ Κρίσιμη ανοιχτή απόφαση — βλ. §5.**

---

## 3. 🔍 SSOT AUDIT (grep 2026-06-19 — ΞΑΝΑ-grep πριν τον κώδικα)

### Diagnostic pipeline (Φάση 1 ζει εδώ — mirror του feasibility)
| Concern | SSoT (υπάρχει) | Πού |
|---|---|---|
| Σχήμα διάγνωσης | `StructuralDiagnostic { id, code, severity, messageKey, primaryEntityId, entityIds, messageParams? }` | `organism/structural-organism-types.ts` |
| Feasibility checks (το pattern να κάνεις mirror) | `runFeasibilityChecks(entities, provider, femMomentMap) → StructuralDiagnostic[]` | `organism/feasibility-checks.ts` |
| Wiring diagnostics (το ΕΝΑ σημείο aggregation) | array `[...runSlabChecks, ...runBeamTorsionChecks, ...runFeasibilityChecks, …]` | `hooks/structural-organism-core.ts:~125-128` |
| Store + overlay | `StructuralDiagnosticsStore` → `StructuralWarningOverlay.tsx` | `organism/structural-diagnostics-store.ts`, `components/dxf-layout/StructuralWarningOverlay.tsx` |
| Severity styles | `diagnostic-severity-style.ts`, `organism/diagnostic-highlight.ts` | — |
| i18n διαγνωστικών | `structuralOrganism.diagnostics.*` | `src/i18n/locales/{el,en}/dxf-viewer-shell.json` |

### Sizing / span / support (η μηχανική — ΟΛΑ υπάρχουν, μηδέν νέα φυσική)
| Concern | SSoT | Πού |
|---|---|---|
| Beam sizer (depth από span) | `suggestBeamSection(provider, ctx) → { depthMm, governedBy }` | `sizing/member-sizing.ts` |
| Beam ctx builder (**span = `geometry.length`!**) | `buildBeamSectionContext(beam, support?, torsion?)` — `spanMm = beam.geometry.length·1000` | `section-context.ts:~213` |
| Hard cap ύψους | `BEAM_MAX_PRACTICAL_DEPTH_MM = 1500` | `sizing/member-sizing.ts` |
| Ροπή ανά τύπο στήριξης | `spanMomentDivisor(supportType)` (simple=8, cantilever=2, …) | `codes/suggest-reinforcement.ts` |
| Πλήθος στηριζουσών κολωνών δοκού | `beamSupportColumnIds(graph, beamId)` (μετράει `column-bearing` ακμές) | `loads/load-path-walk.ts` |
| DERIVED τύπος/πλήθος στήριξης | `resolveBeamSupportCondition(graph, beamId, stored) → { supportType, supportCount, stable }` | `organism/derive-beam-support.ts` |
| Provider span/depth όριο (EC2 §7.4.2) | `beamSpanDepthLimit(ctx)` | `codes/structural-code-types.ts` |

### Φάση 2 — δημιουργία κολώνας + πέδιλο + στήριξη δοκού (action)
| Concern | SSoT | Πού |
|---|---|---|
| Προγραμματική δημιουργία κολώνας (entity) | `add-column-to-scene.ts` | `bim/columns/` |
| Undoable command δημιουργίας | `CreateColumnsCommand` (+ `CreateEntityCommand`) | `core/commands/entity-commands/` |
| Born-bound κολώνα ανά τομή κανάβου (mirror «τοποθέτησε σε θέσεις») | `column-from-grid.ts`, `column-grid-commit.ts` | `bim/columns/` |
| Αυτόματο πέδιλο για νέα κολώνα (reactive) | `useAutoFoundationDesign` → `runAutoFoundationDesign` (reconciler· gated `autoDesigned`) | `hooks/useAutoFoundationDesign.tsx`, `hooks/auto-foundation-design-core.ts` |
| Associative reframe άκρων δοκού σε κολώνες | `reframeBeamEndpointsToColumns`, `cascadeBeamReframe` | `bim/beams/beam-column-reframe*.ts` |
| Proactive auto re-study (θα τρέξει μόνο του μετά την εισαγωγή) | `useProactiveMemberSizing` (events: `entity-created`/`entities-moved`/`loads-computed`) | `hooks/useProactiveMemberSizing.ts` |

### ⚠️ ΔΕΝ υπάρχει
- **Beam-split command.** Υπάρχει ΜΟΝΟ wall-split (ADR-363 Phase X). Δοκάρι ΔΕΝ σπάει σήμερα → βλ. §5 για τις 2 επιλογές.
- **Practical (soft) span check** — μόνο το hard feasibility (1500mm). Αυτό φτιάχνεις.
- Precedent opt-in suggestion UX: i18n keys `structuralOrganism.addFootingTitle/Message/Confirm` + `proactiveCancel` υπάρχουν (proactive «λείπει πέδιλο» dialog) — mirror-πρότυπο για τη Φάση 2· generic `components/ui/ConfirmDialog.tsx`.

---

## 4. ΦΑΣΗ 1 — PLAN (PURE, ξεκίνα από εδώ)

1. **i18n keys ΠΡΩΤΑ** (N.11, el+en, `structuralOrganism.diagnostics.*`):
   `beamSpanImpractical` — π.χ. «Δοκός {width}mm: άνοιγμα {span}m απαιτεί ύψος {depth}mm (μη-πρακτικό). Πρότεινε **{columns}** ενδιάμεση/ες κολώνα/ες → υπο-ανοίγματα ~{subSpan}m, ύψος ~{suggestedDepth}mm.»
2. **NEW pure module** `bim/structural/organism/practical-span-checks.ts` (mirror `feasibility-checks.ts`):
   - `BEAM_PRACTICAL_DEPTH_MM` constant (πρότεινε ~800mm· **ρώτα Giorgio** ή κάν' το structural setting — είναι judgement/headroom).
   - Pure helper `suggestIntermediateColumnCount(provider, beam, support?, torsion?) → { columns, subSpanMm, suggestedDepthMm } | null`: loop `k=1..MAX(π.χ.5)`: `subSpan = totalSpan/(k+1)`· χτίσε ctx με το **subSpan** (clone beam ctx με μειωμένο `spanMm`)· `suggestBeamSection` → depth· σταμάτα όταν `depth ≤ BEAM_PRACTICAL_DEPTH_MM`. **Reuse `suggestBeamSection` — μηδέν νέα φυσική.**
   - `runPracticalSpanChecks(entities, provider, supportMap?, torsionMap?) → StructuralDiagnostic[]` (severity **`warning`**): για κάθε AUTO δοκό όπου το τρέχον/προτεινόμενο depth > practical threshold ΑΛΛΑ < hard cap (αλλιώς το πιάνει το feasibility) → diagnostic με `columns`/`subSpan`/`suggestedDepth`. Πρόβολος/locked/μικρά ανοίγματα → skip (no-op).
3. **Wiring 1 σημείο:** πρόσθεσε `...runPracticalSpanChecks(entities, provider, …)` στο array του `structural-organism-core.ts` (δίπλα στο `runFeasibilityChecks`). Μηδέν νέο reactive trigger.
4. **Jest** (`organism/__tests__/practical-span-checks.test.ts`): 16m φορτισμένος → warning + columns≥1· 5m → no-op· πρόβολος → no-op· locked (`autoSized:false`) → no-op· `suggestIntermediateColumnCount` monotonic.
5. **ADR-504** (NEW) + `adr-index.md` + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + MEMORY (N.15).

> Η Φάση 1 ΜΟΝΗ της δίνει το 80% της αξίας: ο μηχανικός βλέπει «βάλε 1 κολώνα στο μέσο → 2×8.2m → ~700mm» και αποφασίζει. Μηδέν ρίσκο (καμία μετάλλαξη σκηνής).

---

## 5. ΦΑΣΗ 2 — η ΚΡΙΣΙΜΗ ΑΝΟΙΧΤΗ ΑΠΟΦΑΣΗ (ρώτα Giorgio πριν υλοποιήσεις)

Για να **μικρύνει** όντως ο δοκός όταν μπει ενδιάμεση κολώνα, πρέπει το **span που βλέπει ο sizer** να πέσει. Σήμερα `buildBeamSectionContext` παίρνει `spanMm = beam.geometry.length` (**πλήρες μήκος**) — άρα **σκέτη** προσθήκη κολώνας ΔΕΝ μικραίνει τον δοκό. Δύο δρόμοι:

**Επιλογή A — Inter-support span derivation (SSoT-friendly, ΣΥΝΙΣΤΩ):** ο δοκός μένει **ΕΝΑ** element· αλλάζεις το sizing-span σε «μέγιστο καθαρό υπο-άνοιγμα μεταξύ διαδοχικών στηρίξεων» (reuse `beamSupportColumnIds` + προβολή θέσεων κολωνών στον άξονα). **Συνέπεια:** ο δοκός γίνεται **συνεχής σε πολλές στηρίξεις** → το μοντέλο ροπών αλλάζει (συνεχής δοκός ≈ `wL²/10..12` + hogging πάνω από στηρίξεις, ΟΧΙ `wL²/8`). Θέλει επέκταση `spanMomentDivisor`/support handling. **ΔΕΝ** θέλει νέο beam-split subsystem.

**Επιλογή B — Beam-split (Revit-explicit):** σπας τον 16m δοκό σε K+1 δοκάρια (mirror wall-split ADR-363 Phase X) — το καθένα αμφιέρειστο column-to-column. **Συνέπεια:** νέο command/undo + persistence + grip/merge complexity· πιο «καθαρό» μοντέλο (κάθε δοκός απλό `wL²/8`), αλλά **πολύ μεγαλύτερο** scope.

**Action flow (όποια κι αν επιλεγεί):** opt-in (κουμπί contextual στον δοκό ή 💡 από το warning) → `CompoundCommand`: δημιούργησε K κολώνες (`add-column-to-scene` + `CreateColumnsCommand`· θέσεις = even split στον άξονα δοκού) → ο `useAutoFoundationDesign` reconciler βάζει αυτόματα πέδιλα → ο `useProactiveMemberSizing` ξανα-διαστασιολογεί → (A) ο δοκός μικραίνει λόγω inter-support span ή (B) τα νέα sub-δοκάρια. ΕΝΑ atomic undo. ΟΧΙ σιωπηλό — πάντα confirm (ADR-487 §8.4).

**Σύστασή μου:** Φάση 1 τώρα· Φάση 2 = **Επιλογή A** (λιγότερο scope, SSoT) ΑΛΛΑ μετά από ρητή απόφαση Giorgio για το μοντέλο ροπών συνεχούς δοκού.

---

## 6. ΚΡΙΣΙΜΑ ΜΑΘΗΜΑΤΑ / GOTCHAS
- 🚨 **span = `geometry.length`** (ΟΧΙ inter-support). Αυτό είναι το κλειδί όλης της Φάσης 2. Μην το ξεχάσεις.
- 🚨 **ΠΟΤΕ σιωπηλή αυτόματη εισαγωγή κολωνών** — architectural intent (αίθριο) υπάρχει. Πάντα warn → opt-in confirm (ADR-487 §8.4, §9).
- 🚨 **Practical ≠ Feasible.** Το feasibility (`error`, 1500mm) υπάρχει ήδη· εσύ φτιάχνεις το **soft `warning`** κάτω από αυτό. Μην διπλασιάσεις — πρόσθεσε δίπλα.
- 🚨 **Reuse `suggestBeamSection`** για το «πόσες κολώνες» — μηδέν νέα φυσική (μάθημα ADR-499/503: iterative reuse, όχι closed-form).
- Convergence/proactive: μετά την εισαγωγή, ο υπάρχων proactive κύκλος (sizing+οπλισμός+πέδιλα) τρέχει μόνος — **μην** προσθέσεις νέο reactive trigger.
- GOL: ≤40γρ/func, ≤500γρ/file, μηδέν `any`/inline-style, i18n keys ΠΡΩΤΑ.

## 7. PRE-EXISTING jest fails (baseline, ΟΧΙ δικά σου)
6 raft (ADR-476: `raft-bearing.test.ts` + raft `reinforcement-checks.test.ts` — `slab.geometry.maxFreeSpanM` undefined σε fixtures) + 1 `AssignWallTypeCommand`. Αν τα δεις → αγνόησέ τα.

## 8. ΜΕΤΑ ΤΗΝ ΥΛΟΠΟΙΗΣΗ (N.15 — ίδιο commit, αλλά COMMIT = GIORGIO)
Ενημέρωσε: **NEW ADR-504** (status/changelog) · `adr-index.md` · `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (1-2 γραμμές, ΜΟΝΟ τι εκκρεμεί) · MEMORY (νέο `reference_*` αρχείο + 1 γραμμή στο MEMORY.md). **ΜΗΝ** commit/push.

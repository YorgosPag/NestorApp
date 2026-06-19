# HANDOFF — ADR-504 ΦΑΣΗ 2, Slices S4-S6 (θέσεις κολωνών + FEM subdivision + opt-in action)

> 🧭 **ΔΙΑΒΑΣΕ ΠΡΩΤΑ (με τη σειρά):**
> 1. `docs/centralized-systems/reference/adrs/ADR-487-living-structural-organism-vision.md` — **§8.4 (ο άνθρωπος υπογράφει, το σύστημα προειδοποιεί), §9 (scope guard: Revit-grade, ΟΧΙ Robot/SAP full)**.
> 2. `docs/centralized-systems/reference/adrs/ADR-504-practical-span-intermediate-columns.md` — **ΟΛΟ, ιδίως §5 + §5.1 (το runbook των S4-S6) + §5.2 (tests)**.
> 3. Αυτό το handoff ΟΛΟΚΛΗΡΟ.

**Ημ/νία:** 2026-06-19 · **Γλώσσα:** ΠΑΝΤΑ Ελληνικά · **Μοντέλο:** Opus · **PLAN-FIRST** (plan σε sub-slices → «προχώρα» → κώδικας).
**🚨 commit + tsc = ο GIORGIO (ΟΧΙ εσύ).** jest = repo ROOT. Επαλήθευση: live DB Firestore MCP `proj_12788b6a`.
**⚠️ SHARED TREE (μοιράζεται με άλλον agent):** `git add` **ΜΟΝΟ** τα δικά σου (λίστα §6). **ΜΗΝ** αγγίξεις `bim/columns/column-beam-align*` (ADR-496), `bim-3d/diagrams/*` (ADR-483), ADR-503 sizing-lock **λογική** (έχω ήδη αγγίξει ΜΟΝΟ signatures στο `beam-size-patch.ts` additive — δες §6).
**🎯 ΑΠΑΙΤΗΣΗ GIORGIO:** «όπως οι μεγάλοι (Revit), FULL ENTERPRISE + FULL SSOT». **ΠΡΙΝ τον κώδικα → ΠΡΑΓΜΑΤΙΚΟ SSOT AUDIT (grep)** — η §4 είναι ο οδηγός audit μου, **ΞΑΝΑ-επιβεβαίωσέ τον** (shared tree αλλάζει). Reuse, μηδέν διπλότυπα. Revit-grade, ≤40γρ/func, ≤500γρ/file, μηδέν `any`/inline-style, **i18n keys ΠΡΩΤΑ (N.11, ήδη έτοιμα)**, **Enterprise IDs (N.6)** για νέες κολώνες.
**ADR:** συνεχίζεις το **ADR-504** (Φάση 2 changelog), ΟΧΙ νέος αριθμός.

---

## 0. ΚΑΤΑΣΤΑΣΗ — S0-S3 DONE & TESTED (UNCOMMITTED) ✅

Το **«μυαλό» της Φάσης 2 δουλεύει**: μόλις ένας δοκός αποκτήσει **≥1 ενδιάμεση στήριξη**, η ζωντανή τοπολογία τον κάνει αυτόματα `'continuous'`, ο proactive κύκλος τον **διαστασιολογεί με το υπο-άνοιγμα** (μικραίνει) και τον **οπλίζει σωστά** (συμμετρικά σίδερα για το hogging). **Μηδέν νέος reactive trigger** — όλα ρέουν μέσα από τον υπάρχοντα organism pass.

**ΚΡΙΣΙΜΟ που ΗΔΗ ισχύει (επαληθευμένο):** το `beamFramesColumn` (`bim/columns/column-structural-attach-coordinator.ts:175`) αναγνωρίζει **κολώνα στη μέση του ανοίγματος** ως `column-bearing` στήριξη (`perp≈0` + `along` εντός `[0,len]`). Άρα **μόλις δημιουργηθούν οι K κολώνες (S6), ο δοκός γίνεται μόνος του continuous + μικραίνει + οπλίζεται + παίρνει πέδιλα** — χωρίς να χρειάζεται τίποτα παραπάνω από τη δημιουργία τους.

**Αποφάσεις Giorgio (κλειδωμένες):**
- **Μηχανισμός = Α** (inter-support span, ΕΝΑ element· industry standard Revit/Robot — **ΠΟΤΕ** beam-split: χάνεις member identity/BOQ/grips).
- **Scope = Επίπεδο 1+2 (Robot-grade):** closed-form **εφεδρεία** (`'continuous'` divisor **10** + συμμετρικός οπλισμός + l/d K=1.5) **+** FEM subdivision (S5, authoritative όταν engaged).
- **Σκεπτικό divisor (SSoT):** η ακρίβεια = ο **FEM** (μία πηγή)· η εφεδρεία μένει ΑΠΛΗ ώστε να **μην** διπλασιάζει τον FEM → μηδέν double-truth (μάθημα ADR-491/497). Belt-and-suspenders (N.7.2).

---

## 1. ΣΤΟΧΟΣ S4-S6

Κουμπί/💡 (contextual στον δοκό **ή** action μέσα από το warning) που, **ΜΕ ΡΗΤΗ ΣΥΓΚΑΤΑΘΕΣΗ** (confirm dialog — ΠΟΤΕ σιωπηλά, ADR-487 §8.4):
1. Δημιουργεί **K ισαπέχουσες ενδιάμεσες κολώνες** στον άξονα του δοκού (K = `suggestIntermediateColumnCount`, ήδη στο diagnostic `messageParams.columns`).
2. Τα **πέδιλα** μπαίνουν αυτόματα (reconciler `runAutoFoundationDesign`).
3. Ο δοκός **μικραίνει** (proactive re-size — ΗΔΗ δουλεύει από S0-S3).
4. **ΕΝΑ atomic undo** (`CompoundCommand`).
5. **(Robot-grade)** Ο FEM λύνει τον πραγματικό συνεχή δοκό (S5).

---

## 2. SUB-SLICES (PLAN-FIRST — δώσε plan, περίμενε «προχώρα», μετά κώδικας)

### S4 — Θέσεις K κολωνών + build `ColumnEntity[]` (pure + Enterprise IDs)
- **Pure even-split:** K σημεία στον άξονα του δοκού: `t = i/(K+1)`, `i=1..K` → `{ x: s.x+(e.x−s.x)·t, y: s.y+(e.y−s.y)·t }` (scene units, ίδιο space με `params.startPoint/endPoint`).
- **Build `ColumnEntity`:** clone τη διατομή μιας **framing κολώνας** του δοκού (reuse `beamSupportColumnIds` → πάρε μια στηρίζουσα κολώνα ως template section), Enterprise ID (**N.6** — `enterprise-id.service` column prefix· **ΠΟΤΕ** `addDoc`/`Date.now()`/`crypto.randomUUID`). Z/floor/base: **reuse** τον τρόπο που χτίζει το `column-from-grid.ts` / `column-grid-commit.ts` (μην εφεύρεις δικό σου).
- **Τοποθεσία αρχείου (SSOT audit ΠΡΩΤΑ):** πιθανό νέο `bim/columns/intermediate-column-placement.ts` ΜΟΝΟ αν δεν υπάρχει αντίστοιχο. **Grep πρώτα:** `column-from-grid`, `column-grid-commit`, `addColumnToScene`, `computeColumnGeometry`, `buildColumnEntityFrom*`.

### S5 — FEM subdivision (Robot-grade, authoritative)
- **Πρόβλημα (επαληθευμένο):** ο `bim/structural/analytical/analytical-model-builder.ts` φτιάχνει **1 analytical member ανά δοκό (2 κόμβοι i→j, `appendBeam`)** και ενώνει μόνο τα **άκρα** με κορυφές κολωνών (`mergeFramingEdges` → nearest endpoint). **ΔΕΝ** υποδιαιρεί τον δοκό όταν κολώνα πέφτει στη ΜΕΣΗ → ο FEM σήμερα βλέπει single-span (όχι συνεχή).
- **Λύση:** όταν `column-bearing` κολώνα προβάλλεται **εντός (0,len)** του δοκού (όχι στα άκρα), **εισήγαγε ενδιάμεσο analytical node** στο σημείο της πάνω στον δοκό + **σπάσε τον beam member** σε υπο-μέλη (i→s1→s2→…→j), ενώνοντας κάθε ενδιάμεσο κόμβο με την κορυφή της στηρίζουσας κολώνας → πραγματικός συνεχής δοκός → ο solver βγάζει **sagging + hogging envelope**.
- **SSOT audit ΠΡΩΤΑ (grep):** `analytical-node-merge` (union-find/proximity — reuse), `RawMember`/`buildMembers`/`appendBeam`, `member-end-forces`, `member-diagrams`, `solver/frame-solver`. Reuse την προβολή στον άξονα (`projectColumnFootprintOnAxis` ή `projectPolygonOnAxis`) — **ίδιο SSoT** με το `deriveBeamSpanModel` (S2). **Μην** εφεύρεις νέα προβολή.
- **Προσοχή:** ADR-480 (model) + ADR-481 (solver/FEM) — **ενημέρωσε τα changelog τους**. ⚠️ `bim-3d/diagrams/*` = ADR-483 (άλλου agent) — **ΜΗΝ** το αγγίξεις· το `analytical/diagrams/member-diagram-*` είναι ΑΛΛΟ (ADR-481/483 — verify ποιανού είναι πριν αγγίξεις· αν αμφιβολία, μην).
- **Scope sanity (ADR-487 §9):** Revit-grade πρακτικός. Κράτα το subdivision **ντετερμινιστικό + minimal** (γραμμικά ισαπέχοντες κόμβοι από τις στηρίξεις), όχι πλήρης mesh.

### S6 — Action + opt-in confirm UX
- **Σημείο εκκίνησης:** το diagnostic `beamSpanImpractical` (ADR-504 Φ1) εμφανίζεται ήδη στο **`ui/structural-warnings/EntityWarningsSection.tsx`** (read-only σήμερα). Πρόσθεσε **action button** (i18n `structuralOrganism.addIntermediateColumnsAction`, ΗΔΗ έτοιμο) ΜΟΝΟ για κωδικό `beamSpanImpractical`.
- **Confirm dialog:** i18n ΗΔΗ έτοιμα — `structuralOrganism.addIntermediateColumns{Title,Message,Confirm,Done}` (+ κοινό `proactiveCancel`). ⚠️ Τα `addFooting{Title,Message,Confirm}` υπάρχουν στα locales **αλλά είναι UNWIRED** (orphaned) — **δεν** υπάρχει ζωντανό structural opt-in confirm. **Precedent confirm dialog:** `ui/dialogs/ColumnPerimeterConfirmDialog.tsx` (ή generic `components/ui/ConfirmDialog.tsx`). **SSOT audit ΠΡΩΤΑ (grep):** πώς ένα panel κάνει dispatch command (`executeCommand`/`useBeamParamsDispatcher` pattern), πώς ανοίγει dialog.
- **Action:** `CompoundCommand`([`CreateColumnsCommand`(K columns από S4)]). K = `diagnostic.messageParams.columns`. **Πέδιλα (reconciler) + resize (proactive) ακολουθούν ΑΥΤΟΜΑΤΑ** (μηδέν νέος reactive trigger — δες §0). **ΕΝΑ atomic undo.** Toast: `addIntermediateColumnsDone`.
- **SSOT audit:** `CompoundCommand` (`core/commands/CompoundCommand.ts`), `CreateColumnsCommand` (παίρνει `ColumnEntity[]`, emit `drawing:entity-created` → persistence).

---

## 3. ΑΠΟΦΑΣΕΙΣ ΗΔΗ ΠΑΡΜΕΝΕΣ (ΜΗΝ τις ξανα-ρωτήσεις)
- Μηχανισμός **Α** (ΟΧΙ beam-split). Scope **Επίπεδο 1+2**. Divisor εφεδρείας **10** + συμμετρικός οπλισμός. FEM = ακρίβεια.
- Confirm **πάντα**, ποτέ σιωπηλά (αίθριο/πυλωτή θέλουν το μεγάλο δοκάρι).

---

## 4. 🔍 SSOT AUDIT (επιβεβαιωμένο 2026-06-19 — ΞΑΝΑ-grep πριν τον κώδικα)

| Concern | SSoT (reuse) | Πού |
|---|---|---|
| Span model (continuous + sub-span) — **S2, ΗΔΗ** | `deriveBeamSpanModel` / `buildBeamSpanModelMap` | `bim/structural/organism/derive-beam-span-model.ts` |
| span override στο ctx — **S2, ΗΔΗ** | `buildBeamSectionContext(beam, supportType?, torsion?, sizingSpanOverrideMm?)` | `bim/structural/section-context.ts:213` |
| store sub-span — **S2, ΗΔΗ** | `BeamSpanStore` + `resolveActiveBeamSpanMm(beamId)` | `organism/beam-span-store.ts` · `active-reinforcement.ts` |
| Στηρίζουσες κολώνες | `beamSupportColumnIds(graph, beamId)` | `loads/load-path-walk.ts:69` |
| **Mid-span κολώνα = στήριξη (ΗΔΗ true)** | `beamFramesColumn` (perp≈0 + along∈[0,len]) | `columns/column-structural-attach-coordinator.ts:175` |
| Προβολή στον άξονα (reuse S4+S5) | `projectColumnFootprintOnAxis` / `projectPolygonOnAxis` | `columns/column-face-trim.ts:107` · `geometry/shared/polygon-axis-projection.ts` |
| Build κολώνας από θέση | `column-from-grid` / `column-grid-commit` / `addColumnToScene` | `bim/columns/` |
| Batch create + undo | `CreateColumnsCommand` (παίρνει `ColumnEntity[]`) | `core/commands/entity-commands/CreateColumnsCommand.ts` |
| ΕΝΑ atomic undo | `CompoundCommand` | `core/commands/CompoundCommand.ts` |
| Enterprise IDs (N.6) | `@/services/enterprise-id.service` | — |
| Auto πέδιλο (reconciler) | `runAutoFoundationDesign` (gated `autoDesigned`) | `hooks/auto-foundation-design-core.ts` |
| FEM model builder (S5) | `buildAnalyticalModel` / `appendBeam` / `mergeFramingEdges` | `analytical/analytical-model-builder.ts` |
| FEM node merge (S5 reuse) | `analytical-node-merge` (union-find/proximity) | `analytical/analytical-node-merge.ts` |
| Diagnostic display (S6) | `EntityWarningsSection` (read-only → πρόσθεσε action) | `ui/structural-warnings/EntityWarningsSection.tsx` |
| Confirm dialog precedent (S6) | `ColumnPerimeterConfirmDialog` / `components/ui/ConfirmDialog` | `ui/dialogs/` |

**⚠️ ΔΕΝ υπάρχει (θα φτιάξεις):** even-split column placement helper (S4)· beam FEM subdivision (S5)· wired structural opt-in confirm (S6 — τα `addFooting*` keys είναι orphaned).

---

## 5. ΚΡΙΣΙΜΑ GOTCHAS / ΜΑΘΗΜΑΤΑ
- 🚨 **Μηδέν νέος reactive trigger.** Δημιουργείς τις κολώνες → ο proactive κύκλος κάνει τα υπόλοιπα (size+reinforce+footings). Επαλήθευσε ότι το `CreateColumnsCommand` emit-άρει `drawing:entity-created` (το κάνει) → triggers organism recompute.
- 🚨 **`buildBeamSectionContext` 4ος param = `sizingSpanOverrideMm`** (spanMm από sub-span, **w από ΠΛΗΡΕΣ** άνοιγμα — μην το χαλάσεις).
- 🚨 **`resolveActiveBeamSpanMm(beamId)`** → μόνο για συνεχείς (αλλιώς `undefined` → fallback πλήρες μήκος).
- 🚨 **Enterprise IDs** για κάθε νέα κολώνα (N.6). **ΠΟΤΕ** σιωπηλή εισαγωγή (ADR-487 §8.4).
- 🚨 **K** = `diagnostic.messageParams.columns` (ΗΔΗ υπολογισμένο από Φ1 `suggestIntermediateColumnCount`, τώρα με `'continuous'`).
- FEM (S5): οι ενδιάμεσοι κόμβοι πρέπει να ενωθούν με τις **κορυφές των στηριζουσών κολωνών** (ώστε η αντίδραση να κατεβαίνει στην κολώνα→πέδιλο).

## 6. ΑΡΧΕΙΑ ΠΟΥ ΑΛΛΑΞΑ S0-S3 (git add ΜΟΝΟ αυτά — shared tree)
**NEW (3):** `bim/structural/organism/derive-beam-span-model.ts` · `bim/structural/organism/beam-span-store.ts` · `bim/structural/organism/__tests__/derive-beam-span-model.test.ts`
**MOD (20):** `i18n/locales/el/dxf-viewer-shell.json` · `i18n/locales/en/dxf-viewer-shell.json` · `bim/types/beam-types.ts` · `bim/structural/codes/suggest-reinforcement.ts` · `bim/structural/codes/eurocode-provider.ts` · `bim/structural/codes/greek-legacy-provider.ts` · `bim/structural/organism/structural-organism-types.ts` · `bim/structural/section-context.ts` · `bim/structural/active-reinforcement.ts` · `hooks/structural-organism-core.ts` · `bim/structural/sizing/beam-size-patch.ts` *(⚠️ ADR-503 shared — ΜΟΝΟ additive trailing `sizingSpanOverrideMm` σε 4 signatures)* · `core/commands/entity-commands/AutoSizeMembersCommand.ts` · `ui/ribbon/hooks/bridge/useBeamParamsDispatcher.ts` *(⚠️ ADR-503 shared — 1 call site)* · `hooks/grips/grip-parametric-commits.ts` *(⚠️ ADR-503 shared — 1 call site)* · `bim/structural/reinforce-patch.ts` · `core/commands/entity-commands/AutoReinforceOrganismCommand.ts` · `hooks/structural-auto-reinforce-core.ts` · `bim/structural/organism/reinforcement-checks.ts` · `bim/structural/utilization/member-utilization.ts` · `components/dxf-layout/StructuralUtilizationOverlay.tsx`
**DOCS (3):** `ADR-504-...md` · `adr-index.md` · `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`

## 7. TESTS (από repo ROOT)
- **Νέο (GREEN):** `bim/structural/organism/__tests__/derive-beam-span-model.test.ts` (13).
- **Affected GREEN:** `npx jest derive-beam-span-model derive-beam-support practical-span-checks topology-aware-beam-support reinforcement-continuity beam-size-patch reinforcement-checks suggest-reinforcement member-sizing` → ~89 pass.
- **Pre-existing fails (ΟΧΙ δικά σου, αγνόησε):** 6 raft (ADR-476, `maxFreeSpanM undefined` slab path) + 1 `AssignWallType`.
- Για S4-S6: γράψε jest (even-split positions· FEM subdivision στον builder· action command compound).

## 8. ΜΕΤΑ ΤΗΝ ΥΛΟΠΟΙΗΣΗ (N.15 — ίδιο commit, COMMIT = GIORGIO)
Ενημέρωσε: **ADR-504** (§5.1 S4-S6 → DONE + changelog) · **ADR-480/481** (FEM subdivision, αν S5) · `adr-index.md` · `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (1-2 γραμμές, ΜΟΝΟ τι εκκρεμεί) · MEMORY (`reference_practical_span_advisory.md`). **ΜΗΝ** commit/push. tsc = Giorgio (N.17: ΕΝΑ tsc τη φορά — έλεγξε πρώτα ότι δεν τρέχει άλλος).

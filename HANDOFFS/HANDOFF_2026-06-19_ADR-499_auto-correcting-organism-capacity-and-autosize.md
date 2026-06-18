# HANDOFF — ADR-499: Αυτο-διορθούμενος Οργανισμός (capacity ceiling + auto-size ΔΙΑΤΟΜΩΝ + torsion + global feasibility)

> ⚠️ **ΑΡΙΘΜΟΣ:** επόμενο ελεύθερο = **ADR-499** (494=framing, 495=slab-load[committed], 496=column-align[άλλου agent], 497=FEM-axial[committed], 498=cantilever-slab[ΔΙΚΟ ΜΟΥ, μάλλον committed ως τότε]). **ΕΠΙΒΕΒΑΙΩΣΕ με `ls docs/centralized-systems/reference/adrs/ | grep ADR-49` πριν δεσμεύσεις** (shared tree, ενεργός άλλος agent).

**Ημ/νία:** 2026-06-19 · **Από:** Opus session (μόλις ολοκλήρωσε ADR-498 cantilever-slab + το επαλήθευσε σε live DB) · **Γλώσσα:** ΠΑΝΤΑ Ελληνικά.
**Τύπος:** 🔴 PLAN-FIRST ανά slice. **SSoT AUDIT (GREP) ΥΠΟΧΡΕΩΤΙΚΟ ΠΡΙΝ ΚΩΔΙΚΑ.**

> 🧭 **ΔΙΑΒΑΣΕ ΠΡΩΤΑ ΤΟ ΟΡΑΜΑ:** `docs/centralized-systems/reference/adrs/ADR-487-living-structural-organism-vision.md` — ειδικά §3 (ΕΝΑΣ οργανισμός), §4 («σε κάθε κίνηση recompute ΟΛΑ + ενημέρωσε»), §5 (δυναμική επανα-διαστασιολόγηση διατομών/πάχους/οπλισμού).
> ⚠️ **Shared working tree** με άλλον agent. **git add ΜΟΝΟ τα δικά σου. commit = ο Giorgio (ΟΧΙ εσύ). tsc = ο Giorgio** (N.17, ένα tsc τη φορά). **jest = από repo ROOT.**

---

## 0. ΤΟ ΑΙΤΗΜΑ ΤΟΥ GIORGIO (verbatim intent)

> «Θέλω το σύστημα να τα διορθώνει ΟΛΑ αυτόματα. Ο μηχανικός να παρεμβαίνει το ελάχιστο δυνατό — και αν γίνεται, καθόλου. Το σύστημα να κάνει ΟΛΕΣ τις μετατροπές αυτόματα: διαστασιολογήσεις διατομών, σιδήρου, οντοτήτων.»

**Η προειδοποίηση «αύξησε το πάχος της πλάκας» ΕΙΝΑΙ ΑΠΟΤΥΧΙΑ ΤΟΥ ΟΡΑΜΑΤΟΣ**, όχι λύση. Ο «στατικός» (η εφαρμογή, ADR-487 §2) πρέπει να **το κάνει μόνος του**. Warning ΜΟΝΟ στην **έσχατη** περίπτωση που το σύστημα αποδεδειγμένα δεν μπορεί (π.χ. φυσικά αδύνατη γεωμετρία ακόμη και στο μέγιστο πρακτικό μέγεθος).

---

## 1. 🔑 ROOT CAUSE — repro-confirmed σε LIVE DB (Firestore), ΟΧΙ υπόθεση

Δοκιμάστηκε ζωντανά: 2 κολώνες 400×400 + πέδιλα + δοκάρι 250×**400** + **πλάκα-πρόβολος**. Μεγαλώνοντας τον πρόβολο (2.77m → 7.48m), παρατηρήθηκε:

| Πρόβολος | Slab top σχάρα | Beam οπλισμός | Beam ύψος | Κολώνες |
|---|---|---|---|---|
| 2.77m | Ø10/75 | 2Ø22 | 400 | 400×400 (315/75) |
| 7.48m | **Ø25/75** | **4Ø32** | **400 (ίδιο!)** | **400×400 (ίδιο!)** |

**Η κατασκευή θα είχε καταρρεύσει.** Ο app έβγαλε **Ø25/75 σε πλάκα 200mm** ως «λύση». Τα πραγματικά προβλήματα:

- **(A) ΚΑΜΙΑ καμπτική επάρκεια διατομής.** Ο suggester κάνει `As = M_Ed/(z·f_yd)` **χωρίς ανώτατο όριο `M_Ed ≤ M_Rd,max`**. Για τον 7.48m πρόβολο: `M_Ed = q·L²/2 ≈ 367 kNm/m` αλλά `M_Rd,max` διατομής 200mm (d=175, C25/30, x/d=0.45) `≈ 0.295·f_cd·b·d² ≈ 150 kNm/m`. **367 ≫ 150 → αστοχία θλίψης ΣΚΥΡΟΔΕΜΑΤΟΣ, ΑΣΧΕΤΑ με τον χάλυβα.** Το Ø25/75 είναι **ψεύτικη λύση** (ούτε χωράει Ø25 σε 200mm). **GREP CONFIRMED: μηδέν `M_Rd`/`momentCapacity`/`balanced`/`x/d limit` στο design path** (μόνο `member-utilization.ts`, που είναι overlay, ΟΧΙ design gate).
- **(B) ΚΑΜΙΑ auto-διαστασιολόγηση ΔΙΑΤΟΜΩΝ πέραν του δοκαριού.** `member-sizing.ts suggestBeamSection` + `buildBeamSizePatch` + `AutoSizeMembersCommand` = **BEAM-ONLY** (`buildBeamSizePatch` → `null` για non-beam). **Δεν υπάρχει** `suggestSlabThickness` / `suggestColumnSection` / `buildSlabSizePatch` / `buildColumnSizePatch`. Άρα: πάχος πλάκας, διατομή κολώνας **ΔΕΝ μεγαλώνουν ποτέ** — μόνο ο οπλισμός (απεριόριστος).
- **(C) ΚΑΜΙΑ στρέψη δοκαριού.** Ο μονόπλευρος πρόβολος δίνει τεράστια στρεπτική ροπή `T_Ed ≈ q·L²/2` ανά μέτρο στο δοκάρι· ένα 250×400 θα στριβόταν. **GREP: `torsion` μόνο στον FEM solver (αποτέλεσμα), καμία σχεδίαση/έλεγχος.**
- **(D) Κολώνες τυφλές + κανένας global έλεγχος εφικτότητας.** Κολώνα-N = grid tributary (slab-agnostic)· FEM moment = engaged-only (ADR-497 committed αλλά χρειάζεται «Ανάλυση»). Καμία διατομή κολώνας δεν μεγαλώνει. **Κανένα «αυτό το μονοπάτι φορτίων δεν στέκει».**

**Συμπέρασμα:** ο app **οπλίζει μέλη σε απομόνωση** χωρίς (Α) έλεγχο αν η διατομή αντέχει, (Β) μεγέθυνση διατομών, (Γ) στρέψη, (Δ) global feasibility. Παράγει «οπλισμό που ικανοποιεί τη ροπή» ενώ οι **διατομές μένουν αδύνατες**.

---

## 2. 🎯 ΤΑ 4 ΠΑΡΑΔΟΤΕΑ (reframed ως ΑΥΤΟ-ΔΙΟΡΘΩΣΗ, ΟΧΙ warning)

> Όλα στην υπηρεσία του: **«σε κάθε κίνηση, ο οργανισμός αυτο-διορθώνεται μέχρι να επαρκεί· ο μηχανικός δεν αγγίζει τίποτα».**

### A — Section flexural-capacity ceiling (`M_Ed ≤ M_Rd,max`) — Η ΦΥΣΙΚΗ ΠΥΛΗ
NEW SSoT καμπτικής αντοχής/ορίου: `limitMoment(ctx)` ή `flexuralCapacityKnm` ανά provider (EC2/ΕΚΩΣ): `M_Rd,lim = μ_lim·f_cd·b·d²` (μ_lim≈0.295). Ο suggester (δοκάρι **και** πλάκα) **σταματά** τον χάλυβα στο όριο· αν `M_Ed > M_Rd,lim` → η διατομή είναι ανεπαρκής → **πυροδοτεί auto-size (B)**, ΔΕΝ βγάζει ψεύτικο Ø25/75.

### B — Auto-size ΔΙΑΤΟΜΩΝ (το κύριο ζητούμενο: «το σύστημα να τα κάνει μόνο του»)
**EXTEND** το member-sizing pattern (ήδη: serviceability `L/d` + flexural-capacity + shear depth για **δοκάρι**) σε:
- **Πλάκα:** `suggestSlabThickness(ctx)` — `d_req = max(d_serviceability[slabSpanDepthLimit ADR-498], d_capacity[√(M_Ed/(μ_lim·f_cd·b))])`. Mirror του `suggestBeamSection`.
- **Κολώνα:** `suggestColumnSection(ctx)` — από N-M (ADR-472) + λυγηρότητα.
- **Δοκάρι ύψος για στρέψη** (μαζί με C).
**Wiring:** NEW `buildSlabSizePatch`/`buildColumnSizePatch` (mirror `buildBeamSizePatch`) → ο `AutoSizeMembersCommand` (σήμερα beam-only) γίνεται **member-generic** → προστίθεται στον **proactive κύκλο** ΠΡΙΝ τον auto-reinforce, ώστε: **resize διατομών → μετά οπλισμός στη ΝΕΑ διατομή**. Geometry-changing patch (ΟΧΙ additive — προσοχή σε undo/persist + bim:*-params-updated emit).

### C — Beam torsion από μονόπλευρο πρόβολο
Ο πρόβολος-πλάκα δίνει `T_Ed` στο φέρον δοκάρι (reuse `computeSlabSupportConditions` ADR-498 — ξέρει ποια δοκός + μήκος προβόλου). NEW: `t_Ed = q_Ed·L_cant²/2` → έλεγχος/σχεδίαση στρέψης (EC2 §6.3) → επηρεάζει διατομή δοκαριού + συνδετήρες. Provider method `torsionalCapacity`/`suggestTorsionReinforcement`.

### D — Global feasibility escalation (warning ΜΟΝΟ εδώ)
Όταν το auto-size (B) φτάσει **πρακτικό μέγιστο** (π.χ. πάχος πλάκας > X, ύψος δοκαριού > Y) και ΑΚΟΜΑ δεν επαρκεί → **τότε** escalate diagnostic «ανέφικτο — απαιτείται αλλαγή σχεδιασμού (π.χ. στήριξη στην ελεύθερη άκρη)». Αυτή είναι η **έσχατη** παρέμβαση που ζητά ο Giorgio. Reuse `StructuralDiagnostic` + `runSlabChecks` (ADR-498).

**Πρόταση σειράς (κάθε slice = plan-first):** **A → B → C → D**. Το A είναι θεμελιώδες + low-risk (έλεγχος). Το B είναι το κύριο ζητούμενο (auto-size). C/D επεκτάσεις.

---

## 3. 🔴 SSOT AUDIT (GREP) — ΤΡΕΞΕ ΞΑΝΑ ΠΡΙΝ ΚΩΔΙΚΑ. Παραδοτέο: πίνακας reuse vs new.

### 3.1 Sizing (REUSE + EXTEND — ΜΗΝ ξαναφτιάξεις engine)
```
src/subapps/dxf-viewer/bim/structural/sizing/member-sizing.ts        ← suggestBeamSection (serviceability+flexural+shear depth)· header λέει «member-generic» → EXTEND για slab/column
src/subapps/dxf-viewer/bim/structural/sizing/beam-size-patch.ts      ← buildBeamSizePatch (MemberSizePatch)· mirror για slab/column
src/subapps/dxf-viewer/core/commands/entity-commands/AutoSizeMembersCommand.ts ← beam-only → member-generic
src/subapps/dxf-viewer/hooks/member-auto-size-core.ts                ← ο proactive πυρήνας του sizing
grep -rn "suggestBeamSection\|buildBeamSizePatch\|AutoSizeMembers\|MemberSizePatch\|serviceabilityDepth\|flexuralDepth" src/subapps/dxf-viewer
```
### 3.2 Capacity ceiling (NEW — δεν υπάρχει· πρόσθεσέ το ως provider SSoT)
```
src/subapps/dxf-viewer/bim/structural/codes/structural-code-types.ts ← StructuralCodeProvider (πρόσθεσε limitMoment/flexuralCapacity)
src/subapps/dxf-viewer/bim/structural/codes/{eurocode,greek-legacy}-provider.ts ← υλοποίηση μ_lim·f_cd·b·d²
src/subapps/dxf-viewer/bim/structural/codes/suggest-reinforcement.ts ← asStrengthBeamMm2 (εδώ μπαίνει το ceiling)
src/subapps/dxf-viewer/bim/structural/codes/suggest-slab-reinforcement.ts ← asStrengthSlabPerMetreMm2 (ADR-498· εδώ το slab ceiling)
grep -rn "f_cd\|fcd\|concreteFcdMpa\|f_yd\|rebarFyd\|LEVER_ARM" src/subapps/dxf-viewer/bim/structural/codes
```
### 3.3 Topology/loads (REUSE — δουλεύουν)
```
src/subapps/dxf-viewer/bim/structural/loads/slab-beam-support.ts     ← computeSlabSupportConditions (ADR-498· πρόβολος+μήκος → torsion C + slab span)
src/subapps/dxf-viewer/bim/structural/section-context.ts             ← build{Beam,Column,SlabFoundation}SectionContext (designLineLoadKnM/designMomentKnm/cantileverSpanMm)
src/subapps/dxf-viewer/bim/structural/reinforce-patch.ts             ← buildReinforcePatch (μετά το resize)
src/subapps/dxf-viewer/hooks/useStructuralOrganism.ts                ← ο ΕΝΑΣ recompute (publish stores + diagnostics)· εδώ μπαίνει το auto-size pass
src/subapps/dxf-viewer/hooks/{structural-auto-reinforce-core,useProactiveMemberSizing,useProactiveOrganismReinforce}.ts
```
### 3.4 Torsion (input υπάρχει στον solver· design = NEW)
```
src/subapps/dxf-viewer/bim/structural/analytical/solver/{solver-types,member-diagrams}.ts ← torsion (αποτέλεσμα)
```

---

## 4. ⚙️ ΑΡΧΙΤΕΚΤΟΝΙΚΗ ΑΡΧΗ — THE AUTO-CORRECTION LOOP (κρίσιμο)

Σε **κάθε** structural event, ο `useStructuralOrganism` recompute πρέπει (ADR-487 §4):
1. **Resize διατομών** (auto-size B): πάχος πλάκας / ύψος δοκαριού / διατομή κολώνας ώστε `M_Ed ≤ M_Rd,max` (A) **ΚΑΙ** `L/d ≤ limit` **ΚΑΙ** στρέψη OK (C).
2. **Auto-reinforce** στη ΝΕΑ διατομή (ADR-472/486/491/498).
3. **Re-check** επάρκεια· **iterate** μέχρι σύγκλιση Ή escalate (D).

**🚨 ΚΡΙΣΙΜΟ (μαθήματα ADR-491/488):** το auto-size αλλάζει ΓΕΩΜΕΤΡΙΑ → προκαλεί `bim:*-params-updated` → ξανα-trigger τον κύκλο. **ΚΙΝΔΥΝΟΣ INFINITE LOOP.** Υποχρεωτικά: **convergence guard** (materiallyDiffers — ίδια διατομή→μηδέν patch, mirror ADR-472 S3), **idempotent**, **σιωπηλά** (μηδέν churn), **coalesced** (`createMicrotaskCoalescer` ADR-488). Το ADR-491 αφαίρεσε reactive trigger ακριβώς γι' αυτό — ΜΗΝ προσθέσεις self-sustaining κύκλο.

---

## 5. ΣΧΕΤΙΚΑ ADR (διάβασε όσα αγγίζεις· code = source of truth)
**ADR-487 (ΟΡΑΜΑ — ΠΡΩΤΟ)** · **ADR-475** (auto member sizing — ο πυρήνας προς επέκταση) · **ADR-472** (load-aware N-M οπλισμός — εδώ μπαίνει το capacity ceiling) · **ADR-486** (topology-aware support / πρόβολος) · **ADR-498** (cantilever slab — ΔΙΚΟ ΜΟΥ, η βάση για slab) · **ADR-491/497** (FEM-driven κολώνα — για column section) · **ADR-481/483** (FEM/διαγράμματα — torsion input) · **ADR-476** (slab reinforcement).

## 6. ΚΑΤΑΣΤΑΣΗ TREE (πριν ξεκινήσεις — ΕΠΙΒΕΒΑΙΩΣΕ με `git log`/`ls`)
- **Committed:** ADR-495 (`4568c19c`), ADR-497 (`9be6d791`).
- **ADR-498 (ΔΙΚΟ ΜΟΥ, μάλλον committed ως τότε — αλλιώς uncommitted):** cantilever-slab. Files: `loads/slab-beam-support.ts`, `organism/{slab-support-condition-store,slab-checks}.ts`, `codes/{structural-code-types,suggest-slab-reinforcement,eurocode-provider,greek-legacy-provider}.ts`, `section-context.ts`, `active-reinforcement.ts`, `reinforce-patch.ts`, `reinforcement/{slab-foundation-reinforcement-compute,footing-reinforcement-compute[meshReinforcementRatio SSoT]}.ts`, `organism/structural-organism-types.ts`, `AutoReinforceOrganismCommand.ts`, `hooks/{useStructuralOrganism,structural-auto-reinforce-core}.ts`, `i18n el/en`, ADR-498. **REUSE το `computeSlabSupportConditions` + `slabSpanDepthLimit`.**
- **🆕 Άλλου agent (shared tree, ΜΗΝ ΑΓΓΙΞΕΙΣ):** ADR-496 column-align (`bim/columns/*`, `bim/geometry/{column-geometry,shared/polygon-*}`, `bim/grips/grip-math`, `bim/types/column*`, `bim/validators/column-validator`, `useColumnParamsDispatcher`).
- Γνωστά **pre-existing jest failures** (ΟΧΙ δικά σου): 2 raft/slab (ADR-476) — `raft-bearing` + `reinforcement-checks foundation-slab raft` (`geometry.maxFreeSpanM` undefined σε fixtures).

## 7. ΚΑΝΟΝΕΣ (ΑΠΑΡΑΒΑΤΟΙ — CLAUDE.md)
- **PLAN-FIRST ανά slice:** ADR-487 read → SSoT audit (grep §3) → repro/υπολογισμοί → πίνακας reuse vs new → plan → **περίμενε «προχώρα»** → code.
- **Full SSoT (N.0.2):** ΜΗΝ φτιάξεις νέο sizing engine — **EXTEND** το `member-sizing`/`AutoSizeMembersCommand` (member-generic). Capacity ceiling = NEW provider method (ΕΝΑ SSoT EC2/ΕΚΩΣ). Reuse `computeSlabSupportConditions`/`spanMomentDivisor`/`*SpanDepthLimit`/`buildReinforcePatch`.
- **GOL:** ≤40γρ/func, ≤500γρ/file, μηδέν `any`/`as any`/`@ts-ignore`, μηδέν hardcoded strings (i18n el+en αν UI), Select=`@/components/ui/select`.
- **ADR-driven (N.0.1 + N.15):** PHASE 3 → ADR-499 (NEW) + cross-ref ADR-475/472/487/498 + adr-index + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + MEMORY (ίδιο commit).
- **commit/tsc = ο Giorgio.** jest = από ROOT. **Shared tree: git add ΜΟΝΟ δικά σου.** **Απάντα ΠΑΝΤΑ Ελληνικά.**

## 8. ΕΡΓΑΛΕΙΟ ΕΠΑΛΗΘΕΥΣΗΣ (live DB — Firestore MCP)
Project `proj_12788b6a`, building greek-legacy/C25/30/σ_allow 150. 2 κολώνες 400×400 + πέδιλα + δοκάρι 250×400 + πλάκα-πρόβολος (collections `floorplan_{slabs,beams,columns,foundations}`). **Μετά το fix, πρόβολος 7.48m πρέπει:** (α) **πάχος πλάκας αυτο-μεγαλώνει** (~1m, ΟΧΙ Ø25 σε 200mm)· (β) **ύψος δοκαριού αυτο-μεγαλώνει** (στρέψη+φορτίο)· (γ) **διατομή κολώνας αυτο-μεγαλώνει**· (δ) **κανένα warning** αν λύθηκε αυτόματα — warning ΜΟΝΟ αν φυσικά αδύνατο στο μέγιστο. Σύγκρινε appliedLoad/reinforcement/**διαστάσεις** πριν/μετά.

## 9. ΑΡΧΗ ΣΧΕΔΙΑΣΗΣ (ADR-487 §3-§5)
«ΕΝΑΣ ζωντανός οργανισμός που **διαστασιολογείται δυναμικά**»: σε κάθε αλλαγή, **διατομές + οπλισμός + οντότητες** προσαρμόζονται αυτόματα ώστε ο φορέας να **στέκει**, με τον μηχανικό να μην παρεμβαίνει — εκτός από την έσχατη, αποδεδειγμένα-αδύνατη περίπτωση.

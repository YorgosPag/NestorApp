# HANDOFF — ADR-501: Live propagation πρόβολος-πλάκα → δοκάρι → **αμφότερες κολώνες** → **αμφότερα πέδιλα** (reaction-aware takedown)

> 🧭 **ΔΙΑΒΑΣΕ ΠΡΩΤΑ ΤΟ ΟΡΑΜΑ:** `docs/centralized-systems/reference/adrs/ADR-487-living-structural-organism-vision.md` — ειδικά **§4** («ο κανόνας του σε κάθε κίνηση»: τοπική αυτο-διόρθωση σε ΚΑΘΕ edit) + **§3** (ΕΝΑΣ οργανισμός, όχι αυθαίρετα κομμάτια) + **§9** (scope guard: Revit-grade πρακτικός, ντετερμινιστικός, ΟΧΙ ML, ΟΧΙ full SAP/Robot μη-γραμμική).

**Ημ/νία:** 2026-06-19 · **Από:** Opus session (ολοκλήρωσε ADR-500 «Αυτόματη Μελέτη» Slice 1 [committed] + Slice 2 DEFER A/B [uncommitted]) · **Γλώσσα:** ΠΑΝΤΑ Ελληνικά.
**Τύπος:** 🔴 PLAN-FIRST. **SSoT AUDIT (GREP) ΥΠΟΧΡΕΩΤΙΚΟ ΠΡΙΝ ΚΩΔΙΚΑ** (ξανα-τρέξε — shared tree, ο κώδικας αλλάζει· οι πίνακες εδώ είναι confirmed 2026-06-19 αλλά επιβεβαίωσέ τους).
**Απαιτήσεις Giorgio (verbatim):** Revit/Robot-grade, **Full Enterprise + Full SSoT, ΧΩΡΙΣ ΔΙΠΛΟΤΥΠΑ**. Πριν κώδικα → πραγματικό grep audit για reuse. **ΜΗΝ φτιάξεις νέο engine — ΕΠΕΚΤΕΙΝΕ τα υπάρχοντα.**
**🚨 COMMIT + tsc = ο GIORGIO, ΟΧΙ εσύ.** jest = από repo ROOT. Επαλήθευση: live DB Firestore MCP (`proj_12788b6a`).
**🎯 Μοντέλο:** Opus (αρχιτεκτονική load-path, cross-cutting). `/model opus`
**⚠️ SHARED WORKING TREE με άλλον agent** — `git add` ΜΟΝΟ τα δικά σου. ΜΗΝ αγγίξεις ADR-496 (`bim/columns/column-beam-align*`) ούτε ADR-483 (`bim-3d/diagrams/*`, `analytical/diagrams/*`, `ColumnDiagram3DOverlay`, `StructuralDiagramOverlay`) = άλλου agent. **ΠΡΟΣΟΧΗ:** το ADR-500 Slice 2 είναι ακόμη uncommitted στο tree (δικά μου: `member-auto-size-core.ts`, `structural-auto-reinforce-core.ts`, `auto-foundation-design-core.ts`, `structural-auto-study-core.ts`, `useStructuralAutoStudy.ts`) — ο Giorgio θα τα commit-άρει· μην τα μπερδέψεις.

---

## 0. ΤΙ ΖΗΤΑΕΙ Ο GIORGIO (verbatim context)

> «Τώρα που αλλάζω κάθε φορά το μήκος του προβόλου της πλάκας που είναι συνδεμένη στο δοκάρι, υπολογίζονται αυτόματα κάθε φορά η διατομή και ο οπλισμός της κολώνας και του πεδίλου; Εννοώ και των 2 κολωνών και των 2 πεδίλων;»

**Σημερινή απάντηση (verified από κώδικα):** **ΟΧΙ live.** Αλλάζοντας τον πρόβολο, ενημερώνεται **μόνο το δοκάρι**. Οι 2 κολώνες + 2 πέδιλα **ΔΕΝ** ξαναϋπολογίζονται live — γιατί η αξονική κολώνας στο takedown είναι **grid-tributary-area** (slab/beam-agnostic), και οι αντιδράσεις δοκαριού→κολώνας είναι **DEFER (FEM)**. Φτάνουν στις κολώνες/πέδιλα **μόνο** μέσω FEM (engaged-gated, read-time/ρητό) ή πατώντας **«Αυτόματη Μελέτη»** (ADR-500, force-engage FEM).

**Στόχος ADR-501:** να συμβαίνει **LIVE σε κάθε αλλαγή** (ΟΡΑΜΑ §4) — χωρίς κουμπί — η πλήρης διαδρομή: **πρόβολος-πλάκα → δοκάρι → αμφότερες στηρίζουσες κολώνες (διατομή+οπλισμός) → αμφότερα πέδιλα (μέγεθος+οπλισμός)**, ντετερμινιστικά & χωρίς infinite-loop.

---

## 1. Η ΡΙΖΑ (confirmed grep 2026-06-19)

| Σημείο | Αρχείο:γραμμή | Τι κάνει σήμερα | Γιατί δεν προπαγκάρει |
|---|---|---|---|
| Αξονική κολώνας | `loads/load-path-takedown.ts:103` `columnLoad(c, tributaryM2, s)` | N = `tributaryM2` × όροφοι × area-loads + ίδιο βάρος | `tributaryM2` = `buildColumnTributary` = **grid area** (`computeGridTributaryAreas`, l.95-99) — **slab/beam-agnostic** |
| Φορτίο δοκαριού | `loads/load-path-takedown.ts:123` `beamLoad(...)` | παίρνει slab-cantilever (`slabTribM2`, ADR-495) → **μένει στο δοκάρι** | **δεν επιστρέφεται ως αντίδραση** στις `beamSupportColumnIds` |
| Πέδιλο | `load-path-takedown.ts:188` | παίρνει το `columnLoadById.get(colId)` (αντίδραση κολώνας) | άρα κι αυτό grid-tributary (κληρονομεί τη ρίζα) |
| 🔑 Το DEFER | `load-path-takedown.ts:15` (σχόλιο) | *«Πραγματικό chained reaction tree = DEFER (FEM ADR)»* | **εδώ είναι το κενό που κλείνει το ADR-501** |
| FEM override (engaged) | `analytical/column-fem-axial.ts` (ADR-497) + `column-fem-moment.ts` (ADR-491) | διαβάζει N/M βάσης κολώνας από τον φορέα | engaged-gated (`resolveEngagedAnalysisResult`) + read-time· **persisted ΜΟΝΟ σε ρητό/auto-study** (ADR-491 anti-loop) |

**🔑 ΚΛΕΙΔΙ ΓΙΑ ΤΗ ΛΥΣΗ:** το `loads/load-path-walk.ts:39` `topologicalLoadOrder` **ΗΔΗ** διατάσσει **beams → columns → footings**. Άρα όταν το `computeLoadPathPatches` loop φτάνει στην κολώνα, **τα δοκάρια έχουν ήδη υπολογιστεί** → καθαρό σημείο για να συσσωρεύσεις αντιδράσεις δοκαριών και να τις προσθέσεις στην αξονική κολώνας **στο ΙΔΙΟ pass** (μηδέν νέος loop, μηδέν νέο reactive trigger).

---

## 2. SSoT AUDIT — confirmed reuse pointers (ΞΑΝΑ-GREP πριν κώδικα)

```
buildColumnTributary|columnLoad|beamLoad|computeLoadPathPatches      loads/load-path-takedown.ts
topologicalLoadOrder|beamSupportColumnIds|footingColumnId            loads/load-path-walk.ts (graph walk SSoT — ADR-467)
computeMemberTakedown|MemberLoad|extraDeadAxialKn                    loads/load-takedown.ts (το per-member takedown math)
computeSlabBeamTributary                                             loads/slab-beam-support.ts (ADR-495 slab→beam)
buildBeamSupportTypeMap|derive-beam-support|cantilever              organism/derive-beam-support.ts (ADR-486 — count===1→cantilever)
resolveColumnFemAxial|buildColumnFemAxialMap                        analytical/column-fem-axial.ts (ADR-497)
resolveColumnFemMoment|buildColumnFemMomentMap                      analytical/column-fem-moment.ts (ADR-491)
resolveEngagedAnalysisResult                                        analytical/engaged-analysis-result.ts (το engaged gate)
femAxialOverride                                                    footing-design/footing-design-input.ts (πώς το πέδιλο δέχεται FEM N)
runStructuralLoadTakedown                                           hooks/structural-load-takedown-core.ts (ο SSoT πυρήνας που καλεί computeLoadPathPatches)
isTakedownWritable                                                  (convergence guard — μην ξαναγράφεις χειροκίνητες υπερβάσεις)
```

**Επιβεβαίωσε:**
- Πώς το **column SIZING** (ADR-499 §B2, `sizing/column-size-patch.ts`) + **column REINFORCE** διαβάζουν την αξονική: από `column.params.appliedLoad` (persisted) ή/και FEM override; → αν persisted appliedLoad, τότε **αρκεί** να γράψει το takedown μεγαλύτερο appliedLoad → size+reinforce+footing προπαγκάρουν αυτόματα μέσω των ΥΠΑΡΧΟΝΤΩΝ proactive hooks (μηδέν νέο wiring).
- Πώς ο **foundation design** (`hooks/auto-foundation-design-core.ts`, ADR-500) διαβάζει N: `serviceAxialKn(column.params.appliedLoad)` → **ΝΑΙ persisted appliedLoad** → reaction-aware appliedLoad ρέει αυτόματα στο πέδιλο. ✅ (confirmed 2026-06-19)

---

## 3. ΟΙ ΔΥΟ ΔΡΟΜΟΙ + ΣΥΣΤΑΣΗ (Revit-grade)

> **Πώς το κάνουν οι μεγάλοι (Revit/Robot):** ΔΕΝ τρέχουν full FEM σε κάθε πλήκτρο. Τρέχουν **load takedown με αντιδράσεις** (στατική) για το live, και full FEM **on-demand** για ακρίβεια. Άρα το live propagation πρέπει να είναι **reaction-aware takedown** (ντετερμινιστικό, φθηνό, always-on), ΟΧΙ live FEM.

### (α) RECOMMENDED — Reaction-aware takedown (στατική, always-on, ΟΧΙ FEM)
Στο `computeLoadPathPatches`: συσσώρευσε τις **αντιδράσεις κάθε δοκαριού** στις στηρίζουσες κολώνες (`beamSupportColumnIds`), και πρόσθεσέ τες στην αξονική κολώνας ΠΡΙΝ υπολογιστεί το πέδιλο (η σειρά beams→columns→footings το επιτρέπει ήδη).
- **Πρόβολος (1 στήριξη, derive-beam-support count===1):** η μοναδική κολώνα παίρνει **100%** της αντίδρασης δοκαριού.
- **Αμφιέρειστο (2 στηρίξεις):** split κατά στατική (UDL → 50/50, ή position-weighted).
- **Αποτέλεσμα:** column N (incl. πρόβολο) → column **sizing(N)** + **footing** ενημερώνονται **live** σε κάθε αλλαγή. Καλύπτει το «2 κολώνες + 2 πέδιλα» για **αξονικό**.
- **Μηδέν infinite-loop:** είναι ΜΕΣΑ στο ίδιο terminating one-pass takedown (ο convergence guard `isTakedownWritable`/ίδιο φορτίο→μηδέν patch το κλείνει). **ΔΕΝ** προσθέτεις νέο reactive trigger.
- **Μηδέν νέο wiring:** γράφει μεγαλύτερο `appliedLoad` στις κολώνες → οι ΥΠΑΡΧΟΝΤΕΣ proactive hooks (size/reinforce/foundation) προπαγκάρουν αυτόματα.

### (β) Column MOMENT από τον πρόβολο (η κάμψη της στηρίζουσας κολώνας)
Ο πρόβολος δίνει **hogging ροπή** που η στηρίζουσα κολώνα παραλαμβάνει (M-N κολώνας). Το (α) δίνει N, ΟΧΙ M. Δύο επιλογές:
- **(β1) RECOMMENDED — ντετερμινιστική στατική ροπή στήριξης** (mirror του beam-torsion sensor ADR-499 §C / beam cantilever ADR-486): παράγαγε `M_support = w·L²/2` του προβόλου και πέρασέ τη ως **column design moment** στο live sizing/reinforce — **pure statics, ΟΧΙ FEM, ΟΧΙ loop**. SSoT-καθαρό, always-on.
- **(β2) riskier — persisted FEM live:** ξεκλείδωμα του `analysis-solved→reinforce` persisted (που ο ADR-491 **σκόπιμα** απενεργοποίησε λόγω infinite-loop: analysis-solved→reinforce→auto-reinforced→organism rebuild→FEM solve→analysis-solved…). Αν το επιλέξεις, **ΥΠΟΧΡΕΩΤΙΚΟΣ** bounded convergence guard (όπως ο ADR-500 loop) + coalesce + μην εκπέμπεις σε count:0. **Προτίμησε το β1.**

### 🏗️ ΠΡΟΤΕΙΝΟΜΕΝΗ ΑΡΧΙΤΕΚΤΟΝΙΚΗ (phased, ΟΧΙ full FEM live)
- **Slice 1 = (α)** reaction-aware axial → column N + footings live. **Το 80% του win, ελάχιστο ρίσκο.**
- **Slice 2 = (β1)** ντετερμινιστική column support-moment από πρόβολο → column section+reinforcement (M-N) live.
- FEM (ADR-491/497) **παραμένει** για precise multi-span / ρητή «Ανάλυση» / «Αυτόματη Μελέτη».
> Η τελική απόφαση αρχιτεκτονικής γίνεται στο **PLAN-FIRST** της νέας συνεδρίας, αφού επιβεβαιώσεις με grep πώς size/reinforce καταναλώνουν N & M.

---

## 4. ΠΑΡΑΔΟΤΕΟ (PLAN-FIRST → «προχώρα» → κώδικας)

### Slice 1 (α) — reaction-aware axial
- **EXTEND** `loads/load-path-takedown.ts`: πριν/κατά το loop, build `beamReactionByColumn: Map<colId, {deadKn, liveKn}>` διανέμοντας κάθε `beamLoad` στις `beamSupportColumnIds` (cantilever→100%, αλλιώς split). Στο column branch: `columnLoad(...)` **+** `beamReactionByColumn.get(colId)`.
- **Pure** (μένει testable· `computeLoadPathPatches` δέχεται ήδη entities/graph/settings). Reuse `computeMemberTakedown`/`MemberLoad` add helper.
- **Jest:** πρόβολος-πλάκα → δοκάρι → η στηρίζουσα κολώνα παίρνει αυξημένο appliedLoad· αμφιέρειστο → 50/50· μηδέν regression για γυμνές κολώνες (κανένα δοκάρι → ίδιο grid).

### Slice 2 (β1) — ντετερμινιστική column support-moment
- **NEW** pure SSoT (mirror `loads/beam-torsion.ts`): `columnCantileverSupportMoment` — από τον πρόβολο-δοκάρι/πλάκα → M στη στηρίζουσα κολώνα.
- Πέρασέ τη στο live column sizing (ADR-499 §B2) + reinforce ως design moment (όπως το FEM moment, αλλά static/always-on). **Προσοχή SSoT:** μην διπλασιάσεις με το engaged FEM — ιεραρχία (engaged FEM υπερισχύει, αλλιώς static estimate).
- **Jest:** πρόβολος → στηρίζουσα κολώνα παίρνει M>0 → διατομή/οπλισμός μεγαλώνουν· συμμετρικό αμφιέρειστο → M≈0.

### Δεν χρειάζεται νέο UI/event/ribbon
Όλα ρέουν μέσα από το ΥΠΑΡΧΟΝ takedown→proactive chain (ADR-459 Φ7/Φ8/Φ9). Καμία νέα συνδρομή.

---

## 5. ΚΡΙΣΙΜΑ ΜΑΘΗΜΑΤΑ (μην τα πατήσεις)
- 🚨 **ΚΑΝΕΝΑ νέο reactive trigger / event listener** (ADR-491/488 infinite-loop). Το (α)/(β1) ζουν **ΜΕΣΑ** στον υπάρχοντα terminating takedown — δεν προσθέτεις subscription.
- 🚨 **Convergence guard:** βεβαιώσου ότι ίδια τοπολογία/φορτίο → ίδιο appliedLoad → μηδέν patch → ο chain τερματίζει (`isTakedownWritable`). Η reaction είναι ντετερμινιστική συνάρτηση γεωμετρίας → idempotent.
- 🚨 **SSoT ιεραρχία N & M:** engaged FEM (ADR-497/491) **υπερισχύει** του static estimate· static estimate = always-on fallback/seed. **ΜΗΝ** δημιουργήσεις δεύτερη παράλληλη αλήθεια (γι' αυτό το όραμα μιλά για ΕΝΑΝ οργανισμό).
- **Μην αγγίξεις** `buildColumnTributary` grid logic για γυμνές κολώνες (μηδέν regression) — **πρόσθεσε** reactions επιπλέον.
- **GOL:** ≤40γρ/func, ≤500γρ/file, μηδέν `any`/`as any`/`@ts-ignore`, μηδέν hardcoded strings (i18n el+en αν προστεθεί label).

---

## 6. ΚΑΝΟΝΕΣ (ΑΠΑΡΑΒΑΤΟΙ — CLAUDE.md)
- **PLAN-FIRST:** ΟΡΑΜΑ §4 → SSoT audit (grep, ΞΑΝΑ) → reuse-vs-new πίνακας → plan (slices) → **περίμενε «προχώρα»** → code.
- **commit + tsc = ο GIORGIO.** jest = repo ROOT. **Απάντα ΠΑΝΤΑ Ελληνικά.**
- **SHARED TREE:** `git add` ΜΟΝΟ δικά σου. ΜΗΝ ADR-496 (`bim/columns/column-beam-align*`) ούτε ADR-483 (`bim-3d/diagrams/*`). ΠΡΟΣΟΧΗ στα uncommitted ADR-500 Slice 2 αρχεία.
- **Νέο ADR = ADR-501** (επιβεβαίωσε με `adr-index.md` — το ADR-500 προστέθηκε ήδη). Μετά: ADR-501 + adr-index + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (1-2 γρ.) + MEMORY (`reference_live_reaction_aware_takedown.md`).
- **Pre-existing jest fails (ΟΧΙ δικά σου):** 6 raft (ADR-476 `maxFreeSpanM` σε `section-context.ts`) + 1 `AssignWallTypeCommand` undo.

## 7. ΕΡΓΑΛΕΙΟ ΕΠΑΛΗΘΕΥΣΗΣ (live DB — Firestore MCP `proj_12788b6a`)
2 κολώνες 400×400 + 2 πέδιλα + δοκάρι 250×400 ανάμεσα + πλάκα-πρόβολος συνδεμένη στο δοκάρι. **Μετά:** άλλαξε **live** το μήκος του προβόλου (grip/ribbon) → **χωρίς να πατήσεις τίποτα** να μεγαλώνουν αυτόματα N→διατομή→οπλισμός **και των 2 κολωνών** + μέγεθος+οπλισμός **και των 2 πεδίλων**. Μίκρυνε τον πρόβολο → να μικραίνουν πάλι (idempotent, convergence). Σύγκρινε με «Αυτόματη Μελέτη» (πρέπει να συμφωνούν στο αξονικό).

## 8. ΚΑΤΑΣΤΑΣΗ ΠΡΟΗΓΟΥΜΕΝΗΣ ΔΟΥΛΕΙΑΣ (context)
- **ADR-500 «Αυτόματη Μελέτη»** (ADR-487 §7): Slice 1 convergence loop **COMMITTED**· Slice 2 (DEFER A per-kind unique report + DEFER B force-FEM frame-action) **uncommitted** στο tree. Ο loop force-engage-άρει FEM → εκεί ΟΝΤΩΣ προπαγκάρει σε όλες τις κολώνες/πέδιλα· το ADR-501 το φέρνει **live χωρίς κουμπί**.
- MEMORY: `reference_auto_study_convergence_loop.md`, `reference_flexural_capacity_ceiling.md` (ADR-499), `reference_fem_authoritative_axial_footing.md` (ADR-497), `reference_slab_beam_load_propagation.md` (ADR-495), `reference_topology_aware_beam_support_ssot.md` (ADR-486).
- Working tree: μοιράζεται με άλλον agent (ADR-496 columns/beam-align, ADR-483 3Δ diagrams).

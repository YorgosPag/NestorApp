# HANDOFF — Topology-aware δομικός επανυπολογισμός σε μετακίνηση/αποκόλληση κολώνας (Revit/Robot-grade)

**Ημ/νία:** 2026-06-18 · **Από:** Opus session (μόλις ολοκλήρωσε & browser-verified ADR-483 Slice 4b+ διαγράμματα M/V/N + ADR-485 utilization) · **Γλώσσα:** ΠΑΝΤΑ Ελληνικά.
**Τύπος:** 🔴 PLAN-FIRST. **SSoT AUDIT (GREP) ΥΠΟΧΡΕΩΤΙΚΟ ΠΡΙΝ ΚΩΔΙΚΑ.** ΜΗΝ γράψεις πριν εγκριθεί το plan.

> ⚠️ **Shared working tree** με άλλον agent. **git add ΜΟΝΟ τα δικά σου, ΠΟΤΕ -A.** **commit = Giorgio (ΟΧΙ εσύ). tsc = Giorgio** (N.17, ένα tsc τη φορά). **jest = τρέξε από repo root** (αλλιώς config glob error).
> **Full Enterprise + Full SSOT + Revit/Robot-grade (GOL).** ≤40γρ/func, ≤500γρ/file, μηδέν `any`/`as any`/`@ts-ignore`, μηδέν hardcoded strings (i18n el+en), μηδέν inline styles/div-soup, Select = `@/components/ui/select` (ADR-001).

---

## 0. ΤΟ ΣΕΝΑΡΙΟ (τι παρατήρησε ο Giorgio)

Κάτοψη: **2 κολώνες + 1 δοκάρι ανάμεσά τους**. Κάθε κολώνα έχει **πέδιλο** στη θεμελίωση. Όταν μετακινείται η κολώνα, **μετακινείται μαζί και το πέδιλο** (associative grid hosting, ADR-441 — αυτό φαίνεται σωστό).

Ο Giorgio **μετακίνησε/αποκόλλησε** τη μία κολώνα → το δοκάρι πλέον **«κρέμεται» μόνο στη μία κολώνα** (η άλλη άκρη ελεύθερη). Εμφανίστηκαν toasts:
- «Αυτόματος σχεδιασμός θεμελίωσης — νέα πέδιλα: 2 (combined: 0, ενημερώθηκαν: 0, αφαιρέθηκαν: 0)»
- «3 μέλη έλαβαν αυτόματο φορτίο»
- «Κανένα μέλος δεν χρειαζόταν οπλισμό» (×2)

## 1. ΟΙ ΕΡΩΤΗΣΕΙΣ ΠΟΥ ΠΡΕΠΕΙ ΝΑ ΑΠΑΝΤΗΘΟΥΝ (yes/no + fix αν χρειάζεται)

1. **Συμπεριφορά κολώνα+πέδιλο μαζί** στη μετακίνηση — σωστή; (μάλλον ναι, ADR-441 — επιβεβαίωσε).
2. **Όταν το δοκάρι στηρίζεται πλέον σε ΜΙΑ κολώνα** (πρόβολος ή αποκολλημένο): άλλαξαν **ροπές / τέμνουσες / στρέψεις / οπλισμός** του δοκαριού ώστε να αντικατοπτρίζουν τη ΝΕΑ τοπολογία; (πρόβολος → M=wL²/2 στην πάκτωση, εντελώς διαφορετικό από αμφιέρειστο wL²/8). **Ναι ή όχι;**
3. **«Στέκεται» στατικά** ένα δοκάρι σε μία μόνο στήριξη; (πρόβολος ΝΑΙ αν η σύνδεση είναι πάκτωση· αν είναι άρθρωση → **μηχανισμός/αστάθεια** → πρέπει να φλαγάρεται). Το μοντέλο το αναγνωρίζει σωστά;
4. **Άλλαξε ο οπλισμός της ΚΟΛΩΝΑΣ** που αποκολλήθηκε; (έχασε το φορτίο/load-path του δοκαριού → αλλάζει N_Ed → αλλάζει οπλισμός). **Ναι ή όχι;**
5. **Τα toasts είναι σωστά;** Ειδικά το «Κανένα μέλος δεν χρειαζόταν οπλισμό» — είναι ύποπτο αν η τοπολογία άλλαξε ουσιωδώς. Εμφανίζονται τη σωστή στιγμή (μόλις αποκολλάται η κολώνα);

## 2. 🔬 ΠΡΟΚΑΤΑΡΚΤΙΚΗ ΥΠΟΘΕΣΗ (από γρήγορο grep — ΕΠΑΛΗΘΕΥΣΕ, μην την εμπιστευτείς τυφλά)

**Κύριος ύποπτος:** ο **τύπος στήριξης του δοκαριού είναι ΑΠΟΘΗΚΕΥΜΕΝΟΣ, όχι παραγόμενος από τη ζωντανή συνδεσιμότητα.**
- `bim/structural/section-context.ts` → `buildBeamSectionContext` χρησιμοποιεί `p.supportType ?? 'simple'`. Άρα ο tributary-based οπλισμός (ADR-472) υπολογίζεται για **'simple' (αμφιέρειστο)** ακόμη κι όταν η τοπολογία έγινε **πρόβολος/μονή στήριξη** → **πιθανώς stale ροπές/οπλισμός**.
- **Δύο παράλληλα μονοπάτια** (γνωστή ένταση, βλ. MEMORY): (α) **tributary** (ADR-467/472) → οπλισμός από `supportType`+`appliedLoad`· (β) **FEM solver** (ADR-481) → M/V/N από το **analytical model** (ADR-480) που ΕΙΝΑΙ topology-derived. Πιθανό: το FEM διάγραμμα να ενημερώνεται σωστά, ενώ ο **οπλισμός (tributary) ΟΧΙ**. **Revit/Robot: ΕΝΑ topology-aware truth.**
- Η αστάθεια (μονή άρθρωση = μηχανισμός) ανιχνεύεται ήδη από `analytical-diagnostics` (`modelUnstable`/`memberUnsupported`, ADR-480) + singular-K (ADR-481) → αλλά **τροφοδοτεί τον οπλισμό/τα toasts;**

**Στόχος (Revit/Robot way):** μετακίνηση κολώνας → ο organism **ξανα-παράγει connectivity** → ο τύπος στήριξης/άνοιγμα του δοκαριού **παράγεται από τη ζωντανή τοπολογία** (όχι stored) → ροπές/τέμνουσες/στρέψεις + οπλισμός δοκαριού **ΚΑΙ** κολώνας επανυπολογίζονται → πέδιλα + toasts συνεπή → αστάθεια φλαγάρεται. **Μηδέν stale δεδομένα, ΕΝΑ source of truth.**

## 3. 🔴 SSOT AUDIT (GREP) — ΤΡΕΞΕ ΟΛΑ ΠΡΙΝ ΓΡΑΨΕΙΣ. Παραδοτέο: πίνακας reuse vs new + απάντηση στις 5 ερωτήσεις §1.

### 3.1 Συνδεσιμότητα / organism graph (η «τοπολογία»)
```
src/subapps/dxf-viewer/bim/structural/organism/structural-graph.ts        ← πώς χτίζεται ο graph (ποιο στηρίζει ποιο)· edges beam↔column
src/subapps/dxf-viewer/bim/structural/organism/organism-checks.ts         ← geometry connectivity checks (αποκόλληση;)
src/subapps/dxf-viewer/bim/structural/organism/structural-organism-types.ts
src/subapps/dxf-viewer/hooks/useStructuralOrganism.ts                     ← single-writer pass (πότε ξανατρέχει)
grep -rn "supportType\|cantilever\|simple\|fixed" src/subapps/dxf-viewer/bim/structural  ← πού ΟΡΙΖΕΤΑΙ/ΔΙΑΒΑΖΕΤΑΙ ο τύπος στήριξης
grep -rn "isLoadPathMember\|coveredIntervals\|wall-beam-support\|beam.*support" src/subapps/dxf-viewer/bim/structural/loads
```

### 3.2 Τύπος στήριξης δοκαριού — stored vs derived (Ο ΠΥΡΗΝΑΣ)
```
src/subapps/dxf-viewer/bim/structural/section-context.ts                  ← buildBeamSectionContext: p.supportType ?? 'simple' (ΑΠΟΘΗΚΕΥΜΕΝΟ)
src/subapps/dxf-viewer/bim/types/beam-types.ts                           ← BeamParams.supportType (πού/πώς τίθεται)
grep -rn "supportType" src/subapps/dxf-viewer  ← ΟΛΑ τα σημεία (set/read)· υπάρχει derive-from-connectivity πουθενά;
src/subapps/dxf-viewer/bim/structural/codes/suggest-reinforcement.ts      ← spanMomentDivisor(supportType): simple 8 / fixed 12 / cantilever 2
```

### 3.3 Load-path / tributary (φορτίο → μέλη)
```
src/subapps/dxf-viewer/bim/structural/loads/load-path-walk.ts + load-path-takedown.ts  ← ADR-467· πώς ρέει το φορτίο σε αλλαγή τοπολογίας
src/subapps/dxf-viewer/hooks/structural-load-takedown-core.ts + useProactiveStructuralLoads.ts  ← «X μέλη έλαβαν αυτόματο φορτίο» toast origin
src/subapps/dxf-viewer/bim/structural/loads/member-load-geometry.ts       ← beamEndpointsM / columnCenterM
```

### 3.4 Analytical model + FEM (topology-aware truth — ΗΔΗ ορατό μέσω ADR-483 διαγραμμάτων!)
```
src/subapps/dxf-viewer/bim/structural/analytical/analytical-model-builder.ts  ← κόμβοι/μέλη/στηρίξεις από graph· memberUnsupported
src/subapps/dxf-viewer/bim/structural/analytical/analytical-diagnostics.ts     ← modelUnstable / memberUnsupported
src/subapps/dxf-viewer/bim/structural/analytical/solver/frame-solver.ts        ← singular-K (μηχανισμός)
src/subapps/dxf-viewer/hooks/useProactiveStructuralAnalysis.ts                 ← πότε ξανατρέχει η ανάλυση
```
🔑 **ΧΡΥΣΟ εργαλείο επαλήθευσης:** το **ADR-483 διάγραμμα M/V/N** (μόλις φτιάχτηκε) δείχνει τη FEM αλήθεια στον καμβά. Σύγκρινε: μετά τη μετακίνηση, το διάγραμμα δείχνει πρόβολο/αστάθεια; Ο tributary οπλισμός συμφωνεί;

### 3.5 Οπλισμός (re-suggest σε αλλαγή) — δοκάρι ΚΑΙ κολώνα
```
src/subapps/dxf-viewer/hooks/structural-auto-reinforce-core.ts + useProactiveOrganismReinforce.ts + useStructuralAutoReinforce.ts  ← «κανένα μέλος δεν χρειαζόταν οπλισμό» toast origin
src/subapps/dxf-viewer/bim/structural/section-context.ts                  ← resolveActive{Beam,Column}Reinforcement (auto→re-derive από τρέχουσα γεωμετρία)
src/subapps/dxf-viewer/bim/structural/organism/reinforcement-checks.ts    ← ratioOutOfRange / memberMissingReinforcement
```

### 3.6 Foundation auto-design + toasts (αποκόλληση)
```
src/subapps/dxf-viewer/hooks/useStructuralFootingConnect.ts + useFoundationPersistence.ts  ← «Αυτόματος σχεδιασμός θεμελίωσης — νέα πέδιλα: X» toast
src/subapps/dxf-viewer/hooks/notifications/structural-attach-notifications.ts  ← attach/detach toasts (ADR-401)· πρόσθεσε εδώ αν λείπει detach-recompute toast
src/i18n/locales/{el,en}/dxf-viewer-shell.json  ← κλειδιά toasts (structural.* / attachToStructural.*)
```

### 3.7 Move trigger (τι ξεκινά τον επανυπολογισμό)
```
src/subapps/dxf-viewer/hooks/grips/grip-commit-adapters.ts               ← grip-drag commit κολώνας
src/subapps/dxf-viewer/systems/events/emit-bim-entity-params-updated.ts  ← emitBimEntityParamsUpdated (ADR-459 v8.4· structural event σε edit)
grep -rn "MoveEntityCommand\|emitStructuralChangeAfterEdit" src/subapps/dxf-viewer  ← το move αυτο-εκπέμπει structural event;
```

### 3.8 ADR-040 (αν αγγίξεις canvas/overlay)
```
docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md  ← stage αν αγγίξεις micro-leaf αρχεία (CHECK 6B/6D)
```

## 4. ΣΧΕΤΙΚΑ ADR (διάβασε όσα αγγίζεις· code = source of truth)
ADR-459 (organism connectivity) · ADR-467 (load-path) · ADR-480 (analytical model) · ADR-481 (FEM solver) · ADR-456/471/472 (reinforcement + supportType) · ADR-475 (auto member sizing) · ADR-463/464 (foundation auto-design) · ADR-441 (grid hosting — κολώνα+πέδιλο) · ADR-401 (attach/detach + toasts) · **ADR-483/485 (μόλις φτιάχτηκαν — διαγράμματα M/V/N + utilization· εργαλεία επαλήθευσης).**

## 5. ΚΑΤΑΣΤΑΣΗ TREE (UNCOMMITTED — μην τα πειράξεις, είναι του προηγούμενου session)
- **ADR-483 Slice 4+4b+** (διαγράμματα M/V/N στον καμβά) + **ADR-485** (utilization overlay) = DONE, browser-verified, **UNCOMMITTED** (ο Giorgio θα κάνει commit). 14+6 jest GREEN. Αρχεία: `bim/structural/analytical/diagrams/*`, `bim/structural/utilization/*`, `components/dxf-layout/Structural{Diagram,Utilization}Overlay.tsx`, ribbon controls, i18n, ADR-483/485, adr-index.
- ⚠️ Άλλος agent στο shared tree κρατά **ADR-484** (Cross-level Foundation Properties) + ίσως raft/slab. **Επόμενο ελεύθερο ADR = 486** (αν χρειαστεί νέο).
- Γνωστά **pre-existing jest failures** (όχι δικά σου): 2 raft/slab (`maxFreeSpanM` undefined fixture, shared-tree ADR-476).

## 6. ΚΑΝΟΝΕΣ (ΑΠΑΡΑΒΑΤΟΙ — CLAUDE.md)
- **PLAN-FIRST:** SSoT audit (grep §3) → πίνακας reuse vs new + απαντήσεις §1 → plan → **περίμενε «προχώρα»** → code.
- **ADR-driven (N.0.1):** PHASE 1 read CURRENT code (code wins) → update ADR αν αποκλίνει → implement → PHASE 3 update ADR + adr-index + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + MEMORY (ίδιο commit).
- **N.8:** πιθανώς cross-cutting (organism+loads+reinforcement+foundation+toasts) → αν 5+ αρχεία/2+ domains, **ενημέρωσε Giorgio** πριν orchestrator.
- **Full SSoT:** ΜΗΝ δημιουργήσεις νέο engine/derive αν υπάρχει· επέκτεινε. Ο τύπος στήριξης πρέπει να έχει **ΕΝΑ** SSoT (derived-from-connectivity), όχι scattered.
- **commit/tsc = Giorgio.** jest = τρέξε από root. **Shared tree: git add ΜΟΝΟ δικά σου.** **Απάντα Ελληνικά.**

## 7. ΑΡΧΗ ΣΧΕΔΙΑΣΗΣ (Revit/Robot way)
Στη Revit/Robot ο φορέας είναι **ένα ζωντανό μοντέλο**: αλλαγή γεωμετρίας → ο αναλυτικός φορέας ξανα-παράγεται → στηρίξεις/άνοιγμα/εντατικά/οπλισμός **ακολουθούν αυτόματα** την τοπολογία· αστάθεια **φλαγάρεται** (δεν «σιωπά»). Καθαρός διαχωρισμός: **physical edit → derived analytical truth → derived design (οπλισμός/πέδιλα) → user feedback (toasts)**. Μηδέν stored-stale, μηδέν παράλληλη αλήθεια που αποκλίνει (tributary↔FEM να συγκλίνουν ή να οριστεί ξεκάθαρα ποιο κυριαρχεί).

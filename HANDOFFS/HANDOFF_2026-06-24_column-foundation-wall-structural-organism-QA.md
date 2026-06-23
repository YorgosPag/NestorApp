# HANDOFF — Δοκιμές «ενιαίου δομικού οργανισμού»: Κολώνα ↔ Πέδιλο ↔ Τοίχος (Eurocode + Αντισεισμικός)

**Ημ/νία:** 2026-06-24
**Τύπος:** Live QA/verification session με τον Giorgio (όχι «build from scratch» — το structural subsystem ΥΠΑΡΧΕΙ ήδη).
**Στόχος:** Revit-grade, **FULL ENTERPRISE + FULL SSoT, μηδέν διπλότυπα.** Απαντάς στον Giorgio **στα Ελληνικά.**
**⚠️ Shared working tree** — δουλεύει κι άλλος agent. **ΠΟΤΕ `git add -A`. COMMIT/PUSH κάνει ΜΟΝΟ ο Giorgio** (N.(-1)).
**⚠️ N.17:** ΕΝΑ tsc τη φορά (full tsc → OOM exit 134· δεν είναι σφάλμα κώδικα). Verify με jest.
**⚠️ N.14:** Πριν από non-trivial υλοποίηση → δήλωσε μοντέλο & περίμενε «ok».

---

## 0. BASELINE ΒΑΣΗΣ (καταγράφηκε 2026-06-24, ΠΡΙΝ τις δοκιμές)

Καθαρή βάση — μηδέν δομικά μέλη. Κάθε νέο doc που εμφανίζεται = αποτέλεσμα της τρέχουσας δοκιμής.

| Collection (top-level) | count @ baseline |
|---|---|
| `floorplan_columns` | **0** |
| `floorplan_walls` | **0** |
| `floorplan_foundations` | **0** |

**Πώς ελέγχεις σε κάθε βήμα (Firestore MCP — read-only):**
```
mcp__firestore__firestore_count   { collection: "floorplan_columns" }
mcp__firestore__firestore_query   { collection: "floorplan_foundations", limit: 20 }
```
Οι collections είναι **top-level** (όχι nested per-project) → query χωρίς scope filter επιστρέφει όλα. Διάβασε `params` (διαστάσεις), `geometry`, `validation`, και τα reinforcement πεδία του κάθε doc.

---

## 1. ΤΙ ΘΕΛΕΙ Ο GIORGIO (ροή δοκιμών — διαταγή)

Ο Giorgio θα δημιουργεί μέλη ένα-ένα. Σε ΚΑΘΕ βήμα κάνεις τους **ΙΔΙΟΥΣ ελέγχους**:

1. **Δημιουργεί κολώνα #1** → ελέγχεις:
   - Το **πέδιλο** της δημιουργείται αυτόματα; **Διαστασιολογείται** σωστά (bearing/flexure/punching/shear κατά Eurocode);
   - **Οπλίζεται** σωστά (footing reinforcement + column reinforcement);
   - Κολώνα + πέδιλο = **ΕΝΑΣ ενιαίος οργανισμός** (συνέχεια όπλισης βάσης, load takedown, αντισεισμικός);
   - **Κατασκευάσιμο στην πραγματικότητα** — στέκεται σε φορτία/άνεμο/σεισμό.
2. **Δημιουργεί κολώνα #2 + το πέδιλό της** → ίδιοι έλεγχοι.
3. **Συνένωση κολωνών → τοιχίο (wall)** → ίδιοι έλεγχοι στο νέο τοιχίο + το πέδιλό του (strip/συνεχές).
4. **Δημιουργεί τοίχους** → ίδιοι έλεγχοι.
5. **Όταν πολλές οντότητες συνδέονται** → ΟΛΕΣ μαζί πρέπει να συμπεριφέρονται σαν **ένας οργανισμός** που:
   - οπλίζεται σωστά,
   - διαστασιολογείται **σε πραγματικό χρόνο** (live),
   - τηρεί **αντισεισμικό + Ευρωκώδικες**,
   - ώστε ο μηχανικός να μπορεί **ανά πάσα στιγμή** να δώσει σχέδια στους πελάτες και η κατασκευή **να στέκεται σωστά** (φορτία, πιέσεις, άνεμος, σεισμός).

**Ο ρόλος σου:** σε κάθε δημιουργία, query στη βάση + ανάγνωση του doc + επαλήθευση των structural αποτελεσμάτων· αναφορά ✅/⚠️/❌ με συγκεκριμένα νούμερα (διαστάσεις, οπλισμός, utilization ratios) και αν παραβιάζεται κανονισμός → ποιος και γιατί.

---

## 2. ⛔ SSoT AUDIT — ΤΑ ΥΠΑΡΧΟΝΤΑ ΣΥΣΤΗΜΑΤΑ (grep ΠΡΙΝ γράψεις ΟΤΙΔΗΠΟΤΕ· reuse, ΟΧΙ διπλότυπο)

Το structural subsystem ζει στο `src/subapps/dxf-viewer/bim/structural/` + `bim/foundations/` + reactive hooks. **ΜΗΝ ξαναγράψεις τίποτα από αυτά — επαλήθευσε & ενοποίησε:**

### Διαστασιολόγηση (auto-sizing)
- `bim/structural/sizing/column-sizing.ts`, `column-size-patch.ts` — κολώνα
- `bim/structural/sizing/pad-size-patch.ts` + `bim/structural/footing-design/suggest-pad-dimensions.ts` — πέδιλο
- `bim/structural/footing-design/` — **footing design SSoT**: `footing-bearing.ts`, `footing-flexure.ts`, `footing-punching.ts`, `footing-shear.ts`, `footing-design.ts`, `footing-design-checks.ts`, `footing-support-column.ts`, `footing-load-takedown.ts`, `raft-bearing.ts`

### Όπλιση (reinforcement)
- `bim/structural/reinforcement/column-reinforcement-compute.ts` (+ bar-distribution, confinement, cross-ties, hoop/perimeter layouts) — κολώνα
- `bim/structural/reinforcement/footing-reinforcement-compute.ts` (+ `footing-rebar-plan-geometry.ts`) — πέδιλο
- `bim/structural/reinforcement/column-wall-reinforcement.ts` — κολώνα→τοιχίο (συνένωση!)
- `bim/structural/reinforcement/slab-foundation-reinforcement-compute.ts` — πεδιλοδοκός/συνεχές
- `bim/structural/rebar-catalog.ts`, `concrete-grades.ts` — υλικά SSoT

### Κανονισμοί (codes)
- `bim/structural/codes/eurocode-provider.ts` + `greek-legacy-provider.ts` + `index.ts` (provider pattern)
- `bim/structural/codes/suggest-footing-reinforcement.ts`, `suggest-reinforcement.ts`, `flexural-capacity.ts`, `torsion-capacity.ts`, `clear-height-under-beam.ts`
- `bim/structural/structural-settings.ts` — επιλεγμένος κώδικας/grade SSoT

### Φορτία + Σεισμός (loads)
- `bim/structural/loads/seismic-params.ts` — **αντισεισμικός SSoT**
- `bim/structural/loads/load-takedown.ts`, `load-path-takedown.ts`, `load-path-walk.ts`, `load-combinations.ts`, `occupancy-loads.ts`
- `bim/structural/analytical/` — analytical model (FEM axial/moment, solver, diagrams, node-merge)

### «Ενιαίος οργανισμός» (organism)
- `bim/structural/organism/structural-graph.ts` — **ο γράφος σύνδεσης μελών (η ραχοκοκαλιά του «οργανισμού»)**
- `bim/structural/organism/reinforcement-continuity.ts`, `reinforcement-checks.ts`, `organism-checks.ts`, `feasibility-checks.ts`, `practical-span-checks.ts`
- `bim/structural/organism/column-base-continuity-store.ts`, `derive-column-base-continuity.ts` — κολώνα↔βάση συνέχεια
- `bim/structural/organism/cross-level-organism-scene.ts`, `structural-diagnostics-store.ts`, `useEntityStructuralDiagnostics.ts`

### Coupling κολώνα → πέδιλο (auto-foundation)
- `bim/foundations/auto-foundation-layout.ts`, `auto-foundation-reconcile.ts`, `foundation-footing-candidates.ts`
- `core/commands/entity-commands/ApplyFoundationLayoutCommand.ts` — το command που «γεννά» το πέδιλο (undoable, ADR-390 Φ5)

### Reactive hooks (τρέχουν live σε κάθε edit — εδώ «ζει» το real-time)
- `hooks/auto-foundation-design-core.ts` — auto-σχεδιασμός πεδίλου
- `hooks/structural-auto-study-core.ts` — auto structural study
- `hooks/structural-load-takedown-core.ts` — load takedown
- `hooks/structural-geometry-edit-triggers.ts` — triggers σε geometry edit
- `hooks/useGroupedStructuralReaction.ts` — **grouped reaction (ADR-459)**: ομαδοποιεί create + structural reactions σε ΕΝΑ undo step
- `hooks/useFoundationLevelSync.ts`, `hooks/proactive-coalescer.ts`

> **ΜΑΘΗΜΑ (memory):** ο Giorgio κάνει σκληρό SSoT audit. Grep ΟΛΟ το παραπάνω ΠΡΙΝ φτιάξεις νέο helper/store/subscription. Αν εντοπίσεις διπλότυπο → κεντρικοποίησέ το (Boy Scout, N.0.2). 100% ειλικρίνεια.

---

## 3. ΣΧΕΤΙΚΑ ADRs (διάβασέ τα ΠΡΙΝ αγγίξεις structural κώδικα)

Βρες τα από `docs/centralized-systems/reference/adrs/` + `adr-index.md`. Πιθανά κρίσιμα: ADR-390 (symmetric create/delete + `ApplyFoundationLayoutCommand`), ADR-459 (grouped structural reaction), ADR-398 (column tool/ghost), ADR-404 (slanted), τυχόν footing/eurocode/seismic ADRs. **Code = source of truth· αν το ADR διαφωνεί με τον κώδικα → ενημέρωσε το ADR (N.0.1).**

---

## 4. ΚΑΝΟΝΕΣ ΣΥΝΕΔΡΙΑΣ

- **Full Enterprise + Full SSoT, μηδέν διπλότυπα, Revit-grade.** SSoT audit (grep) **ΠΡΩΤΑ**.
- **ΟΧΙ commit / ΟΧΙ push / ΟΧΙ `git add -A`** — ο Giorgio committαρει (shared tree).
- **Eurocode + αντισεισμικός** σε κάθε έλεγχο· χρησιμοποίησε τους υπάρχοντες providers/seismic-params (μη hardcode-άρεις συντελεστές — N.11).
- **N.14:** δήλωσε μοντέλο πριν από non-trivial fix & περίμενε «ok».
- **N.17:** ΕΝΑ tsc τη φορά (OOM-aware)· verify με jest.
- Σε κάθε αναφορά: συγκεκριμένα νούμερα (B×L×H πεδίλου, οπλισμός Ø/απόσταση, utilization), ✅/⚠️/❌ + ποιος κανονισμός.
- Αν χρειαστεί fix κώδικα → ADR-driven (N.0.1, 4 φάσεις) + changelog + memory.

---

## 5. ΣΥΝΟΨΗ ΓΙΑ ΓΡΗΓΟΡΟ ΞΕΚΙΝΗΜΑ

«Baseline: βάση καθαρή (columns/walls/foundations = 0, 2026-06-24). Ο Giorgio δημιουργεί κολώνες/τοίχους ένα-ένα· σε κάθε δημιουργία ελέγχω μέσω Firestore MCP + ανάγνωση κώδικα ότι το πέδιλο διαστασιολογείται+οπλίζεται σωστά (Eurocode+σεισμός) και ότι κολώνα+πέδιλο(+τοίχος μετά συνένωση) συμπεριφέρονται σαν ΕΝΑΣ ενιαίος, κατασκευάσιμος οργανισμός που διαστασιολογείται live. Το structural subsystem ΥΠΑΡΧΕΙ (bim/structural/ + bim/foundations/ + reactive hooks) — reuse, μηδέν διπλότυπα. SSoT audit (grep) πριν από κάθε γραμμή κώδικα. ΟΧΙ commit (ο Giorgio). Shared tree. Ελληνικά.»
```
```

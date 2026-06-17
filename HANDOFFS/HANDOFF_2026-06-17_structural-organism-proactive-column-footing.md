# HANDOFF — Στατικός Οργανισμός: proactive «κολώνα → πέδιλο → ενιαίος οργανισμός»

**Ημ/νία:** 2026-06-17 · **Από:** Opus session · **Γλώσσα:** Πάντα Ελληνικά στις απαντήσεις.

---

## 0. ΤΟ ΟΡΑΜΑ ΤΟΥ GIORGIO (το ζητούμενο)

Ο μηχανικός όρισε ορόφους/υψόμετρα/θεμελίωση/απόληξη και αρχίζει να σχεδιάζει στον καμβά. Ροή «Revit-grade
structural organism» που θέλει:

1. **Σχεδιάζει κολώνα** → το σύστημα **proactively** τον ειδοποιεί: «μια κολόνα δεν στέκεται μόνη της —
   πρόσθεσε από κάτω πέδιλο ή συνδετήριο δοκάρι». (Δεν ξέρει αν θα βάλει 1 ή 15 κολώνες.)
2. **Βάζει πέδιλο** → το σύστημα υπολογίζει **κολώνα+πέδιλο ως ΕΝΙΑΙΟ οργανισμό**: δημιουργεί τις
   **συνδέσεις οπλισμού** (αναμονές/προεκτάσεις κολώνας→πέδιλο, αγκυρώσεις `lbd`, μήκη μάτισης/lap) ώστε
   τα 2 στοιχεία να «δένουν» στατικά όπως σε πραγματική κατασκευή.
3. **Βάζει 2η κολώνα** → ειδοποίηση: «αυτή η κολώνα δεν έχει πέδιλο — θέλεις να **επεκτείνω το πέδιλο**
   προς τη 2η κολώνα ώστε να γίνει ενιαίος οργανισμός (2 κολώνες + 1 πέδιλο);»
4. Γενικά: **κάθε** δομικό BIM στοιχείο που σχεδιάζεται → αυτόματη διαστασιολόγηση/στατικός έλεγχος, όλα
   ως ένας ενιαίος οργανισμός.

**Η απάντηση στη λογική: ΝΑΙ — είναι σωστή, Revit-grade.** ΑΛΛΑ προσοχή (επόμενη §):

---

## 1. ⚠️ ΚΡΙΣΙΜΟ — ΤΟ ~80% ΥΠΑΡΧΕΙ ΗΔΗ (ADR-459). SSOT AUDIT ΠΡΩΤΑ, ΜΗΔΕΝ ΔΙΠΛΟΤΥΠΑ.

**ΠΡΙΝ γράψεις ΟΤΙΔΗΠΟΤΕ, διάβασε `docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md`
ΚΑΙ GREP/διάβασε ΟΛΑ τα παρακάτω.** Η υποδομή «στατικός οργανισμός» υπάρχει — το ζητούμενο είναι κυρίως
**proactive wiring on-create**, όχι νέος μηχανισμός.

### Τι ΥΠΑΡΧΕΙ ήδη (reuse, ΜΗΝ ξαναφτιάξεις):
| Υπάρχον | Path | Τι κάνει |
|---|---|---|
| Graph + FK σύνδεση κολώνα↔πέδιλο | `bim/structural/organism/structural-graph.ts` | DERIVED graph· edges `footing-bearing`/`column-bearing`/`top-attachment` |
| Τύποι οργανισμού | `bim/structural/organism/structural-organism-types.ts` | nodes/edges/diagnostics |
| **Reinforcement continuity** (αναμονές/αγκυρώσεις/lap) | `bim/structural/organism/reinforcement-continuity.ts` | αμφίδρομα dowels/anchorage `lbd`/lap κολώνα↔πέδιλο (ADR-459 Φ4a-4d) |
| Checks (λείπει πέδιλο, ρ εκτός ορίων, bar mismatch) | `bim/structural/organism/reinforcement-checks.ts` + `organism-checks.ts` | diagnostics |
| Diagnostics store + hook | `bim/structural/organism/structural-diagnostics-store.ts` + `useEntityStructuralDiagnostics.ts` | per-entity warnings |
| Orchestrator hook | `hooks/useStructuralOrganism.ts` | re-derive graph σε αλλαγές |
| **Auto-attach** | `hooks/useStructuralAutoAttach.ts` | αυτόματη σύνδεση στοιχείων |
| **Footing connect/detach** | `hooks/useStructuralFootingConnect.ts` | «Σύνδεση/Αποσύνδεση πεδίλου» (ADR-459 Φ4f) |
| **Attach notifications** | `hooks/notifications/structural-attach-notifications.ts` | toasts σύνδεσης |
| Warnings UI panel | `EntityWarningsSection` (στο column/foundation advanced panel) | δείχνει «λείπει πέδιλο» κ.λπ. (passive, on-select) |
| Auto-reinforce organism command | `core/commands/.../AutoReinforceOrganismCommand` + ribbon «Αυτόματος Οπλισμός» | code-suggested οπλισμός |
| Foundation tributary takedown / load path | ADR-464 + ADR-467 (`bim/structural/loads/`, `footing-design/`) | φορτία + bearing/flexure/punching |
| Soft warning «foundation σε λάθος όροφο» | `systems/levels/storey-creation-defaults.ts` (`shouldWarnFoundationOnStorey`) + event `bim:foundation-on-upper-storey` → `grid-build-notifications.ts` toast | πρότυπο proactive notification |
| Soft warning «δοκάρι σε θεμελίωση→πεδιλοδοκός» | `shouldWarnBeamOnFoundation` + `bim:beam-on-foundation-storey` | πρότυπο |

### Τι πιθανόν ΛΕΙΠΕΙ (το πραγματικό delta — επιβεβαίωσέ το με GREP/browser):
1. **Proactive notification ΜΟΛΙΣ σχεδιαστεί κολώνα** «βάλε πέδιλο» — σήμερα το warning είναι **passive**
   (φαίνεται στο `EntityWarningsSection` όταν επιλέγεις την κολώνα). Το ζητούμενο = **toast on-create**
   (mirror ακριβές του `bim:foundation-on-upper-storey` pattern: νέο event π.χ. `bim:column-without-footing`
   εκπεμπόμενο στο column creation handler → toast). Δες πού δημιουργείται η κολώνα: `useColumnTool` /
   `CreateColumnsCommand` / `use-column-perimeter-commit` / `useColumnPersistence` + `useColumnAdjacencyNotification.tsx`
   (υπάρχον adjacency notification — πιθανό σημείο σύνδεσης).
2. **Auto-organism υπολογισμός ΜΟΛΙΣ προστεθεί πέδιλο** (auto-connect + continuity χωρίς manual κουμπί) —
   έλεγξε αν το `useStructuralAutoAttach` το κάνει ήδη on-create ή θέλει trigger.
3. **Prompt «επέκταση πεδίλου προς νέα κολώνα»** — έλεγξε αν το `useStructuralFootingConnect` καλύπτει
   extend-to-new-column ή μόνο connect υπάρχοντος.

**ΣΥΜΠΕΡΑΣΜΑ:** Πιθανότατα το task = **wiring proactive notifications + auto-trigger on-create** πάνω στον
ΥΠΑΡΧΟΝΤΑ organism μηχανισμό, ΟΧΙ νέος οργανισμός. Κάνε το audit, δες τι πραγματικά λείπει, **πρότεινε plan
(Plan Mode) πριν υλοποιήσεις**.

---

## 2. TEST SCENE BASELINE (Firestore, 2026-06-17)

Project `proj_12788b6a-ea19-41cd-90a0-a340e6bacaab` · floor `flr_215e39f3-d958-4f97-ac59-6639131767d1`
(Ισόγειο) · level `lvl_21982f3b…` · κάναβος **5×5m** · 4 κολώνες `floorplan_columns` (400×400×3000mm):

| ID | anchor | θέση mm | appliedLoad | geometry | reinforcement |
|---|---|---|---|---|---|
| col_0b03c023 | sw | 9440,6250 | ❌ καμία | ❌ | ❌ |
| col_5ade3b50 | se | 14440,6250 | ✅ G596.4/Q150 | ✅ | ❌ |
| col_6f453cad | nw | 9440,11250 | ❌ καμία | ❌ | ❌ |
| col_d1deea0a | ne | 14440,11250 | ✅ G596.4/Q150 | ✅ | ✅ auto 8Ø16 |

⚠️ 2/4 κολώνες χωρίς appliedLoad/geometry (πιο πρόσφατες — δεν έχουν περάσει takedown/persist cycle).
**ΔΕΝ υπάρχουν πέδιλα** στο Ισόγειο (τα πέδιλα ανήκουν στη Θεμελίωση — `floorplan_foundations`). Firestore
MCP: `floorplan_columns` / `floorplan_foundations` (filter `floorId`)· guides `floorplan_grid_guides`.

---

## 3. ΚΑΝΟΝΕΣ (ΑΠΑΡΑΒΑΤΟΙ)
- **COMMIT/PUSH = Giorgio**, ΟΧΙ εσύ (N.(-1)). Shared working tree → `git add` **ΜΟΝΟ τα δικά σου** αρχεία.
- **GREP/SSoT audit ΠΡΩΤΑ** (Giorgio ρητό): βρες υπάρχοντα → reuse· μηδέν διπλότυπα.
- **Full Enterprise + Full SSoT + Revit-grade.** GOL: 40-line functions / 500-line files / zero race.
- **N.17 tsc:** ο PowerShell process-check είναι **denied** για τον agent → **tsc το τρέχει ο Giorgio**.
  jest τρέχει κανονικά μέσω Bash (node).
- Μετά την υλοποίηση: ADR-459 changelog + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + adr-index + memory (N.15).
- **Plan Mode** πριν την υλοποίηση (5+ αρχεία, cross-cutting) — παρουσίασε plan, πάρε έγκριση.

## 4. ΠΡΩΤΟ ΒΗΜΑ ΝΕΑΣ SESSION
1. Διάβασε ADR-459 + GREP/διάβασε τα αρχεία της §1 (organism + notifications + column-create handlers).
2. Browser-verify: σχεδίασε κολώνα → τι notification εμφανίζεται σήμερα; βάλε πέδιλο → γίνεται auto-connect
   + continuity; (διαπίστωσε το πραγματικό delta).
3. Plan Mode → plan → έγκριση Giorgio → υλοποίηση → jest → (tsc=Giorgio) → docs → browser-verify.

---

## 5. ΠΡΟΗΓΟΥΜΕΝΗ ΔΟΥΛΕΙΑ ΑΥΤΗΣ ΤΗΣ SESSION (UNCOMMITTED — μην τα χαλάσεις)
- **ADR-467 Slice 7**: read-only group «Φορτίο Σχεδιασμού» (G/Q/N_Ed) στην καρτέλα κολώνας.
- **ADR-461 C4++**: διαβαθμισμένο foundation gating (`isFoundationDisciplineInContext`) — θεμελιακά tools
  dimmed σε υπέργειους ορόφους.
- **ADR-468**: καρτέλα «Όροφοι» σε modal μέσα στον viewer (⚙️ Επίπεδα Έργου + δεξί κλικ στη γραμμή
  σταθμών)· SSoT `useBuildingById` + `createToggleStore` + `resolveActiveBuildingId`.
Όλα UNCOMMITTED, περιμένουν browser-verify + commit από Giorgio.

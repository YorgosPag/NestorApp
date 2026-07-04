# HANDOFF — Body-drag γραμμής: ίδιες ενδείξεις μέτρησης + ίχνη ευθυγράμμισης με το middle-grip (SSoT)

**Ημερομηνία:** 2026-07-04
**Γλώσσα απαντήσεων:** Ελληνικά ΠΑΝΤΑ.
**Commit/Push:** ΜΟΝΟ ο Giorgio (N.-1). **Working tree ΜΟΙΡΑΖΕΤΑΙ με άλλον agent.**

---

## 🎯 ΤΙ ΘΕΛΕΙ Ο GIORGIO

**Σημερινή συμπεριφορά (μοντέλο-στόχος):** επιλέγεις γραμμή → πιάνεις τη **μεσαία λαβή (middle grip)**
→ κρατώντας πατημένο μετακινείς τη γραμμή· εμφανίζονται **δυναμικές ενδείξεις μέτρησης** (κείμενα +
γραμμές: γωνίες, μήκη, αποστάσεις) **και ίχνη ευθυγράμμισης (alignment tracking)**.

### TASK A — Parity: κλικ στο **σώμα** της γραμμής (όχι σε λαβή) + drag
Όταν κάνω κλικ **οπουδήποτε πάνω στο σώμα της γραμμής, κατά μήκος του άξονα (εκτός λαβών)** και
μετακινώ τη γραμμή, θέλω **ΤΙΣ ΙΔΙΕΣ** ενδείξεις μέτρησης + **ΤΑ ΙΔΙΑ** ίχνη ευθυγράμμισης.
**ΙΔΙΟΣ κώδικας — μία και μοναδική πηγή αλήθειας.** (ΟΧΙ αντιγραφή/parallel υλοποίηση.)

### TASK B — Fix: αντικατάσταση του label με τις κυανές γραμμές
Τώρα, κατά τη μετακίνηση μέσω middle-grip, ανάμεσα στο **σημείο της μεσαίας λαβής (παλιά θέση)** και
στο **κέντρο του κέρσορα** εμφανίζεται μια **δυναμική γραμμή + ένα label (πινακίδα)**. Ο Giorgio θέλει
το **label να αντικατασταθεί** με τις **κυανές γραμμές/ενδείξεις** που χρησιμοποιεί ευρέως η εφαρμογή
(alignment tracking traces). Ισχύει **ΚΑΙ** για μετακίνηση μέσω middle-grip **ΚΑΙ** μέσω body-drag.

**Reference μεγάλων παικτών (πρώτα έρευνα):**
- **AutoCAD** → Dynamic Input + Polar/Object-Snap **Tracking** (κυανές διακεκομμένες γραμμές + tooltip).
- **Revit** → temporary dimensions + alignment lines κατά το drag.
- **Figma** → smart guides (measurement badges + κόκκινες/μπλε alignment lines). **Maxon C4D** → snap guides.
- Ακολούθησε την πρακτική τους· FULL ENTERPRISE + FULL SSOT.

---

## 🚨 ΠΡΩΤΟ ΒΗΜΑ — ΥΠΟΧΡΕΩΤΙΚΟ SSoT AUDIT (grep + διάβασε τον κώδικα) ΠΡΙΝ ΓΡΑΨΕΙΣ

Το SSoT **υπάρχει ήδη** (memory: `reference_grip_alignment_tracking_ssot.md` → ΕΝΑ
`GripAlignmentTrackingStore` + `resolveActionAlignmentTracking` + `paintGripAlignmentTracking`,
κοινό dim & line· rotation = χωριστό `resolveRotationTracking`). **ΜΗΝ φτιάξεις νέο.** Μελέτησε
**πολύ καλά** τα εξής (ο Giorgio το τόνισε):

### (Α) Alignment/measurement tracking SSoT (το «τι» ζωγραφίζεται)
- `systems/cursor/grip-drag-alignment-tracking.ts` → `resolveActionAlignmentTracking` +
  `paintGripAlignmentTracking` (**οι κυανές γραμμές/ενδείξεις**).
- `systems/cursor/GripAlignmentTrackingStore.ts` (store SSoT) · `systems/cursor/GripDragStore.ts`.
- `hooks/dimensions/dim-alignment-tracking.ts` (η dim πλευρά που χρησιμοποιεί το ίδιο SSoT — δες πώς
  ενσωματώνεται, το ίδιο pattern θέλουμε στο body-drag).
- `systems/tracking/ambient-alignment-source.ts` (⚠️ modified στο working tree — δες γιατί/από ποιον).

### (Β) Middle-grip drag preview (το «πού» καλείται σήμερα — το μοντέλο-στόχος)
- `hooks/tools/useGripGhostPreview.ts` + `hooks/tools/grip-ghost-preview-draw-helpers.ts`
  ← εδώ ζωγραφίζεται ο ghost + **η δυναμική γραμμή + το LABEL** (TASK B: βρες το label εδώ).
- `systems/line/line-grips.ts` (ορισμός grips γραμμής, incl. middle grip).
- `hooks/grips/grip-mouse-handlers.ts`, `grip-projections.ts`, `grip-commit-adapters.ts`.

### (Γ) Body-drag move (το «πού» πρέπει να μπει η parity)
- `hooks/tools/useEntityBodyDragPreview.ts`  ← **ΤΟ ΚΛΕΙΔΙ** για TASK A: το body-drag preview hook.
- `hooks/tools/useMovePreview.ts`, `hooks/tools/useMoveTool.ts`, `systems/cursor/mouse-handler-up.ts`.
→ **Ερώτημα audit:** μπορεί το `useEntityBodyDragPreview` να καλέσει το ΙΔΙΟ
  `resolveActionAlignmentTracking`/`paintGripAlignmentTracking` (ίδιο input contract: from-point → cursor
  με ImmediateSnap); Αν το input διαφέρει, κάνε ένα thin adapter, ΟΧΙ νέο tracking σύστημα.

### (Δ) Gotchas (memory — διάβασέ τα)
- `reference_preview_ghost_must_read_immediate_snap` → το ghost διαβάζει **ImmediateSnap**, όχι raw cursor
  (σταθερό offset = cursor-source mismatch).
- `reference_transform_redraw_dirty_scheduler_ssot` → redraw μέσω `markSystemsDirty(TRANSFORM_CANVAS_IDS)`
  + `subscribeTransform`· ΟΧΙ νέα subscription.
- `reference_trace_full_pipeline_not_isolated_hooks` → ίχνευσε event→dispatch→tool→preview ολόκληρο.

---

## 📐 ADR-DRIVEN + Perf
- ADR: πιθανώς **ADR-362/563** (dim alignment tracking — πρόσφατα commits) + line/grip ADR· βρες στο
  `adr-index.md`. Κώδικας = source of truth· ενημέρωσε ADR **στο ίδιο commit**.
- ⚠️ **ADR-040**: αγγίζεις preview/paint σε 60fps drag → CHECK 6B/6D πιθανώς ενεργά (χρειάζεται staged ADR).
  Ο orchestrator (CanvasSection) ΜΗΝ αποκτήσει `useSyncExternalStore`· leaf-only subscribers.
- **Opus + Plan Mode** (N.8/N.14: tool+geometry+preview+render). Ρώτα με απλά ελληνικά + ASCII παραδείγματα.

## 🧪 Testing / Git
- Jest στοχευμένα (tracking resolver, projection math). **ΟΧΙ tsc** (N.17). Jest επιτρέπεται.
- **Shared tree:** ΜΟΝΟ `git add <specific>` + verify `git diff --cached`. **ΠΟΤΕ** bulk restore/reset/
  checkout άλλων αρχείων. Commit/push **μόνο ο Giorgio**.

---

## 📌 ΤΡΕΧΟΥΣΑ ΚΑΤΑΣΤΑΣΗ WORKING TREE (uncommitted — ΜΗΝ κάνεις revert)
- **ADR-510 Φ4b** (προηγ. συνεδρία): dxf-color picker + linetype thumbnails για «Στη Γραμμή»· νέο SSoT
  `systems/properties/resolve-entity-color.ts`· `EnterpriseColorDialog` prop `dimBackdrop` + μνήμη θέσης.
- ⚠️ **Άλλος agent**: ADR-570 «Στυλ Γραμμής» (ByStyle) στο `useRibbonLineToolBridge.ts` + `systems/line-styles/`.
  **Μην τα αγγίξεις.**
- Υπάρχει και άλλο pending handoff: `2026-07-04_extend-trim-to-corner.md` (ξεχωριστό feature).

## ✅ Checklist εκκίνησης
1. `.claude-rules/MEMORY.md` + `pending-ratchet-work.md` (STATUS).
2. **Μελέτησε (Α)-(Γ)** — grep + διάβασε ΤΟΝ ΚΩΔΙΚΑ του middle-grip drag· ανέφερε τι θα reuse.
3. Δήλωσε Opus + Plan Mode· ρώτα UX λεπτομέρειες με παραδείγματα.
4. Υλοποίηση (ΙΔΙΟ SSoT για grip & body) → tests → ADR update → **σταμάτα** (commit ο Giorgio).

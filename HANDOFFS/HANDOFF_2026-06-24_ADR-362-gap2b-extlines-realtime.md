# HANDOFF — ADR-362 Dimensions: (A) extension-line origins offset + (B) real-time follow during drag

**Ημερομηνία:** 2026-06-24
**Domain:** DXF Viewer — Dimensions (`src/subapps/dxf-viewer/`)
**Κύριο ADR:** `docs/centralized-systems/reference/adrs/ADR-362-enterprise-dimension-system.md`
**⚠️ Working tree:** μοιράζεται με ΑΛΛΟΝ agent → άγγιξε **ΜΟΝΟ** dimension-σχετικά αρχεία.
**⚠️ COMMIT:** τον κάνει ο **Giorgio**, ΟΧΙ ο agent. ΟΧΙ `--no-verify`. ΟΧΙ `git add -A`.

---

## 0. ΚΑΝΟΝΕΣ ΣΥΝΕΔΡΙΑΣ (Giorgio)

- **Revit-grade, FULL ENTERPRISE + FULL SSOT.** Όπως οι μεγάλοι παίκτες (Revit/AutoCAD).
- **ΠΡΙΝ κάθε κώδικα: ΠΡΑΓΜΑΤΙΚΟ SSoT audit (grep)** — ψάξε αν υπάρχει ήδη αντίστοιχος κώδικας/SSoT για να τον χρησιμοποιήσεις. **ΜΗΝ φτιάξεις διπλότυπα.** Αν βρεις προϋπάρχοντα διπλότυπα → κεντρικοποίησέ τα (ΔΙΑΤΑΓΗ).
- code = source of truth (N.0.1) — αν το ADR διαφωνεί με τον κώδικα, διόρθωσε το ADR.
- N.17: ΕΝΑ tsc τη φορά (έλεγξε process πριν).
- Απαντάς στον Giorgio στα **Ελληνικά**, 100% ειλικρίνεια, σκληρό SSoT interrogation.

---

## 1. ΤΙ ΟΛΟΚΛΗΡΩΘΗΚΕ (αυτή η συνεδρία — UNCOMMITTED, ο Giorgio commitάρει)

**🟢 gap #2 — associativity για `intersection` / `nearest` — ΛΕΙΤΟΥΡΓΕΙ + browser-verified.** Η τιμή της διάστασης **αλλάζει** όταν μετακινείται η οντότητα (DIMASSOC=2). Έγιναν:
- **Φ1 data model** (`types/dimension.ts`): `DimensionAssociation` += `param?` / `geometryId2?` / `subIndex2?` (additive, back-compat).
- **Φ2 capture**: `ClickRecord`+`click` action += `snapMode?`/`pickedEntity2?` (threading μέσα από `resolveDimPickContext`→`useDrawingHandlers`→`useDimToolRouting`→`useDimensionCreate`→store). `collectAssociations` (μετακινήθηκε από linter σε **`hooks/dimensions/dimension-create-association-builders.ts`**) → parametric `nearest` + `intersection` 2-host + diameter angular params.
- **Φ3 recompute** (`systems/dimensions/dim-association-service.ts`): `recomputeAssociatedDefPoint(assoc, entity, ctx?)` — nearest re-project `param`, intersection re-solve μέσω NEW `dim-intersection-resolver.ts`, + `endpoint` σε arc.
- **2 runtime fixes (browser-verified):**
  1. **Reliable host capture** — NEW `systems/dimensions/dim-intersection-host-finder.ts::findHostsAtPoint(point, entities, max)` βρίσκει **γεωμετρικά** τις οντότητες στο snapped σημείο (το HoverStore επέστρεφε συχνά τίποτα στην τομή → χανόταν η association). Καλείται από `resolveDimPickContext` (`hooks/drawing/drawing-handler-utils.ts`): INTERSECTION→2 hosts, point-on-curve snaps→1 host.
  2. **Apparent-intersection** — `dim-intersection-resolver.ts` line×line χρησιμοποιεί **infinite-line** `intersectLines` (αντί segment-clamped leaf) → ακολουθεί τους φορείς ακόμα κι εκτός τμήματος.
- **Tests:** 429/429 dim suites GREEN. **Diagnostic logs αφαιρέθηκαν.**
- **ADR-362 Round 20** + follow-up note ενημερωμένα.

**🔴 Commit (ο Giorgio):** stage **ADR-362 + ADR-040** (το `useDrawingHandlers`/`drawing-handler-utils` είναι στο canvas-critical pick path — CHECK 6B/6D). **ΜΗΝ ξανα-αγγίξεις τα παραπάνω** εκτός αν χρειαστεί.

**Επίσης UNCOMMITTED από παλιότερα (ο Giorgio commitάρει, ΜΗΝ τα αγγίξεις):** gap #1 create-tools, gap #3 per-variant hit, DIMBREAK/DIMSPACE wiring, cross-host centralization.

---

## 2. 🎯 ΑΠΟΣΤΟΛΗ ΑΥΤΗΣ ΤΗΣ ΣΥΝΕΔΡΙΑΣ — 2 ζητήματα

### Α) Οι βοηθητικές γραμμές (extension/witness lines) ΔΕΝ συμπίπτουν με το σημείο τομής / το άκρο

**Σύμπτωμα (στιγμιότυπο `Στιγμιότυπο οθόνης 2026-06-24 165339.jpg`, οι 2 ροζ γραμμές δείχνουν τη διαφορά):** οι γραμμές ένδειξης αρχής/τέλους δεν ακουμπούν ακριβώς στο σημείο τομής των γραμμών ούτε στο άκρο της γραμμής.

**Δύο πιθανές ρίζες (κάνε audit & ξεχώρισέ τες):**
1. **DIMEXO gap (ίσως ΣΩΣΤΟ/by-design):** `systems/dimensions/builders/linear-aligned-builder.ts::buildExtLine` (γρ. ~52-65) ξεκινά την ext line σε `origin + dir*DIMEXO` — standard AutoCAD/Revit witness-line κενό. Έλεγξε αν το κενό που βλέπει ο Giorgio είναι απλώς το DIMEXO (τότε ίσως θέλει DIMEXO=0 ή Revit-style που ακουμπά). **ΜΗΝ το θεωρήσεις bug χωρίς να το επιβεβαιώσεις.**
2. **Λάθος defPoint από creation-time snap (ΠΡΑΓΜΑΤΙΚΟ bug):** Στα logs της προηγούμενης συνεδρίας, το 2ο click μιας aligned διάστασης κούμπωσε σε **`perpendicular`** αντί για **`endpoint`** → το `extOrigin2` μπήκε στο πόδι της καθέτου, ΟΧΙ στο άκρο που ήθελε ο χρήστης → οπτική απόκλιση. **Ρίζα:** στη δημιουργία διάστασης **ΔΕΝ υπάρχει visual OSNAP feedback** (δείκτης ✕/□) — ο hover handler για dim tools κάνει **early-return** στο `hooks/drawing/drawing-hover-handler.ts:100-118` και **παρακάμπτει όλο το snap-indicator/tracking rendering** που έχουν τα άλλα εργαλεία. Χωρίς δείκτη, ο χρήστης δεν ελέγχει σε ποιο OSNAP κουμπώνει → αρπάζει λάθος (perpendicular). **Revit-grade fix:** δείξε τον δείκτη ενεργού OSNAP κατά τη δημιουργία διάστασης (endpoint/intersection/midpoint/perpendicular…) ώστε ο χρήστης να στοχεύει σωστά + (προαιρετικά) priority στο endpoint/intersection έναντι perpendicular όταν είναι κοντά.
   - **SSoT audit:** βρες πώς ζωγραφίζεται ο δείκτης OSNAP για τα ΑΛΛΑ εργαλεία (grep `ImmediateSnapStore` / `subscribeSnapResult` / `getFullSnapResult` / snap-indicator overlay leaf — `components/dxf-layout/canvas-layer-stack-leaves.tsx`). Πιθανώς ο δείκτης οδηγείται από ένα store που το dim-hover path απλώς δεν τροφοδοτεί λόγω του early-return. **Reuse το υπάρχον overlay** — μην φτιάξεις νέο.

### Β) Real-time follow ΚΑΤΑ ΤΟ DRAG (live, ανά frame — όχι μόνο στο commit)

**Σύμπτωμα/απαίτηση:** όταν μετακινώ μια γραμμή, θέλω **σε πραγματικό χρόνο** (κατά το σύρσιμο) να αλλάζουν ΚΑΙ η διάσταση ΚΑΙ οι γραμμές ΚΑΙ το κείμενο — όχι μόνο όταν αφήνω το ποντίκι.

**Πού είναι σήμερα:** ο observer `hooks/dimensions/useDimAssociationObserver.ts` τρέχει **μόνο** σε `CommandHistory` execute/undo/redo (δηλ. μετά το release/commit). Γι' αυτό η διάσταση «πηδάει» στο τέλος αντί να ακολουθεί ζωντανά.

**Απαίτηση Giorgio (αυτολεξεί):** «Έχουμε ήδη κώδικα **κεντρικοποιημένο real time** που χρησιμοποιούμε σε πάρα πολλά σημεία της εφαρμογής.» → **SSoT audit ΥΠΟΧΡΕΩΤΙΚΟ:** βρες το κεντρικό real-time/live-drag σύστημα και **σύνδεσε** εκεί τον dim recompute (preview ανά frame), μην φτιάξεις νέο.
   - **Entry points για audit (grep):** `systems/grip-interaction/GripInteractionManager.ts`, `hooks/canvas/canvas-mouse-drag-handlers.ts`, `systems/preview/ghost-preview-frame.ts`, `rendering/core/UnifiedFrameScheduler.ts` (RAF orchestrator, ADR-040), `movePreview` path (`CanvasSection.tsx:470` → `CanvasLayerStack` → `canvas-layer-stack-leaves.tsx`), τυχόν `entities-moving`/live-move signal. Δες πώς τα BIM members (π.χ. pipes/openings) ακολουθούν live σε move (ADR-049 unified move cascade — μήπως υπάρχει ήδη live preview hook εκεί).
   - **Στόχος:** κατά το drag, για κάθε frame, υπολόγισε τα νέα defPoints (reuse `applyAssociationUpdates` / `recomputeAssociatedDefPoint` — ΗΔΗ pure SSoT) με τις live θέσεις της γεωμετρίας και ζωγράφισε τη διάσταση στο preview/ghost layer· στο release, το command commit κάνει το οριστικό (ήδη δουλεύει). **Preview ≡ commit** (ίδιος recompute SSoT).

---

## 3. SSoT ΓΙΑ REUSE (verified — μη φτιάξεις διπλότυπα)

| Ρόλος | Αρχείο / σύμβολο |
|---|---|
| Recompute defPoints (pure) | `systems/dimensions/dim-association-service.ts::recomputeAssociatedDefPoint` / `applyAssociationUpdates` |
| Intersection re-solve | `systems/dimensions/dim-intersection-resolver.ts` |
| Host finder στο σημείο | `systems/dimensions/dim-intersection-host-finder.ts::findHostsAtPoint` |
| Extension/dim-line geometry | `systems/dimensions/builders/linear-aligned-builder.ts` (`buildExtLine`, `assembleGeometry`, `buildAlignedGeometry`) |
| Infinite-line τομή | `systems/dimensions/builders/shared-geometry-helpers.ts::intersectLines` |
| Observer (command-time) | `hooks/dimensions/useDimAssociationObserver.ts` |
| Dim hover (early-return — εδώ λείπει το OSNAP visual) | `hooks/drawing/drawing-hover-handler.ts:100-118` |
| Snap indicator overlay (για reuse στο Α2) | grep `ImmediateSnapStore` / `subscribeSnapResult` / `canvas-layer-stack-leaves.tsx` |
| Real-time/live-drag (για Β — SSoT audit) | `GripInteractionManager` / `canvas-mouse-drag-handlers` / `UnifiedFrameScheduler` / `movePreview` |
| Dim renderer | `rendering/entities/DimensionRenderer.ts` |

---

## 4. ΠΡΩΤΑ ΒΗΜΑΤΑ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ
1. **SSoT audit (grep)** για: (α) το snap-indicator overlay & ποιο store το τροφοδοτεί· (β) το κεντρικό real-time/live-drag σύστημα. **Reuse, όχι παράλληλο.**
2. Ξεκαθάρισε το Α: είναι DIMEXO (by-design) ή λάθος defPoint από perpendicular-snap; Δείξε στον Giorgio με νούμερα/screenshot.
3. Υλοποίησε Revit-grade: (Α) OSNAP visual feedback στη δημιουργία διάστασης + priority endpoint/intersection· (Β) live dim follow ανά frame μέσω του υπάρχοντος real-time SSoT.
4. Tests + `npx jest src/subapps/dxf-viewer/systems/dimensions src/subapps/dxf-viewer/hooks/dimensions` (ΕΝΑ tsc τη φορά, N.17).
5. **ΟΧΙ commit** — άσε τον Giorgio. Ανέφερε αρχεία για staging + ADR-040 αν αγγίξεις canvas-critical.

---

## 5. DEFINITION OF DONE
- Οι βοηθητικές γραμμές ακουμπούν/στοχεύουν σωστά την τομή + το άκρο (ή ξεκαθαρισμένο ότι το κενό = DIMEXO by-design)· ο χρήστης βλέπει OSNAP δείκτη κατά τη δημιουργία διάστασης.
- Κατά το **drag** μιας οντότητας, η διάσταση + οι γραμμές + το κείμενο ακολουθούν **ζωντανά** (preview ≡ commit, μέσω του κεντρικού real-time SSoT, μηδέν διπλότυπο).
- dim test suite GREEN + νέα tests. ADR-362 Round + status header ενημερωμένα.
- 🔴 browser-verify (Giorgio) + commit από Giorgio.

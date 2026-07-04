# HANDOFF — Ίχνη ευθυγράμμισης διάστασης: Phase 3a (row-move overlay) — DEFERRED

> **Ημερομηνία:** 2026-07-04
> **ADR:** ADR-562 §Φ9.3 — `docs/centralized-systems/reference/adrs/ADR-562-dimension-per-part-styling.md`
> **Πρότυπο SSoT (ΕΤΟΙΜΟ):** `hooks/dimensions/dim-alignment-tracking.ts`
> (`resolveDimAlignmentTracking`, `resolveActionAlignmentTracking`, `paintDimAlignmentTracking`)

---

## Τι ΕΓΙΝΕ ήδη (UNCOMMITTED — μην το ξαναγγίξεις)

- **Φ9.1 Δημιουργία** — ✅ (προηγούμενο session)
- **Φ9.2 Λαβές (grip-drag)** — ✅ αυτό το session. Store-based (`DimAlignmentTrackingStore`), override σε
  `mouse-handler-move`/`-up` + paint στο `useDimGripGhostPreview`. +12 jest tests.
- **Φ9.3 MOVE tool (2-click «M»)** — ✅ αυτό το session. `useMovePreview` (override + traces) + `useMoveTool`
  (commit override), ref anchor = base point ⊕ ambient, WYSIWYG. Νέος convenience `resolveActionAlignmentTracking`.

---

## Τι ΜΕΝΕΙ — Phase 3a: Row-move overlay («Λαβές Μετακίνησης Σειρών»)

**Στόχος:** όταν σέρνεις τη λαβή μιας σειράς διαστάσεων (`DimRowHandleOverlay`), να δείχνει ίχνη ευθυγράμμισης
(align τη dim-line offset με άλλες σειρές / κοντινές οντότητες), WYSIWYG με το commit.

### Γιατί DEFERRED (2 πραγματικά εμπόδια — χρειάζεται απόφαση Giorgio):

1. **SVG ghost vs canvas traces.** Το `components/dxf-layout/DimRowHandleOverlay.tsx` ζωγραφίζει το ghost του
   ως **SVG `<line>`** (δικό του `<svg>` overlay, ADR-040 micro-leaf, `pointer-events:none`). Τα ίχνη
   ευθυγράμμισης είναι **canvas** paints (`canvas-v2/preview-canvas/tracking-paint.ts` → `paintDimAlignmentTracking`).
   Δεν ταιριάζουν χωρίς μία από:
   - **(Α)** Ζωγράφισε τα traces ως SVG μέσα στο overlay = **παράλληλο paint system** (παραβιάζει SSoT — τα
     χρώματα/dash/label θα αποκλίνουν από τα υπόλοιπα εργαλεία). ❌ Δεν το προτείνω.
   - **(Β)** Δώσε στο overlay `previewCanvasRef` και κάλεσε `previewCanvasRef.current.drawTrackingAlignment(
     paths, intersections, snappedPoint, label)` (η ΙΔΙΑ imperative route που χρησιμοποιεί η **δημιουργία** στο
     `drawing-hover-handler`). ✅ SSoT-καθαρό, αλλά αγγίζει perf-critical ADR-040 leaf (πρέπει να περάσει το
     ref ως prop χωρίς να προσθέσει `useSyncExternalStore` στον orchestrator — δες CHECK 6C/6D).
   - **(Γ)** Δρομολόγησε ΟΛΟΚΛΗΡΟ το row-ghost μέσω του canvas preview (dedicated ghost hook τύπου
     `useDimGripGhostPreview`) αντί SVG. Μεγαλύτερη αλλαγή, αλλά ενοποιεί το paint.

2. **alignment ↔ normal-constrain.** Το row-move είναι **1-DOF** (μόνο κατά το row normal, `projectRowDelta` σε
   `systems/dimensions/dim-row-handle-geometry.ts:117`). Η alignment είναι 2-DOF. Σειρά (per handoff): εφάρμοσε
   alignment στο **free** destination ΠΡΙΝ το `projectRowDelta` (normal-constrain), ώστε ένα anchor που ευθυγραμμίζει
   κάθετα να «κουμπώνει» τη σειρά. Πρόσεξε να μη σπάσει το υπάρχον F9 step-snap (`applyGripStepSnap` μέσα στο
   `projectRowDelta`).

### Integration points (ξαναγρέπαρέ τα — μπορεί να μετακινήθηκαν):
- **Overlay drag:** `DimRowHandleOverlay.tsx` — `move` handler (~γρ. 111-120): `world` → `worldDelta` →
  `projectRowDelta(worldDelta, normal)`. Βάλε alignment στο `world` (destination) **πριν** το `projectRowDelta`.
  Ref anchor = το `startWorld` της λαβής (ή/και τα origins της σειράς). Χρησιμοποίησε
  `resolveActionAlignmentTracking(world, [cur.startWorld], transform.scale, sceneEntities)`.
- **Paint:** μία από τις (Β)/(Γ) πάνω. Αν (Β): πέρασε `previewCanvasRef` στο overlay + `drawTrackingAlignment` στο
  `move`, και **clear** στο `up`.
- **Commit:** το overlay εκπέμπει `EventBus 'dim:row-move-requested'` → `hooks/useDimensionModify.ts`
  (`buildRowMoveCommands`). Το `delta` που εκπέμπεται είναι ήδη normal-constrained· αν η alignment μπήκε πριν το
  `projectRowDelta`, το commit είναι ήδη WYSIWYG (ίδιο `delta`). Επιβεβαίωσε.

### SSoT (reuse — ΜΗΔΕΝ νέα μηχανή):
- `resolveActionAlignmentTracking(cursor, refPoints, scale, sceneEntities)` — διαβάζει POLAR/ORTHO + AutoAlign toggle.
- `paintDimAlignmentTracking(ctx, tracking, transform, viewport, toMm)` — αν πάει canvas route.
- `previewCanvasRef.current.drawTrackingAlignment(paths, intersections, snappedPoint, label)` — imperative route
  (ίδια με τη δημιουργία· δες `drawing-hover-handler.ts` dim κλάδος).

## Κανόνες session
- Ελληνικά· ΟΧΙ commit/push (Giorgio)· shared tree (git add specific μόνο)· ΟΧΙ tsc (N.17· jest OK).
- ⚠️ ADR-040 CHECK 6B/6C/6D: `DimRowHandleOverlay` + `CanvasSection`/shell = perf-critical → stage ADR-562 §Φ9.3.

## Επαλήθευση
- `npm run dev` → localhost:3000· ενεργοποίησε «Λαβές Μετακίνησης Σειρών»· σύρε λαβή σειράς → ίχνη H/V/polar από τα
  origins/κοντινές οντότητες, «κούμπωμα», release commit-άρει εκεί (undo/redo)· light/dark· AutoAlign OFF· ESC clean.

# HANDOFF — Ίχνη ευθυγράμμισης (AutoAlign) στις διαστάσεις: Phases 2-3 (λαβές + μετακίνηση)

> **Ημερομηνία:** 2026-07-04
> **ADR:** ADR-562 (§Φ9) — `docs/centralized-systems/reference/adrs/ADR-562-dimension-per-part-styling.md`
> **Ref ADRs:** ADR-357 (Object Snap Tracking), ADR-397 (rotation consumer), ADR-040 (CHECK 6D perf)

---

## 0. Κανόνες συνεδρίας (SOS)

- **Απαντάς ΠΑΝΤΑ στα Ελληνικά.**
- **ΠΟΤΕ commit / push** — τα κάνει ο Giorgio. Το **working tree μοιράζεται με άλλον agent** →
  `git add <specific files>` μόνο, ΠΟΤΕ `git add -A` / `git restore .` / `reset --hard` / checkout άλλων αρχείων.
- **ΠΟΤΕ `tsc` / typecheck** (N.17) — γράφε κώδικα & σταμάτα· jest επιτρέπεται.
- **ΠΡΙΝ γράψεις κώδικα: πραγματικό SSoT audit (grep)** για υπάρχοντα κώδικα → reuse, μηδέν διπλότυπα.
- **Ποιότητα:** Revit / Maxon (Cinema 4D) / Figma-level· **FULL ENTERPRISE + FULL SSoT**. Αν οι μεγάλοι
  παίκτες δεν προτείνουν κάτι, ακολούθησε την πρακτική τους.
- **ADR-driven workflow:** Plan → Impl → ADR update (§Φ9) στο ΙΔΙΟ commit.

---

## 1. Τι έγινε ΗΔΗ (Phase 1 — δημιουργία) — UNCOMMITTED, μην το ξαναγγίξεις

Η **δημιουργία** διάστασης δείχνει πλέον ίχνη ευθυγράμμισης (AutoAlign) όπως κάθε άλλο εργαλείο.

**Κοινός SSoT wrapper (ΕΤΟΙΜΟΣ — χρησιμοποίησέ τον και στις Phases 2-3):**
`src/subapps/dxf-viewer/hooks/dimensions/dim-alignment-tracking.ts`
```ts
resolveDimAlignmentTracking(
  cursor: Point2D,
  refPoints: readonly Point2D[],   // τα ρητά anchors της τρέχουσας διάστασης (defPoints/clicks)
  input: { scale: number; polarEnabled: boolean; sceneEntities: readonly Entity[] | null },
): ComposedTracking | null         // { result: TrackingSnapResult, point: Point2D } ή null
```
Mirror του `hooks/tools/rotation-tracking-overlay.ts`. Merge refPoints ⊕ acquired (`TrackingPointStore`) ⊕
ambient (`collectAmbientAlignmentAnchors`, AutoAlign-gated) → `composeTrackingSnap` (ίδιο brain).

**Wiring Phase 1 (μην το πειράξεις):**
- `hooks/drawing/drawing-hover-handler.ts` — dim κλάδος (`if (isDimTool)`): hover override + `previewCanvasRef.current.drawTrackingAlignment(...)`.
- `hooks/drawing/useDrawingHandlers.ts` — `onDrawingPoint` dim κλάδος: commit parity (WYSIWYG).
- Gate: skipped όταν `isDimLineRefPhase()` (free dim-line offset pick).

**ADR-562:** §Φ9 προστέθηκε, status = «Φ9.1 IMPLEMENTED», changelog entry (2026-07-04 Φ9.1).

---

## 2. Τι ΜΕΝΕΙ — Phases 2-3

### 🎯 PHASE 2 — Λαβές (grip-drag)

Η μηχανή AutoAlign δεν καλείται σε translate/stretch grip-drag (μόνο σε rotation hot-grip). Στόχος: όταν σέρνεις
λαβή διάστασης (defpoint-0/1, dim-line-ref, text), να δείχνει ίχνη με anchors τα **υπόλοιπα defPoints** της ίδιας
διάστασης ⊕ ambient ⊕ acquired.

**Integration points (από επιβεβαιωμένη εξερεύνηση — ξαναγρέπαρέ τα, μπορεί να μετακινήθηκαν γραμμές):**
1. **Live/preview point** — `systems/cursor/mouse-handler-move.ts` (~γρ. 177-288): μέσα στο
   `if (isGripDragging && snapEnabled && findSnapPoint) { … }`, ΜΕΤΑ το OSNAP `moveWorldPos` (+ wall-face /
   column-corner snaps), κάνε override με `resolveDimAlignmentTracking(moveWorldPos, otherDefPoints, {...})`.
   **Gate σε dim grip:** ο `getActiveDragGrip()` (`systems/cursor/GripDragStore.ts`) **δεν** εκθέτει σήμερα
   `dimGripKind` — πρέπει να το κάνεις publish στο mousedown (`hooks/grips/grip-mouse-handlers.ts:~264`, δίπλα στο
   `wallGripKind ?? columnGripKind`). Τα `otherDefPoints` = τα defPoints της συρόμενης διάστασης εκτός του dragged.
2. **Commit** — `systems/cursor/mouse-handler-up.ts` (~γρ. 184-256): ίδιο override στο `upWorldPos` (WYSIWYG, ίδιο
   με #1). ⚠️ #1 και #2 ΠΡΕΠΕΙ να μένουν σε sync.
3. **Ghost paint** — `hooks/dimensions/useDimGripGhostPreview.ts`: σήμερα διαβάζει `dragPreview.delta` (state,
   `cursorMode:'none'`) — δεν ζωγραφίζει ίχνη. Είτε (α) βάλε το aligned σημείο upstream στο `dragPreview` (ώστε το
   ghost geometry να το ακολουθεί) + πρόσθεσε paint των traces, είτε (β) ακολούθησε το πρότυπο του
   `hooks/tools/useGripGhostPreview.ts` (γρ. 154-215, rotation branch: `resolveRotationTracking` + `paintRotationTracking`).
   Θα χρειαστείς **paint helper**: πρόσθεσε `paintDimAlignmentTracking(ctx, result, transform, viewport, toMm)` στο
   `dim-alignment-tracking.ts` (thin wrapper πάνω στα `paintAlignmentPaths`/`paintIntersections`/`paintTooltip` από
   `canvas-v2/preview-canvas/tracking-paint.ts` — ίδιο με `paintRotationTracking`).

**Grip SSoT (reuse):** `hooks/dimensions/useDimensionGrips.ts` (`getDimensionGrips`/`applyDimensionGripDrag`),
`hooks/grip-kinds.ts` (`DimensionGripKind`), `hooks/grips/grip-linear-commits.ts` (`commitDimensionGripDrag`),
`core/commands/entity-commands/UpdateDimGripCommand.ts`.

### 🎯 PHASE 3 — Μετακίνηση

1. **Row-move overlay** («Λαβές Μετακίνησης Σειρών»): `components/dxf-layout/DimRowHandleOverlay.tsx` (per-pointer-move)
   + `systems/dimensions/dim-row-handle-geometry.ts` (`projectRowDelta` ~γρ. 117). Πρόσθεσε alignment στο free delta
   **πριν** το normal-constrain. Commit: EventBus `dim:row-move-requested` → `hooks/useDimensionModify.ts` (`buildRowMoveCommands`).
2. **MOVE tool** (2-click M command): `hooks/tools/useMoveTool.ts` (`handleMoveClick`, click #2 destination ~γρ. 149-171)
   + ghost `hooks/tools/useMovePreview.ts` (~γρ. 140-160). Πρόσθεσε alignment override στο destination + paint (WYSIWYG).
   Ref anchor = το basePoint (click #1) ή/και οι κοντινές οντότητες.

---

## 3. SSoT — μηχανή ευθυγράμμισης (μηδέν παράλληλο σύστημα)

- **Resolve SSoT:** `systems/tracking/resolve-alignment-tracking.ts` (`resolveAlignmentTracking`, store+ambient) ·
  `systems/tracking/ambient-tracking-compose.ts` (`composeTrackingSnap`) · `systems/tracking/tracking-resolver.ts`
  (`resolveTrackingSnap`) · `systems/tracking/ambient-alignment-source.ts` (`collectAmbientAlignmentAnchors`) ·
  `systems/tracking/TrackingPointStore.ts` (`AcquiredTrackingPoint`, acquire/getPoints/clearAll).
- **AutoAlign toggle:** `systems/tracking/ambient-alignment-config-store.ts` (`ambientAlignmentConfigStore.getSnapshot().enabled`).
  Gate ΜΟΝΟ την ambient πηγή· acquired/refPoints πάντα συμμετέχουν.
- **Paint SSoT:** `canvas-v2/preview-canvas/tracking-paint.ts` (`paintAlignmentPaths`/`paintIntersections`/`paintTooltip`) ·
  imperative route `PreviewCanvasHandle.drawTrackingAlignment(paths, intersections, snappedPoint, label)`.
- **Πρότυπο grip-drag consumer:** `hooks/tools/rotation-tracking-overlay.ts` (`resolveRotationTracking` +
  `paintRotationTracking`) — **αντέγραψε αυτό το μοτίβο** για τις λαβές/μετακίνηση.

**Ξεκίνα με grep** (SSoT audit): `resolveAlignmentTracking`, `resolveRotationTracking`, `paintRotationTracking`,
`resolveGripTranslateDelta`, `getActiveDragGrip`, `dimGripKind`, `projectRowDelta` — δες τι υπάρχει πριν γράψεις.

---

## 4. Ρίσκα / περιορισμοί

- **ADR-040 CHECK 6D (BLOCK):** αγγίζεις `systems/cursor/` handlers → **stage-άρισε ADR** (το ADR-562 §Φ9) στο commit,
  αλλιώς μπλοκάρει το pre-commit hook.
- **WYSIWYG (preview ≡ commit):** live override (mouse-move / ghost) & commit override (mouse-up) με τον ΙΔΙΟ helper
  & ίδια inputs. Ο κώδικας το τονίζει επανειλημμένα.
- **Perf:** ambient scene read gated πίσω από `ambientAlignmentConfigStore.enabled` (lazy), όπως οι υπάρχοντες consumers.
- **Phased:** κάνε **Phase 2 πρώτα**, verify, μετά Phase 3 (context hygiene — 1 phase/session).

## 5. Επαλήθευση

- `npm run dev` → localhost:3000. Επίλεξε διάσταση.
- **Phase 2:** σύρε λαβή (άκρο/dim-line/text) → dashed ίχνη H/V (+ polar) από τα άλλα defPoints/κοντινές οντότητες,
  με halo + label· η λαβή «κουμπώνει»· release commit-άρει εκεί (undo/redo δουλεύει).
- **Phase 3:** row-move handle + MOVE (M) → ίχνη στο destination, WYSIWYG.
- Light/dark theme, AutoAlign OFF (μόνο ref/acquired), ESC clean.

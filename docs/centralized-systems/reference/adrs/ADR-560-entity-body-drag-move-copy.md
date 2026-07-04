# ADR-560 — Entity Body-Drag (Move / Ctrl-Copy)

- **Status**: ✅ IMPLEMENTED (UNCOMMITTED) — 2026-07-01
- **Category**: DXF Viewer — 2D Editing / Pointer Interaction
- **Related**: ADR-040 (preview canvas performance), ADR-357 (grip Copy toggle),
  ADR-363 §1G.5 (grip Alt move-from-point), ADR-466 (entity clipboard clone SSoT),
  ADR-049 (unified Move tool), ADR-357/363/562 (grip AutoAlign tracking SSoT — 3ος consumer)

## Context

Στο 2D DXF viewer, για να μετακινήσει ή να αντιγράψει μια οντότητα ο χρήστης έπρεπε
είτε να χρησιμοποιήσει 2-click εργαλεία (Move tool / `bim-copy`) είτε να πιάσει **λαβή
(grip)** με `Alt` / `Alt+Ctrl`. Το κλασικό CAD/Figma gesture **«πιάνω το σώμα της
οντότητας και το σέρνω»** δεν υπήρχε — drag πάνω σε οντότητα ξεκινούσε lasso.

Ζητούμενο (Giorgio): επιλογή οντότητας → **σύρσιμο σώματος = μετακίνηση**,
**Ctrl + σύρσιμο = αντιγραφή** στη θέση που αφήνεται (ίδιος όροφος).

## Decision

Νέο body-drag gesture path στο 2D pointer pipeline. Χωρίς `Ctrl` = **μετακίνηση**,
με `Ctrl` (παγωμένο στο press) = **αντιγραφή**. Πλήρης επανάχρηση υπαρχόντων SSoT —
μηδέν διπλότυπο μηχανισμού clone/preview/command.

### Ροή

1. **mousedown** (`useCentralizedMouseHandlers`, select mode, αριστερό κουμπί, αφού
   δεν το κατανάλωσε grip/pan/zoom/drawing): αν ο κέρσορας είναι πάνω σε οντότητα
   (hover SSoT), αρμάρεται body-drag session **αντί** για lasso.
   - Στόχος (`resolveBodyDragTarget`, pure): hovered ∈ selection → όλη η επιλογή·
     αλλιώς adopt το hovered (Figma-style).
   - `copy` flag = `CtrlKeyTracker.getSnapshot()` παγωμένο στο press (release Ctrl
     μεσοδρομίς δεν αλλάζει το gesture — mirror `GripAltMoveStore`).
2. **mousemove**: ghost (`useEntityBodyDragPreview`) διαβάζει anchor από το store +
   live cursor από το frame· ζωγραφίζει WYSIWYG μεταφρασμένα αντίγραφα + κυανά
   AutoAlign ίχνη (RESOLVE-IN-DRAW) + πράσινο «+» στο copy mode. ORTHO (F8) parity.
   **Καμία πινακίδα** (Giorgio 2026-07-04 γ) — τα ίχνη + tooltip δείχνουν την ένδειξη.
3. **mouseup** (`mouse-handler-up`): αν |delta| < 3px → treat ως click (fall-through
   σε selection). Αλλιώς emit `entity-body-drag:commit {entityIds, delta, copy}`,
   consume το up.
4. **commit** (`useEntityBodyDragCommit`, EventBus listener με command/level deps):
   - copy → κοινό `buildEntityCloneCommand` (BIM enterprise IDs + host rewire +
     DXF translate/id-swap) → `PasteEntitiesCommand` → re-select clones.
   - move → `MoveEntityCommand` / `MoveMultipleEntitiesCommand` (ίδια με το Move
     tool), selection διατηρείται.
5. **ESC / blur**: `EntityBodyDragStore.clear()` χωρίς commit.

### ADR-040 συμμόρφωση

- `EntityBodyDragStore` = vanilla singleton. Low-freq `subscribe` (1 arm + 1 clear
  ανά drag) για mount/unmount του ghost leaf· ο 60fps cursor-follow διαβάζει με
  getter (`getAnchor`/`getSession`) μέσα στο draw delegate, **όχι** μέσω React.
- Ο ghost είναι micro-leaf (`EntityBodyDragPreviewMount`) στο `PreviewCanvasMounts`
  — ο orchestrator/shell μένουν inert.

### Κεντρικοποίηση (Boy Scout, N.0.2)

Το split-BIM/DXF + clone logic εξήχθη από `useEntityClipboard.pasteClipboard` σε
`buildEntityCloneCommand(sources, delta, sm)`. Το Ctrl+V (delta={0,0}, paste-in-place)
και το Ctrl+drag copy (πραγματικό delta) μοιράζονται **έναν** κώδικα κλωνοποίησης.

### AutoAlign tracking parity (2026-07-04)

Το body-drag απέκτησε **τα ΙΔΙΑ κυανά ίχνη ευθυγράμμισης** (Object-Snap-Tracking) με τη
λαβή, ως **3ος consumer** του υπάρχοντος grip AutoAlign SSoT (ADR-357/363/562) — μηδέν νέα
μηχανή. Thin adapter `applyBodyDragAlignmentTracking(moveWorldPos, scene, scale)`
(`systems/cursor/grip-drag-alignment-tracking.ts`): κάνει το ΙΔΙΟ `resolveActionAlignmentTracking`
με **refPoints = [το grabbed base point]** (AutoCAD MOVE base-point tracking, generic για κάθε
τύπο οντότητας), δημοσιεύει στο ΙΔΙΟ `GripAlignmentTrackingStore` και overrid-άρει το effective
world → ghost delta (WYSIWYG). Ο ghost (`useEntityBodyDragPreview`) ζωγραφίζει τα ίχνη με το ΙΔΙΟ
`paintGripAlignmentTracking` που χρησιμοποιεί ο `useGripGhostPreview`.

- **mouse-handler-move**: `else if (EntityBodyDragStore.getActive())` καλεί τον adapter (μετά το grip branch).
- **mouse-handler-up**: commit re-resolve με `[session.anchor]` πριν το ORTHO → committed == preview.
- **EntityBodyDragStore.clear()**: καλεί `clearGripAlignmentTracking()` (drag-lifecycle SSoT, mirror
  του `GripDragStore.clearActiveDragGrip`).
- **UI cleanup (Giorgio)**: αφαιρέθηκαν ο κόκκινος σταυρός βάσης + η κίτρινη rubber-band + η πινακίδα
  απόστασης· η πινακίδα κρατιέται **μόνο** ως μικρή διακριτική ένδειξη όταν ΔΕΝ κουμπώνει πουθενά (και
  στο middle-grip μέσω `useGripGhostPreview`, όταν υπάρχει ενεργό ίχνος → η πινακίδα κρύβεται).

## Files

- **ΝΕΑ**:
  - `systems/drag/EntityBodyDragStore.ts` — session SSoT (arm/getters/clear/subscribe + ESC/blur cancel)
  - `systems/drag/body-drag-target.ts` — pure mousedown-gate resolver
  - `hooks/tools/useEntityBodyDragPreview.ts` — live ghost (mirror `useMovePreview`)
  - `hooks/tools/useEntityBodyDragCommit.ts` — EventBus commit (copy/move)
  - `bim/transforms/build-entity-clone-command.ts` — shared clone SSoT
  - colocated `__tests__` (store / target / clone-command — 16 tests)
- **ΤΡΟΠΟΠΟΙΗΣΗ**:
  - `systems/cursor/useCentralizedMouseHandlers.ts` — arm στο mousedown
  - `systems/cursor/mouse-handler-up.ts` — commit emit + threshold (+ AutoAlign commit re-resolve)
  - `hooks/tools/useEntityClipboard.ts` — reuse κοινού helper
  - `hooks/tools/useModifyTools.ts` — mount `useEntityBodyDragCommit`
  - `components/dxf-layout/canvas-layer-stack-tool-preview-mounts.tsx` +
    `canvas-layer-stack-preview-mounts.tsx` — ghost leaf mount
  - `systems/events/drawing-event-map.ts` — `entity-body-drag:commit` event type
- **ΤΡΟΠΟΠΟΙΗΣΗ (AutoAlign parity, 2026-07-04)**:
  - `systems/cursor/grip-drag-alignment-tracking.ts` — νέο `applyBodyDragAlignmentTracking` (thin adapter)
  - `systems/cursor/mouse-handler-move.ts` — body-drag branch που καλεί τον adapter
  - `systems/drag/EntityBodyDragStore.ts` — `clear()` → `clearGripAlignmentTracking()`
  - `hooks/tools/useEntityBodyDragPreview.ts` — κυανά ίχνη RESOLVE-IN-DRAW· αφαίρεση σταυρού/rubber-band/πινακίδας
  - `hooks/tools/useGripGhostPreview.ts` — line grip: ίχνη RESOLVE-IN-DRAW (mirror body-drag)· αφαίρεση πινακίδας
  - colocated `__tests__/body-drag-alignment-tracking.test.ts` (3 tests)
- **ΤΡΟΠΟΠΟΙΗΣΗ (grip-move parity + αφαίρεση πινακίδας, 2026-07-04 γ)**:
  - `hooks/tools/useGripGhostPreview.ts` — local in-draw `resolveActionAlignmentTracking` (αντί store-read)· αφαίρεση `isTranslate` block/πινακίδας/⟂∥ readout
  - `hooks/tools/useEntityBodyDragPreview.ts` — αφαίρεση fallback `drawDimPill`
  - `hooks/tools/useMovePreview.ts` — αφαίρεση `drawDimPill` (2-click MOVE tool)
  - `hooks/tools/grip-ghost-preview-draw-helpers.ts` — dead-code: αφαίρεση `drawMoveReadoutLeader`
  - `canvas-v2/preview-canvas/overlay-line-style.ts` — dead-code: αφαίρεση `OVERLAY_LINE_COLORS.moveLeader` token
  - `bim/labels/move-readout.ts` (+test) — dead-code: αφαίρεση `moveReadoutMid` (μηδέν consumer)
- **ΤΡΟΠΟΠΟΙΗΣΗ (SSoT paint κεντρικοποίηση, 2026-07-04 δ)**:
  - `hooks/dimensions/dim-alignment-tracking.ts` — νέο public `paintActionAlignmentTracking(…, sceneUnits)`· το generic `paintGripAlignmentTracking` → INTERNAL
  - `hooks/tools/useMovePreview.ts` + `useEntityBodyDragPreview.ts` + `useGripGhostPreview.ts` + `hooks/dimensions/useDimGripGhostPreview.ts` — call-sites → `paintActionAlignmentTracking` (αφαίρεση copy-pasted `sceneDistanceToMeters` lambda)

## Verification

- **jest**: 16/16 (store arm/copy/clear/ESC, target resolver, clone-command split/translate).
- **browser** (εκκρεμεί): move κολόνας με σύρσιμο + Ctrl+Z· Ctrl+drag copy (νέα IDs,
  original μένει)· πολλαπλή επιλογή· drag σε κενό → lasso αμετάβλητο· τοίχος με opening
  → copy κρατά το opening (host rewire).

## Changelog

- **2026-07-01** — Αρχική υλοποίηση (move + Ctrl-copy body-drag). UNCOMMITTED.
- **2026-07-04** — **AutoAlign tracking parity (TASK A/B)**: body-drag κάθε οντότητας δείχνει τα ΙΔΙΑ
  κυανά ίχνη ευθυγράμμισης με τη λαβή (3ος consumer του grip AutoAlign SSoT, base-point tracking).
  Νέος thin adapter `applyBodyDragAlignmentTracking` (reuse `resolveActionAlignmentTracking` +
  `GripAlignmentTrackingStore` + `paintGripAlignmentTracking`). Commit re-resolve για WYSIWYG. UI:
  αφαιρέθηκαν κόκκινος σταυρός + κίτρινη rubber-band + πινακίδα· η πινακίδα κρατιέται μόνο ως μικρή
  ένδειξη όταν δεν κουμπώνει (και στο middle-grip η πινακίδα κρύβεται όταν υπάρχει ενεργό ίχνος).
  +3 jest tests. UNCOMMITTED.
- **2026-07-04 (β)** — **AutoAlign RESOLVE-IN-DRAW (fix «κυανά ίχνη χάνονται»)**: το
  `useEntityBodyDragPreview` υπολόγιζε τα ίχνη διαβάζοντας το cross-tick `GripAlignmentTrackingStore`
  (γραμμένο σε άλλο tick από τον `mouse-handler-move` → timing-skew· ενίοτε `null` κατά το RAF paint →
  «πινακίδα μόνο, ποτέ cyan»). Πλέον υπολογίζει το tracking **ΤΟΠΙΚΑ μέσα στο draw** μέσω του ΙΔΙΟΥ
  SSoT `resolveActionAlignmentTracking` (mirror του `useMovePreview` = self-contained gesture) πάνω στο
  ORTHO-locked destination με anchor την αρχή του drag. Το resolved point τρέφει ΚΑΙ τη γεωμετρία του
  ghost ΚΑΙ τα ίχνη → WYSIWYG (ο commit re-resolve μένει ίδιος). Μηδέν εξάρτηση από το store για paint.
  Υπάρχοντα jest GREEN (16/16). UNCOMMITTED.
- **2026-07-04 (γ)** — **Grip-move ↔ body-drag alignment PARITY + αφαίρεση πινακίδας από ΟΛΕΣ τις ροές move**:
  το middle/MOVE-cross grip γραμμής (`useGripGhostPreview`) έδειχνε «λευκή πινακίδα» αντί για ίχνη γιατί
  διάβαζε το cross-tick `GripAlignmentTrackingStore` (ίδιο timing-skew με το β, μόνο στη grip ροή). Πλέον
  υπολογίζει τα ίχνη **ΤΟΠΙΚΑ μέσα στο draw** μέσω `resolveActionAlignmentTracking(effectiveCursor,
  getLineGripAlignmentAnchors(dp.gripIndex, dp.lineGripKind, line, dp.anchorPos), …)` — ακριβές mirror του
  body-drag. Ο `effectiveCursor` είναι ήδη το ευθυγραμμισμένο realtime σημείο που το point-override
  (`applyGripDragAlignmentTracking` → `setRealtimeWorldCursor`) έθρεψε ΚΑΙ στο grip delta → idempotent
  double-resolve (pure resolver) → WYSIWYG. Το store παραμένει μόνο για τη dimension ροή (`useDimGripGhostPreview`).
  Απόφαση Giorgio «καμία πινακίδα πουθενά»: αφαιρέθηκε η `drawDimPill` ΚΑΙ από τις 3 ροές μετακίνησης
  (grip midpoint + body-drag + 2-click MOVE tool)· κρατήθηκε το hot-grip rubber-band (`drawDashedSegment`).
  Boy-Scout dead-code (N.0.2): αφαιρέθηκαν `drawMoveReadoutLeader` + `OVERLAY_LINE_COLORS.moveLeader` token +
  `moveReadoutMid` (μηδέν production consumer μετά την αφαίρεση). Σχετικά jest GREEN (97/97). UNCOMMITTED.
- **2026-07-04 (δ)** — **SSoT κεντρικοποίηση paint (Giorgio «καμία διπλότυπη κεντρικοποίηση»)**: το wiring
  `paintGripAlignmentTracking(ctx, tracking, t, vp, (d) => sceneDistanceToMeters(d, units) * 1000)`
  επαναλαμβανόταν ΠΑΝΟΜΟΙΟΤΥΠΑ σε **4** hooks (`useMovePreview`, `useEntityBodyDragPreview`,
  `useGripGhostPreview`, `useDimGripGhostPreview`) — το scene→mm tooltip mapping copy-pasted 4 φορές.
  Νέο ΕΝΑ public API `paintActionAlignmentTracking(ctx, tracking, transform, viewport, sceneUnits)` στο
  `dim-alignment-tracking.ts` (το generic `toMm` `paintGripAlignmentTracking` έγινε INTERNAL). Και τα 4
  call-sites περνούν πλέον μόνο `sceneUnits` → το mapping ζει ΜΙΑ φορά. Σχετικά jest GREEN (57/57). UNCOMMITTED.
- **2026-07-04 (ε)** — **Grip Alt-move AutoAlign parity (4ος consumer, generic base-point)**: όταν ο χρήστης
  πατά **Alt + λαβή** και σέρνει ΟΠΟΙΑΔΗΠΟΤΕ οντότητα (κολόνα/τοίχος/κύκλος/DXF|BIM), δεν εμφανίζονταν
  κυανά ίχνη ούτε έλξη προς γείτονες. Ρίζα: το `applyGripDragAlignmentTracking` χειριζόταν μόνο dim + line
  grips· whole-entity Alt-move μη-γραμμής → `clearGripAlignmentTracking()`. Το Alt-move είναι εννοιολογικά
  ΙΔΙΟ με το body-drag (move από base point), οπότε **κεντρικοποίηση**: νέος κοινός
  `resolveBasePointTracking(moved, anchor, scene, scale)` — ΕΝΑ base-point brain που καλούν ΚΑΙ το
  `applyBodyDragAlignmentTracking` (refactor, ίδια συμπεριφορά) ΚΑΙ νέος κλάδος Alt-move
  (`GripAltMoveStore.getActive()` → `[dragAnchor]`, generic για κάθε τύπο οντότητας). Paint: το in-draw
  block στο `useGripGhostPreview` γενικεύτηκε — Alt-move → `[anchorPos]`, line grip → line anchors, ίδιο
  local-resolve → `paintActionAlignmentTracking`. Τώρα body-drag + grip Alt-move μοιράζονται ΕΝΑ resolve +
  ΕΝΑ store + ΕΝΑ paint. Αρχεία: `systems/cursor/grip-drag-alignment-tracking.ts`,
  `hooks/tools/useGripGhostPreview.ts`. UNCOMMITTED.
- **2026-07-04 (ε-fix)** — **BLUR-PROOF gate (τα ίχνη ΠΑΛΙ δεν έβγαιναν)**: πρώτη εκδοχή του (ε) έκανε gate
  και στις δύο πλευρές στο LIVE `GripAltMoveStore.getActive()`. Στα Windows το Alt αρματώνει το browser menu
  και πυροδοτεί window `blur` → `GripAltMoveStore.onBlur` κάνει `active=false` MID-drag, ενώ το ghost (RAF-
  decoupled· `dragPreview` χτισμένο ΜΙΑ φορά με baked `movesEntity:true`) συνέχιζε → το gate έπεφτε, μηδέν
  ίχνη/έλξη. Fix: (1) PAINT gate → baked `dp.movesEntity === true && !dp.rotatePivot` (σταθερό όλο το gesture),
  όχι live store. (2) RESOLVE gate → νέο baked `ActiveDragGripInfo.altMove` (captured στο grip mousedown,
  `grip-mouse-handlers`), με fallback το live store. Αρχεία +: `systems/cursor/GripDragStore.ts`,
  `hooks/grips/grip-mouse-handlers.ts`. Επίσης διορθώθηκε ΠΡΟΫΠΑΡΧΟΥΣΑ αστοχία test (`grip-commit-alt-bypass`):
  ο mock `createSceneManagerAdapter` επέστρεφε bare `{}` → `executeWholeEntityConnectivityMove` (ADR-408 Φ-C,
  προστέθηκε αργότερα) έριχνε `getEntity is not a function`· ο mock πλέον έχει `getEntity: () => undefined`
  (non-plumbing → false → fall-back σε `moveEntities`). Σχετικά jest GREEN (48/48). UNCOMMITTED.

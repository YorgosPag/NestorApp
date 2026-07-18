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
- **2026-07-04 (ζ)** — **OSNAP-priority (Giorgio: «να έλκομαι μόνο από τα κοντινά σημεία»)**: το AutoAlign
  τραβούσε το φάντασμα πάνω σε νοητούς άξονες ευθυγράμμισης (ambient) → η λαβή «πεταγόταν» από το σταυρόνημα,
  ενώ ο χρήστης θέλει έλξη ΜΟΝΟ σε χαρακτηριστικά σημεία (άκρα/μέσα/κέντρα) με τα markers τους. Απόφαση:
  **OSNAP νικάει το AutoAlign**. (1) `mouse-handler-move`: νέο `osnapFound` (OSNAP/wall-face/column-corner
  snap) → όταν κουμπώνει, ΠΑΡΑΚΑΜΠΤΕΤΑΙ το `applyGripDragAlignmentTracking`/`applyBodyDragAlignmentTracking`
  (το φάντασμα κουμπώνει στο σημείο, όχι σε άξονα) + `clearGripAlignmentTracking()`. (2) `useGripGhostPreview`:
  οι κυανές γραμμές ζωγραφίζονται ΜΟΝΟ όταν `!getImmediateSnap()?.found` (αλλιώς φαίνεται το OSNAP marker).
  Όταν ΔΕΝ υπάρχει κοντινό σημείο → AutoAlign + κυανές ως έχει. Αρχεία: `systems/cursor/mouse-handler-move.ts`,
  `hooks/tools/useGripGhostPreview.ts`. Σχετικά jest GREEN (48/48). UNCOMMITTED.

- **2026-07-05 (η)** — **OSNAP marks δεν έβγαιναν στο grip Alt-move — blur-proof altMove SSoT resolver**:
  Το (ζ) περίμενε το OSNAP να κουμπώσει, αλλά **δεν κούμπωνε**: το AutoAlign έδειχνε κυανές, το OSNAP όχι
  (μισό Option B). **ΡΙΖΑ (de-facto διπλοτυπία):** η απόφαση «είναι whole-entity Alt-move;» ήταν γραμμένη
  σε **7 σημεία** με ΑΣΥΝΕΠΗ τρόπο — το AutoAlign (`grip-drag-alignment-tracking.ts`) διάβαζε το **baked**
  `activeDragGrip.altMove` (blur-proof), ενώ το OSNAP corner-projection (`mouse-handler-move.ts` +
  `mouse-handler-up.ts`), το commit (`grip-commit-adapters.ts`, `grip-mouseup-handler.ts`) και το ghost
  (`grip-dxf-drag-preview-resolver.ts`) διάβαζαν το **live** `GripAltMoveStore.getActive()`. Στα Windows το Alt
  σηκώνει το browser menu → `blur` → `GripAltMoveStore.onBlur` μηδενίζει το live flag **mid-drag** → ο guard
  του column corner-projection έπεφτε → **κανένα marker/έλξη** (ενώ το AutoAlign, με baked flag, δούλευε).
  **FIX (FULL SSoT):** νέος resolver `isActiveGripAltMove()` στο `GripDragStore.ts` (`baked ?? false || live`)·
  ΟΛΟΙ οι 7 consumers (AutoAlign + OSNAP preview + OSNAP commit + ghost + arm-click + movesWhole + manifold-outlet
  gate) καλούν ΤΟΝ ΙΔΙΟ resolver → αδύνατη πλέον η απόκλιση. Τα direct `GripAltMoveStore` imports (read-side)
  αφαιρέθηκαν από τους consumers· write-side (`wasAltAtMouseDown`/`arm`/`clear`) μένει. Νέο regression test:
  `systems/cursor/__tests__/GripDragStore.isActiveGripAltMove.test.ts` (baked true + live cleared-by-blur → true).
  Αρχεία: `systems/cursor/GripDragStore.ts` (helper), `mouse-handler-move.ts`, `mouse-handler-up.ts`,
  `grip-drag-alignment-tracking.ts`, `hooks/grips/grip-commit-adapters.ts`, `grip-mouseup-handler.ts`,
  `grip-dxf-drag-preview-resolver.ts`. jest GREEN (20/20 στοχευμένα). **ΟΧΙ tsc** (N.17). UNCOMMITTED.
  ⚠️ **ΑΝΑΘΕΩΡΗΣΗ (βλ. θ):** το (η) ήταν σωστή+αναγκαία κεντρικοποίηση ΑΛΛΑ **ΟΧΙ η αποφασιστική** αιτία
  του «δεν φαίνεται marker». Runtime diagnostics απέδειξαν ότι το detection δούλευε ήδη (columnCornerFound:true).

- **2026-07-05 (θ)** — **Η ΑΠΟΦΑΣΙΣΤΙΚΗ ρίζα: το σιωπηλό GRID έπνιγε το column-corner OSNAP στο grip-move**:
  Runtime diagnostics (throttled logs σε handler + marker leaf) απέδειξαν: (1) detection ✅ (`columnCornerFound:true`),
  (2) έλξη εφαρμόζεται ✅ (`attractionDeltaWorld` 6-18), (3) store σωστό ✅ (`immediateSnapFound:true`) — ΑΛΛΑ ο
  marker leaf έβλεπε **`mode:'grid'` → `markerVisible:false`** στις περισσότερες frames (+ σποραδικά perpendicular/
  extension). **ΡΙΖΑ:** ο generic `findSnapPoint(cursor)` στο grip block (`mouse-handler-move` γρ.~189) δεχόταν
  ΚΑΘΕ found έλξη — **και το ubiquitous σιωπηλό grid**. Το grid: (α) έθετε `osnapFound=true` → καθάριζε το
  AutoAlign, (β) είναι silent → κανένα marker, (γ) έθετε `moveWorldPos`=grid → η «έλξη» ήταν προς **αόρατο grid
  point** αντί για τη γωνία. Έτσι το column-corner projection (visible `bim_corner`) **πνιγόταν**. Το draw path
  (`snap-scheduler`→`resolveColumnDrawSnap`) είχε ΗΔΗ την προτεραιότητα «visible corner > visible cursor > silent
  grid»· **το grip path ΔΕΝ την είχε** (η ίδια απόκλιση draw↔grip). **FIX (SSoT, χειρουργικό):** ο generic snap
  στο grip block δέχεται πλέον **ΜΟΝΟ ΟΡΑΤΕΣ** έλξεις — `isVisibleSnapMode(gripSnapResult.activeMode)` (ΤΟ ΙΔΙΟ
  SSoT που ήδη χρησιμοποιεί το `corner-projection-snap`). Silent grid/guide → πέφτει στο else (clear) → νικά το
  column-corner projection ή το AutoAlign. Αρχείο: `systems/cursor/mouse-handler-move.ts` (+import `isVisibleSnapMode`).
  jest GREEN (16/16 grip suites). Τα προσωρινά diagnostics αφαιρέθηκαν. **ΟΧΙ tsc** (N.17). UNCOMMITTED.
  📌 **Επόμενο (enterprise SSoT):** το grip path να επαναχρησιμοποιήσει τον ΙΔΙΟ resolver προτεραιότητας με το
  draw path (`resolveColumnDrawSnap`-style) ώστε να μη μένουν δύο παράλληλες υλοποιήσεις priority.

- **2026-07-05 (ι)** — **Η ΟΝΤΩΣ αποφασιστική αιτία: ο decoupled `snap-scheduler` σκέπαζε το column-corner**:
  Μετά το (θ) ΠΑΛΙ ίδιο, ΑΛΛΑ ο Giorgio απομόνωσε: **κολώνες όχι, τοίχοι ΝΑΙ**. Diagnostics: ο marker leaf έβλεπε
  generic **raw-cursor** snaps (grid/perp/extension), ΠΟΤΕ το `bim_corner`. Αφού ο handler γράφει το column-corner
  ΤΕΛΕΥΤΑΙΟΣ, κάποιος έγραφε generic **μετά**: ο `snap-scheduler.onSnapFrame` (RAF `findSnapPoint(cursor)`). Ο
  guard `!isGripDragging` ήταν μόνο στο **arming**· το React `isGripDragging` τρεμοπαίζει → stale-armed frames
  τρέχουν μέσα στο grip drag. **Τοίχοι αβλαβείς** (endpoint grip → cursor==snap-point → generic συμφωνεί με
  wall-face)· **κολώνες σπασμένες** (base=γωνία, ευθυγράμμιση άλλης γωνίας → generic βρίσκει grid/perp → σκεπάζει).
  **FIX:** `snap-scheduler.onSnapFrame` → `if (getActiveDragGrip()) { dirty=false; return; }` (imperative store =
  σταθερό όλο το drag, χωρίς flicker· bail ΧΩΡΙΣ clear → μένει το αποτέλεσμα του grip handler). Αρχείο:
  `systems/cursor/snap-scheduler.ts` (+import `getActiveDragGrip`). jest GREEN. **ΟΧΙ tsc** (N.17). UNCOMMITTED.

- **2026-07-05 (κ)** — **grip-OSNAP unified SSoT: ο μηχανισμός του τοίχου = ΜΙΑ πηγή αλήθειας για κάθε
  δομική οντότητα (κολόνα · δοκός · θεμέλιο)** (υλοποίηση του «Επόμενου» της θ). Το grip-drag OSNAP ήταν
  γραμμένο **3 φορές** στο `mouse-handler-move` (generic cursor → wall face-corner → column corner, ως
  διαδοχικά mutating branches «ο τελευταίος γράφει») + μια **4η** στο `mouse-handler-up` (commit) + καθαρά
  στο draw path (`resolveColumnDrawSnap`). Συνέπειες: (1) κάθε νέος τύπος (δοκός/θεμέλιο) έπαιρνε μόνο το
  generic branch → ίδιο bug με την κολόνα· (2) το move απαιτούσε `isVisibleSnapMode`, το up **όχι** → σιωπηλό
  grid κούμπωνε στο commit → **preview≠commit**· (3) δύο handlers στα όρια 500 γρ. (N.7.1). **FIX (FULL SSoT,
  Giorgio):**
  - Κοινός priority resolver `resolveProjectedSnap(cursor, cornerProjection, findSnapPoint)` →
    `{ snapResult, ghostPoint, visible }` (ορατή γωνία > ορατό cursor > σιωπηλό) στο
    `systems/cursor/corner-projection-snap.ts`. Ο `resolveColumnDrawSnap` έγινε thin wrapper του (draw
    κρατά και τις σιωπηλές placement-έλξεις· grip δέχεται ΜΟΝΟ `visible`). **Μία** υλοποίηση priority.
  - Νέος `systems/cursor/grip-drag-snap-resolver.ts` — `resolveGripDragSnap(entities, grip, cursor,
    findSnapPoint, altMove)` (pure, κοινός move+up) + `publishGripSnap`/`clearGripSnap` (τα 3 κανάλια σε ΕΝΑ
    σημείο, αντικατέστησαν 3×copy-paste). Corner-source dispatch: τοίχος → `findWallFaceCornerSnap`· μέλος →
    νέο `bim/structural/member-grip-corner-snap.ts` `findMemberGripCornerSnap` (κολόνα/δοκός/θεμέλιο μέσω των
    ΙΔΙΩΝ `apply*GripDrag`+`compute*Geometry` SSoT που κάνει το commit). `findColumnGripCornerSnap` +
    `isColumnCornerSnapGrip` → re-export/wrapper (back-compat).
  - `mouse-handler-move.ts` (−~100 γρ.) & `mouse-handler-up.ts` (−~45 γρ.): οι 3+1 branches → **μία** κλήση
    `resolveGripDragSnap`, ίδιο RAW cursor σε preview & commit → **WYSIWYG εξ ορισμού**· διορθώνει το up
    visible-guard gap.
  - **Full scope:** δοκός & θεμέλιο έλκονται/δείχνουν snaps στο grip Alt-drag ΑΜΕΣΩΣ, με τον ίδιο μηχανισμό.
  Αρχεία: +`grip-drag-snap-resolver.ts`, +`bim/structural/member-grip-corner-snap.ts`, +tests·
  `corner-projection-snap.ts`, `column-placement-snap-context.ts`, `column-corner-snap.ts`,
  `mouse-handler-move.ts`, `mouse-handler-up.ts`. jest (στοχευμένα) GREEN. **ΟΧΙ tsc** (N.17). UNCOMMITTED.
  📌 cross-ref ADR-371 (wall face-corner) · ADR-398 (column body-corner) · ADR-561/562 (grip drag).

- **2026-07-05 (λ)** — **Η ΠΡΑΓΜΑΤΙΚΗ ρίζα (επιβεβαιωμένη από τον Giorgio, ΛΥΘΗΚΕ): η corner-projection
  δεχόταν γραμμικές construction-έλξεις και έπνιγε τη γωνία**. Runtime diagnostic (throttled log στον
  `resolveGripDragSnap`) απέδειξε ότι στην κολόνα Alt-move **ΟΛΑ έδουλευαν** (`altMove:true`, `hasAnchor:true`,
  `pickedVisible:true`, marker δημοσιευόταν, κανείς δεν το έσβηνε — ο scheduler bail-άρει σωστά). ΑΛΛΑ το
  `cornerMode` ήταν σχεδόν πάντα **`perpendicular`/`extension`**, σπάνια `bim_corner`. **ΡΙΖΑ:** το κοινό
  `findBestCornerProjection` δεχόταν ΚΑΘΕ ορατή έλξη — και τις γραμμικές construction (perpendicular/tangent/
  nearest/extension/parallel/ortho). Υπάρχουν σε **κάθε** ακμή, είναι πιο κοντά στην προβαλλόμενη γωνία, και
  πνίγουν το διακριτό `bim_corner` → η κολόνα «κολλούσε» αδύναμα σε τυχαίες καθέτους αντί να κουμπώνει
  **γωνία-σε-γωνία**. Ο τοίχος έμοιαζε να δουλεύει επειδή δουλεύει μέσω **cursorProbe** (ο κέρσορας πέφτει
  κατευθείαν στη γωνία-στόχο), όχι μέσω corner-projection (που στον τοίχο δεν τρέχει καν — το grip είναι
  `wall-corner-*`, όχι `wall-start/end`). **FIX (SSoT):** το `findBestCornerProjection` δέχεται πλέον **ΜΟΝΟ
  διακριτούς στόχους** (γωνία/άκρο/μέσο/τομή/κέντρο) — νέο `NON_CORNER_TARGET_MODES` set + `isCornerAlignmentTarget`
  guard στο `corner-projection-snap.ts`. Ο cursorProbe (ρητή πρόθεση κάτω από το σταυρόνημα) τα δέχεται ακόμη.
  Επηρεάζει κολόνα/δοκό/θεμέλιο + column draw· τον τοίχο ΟΧΙ. Το προσωρινό diagnostic αφαιρέθηκε. jest GREEN
  (57 tests). **ΟΧΙ tsc** (N.17). UNCOMMITTED.
- **2026-07-18 (Opus 4.8) — ⚠️ ΟΡΙΟΘΕΤΗΣΗ του «καμία πινακίδα»: ΔΕΝ αφορά το HUD ΜΗΚΟΣ/ΓΩΝΙΑ.**
  Ο Giorgio ζήτησε «ένδειξη απόστασης» στη ροή armed λαβής (ADR-513 §grip-parity Φάση Α). Το handoff το
  κατέγραψε ως **σύγκρουση** με την απόφαση της 2026-07-04 (γ). **ΔΕΝ ΕΙΝΑΙ.** Με στιγμιότυπο (210337) ο
  Giorgio διευκρίνισε: «ΔΕΝ θέλω πινακίδα — θέλω αυτές τις λευκές ενδείξεις που εμφανίζονται όταν
  δημιουργώ μια γραμμή», δηλαδή την **aligned διάσταση μήκους + `∠ γωνία`** που ζωγραφίζει ο
  `paintWallHudCore` υπό το status-bar toggle «ΜΗΚΟΣ/ΓΩΝΙΑ» (`isLengthAngleHudVisible()`).
  **Δύο ΔΙΑΦΟΡΕΤΙΚΕΣ ενδείξεις — μην τις μπερδέψεις:**
  · `drawDimPill` = **πινακίδα** (πλαίσιο-ταμπελάκι δίπλα στον κέρσορα) → **ΚΑΤΑΡΓΗΜΕΝΗ** από ΟΛΕΣ τις
    ροές μετακίνησης, όπως λέει η εγγραφή 2026-07-04 (γ). Η απόφαση **ΙΣΧΥΕΙ ΑΚΕΡΑΙΗ**.
  · `paintWallHud`/`paintWallHudCore` = το **live HUD μήκους/γωνίας** της σχεδίασης (ISO-129 aligned dim +
    ∠) → **ΕΠΙΤΡΕΠΤΟ και πλέον ΕΝΕΡΓΟ** και στη ροή armed λαβής. Το ίδιο το `length-angle-hud-gate.ts`
    ορίζει ρητά ως πεδίο εφαρμογής «κατά τη ΣΧΕΔΙΑΣΗ **και κατά το GRIP-DRAG/επεξεργασία**».
  **➡️ ΜΗΝ «διορθώσεις» τον `paintGripArmedDistanceHud` ως παράβαση του ADR-560.** Αν θέλεις να κρύψεις
  αυτές τις ενδείξεις, ο σωστός διακόπτης είναι το toggle «ΜΗΚΟΣ/ΓΩΝΙΑ» — όχι αφαίρεση κώδικα.

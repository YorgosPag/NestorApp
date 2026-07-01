# ADR-560 — Entity Body-Drag (Move / Ctrl-Copy)

- **Status**: ✅ IMPLEMENTED (UNCOMMITTED) — 2026-07-01
- **Category**: DXF Viewer — 2D Editing / Pointer Interaction
- **Related**: ADR-040 (preview canvas performance), ADR-357 (grip Copy toggle),
  ADR-363 §1G.5 (grip Alt move-from-point), ADR-466 (entity clipboard clone SSoT),
  ADR-049 (unified Move tool)

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
   live cursor από το frame· ζωγραφίζει WYSIWYG μεταφρασμένα αντίγραφα +
   rubber-band + dim pill + πράσινο «+» στο copy mode. ORTHO (F8) parity.
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
  - `systems/cursor/mouse-handler-up.ts` — commit emit + threshold
  - `hooks/tools/useEntityClipboard.ts` — reuse κοινού helper
  - `hooks/tools/useModifyTools.ts` — mount `useEntityBodyDragCommit`
  - `components/dxf-layout/canvas-layer-stack-tool-preview-mounts.tsx` +
    `canvas-layer-stack-preview-mounts.tsx` — ghost leaf mount
  - `systems/events/drawing-event-map.ts` — `entity-body-drag:commit` event type

## Verification

- **jest**: 16/16 (store arm/copy/clear/ESC, target resolver, clone-command split/translate).
- **browser** (εκκρεμεί): move κολόνας με σύρσιμο + Ctrl+Z· Ctrl+drag copy (νέα IDs,
  original μένει)· πολλαπλή επιλογή· drag σε κενό → lasso αμετάβλητο· τοίχος με opening
  → copy κρατά το opening (host rewire).

## Changelog

- **2026-07-01** — Αρχική υλοποίηση (move + Ctrl-copy body-drag). UNCOMMITTED.

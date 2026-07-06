# ADR-577 — Unified interactive COPY tool (ribbon «Αντιγραφή» + C+O, all entity types)

**Status:** ✅ IMPLEMENTED (UNCOMMITTED)
**Date:** 2026-07-06
**Domain:** DXF Viewer · Modify tools · Ribbon Home tab · Entity cloning SSoT
**Related:** ADR-363 (BIM Copy tool, superseded interactive path), ADR-466 (cross-floor clipboard, shares the clone SSoT), ADR-575 (GROUP composite), ADR-040 (canvas orchestration)

---

## Context

Η καρτέλα **Αρχική → Αντιγραφή** (`home-tab-modify.ts`, `commandKey: 'copy'`) στέλνει `onToolChange('copy')` → `setActiveTool('copy')`. **Κανένα hook δεν κατανάλωνε το `activeTool === 'copy'`** → το κουμπί ήταν **νεκρό**.

Η μόνη λειτουργική διαδραστική αντιγραφή AutoCAD-style (`useBimCopyTool`, `activeTool === 'bim-copy'`) ήταν προσβάσιμη **μόνο** από το chord **C+O** και είχε δύο περιορισμούς:

1. `BIM_COPY_TYPES` gate → δεχόταν **μόνο** BIM (wall/opening/slab/slab-opening/column/beam/stair).
2. `BimCopyCommand` → **σιωπηλά αγνοούσε** DXF geometry, groups, arrays, blocks.

Παράλληλα υπήρχε ήδη **ενοποιημένο clone SSoT** — `buildEntityCloneCommand` (BIM + DXF → `PasteEntitiesCommand`) — που χρησιμοποιούσαν το clipboard (Ctrl+V, ADR-466) και το Ctrl+drag body copy, αλλά **δεν ήταν συνδεδεμένο** με το διαδραστικό copy tool του ribbon.

## Decision

**ΕΝΑ ενοποιημένο copy tool** (`activeTool === 'copy'`) που αντιγράφει **κάθε** resolvable οντότητα μέσω του κοινού `buildEntityCloneCommand`, συνδεδεμένο **ΚΑΙ** στο ribbon κουμπί **ΚΑΙ** στο C+O. Το ξεχωριστό `'bim-copy'` tool id **αποσύρθηκε** (unified σε `'copy'`).

### Ροή (AutoCAD COPY, αμετάβλητη UX vs. το παλιό BIM copy)
```
idle → awaiting-base-point (activate με μη-κενή selection)
     → awaiting-target-point (μετά το base click)
     → clone selection κατά (target − base) → loop (continuous)
     → ESC → select
```
- Type gate: **κάθε** selected id που resolve-άρει σε live scene entity είναι copyable (DXF + BIM + group). Κενή/άκυρη → revert σε `select`.
- Commit: resolve ids → `SceneEntity[]` → `buildEntityCloneCommand(sources, delta, sm)` → `PasteEntitiesCommand` (BIM: kind-specific enterprise IDs + host rewire + fresh IFC GlobalId· DXF: id-swap· persistence ενσωματωμένη). **Μία διαδρομή clone, καμία απόκλιση** (N.0.2).

### Σύνθετες οντότητες (GROUP) — κεντρικοποίηση στο group SSoT
Το `build-entity-clone-command` DXF path χρησιμοποιούσε `applyEntityPreview`, που μεταφράζει **μόνο** top-level geometry → ένα group θα κλωνοποιούνταν με **α-μετάφραστα, id-colliding, ref-shared** members. Χειρισμός με **επαναχρησιμοποίηση SSoT** (N.0.2), όχι νέο helper:
- **Νέα SSoT στο group home** `systems/group/group-entity.ts`: `cloneGroupMemberDeep` (recursive deepClone + fresh id, χειρίζεται nested groups) + `cloneGroupEntity` (fresh container + fresh member ids). Το `ungroupGroup` **refactored** να μοιράζεται το `cloneGroupMemberDeep` → re-id logic σε **ΕΝΑ** σημείο.
- Μετάφραση κάθε member μέσω του canonical move SSoT `calculateMovedGeometry` (recursive).
- `build-entity-clone-command` group branch → `cloneGroupEntity(e)` + translate. **Καμία re-implementation** clone/re-id εδώ.

**Αποφεύχθηκε διπλότυπο**: πρώτη υλοποίηση είχε inline `reidGroupMembers` στο `bim/transforms/` (shallow spread, χωρίς deepClone → shared nested refs = bug)· αφαιρέθηκε υπέρ του group SSoT. Ωφελεί ΚΑΙ clipboard/Ctrl+drag ΚΑΙ ungroup/explode.

## Changes

| Αρχείο | Αλλαγή |
|--------|--------|
| `hooks/tools/useCopyTool.ts` | **ΝΕΟ** (rename από `useBimCopyTool.ts`). `activeTool === 'copy'`, gate = κάθε entity, commit → `buildEntityCloneCommand`. Handlers: `handleCopyClick`/`handleCopyEscape`. |
| `hooks/tools/useModifyTools.ts` | `useBimCopyTool`→`useCopyTool`, `bimCopyTool`→`copyTool`. |
| `components/dxf-layout/CanvasSection.tsx` | wiring `copyIsActive`/`handleCopyClick`/`handleCopyEscape`. |
| `hooks/canvas/useCanvasClickHandler.ts` (+ `canvas-click-types.ts`) | rename props. |
| `hooks/canvas/useCanvasKeyboardShortcuts.ts` (+ `.types.ts`) | rename props. |
| `hooks/canvas/useCanvasEscapeRegistrations.ts` | rename + escape id `'copy'`. |
| `systems/tools/tool-definitions.ts` | `'copy'` → `allowsContinuous: true`· αφαίρεση `'bim-copy'`. |
| `ui/toolbar/types.ts` | αφαίρεση `'bim-copy'` από `ToolType`. |
| `hooks/useDxfToolbarShortcuts.ts` | C+O → `'tool:copy'`. |
| `hooks/useDxfViewerState.ts` | `copy-selected` → `handleToolChange('copy')`. |
| `systems/group/group-entity.ts` | **+`cloneGroupMemberDeep`** (recursive deepClone+fresh id SSoT) **+`cloneGroupEntity`** (group copy); `ungroupGroup` refactored να το μοιράζεται. |
| `bim/transforms/build-entity-clone-command.ts` | GROUP branch → `cloneGroupEntity` (SSoT) + `calculateMovedGeometry` translate. Zero inline re-id. |
| tests | `useCopyTool.test.ts` (rewrite)· `build-entity-clone-command.test.ts` (+GROUP delegation)· `group-entity.test.ts` (+3 `cloneGroupEntity` cases). |

## Consequences / follow-ups

- `core/commands/entity-commands/BimCopyCommand.ts` **δεν χρησιμοποιείται πλέον** από κανέναν runtime consumer (μόνο το δικό του test). Υπερκεράστηκε από `PasteEntitiesCommand` μέσω `buildEntityCloneCommand`. Υποψήφιο για διαγραφή σε επόμενο Boy-Scout pass (knip αγνοεί το dxf-viewer → δεν σπάει ratchet).
- **ArrayEntity** (associative array, ADR-353): το `calculateMovedGeometry` δεν χειρίζεται `'array'`, άρα η αντιγραφή array κλωνοποιεί μόνο τον container (χωρίς μετάφραση των `hiddenSources`). Το ίδιο pre-existing κενό ισχύει και για clipboard/Ctrl+drag. **Follow-up**: array-specific clone (hiddenSources translate + re-id + instance rebuild) στο ίδιο SSoT.
- i18n hint keys: re-use των υπαρχόντων `dxf-viewer-guides:bimCopyTool.selectBasePoint/selectTargetPoint` (locale keys, γενικό νόημα· καμία JSON αλλαγή).

## Changelog
- **2026-07-06** — Αρχική υλοποίηση: ενοποίηση `bim-copy`→`copy`, ζωντάνεμα ribbon «Αντιγραφή», unified clone SSoT για DXF+BIM+GROUP.
- **2026-07-06** — **Fix (Giorgio live test: «κλειστή πολυγραμμή δεν αντιγράφεται»)**. Root cause: το `useCopyTool` (κληρονομιά bim-copy) έκανε **revert σε 'select'** όταν ενεργοποιούνταν χωρίς selection — το bim-copy δοκιμαζόταν ΜΟΝΟ via C+O (canvas focus διατηρεί selection)· το νέο ribbon κουμπί εκθέτει την περίπτωση. Fix: **mirror του `useMoveTool` FSM** — φάση `awaiting-entity` (κλικ περνά για επιλογή, ΠΟΤΕ silent revert) + `isCollectingInput` gate στο click routing (`CanvasSection` → click handler παίρνει `copyTool.isCollectingInput`, escape κρατά `isActive`). Η selection διαβάζεται **live** στο clone (όχι frozen snapshot). Επιπλέον: μια κλειστή πολυγραμμή είναι `type:'polyline'` (και τα δύο εργαλεία polyline/polygon) → μεταφράζεται σωστά από `applyClassicEntityPreview`.
- **Known gap (follow-up)**: το DXF translate στο `build-entity-clone-command` (`applyEntityPreview`→`applyClassicEntityPreview`) δεν έχει case για `rectangle`/`ellipse`/`polygon`/`lwpolyline` → clone πάνω στο πρωτότυπο. Πιθανή λύση: μετάβαση στο canonical move SSoT `calculateMovedGeometry` (καλύπτει rect/ellipse/polygon) + lwpolyline normalize.

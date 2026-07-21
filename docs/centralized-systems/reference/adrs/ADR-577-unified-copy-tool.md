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

## FSM centralization (2-click modify-tool activation SSoT)

Το activation-FSM invariant (activate→base/entity · deactivate→idle · selection-appeared→base · selection-lost→entity + `wasActive`/`prevCount` bookkeeping) ήταν hand-rolled σε ~15 tools. **NEW SSoT** `systems/tools/useModifyToolActivation.ts` — storage-agnostic (useState **ή** store via `setPhase`/`onDeactivate` callbacks)· tool-specific activate μέσω optional `onActivate` (typed-input restore / grip handoff)· deps = 3 primitives (isActive/selectionCount/phase), callbacks via ref → μηδέν extra re-run. **8 unit tests** (και τα 4 branches + override).

**✅ Migrated ΟΛΑ ΤΑ 5 (test-guarded, big-player consistent framework — Giorgio decision «όπως οι μεγάλοι παίκτες»):**
- `useCopyTool` (23 GREEN) — default activate.
- `useMoveTool` (+5 νέα tests) — overlays στο selectionCount· preview-clear σε κάθε transition.
- `useMirrorTool` (+5 νέα tests) — `onActivate` grip-handoff (pre-seed first axis → second-point).
- `useRotationTool` (+5 νέα tests) — `onActivate` grip-handoff (2 sub-cases: reference-vector→angle / pivot→reference).
- `useScaleTool` (+5 νέα tests) — **store-based** (`ScaleToolStore`)· `onActivate` grip-handoff + refresh selected-ids· `onDeactivate`=`store.reset()`.

**Behavior alignment (big-player consistency):** το shared hook έχει working selection-lost branch → Rotation (dead code) + Mirror (missing) + Scale (missing) πλέον **consistent**: deselect mid-command → επιστροφή σε entity-pick (ό,τι κάνουν Revit/C4D/Figma command frameworks — ΕΝΑ FSM, μηδέν per-tool divergence). Characterization tests locked το κάθε transition.

**ΕΚΤΟΣ (τεκμηριωμένα):** `useStretchTool` (partial — μόνο activate-if-selection+deactivate, no awaiting-entity· δεν εντάσσεται χωρίς behavior add)· Array×3 / Wall×4 (pick-based, όχι 2-click select-first).

**Εκκρεμεί (final step):** registry guard `.ssot-registry` module «forbid inline `wasActiveRef`+`prevEntityCountRef` modify-FSM στα hooks/tools» + `ssot:baseline`. **⚠️ ΑΝΑΘΕΩΡΗΣΗ (2026-07-06):** grep έδειξε ότι τα refs `wasActiveRef`/`prevEntityCountRef` υπάρχουν σε **13 tool files** (όχι μόνο stretch/array×3/wall×4 — και extend/trim/offset/chamfer/fillet + region-pick), δηλ. πολλά tools με activation-refs ΔΕΝ έχουν migrate-αριστεί ακόμη στο FSM SSoT. Ένας guard τώρα θα απαιτούσε allowlist 13+ αρχείων (≈ «όλα εκτός των 5 migrated») = θόρυβος με μηδενική ratchet-αξία. **Αναβάλλεται** μέχρι να migrate-αριστούν τα υπόλοιπα 2-click tools στο `useModifyToolActivation` (τότε ο allowlist συρρικνώνεται και ο guard γίνεται ουσιαστικός). Δικός του Plan pass.

## Scene-manager adapter SSoT (`getSceneManager` builder)

Το memoized «φτιάξε έναν `ISceneManager` για το τρέχον level» builder ήταν copy-pasted **byte-identical** σε **20 tool hooks**:

```ts
const getSceneManager = useCallback(() => {
  if (!levelManager.currentLevelId) return null;
  return createLevelSceneManagerAdapter(
    levelManager.getLevelScene, levelManager.setLevelScene, levelManager.currentLevelId);
}, [levelManager]);
```

μαζί με τον διπλότυπο τύπο `type LevelManagerLike = Pick<ReturnType<typeof useLevels>, 'getLevelScene'|'setLevelScene'|'currentLevelId'>` (16×).

**NEW SSoT** `systems/entity-creation/useSceneManagerAdapter.ts` — `useSceneManagerAdapter(levelManager): () => ISceneManager | null` (delegate στο ADR-527 cached factory· ίδιο null-guard, ίδιο `[levelManager]` dependency → byte-identical συμπεριφορά) + exported `SceneAdapterLevelManager` τύπος. Barrel export από `systems/entity-creation/index.ts`.

**Migrated 20 files** (17 memoized-`getSceneManager` idiom + 3 inline-adapter tools με ταυτόσημη `currentLevelId` σημασιολογία):
- 2-click modify tools: copy/move/mirror/rotation/scale/trim/stretch/offset/fillet/chamfer/extend/array.
- clipboard/body-drag: `useEntityClipboard`, `useEntityBodyDragCommit`.
- wall-pick: `useWallSplit/Merge/Attach/GapOpeningTool`.
- array variants: `useArrayPolarTool`, `useArrayPathTool`.
- Οι 16 «Pick» consumers → `SceneAdapterLevelManager` (ο διπλότυπος τύπος + το `import type { useLevels }` σβήστηκαν)· `useWallGapOpeningTool` κρατά `LevelsHookReturn` (χρειάζεται τον full hook για το `buildOpeningResolvers`) — ο SSoT δέχεται και τον superset.

**GUARD:** `.ssot-registry` tier-3 module `scene-manager-adapter-hook` (forbid inline `const getSceneManager = useCallback(`· ERE `const getSceneManager = useCallback\(`· allowlist = ο SSoT hook, μόνο για το doc-comment παράδειγμα). **dxf-viewer = 0-violation** (grep-verified). Golden fixture (shouldMatch/shouldSkip) προστέθηκε.

**Tests:** `useSceneManagerAdapter.test.ts` (6 GREEN: null-χωρίς-level / adapter-bound-to-level / ADR-527 singleton / memo-stability / rebuild-on-identity-change / live read-after-write). `test:ssot-suite` **233 GREEN** (registry-golden 66). Regression: useCopyTool + useMove/useScale activation + useSceneManagerAdapter = 39 GREEN. ΟΧΙ tsc (N.17).

## Changelog
- **2026-07-21 (δ) — ORTHO (F8) axis-lock στην Αντιγραφή (WYSIWYG, ίδιο SSoT με το Move)** — Ο Giorgio (screenshot `2026-07-21 134844.jpg`): με το **ΟΡΘΟ ON**, η «Αντιγραφή» **δεν κλείδωνε** — η κίτρινη rubber-band πήγαινε **διαγώνια** και το αντίγραφο προσγειωνόταν εκτός άξονα. **Root cause:** και τα δύο chokepoints ήταν **RAW** `cursor − base` (η προηγούμενη entry (α) το είχε φτιάξει σκόπιμα raw για WYSIWYG με το τότε-raw commit· έμεινε raw ενώ το Move είχε ήδη ORTHO). **SSoT audit (grep):** το ORTHO SSoT `applyOrthoToDelta` (`bim/grips/grip-move-constraints.ts` → `hardOrtho` dominant-axis, gated `cadToggleState.isOrthoOn()`, no-op όταν OFF) το χρησιμοποιεί **ήδη** το Move (tool+preview)· ο Καθρεπτισμός κλειδώνει με το αδερφάκι `orthoSnap` (ίδια dominant-axis μαθηματική οικογένεια) **και** στο preview **και** στο commit — **κανένα διπλότυπο δεν χρειάστηκε**. **Fix (επαναχρήση, N.18):**
  - `hooks/tools/useCopyTool.ts` (`handleCopyClick`, awaiting-target-point) — τύλιξη του delta με `applyOrthoToDelta` πριν το `buildEntityCloneCommand`.
  - `hooks/tools/useCopyPreview.ts` (`drawFrame`) — το destination = `translatePoint(base, applyOrthoToDelta(cursor − base))`· το **ΙΔΙΟ** SSoT με το commit → η rubber-band, το ghost και το κλωνοποιημένο αντίγραφο πέφτουν στο ίδιο σημείο (WYSIWYG invariant διατηρημένο, τώρα με ORTHO αντί raw). **AutoAlign εκτός scope** (ο Giorgio ζήτησε μόνο ORTHO)· αν μπει, θα μπει ΚΑΙ στα δύο.
  - `hooks/tools/__tests__/useCopyTool.test.ts` — **+2 tests** (ORTHO ON → κάθετο lock `{0,30}`· ORTHO OFF → raw diagonal `{20,30}`), οδηγώντας το κοινό `cadToggleState`. **25/25 GREEN.**
  - **Επιβεβαίωση κώδικα:** Μετακίνηση & Καθρεπτισμός έχουν ήδη ORTHO σε preview+commit (Move: `applyOrthoToDelta`· Mirror: `orthoSnap` gated `ortho||shift`) — δεν χρειάστηκαν αλλαγές· εκκρεμεί μόνο live επιβεβαίωση από τον Giorgio.
- **2026-07-21 (Live preview parity με το Move — «σε πραγματικό χρόνο»)** — Ο Giorgio ανέφερε ότι η «Αντιγραφή» **δεν είχε καμία οπτική ένδειξη** μεταξύ base-click και target-click: το commit εκτελούνταν κατευθείαν στο 2ο κλικ, χωρίς ghost, χωρίς κόκκινο σταυρό base-point, χωρίς κίτρινη διακεκομμένη rubber-band (σε αντίθεση με το Move που τα έχει όλα μέσω `useMovePreview`). **Root cause:** δεν υπήρχε `useCopyPreview` ούτε `CopyPreviewMount` — το `copyTool` περνούσε μόνο `handleCopyClick`/`isCollectingInput` στο canvas, ποτέ `phase`/`basePoint` σε preview mount. **Fix:**
  - **ΝΕΟ** `hooks/tools/useCopyPreview.ts` — twin του `useMovePreview` μέσω των ΙΔΙΩΝ SSoT painters (`drawMoveBasePointMarker` κόκκινος σταυρός, `drawRubberBandLine` κίτρινη διακεκομμένη, `drawRealEntityPreview` solid WYSIWYG clone). **Διαφορά από Move:** το πρωτότυπο μένει **SOLID** (η αντιγραφή διπλασιάζει, δεν μετακινεί → κανένα `movePreviewActive` dimming· ο renderer ζωγραφίζει το source solid γιατί το copy path ποτέ δεν θέτει το flag). Το delta είναι **RAW** `cursor − base` (χωρίς ORTHO/AutoAlign), byte-identical με το commit → WYSIWYG (preview ≡ committed clone).
  - `hooks/tools/useCopyTool.ts` — έκθεση `basePoint` στο `UseCopyToolReturn` (τροφοδοτεί το preview).
  - `canvas-layer-stack-tool-preview-mounts.tsx` — **+`CopyPreviewMount`** (React.memo, zero-jsx, δίπλα στο `MovePreviewMount`).
  - `canvas-layer-stack-preview-mounts.tsx` — mount του `CopyPreviewMount` στο `PreviewCanvasMounts` (`copy` payload, self-subscribed `selectedEntityIds`).
  - `canvas-layer-stack-types.ts` — **+`copyPreview: { phase, basePoint }`** στο `CanvasLayerStackProps`.
  - `CanvasLayerStack.tsx` / `CanvasSection.tsx` — pass-through `copyPreview={{ phase: copyTool.phase, basePoint: copyTool.basePoint }}`.
  - **Grips «εξαφανίζονται» σε ενεργό εντολή** (2ο σύμπτωμα Giorgio): επιβεβαιωμένα **by design** (AutoCAD parity, `dxf-canvas-renderer.ts:218-224` whitelist). Δεν πειράχτηκε — ο Giorgio συμφώνησε ότι η λύση είναι το ίδιο το live ghost (δείχνει τι κινείται/αντιγράφεται), όχι επαναφορά λαβών.
- **2026-07-21 (β) — ΠΡΟΣΩΡΙΝΟ armed-selection affordance: πορτοκαλί επιλογή σε ενεργή εντολή)** — Follow-up του Giorgio μετά το preview: ανακαλύφθηκε ότι το selection **δεν αλλάζει καθόλου χρώμα** — το `options.selected` δίνει phase `'normal'` στο `PhaseManager.determinePhase` (η γεωμετρία μένει στο `entity.color`)· το μόνο οπτικό cue επιλογής ήταν **τα ίδια τα grips**. Άρα όταν κρύβονται σε ενεργή εντολή, ο χρήστης δεν βλέπει **τίποτα**. **Λύση (προσωρινή, κατ' εντολή Giorgio):** μόλις armed ένα transform tool (Move/Copy/Rotate/Mirror) **με** selection **ΠΡΙΝ** το base point → οι επιλεγμένες βάφονται **πορτοκαλί** (`GRIP_ARMED_COLOR = '#FF6A00'`, ήδη «Giorgio's request»)· μόλις μπει η ghost-φάση (destination/target/angle/second-point) → επιστρέφουν στο ζωντανό χρώμα μετακίνησης. **Υλοποίηση:** νέο render phase `'armed-selected'` στον `PhaseManager` (`determinePhase` branch + `applyArmedSelectedStyle`), νέο flag `armedTransformHighlight` σε `RenderOptions` (rendering) + `DxfRenderOptions` (dxf-canvas), wired μέσω `DxfRenderer.renderSingleEntity` → `renderEntityUnified` και δύο selected passes στο `dxf-canvas-renderer.ts`· ο υπολογισμός (activeTool + phase-per-tool) ζει στο `CanvasLayerStack.dxfRenderOptionsBase` (twin του `movePreviewActive`, mutually exclusive με αυτό). Grips παραμένουν κρυμμένα (AutoCAD parity ανέπαφο). **✅ ΚΛΕΙΔΩΘΗΚΕ ως μόνιμο affordance** (Giorgio 2026-07-21: «μου αρέσει, το κλειδώνουμε, λειτουργεί σωστά»). Follow-up tweak: το πάχος μειώθηκε στο φυσικό weight της οντότητας (αφαιρέθηκε το `RENDER_LINE_WIDTHS.NORMAL` floor στο `applyArmedSelectedStyle`) — το χρώμα μόνο του φέρει το cue.
- **2026-07-21 (γ) — Επέκταση του armed-orange στους BIM renderers (τοίχοι/πλάκες/κολώνες/δοκάρια/ανοίγματα/σκάλες)** — Ο Giorgio: «οι οντότητες BIM δεν βάφονται πορτοκαλί όπως οι DXF». **Root cause:** οι 7 BIM renderers (`WallRenderer`/`ColumnRenderer`/`SlabRenderer`/`BeamRenderer`/`OpeningRenderer`/`SlabOpeningRenderer`/`StairRenderer`) καλούν μεν `applyPhaseStyle` (που βάζει το armed-orange stroke), αλλά αμέσως μετά **ξαναγράφουν** το `strokeStyle` με το category χρώμα, και το **fill (poché)** δεν περνά καθόλου από τον `PhaseManager` — έρχεται από `resolveBimBodyFill`/V-G tint. Άρα το flag έφτανε αλλά ήταν αόρατο. **Fix (SSoT, N.18):**
  - `bim/utils/bim-body-fill.ts` — **+`BIM_ARMED_BODY_FILL`** (`rgba(255,106,0,0.45)` = GRIP_ARMED_COLOR @ 45%, translucent ώστε να μένει ευανάγνωστη η γεωμετρία) **+`isArmedSelectedHighlight(options)`** (SSoT predicate) **+ optional `armedHighlight` param** στο `resolveBimBodyFill` (μία branch → όλοι οι renderers κληρονομούν πορτοκαλί poché).
  - Κάθε BIM renderer: (α) **fill** → armed ? orange poché : κανονικό (Column/Slab έχουν `topFacePlanFill` wrinkle → explicit ternary· Wall/Beam/SlabOpening → μέσω param· Stair → `vgFillTint` των treads), (β) **stroke** → guard το category-colour override με `&& !armed` ώστε να μείνει το πορτοκαλί που έβαλε ήδη το `applyPhaseStyle`. Το Stair δεν κάνει καν stroke override → το πορτοκαλί κληρονομείται δωρεάν, χρειάστηκε μόνο το tread fill.
  - **Καμία αλλαγή στο RenderOptions/pipeline** — το `armedTransformHighlight` ήδη ταξίδευε ως το κάθε BIM renderer (ADR-040 EntityRendererComposite περνά τα options αυτούσια)· έλειπε μόνο η per-renderer αντίδραση. 167 BIM-renderer tests πράσινα.
  - ⚠️ **Προϋπάρχον jscpd clone** `WallRenderer:143-160` ↔ `StairRenderer:106-132` (hover-halo + cut-state + applyPhaseStyle boilerplate) — **εκτός** των αλλαγών αυτού του commit (αποδεδειγμένο με `git diff -U0`)· το CHECK 3.28 diff είναι baseline-unaware → χρειάζεται `SKIP_JSCPD_DIFF=1` στο commit ή ξεχωριστό Boy-Scout de-dup pass.
- **2026-07-06 (Ctrl-copy ενωμένης lwpolyline — triage)** — Το `buildEntityCloneCommand` (DXF branch) μεταφράζει το clone μέσω `applyEntityPreview`· για raw `'lwpolyline'` (αποτέλεσμα JOIN) το `applyClassicEntityPreview` δεν είχε `case 'lwpolyline'` → το clone έμενε **στην αρχική θέση** (πάνω στο πρωτότυπο). **Fix:** προστέθηκε `case 'lwpolyline'` (keep-type) στο movesEntity switch → Ctrl+drag&drop σώματος δημιουργεί πλέον αντίγραφο σε νέα θέση. Το ghost (+πράσινο «+» cue) + το re-select των clones υπήρχαν ήδη. Βλ. ADR-561 changelog 2026-07-06.
- **2026-07-06** — Αρχική υλοποίηση: ενοποίηση `bim-copy`→`copy`, ζωντάνεμα ribbon «Αντιγραφή», unified clone SSoT για DXF+BIM+GROUP.
- **2026-07-06** — **Fix (Giorgio live test: «κλειστή πολυγραμμή δεν αντιγράφεται»)**. Root cause: το `useCopyTool` (κληρονομιά bim-copy) έκανε **revert σε 'select'** όταν ενεργοποιούνταν χωρίς selection — το bim-copy δοκιμαζόταν ΜΟΝΟ via C+O (canvas focus διατηρεί selection)· το νέο ribbon κουμπί εκθέτει την περίπτωση. Fix: **mirror του `useMoveTool` FSM** — φάση `awaiting-entity` (κλικ περνά για επιλογή, ΠΟΤΕ silent revert) + `isCollectingInput` gate στο click routing (`CanvasSection` → click handler παίρνει `copyTool.isCollectingInput`, escape κρατά `isActive`). Η selection διαβάζεται **live** στο clone (όχι frozen snapshot). Επιπλέον: μια κλειστή πολυγραμμή είναι `type:'polyline'` (και τα δύο εργαλεία polyline/polygon) → μεταφράζεται σωστά από `applyClassicEntityPreview`.
- **2026-07-06** — **Scene-manager adapter SSoT**: εξαγωγή `useSceneManagerAdapter` (`systems/entity-creation/`), migration **20 tool hooks** (+ ενοποίηση διπλότυπου `LevelManagerLike` → `SceneAdapterLevelManager`), registry guard `scene-manager-adapter-hook` (0-violation) + golden fixture + 6 unit tests. `test:ssot-suite` 233 GREEN. Ο FSM-refs guard αναβλήθηκε (13 tools με activation-refs ακόμη un-migrated — βλ. §FSM centralization).
- **Known gap (follow-up)**: το DXF translate στο `build-entity-clone-command` (`applyEntityPreview`→`applyClassicEntityPreview`) δεν έχει case για `rectangle`/`ellipse`/`polygon`/`lwpolyline` → clone πάνω στο πρωτότυπο. Πιθανή λύση: μετάβαση στο canonical move SSoT `calculateMovedGeometry` (καλύπτει rect/ellipse/polygon) + lwpolyline normalize.

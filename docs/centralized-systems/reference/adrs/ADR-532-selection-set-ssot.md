# ADR-532 — Selection-set SSoT: zero-React `SelectedEntitiesStore`

**Status:** ✅ APPROVED (Stage A υλοποιημένο + 22/45 jest GREEN, behavior-identical· Stage B/C pending)
**Date:** 2026-06-25
**Domains:** systems/selection (entity selection SSoT), perf (re-render cascade)
**Related:** ADR-040 (preview/cursor perf — dual-access micro-leaf invariant, ΕΠΕΚΤΕΙΝΕΤΑΙ εδώ στο
selection set), ADR-030 (universal selection). Συνέχεια του
`HANDOFF_2026-06-25_selection-cascade-and-always-mounted-dialogs.md` (#2).

---

## 1. Context / Problem

Κάθε **κλικ-επιλογή** οντότητας προκαλούσε ένα ~122ms commit (dev· ~15-25ms prod). Ρίζα: το
entity selection set ζούσε σε **React Context** (`useSelectionSystemState` → `SelectionContext`).
Κάθε dispatch → νέο `state` (reducer spread) → το `universalActions` memo re-fire (dep
`[state.universalSelection]`, **ΠΑΝΤΑ νέος `Map`**) → νέο `contextValue` → το `useUniversalSelection()`
(`useMemo([context])`) επέστρεφε **νέο object κάθε dispatch** → **κάθε `useContext(SelectionContext)`
consumer re-render-άρει**. Οι 4 ακριβοί (cascade ολόκληρα subtrees): `DxfViewerContent`,
`CanvasSection`, `FloatingPanelsSection`, `useKeyboardShortcuts`. Επιπλέον τα query methods
(`getSelectedEntityIds()`/`getPrimaryId()`) ήταν inline closures `Array.from().filter().map()` →
**νέος πίνακας κάθε κλήση** → έσπαγαν downstream memos (χειρότερο: `useActiveContextualTrigger`
O(selectedIds × scene.entities)).

**Το React Context ΔΕΝ υποστηρίζει selectors** — ο μόνος τρόπος να σταματήσουν να re-render-άρουν οι
orchestrators είναι μετάβαση του selection set σε `useSyncExternalStore` store (το ADR-040 pattern).

## 2. Decision

`SelectedEntitiesStore` (`systems/selection/SelectedEntitiesStore.ts`) = **ο μοναδικός SSoT** για το
entity selection set (`Map<string, SelectionEntry>` + `primaryId`). Zero-React mutable singleton,
mirror του `systems/hover/HoverStore.ts` + `systems/cursor/ImmediateTransformStore.ts`. **Δεν** υπάρχει
generic factory — κάθε store hand-rolls subscribe/getSnapshot/setter (συνειδητή επιλογή ADR-040).

**Dual-access invariant (επέκταση ADR-040):**
- **Orchestrators** διαβάζουν imperatively (`SelectedEntitiesStore.getSelectedEntityIds()` /
  `getPrimaryId()` / `isSelected()`) σε event-time — **ΠΟΤΕ** subscription.
- **ΜΟΝΟ leaf components** που δείχνουν οπτικά την επιλογή subscribe μέσω
  `useSelectedEntities.ts` (`useSelectedEntityIds`, `usePrimarySelectedId`, `useIsSelected`,
  `useSelectionByType`, `useSelectionCount` — `useSyncExternalStore`).

**Reference-stable snapshots (κρίσιμο):** κάθε mutation ξαναχτίζει τα cached derived (`cachedDxfIds`,
`cachedByType`, …) **μία φορά**· οι getters επιστρέφουν την cached αναφορά → το `getSnapshot` είναι
reference-stable (αλλιώς `useSyncExternalStore` infinite-loop). Κενό → ένα frozen `EMPTY`.
boolean/number snapshots (`useIsSelected`/`useSelectionCount`) value-stable.

**Legacy mirror — store-owned sink (single write path, Stage B):** κάθε store mutator υπολογίζει
`LegacyMirror` (`regionIdsChanged`/`regionIds`/`resetEditing`) και καλεί ο ίδιος (μέσω `applyAndReturn`)
τον **provider-registered sink** (`SelectedEntitiesStore.registerLegacySink`). Ο provider
(`useSelectionSystemState`) κάνει register **μία φορά** ένα callback που — guard `NO_MIRROR` skip —
dispatch-άρει `SYNC_UNIVERSAL_LEGACY` → ο reducer κρατά το legacy `selectedRegionIds` (overlay-only
projection) + region-edit flags ακριβώς όπως τα παλιά UNIVERSAL_* cases. Έτσι **ΚΑΘΕ** write path —
action wrapper Ή orchestrator που καλεί `SelectedEntitiesStore.X()` **imperatively** — εφαρμόζει το ίδιο
mirror (zero staleness, ο orchestrator mutate-άρει χωρίς React). `toggleEntity` delegate-άρει σε
add/deselect → fire-once (όχι double-dispatch). Ο reducer ΔΕΝ κρατά πια το Map (μία πηγή). Τα
`context.universalSelection` / `context.primarySelectedId` = **live getters** στον store (back-compat
για raw-Map readers, π.χ. `useDxfViewerEffects`).
> Stage A ιστορικό: το mirror το εφάρμοζε το `useSelectionActions.applyMirror` (ένα dispatch ανά action)·
> Stage B το μετέφερε **μέσα στον store** (sink) ώστε οι orchestrators να mutate-άρουν imperatively.

## 3. Σταδιακή υλοποίηση

- **Stage A (DONE, behavior-identical):** store + leaf hooks + jest· `useUniversalSelection()` =
  ref-stable compat object που subscribe-άρει στο store **version** (`useSyncExternalStore`) ώστε οι
  υπάρχοντες consumers να re-render-άρουν όπως πριν (μηδέν staleness). Universal actions → store +
  legacy mirror. `replaceEntitySelection` = atomic + skip-if-unchanged (σπάει feedback loops 3D
  bridge / layer-select). **Μηδέν perf win ακόμη** — απλώς η βάση.
- **Stage B (IN PROGRESS — πιάνει το 122ms):** οι 4 orchestrators σταματούν να subscribe-άρουν →
  imperative store reads + τα children-leaves subscribe.
  - **B0 (DONE):** store-owned legacy sink (`registerLegacySink`/`applyAndReturn`) — ο store εφαρμόζει
    το mirror, ώστε οι orchestrators να mutate-άρουν imperatively. `useSelectionActions` drop `applyMirror`.
  - **B1 (DONE):** `useKeyboardShortcuts` — drop dead subscription· event-time
    `SelectedEntitiesStore.getSelectedEntityIds()` στον keydown· listener register-άρεται μία φορά
    (όχι ανά επιλογή).
  - **B2 (DONE):** `FloatingPanelsSection` → `useSelectionByType('overlay')` (re-render μόνο σε overlay
    change)· mutations direct στον store.
  - **B3 (DONE):** `useActiveContextualTrigger` O(N×M) → O(N+M) με local `Map<id,entity>` index
    (`useMemo([currentScene])`, αντικατάσταση 3 `.find()`)· διατήρηση `crossLevelEntities` fallback.
  - **B4 (DONE — 6B):** `CanvasSection` **έπαψε** να subscribe-άρει στο selection set
    (`useUniversalSelection()` → **`useUniversalSelectionStable()`**, νέο non-reactive facade πάνω στο
    ίδιο `buildUniversalSelection` SSoT — δεν κάνει `useSyncExternalStore(version)`). Το `selectedEntityIds`
    διαβάζεται **fresh κάθε render** από `SelectedEntitiesStore.getSelectedEntityIds()` (reference-stable
    `cachedDxfIds` → τα modify-tool memos δεν thrash-άρουν). Κατανομή consumers:
    - **Render → leaves (`useSelectedEntityIds`):** grips → `DxfCanvasSubscriber` (inject στο renderOptions·
      `dxfRenderOptionsBase` έχασε το `selectedEntityIds`)· Move/Rotate/Mirror ghosts → `PreviewCanvasMounts`
      (self-subscribe)· `PropertiesPalette` (self-subscribe, drop prop)· crosshair `isEntitySelected` →
      event-time `isStoreSelected(id)` στον Shell (6C-safe, όχι hook). `entityState` prop **αφαιρέθηκε**.
    - **Entity menu → NEW `EntityContextMenuHost` leaf** (`useSelectedEntityIds` + `computeEntityJoinState`
      SSoT + `useEntityLayerCommands`)· ο `entityJoinHook` είναι selection-agnostic (ids ως args).
    - **Grip hit-test → NEW `AllGripsStore` + `GripRegistryPublisher` leaf:** ο publisher subscribe-άρει
      selection+scene, τρέχει `useGripRegistry` και δημοσιεύει· το `useUnifiedGripInteraction` έγινε
      **selection-agnostic** (drop `selectedEntityIds`/`dxfScene`/`useGripRegistry`) — οι handlers διαβάζουν
      `AllGripsStore.get()` at event time· το reset-on-selection-change → `subscribeSelection` (no-op
      bailout όταν δεν υπάρχει ενεργό grip session → δεν re-render-άρει). Ο `ArmableGripsStore` publish
      μετακόμισε στον publisher.
    - **Event-time → store reads:** `useCanvasContextMenu`/`useCanvasEscapeRegistrations` (ESC deselect)/
      `useCanvasKeyboardShortcuts` (PageUp/Down reorder + `J` join — `canEntityJoin` έγινε getter)/
      `useCanvasEditActions` (`handleReorderEntity`· dropped dead `entityJoinState` snapshot) διαβάζουν
      `SelectedEntitiesStore.getSelectedEntityIds()` στο event. `useSmartDelete`/`useCanvasClickHandler`
      ήταν ήδη event-time (ref/facade). Boy-scout: αφαιρέθηκε το **dead** `entityJoin` prop του Shell.
  - **B5 (DONE — 6D):** το `DxfViewerContent` **έπαψε** να subscribe-άρει στο selection set
    (`useUniversalSelection()` αφαιρέθηκε). Όλοι οι reactive consumers μετακινήθηκαν σε leaf hosts που
    subscribe-άρουν μόνοι τους + οι event-time consumers διαβάζουν τον store imperatively:
    - `DxfViewerTopBar` → **self-subscribe** (`useUniversalSelection()`) + owns το `useDxfViewerRibbon`
      (contextual trigger + 30+ bridges + 28 PersistenceHosts παίρνουν `primarySelectedId` εδώ).
    - NEW `SelectionSideEffectsHost` (render null, leaf) → subscribe `useSelectedEntityIds()`+
      `usePrimarySelectedId()`· τρέχει τα 2 selection-driven effects (auto-expand levels-panel +
      auto-activate-layering· το `context.universalSelection.get(primary)` → `getMap().get(primary)`).
    - `SidebarSection` → `usePrimarySelectedId()`· `DxfViewerDialogs` → NEW `BimScheduleHostLeaf`
      (`useSelectedEntityIds()`, ώστε το portal-tree των 28 hosts να ΜΗΝ re-render-άρει στην επιλογή).
    - Event-time → store reads: `useDxfViewerCallbacks` (organism.*/dim.*/nudge/handleRegionClick·
      drop params `selectedEntityIds`+`universalSelection`)· `useDxfViewerEffects` (`dxf.highlightByIds`
      bus· drop selection params)· `useLayerCommandShortcuts` (keydown read· drop param)·
      `DxfViewerContent` (`wrappedHandleToolChange`→`clearAll()`, `onOverlaySelect`→store,
      `wrappedState.selectedEntityIds`→non-reactive snapshot).
- **Stage C (pending — full SSoT retire):** ~21 leaf widgets → granular hooks· bridges inject store·
  αφαίρεση των (νεκρών) universal cases· απόφαση για το legacy `selectedRegionIds`.

## 4. Consequences

- (+) Η αλλαγή επιλογής re-render-άρει ΜΟΝΟ τα leaves που δείχνουν επιλογή (μετά Stage B) — όχι
  orchestrators· τέλος του 122ms cascade.
- (+) Μία πηγή αλήθειας για το selection set· event-time reads χωρίς React.
- (−) Νέο store ζει εκτός React lifecycle → πρέπει `_resetForTests()` στα jest (provided).
- ⚠️ `SelectedEntitiesStore` ≠ `cursor/SelectionStore.ts` (marquee/lasso rubber-band — άσχετο).

## 5. Files

**NEW:** `systems/selection/SelectedEntitiesStore.ts`, `systems/selection/useSelectedEntities.ts`,
`systems/selection/__tests__/SelectedEntitiesStore.test.ts` (16),
`systems/selection/__tests__/useSelectedEntities.test.tsx` (6).
**MOD (Stage A):** `systems/selection/{SelectionSystem.tsx, useSelectionActions.ts,
useSelectionSystemState.ts, useSelectionReducer.ts, index.ts}`.
**MOD (Stage B0–B3):** `systems/selection/{SelectedEntitiesStore.ts (sink), useSelectionActions.ts
(drop applyMirror), useSelectionSystemState.ts (register sink)}`, `hooks/useKeyboardShortcuts.ts`,
`layout/FloatingPanelsSection.tsx`, `app/ribbon-contextual-config.ts`.
**NEW test (Stage B0):** `systems/selection/__tests__/selection-legacy-mirror.test.tsx` (4) +
sink describe-block στο `SelectedEntitiesStore.test.ts`.
**NEW (Stage B5):** `app/SelectionSideEffectsHost.tsx` (null-rendering leaf· 2 selection-driven effects).
**MOD (Stage B5):** `app/{DxfViewerContent.tsx (drop subscription· event-time store reads· render
SelectionSideEffectsHost· top-bar/dialogs/sidebar props slimmed), DxfViewerTopBar.tsx (self-subscribe +
owns useDxfViewerRibbon), DxfViewerDialogs.tsx (BimScheduleHostLeaf), useDxfViewerCallbacks.ts,
useDxfViewerEffects.ts}`, `layout/SidebarSection.tsx`, `hooks/useLayerCommandShortcuts.ts`.

**NEW (Stage 2):** `ui/ribbon/context/RibbonContextualTabContext.tsx` (ui-layer trigger context +
`useRibbonContextualTrigger` leaf hook), `app/RibbonContextualTabScope.tsx` (app-layer scope:
self-subscribes selection + `useActiveContextualTrigger`, provides trigger).
**MOD (Stage 2):** `ui/ribbon/components/RibbonRoot.tsx` (split shell `RibbonRootInner` + leaf
`RibbonTabsRegion`· drop `activeContextualTrigger` prop), `ui/ribbon/components/RibbonBody.tsx`
(`React.memo`), `app/useDxfViewerRibbon.ts` (drop trigger compute + `primarySelectedId`/
`selectedEntityIds`/`currentScene` params + `activeContextualTrigger` return),
`app/DxfViewerTopBar.tsx` (wrap RibbonRoot in scope· drop `useSelectedEntityIds`).

**NEW (Stage B4):** `systems/grip/AllGripsStore.ts` (zero-React grip-set SSoT),
`components/dxf-layout/GripRegistryPublisher.tsx` (selection-subscribed registry leaf),
`components/dxf-layout/EntityContextMenuHost.tsx` (selection-subscribed entity-menu leaf),
`hooks/canvas/entity-join-state.ts` (join-state SSoT helper).
**MOD (Stage B4):** `systems/selection/{SelectionSystem.tsx (buildUniversalSelection extract +
useUniversalSelectionStable), index.ts}`· `components/dxf-layout/{CanvasSection.tsx (drop subscription·
stable facade· fresh store read· render publisher), CanvasLayerStack.tsx (drop entityState/entityJoin·
leaf-injected selectedEntityIds· crosshair isStoreSelected), canvas-layer-stack-leaves.tsx
(DxfCanvasSubscriber subscribes), canvas-layer-stack-preview-mounts.tsx (self-subscribe),
canvas-layer-stack-types.ts (drop entityState/entityJoin), CanvasSectionOverlays.tsx (EntityContextMenuHost·
PropertiesPalette prop slim)}`· `systems/properties/PropertiesPalette.tsx (self-subscribe)`·
`hooks/grips/{useUnifiedGripInteraction.ts (selection-agnostic· AllGripsStore reads· subscribeSelection
reset), unified-grip-types.ts (drop params)}`· `hooks/canvas/{useCanvasEditActions.ts, useCanvasContextMenu.ts,
useCanvasKeyboardShortcuts.ts(+.types), useCanvasEscapeRegistrations.ts}` (event-time store reads).

## Changelog
- **2026-06-28** — Stage 2 (Opus 4.8): **ribbon contextual trigger → leaf subscription** (root #2,
  βήμα 2· συνέχεια του Stage B6/Stage 1). Stage 1 έκανε σταθερό το `ribbonCommands`, αλλά το
  `activeContextualTrigger` ΕΜΕΝΕ prop του `RibbonRoot` → άλλαζε σε κάθε επιλογή → έσπαγε το
  `React.memo` → re-render όλου του ribbon shell + `RibbonCommandProvider` + tab body (τα ~96 ribbon
  fibers + ~300 tooltips του profile). FIX (ADR-040 micro-leaf doctrine, μηδέν νέα store — context
  routing): ο trigger φεύγει από τα props του `RibbonRoot` και περνά μέσω **νέου ui-layer context**
  (`ui/ribbon/context/RibbonContextualTabContext.tsx`) που τον τροφοδοτεί ένα **νέο app-layer scope**
  (`app/RibbonContextualTabScope.tsx`, self-subscribe `usePrimarySelectedId`/`useSelectedEntityIds` +
  `useActiveContextualTrigger` SSoT). Μέσα στο `RibbonRoot`, νέο leaf `RibbonTabsRegion` = ο ΜΟΝΑΔΙΚΟΣ
  consumer (`useRibbonContextualTrigger()`) που κρατά τα `visibleContextualTabs`/`orderedTabs`/`activeTab`
  + τον auto-activate effect + `RibbonTabBar`/`RibbonBody`· το `useRibbonState`/`useRibbonTabDrag` μένουν
  στο shell (`RibbonRootInner`) και περνούν ως σταθερά props. ΑΠΟΤΕΛΕΣΜΑ: σε click-select τα props του
  `RibbonRoot` μένουν reference-stable → `React.memo` ΚΡΑΤΑΕΙ → shell + command provider ΔΕΝ
  re-renderάρουν· αντιδρά ΜΟΝΟ το `RibbonTabsRegion` και ΜΟΝΟ όταν αλλάζει πραγματικά το trigger string
  (string identity → ο React παρακάμπτει τους context consumers όταν η τιμή είναι ίδια). Boy-scout:
  `RibbonBody` → `React.memo` (skip body subtree όταν το `activeTab` object μένει ίδιο — π.χ. trigger
  flip πριν τρέξει ο auto-activate effect· command/visibility updates ρέουν ακόμη μέσω context). Το
  `useDxfViewerRibbon` έχασε τα params `primarySelectedId`/`selectedEntityIds`/`currentScene` + το
  `activeContextualTrigger` return· το `DxfViewerTopBar` έχασε το `useSelectedEntityIds` sub (κρατά
  `usePrimarySelectedId` για τους 28 hosts). 7 αρχεία (2 NEW), type-clean. Δεν γίνεται jest-verify
  (TopBar render σε jsdom τραβά Firestore/auth· κανένα υπάρχον test δεν αγγίζει RibbonRoot/Body).
  **🔴 browser-verify (React-DevTools Profiler: στο click-select το `RibbonRoot`/`RibbonRootInner`/
  `RibbonCommandProvider`/`RibbonBody` ΟΧΙ updaters — μόνο το `RibbonTabsRegion` όταν εμφανίζεται/αλλάζει
  contextual tab· λειτουργικά: select τοίχο→καρτέλα «Τοίχος», widgets σωστά, dialogs ανοίγουν)** +
  commit (Giorgio). Επόμενο → Stage 3 (`DxfViewerDialogs`, 117 dialog fibers).
- **2026-06-28** — Stage A-fix (Opus 4.8): **idempotent `SYNC_UNIVERSAL_LEGACY` reducer**. Chrome
  trace (`Trace-20260628T012423`, dev) έδειξε ότι ένα dxf-entity κλικ προκαλεί τεράστιο σύγχρονο React
  commit· root #1 = ο reducer επέστρεφε `{ ...state }` (νέα αναφορά) σε **ΚΑΘΕ** dxf-click ακόμα κι όταν
  τίποτα δεν άλλαζε (regionIds omitted· resetEditing:true με τα edit-flags ήδη null) → memoized
  `SelectionContext` value rebuild → re-render ΟΛΩΝ των `useContext(SelectionContext)` consumers χωρίς
  λόγο. FIX: το case υπολογίζει next region/edit/drag και **επιστρέφει το ίδιο `state`** όταν δεν αλλάζει
  τίποτα· νέο object μόνο σε πραγματική αλλαγή (π.χ. edit-flag null-ισμα από μη-null). +1 jest
  (`selection-legacy-mirror`: 5/5 GREEN). **ΕΚΚΡΕΜΕΙ root #2 (το βαρύ, ~1015ms commit):** το ribbon
  assembly (μεταφερμένο στο `DxfViewerTopBar` self-subscriber στο Stage B5) ξαναχτίζει 30+ BIM bridges
  → νέο `ribbonCommands` → σπάει το `React.memo` του `RibbonRoot` → re-render όλου του ribbon+tooltips
  σε κάθε επιλογή.
- **2026-06-28** — Stage B6 (Opus 4.8): **ribbon command tree decoupled από το selection reference**
  (root #2, Stage 1). Το `DxfViewerTopBar` τράβαγε το reactive `useUniversalSelection()` (νέα αναφορά
  σε κάθε click) και την περνούσε στον ribbon assembler → 30+ BIM bridges ξαναχτίζονταν → νέο
  `ribbonCommands` → έσπαγε το `React.memo` του `RibbonRoot`. FIX (ADR-040 micro-leaf doctrine, μηδέν
  νέα υποδομή — reuse Stage B4): `useUniversalSelectionStable()` (reference-stable facade· τα query
  methods διαβάζουν `SelectedEntitiesStore` live σε event-time, οπότε τα bridges κρατούν σταθερά
  `useCallback` deps → `ribbonCommands` memo holds → RibbonRoot memo ΔΕΝ σπάει) + reactive
  `usePrimarySelectedId()`/`useSelectedEntityIds()` ΜΟΝΟ για όσα ΠΡΕΠΕΙ να ακολουθούν την επιλογή
  (contextual-tab trigger + BIM persistence hosts). Type-clean (`UniversalSelectionHook`/`string|null`/
  `string[]`), 1 αρχείο. Δεν γίνεται jest-verify (TopBar render σε jsdom τραβά Firestore/auth).
  **🔴 browser-verify (React-DevTools: στο click-select το `RibbonRoot`/`RibbonPanel`/buttons ΟΧΙ
  updaters — μόνο το contextual-tab area)**· αν παραμένει βαρύ → Stage 2 = το `activeContextualTrigger`
  γίνεται leaf-subscription ΜΕΣΑ στο RibbonRoot ώστε το `RibbonRootInner` να μη re-renderάρει το
  `RibbonBody` (active-tab buttons) σε κάθε επιλογή. + commit (Giorgio).
- **2026-06-27** — Stage B4 (Opus 4.8): **`CanvasSection` severance (6B)** — ο canvas orchestrator
  έπαψε να subscribe-άρει στο selection set. NEW `useUniversalSelectionStable()` (non-reactive facade,
  ίδιο `buildUniversalSelection` SSoT)· `selectedEntityIds` = fresh ref-stable `SelectedEntitiesStore`
  read. Render consumers → leaves (`DxfCanvasSubscriber` grips· `PreviewCanvasMounts` ghosts·
  `PropertiesPalette`· NEW `EntityContextMenuHost`)· crosshair → `isStoreSelected` event-time. Grip
  hit-test → NEW `AllGripsStore` + NEW `GripRegistryPublisher` leaf· `useUnifiedGripInteraction` έγινε
  selection-agnostic (event-time `AllGripsStore.get()`· reset via `subscribeSelection` με no-op bailout).
  Event-time hooks (context-menu/escape/keyboard-join+reorder/edit-actions) → `SelectedEntitiesStore`
  reads· `canEntityJoin` → getter. NEW SSoT `entity-join-state.ts` (reused από orchestrator-removal +
  leaf). Boy-scout: dropped dead Shell `entityJoin` prop· dropped dead `entityJoinState` snapshot. 6B/6D
  files staged με ADR-040 + αυτό. Δεν γίνεται jest-verify (render σε jsdom τραβά Firestore/auth)·
  62/62 selection + 132/133 grip jest GREEN (το 1 fail = pre-existing άσχετο MEP commit mock, shared
  tree ADR-527). N.17: 4 tsc άλλων agents έτρεχαν → skip full tsc. 🔴 browser-verify (React-DevTools:
  `CanvasSection` ΟΧΙ updater σε κλικ-επιλογή· grips/menu/palette/move-ghost/keyboard/ESC λειτουργικά) +
  commit (Giorgio). Stage C pending.
- **2026-06-25** — Stage B5 (Opus 4.8): **`DxfViewerContent` severance** — ο orchestrator έπαψε να
  subscribe-άρει στο selection set (`useUniversalSelection()` αφαιρέθηκε), τέλος του per-click cascade
  που ξανάτρεχε ~40 `useStructural*` hooks. Reactive consumers → leaf hosts (`DxfViewerTopBar`
  self-subscribe + owns ribbon assembly· NEW `SelectionSideEffectsHost` για τα 2 selection-driven
  effects· `SidebarSection` `usePrimarySelectedId()`· `DxfViewerDialogs` NEW `BimScheduleHostLeaf`).
  Event-time consumers → imperative `SelectedEntitiesStore` reads (`useDxfViewerCallbacks`/
  `useDxfViewerEffects`/`useLayerCommandShortcuts`/`wrappedHandleToolChange`/`onOverlaySelect`).
  Boy-scout: dropped dead `selectionIdSet` return. 6D files (`DxfViewerContent`/`useDxfViewerEffects`)
  staged με αυτό το ADR. Δεν γίνεται jest-verify (render σε jsdom τραβά Firestore/auth). 🔴
  browser-verify (React-DevTools: `DxfViewerContent` ΟΧΙ updater σε κλικ) + commit (Giorgio). B4
  (CanvasSection — 6B) PENDING.
- **2026-06-25** — Stage B0–B3 (Opus 4.8): store-owned legacy sink (orchestrators mutate imperatively
  χωρίς staleness)· `useKeyboardShortcuts` event-time read (zero subscription)· `FloatingPanelsSection`
  overlay-only sub· `useActiveContextualTrigger` O(N×M)→O(N+M) με entity index. +8 jest GREEN
  (5 sink + 4 mirror round-trip· `selection-legacy-mirror.test.tsx` + sink block). 6D files staged με
  αυτό το ADR. B4/B5 (CanvasSection + DxfViewerContent leaf-push, το perf-critical) PENDING —
  χρειάζονται React-DevTools profiling στο browser. 🔴 browser-verify + commit (Giorgio).
- **2026-06-25** — Stage A (Opus 4.8): foundation store + hooks + compat-hook rewrite + reducer slim
  (Map→store, `SYNC_UNIVERSAL_LEGACY`). 22 new jest + 45 selection-suite GREEN. Behavior-identical.
  🔴 browser-verify (baseline ~122ms profile· κλικ ίδιο) + commit (Giorgio). Stage B/C pending.

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
  - **B4 (PENDING — 6B):** `CanvasSection` drop subscription → store getters + push του reactive
    `selectedEntityIds` σε canvas leaf· stable inputs σε `useOverlayLayers`/`useCanvasContextMenu`/
    `useUnifiedGripInteraction`.
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

## Changelog
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

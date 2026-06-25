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

**Legacy mirror (single write path A1):** κάθε store mutator επιστρέφει `LegacyMirror`
(`regionIdsChanged`/`regionIds`/`resetEditing`). Το `useSelectionActions` το εφαρμόζει με **ΕΝΑ**
dispatch `SYNC_UNIVERSAL_LEGACY` → ο reducer κρατά το legacy `selectedRegionIds` (overlay-only
projection) + region-edit flags ακριβώς όπως τα παλιά UNIVERSAL_* cases. Ο reducer ΔΕΝ κρατά πια το
Map (μία πηγή). Τα `context.universalSelection` / `context.primarySelectedId` είναι **live getters**
στον store (back-compat για τους λίγους raw-Map readers, π.χ. `useDxfViewerEffects`).

## 3. Σταδιακή υλοποίηση

- **Stage A (DONE, behavior-identical):** store + leaf hooks + jest· `useUniversalSelection()` =
  ref-stable compat object που subscribe-άρει στο store **version** (`useSyncExternalStore`) ώστε οι
  υπάρχοντες consumers να re-render-άρουν όπως πριν (μηδέν staleness). Universal actions → store +
  legacy mirror. `replaceEntitySelection` = atomic + skip-if-unchanged (σπάει feedback loops 3D
  bridge / layer-select). **Μηδέν perf win ακόμη** — απλώς η βάση.
- **Stage B (pending — πιάνει το 122ms):** οι 4 orchestrators σταματούν να subscribe-άρουν → imperative
  store reads + τα children-leaves subscribe· fix `useActiveContextualTrigger` O(N×M) με `Map<id,entity>`
  index (διατήρηση `crossLevelEntities` fallback)· stable inputs σε `useOverlayLayers`/
  `useCanvasContextMenu`/`useUnifiedGripInteraction`.
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

## Changelog
- **2026-06-25** — Stage A (Opus 4.8): foundation store + hooks + compat-hook rewrite + reducer slim
  (Map→store, `SYNC_UNIVERSAL_LEGACY`). 22 new jest + 45 selection-suite GREEN. Behavior-identical.
  🔴 browser-verify (baseline ~122ms profile· κλικ ίδιο) + commit (Giorgio). Stage B/C pending.

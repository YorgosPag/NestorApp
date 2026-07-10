# ADR-623: Ribbon entity-bridge SSoT — selected-entity resolve + no-op toggles + violation badge + stable-return + core interface

## Status
✅ **ACTIVE — 2026-07-10** — De-duplication of the per-entity **contextual ribbon bridge** family in `src/subapps/dxf-viewer/ui/ribbon/hooks/` (the `useRibbon*Bridge` hooks, ADR-363/583) plus the cross-directory `bim/hooks/use-ribbon-stair-bridge.ts`. Every per-entity bridge hand-rolled the same four skeleton blocks and re-declared the same interface member list. Collapsed onto four shared primitives + the two existing core interfaces — every hook keeps its **identical public API**.

**Related:**
- **ADR-363** — the contextual BIM-drawing ribbon bridge architecture (`useRibbonCommands` composes per-entity bridges; each no-ops for keys outside its own registry). Unchanged.
- **ADR-583/597** — introduced `ribbon-entity-bridge-shared.ts` with `useResolveSelectedEntity<T>` + the `RibbonEntityBridgeCore` interface, and `bridge/ribbon-bridge-core.ts` with `RibbonBridgeCore`. Only 3 bridges (`beam`/`mep-boiler`/`wall-covering`) had adopted the resolver and only 2 (`beam`/`scale-bar`) extended a core interface; this ADR pays down the remaining debt across ~27 bridges.
- **ADR-609** — `create-ribbon-mep-auto-bridge.ts` (the MEP *auto*-bridge factory, a different sub-family, untouched here).
- **ADR-584** (jscpd Clone Ratchet, CHECK 3.28 / N.18) — gated the sibling-clone iteration; the skeleton + interface clones are folded to zero, the residual same-commit hits are inherent shared-import blocks + pre-existing out-of-scope clones (see Consequences).
- **ADR-605…622** — the same multi-day jscpd sweep; ADR-623 extends it into `ui/ribbon/hooks` (cluster #14). Scope agreed with Giorgio = **sub-family A (entity-param bridge skeleton)**; the MEP tool-bridge-store setup and the symbol/library placement logic are deferred.

---

## Context

A real SSoT audit (full reads of the shared module + representative bridges `column`/`slab`/`beam`/`stair`, plus a fresh jscpd pass grouping `ui/ribbon/hooks` at **1116 cloned lines / 86 intra-dir pairs**) found the classic sibling-clone pattern: ADR-583/597 created the shared resolver + core interfaces, but the bulk of the 30+ `useRibbon*Bridge` hooks still copy-pasted the same blocks:

1. **Selected-entity resolve** (~9 lines × 21 bridges) — an inline `resolveXxx` = `getPrimaryId()` → `currentLevelId` guard → `getLevelScene` → `entities.find` → per-type type-guard, byte-identical to the already-shared `useResolveSelectedEntity`.
2. **No-op toggles** (~5 lines × ~12 bridges) — an inert `onToggle` + `getToggleState` pair returning a per-file `const NULL_TOGGLE = false` (bridges whose commands are comboboxes/actions, never toggles), included only for interface parity.
3. **Violation badge** (~9 lines × 9 structural bridges) — `getBadgeState` = owned-key gate → resolve → `validation.hasCodeViolations` for the single `…badge.violations` key.
4. **Stable-return assembler** (~4 lines × 27 bridges) — `return useMemo(() => ({ …members }), [ …members ])` (ADR-040 Phase XIX: a non-memoized return literal caused a commit-time re-render cascade in `RibbonCommandProvider`).
5. **Interface member list** — each `export interface RibbonXxxBridge { … }` re-declared the same 5–6 core members (`onComboboxChange`/`getComboboxState`/`onToggle`/`getToggleState`/`onAction`[/`getPanelVisibility`]) instead of `extends`-ing the existing core interface.

---

## Decision

Big-player layering (Figma/Revit-scale UIs expose shared hook primitives + a base command surface; per-entity code supplies only its wiring), applied to the ribbon-bridge family. All `useRibbon*Bridge` hook names, prop shapes, exported consts (`XXX_BRIDGE_ACTIONS`, `isXxxBadgeKey`, …) and returned member sets are preserved.

### `ribbon-entity-bridge-shared.ts` — four shared primitives (extends the ADR-583/597 module)
- **`useResolveSelectedEntity<T extends Entity>(levelManager, universalSelection, guard)`** *(existing)* — now adopted by all 21 bridges that inlined the resolver.
- **`useNoopToggles(): { onToggle, getToggleState }`** — the inert toggle pair + the single shared `NULL_TOGGLE`; replaces every per-file no-op copy.
- **`useViolationBadgeState(resolve, ownedBadgeKeys, violationBadgeKey)`** — the owned-key-gated `validation.hasCodeViolations` resolver; the `XXX_OWNED_BADGE_KEYS` set + `isXxxBadgeKey` guard stay per-bridge.
- **`useStableBridge<T extends object>(members)`** — memoizes the assembled bridge object via `Object.values(members)` deps (every member is already `useCallback`-stable, so the assembled identity only changes when a member does — same ADR-040 guarantee as the hand-rolled `useMemo`, one line).

### Core interfaces (existing, now adopted)
- Bridges exposing `getPanelVisibility` → `extends RibbonEntityBridgeCore`; the rest → `extends RibbonBridgeCore`. Each interface keeps ONLY its extra members (`getBadgeState`, bespoke members); when nothing remains it becomes `export type RibbonXxxBridge = <Core>`.
- **Exception:** `useRibbonArrayBridge` genuinely lacks `onAction` (its return omits it) → left un-extended (forcing a core would add a member the implementation does not provide). Bridges with real toggle logic (`wall`/`opening`/`roof`/`hatch`/`array`/`floor-finish`) kept their toggles; only the interface + return + resolve were shared.

---

## Consequences

- **~27 bridges + `ribbon-entity-bridge-shared.ts` + `use-ribbon-stair-bridge.ts`** migrated to thin bindings. `ui/ribbon/hooks` clones **1116 → 931 lines / 86 → 62 pairs**; full-scan ratchet **3494 → 3364 (−130)** (cluster #14 ≈ −50 over the working tree).
- **Identical public API** — verified by the existing behavioural suites (11 bridge tests) + a new module-load **smoke test** (`__tests__/ribbon-entity-bridge-shared-smoke.test.ts`) covering the 16 bridges without their own suite, incl. the stair cross-dir import. **308 jest tests pass** (306 ribbon + 2 smoke).
- **Residual same-commit jscpd:diff hits are NOT skeleton twins** — they are (a) the inherent shared-helper **import blocks** (every consumer of an SSoT module imports it identically — undedupable), and (b) pre-existing, out-of-scope clones: the MEP **tool-bridge-store** setup (`electrical-panel`/`manifold`/`segment`/`underfloor`/`water-heater`) and the **symbol/library placement** logic (`furniture`/`floorplan-symbol`/`mep-fixture-library`). Candidate follow-up clusters #15 (MEP store/props) / #16 (symbol-library placement). The commit therefore uses `SKIP_JSCPD_DIFF=1` (justified: import blocks + pre-existing out-of-scope).
- **No `any`/`as any`**; every file < 500 lines. No runtime behaviour change (type-only interface moves + hook-extraction with preserved memo semantics).

---

## Changelog
- **2026-07-10** — Initial: extracted `useNoopToggles` / `useViolationBadgeState` / `useStableBridge` into `ribbon-entity-bridge-shared.ts`, adopted `useResolveSelectedEntity` across 21 bridges, migrated 27 bridge interfaces onto `RibbonEntityBridgeCore` / `RibbonBridgeCore` (+ removed the freed `RibbonToggleState` imports), added the smoke test. Cluster #14 of the ADR-584 jscpd sweep.
- **2026-07-10 (Φ2 — residual-clone elimination, replaces the planned `SKIP_JSCPD_DIFF=1`)** — the previously-flagged out-of-scope residuals (import blocks, MEP tool-bridge cluster #15, symbol/library placement cluster #16) were **properly de-duplicated instead of skipped**, so the commit needs **no** `SKIP_JSCPD_DIFF=1` (jscpd:diff clean on all 18 touched files):
  - `ribbon-entity-bridge-shared.ts` +5: **`useActiveSceneManager`** (the `if (!currentLevelId) return; createLevelSceneManagerAdapter(…)` dispatch preamble, 7 command bridges), **`useSceneUnitsScale`** (stair+wall byte-identical `getSceneUnitsScale`), **`useUpdateEntityPatch`** (generic `UpdateEntityCommand` dispatcher for the dual-mode `annotation-symbol`/`scale-bar` bridges), **`readNumericParamState`** (the `commandKey → numeric params field → {value:round,options:[]}` read, 5 MEP bridges), **`useInertBridgeExtras`** (the shared no-op toggles + no-op `onAction` + always-true `getPanelVisibility` tail). Also the re-exported `RibbonComboboxState`/`LevelSceneWriter` types + `PrimaryIdSelection` (collapses the identical import cluster + `UniversalSelectionLike` alias) and `RibbonEntityBridgeCoreNoToggles` (water-heater/underfloor interface parity).
  - **New `ribbon-tool-handle-bridge-shared.ts`** — owns the drawing-mode tool-handle family: **`useToolHandleBridge`** factory (full `RibbonEntityBridgeCore` from per-bridge config — `floorplan-symbol`/`furniture`/`mep-fixture-library` are now thin wrappers), plus `readToolOverrideNumber`/`writeToolOverrideNumber`/`useThumbnailPreload`/`buildMeshCatalogOptions`.
  - **New `ribbon-mep-network-visibility.ts`** — **`useManagedNetworkVisibility`** (the `resolveManagedSystems([entity], getSystems()).length > 0` panel-visibility resolver shared by electrical-panel/manifold/water-heater/underfloor).
  - Migration by 4 disjoint-file passes; **308 jest tests pass** (foundation/column/electrical/water-heater/segment/manifold suites incl.). No `any`; all files < 500 lines; no runtime behaviour change.

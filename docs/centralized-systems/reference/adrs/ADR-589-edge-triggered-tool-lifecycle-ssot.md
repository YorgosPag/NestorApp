# ADR-589: Edge-triggered Tool Lifecycle SSoT (`useEdgeTriggeredLifecycle`)

## Status
✅ **ACTIVE — 2026-07-08** — `useEdgeTriggeredLifecycle(isActive, onActivate, onDeactivate)` is the single home for the transition-only tool-activation idiom. 13 modify-tool hooks migrated. Guarded by CHECK 3.7 module `edge-triggered-tool-lifecycle` in `.ssot-registry.json` (golden fixture in `scripts/__tests__/fixtures/registry-golden-fixtures.js`).

**Related:**
- **ADR-363** — `useToolLifecycle`, the *sibling* lifecycle hook this ADR deliberately does NOT replace (see Context: it is not transition-only).
- **ADR-577** — `useModifyToolActivation`, the deselect→pick FSM for copy/mirror/move/scale/rotation. A different mechanism that keeps its own internal `wasActiveRef` edge-latch (allowlisted).
- **ADR-294** — SSoT ratchet enforcement (CHECK 3.7). This module is a tier-3 entry.
- **TIER A duplicate-audit (2026-07-08)** — the DXF Viewer duplicate sweep that surfaced this clone family (STEP B; STEP A added the `scalar-clamp` / `normalize-angle-deg` / `safe-storage` guards).

---

## Context

13 modify-tool hooks in `src/subapps/dxf-viewer/hooks/tools/` each hand-rolled the **exact same** transition-only activation boilerplate:

```ts
const wasActiveRef = useRef(false);
useEffect(() => {
  if (isActive && !wasActiveRef.current) {            // false → true edge
    ...enter...
  } else if (!isActive && wasActiveRef.current) {     // true → false edge
    ...exit...
  }
  wasActiveRef.current = isActive;                     // tail assignment
}, [isActive]);
```

The invariant is **edge-triggered**: `enter` fires only on the `false→true` transition, `exit` only on `true→false` — never on same-value re-renders. Only the enter/exit bodies differ per tool.

### Why not reuse `useToolLifecycle` (ADR-363)
`useToolLifecycle` is intentionally **level-triggered**, not edge-triggered:

```ts
useEffect(() => { if (isActive) activate(); else deactivate(); }, [isActive, activate, deactivate]);
```

It fires `activate()` on **every** deps change and `deactivate()` on mount. Migrating the 13 onto it would be a behaviour change (double-activate, deactivate-on-mount). The drawing tools (wall/beam/roof/…) correctly use it; the modify tools need the transition-only variant. The two hooks are siblings, not substitutes.

### Why not `useModifyToolActivation` (ADR-577)
That is a deselect→pick **finite state machine** for copy/mirror/move — a different interaction, not a drop-in edge latch. It keeps its own internal `wasActiveRef` and is allowlisted, not migrated.

### Big-player practice
The "transition-only effect over a `usePrevious`/`wasActiveRef` cell" is a **canonical React custom-hook idiom** (React docs, usehooks-ts). Extracting it to one named hook is standard library hygiene, not over-engineering. A grep-verified audit (2026-07-08) confirmed no existing `usePrevious` / `useEdgeTriggered` / `useTransitionEffect` / `useHasChanged` in the subapp — so a new hook is the correct move, not a duplicate.

---

## Decision

Introduce **`useEdgeTriggeredLifecycle(isActive, onActivate, onDeactivate)`** at
`src/subapps/dxf-viewer/hooks/tools/useEdgeTriggeredLifecycle.ts` and migrate all 13 hooks onto it.

### Byte-behaviour-identical contract
- Deps are **`[isActive]` only** — matching the 13 originals exactly. The callbacks are read via closure at the transition render, NOT tracked as deps (adding them would re-fire on every callback-identity change, breaking the transition-only contract). This is why call sites may pass **inline arrows without `useCallback`**, and why the single `react-hooks/exhaustive-deps` suppression lives inside the hook (one audited place) instead of in 13 call sites.
- Hooks whose original effect carried extra deps (`useWallSplitTool`: `[isActive, resetKnife, setHint]`; `useStretchTool`: `[isActive, activeTool, selectedEntityIds, onToolChange]`; `useWallAttachTool`, `useWallPickScaffold`) were **edge-guarded**, so those extra deps only ever triggered no-op re-runs. Collapsing to `[isActive]` is observably identical.

### The 13 migrated hooks
`useTrimTool` · `useExtendTool` · `useFilletTool` · `useChamferTool` · `useOffsetTool` · `useArrayTool` · `useArrayPathTool` · `useArrayPolarTool` · `useWallAttachTool` · `useWallSplitTool` · `useScheduleRegionPickTool` · `useStretchTool` · `useWallPickScaffold`

### Guard (CHECK 3.7)
Tier-3 registry module `edge-triggered-tool-lifecycle` forbids inline `wasActiveRef ?= ?useRef` (zero-collision repo-wide, grep-verified). Allowlist: the SSoT hook + `systems/tools/useModifyToolActivation.ts`. Golden fixture proves true-positive on an inline re-declaration and true-negative on canonical `useEdgeTriggeredLifecycle(...)` usage. `npm run test:registry-golden` GREEN (86 tests).

### Companion SSoT — status-bar prompt sync (`useToolHintPrompt`)
The same 5 modify tools (`useTrimTool` · `useExtendTool` · `useFilletTool` · `useChamferTool` · `useOffsetTool`) also byte-copied a *second* effect — the status-bar prompt sync:

```ts
useEffect(() => {
  if (!isActive /* || phase === 'idle' */) { toolHintOverrideStore.setOverride(null); return; }
  const key = <per-tool ternary>;
  toolHintOverrideStore.setOverride(i18next.t(`tool-hints:${key}`));
  return () => { toolHintOverrideStore.setOverride(null); };
}, [isActive, phase /*, polylineMode */]);
```

Extracted to **`useToolHintPrompt(isActive, key)`** at `hooks/tools/useToolHintPrompt.ts`. The two per-tool differences — the clear condition (`!isActive` vs `!isActive || phase === 'idle'`) and the key ternary — are BOTH folded into the caller-resolved `key` (`null` = clear; else the `tool-hints`-namespaced suffix). Since `key` is derived from `phase`/`polylineMode`, `[isActive, key]` is the semantically correct dependency (every distinct prompt maps to a distinct key), and `toolHintOverrideStore`'s own field-equality guard dedupes — so this is user-visible-identical to the previous `[isActive, phase]` effects. 6 jest tests (`useToolHintPrompt.test.ts`).

**No CHECK 3.7 guard for this one:** the token shape `setOverride(i18next.t(\`tool-hints:...` also occurs *legitimately and imperatively* (e.g. `useTrimTool` keydown `eraseArmed`/`undoEmpty` one-shots), so a name/regex guard would false-positive. Regression is instead covered by jscpd CHECK 3.28 (token-ratchet, N.18) + code review — the same rationale as STEP A's un-guardable inline-clamp shapes.

---

## Consequences

- **+** One place owns the edge-detection semantics; a bug fix or Strict-Mode adjustment lands once.
- **+** Ratchet prevents the 14th copy. New modify tools call the hook.
- **+** `wasActiveRef` cell + `eslint-disable` removed from 13 files (net LOC down).
- **−** Indirection: the enter/exit bodies now live in arrow callbacks passed to the hook rather than inline in the effect. Mitigated by keeping the bodies verbatim and documenting the closure-capture contract in the hook's docstring.

---

## Verification

- `useEdgeTriggeredLifecycle.test.ts` — 7 tests: no-fire on inactive mount; single fire on each edge; no-fire on same-value re-render (both directions); full activate→deactivate→reactivate cycle; latest-closure-at-transition.
- `useWallPickScaffold.test.ts` (existing) — GREEN post-migration, characterizing the most complex migrated hook's activation.
- `useToolHintPrompt.test.ts` — 6 tests: clear when inactive / when key null (idle); set `tool-hints:<key>`; update on key change; clear on unmount; clear on active→inactive.
- `npm run test:registry-golden` — GREEN (guard true/false positives).
- No `tsc` (project rule N.17); type-safety validated at pre-commit + Giorgio's periodic check.

---

## Changelog
- **2026-07-08** — Created. `useEdgeTriggeredLifecycle` SSoT + 13-hook migration + CHECK 3.7 guard + golden fixture (TIER A duplicate-audit STEP B).
- **2026-07-08** — Added companion `useToolHintPrompt` SSoT (status-bar prompt sync) + migrated the 5 modify tools (trim/extend/fillet/chamfer/offset). No guard (token shape overlaps legitimate imperative use — jscpd/review cover it). Was pending item G13.

# ADR-616: Layer command SSoT — LayerCommandBase + four Template-Method family bases

## Status
✅ **ACTIVE — 2026-07-09** — De-duplication of the DXF layer command family under `src/subapps/dxf-viewer/core/commands/layer/`. The 12 `ICommand` classes (freeze / lock / off / on-all / thaw-all / category-isolate / entity-isolate / dim / isolate-inverse / isolate / unisolate / restore-state) each repeated the same `ICommand` boilerplate — `id = makeLayerCommandKey(prefix)` + `timestamp` init, the six-field `serialize()` envelope, `getAffectedEntityIds() → []` — plus one of four near-identical lifecycles. Collapsed onto the generic **`BaseCommand`** (ADR-613) plus a layer root + four family Template-Method bases, turning every class into a thin subclass with **identical public API**.

**Related:**
- **ADR-358 §5.6.bis / §5.9** — Layer System (LAYFRZ/LAYLCK/LAYOFF/LAYON/LAYTHW/isolate/unisolate/layer-state — all conventions reproduced 1:1). `layer-command-utils.ts` (snapshot capture/restore) stays the SSoT for state I/O.
- **ADR-613** — the generic `BaseCommand` root this cluster adopts; extended here with an **optional `id` ctor param** (additive, backward-compatible) so a family that mints its own history key (`makeLayerCommandKey`) preserves the exact id format. `ADR-614` (text) is the sibling adopter.
- **ADR-605 / 606 / 607 / 609 / 610 / 611 / 613 / 614** — the same multi-day jscpd sweep. **ADR-613** (guides) and **ADR-614** (text) are the closest command-family precedents; ADR-616 completes the command trilogy (guides → text → layer).
- **ADR-584** (jscpd Clone Ratchet, CHECK 3.28 / N.18) — gated the sibling-clone iteration to zero.

---

## Context

A real SSoT audit (grep for existing command bases + full reads of all 12 layer command files + `layer-command-utils.ts` + `IsolateEffectsStore`, plus a fresh jscpd pass listing **13 intra-dir clone pairs / 229 cloned lines**) confirmed the generic `BaseCommand` (ADR-613) existed but **none** of the layer commands used it — every one hand-rolled the plumbing. `layer-command-utils.ts` already centralised snapshot capture/restore (good), but the command envelope + four lifecycles were copy-pasted. The variance:

1. **`ICommand` envelope** — `id = makeLayerCommandKey(prefix)` + `timestamp`, the six-field `serialize()` and `getAffectedEntityIds() → []` — repeated in **all 12**. Unlike guides/text the id is NOT `generateEntityId()`, so BaseCommand needed an optional-id ctor.
2. **Single-layer flag toggle** — no-op guard → snapshot → mutate → restore, **identical** across Freeze/Lock/Off. Only the flag (`frozen`/`locked`/`visible`) + target value differ.
3. **Mutate-all → restore** — `mutateAllLayersFlag` + restore + replay, identical between OnAll/ThawAll.
4. **Isolate-effects** — `IsolateEffectsStore` snapshot/apply/restore, the **34-line** CategoryIsolate↔EntityIsolate twin. Only the applied effect + affected-ids differ.
5. **Delegating wrappers** — Dim/IsolateInverse each hold a one-shot `LayerIsolateCommand` and delegate execute/undo/redo.

---

## Decision

Big-player command architecture (AutoCAD/Revit expose ONE command root + per-domain lifecycle bases + thin leaves), layered top-down:

### 1. `core/commands/base-command.ts` — generic `BaseCommand` (ADR-613)
Extended with `constructor(id?: string)` → `this.id = id ?? generateEntityId()`. Additive: guides/text call `super()` unchanged.

### 2. `core/commands/layer/layer-command-base.ts` — layer root + four family bases
- **`LayerCommandBase extends BaseCommand`** — `super(makeLayerCommandKey(typePrefix))`, `getAffectedEntityIds() → []`, `wasExecuted`.
- **`SingleLayerFlagCommand`** — Freeze/Lock/Off. Abstract `flag` + `targetValue`; owns the no-op guard + snapshot + mutate + restore + `serializeData → { layerId }`.
- **`MutateAllLayersCommand`** — OnAll/ThawAll. Abstract `flag` + `targetValue`; owns capture-on-first + replay + restore + `serializeData → {}`.
- **`IsolateEffectsCommand<I>`** — Category/Entity isolate. Owns the effects snapshot/undo/redo; abstract `applyEffects()`.
- **`DelegatingLayerCommand`** — Dim/IsolateInverse. Holds `inner: ICommand` (typed loosely to avoid a cycle with `LayerIsolateCommand`) and delegates execute/undo/redo.

### 3. Thin command files (identical public API)
- **SingleLayerFlagCommand:** LayerFreeze (frozen), LayerLock (locked), LayerOff (visible=false). `Layer{Freeze,Lock,Off}Input` aliased to the shared `SingleLayerInput`.
- **MutateAllLayersCommand:** LayerOnAll (visible=true), LayerThawAll (frozen=false).
- **IsolateEffectsCommand:** CategoryIsolate, EntityIsolate (overrides `getAffectedEntityIds`).
- **DelegatingLayerCommand:** LayerDim, LayerIsolateInverse (share `serializeLayerIsolateInput`).
- **LayerCommandBase (bespoke lifecycle):** LayerIsolate (`didOverwritePreviousSnapshot()`), LayerUnisolate, RestoreLayerState (`version = 2`, `getUnmatchedLayerNames()`).

All class names, constructor signatures, exported input types and extra public members are preserved. The barrel `commands/layer/index.ts` is unchanged; external consumers (keyboard shortcuts, context menus, ribbon dispatchers) are untouched.

---

## Consequences

**Positive**
- **−18 jscpd clones** full-scan (3534 → 3516, `.jscpd-baseline.json` relocked); zero new sibling clones (`jscpd:diff` clean on all 14 staged src files).
- The generic `BaseCommand` now backs three command families (guides + text + layer) — one command root for the subapp.
- New parity test `commands/layer/__tests__/layer-commands-ssot.test.ts` (7 cases) locks the base contract (id format, envelope, flag lifecycle, mutate-all, isolate effects, delegation) against a real LayerStore + IsolateEffectsStore; full layer suite green (56/56); guide + text suites unaffected by the BaseCommand id change (103/103).

**Negative / risk**
- `BaseCommand` ctor signature changed (added optional `id`). Additive only — every existing `super()` call keeps `generateEntityId()`. Verified: guide + text suites pass unchanged.

---

## Changelog
- **2026-07-09** — Initial. Extended `BaseCommand` with optional `id`; added `layer-command-base.ts` (`LayerCommandBase` + `SingleLayerFlagCommand` + `MutateAllLayersCommand` + `IsolateEffectsCommand` + `DelegatingLayerCommand`) + `serializeLayerIsolateInput` helper; migrated all 12 layer command files to thin subclasses; added parity test suite. jscpd 3534 → 3516.

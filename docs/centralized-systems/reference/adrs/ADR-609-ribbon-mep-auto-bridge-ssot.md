# ADR-609: Ribbon MEP auto-design bridge factory SSoT (`createRibbonMepAutoBridge`)

## Status
✅ **ACTIVE — 2026-07-09** — De-duplication of the 6 pressurised/gravity **network** auto-design ribbon bridges under `src/subapps/dxf-viewer/ui/ribbon/hooks/` (`useRibbonWaterAutoSupplyBridge` · `useRibbonDrainageAutoBridge` · `useRibbonHeatingAutoBridge` · `useRibbonHvacAutoBridge` · `useRibbonFireAutoBridge` · `useRibbonGasAutoBridge`). Each was a ~130-line hook repeating the SAME three-handler body — `handleGenerate` (recognize storey → run engine → empty ⇒ reset+`-empty` else store.set+`-generated`), `handleAccept` (get review → `buildXCommit` → `CompoundCommand([CreateMepSegmentsCommand, …CreateMepSystemCommand])` → store.reset+`-committed`), `handleReject` (store.reset) + the `onAction` router — differing ΜΟΝΟ σε 7 παραμέτρους. Collapsed onto **one factory** `createRibbonMepAutoBridge(config)` that returns the hook + per-discipline config bindings that keep their exact public API.

> **ADR number note:** claimed **609** after 608 was concurrently taken by the vector-PDF work (`ADR-608-vector-pdf-export.md`) in the shared working tree.

**Related:**
- **ADR-605** (3D point-placement hook factory) / **ADR-606** (MEP commit-builder factory) / **ADR-607** (batch-entities command factory) — same 2026-07-09 jscpd de-duplication sweep, same archetype (**one factory + thin config bindings, identical public API**). ADR-609 is the ribbon **action-bridge** bucket that consumes ADR-606's builders.
- **ADR-584** (jscpd Clone Ratchet, CHECK 3.28 / N.18) — the token-based detector that gated re-introduction; a `--diff` pass confirmed the 6 configs are NOT sibling clones.
- **ADR-426 / 427 / 428 / 432 / 433 / 434** — the individual disciplines' Slice-2 Generate→review→accept flows, reproduced 1:1.

---

## Context

A real SSoT audit (grep for `*AutoBridge` hooks + full diffs of all 6 against `useRibbonDrainageAutoBridge.ts`, plus a jscpd pass listing the tight clone family: 5× 71-line `Drainage↔{Fire,Gas,Heating,Hvac,Water}` pairs) confirmed no shared owner existed. The invariant body was copy-pasted; the **only** variance across the 6:

1. the **action-key** set (`FIRE_AUTO_RIBBON_ACTIONS` · …) the bridge owns;
2. the discipline **proposal store** (`fireProposalStore` · …);
3. the **design engine** (`designFire(model, entities)` · … — drainage alone reads the 3rd `sceneUnits` arg for its gravity slope);
4. the pure **commit builder** (`buildFireCommit` · …, the ADR-606 factory outputs);
5. the per-network **i18n name resolver** (fire/gas/hvac/water: `service` + index · heating: `role` supply/return · drainage: index only);
6. the `CompoundCommand` **label**;
7. the `bim:<discipline>-{empty,generated,committed}` **EventBus feedback triple** + the two `-empty` reason strings (`no-source`/`no-terminals` · `no-source`/`no-fixtures` · `no-collector`/`no-fixtures`).

Big-player practice (Revit / Figma command descriptors) for a family of near-identical action handlers is **a small typed config + a single executor**, not a copy-pasted bridge per discipline.

The two **electrical** bridges (`useRibbonElectricalAutoBridge` / `useRibbonElectricalWeakAutoBridge`) are a DIFFERENT shape (channels + home-run wire routing, `CreateMepSystemCommand`-only, no segments) and are intentionally **out of scope** — folding them in would force `any` or a leaky union.

---

## Decision

### New factory `ui/ribbon/hooks/create-ribbon-mep-auto-bridge.ts`
`createRibbonMepAutoBridge<TNetwork, TProposal>(config)` returns the hook `(props: { levelManager }) => { onAction }`. The factory owns the three-handler invariant + the `onAction` router (no-op for unknown keys, so it still composes inside `useRibbonCommands`); `config` injects the variance:

| Field | Role |
|---|---|
| `actions` | `{ generate, accept, reject }` command keys |
| `store` | the discipline proposal store (`get`/`set`/`reset`) |
| `design(model, entities, sceneUnits)` | the discipline engine (flat engines ignore arg 3) |
| `buildCommit(proposal, layerId, sceneUnits, resolveName)` | the ADR-606 pure builder |
| `resolveNetworkName(t, network, index)` | i18n display name per network |
| `commandLabel` | the `CompoundCommand` undo label |
| `emitEmpty(hasWarnings)` / `emitGenerated(n, w)` / `emitCommitted(n, s)` | typed feedback thunks |

### Type-safe feedback via per-discipline `emit*` thunks (not generic event keys)
The EventBus is a discriminated `emit<T>(type: T, payload: DrawingEventMap[T])`. Threading the event **name** through a generic type parameter erases the payload link (`DrawingEventMap[TKey]` on a bare type param defers, and the `-empty` reason unions differ per discipline), which would force `as`-casts. Instead each config supplies three tiny **typed thunks** that call `EventBus.emit('bim:fire-generated', …)` with concrete literal keys → fully checked, zero `any`. Because each thunk is a one-liner split by its event-name literal, jscpd's 50-token window never spans two disciplines (verified by `--diff`).

Each cell re-exports `RibbonMepAutoBridgeProps` / `RibbonMepAutoBridge` under its historical name (`UseRibbonFireAutoBridgeProps`, `RibbonFireAutoBridge`, …) so `useDxfBimBridges.ts` and every caller are untouched.

### Consequences
- **−14 jscpd clones** in the full `src/` scan (3681 → 3667, CHECK 3.28) — the 6-file pairwise family collapsed, same order as ADR-606.
- New factory + 6 thin cells (~45 LOC each, was ~130). New disciplines are a config object, not a copied hook.
- New test `__tests__/create-ribbon-mep-auto-bridge.test.tsx` (6 cases) covers the orchestration (generate empty/non-empty, accept empty/non-empty plan, reject, foreign-key no-op) with the heavy collaborators mocked — the 6 cells had **no** prior tests.

---

## Changelog
- **2026-07-09** — Created (claimed 609 after 608 taken by vector-PDF). Extracted `createRibbonMepAutoBridge`; migrated all 6 network auto-bridges to config bindings (identical public API). 6 factory tests green; jscpd −14 (3681 → 3667). `--diff` confirmed the 6 configs are not sibling clones. Electrical/-weak bridges left out of scope by design.

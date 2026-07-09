# ADR-606: MEP network commit-builder factory SSoT (`createMepNetworkCommitBuilder`)

## Status
✅ **ACTIVE — 2026-07-09** — De-duplication of the 6 `build-<discipline>-commit.ts` MEP commit **builders** under `src/subapps/dxf-viewer/systems/mep-design/*/commit/` (`buildFireCommit` · `buildWaterSupplyCommit` · `buildHeatingCommit` · `buildGasCommit` · `buildDrainageCommit` · `buildHvacCommit`). Each was a ~120–130-line pure module repeating the SAME two-function body — a per-network `buildNetworkEntities` (segment loop → skip-invalid → members = segment connectors + servedConnectors → one `MepSystem` or null) and the outer `buildXCommit` (forEach network → accumulate segments/systems/skipped) — differing ΜΟΝΟ σε 4 παραμέτρους. Collapsed onto **one generic factory** `createMepNetworkCommitBuilder(config)` + per-discipline config bindings that keep their exact public API.

**Related:**
- **ADR-605** — same 2026-07-09 de-duplication sweep, sibling archetype (**shared primitive + per-instance binding**) in the 3D placement bucket. ADR-606 is the MEP "proposal → commit plan" bucket.
- **ADR-584** (jscpd Clone Ratchet, CHECK 3.28 / N.18) — the token-based detector that both gated re-introduction AND caught the first-cut sibling clone (see Consequences).
- **ADR-426 / 427 / 428 / 431 / 432 / 433** — the individual disciplines' Generate→accept slices, reproduced 1:1.
- **mep-segment-completion.ts** (segment SSoT) · **mep-pipe-network-from-selection.ts** (`pipeSegmentMembers`, members SSoT) · **mep-system-types.ts** (`buildDefault{Pipe,Duct,Fuel}NetworkParams`).

---

## Context

A real SSoT audit (grep for `buildNetworkEntities`/`pipeSegmentMembers`/`completeMepSegmentFromTwoClicks` + full diffs of all 6 against `build-fire-commit.ts`, plus a jscpd pass listing 14 cross-file clone pairs among them) confirmed no shared owner existed. The invariant body was copy-pasted; the **only** variance across the 6:

1. the segment **domain** — `'pipe'` (fire/water/heating/drainage) · `'duct'` (hvac) · `'fuel'` (gas);
2. the per-segment **override** — `{classification,diameter}` (fire/water/heating) · `{sectionKind:'round',diameter}` (gas/hvac — the class lives on the system) · `{classification,diameter,slopePercent}` (drainage);
3. the per-segment **elevations** — flat `network.sourceElevationMm` for pressurised/supply-air runs · drainage's per-endpoint `seg.start/endElevationMm` gravity fall;
4. the **system params** builder — `buildDefaultPipe/Duct/FuelNetworkParams` (duct/fuel seed a palette colour; drainage sources the outfall instead of a supply outlet).

Big-player practice for a family of near-identical pure translators is **a small typed config + a single factory**, not a copy-pasted builder per discipline.

---

## Decision

### New factory `systems/mep-design/shared/create-mep-network-commit-builder.ts`
`createMepNetworkCommitBuilder<TNetwork, TSeg>(config)` returns the pure `(proposal, layerId, sceneUnits, resolveName) => MepNetworkCommitPlan` builder. The factory owns the two-loop invariant; `config` injects the variance:

| Field | Role |
|---|---|
| `domain` | `MepSegmentDomain` passed to `completeMepSegmentFromTwoClicks` |
| `buildSegmentOverride(seg)` | per-segment `MepSegmentParamOverrides` |
| `resolveSegmentElevations(seg, network)` | `{ startMm, endMm }` — flat datum or per-endpoint fall |
| `buildSystemParams(network, index, members, resolveName)` | the discipline's `buildDefault*NetworkParams(...)` |

Shared types `MepNetworkCommitPlan` + `ResolveMepSystemName<TNetwork>` live in the factory module; each discipline re-exports them under its historical name (`FireCommitPlan`, `ResolveHeatingSystemName`, …) so `index.ts` and the `useRibbon*AutoBridge` callers are untouched. All 44 commit tests stay green.

### Composable presets (avoid twin configs)
Because fire/water/heating produce **byte-identical** configs and gas/hvac share the round-section override + flat elevation, the factory module also exports:
- `flatPressurisedPipeConfig<TNetwork, TSeg>()` — the full pipe/flat/source-id config (fire · water · heating call it directly);
- `flatNetworkElevations` + `roundDiameterOverride` — building blocks gas/hvac reference by name.

### Consequences
- **−14 jscpd clones** in the full `src/` scan (3702 → 3688, CHECK 3.28) — smaller than ADR-605's cluster because the bodies were fewer/shorter, but a real ratchet-down.
- **The first cut re-introduced the duplication one level up**: the 6 thin configs were themselves clones (fire≈water≈heating; gas≈hvac). CHECK 3.28 `--diff` blocked it at pre-commit; the fix was the shared presets above — a textbook N.18 "sibling clone" catch, exactly the structural case name/regex `ssot:discover` is blind to.
- Any future MEP discipline is a config object, not a copied builder.

---

## Changelog
- **2026-07-09** — Created. Extracted `createMepNetworkCommitBuilder` + `flatPressurisedPipeConfig`/`flatNetworkElevations`/`roundDiameterOverride`; migrated all 6 commit builders to config bindings. 44 tests green; jscpd −14 (and the intermediate sibling-clone regression caught + fixed via presets).

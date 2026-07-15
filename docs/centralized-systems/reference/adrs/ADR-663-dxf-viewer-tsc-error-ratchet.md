# ADR-663: DXF Viewer TypeScript Error Ratchet — CHECK 3.29

## Status
✅ **ACTIVE — 2026-07-16 — BASELINE 381 errors (117 source / 264 test) over `src/subapps/dxf-viewer/tsconfig.json`** — Layer 1 (pre-commit baseline smoke) + Layer 2 (CI full type-check ratchet) live. Baseline: `.dxf-tsc-baseline.json`. Engine: `scripts/check-dxf-tsc-ratchet.js` (+ 39 Jest tests). CI: `.github/workflows/dxf-tsc-ratchet.yml`.

**Related:**
- **ADR-584** (jscpd Clone Ratchet, CHECK 3.28) — the two-layer "fast local smoke + authoritative CI full scan" pattern reused here, engine and all.
- **ADR-294** (SSoT Ratchet Enforcement) — the ratchet philosophy (violations only decrease) this check mirrors.
- **ADR-299** (Ratchet Backlog Master Roadmap) — CHECK 3.29 is a new ratchet; baseline drift >10% updates §2 there.
- **CLAUDE.md N.17** — agents must NOT run `tsc` per task. This ADR is what makes that rule safe: the type-check moves to CI instead of disappearing.

---

## Context

`tsconfig.json` at the repo root **excludes `src/subapps/dxf-viewer/**`**. The subapp carries its own `src/subapps/dxf-viewer/tsconfig.json` and needs a raised heap (`--max-old-space-size=8192`) to type-check at all.

The consequence had never been written down: **`npm run typecheck` — and therefore every automated gate in the repo — is structurally blind to the entire DXF Viewer.** Type errors there are caught by nothing. Not the pre-commit hook, not CI, not the periodic check (which runs the root project). They are visible only when someone runs the subapp's own project by hand.

Measured on 2026-07-15, that blind spot had accumulated **469 errors** (205 in source, 264 in tests) — none of which had ever failed a build.

CLAUDE.md **N.17** forbids agents from running `tsc` per task, for a good reason: a full type-check is 60-90s on Giorgio's machine and the per-change error yield is tiny, so per-task checking is pure waste. But N.17 delegates the check to "Giorgio periodically + the pre-commit hook" — and for this subapp **neither of those actually covers it**. The rule was load-bearing on a gate that did not exist.

This is the same shape as ADR-584's blind spot (CHECK 3.18 cannot see clones with different names): a rule everyone believed was enforced, enforced by nothing.

---

## Decision

Add **CHECK 3.29 — DXF Viewer TypeScript error ratchet** as a **two-layer** gate, **reusing the ADR-584 ratchet framework** (baseline-load → scan → compare → smoke/full modes → Jest suite) rather than inventing a new engine.

### Layer 1 — pre-commit smoke (`scripts/git-hooks/pre-commit`, Phase 0.7)
Runs **only** when the commit stages a file under `src/subapps/dxf-viewer/`, and asserts **only** that `.dxf-tsc-baseline.json` exists and parses. **It does NOT type-check.**

This is deliberate and is the whole reason the design works: paying 60-90s on every commit is exactly the cost N.17 exists to avoid, and a hook everyone disables is worth less than no hook. The smoke leg costs ~50ms and guards the one thing a local hook usefully can — that the baseline was not deleted or corrupted.

Escape hatch: `SKIP_DXF_TSC_SMOKE=1 git commit …` (justify to Giorgio).

### Layer 2 — CI ratchet (`.github/workflows/dxf-tsc-ratchet.yml`)
On every PR / push to `main` touching `src/**/*.ts(x)`, runs the **full** type-check over the subapp's own project and compares **per-file** error counts against `.dxf-tsc-baseline.json`. A rise **BLOCKS**. CI is the authoritative gate.

### Per-file baseline, not a global total
Unlike `.jscpd-baseline.json` (one global count), this baseline is a **per-file map**, mirroring `.i18n-violations-baseline.json`:

```json
{ "totalErrors": 381, "sourceErrors": 117, "testErrors": 264,
  "byFile": { "src/subapps/dxf-viewer/…/foo.ts": 3 } }
```

A total-only ratchet lets a **brand-new broken file** land as long as the same PR fixed more errors elsewhere. Per-file gives the house rule — *new file with violations → BLOCK, zero tolerance* — for free, and it is pinned by a test (`BLOCKS a new broken file even when the overall total dropped`).

### Tests are ratcheted too
The 264 test-file errors are tracked alongside source. Tracking them costs nothing and stops them rotting. The summary reports the **source/test split** because source errors are what §4 burns down.

### `any` is not an escape hatch
The remediation text points at fixing the types. `any` / `as any` / `@ts-ignore` remain forbidden (CLAUDE.md), and would in any case only move the error rather than remove it.

---

## Consequences

**Positive**
- The subapp's type errors are now **visible and monotonically decreasing**. The count can never silently grow again.
- **N.17 becomes safe.** Agents still never run `tsc`; the check now genuinely exists — in CI, where it costs Giorgio nothing.
- New DXF Viewer files are held to **zero type errors** from day one.

**Negative / accepted**
- CI spends ~45-90s per PR touching `src/**/*.ts`. Accepted: it is the only place the check can live without taxing every commit.
- A local `npm run dxf:tsc:check` is opt-in, so a regression is discovered at PR time rather than commit time. Accepted for the same reason.
- The baseline needs a refresh (`npm run dxf:tsc:baseline`) after each burn-down, or CI keeps nudging with the `−N vs baseline` trend line.

---

## Commands

| Command | Purpose |
|---|---|
| `npm run dxf:tsc:check` | Full type-check + per-file baseline compare (Layer 2, ~45-90s) |
| `npm run dxf:tsc:baseline` | Lock current counts after a legitimate burn-down |
| `npm run test:dxf-tsc` | The engine's own Jest suite (39 tests) |
| `node scripts/check-dxf-tsc-ratchet.js` | Smoke only (what the hook runs) |

Raw: `NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit -p src/subapps/dxf-viewer/tsconfig.json`

---

## §4 — Burn-down log

Source errors only (tests tracked separately, see §"Tests are ratcheted too").

| Date | Source errors | Δ | What was fixed |
|---|---|---|---|
| 2026-07-15 | 205 | — | Starting measurement (469 total incl. tests) |
| 2026-07-16 | 117 | −88 | Root-cause batches, below |
| 2026-07-16 | 84 | −33 | Long-tail batches, below (also −11 test errors, un-touched: two roots lived in shared guards) |

### 2026-07-16 batches

Each was a **shared root cause**, not a per-site patch — which is why 88 errors fell out of 8 edits:

1. **`ResolvedBimScope` duplicate type (−45).** `hooks/data/bim-entity-persistence-hook-types.ts` re-declared a twin of the resolver's own `ResolvedBimPersistenceScope`, typing `floorplanId`/`floorId` as `string | null` while the resolver guarantees `floorplanId: string` and *omits* `floorId`. Every one of the ~25 `use*Persistence` hooks passes the scope straight into a `*FirestoreServiceConfig`, so all of them failed. Deleted the twin, re-exported the real type, and stopped `create-bim-entity-persistence-hook` from re-spreading the scope field-by-field (which re-introduced a `floorId: undefined` key). Same edit fixed the `Promise<XDoc>` vs `Promise<void>` adapter mismatch: the factory awaits `save`/`update`/`remove` purely for ordering and never reads the value, so the contract is now `Promise<unknown>`.
2. **ADR-615 `wallId` optionality (−13).** ADR-615 made `OpeningParams.wallId` optional (self-hosted openings) without updating the consumers that need a host wall. Added `isWallHostedOpening()` as the type-predicate counterpart to the existing `isSelfHostedOpening()` (SSoT, `bim/types/opening-types.ts`), and used it to *narrow* rather than assert in `bim-envelope-scene-builder`. `useOpeningPersistence` now guards the `bim:opening-persisted` emit — a self-hosted opening has no host wall BOQ to re-feed (the `onDeleted` path already had this guard; `onPersisted`/`onRestored` had missed it). `section-intersect.toOpeningPlan` reads `hostWall.id`, which is the truthful source — the caller has already resolved the host to get there.
3. **`ToolHandleLike.overrides` (−9).** Declared `Readonly<Record<string, unknown>>`, but every bridge's overrides is a precise *interface*, and interfaces get no implicit index signature — so none of them ever satisfied it. Typed as `object`; the single dynamic lookup in `readToolOverrideNumber` narrows the value itself.
4. **`AnyFamilyTypeParams` drift (−9, with #5).** A hand-listed union in `bim-family-type-audit-client.ts` that had fallen behind `BimTypeParamsByCategory` (missing `stair`). Now **derived** from the category map, so it cannot drift again.
5. **`create-family-type-controller` nullability.** `GetType` said `| undefined`; the store's `getType` returns `| null`. Aligned with the store, and widened `asFamilyType` to `| null | undefined` (the `as*FamilyType` helpers already accepted both). Also constrained `E extends Entity & FamilyTypedEntity<…>` — `isEntity` is a type predicate over `Entity`, so its narrowed type must actually be a scene entity.
6. **`apply-entity-preview` dead comparisons (−7).** `DxfEntityUnion` does not model `lwpolyline` / `mtext` / `group` / `block`, but this pipeline is handed the RAW scene entity, whose tag can be any of them — each already handled behind a cast. Added `rawTypeOf()` so the guards are type-legal instead of comparing against tags the union had narrowed away. **These comparisons were live behaviour, not dead code** — the file's own comments document the `mtext` case as a regression re-fix ("το κείμενο δεν ανταποκρίνεται", Giorgio 2026-06-30). Removing them would have re-broken it.
7. **`rotation-math` (−6).** `Partial<Entity>` distributes over the union, so the rectangle accumulator could not take `corner1`/`corner2`/`x`/`y`. Typed against `Partial<RectangleEntity>`.
8. **`create-bim-boq-audit-lifecycle` (−1).** Reading a property off a type parameter yields the *constraint's* type (`kind: string`), not `TEntity['kind']`, so the pruned delete snapshot no longer matched the recorder. Kept the projection (it deliberately prunes `geometry` out of the audit snapshot — pinned by `create-bim-boq-audit-lifecycle.test.ts`) and asserted the type the values already have.

**Verification:** all touched domains ran green — `hooks/data` + `bim/persistence` (188 tests), `ui/ribbon/hooks` (530), `bim-3d`/`bim/geometry`/`bim/types`/`hooks/data` (1947), `rendering/ghost` + `bim/family-types` + `utils`. Three pre-existing failures (`systems-discipline-tabs`, `dxf-linetype-compound-roundtrip`, `dxf-attrib-attdef`) were confirmed failing on a stashed tree beforehand — unrelated to these changes and still open.

### 2026-07-16 batches, part 2 (117 → 84)

The "long tail" turned out to still hold **small shared roots** — 33 source errors fell out of 9 edits. The pattern in almost every case: a **consumer re-declaring what its producer already knew**, and the re-declaration being wrong.

1. **`TextRun | TextStack` narrowing (−4, 3 files).** The union has no discriminant, so `'text' in run` was copy-pasted across the text engine — and three title-block sites had simply forgotten it, reading `run.text` off a stack. That yields `undefined`, which `Array.join` renders as `''`: a stacked fraction vanished from the glossary/preview **silently**. New SSoT `text-engine/types/text-ast.guards.ts` (`isTextRun` / `isTextStack`); the local twin in `InsertTextTokenCommand` now imports it (N.0.2). Stacks pass through the localizer unchanged — the file's own contract is that translation changes *words*, not drawing.
2. **`gripKindOf` producer/consumer seam (−3, 3 files).** `commitParametricAnnotationGripDrag` declared `kind: K | null`, but its documented sole producer `gripKindOf` returns `K | undefined` (and is the ecosystem-wide producer, ~120 files). Aligned the SSoT to the producer. Runtime was already fine (`if (!kind)` catches both) — the seam was type-only.
3. **`pushStyledGuide` producer/consumer seam (−4).** Identical shape: consumer said `Guide | null`, `addGuideRaw` / `addDiagonalGuideRaw` — its only feeders — return `Guide | undefined`.
4. **ESC never registered for wall-merge / wall-gap-opening (−4). A real bug, not type noise.** `useCanvasEscapeRegistrations` registered both tools, but its params interface never declared them, and `useCanvasKeyboardShortcuts` — which *does* declare them (`.types.ts:130-137`) and receives them from `CanvasSection` — never destructured or forwarded them. So `p.handleWallMergeEscape` was always `undefined`, and `buildModifyHandler`'s `if (!callback) return null` **dropped the handler**: pressing ESC during a wall-merge or wall-gap-opening flow cancelled nothing. Declared + destructured + forwarded, mirroring the working `stairAddTurn` wiring.
5. **`ParseResult` non-discriminating flag (−3, 2 files).** `{ valid: boolean; color?: ColorValue }` cannot narrow, so `if (parsed.valid) parsed.color` stayed possibly-undefined and callers double-checked a field the flag already promised. Now a discriminated union on `valid`.
6. **`isValidPoint` discarded the caller's fields (−2).** `point is Point2D` narrows a `{x?, y?, bulge?}` vertex down to a bare `Point2D` — so the DXF **bulge could not be read after validating the very vertex carrying it**. Now generic: `isValidPoint<T>(point: T): point is T & Point2D`. Backwards-compatible (`unknown & Point2D` = `Point2D`).
7. **`InheritedStyle.lineweightMm` widened by hand (−5, one file).** Re-declared as `number`; `LineweightMm` is the ISO plot-width literal union, copied straight off `Entity`. Every `make*` primitive failed on it. Imported the real type.
8. **`beginDistanceLabel` dropped `Required<>` (−4).** It merges over `Required<DistanceLabelOptions>` defaults, so every field *is* present — but the signature typed both the defaults and the result as the optional `DistanceLabelOptions`, re-introducing the `undefined` it had just eliminated.
9. **`interfaces.ts` split leftover (−2).** `export type { … } from './types/persistence-types'` is a **re-export**: it serves importers, but does not bring the names into the file's own scope, so its two local uses were unresolved. The same file already handles this correctly for `audit-types` (import + re-export) — followed that.

Roots 1, 5 and 6 lived in shared guards/types, so they also removed **11 test-file errors** without a single test file being touched.

**Verification:** touched domains green — text-engine + core/commands/text (701), ui/color + rendering/entities (400), guides + grips + core/commands (864), hooks/canvas (48), export (436), utils + zoom + rendering/entities/shared (762). `jscpd:diff` clean on all 15 files (N.18). Pre-existing failures unchanged and unrelated: `dxf-linetype-compound-roundtrip`, `dxf-attrib-attdef` (both listed in the previous session's handoff) and `move-entity-geometry-coverage` — the last one is **new since that handoff and is a live gap, not noise**: `floorplan-symbol` was added to `RENDERABLE_ENTITY_TYPES` without a MOVES/NO-OP classification, which is exactly what that completeness anchor exists to catch. Untouched here — it is outside this task and sits in a file Giorgio is committing to live.

**Remaining 84 source errors.** The remaining large-ish item, `procurement/services/framework-agreement-service.ts` (7), is **outside the dxf-viewer** and is one root: `firebase-admin`'s `Timestamp` vs the client `@firebase/firestore` `Timestamp` (missing `toJSON`). The rest is a genuine long tail. The ratchet holds the line while they are burned down opportunistically (Boy Scout rule, N.0.2).

### 2026-07-16 batches, part 3 (84 → 67)

**One root, 13 call-sites, and a live bug the type error was hiding.** The previous session flagged "`string | undefined` → `string` in ~10 files (~14 errors)" as *"look for a common cause FIRST — may be 1-2 roots, not 14 one-offs."* That was right, and the root is a single field: **`OpeningParams.wallId?: string`**.

The `?` is **deliberate** (ADR-615): a κούφωμα is hosted by EXACTLY ONE of `wallId` (a BIM wall) or `selfHost` (a synthetic free-standing host, for openings placed on imported DXF lines). So these were never "wrong types" — they were **13 consumers that silently ignore self-hosted openings**. The fix is not to widen or assert; it is to route every one through `isWallHostedOpening()`, the type-predicate SSoT ADR-615 already provides for exactly this ("callers that genuinely need the host wall NARROW `params.wallId` to `string` instead of asserting it").

1. **Group-by-wall (−6, 3 files).** `bim-readonly-render`, `dxf-renderer-frame-builders`, `bim-to-tek`: a self-hosted opening would land in a bucket keyed `undefined`.
2. **Set-membership / cascade (−4, 3 files).** `envelope-boq-sync`, `envelope-element-applicator`, `bim-cascade-resolver`: no host wall ⇒ no reveal contribution, no cascade.
3. **IFC (−2, 2 files).** `ifc-opening-serializer` (no host ⇒ no `IfcRelVoidsElement`), `ifc-covering-serializer` (no wall to line with a Z4 reveal).
4. **Host lookup (−3, 3 files).** `useFloorplanBimEntities`, `ifc-bim-scene-loader`, `opening-type-resolution`: all already handled "wall not found" via `?? null` — they just asked the map with an `undefined` key first. A `null` host is the **normal** state of a self-hosted opening, not an error.
5. **`EnvelopeOverlay` (−1).** `OpeningForCut.params.wallId` is required (an envelope cut is meaningless without a host); the caller passed every opening. Filtered at source.
6. **🔴 `AssignOpeningTypeCommand` — RC3/RC4 live, in the twin writer (−1 + a real bug).** ADR-615 fixed RC3 (`validate()` demanding `wallId` → every self-hosted commit silently rejected) and RC4 (no self-hosted branch → stale geometry) on **2026-07-09 — but only in `UpdateOpeningParamsCommand`.** Its twin kept a **copy-pasted `resolveHostWall()`** and carried **both bugs**: every family-type assign/clear on a self-hosted κούφωμα was dropped, and a type-driven width change left `outline/position/rotation` stale. The `wallId?` optionality made it read as type noise rather than the bug it was. **Root cause of the recurrence: the host-branch choice was copy-pasted per command, not SSoT.** Extracted `core/commands/entity-commands/opening-derived-state.ts` (`resolveOpeningHostWall` + `computeOpeningDerivedState` + `applyOpeningDerivedPatch` + `validateOpeningHostRef`); both writers now go through it, so a future opening writer cannot "forget" the self-hosted branch. See ADR-615 changelog 2026-07-16.

**Verification:** 549/550 green across entity-commands + cascade + validators, incl. a **new `AssignOpeningTypeCommand.test.ts` (6 tests)** guarding RC3′/RC4′ as regressions. `jscpd:diff` clean on all 15 files (N.18) — the extraction removed a twin rather than adding one. All 15 touched files are error-free in the final type-check.

**Count: 84 → 67 from this batch.** The full run reports **68**, because one **unrelated** error appeared concurrently in `export/core/entity-export-coverage.ts` (TS2741, `"topo-surface"` missing from an exhaustive `Record`) — the file is **unmodified in this working tree**; a `topo-surface` entity type was added elsewhere without updating the exhaustive coverage record. That is the same completeness-anchor class as `move-entity-geometry-coverage` (§4 part 2) and belongs to concurrent work — **not touched here.**

**Note on the pattern.** Two sessions running, the biggest wins came from the same shape: *a consumer re-declaring, or re-deriving, what its producer already owns.* Part 2 called it out for types; part 3 shows the harsher version — when the producer's shape encodes a **domain rule** (`wallId?` ⇒ "may be self-hosted"), a consumer ignoring it is not a type error, it is a **feature silently not working**. Grouping by TS code before fixing is what surfaces it; fixing file-by-file would have hidden it as 13 unrelated casts.

---

## Changelog

| Date | Change |
|---|---|
| 2026-07-16 | ADR created. CHECK 3.29 live: engine + 39 Jest tests + per-file baseline (381 errors) + CI Layer 2 + pre-commit Layer 1 smoke. Source errors burned 205 → 117 in the same session (§4). |
| 2026-07-16 | Burn-down part 2: source 117 → 84 (−33), total 381 → 337 (−44 across 15 files; test errors 264 → 253 as a side effect of three shared-guard roots). Fixed a **live ESC bug** found via the type errors (wall-merge / wall-gap-opening ESC handlers were never registered — §4 batch 4). Baseline **not** re-locked: the fixes are uncommitted, and an un-paired baseline would over-tighten CI. Run `npm run dxf:tsc:baseline` after committing. |
| 2026-07-16 | Burn-down part 3: source 84 → **67** (−17 across 15 files; full run reports 68 due to one concurrent, unrelated `entity-export-coverage.ts` error in an unmodified file — §4 part 3). **ONE root**: `OpeningParams.wallId?` is the ADR-615 self-hosted discriminator, and 13 consumers were reading it as always-present, i.e. **silently ignoring self-hosted openings**. All routed through the existing `isWallHostedOpening()` predicate. Fixed a **live bug**: `AssignOpeningTypeCommand` still carried ADR-615 RC3/RC4 (family-type assign on a self-hosted κούφωμα silently rejected + stale geometry) because the host-branch logic was copy-pasted from its twin instead of shared — extracted to `opening-derived-state.ts` SSoT; +6 regression tests. Baseline still **not** re-locked (fixes uncommitted). |

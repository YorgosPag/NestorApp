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

**Remaining 117 source errors** are a long tail of one-offs across ~110 files — no further shared root causes of size. The ratchet is what holds the line while they are burned down opportunistically (Boy Scout rule, N.0.2).

---

## Changelog

| Date | Change |
|---|---|
| 2026-07-16 | ADR created. CHECK 3.29 live: engine + 39 Jest tests + per-file baseline (381 errors) + CI Layer 2 + pre-commit Layer 1 smoke. Source errors burned 205 → 117 in the same session (§4). |

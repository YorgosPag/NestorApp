# ADR-584: Token-based Copy/Paste Clone Ratchet (jscpd) — CHECK 3.28

## Status
✅ **ACTIVE — 2026-07-08 — BASELINE 4548 clones (3.92%) over src/** — Layer 1 (pre-commit diff gate) + Layer 2 (CI full-repo ratchet) live. Baseline: `.jscpd-baseline.json`. Config SSoT: `.jscpdrc.json`. Engine: `scripts/check-jscpd-ratchet.js` (+ 39 Jest tests). CI: `.github/workflows/jscpd-ratchet.yml`.

**Related:**
- **ADR-314** (SSoT Discover Ratchet, CHECK 3.18) — the name/regex-based detector this ADR complements. CHECK 3.18 finds duplicate *names* and registry gaps; CHECK 3.28 finds duplicate *token sequences* regardless of name. Both run; neither replaces the other.
- **ADR-294** (SSoT Ratchet Enforcement) — the ratchet philosophy (violations only decrease) that this check mirrors.
- **ADR-299** (Ratchet Backlog Master Roadmap) — CHECK 3.28 is a new ratchet candidate; baseline drift >10% updates §2 there.
- **CHECK 3.22** (Dead-code Ratchet) — the "fast local smart-skip + authoritative CI full scan" pattern reused here.

---

## Context

Giorgio's recurring failure mode, confirmed 2026-07-08: **when centralizing code, new duplicates are born in the same commit.** The pattern is "centralize A, then write B and C as parallel twins" — e.g. `clipHatch` copy-pasted as `clipHatchByPoly` (identical body, different name).

The existing gate is structurally blind to this:
- **CHECK 3.7** (`.ssot-registry.json` ratchet) only blocks regressions of *already-registered* patterns.
- **CHECK 3.18** (`ssot:discover`) discovers *new* duplicate **names** and registry gaps — but it is **name/regex-based**. A clone with a **different name** is invisible to it. `grep -i jscpd package.json` = empty → no token-based detector existed.

Big-player practice for exactly this problem:
- **Google**: Tricorder static analysis + automated clone detection + canonical libs (Abseil/Guava).
- **Meta/Figma**: CI clone-detection gates + shared design-system packages.
- **Universal tool**: a **token-based Copy/Paste Detector** with a **ratchet baseline** — catches clones regardless of name, even within a single diff.

The chosen tool is **jscpd** (v5.0.11, **MIT** — verified via `npm view jscpd license` and the installed `package.json`; a `devDependency`, so it is excluded from CHECK 12's `--production` license scan). It is a token-based detector with a JSON reporter.

---

## Decision

Add **CHECK 3.28 — token-based clone ratchet** as a **two-layer** gate that mirrors CHECK 3.18 / CHECK 3.22, **reusing the existing ratchet framework** (baseline-load → scan → compare → smoke/full modes → Jest suite) rather than inventing a new one.

### Layer 1 — pre-commit diff gate (`--diff`)
`scripts/git-hooks/pre-commit` Phase 0.6 runs jscpd over **only the staged src files**. Because the scan set *is* the diff, every clone jscpd reports is a **same-commit sibling clone** → **BLOCK**, listing the offending file pairs and line ranges. This is the direct guarantee against Giorgio's failure mode (α).

Runs **sequentially in bash**, NOT inside `run-checks-parallel.js`, because jscpd spawns child processes which deadlock inside the Node `worker_threads` pool — the same reason Phase 0.5 (hardcoded-strings) runs sequentially.

Zero-tolerance on new intra-diff clones (Giorgio's choice: *hybrid* gate). Escape hatch: `SKIP_JSCPD_DIFF=1 git commit …` (must be justified to Giorgio).

### Layer 2 — CI full-repo ratchet (`--full`)
`.github/workflows/jscpd-ratchet.yml` re-runs a **full `src/` scan** on every PR / push to `main`, reads `statistics.total.clones` from the JSON report, and compares it to `.jscpd-baseline.json`. **Total rose → BLOCK.** Ratchet-down only: duplication may only decrease (β). This is the authoritative gate and also catches a new file cloning **already-committed** code, which a staged-only scan cannot see. Also runnable locally: `JSCPD_FULL=1` or `npm run jscpd:check`.

### Config SSoT
`.jscpdrc.json` is the single source of truth for `minTokens`, formats, and ignore globs. The engine, the npm scripts, and CI all defer to it — no second threshold is hardcoded anywhere.

### Resolved open decisions (Giorgio, 2026-07-08)
| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Threshold** (`minTokens`) | **50** (strict, ~5–8 lines) | Catches small clones like `clipHatch`/`clipHatchByPoly`. Maximum guarantee. |
| **Scope** | **All of `src/`** | Big-player standard: lock the whole app's current state, ratchet down from there. |
| **Gate strictness** | **Hybrid** | Pre-commit blocks any NEW intra-diff clone (α) + CI ratchets the total (β). |
| **Local cost** | staged-only fast local + full authoritative in CI | Mirrors CHECK 3.22; full scan is ~10s and stays in CI. |

### AI-workflow self-diff guard
Before declaring any centralization "done", the agent runs `npm run jscpd:diff <its staged files>` (same engine as the hook) so it cannot ship sibling clones and call it centralized. Encoded as CLAUDE.md rule **N.18** + memory `reference_jscpd_clone_ratchet_ssot`.

---

## Architecture

```
                      .jscpdrc.json  (SSoT: minTokens=50, formats, ignores)
                             │
          ┌──────────────────┴───────────────────┐
          │                                       │
  Layer 1 (pre-commit)                    Layer 2 (CI, authoritative)
  scripts/git-hooks/pre-commit            .github/workflows/jscpd-ratchet.yml
  Phase 0.6  → --diff <staged src>        → --full  (whole src/)
  blocks same-commit sibling clones       ratchets statistics.total.clones
          │                                       │      vs .jscpd-baseline.json
          └───────────────┬───────────────────────┘
                          │
             scripts/check-jscpd-ratchet.js
             parseArgs · runScanner(jscpd) · parseSummary
             loadBaseline · compare · writeBaseline
             runDiff · runFull · runSmoke
                          │
             scripts/__tests__/check-jscpd-ratchet.test.js  (39 tests)
```

**npm scripts:**
- `jscpd:scan` — human HTML/console report (diagnose where clones are)
- `jscpd:baseline` — lock the current total into `.jscpd-baseline.json`
- `jscpd:check` — full scan + ratchet compare (what CI runs)
- `jscpd:diff <files>` — the pre-commit / self-guard diff gate
- `test:jscpd` — the Jest suite

---

## Baseline & maintenance

- **Baseline**: 4548 clones / 58309 duplicated lines (3.92%) over `src/`, min-tokens 50, 2026-07-08.
- After legitimate de-duplication, run `npm run jscpd:baseline` to lock progress downward.
- The baseline **never rises** without an explicit, justified refresh.

---

## Changelog

- **2026-07-08** — ADR created. CHECK 3.28 implemented end-to-end: `.jscpdrc.json`, `scripts/check-jscpd-ratchet.js` (diff/full/smoke/write-baseline), `.jscpd-baseline.json` (4548), pre-commit Phase 0.6 diff gate, `.github/workflows/jscpd-ratchet.yml` CI ratchet, 39 Jest tests (all green), npm scripts `jscpd:*` + `test:jscpd`. jscpd@5.0.11 (MIT) added as devDependency via pnpm. Open decisions resolved with Giorgio (min-tokens 50, whole src/, hybrid gate).
- **2026-07-08** — Clone dedup pass (CHECK 3.28 diff-gate driven). Extracted `utils/scalar-math.ts` as the neutral, dependency-free SSoT for the `clamp` / `clamp01` / `clamp255` family + arc-length/circular sampling helpers (`path-sampler-strategies/path-sample-math.ts`), plus `raySegmentsIntersection`, `useGripMovement` scene-entity helpers, `grip-types` `export type *`, `DxfProjection` alias and `readParamsKind`. Canvas/micro-leaf consumers (`guide-click-handlers.ts`, `rendering/entities/shared/geometry-rendering-utils.ts`, `geometry-utils.ts` — the latter re-exports the clamp family for backward compat) now import from `scalar-math` instead of inlining `Math.max/min` clamps. Pure SSoT adoption — **no behavioural or ADR-040 architecture change** (documented here to satisfy the CHECK 6B/6D ADR gate). Split `grip-commit-adapters.ts` (→ `grip-parametric-dispatch.ts`) and `useRibbonCommands.ts` (→ `useRibbonToggleCommands.ts`) under the 500-line limit (N.7.1).
- **2026-07-14** — Clone dedup: `ThreeJsSceneManager` sync signatures → `FloorVisibilityScope` options object (in-file clone pair, `syncBimEntities` 293-298 ~ `syncBimEntitiesMultiFloor` 322-327: same 5 positional params — `floors`/`buildings`/`activeBuildingId`/`buildingVisModes`/`floorVisModes` — with identical defaults). Extracted ONE named `FloorVisibilityScope` type + `EMPTY_FLOOR_VIS_SCOPE` const in `scene-manager-actions.ts` (big-player option-bag convention: Three.js `set(options)` / Revit API option bags). Both `ThreeJsSceneManager` public wrappers now take a single `scope: FloorVisibilityScope = EMPTY_FLOOR_VIS_SCOPE` param and spread it; both `SyncBimEntitiesArgs`/`SyncMultiFloorBimEntitiesArgs` flat-intersect it (`… & FloorVisibilityScope`) so `scene-manager-sync.ts` internals (reading `args.floors`/… directly) stay byte-identical; the 3 `bim3d-resync.ts` call sites compose via a `buildFloorVisibilityScope(s, floorModes)` helper (external site = `{ ...EMPTY_FLOOR_VIS_SCOPE, floorVisModes }`). **Pure internal SSoT dedup — identical defaults & call-site values, no behavioural change** (documented here to satisfy the CHECK 6D ADR gate; behaviour ADRs ADR-399 Phase B / ADR-382 unchanged).

  **Same pass — the 2 pre-existing `scene-manager-actions.ts` self-clones that co-staging surfaced were also cleared** (no `SKIP_JSCPD_DIFF` needed): (a) `rebuildBimMeshes(deps, scope, buildGeometry)` now owns the highlighter-clear → focus-clear → **build** → BVH-rearm → building-visibility → selection-reapply → path-tracer → section sequence shared by `syncBimEntitiesIntoScene` / `syncMultiFloorBimEntitiesIntoScene` (they differ ONLY in the `BimSceneLayer.sync` vs `.syncMultiFloor` call, injected as `buildGeometry`); (b) `finalizeDxfOverlaySync(deps, fitDone, onFitApplied)` owns the invalidate → frame → section tail shared by `syncDxfOverlayIntoScene` / `syncDxfOverlayMultiFloorIntoScene`. Exported signatures unchanged → `scene-manager-sync.ts` and all callers untouched. The conditional-vs-unconditional `ssaoModulator.warmUp()` difference lives in `scene-manager-sync.ts` (NOT these functions), so both extractions are behaviour-identical. **Verified: `jscpd:diff` on all 3 files = 0 clones (was 2); 126 jest GREEN across `bim-3d/scene`.** Baseline drops → run `npm run jscpd:baseline` after commit.
- **2026-07-16** — Clone dedup: the 10-item `common` + `common-*` namespace array passed to `useTranslation([...])` was **byte-identical in 137 files** (the CHECK 3.28 diff-gate tripped when the two sales sidebars — ADR-199 — co-staged; the array is invisible to the full-repo ratchet because a single scattered ~30-token line/file never reaches min-tokens 50 pairwise). Centralized to **one SSoT const** `COMMON_NAMESPACES` in `src/i18n/namespace-bundles.ts`; all 137 files + the 2 sidebars now `useTranslation(COMMON_NAMESPACES)` (the redundant `SALES_SPACE_SIDEBAR_NAMESPACES`, added the prior session, was byte-identical → removed). **Tooling contract fix (the non-obvious half):** CHECK 3.8 (`check-i18n-missing-keys.js`) and the baseline generator learn a file's namespaces by regex-matching the *literal* `useTranslation([...])` array — a bare const reference would match nothing → `namespaces.length === 0` → the file is silently **skipped**, dropping `t()` key validation for it. So both scripts now share `scripts/lib/i18n-namespace-extract.js` (SSoT — the two previously carried a duplicate `extractNamespaces`), which resolves a bundle identifier back to its list by statically reading `namespace-bundles.ts` (mirrors CHECK 3.13's `readServiceFormNamespaces`). `useTranslation`'s param widened `string[]` → `string | readonly string[]` so `as const` bundles type-check. **Verified coverage-neutral:** per-file `git show HEAD` differential — every touched file extracts the *identical* namespace set inline-vs-const (NotificationProvider 10↔10, still fully checked); CHECK 3.8 exit 0 on sample; 8 new jest tests GREEN (`scripts/__tests__/i18n-namespace-extract.test.js`). No locale keys, no `t()` calls, no runtime behaviour changed.

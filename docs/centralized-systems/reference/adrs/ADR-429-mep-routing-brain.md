# ADR-429 — MEP Routing Brain (wall-aware A* router + parallel supply/return pairing)

> **Status:** 🟢 **Slice 3A (A\* wall-aware router) + Slice 3B (parallel supply/return pairing) IMPLEMENTED** — 2026-06-09 (Opus 4.8). Child slice of **ADR-423** (MEP Auto-Design framework). The **routing upgrade all three disciplines share** — water (ADR-426), drainage (ADR-427), heating (ADR-428).
> **Scope (Slice 3A):** make MEP runs detour **around walls** instead of crossing them diagonally / through them, by swapping the bare Manhattan router for a wall-aware A\* — **without touching the `RoutedSegment` contract**, so all three orchestrators inherit it for free. Headless geometry → **ΕΚΤΟΣ ADR-040**.
> **Decision driver (Giorgio, 2026-06-09):** *«FULL ENTERPRISE + FULL SSOT, όπως οι μεγάλοι παίχτες / Revit / MagiCAD / 4M FINE»*.

---

## 1. Context

ADR-426 §A introduced the shared `routeOrthogonalTrunkBranch` (deterministic Manhattan trunk-branch) as the **single router every discipline reuses**, and its own header declared it a **swap point**: *"NOT yet wall-obstacle-aware — architected to grow into A\* (a later slice swaps this function, the orchestrator/contract unchanged)."* All three functional disciplines route through it today (water directly, drainage via `gravity-router`, heating ×2 for supply+return), so a single wall-aware upgrade benefits all three at once. What was missing is the **brain**: an A\* pathfinder + a wall→obstacle extractor + the swap entry point.

Walls are **not** taken from `RecognitionModel` (`'structural-wall'` is reserved-but-unpopulated there, ADR-424) — they come from the `entities` array every orchestrator already receives, via `isWallEntity` + the cached `geometry.bbox`.

---

## 2. Decision — per-run A\* detour over the reused Manhattan decomposition

The wall-aware router does **NOT** re-derive the trunk-branch brain (spine axis, arm split, tap points, cumulative loading + min-Ø). It keeps the decomposition as the **single source of truth** and only refines geometry:

```
routeWallAware(root, targets, obstacles)
  1. runs = routeOrthogonalTrunkBranch(root, targets)        ← reused VERBATIM (decomposition + fallback)
  2. for each run:
       run crosses a wall?  →  replace with A* detour = collinear RoutedSegments
                                carrying the parent run's metadata VERBATIM
       run clears walls?    →  keep byte-identical
  3. no obstacles  OR  A* finds no path  →  keep the run straight (Manhattan)
```

**Why this is FULL SSoT + zero-regression:**
- The decomposition is reused 100% (one literal call) — no duplicated spine/arm logic.
- The `RoutedSegment` contract (`start/end/role/cumulativeLU/cumulativeMinDiameterMm`) is **unchanged** ⇒ the three orchestrators' post-processing (sizing, slope, commit) is untouched.
- **Root-outward ordering** (relied on by drainage slope assignment) survives: a detour is traversed `start→end`, so every emitted sub-run's `start` stays upstream of its `end`.
- No walls in a scene ⇒ output **identical** to Manhattan ⇒ the 48 pre-existing mep-design tests are untouched (verified: 68/68 green, 48 prior + 20 new).

### The A\* pathfinder (`astar-grid.ts`)
A lightweight **Hanan grid**: candidate x/y lines = the two run endpoints' coords + every inflated-obstacle edge inside a local window + uniform `cell` steps. Because both endpoints and all wall faces are grid lines, the search threads gaps a fixed uniform grid would miss, while staying small (a few dozen lines/axis). **4-way** moves (orthogonal — Revit MEP convention, no diagonals); binary-heap A\* with Manhattan heuristic; edges blocked only by **interior** wall crossings (a run hugging a wall face = free). The wall hosting either endpoint is excluded for that run (you don't route around the wall your own fixture sits on). Returns `null` (→ straight fallback) on no-path or when a perf guard trips. Pure + deterministic.

---

## 3. Decisions taken (Revit-grade, LOCKED — pluggable via `opts` / SSoT consts in `routing-constants.ts`)

| Decision | v1 choice | Rationale |
|---|---|---|
| **Grid resolution** | `ASTAR_CELL_SCENE = 150` (scene units; Nestor mm convention) | fine enough for a doorway, coarse enough to stay fast; Hanan lines add the precision |
| **Inflation margin** | wall `bbox` (already thickness-aware) **+ `WALL_CLEARANCE_SCENE = 75`** | pure stand-off so the pipe centreline never grazes the face |
| **4-way vs 8-way** | **4-way orthogonal** | Revit MEP routes orthogonally — clean horizontals/verticals |
| **Fallback** | walls = 0 **or** A\* no-path/budget → **straight run (Manhattan)** | zero-regression guarantee |
| **Local window** | run bbox + `ASTAR_LOCAL_MARGIN_SCENE = 1500` | room for the detour to bulge past a wall end |
| **Perf guards** | `ASTAR_MAX_CELLS = 40000`, `ASTAR_MAX_ITERATIONS = 20000` → fallback | bounds worst-case cost on pathological geometry |
| **Units** | router is **unit-agnostic** (works in input coord space) | mm-named consts assume the Nestor mm scene convention; `opts` override hook |

---

## 4. Files (Slice 3A)

**New (`systems/mep-design/routing/`):**
| File | Role |
|---|---|
| `routing-constants.ts` | SSoT consts + `Rect2D` (mirrors `core/spatial` `SpatialBounds` shape) |
| `wall-obstacles.ts` | `wallObstacles(entities, clearance)` → inflated `Rect2D[]`; + `pointInRect` / `segmentHitsRect` / `segmentHitsObstacles` (axis-aligned, boundary = free) |
| `astar-grid.ts` | `findOrthogonalPath(start, end, obstacles, opts)` — Hanan-grid 4-way A\* (binary heap), or `null` |
| `route-wall-aware.ts` | `routeWallAware(root, targets, obstacles, opts?)` — the SSoT swap entry, same contract as Manhattan |
| `__tests__/{wall-obstacles,astar-grid,route-wall-aware}.test.ts` | 20 unit tests (incl. zero-regression equality vs Manhattan) |

**Modified (additive swap, ≤2 lines of logic each):**
- `water/design-water-supply.ts` — `wallObstacles(entities)` once → `routeWallAware`.
- `drainage/gravity-router.ts` (+ `design-drainage.ts`) — thread `obstacles` → `routeWallAware`.
- `heating/design-heating.ts` — `wallObstacles(entities)` once, passed to both `buildNetwork` (supply + return).

**Reused (SSoT, not rewritten):** `routing/orthogonal-router.ts` (decomposition + fallback), `types/entities.ts` (`isWallEntity`, `WallEntity.geometry.bbox`), `core/spatial` `SpatialBounds` shape.

---

## 5. Slice 3B — parallel supply/return pairing (IMPLEMENTED — 2026-06-09)

Before 3B, `design-heating.ts` routed supply + return **independently**, so the two trunks overlapped (in the integration test the rad-supply / rad-return runs landed on the SAME geometry). Revit/MagiCAD/4M-FINE run them **parallel at a fixed offset**. **Implementation:** a pure `heating/pair-supply-return.ts` builds the **return** network as a constant **lateral offset of the already-routed supply spine** — no 2nd router pass; the return *inherits* the supply geometry, guaranteeing parallelism:
1. **Reconstruct arms** — chain the supply `role:'trunk'` segments head-to-tail from `sourcePoint` outward into ≤2 arms (left/right of the root).
2. **DN-aware offset** — `offsetMm = maxTrunkDN + PAIRING_CLEARANCE_SCENE (30)`, applied via `offsetPolyline` (ADR-358, `join:'miter'`). `+offset` = left of travel, so the right arm offsets +y and the left arm −y (consistent twin runs). z is dropped back to Point2D (the loop is flat; Slice 2 re-stamps z = sourceElevationMm at commit).
3. **Offset trunks** copy each run's `cumulativeFlowLps` + `diameterMm` from the supply counterpart by vertex index (orthogonal 90° corners ⇒ miter keeps vertex count).
4. **Root stub** bridges the boiler return inlet → each offset arm's start (carries the arm total).
5. **Re-tap branches** — every terminal's return connector drops from the nearest point on the offset trunk (`getNearestPointOnLine`, ADR-065) → its `returnPoint`. This also fixes "branch-less targets" (a target that fell on the supply spine previously had no branch).

**Gate (`design-heating.ts`):** pairing runs only when the supply network exists, there are **no wall obstacles** (no-detour), and the supply has ≥1 trunk; otherwise the return keeps its independent wall-aware route. All invariants preserved (`hydronic-return` classification incl. the stub, `totalFlowLps` = supply's, trunk DN ≥ branch DN). 76/76 mep-design tests green (68 prior + 8 new). NEW `heating/pair-supply-return.ts` + `__tests__/pair-supply-return.test.ts`; MOD `heating/design-heating.ts`, `heating/index.ts`. ΕΚΤΟΣ ADR-040 (headless).

**Slice 3C — wall-aware pairing (IMPLEMENTED 2026-06-09):** the earlier "uniform offset + A\* detour don't compose" limitation is resolved by the **"pipe rack" model**. The reference spine is already an A\* detour (a chain of collinear runs the core reconstructs verbatim), so its lateral offset naturally follows the same detour shape — the pair runs parallel *through* the detour. Only where the offset would land ON a wall (the side facing it) does the core **locally repair** that run with the SAME `findOrthogonalPath` A\*, splitting it into detour sub-runs that keep their index tag. Both wrappers thread `obstacles` into `buildOffsetPairing(opts.obstacles)`; the no-walls gate is dropped (pairing now always runs when there is ≥1 trunk). No obstacles ⇒ repair is a no-op ⇒ byte-identical to 3B. **Residual:** a branch whose re-tap point falls *inside* a wall band (offset deeper than the reference standoff) degrades to the straight fallback (may clip) — same graceful fallback as `route-wall-aware`, never a crash; and tight U-turn miter offsets can self-intersect (cosmetic).

**SSoT core (2026-06-09):** the pairing geometry was extracted to a **discipline-agnostic core** `routing/offset-pairing.ts` (`buildOffsetPairing`) — arms reconstruction + `offsetPolyline` + root stub + `getNearestPointOnLine` re-tap, speaking only geometry and returning **index-tagged** runs (`sourceTrunkIndex` / `armFirstTrunkIndex` / `targetIndex`) so each caller copies its own per-run metadata. `heating/pair-supply-return.ts` is now a **thin wrapper** over it (zero behaviour change, 27/27 heating tests green). The **2nd consumer is water cold/hot** (ADR-426) — no copy-paste (Boy-Scout N.0.2).

**Deferred after 3C:** global (cross-run) A\* / jump-point search if per-run detours prove insufficient; robust branch re-tap when the offset spine pokes inside a wall band (currently graceful straight fallback); self-intersection clean-up on tight U-turn miter offsets.

---

## 6. Consequences

- ✅ One router, three disciplines: water/drainage/heating all detour around walls with no per-discipline code.
- ✅ Zero-regression: delegate-on-no-walls keeps the Manhattan path byte-identical; 68/68 tests green.
- ✅ Contract intact: sizing/slope/commit layers untouched.
- ⚠️ Per-run (not global) A\*: each run detours independently — sufficient for "go around walls" v1; a globally-optimal path may differ. Documented limitation.
- ⚠️ Units assume the mm scene convention for the default consts (override via `opts`).

---

## Changelog
- **2026-06-09 (Opus 4.8)** — **Slice 3C: wall-aware pairing.** The offset twin is now obstacle-aware ("pipe rack" model): the geometric offset follows the reference's A\* detour, and any offset run (trunk/stub/branch) landing on a wall is locally repaired via the router's own `findOrthogonalPath`, keeping its index tag. `routing/offset-pairing.ts` gains optional `opts.obstacles`; both wrappers thread it; the `obstacles.length===0` pairing gate is removed in `design-heating.ts` + `design-water-supply.ts`. No-obstacles ⇒ no-op ⇒ byte-identical to 3B. +3 tests (2 core + 1 water). 91/91 mep-design green. Residual documented (branch-inside-wall fallback; tight-U-turn self-intersection). ΕΚΤΟΣ ADR-040. tsc deferred (N.17).
- **2026-06-09 (Opus 4.8)** — Pairing core **generalised to SSoT**: new discipline-agnostic `routing/offset-pairing.ts` (`buildOffsetPairing`, index-tagged geometry) + `routing/__tests__/offset-pairing.test.ts` (6 tests). `heating/pair-supply-return.ts` refactored into a thin wrapper over it (zero-regression, 27/27 heating green). **2nd consumer = water cold/hot pairing** (ADR-426) — no copy-paste (Boy-Scout N.0.2). 88/88 mep-design tests green. ΕΚΤΟΣ ADR-040 (headless). tsc deferred (N.17 — shared tree).
- **2026-06-09 (Opus 4.8)** — Slice 3B implemented: parallel supply/return pairing for heating. New pure `heating/pair-supply-return.ts` (`buildPairedReturnNetwork`) builds the return as a DN-aware lateral offset of the supply spine (`offsetPolyline` ADR-358 + `getNearestPointOnLine` ADR-065 re-tap), gated to the no-walls case. MOD `design-heating.ts` (gate) + `heating/index.ts`. 76/76 mep-design tests green (68 + 8 new). ΕΚΤΟΣ ADR-040 (headless). tsc deferred (N.17 — shared tree). §5 flipped PLANNED→IMPLEMENTED.
- **2026-06-09 (Opus 4.8)** — Slice 3A implemented: wall-aware A\* router swapped into all three disciplines (delegate-on-no-walls). New `routing/{routing-constants,wall-obstacles,astar-grid,route-wall-aware}.ts` + 20 tests. 68/68 mep-design tests green. Slice 3B (pairing) approach locked, deferred to its own gate. ΕΚΤΟΣ ADR-040 (headless). tsc deferred (N.17 — shared tree, could not verify no concurrent tsc).

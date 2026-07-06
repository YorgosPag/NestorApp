# ADR-090: Point Vector Operations Centralization

| Metadata | Value |
|----------|-------|
| **Status** | REACTIVATED & ENFORCED (2026-07-06) |
| **Date** | 2026-01-01 (reactivated 2026-07-06) |
| **Category** | Data & State |
| **Canonical Location** | `geometry-vector-utils.ts` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## ⚡ 2026-07-06 — Reactivation: point+vector translation consolidation

**Problem (why reactivated):** ADR-090 declared centralized vector ops in 2026-01 but was **never enforced**. The single most fundamental op — `point + delta` translation — had drifted into **13 divergent named helpers** (`applyDelta` ×2, `shiftPoint3D` ×2, `shiftPolygon3D`, `translateVertex` ×5, private `translatePoint` scalar, private 2-arg `offsetPoint`, `translate3D`) **plus ~140 inline `{ x: p.x + delta.x, y: p.y + delta.y }` literals across ~90 files**.

**Big-player check (Giorgio's mandate — follow the majors):** three.js keeps ONE `.add(v)` / `.addVectors(a,b)` per vector dimension (`Vector2`, `Vector3`); glMatrix keeps `vec2.add` / `vec3.add`. Point translation and vector sum are the **same primitive** — they are NOT separate functions. `addScaledVector` (our `offsetPoint`) and `sub` (`subtractPoints`) stay separate. Full-transform translation is a matrix (out of scope at point level). → We converge to ONE `add` per dimension.

**Canonical (all in `rendering/entities/shared/geometry-vector-utils.ts`, re-exported via `geometry-rendering-utils.ts`):**

| Helper | Signature | Semantics |
|---|---|---|
| `translatePoint<T extends Point2D>(p, delta)` | `T` | 2D `p + delta`, **z-PRESERVING** via `{...p}` spread (the one 2D `.add`). |
| `translatePoints<T>(pts, delta)` | `T[]` | Array sibling. |
| `translatePoint3D(p, delta)` | `Point2D & {z:number}` | Plan move → **Firestore-safe** Point3D (`z := p.z ?? 0`, never `undefined`). |
| `translatePoints3D(pts, delta)` | `(…{z:number})[]` | Array sibling. |
| `addPoint3D<T>(a, b)` | `T` | Genuine 3D vector sum (`z := a.z + b.z`) — the `vec3.add`. |
| `addPoints(p1, p2)` | `Point2D` | Thin alias → `translatePoint` (kept for symmetric-sum readability). |

`offsetPoint(p, dir, dist)` (`= addScaledVector`) and `subtractPoints` remain **distinct** — do NOT fold them in.

**Two `z` policies, deliberately separate:** `translatePoint` PRESERVES `p.z` verbatim (pure geometry; an absent z stays absent). `translatePoint3D` COALESCES `z ?? 0` (persisted params — Firestore rejects explicit `undefined`). Grip/move paths that build a persisted Point3D use `translatePoint3D`; pure geometry uses `translatePoint`.

**Enforcement (SSoT ratchet, ADR-294):** module `point-translate-helpers` in `.ssot-registry.json` (tier 3, **zero-tolerance**) forbids re-declaring `function applyDelta|shiftPoint3D|shiftPolygon3D|translateVertex`. Golden fixture in `registry-golden-fixtures.js`; verified by `npm run test:registry-golden` (68/68). **Inline-literal discipline is by convention + code review + this ADR, NOT a content pattern** — CHECK 3.7 is repo-wide with no path scoping, so a generic `{x:a.x+b.x,y:a.y+b.y}` ban would over-block non-dxf vector math and every thin delegator.

**Known grandfathered (baselined, not fixed):** ~4 z-coalesce sites where the output `z` comes from a DIFFERENT source than the translate operand (e.g. `frame.center + shift` with `z: params.position.z ?? 0` in `column-rect-adapter` / `foundation-grips-pad-frame`) — not expressible as a single-operand helper; Boy-Scout later.

**Changelog:**
- 2026-07-06 — Reactivated & enforced. Added `translatePoint`/`translatePoints`/`translatePoint3D`/`translatePoints3D`/`addPoint3D`; `addPoints` → delegates to `translatePoint`. Eliminated 13 duplicate helpers, migrated ~150 sites across ~90 files (2 orchestrator rounds, 13 agents). Added ratchet module `point-translate-helpers` + golden fixture. Canonical location moved from `geometry-rendering-utils.ts` (barrel) to its real home `geometry-vector-utils.ts`.

---

## Summary

- **Canonical**: `subtractPoints()`, `addPoints()`, `scalePoint()`, `offsetPoint()` from `geometry-rendering-utils.ts`
- **Impact**: 15+ inline vector arithmetic patterns → 4 centralized functions
- **Problem**: Duplicate vector arithmetic patterns scattered across 8+ files:
  - `{ x: p1.x - p2.x, y: p1.y - p2.y }` - Vector subtraction
  - `{ x: point.x + dir.x * dist, y: point.y + dir.y * dist }` - Point offset
- **Solution**: Centralized vector arithmetic functions
- **API**:
  ```typescript
  // Vector subtraction: p1 - p2 = vector from p2 to p1
  subtractPoints(p1: Point2D, p2: Point2D): Point2D

  // Vector addition
  addPoints(p1: Point2D, p2: Point2D): Point2D

  // Scale vector by scalar
  scalePoint(point: Point2D, scalar: number): Point2D

  // Offset point by direction * distance (combines add + scale)
  offsetPoint(point: Point2D, direction: Point2D, distance: number): Point2D
  ```
- **Files Migrated**:
  - `geometry-utils.ts` - `angleBetweenPoints()` vector calculations
  - `useUnifiedDrawing.tsx` - Measure-angle tool vector calculations
  - `PolylineRenderer.ts` - Rectangle side vectors (4 patterns)
  - `useDynamicInputMultiPoint.ts` - Angle calculation vectors
  - `angle-utils.ts` - Uses `pointOnCircle()` for label positioning
  - `text-labeling-utils.ts` - Uses `offsetPoint()` for text positioning
  - `line-utils.ts` - Uses `offsetPoint()` for gap calculations
- **Pattern**: Single Source of Truth (SSOT)
- **Benefits**:
  - Zero duplicate vector arithmetic
  - Consistent API: `subtractPoints(p1, p2)` instead of `{ x: p1.x - p2.x, ... }`
  - Clear semantic meaning (subtract vs offset vs scale)
  - Type-safe Point2D interface
- **Companion**: ADR-065 (Distance), ADR-073 (Midpoint), ADR-074 (Point On Circle)

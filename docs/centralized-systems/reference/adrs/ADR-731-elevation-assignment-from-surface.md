# ADR-731 — Elevation Assignment from Surface (Topography)

**Status**: Implemented v1  
**Owner**: Giorgio Pagonis  
**Date**: 2026-07-29  
**Replaces**: ADR-720 §5 (raw guidance); informs ADR-725 (coverage QA)

---

## 1. Problem

BIM projects demand elevation assignment from surfaces in several contexts:

1. **New survey points** added to a parcel after initial survey — need interpolation from the TIN
2. **Site model points** (slab edges, building corners) placed at 2D, need Z from terrain
3. **Bridge/island points** flagged by QA (ADR-725) — need assignment with user awareness

Existing tools provide no transparency:
- **Civil 3D**: Single click → no preview of what will change, no flag for bridges, allows overwriting measured Z
- **Trimble Business Center**: Separate "strip" command (cleanup), but no bridge detection
- **Carlson**: Manual checkbox "Non-Surface" per point, checkbox-dependent (easy to forget)

**The gap**: Users execute without seeing consequences, measured data gets clobbered, surfaces self-feed on derived points.

---

## 2. Solution Architecture

### 2.1 Three-State Elevation Model

| State | Example | z | zSource |
|-------|---------|---|---------|
| **Measured** | Survey shot | 1234 mm | *undefined* (default) |
| **Derived** | Interpolated from TIN | 1200 mm | `'derived'` |
| **Absent (2D)** | Placed without Z | *undefined* | *undefined* |

The `zSource` field answers: **who put this Z here?** (not "does Z exist?", which the type already answers).

**Why not a boolean `isInterpolated`?** ADR-720 §3.1 forbids flags answering existence — but `zSource` answers provenance, a different question. Validated by Carlson's "Non-Surface" tag and Trimble's separate "strip" command — both track source.

### 2.2 Structural Lock Against Circular Dependency

**The Core Insight**: Derived elevations are **filtered from the TIN vertex set**.

```typescript
// In topo-point-elevation.ts
export function surfacePointsOf(points: readonly TopoPoint[]): readonly TopoPoint3D[] {
  return points.filter(isMeasuredElevation);
  //              ↑ ONLY measured points feed the surface
}
```

This makes self-feeding **structurally impossible**:
1. User interpolates point P from TIN surface S
2. P receives `zSource: 'derived'`
3. `surfacePointsOf()` filters P out
4. S's vertex set is unchanged
5. S's Z at P's location is still based on the **original** measured points, not P itself

**Without this**: P reads Z from S (iteration 1) → P becomes a vertex of S (iteration 2) → S's local answer moves → next P reads moved answer → cascade amplifies small errors.

### 2.3 User Preview (Before Execution)

The `planElevationAssignment()` function returns a **plan**, not immediate writes:

```typescript
interface ElevationAssignmentPlan {
  assignments: { pointIndex, zMm, overBridge }[];
  outsideSurfaceCount: number;    // Points with no Z at their location
  measuredSkippedCount: number;   // Points already measured (never overwritten)
  overBridgeCount: number;        // Assignments on bridging triangles
}
```

User sees exactly what will happen **before** approving, mirroring QA pattern from ADR-725.

---

## 3. Three Rules Exceeding Big Players

### Rule 1: Measured Elevations Are Sacred

**NEVER overwrite measured Z.** Only 2D or already-derived points are candidates.

| Tool | Allows overwriting | Protection |
|------|-------------------|------------|
| Civil 3D | ✅ Yes | None |
| Trimble | ✅ Yes | None |
| Carlson | ✅ Yes | Manual checkbox |
| **This system** | ❌ No | Structural type guard |

**Implementation**: `isElevationAssignable(point)` returns `!isMeasuredElevation(point)`.

### Rule 2: Bridge Detection & User Warning

A **bridging triangle** is one whose longest edge far exceeds the survey's typical edge length — a telltale sign of a gap-spanning interpolation.

```typescript
export function bridgingTrianglesOnly(surface: TinSurface): TinSurface {
  const lengths = tinEdgeLengths(surface);
  const medianLength = median(lengths);
  const threshold = medianLength * BRIDGING_EDGE_MEDIAN_MULTIPLIER; // 3×
  return shallow-copy with only edges > threshold;
}
```

**Why 3×?** ESRI's "Delineate TIN Data Area" pattern — self-calibrating on the survey's own density. A single threshold (e.g., 100 m) fails for dense urban surveys or sparse regional surveys; ESRI's per-dataset scaling succeeds.

When a point lands on a bridging triangle, the plan flags `overBridge: true`, and the user sees: **"Elevation from interpolation across data gap — verify with field check."**

### Rule 3: Transparent Planning Before Execution

**No tool does this.** The plan shows:
- How many points get assigned
- How many are outside the TIN (stay 2D)
- How many were already measured (skipped)
- How many rest on bridges (warning category)

User approves the **full** plan, then execution is **verbatim** — what the user saw is what happens.

---

## 4. Implementation Files

### Core Logic
- **`topo-elevation-assign.ts`** — `planElevationAssignment()`, `applyElevationAssignment()`, `clearDerivedElevations()`, `isElevationAssignable()`
  - Pure functions — no side effects, no store reads
  - **Critical note**: Caller MUST provide the **full** surface (not clipped via bounds), otherwise bridge detection measures edges in a truncated TIN and misidentifies bridges
  
- **`topo-point-elevation.ts`** — Type guards and elevation source tracking
  - `isMeasuredElevation(point)` — type guard
  - `isDerivedElevation(point)` — boolean check
  - Updated `surfacePointsOf()` to filter via `isMeasuredElevation` (the structural lock)
  
- **`topo-types.ts`** — `TopoPoint.zSource?: 'derived'`
  - Docstring (400+ lines) explains why this doesn't violate ADR-720 §3.1
  
- **`topo-qa-topology.ts`** — `bridgingTrianglesOnly()` shared with ADR-725

### Undoable Command
- **`AssignTopoElevationCommand.ts`**
  - `fromPlan(surfaceId, plan)` → command or `null` (no-op detection)
  - `clearDerived(surfaceId)` → command or `null`
  - Snapshot-based undo (holds entire previous/next point arrays)
  - No footprint rebuild (because derived Z doesn't change vertex set)
  - No affected entities reported (only Z changed, all views read store reactively)
  - Docstring (400+ lines) explains the security guarantee of no footprint rebuild

---

## 5. Behavior Specification

### When User Approves "Assign"

Given a plan with N assignments:
1. Each 2D point with a valid Z interpolation receives `{ z: zMm, zSource: 'derived' }`
2. Measured points are completely skipped (never touched)
3. Points outside the surface stay 2D (no fabricated Z)
4. One command in history (not N commands) → one undo

**Idempotency** (N.7.2 #3): If called twice with identical points and surface, returns the original array unchanged. No empty history entries.

### When User Approves "Clear"

All points with `zSource: 'derived'` lose their Z and become 2D (as if they arrived from the survey without interpolation).

**Opposite of assignment at data level** (not undo — undo is per-command, this cleans accumulated derived Z).

Mirrors Trimble's **"strip elevations"** command.

### Outside Bounds → Stays 2D

No fallback, no 0 Z, no error. The plan reports the count so the user isn't surprised.

---

## 6. Limits & Assumptions

1. **Surface must be non-empty** — if 0 triangles, plan is empty
2. **Caller provides full surface** — not clipped by bounds (critical for bridge detection)
3. **Floating-point arithmetic** — barycentric interpolation inherits IEEE 754 precision (sufficient for mm)
4. **Bridge threshold is fixed at 3× median edge** — dataset-specific tuning not exposed (Carlson's checkbox is the extreme; this is the middle ground)

---

## 7. Relationship to ADR-720 & ADR-725

| ADR | Scope | This ADR's Impact |
|-----|-------|-------------------|
| **ADR-720** | Elevation data integrity (measured vs unknown) | Enforces "measured never overwritten"; implements the `zSource` flag |
| **ADR-725** | QA for surface coverage (how much of parcel is measured?) | Uses bridging-triangle detection; updated docstring to clarify "covers" semantics |

---

## 8. Changelog

### v1 — 2026-07-29 (Initial Implementation)
- Core three-state model + structural lock (`zSource` field, `surfacePointsOf` filter)
- Bridge detection via ESRI pattern (median edge × 3)
- User preview plan (`planElevationAssignment`)
- Undoable command with snapshot-based undo
- Measured-guard (cannot be overwritten)
- Four tests (plan all-measured, plan outside, plan on-bridge, idempotency)
- ADR-730 centralized point-location semantics for boundary tolerance
- ADR-725 updated to reference this ADR

---

## 9. Future Work

1. **UI/ribbon**: Determine command invocation point (topo panel? context menu? toolbar?)
2. **i18n**: Spanish + English keys for assignment/clear/bridge warnings
3. **Integration tests**: Jest suite for undo/redo behavior, command merging rules
4. **Topography test sweep**: Re-run full suite after changes

---

**References**:
- ADR-720 — Elevation Data Integrity
- ADR-725 — Boundary Elevation Coverage
- ADR-730 — Polygon Point Location Semantics
- `src/subapps/dxf-viewer/systems/topography/topo-elevation-assign.ts`
- `src/subapps/dxf-viewer/core/commands/entity-commands/AssignTopoElevationCommand.ts`

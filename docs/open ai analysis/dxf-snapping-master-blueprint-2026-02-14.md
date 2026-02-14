# DXF Snapping Master Blueprint (Autodesk-Grade)

Date: 2026-02-14
Scope: Complete engineering blueprint for transforming current DXF viewer snapping into a predictable, professional CAD-grade subsystem.

## 1. Product Target (What "Autodesk-grade" means)
1. Deterministic snapping: same cursor position and context always resolves to same snap point.
2. Strong visual feedback: clear mode glyphs (END, MID, CEN, INT, TAN, PERP, NEAR), hover highlight, stable marker.
3. Unified behavior: hover preview result equals click commit result.
4. High performance in dense drawings: low-latency snap resolution with indexing and cache.
5. Command consistency: running snaps + temporary overrides without global side effects.

## 2. Current Gaps to Fix (from code research)
1. Mixed engine priorities (centralized + hardcoded).
2. Inconsistent radius contract (`snapRadius` expectation vs world radius APIs).
3. Multiple compute paths per pointer cycle (mousemove/click/drawing path divergence).
4. Conflicting shortcut ownership across multiple subsystems.
5. Split logic between ProSnap and ruler/grid snapping behavior.
6. Candidate cycling uses fixed cap instead of actual candidate count.
7. Arc angle unit risk on node snaps.

## 3. Architecture To Implement

### 3.1 Single Snap Authority
Create one canonical state model:
- `snapEnabled`
- `runningModes`
- `temporaryOverrideMode`
- `aperturePx`
- `worldToleranceByMode`
- `priorityMap`
- `debugFlags`

Primary owner:
- `src/subapps/dxf-viewer/snapping/context/SnapContext.tsx`

Align supporting defaults/types:
- `src/subapps/dxf-viewer/snapping/extended-types.ts`
- `src/subapps/dxf-viewer/snapping/SnapPresets.ts`

### 3.2 One Snap Pipeline
Per pointer tick:
1. Gather context once (camera zoom, entities near cursor, active modes).
2. Resolve candidates once via orchestrator.
3. Keep resolved result as frame snapshot.
4. Hover renders snapshot.
5. Click commits exact snapshot (no second divergent resolution unless snapshot invalid).

Core files:
- `src/subapps/dxf-viewer/systems/cursor/useCentralizedMouseHandlers.ts`
- `src/subapps/dxf-viewer/hooks/drawing/useDrawingHandlers.ts`
- `src/subapps/dxf-viewer/snapping/hooks/useSnapManager.tsx`

### 3.3 Deterministic Candidate Resolution
Resolution order:
1. Mode priority (from centralized registry only).
2. Geometric confidence (exact intersection/endpoint beats proximity).
3. Distance to cursor in world coords.
4. Stable tie-breaker by entity id + candidate type.

Files:
- `src/subapps/dxf-viewer/snapping/orchestrator/SnapEngineRegistry.ts`
- `src/subapps/dxf-viewer/snapping/orchestrator/SnapCandidateProcessor.ts`

### 3.4 Tolerance & Aperture Model
- Aperture is pixel-based for UX consistency.
- Convert to world radius via zoom each frame.
- Keep mode-specific world tolerances centralized.

Files:
- `src/subapps/dxf-viewer/config/tolerance-config.ts`
- `src/subapps/dxf-viewer/snapping/shared/BaseSnapEngine.ts`
- `src/subapps/dxf-viewer/snapping/engines/shared/snap-engine-utils.ts`

### 3.5 Visual Feedback Standards
- Distinct marker shape/color per snap mode.
- Mode label near cursor.
- Entity hover highlight when candidate active.
- Selection grips only on selected entity commit.

Files:
- `src/subapps/dxf-viewer/systems/cursor/useCentralizedMouseHandlers.ts`
- `src/subapps/dxf-viewer/ui/components/ProSnapToolbar.tsx`
- `src/subapps/dxf-viewer/statusbar/CadStatusBar.tsx`

### 3.6 Input Governance
- One F-key manager for snaps/constraints/grid toggles.
- Reject duplicate handlers in separate modules.

Files:
- `src/subapps/dxf-viewer/keyboard/useProSnapShortcuts.ts`
- `src/subapps/dxf-viewer/statusbar/CadStatusBar.tsx`
- `src/subapps/dxf-viewer/systems/constraints/ConstraintsSystem.tsx`

### 3.7 Geometry Robustness
- Explicit angle unit contract (degrees vs radians) for arcs.
- Shared conversion helpers with type-safe guardrails.

Files:
- `src/subapps/dxf-viewer/snapping/engines/NodeSnapEngine.ts`
- `src/subapps/dxf-viewer/snapping/engines/shared/snap-engine-utils.ts`

### 3.8 Performance Model
- Spatial indexing for local candidate fetch.
- Cache candidate generation by viewport/cursor bucket.
- Predictable invalidation on geometry mutation.

Reference:
- `src/subapps/dxf-viewer/snapping/engines/IntersectionSnapEngine.ts`

## 4. Commit Execution Plan (small single-topic diffs)
1. `chore(snapping): unify default state authority`
2. `refactor(snapping): centralize all engine priorities`
3. `refactor(snapping): canonical aperture/tolerance contract`
4. `fix(snapping): dynamic candidate cycling by real count`
5. `refactor(cursor): single hover->commit resolved snapshot`
6. `feat(snapping-ui): CAD glyph markers + hover highlight`
7. `refactor(input): single shortcut authority for F-keys`
8. `fix(geometry): explicit arc angle unit normalization`
9. `refactor(snapping): merge ruler/grid policy into ProSnap`
10. `feat(debug): snap diagnostics overlay`
11. `test(snapping): deterministic replay + edge geometry cases`
12. `chore(quality): typecheck evidence npx tsc --noEmit`

## 5. Professional Acceptance Criteria
1. Hover resolved point equals click committed point in identical context.
2. Zero hardcoded priorities in individual engines.
3. No key conflict between snap/constraint/grid toggles.
4. Arc-related snaps validated on unit edge cases.
5. Stable behavior under zoom in/out extremes.
6. Low-latency resolution in dense scenes.

## 6. Risk Register
1. Regression in existing commands due to pipeline unification.
Mitigation: feature flag + staged rollout.
2. Keyboard behavior change surprises users.
Mitigation: status bar visibility + migration note.
3. Performance regressions in large drawings.
Mitigation: profiling counters and cache metrics before/after.

## 7. Telemetry/Diagnostics to Add
1. Snap resolve time (ms).
2. Candidate count per frame.
3. Cache hit ratio.
4. Active mode usage distribution.
5. Commit mismatch counter (hover vs click).

## 8. Delivery Standard
- Implement via small PR-sized commits.
- After each 2-3 commits do manual canvas smoke verification.
- Local quality gate only: `npx tsc --noEmit`.

## 9. Final Goal
The subsystem should behave like a professional CAD snapping engine: predictable, debuggable, fast, and visually explicit, with no split-brain behavior across hover/click/commands.

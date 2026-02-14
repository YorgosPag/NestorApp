# DXF Snapping Use Cases and Behavior Specifications (Autodesk-Style)

Date: 2026-02-14
Purpose: Operational scenarios and expected system behavior for implementation, QA and product validation.

## UC-01 Endpoint Snap During Line Command
Actor: drafter
Preconditions: LINE command active, END mode enabled
Flow:
1. Cursor approaches line endpoint.
2. END marker appears and endpoint highlight activates.
3. Click commits exact endpoint.
Expected:
- Commit coordinates exactly match endpoint.
- Marker remains stable between frames.
Failure to avoid:
- Hover marker at endpoint but click commits near-point instead.

## UC-02 Midpoint Snap on Existing Segment
Preconditions: MID mode enabled
Flow:
1. Cursor crosses segment center area.
2. MID marker and segment hover highlight shown.
3. Click commits midpoint.
Expected:
- Midpoint recomputed from current geometry only.
- Priority wins over NEAR in same aperture.

## UC-03 Center Snap on Circle/Arc
Preconditions: CEN mode enabled
Flow:
1. Cursor near circle/arc body.
2. CEN marker appears on center.
3. Click commits center.
Expected:
- Arc center and circle center use same unit-safe geometry contract.

## UC-04 Intersection Snap Between Two Entities
Preconditions: INT mode enabled
Flow:
1. Cursor near crossing area.
2. INT marker appears at exact intersection.
3. Click commits exact intersection.
Expected:
- Exact INT beats NEAR and MID by deterministic priority.

## UC-05 Tangent Snap from External Point to Circle
Preconditions: TAN mode enabled, command requiring tangent reference
Flow:
1. Cursor near circle while command context permits tangent.
2. TAN marker appears for valid tangent point.
3. Click commits tangent point.
Expected:
- Tangent only offered when mathematically valid.
- Invalid contexts show no false tangent marker.

## UC-06 Perpendicular Snap Constraint
Preconditions: PERP mode enabled and reference entity exists
Flow:
1. Cursor moved near perpendicular candidate.
2. PERP marker appears.
3. Click commits point respecting perpendicular relation.
Expected:
- Candidate rejected if perpendicular relation cannot be satisfied.

## UC-07 Nearest Snap Fallback
Preconditions: NEAR enabled, no stronger candidate in aperture
Flow:
1. Cursor near entity body.
2. NEAR marker appears.
3. Click commits nearest point on entity.
Expected:
- NEAR is fallback mode, never overriding higher confidence snaps.

## UC-08 Grid Snap Integration
Preconditions: Grid snap active and ProSnap active
Flow:
1. Cursor moved over area with both entity and grid candidates.
2. Resolver applies centralized policy (mode/priority/rules).
Expected:
- No split behavior from separate grid subsystem.
- Same logic in hover and click.

## UC-09 Running OSNAP with Temporary Override
Preconditions: running snaps configured
Flow:
1. User triggers temporary override mode.
2. Next pick uses override mode only once.
3. System returns to running set automatically.
Expected:
- Global running configuration unchanged.
- Override scope is one-shot deterministic.

## UC-10 Candidate Cycling (Dense Area)
Preconditions: multiple valid candidates in aperture
Flow:
1. User cycles candidates via configured action.
2. System advances to next candidate by actual list length.
Expected:
- No hardcoded cap.
- Full loop through all candidates with stable order.

## UC-11 Zoom Sensitivity Test
Preconditions: same geometry, variable zoom levels
Flow:
1. Repeat same hover/click test at low/medium/high zoom.
Expected:
- Pixel aperture behavior feels visually consistent.
- World tolerance conversion keeps detection stable.

## UC-12 Hover-Click Consistency Guard
Preconditions: standard drawing interaction
Flow:
1. Hover obtains resolved candidate.
2. Immediate click occurs without scene mutation.
Expected:
- Click commit equals last hover candidate exactly.

## UC-13 Arc Node Edge Cases
Preconditions: arc with non-trivial start/end angles
Flow:
1. Cursor near arc start node then end node.
2. Marker should match true geometric endpoints.
Expected:
- No degree/radian conversion drift.

## UC-14 Keyboard Toggle Governance
Preconditions: app ready, no modal dialogs
Flow:
1. Press F-key for snap toggle.
2. Verify exactly one subsystem state change.
Expected:
- No duplicated listeners toggling different systems.

## UC-15 Large Drawing Performance
Preconditions: dense DXF scene
Flow:
1. Pan/zoom/cursor move continuously for 30-60s.
Expected:
- No visible marker lag spikes.
- Resolve times remain bounded.

## Validation Matrix (minimum)
1. Functional: UC-01..UC-15 pass.
2. Determinism: repeated playback yields same resolved candidate sequence.
3. Performance: stable frame interaction in dense scenes.
4. UX: marker clarity and priority behavior understandable without ambiguity.

## Test Instrumentation Needed
1. Per-frame resolve time.
2. Candidate count and winner mode.
3. Cache hit/miss.
4. Hover-click mismatch metric.
5. Shortcut handler ownership trace.

## Release Readiness Checklist
1. Single snap authority merged.
2. Single pipeline merged.
3. Priority and tolerance fully centralized.
4. Arc unit normalization validated.
5. Shortcut conflicts removed.
6. `npx tsc --noEmit` passes.

/**
 * grip-3d-dxf-raw-grips.ts — PURE filter: which `GripInfo`s of a RAW DXF entity
 * (line / polyline / circle / arc) surface as editable grips in the 3D viewport
 * (ADR-537 — raw DXF selection + grip editing in 3D).
 *
 * The raw-DXF analogue of `reshapeGripsForFootprint` (which conversely *requires* a
 * BIM `*GripKind`). A raw DXF entity wants FULL 2D parity: every endpoint / vertex
 * grip (reshape) AND every whole-entity move grip (line midpoint, circle/arc centre)
 * — the 3D viewport has no separate move gizmo for raw DXF, so the move grips must
 * stay. The ONLY thing we strip is a BIM-structural footprint discriminator, which a
 * raw DXF entity never carries (defensive: if a wrapped BIM entity ever reached this
 * path its grips belong to the BIM gizmo, not here).
 *
 * `polylineGripKind` is KEPT — it is a raw-DXF discriminator (drives the polyline
 * arc-apex bulge commit + vertex/segment stretch), not a BIM-structural kind.
 *
 * Pure — no THREE, no React, no store. Jest-friendly.
 */

import type { GripInfo } from '../../hooks/grip-types';
// ADR-602 §3.2 Stage 4 — the former local `hasBimStructuralGripKind` was a structural
// twin of `hasFootprintGripKind` (identical 7-entity family test). Consolidated: reuse
// the SSoT from `grip-3d-reshape-grips.ts` (raw-DXF strips BIM-structural grips ≡ NOT footprint).
import { hasFootprintGripKind } from './grip-3d-reshape-grips';

/**
 * Keep every grip of a raw DXF entity (vertices + edge-midpoints + whole-entity move
 * centres) — full 2D parity — except any BIM-structural grip (which a raw DXF entity
 * never has; the guard keeps the path honest). Returns a fresh array; input order
 * preserved (stable grip indices for the controller's flat hit-test).
 */
export function rawDxfReshapeGrips(grips: readonly GripInfo[]): GripInfo[] {
  return grips.filter((g) => !hasFootprintGripKind(g));
}

/**
 * ADR-537 γ — seat raw DXF grips in MILLIMETRES. `computeDxfEntityGrips` returns grip
 * positions in the entity's NATIVE DXF units, but the 3D grip overlay + drag controller
 * project through the mm-based `dxfPlanToWorld`. Scaling each grip's plan position by
 * `unitToMm` (= `dxfSceneUnitToMm(scene)`) aligns the grips with the wireframe for non-mm
 * scenes (cm / m / in / ft). Only `position` is geometric — every other field is an index /
 * discriminator and stays as-is. `unitToMm === 1` (mm scenes) returns the input untouched.
 */
export function scaleDxfGripsToMm(grips: readonly GripInfo[], unitToMm: number): GripInfo[] {
  if (unitToMm === 1) return [...grips];
  return grips.map((g) => ({ ...g, position: { x: g.position.x * unitToMm, y: g.position.y * unitToMm } }));
}

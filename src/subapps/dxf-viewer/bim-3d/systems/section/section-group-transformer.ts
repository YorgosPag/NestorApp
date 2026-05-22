/**
 * ADR-366 §C.6.Q3 — Linked plane group transform utility.
 *
 * Pure function: applies a translation delta (meters) to all planes in a group.
 * Each plane moves along its own normal axis (constant += deltaM).
 * No mutations — returns new array.
 */

import type { SectionPlaneState, PlaneGroup } from '../../stores/SectionStore';

/**
 * Returns updated planes array with all group member planes shifted by deltaM.
 * Non-member planes are unchanged (identity).
 */
export function applyGroupDelta(
  planes: ReadonlyArray<SectionPlaneState>,
  group: PlaneGroup,
  deltaM: number,
): ReadonlyArray<SectionPlaneState> {
  const memberSet = new Set(group.planeIds);
  return planes.map((p) =>
    memberSet.has(p.id) ? { ...p, constant: p.constant + deltaM } : p,
  );
}

/**
 * Returns the group ID that contains the given plane ID, or null.
 */
export function findGroupForPlane(
  groups: ReadonlyArray<PlaneGroup>,
  planeId: string,
): PlaneGroup | null {
  return groups.find((g) => g.planeIds.includes(planeId)) ?? null;
}

/**
 * @module systems/guides/guide-store-group-ops
 * @description Pure functions for guide group operations and batch guide mutations.
 * Extracted from GuideStore for SRP compliance (ADR-065).
 *
 * All functions are pure — they take state, return new state.
 * The GuideStore class calls these and handles notify().
 *
 * @see ADR-189 (Construction Grid & Guide System)
 * @since 2026-04-07
 */

import type { Guide, GuideGroup } from './guide-types';
import type { Point2D } from '../../rendering/types/Types';
import { generateEntityId } from '../entity-creation/utils';

// ============================================================================
// BATCH GUIDE OPERATIONS
// ============================================================================

/** Remove multiple guides by ID. Locked guides are skipped. */
export function batchRemoveGuides(
  guides: readonly Guide[],
  ids: readonly string[],
): { remaining: Guide[]; removed: Guide[] } {
  const idSet = new Set(ids);
  const removed: Guide[] = [];
  const remaining: Guide[] = [];
  for (const g of guides) {
    if (idSet.has(g.id) && !g.locked) {
      removed.push(g);
    } else {
      remaining.push(g);
    }
  }
  return { remaining, removed };
}

/** Set locked state for multiple guides at once. */
export function batchSetGuidesLocked(
  guides: readonly Guide[],
  ids: readonly string[],
  locked: boolean,
): { guides: Guide[]; changed: boolean } {
  const idSet = new Set(ids);
  let changed = false;
  const result = guides.map(g => {
    if (idSet.has(g.id) && g.locked !== locked) {
      changed = true;
      return { ...g, locked };
    }
    return g;
  });
  return { guides: result, changed };
}

/** Set color for multiple guides at once. null = reset to default. */
export function batchSetGuidesColor(
  guides: readonly Guide[],
  ids: readonly string[],
  color: string | null,
): { guides: Guide[]; changed: boolean } {
  const idSet = new Set(ids);
  let changed = false;
  const result = guides.map(g => {
    if (idSet.has(g.id)) {
      changed = true;
      const newStyle = color
        ? { color, lineWidth: g.style?.lineWidth ?? 0.5, dashPattern: g.style?.dashPattern ?? [6, 3] }
        : null;
      return { ...g, style: newStyle };
    }
    return g;
  });
  return { guides: result, changed };
}

/**
 * Replace a guide with a rotated version (always becomes XZ diagonal).
 * Returns old guide snapshot (for undo) + updated guides array.
 * @see ADR-189 B28 (Guide Rotation)
 */
export function replaceGuideWithRotated(
  guides: readonly Guide[],
  id: string,
  newStart: Point2D,
  newEnd: Point2D,
): { guides: Guide[]; snapshot: Guide } | null {
  const index = guides.findIndex(g => g.id === id);
  if (index === -1) return null;

  const oldGuide = guides[index];
  if (oldGuide.locked) return null;

  // Deep copy for undo snapshot
  const snapshot: Guide = {
    ...oldGuide,
    startPoint: oldGuide.startPoint ? { ...oldGuide.startPoint } : undefined,
    endPoint: oldGuide.endPoint ? { ...oldGuide.endPoint } : undefined,
    style: oldGuide.style ? { ...oldGuide.style, dashPattern: [...oldGuide.style.dashPattern] } : null,
  };

  const rotated: Guide = {
    id: oldGuide.id,
    axis: 'XZ',
    offset: 0,
    label: oldGuide.label,
    style: oldGuide.style,
    visible: oldGuide.visible,
    locked: oldGuide.locked,
    createdAt: oldGuide.createdAt,
    parentId: oldGuide.parentId,
    groupId: oldGuide.groupId,
    startPoint: { x: newStart.x, y: newStart.y },
    endPoint: { x: newEnd.x, y: newEnd.y },
  };

  return {
    guides: guides.map(g => g.id === id ? rotated : g),
    snapshot,
  };
}

/** Restore a guide to its exact previous state (for undo). */
export function restoreGuideSnapshot(
  guides: readonly Guide[],
  snapshot: Guide,
): Guide[] | null {
  if (!guides.some(g => g.id === snapshot.id)) return null;
  return guides.map(g => g.id === snapshot.id ? { ...snapshot } : g);
}

/** Remove all temporary guides. Returns remaining + removed. */
export function removeTemporaryGuides(
  guides: readonly Guide[],
): { remaining: Guide[]; removed: Guide[] } {
  const removed = guides.filter(g => g.temporary);
  if (removed.length === 0) return { remaining: [...guides], removed: [] };
  return { remaining: guides.filter(g => !g.temporary), removed };
}

// ============================================================================
// GROUP OPERATIONS
// ============================================================================

/** Create a named guide group. */
export function createGroup(name: string, color = '#6366F1'): GuideGroup {
  return {
    id: `grp_${generateEntityId()}`,
    name,
    color,
    locked: false,
    visible: true,
  };
}

/** Remove a group and ungroup its guides (guides NOT deleted). */
export function removeGroup(
  guides: readonly Guide[],
  groups: readonly GuideGroup[],
  groupId: string,
): { guides: Guide[]; groups: GuideGroup[] } | null {
  if (!groups.some(g => g.id === groupId)) return null;
  return {
    groups: groups.filter(g => g.id !== groupId),
    guides: guides.map(g => g.groupId === groupId ? { ...g, groupId: null } : g),
  };
}

/** Remove a group AND delete all its member guides. Locked guides are kept. */
export function removeGroupWithGuides(
  guides: readonly Guide[],
  groups: readonly GuideGroup[],
  groupId: string,
): { guides: Guide[]; groups: GuideGroup[]; removed: Guide[] } | null {
  if (!groups.some(g => g.id === groupId)) return null;
  const removed = guides.filter(g => g.groupId === groupId && !g.locked);
  return {
    groups: groups.filter(g => g.id !== groupId),
    guides: guides.filter(g => g.groupId !== groupId || g.locked),
    removed,
  };
}

/** Rename a group. Returns new groups array or null if unchanged. */
export function renameGroup(
  groups: readonly GuideGroup[],
  groupId: string,
  name: string,
): GuideGroup[] | null {
  const group = groups.find(g => g.id === groupId);
  if (!group || group.name === name) return null;
  return groups.map(g => g.id === groupId ? { ...g, name } : g);
}

/** Set group locked state — also locks/unlocks all member guides. */
export function setGroupLocked(
  guides: readonly Guide[],
  groups: readonly GuideGroup[],
  groupId: string,
  locked: boolean,
): { guides: Guide[]; groups: GuideGroup[] } | null {
  const group = groups.find(g => g.id === groupId);
  if (!group || group.locked === locked) return null;
  return {
    groups: groups.map(g => g.id === groupId ? { ...g, locked } : g),
    guides: guides.map(g => g.groupId === groupId ? { ...g, locked } : g),
  };
}

/** Set group visibility — also shows/hides all member guides. */
export function setGroupVisible(
  guides: readonly Guide[],
  groups: readonly GuideGroup[],
  groupId: string,
  visible: boolean,
): { guides: Guide[]; groups: GuideGroup[] } | null {
  const group = groups.find(g => g.id === groupId);
  if (!group || group.visible === visible) return null;
  return {
    groups: groups.map(g => g.id === groupId ? { ...g, visible } : g),
    guides: guides.map(g => g.groupId === groupId ? { ...g, visible } : g),
  };
}

/** Set group color. Returns new groups array or null if unchanged. */
export function setGroupColor(
  groups: readonly GuideGroup[],
  groupId: string,
  color: string,
): GuideGroup[] | null {
  const group = groups.find(g => g.id === groupId);
  if (!group || group.color === color) return null;
  return groups.map(g => g.id === groupId ? { ...g, color } : g);
}

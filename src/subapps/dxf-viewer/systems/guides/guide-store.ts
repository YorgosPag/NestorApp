/**
 * @module systems/guides/guide-store
 * @description Pure data store for construction guides — no React dependency
 *
 * Singleton pattern with observer subscription for React integration.
 * Implements IGridHeadlessAPI from the AI assistant interface so
 * AI tools can operate on guides when activated.
 *
 * @see ADR-189 (Construction Grid & Guide System)
 * @since 2026-02-19
 */

import type { GridAxis, GridContextSnapshot } from '../../ai-assistant/grid-types';
import type { IGridHeadlessAPI } from '../../ai-assistant/grid-executor-interface';
import type {
  AddGuideArgs,
  RemoveGuideArgs,
  MoveGuideArgs,
  CreateGridGroupArgs,
  SetGridSpacingArgs,
  ToggleGridSnapArgs,
  GridOperationResult,
} from '../../ai-assistant/grid-types';
import type { Point2D } from '../../rendering/types/Types';
import type { Guide, GuideGroup } from './guide-types';
import { GUIDE_LIMITS, pointToSegmentDistance } from './guide-types';
import { generateEntityId } from '../entity-creation/utils';

// ============================================================================
// TYPES
// ============================================================================

type StoreListener = () => void;

// ============================================================================
// GUIDE STORE
// ============================================================================

/**
 * Pure data store for construction guides.
 * No React dependency — communicates via observer pattern.
 * Singleton per application instance.
 */
export class GuideStore implements IGridHeadlessAPI {
  private guides: Guide[] = [];
  private groups: GuideGroup[] = [];
  private visible = true;
  private snapToGrid = true;
  private listeners = new Set<StoreListener>();
  private version = 0;

  // ── Observer Pattern ──

  /** Subscribe to store changes. Returns unsubscribe function. */
  subscribe(listener: StoreListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Notify all subscribers of a state change */
  private notify(): void {
    this.version++;
    this.listeners.forEach(listener => {
      try {
        listener();
      } catch (err) {
        console.error('[GuideStore] Listener error:', err);
      }
    });
  }

  /** Current version (increments on every mutation — for React memoization) */
  getVersion(): number {
    return this.version;
  }

  // ── Read Operations ──

  /** Get all guides (readonly snapshot) */
  getGuides(): readonly Guide[] {
    return this.guides;
  }

  /** Get a guide by ID */
  getGuideById(id: string): Guide | undefined {
    return this.guides.find(g => g.id === id);
  }

  /** Get guides by axis type */
  getGuidesByAxis(axis: GridAxis): readonly Guide[] {
    return this.guides.filter(g => g.axis === axis);
  }

  /** Find the nearest guide to a world position */
  findNearestGuide(worldX: number, worldY: number, maxDistance: number): Guide | undefined {
    let nearest: Guide | undefined;
    let bestDist = maxDistance;

    for (const guide of this.guides) {
      if (!guide.visible) continue;

      let dist: number;
      if (guide.axis === 'XZ' && guide.startPoint && guide.endPoint) {
        // Diagonal guide: perpendicular distance to segment
        dist = pointToSegmentDistance({ x: worldX, y: worldY }, guide.startPoint, guide.endPoint);
      } else {
        dist = guide.axis === 'X'
          ? Math.abs(worldX - guide.offset)
          : Math.abs(worldY - guide.offset);
      }

      if (dist < bestDist) {
        bestDist = dist;
        nearest = guide;
      }
    }

    return nearest;
  }

  /** Whether guides are globally visible */
  isVisible(): boolean {
    return this.visible;
  }

  /** Whether snap-to-grid is enabled */
  isSnapEnabled(): boolean {
    return this.snapToGrid;
  }

  /** Total number of guides */
  get count(): number {
    return this.guides.length;
  }

  // ── Write Operations ──

  /** Add a guide. Returns the created guide or undefined if limit reached. */
  addGuideRaw(axis: GridAxis, offset: number, label: string | null = null, parentId: string | null = null, groupId: string | null = null): Guide | undefined {
    if (this.guides.length >= GUIDE_LIMITS.MAX_GUIDES) {
      console.warn(`[GuideStore] Max guides limit reached (${GUIDE_LIMITS.MAX_GUIDES})`);
      return undefined;
    }

    // Check for near-duplicate on same axis
    const duplicate = this.guides.find(
      g => g.axis === axis && Math.abs(g.offset - offset) < GUIDE_LIMITS.MIN_OFFSET_DELTA
    );
    if (duplicate) {
      return undefined; // Silently skip duplicate
    }

    const guide: Guide = {
      id: `guide_${generateEntityId()}`,
      axis,
      offset,
      label,
      style: null,
      visible: true,
      locked: false,
      createdAt: new Date().toISOString(),
      parentId,
      groupId,
    };

    // CRITICAL: Create new array — useSyncExternalStore uses Object.is()
    // Mutating in-place (push) keeps the same reference → React won't re-render
    this.guides = [...this.guides, guide];
    this.notify();
    return guide;
  }

  /** Add a diagonal (XZ) guide defined by start and end points. Returns created guide or undefined. */
  addDiagonalGuideRaw(
    startPoint: Point2D,
    endPoint: Point2D,
    label: string | null = null,
  ): Guide | undefined {
    if (this.guides.length >= GUIDE_LIMITS.MAX_GUIDES) {
      console.warn(`[GuideStore] Max guides limit reached (${GUIDE_LIMITS.MAX_GUIDES})`);
      return undefined;
    }

    // Validate minimum length (avoid zero-length diagonals)
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length < GUIDE_LIMITS.MIN_OFFSET_DELTA) {
      return undefined;
    }

    const guide: Guide = {
      id: `guide_${generateEntityId()}`,
      axis: 'XZ',
      offset: 0,  // Not used for diagonal guides
      label,
      style: null,
      visible: true,
      locked: false,
      createdAt: new Date().toISOString(),
      parentId: null,
      groupId: null,
      startPoint: { x: startPoint.x, y: startPoint.y },
      endPoint: { x: endPoint.x, y: endPoint.y },
    };

    this.guides = [...this.guides, guide];
    this.notify();
    return guide;
  }

  /** Re-add a previously created guide (for redo) */
  restoreGuide(guide: Guide): void {
    // Avoid duplicates
    if (this.guides.some(g => g.id === guide.id)) return;
    // CRITICAL: New array for useSyncExternalStore referential equality check
    this.guides = [...this.guides, { ...guide }];
    this.notify();
  }

  /** Remove a guide by ID. Returns the removed guide or undefined. */
  removeGuideById(id: string): Guide | undefined {
    const index = this.guides.findIndex(g => g.id === id);
    if (index === -1) return undefined;

    const guide = this.guides[index];
    if (guide.locked) return undefined; // Cannot remove locked guide

    // CRITICAL: New array for useSyncExternalStore referential equality check
    this.guides = this.guides.filter(g => g.id !== id);
    this.notify();
    return guide;
  }

  /** Move a guide to a new offset. Returns true if successful. */
  moveGuideById(id: string, newOffset: number): boolean {
    const guide = this.guides.find(g => g.id === id);
    if (!guide || guide.locked) return false;

    // CRITICAL: New array with updated guide — useSyncExternalStore needs new reference
    this.guides = this.guides.map(g =>
      g.id === id ? { ...g, offset: newOffset } : g
    );
    this.notify();
    return true;
  }

  /** Move a diagonal (XZ) guide to new start/end points. Returns true if successful. */
  moveDiagonalGuideById(id: string, newStart: Point2D, newEnd: Point2D): boolean {
    const guide = this.guides.find(g => g.id === id);
    if (!guide || guide.locked || guide.axis !== 'XZ') return false;

    // CRITICAL: New array with updated guide — useSyncExternalStore needs new reference
    this.guides = this.guides.map(g =>
      g.id === id ? { ...g, startPoint: { x: newStart.x, y: newStart.y }, endPoint: { x: newEnd.x, y: newEnd.y } } : g
    );
    this.notify();
    return true;
  }

  /** Set individual guide visibility (separate from global visibility) */
  setGuideVisible(id: string, visible: boolean): boolean {
    const guide = this.guides.find(g => g.id === id);
    if (!guide || guide.visible === visible) return false;

    this.guides = this.guides.map(g =>
      g.id === id ? { ...g, visible } : g
    );
    this.notify();
    return true;
  }

  /** Set guide locked state */
  setGuideLocked(id: string, locked: boolean): boolean {
    const guide = this.guides.find(g => g.id === id);
    if (!guide || guide.locked === locked) return false;

    this.guides = this.guides.map(g =>
      g.id === id ? { ...g, locked } : g
    );
    this.notify();
    return true;
  }

  /** Set guide label */
  setGuideLabel(id: string, label: string | null): boolean {
    const guide = this.guides.find(g => g.id === id);
    if (!guide || guide.label === label) return false;

    this.guides = this.guides.map(g =>
      g.id === id ? { ...g, label } : g
    );
    this.notify();
    return true;
  }

  /** Set guide color override (B6: per-guide color customization) */
  setGuideColor(id: string, color: string | null): boolean {
    const guide = this.guides.find(g => g.id === id);
    if (!guide) return false;

    const newStyle = color
      ? { color, lineWidth: guide.style?.lineWidth ?? 0.5, dashPattern: guide.style?.dashPattern ?? [6, 3] }
      : null;

    this.guides = this.guides.map(g =>
      g.id === id ? { ...g, style: newStyle } : g
    );
    this.notify();
    return true;
  }

  /**
   * Replace a guide with a rotated version (always becomes XZ diagonal).
   * Preserves id, label, style, visible, locked, createdAt, parentId.
   * Returns the old guide snapshot (for undo) or undefined if not found/locked.
   *
   * @see ADR-189 B28 (Guide Rotation)
   */
  replaceGuideWithRotated(id: string, newStart: Point2D, newEnd: Point2D): Guide | undefined {
    const index = this.guides.findIndex(g => g.id === id);
    if (index === -1) return undefined;

    const oldGuide = this.guides[index];
    if (oldGuide.locked) return undefined;

    // Deep copy of old guide for undo snapshot
    const snapshot: Guide = {
      ...oldGuide,
      startPoint: oldGuide.startPoint ? { ...oldGuide.startPoint } : undefined,
      endPoint: oldGuide.endPoint ? { ...oldGuide.endPoint } : undefined,
      style: oldGuide.style ? { ...oldGuide.style, dashPattern: [...oldGuide.style.dashPattern] } : null,
    };

    // Replace with rotated XZ guide preserving all metadata
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

    this.guides = this.guides.map(g => g.id === id ? rotated : g);
    this.notify();
    return snapshot;
  }

  /**
   * Restore a guide to its exact previous state (for undo).
   * Replaces the guide with matching ID with the full snapshot.
   *
   * @see ADR-189 B28 (Guide Rotation — undo)
   */
  restoreGuideSnapshot(snapshot: Guide): boolean {
    const index = this.guides.findIndex(g => g.id === snapshot.id);
    if (index === -1) return false;

    this.guides = this.guides.map(g =>
      g.id === snapshot.id ? { ...snapshot } : g
    );
    this.notify();
    return true;
  }

  /** Toggle global visibility */
  setVisible(visible: boolean): void {
    if (this.visible === visible) return;
    this.visible = visible;
    this.notify();
  }

  /** Toggle snap-to-grid */
  setSnapEnabled(enabled: boolean): void {
    if (this.snapToGrid === enabled) return;
    this.snapToGrid = enabled;
    this.notify();
  }

  /** Clear all guides and groups */
  clear(): void {
    if (this.guides.length === 0 && this.groups.length === 0) return;
    this.guides = [];
    this.groups = [];
    this.notify();
  }

  // ── B7: Guide Group Operations ──

  /** Get all groups (readonly snapshot) */
  getGroups(): readonly GuideGroup[] {
    return this.groups;
  }

  /** Get a group by ID */
  getGroupById(id: string): GuideGroup | undefined {
    return this.groups.find(g => g.id === id);
  }

  /** Get all guides belonging to a group */
  getGuidesByGroupId(groupId: string): readonly Guide[] {
    return this.guides.filter(g => g.groupId === groupId);
  }

  /** Create a named guide group. Returns the created group. */
  addGroup(name: string, color = '#6366F1'): GuideGroup {
    const group: GuideGroup = {
      id: `grp_${generateEntityId()}`,
      name,
      color,
      locked: false,
      visible: true,
    };
    this.groups = [...this.groups, group];
    this.notify();
    return group;
  }

  /** Remove a group and ungroup all its guides (guides are NOT deleted). */
  removeGroup(groupId: string): boolean {
    const index = this.groups.findIndex(g => g.id === groupId);
    if (index === -1) return false;

    this.groups = this.groups.filter(g => g.id !== groupId);
    // Ungroup all member guides (set groupId to null)
    this.guides = this.guides.map(g =>
      g.groupId === groupId ? { ...g, groupId: null } : g
    );
    this.notify();
    return true;
  }

  /** Remove a group AND delete all its member guides. Returns removed guides. */
  removeGroupWithGuides(groupId: string): readonly Guide[] {
    const index = this.groups.findIndex(g => g.id === groupId);
    if (index === -1) return [];

    const removed = this.guides.filter(g => g.groupId === groupId && !g.locked);
    this.groups = this.groups.filter(g => g.id !== groupId);
    this.guides = this.guides.filter(g => g.groupId !== groupId || g.locked);
    this.notify();
    return removed;
  }

  /** Rename a group */
  renameGroup(groupId: string, name: string): boolean {
    const group = this.groups.find(g => g.id === groupId);
    if (!group || group.name === name) return false;

    this.groups = this.groups.map(g =>
      g.id === groupId ? { ...g, name } : g
    );
    this.notify();
    return true;
  }

  /** Set group locked state — also locks/unlocks all member guides */
  setGroupLocked(groupId: string, locked: boolean): boolean {
    const group = this.groups.find(g => g.id === groupId);
    if (!group || group.locked === locked) return false;

    this.groups = this.groups.map(g =>
      g.id === groupId ? { ...g, locked } : g
    );
    this.guides = this.guides.map(g =>
      g.groupId === groupId ? { ...g, locked } : g
    );
    this.notify();
    return true;
  }

  /** Set group visibility — also shows/hides all member guides */
  setGroupVisible(groupId: string, visible: boolean): boolean {
    const group = this.groups.find(g => g.id === groupId);
    if (!group || group.visible === visible) return false;

    this.groups = this.groups.map(g =>
      g.id === groupId ? { ...g, visible } : g
    );
    this.guides = this.guides.map(g =>
      g.groupId === groupId ? { ...g, visible } : g
    );
    this.notify();
    return true;
  }

  /** Set group color */
  setGroupColor(groupId: string, color: string): boolean {
    const group = this.groups.find(g => g.id === groupId);
    if (!group || group.color === color) return false;

    this.groups = this.groups.map(g =>
      g.id === groupId ? { ...g, color } : g
    );
    this.notify();
    return true;
  }

  /** Assign a guide to a group (or ungroup by passing null) */
  setGuideGroupId(guideId: string, groupId: string | null): boolean {
    const guide = this.guides.find(g => g.id === guideId);
    if (!guide || guide.groupId === groupId) return false;

    this.guides = this.guides.map(g =>
      g.id === guideId ? { ...g, groupId } : g
    );
    this.notify();
    return true;
  }

  /** Restore a group (for undo) */
  restoreGroup(group: GuideGroup): void {
    if (this.groups.some(g => g.id === group.id)) return;
    this.groups = [...this.groups, { ...group }];
    this.notify();
  }

  // ── IGridHeadlessAPI Implementation (for AI tool execution) ──

  addGuide(args: AddGuideArgs): GridOperationResult {
    const guide = this.addGuideRaw(args.axis, args.offset, args.label);
    return guide
      ? { success: true, affectedGuides: [guide.id], affectedGroups: [], message: `Guide ${args.axis} added at offset ${args.offset}` }
      : { success: false, affectedGuides: [], affectedGroups: [], message: 'Failed to add guide (limit reached or duplicate)' };
  }

  removeGuide(args: RemoveGuideArgs): GridOperationResult {
    const removed = this.removeGuideById(args.guide_id);
    return removed
      ? { success: true, affectedGuides: [args.guide_id], affectedGroups: [], message: `Guide ${args.guide_id} removed` }
      : { success: false, affectedGuides: [], affectedGroups: [], message: 'Guide not found or locked' };
  }

  moveGuide(args: MoveGuideArgs): GridOperationResult {
    const moved = this.moveGuideById(args.guide_id, args.new_offset);
    return moved
      ? { success: true, affectedGuides: [args.guide_id], affectedGroups: [], message: `Guide moved to offset ${args.new_offset}` }
      : { success: false, affectedGuides: [], affectedGroups: [], message: 'Guide not found or locked' };
  }

  createGroup(_args: CreateGridGroupArgs): GridOperationResult {
    // Phase 1A: Groups not yet implemented
    return { success: false, affectedGuides: [], affectedGroups: [], message: 'Grid groups not yet implemented (Phase 1B)' };
  }

  setSpacing(_args: SetGridSpacingArgs): GridOperationResult {
    return { success: false, affectedGuides: [], affectedGroups: [], message: 'Grid spacing not yet implemented (Phase 1B)' };
  }

  toggleSnap(args: ToggleGridSnapArgs): GridOperationResult {
    this.setSnapEnabled(args.enabled);
    return { success: true, affectedGuides: [], affectedGroups: [], message: `Snap-to-grid ${args.enabled ? 'enabled' : 'disabled'}` };
  }

  getSnapshot(): GridContextSnapshot {
    return {
      groups: [], // Phase 1A: No groups yet
      activeGroupId: null,
      snapToGrid: this.snapToGrid,
      gridVisible: this.visible,
    };
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let globalInstance: GuideStore | null = null;

/** Get the global GuideStore singleton */
export function getGlobalGuideStore(): GuideStore {
  if (!globalInstance) {
    globalInstance = new GuideStore();
  }
  return globalInstance;
}

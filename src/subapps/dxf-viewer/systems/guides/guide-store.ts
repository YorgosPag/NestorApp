/**
 * @module systems/guides/guide-store
 * @description Pure data store for construction guides — no React dependency
 *
 * Singleton pattern with observer subscription for React integration.
 * Implements IGridHeadlessAPI from the AI assistant interface so
 * AI tools can operate on guides when activated.
 *
 * Group and batch operations are delegated to guide-store-group-ops.ts (ADR-065 SRP).
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
import {
  batchRemoveGuides,
  batchSetGuidesLocked,
  batchSetGuidesColor,
  replaceGuideWithRotated as replaceRotatedOp,
  restoreGuideSnapshot as restoreSnapshotOp,
  removeTemporaryGuides as removeTempOp,
  createGroup as createGroupOp,
  removeGroup as removeGroupOp,
  removeGroupWithGuides as removeGroupWithGuidesOp,
  renameGroup as renameGroupOp,
  setGroupLocked as setGroupLockedOp,
  setGroupVisible as setGroupVisibleOp,
  setGroupColor as setGroupColorOp,
} from './guide-store-group-ops';
import { nowISO } from '@/lib/date-local';

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

  subscribe(listener: StoreListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

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

  getVersion(): number {
    return this.version;
  }

  // ── Read Operations ──

  getGuides(): readonly Guide[] {
    return this.guides;
  }

  getGuideById(id: string): Guide | undefined {
    return this.guides.find(g => g.id === id);
  }

  getGuidesByAxis(axis: GridAxis): readonly Guide[] {
    return this.guides.filter(g => g.axis === axis);
  }

  findNearestGuide(worldX: number, worldY: number, maxDistance: number): Guide | undefined {
    let nearest: Guide | undefined;
    let bestDist = maxDistance;

    for (const guide of this.guides) {
      if (!guide.visible) continue;

      let dist: number;
      if (guide.axis === 'XZ' && guide.startPoint && guide.endPoint) {
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

  isVisible(): boolean {
    return this.visible;
  }

  isSnapEnabled(): boolean {
    return this.snapToGrid;
  }

  get count(): number {
    return this.guides.length;
  }

  // ── Write Operations (Individual) ──

  addGuideRaw(axis: GridAxis, offset: number, label: string | null = null, parentId: string | null = null, groupId: string | null = null, temporary = false): Guide | undefined {
    if (this.guides.length >= GUIDE_LIMITS.MAX_GUIDES) {
      console.warn(`[GuideStore] Max guides limit reached (${GUIDE_LIMITS.MAX_GUIDES})`);
      return undefined;
    }

    const duplicate = this.guides.find(
      g => g.axis === axis && Math.abs(g.offset - offset) < GUIDE_LIMITS.MIN_OFFSET_DELTA
    );
    if (duplicate) return undefined;

    const guide: Guide = {
      id: `guide_${generateEntityId()}`,
      axis,
      offset,
      label,
      style: null,
      visible: true,
      locked: false,
      createdAt: nowISO(),
      parentId,
      groupId,
      ...(temporary ? { temporary: true } : {}),
    };

    // CRITICAL: New array — useSyncExternalStore uses Object.is()
    this.guides = [...this.guides, guide];
    this.notify();
    return guide;
  }

  addDiagonalGuideRaw(startPoint: Point2D, endPoint: Point2D, label: string | null = null): Guide | undefined {
    if (this.guides.length >= GUIDE_LIMITS.MAX_GUIDES) {
      console.warn(`[GuideStore] Max guides limit reached (${GUIDE_LIMITS.MAX_GUIDES})`);
      return undefined;
    }

    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    if (Math.sqrt(dx * dx + dy * dy) < GUIDE_LIMITS.MIN_OFFSET_DELTA) return undefined;

    const guide: Guide = {
      id: `guide_${generateEntityId()}`,
      axis: 'XZ',
      offset: 0,
      label,
      style: null,
      visible: true,
      locked: false,
      createdAt: nowISO(),
      parentId: null,
      groupId: null,
      startPoint: { x: startPoint.x, y: startPoint.y },
      endPoint: { x: endPoint.x, y: endPoint.y },
    };

    this.guides = [...this.guides, guide];
    this.notify();
    return guide;
  }

  restoreGuide(guide: Guide): void {
    if (this.guides.some(g => g.id === guide.id)) return;
    this.guides = [...this.guides, { ...guide }];
    this.notify();
  }

  removeGuideById(id: string): Guide | undefined {
    const index = this.guides.findIndex(g => g.id === id);
    if (index === -1) return undefined;
    const guide = this.guides[index];
    if (guide.locked) return undefined;
    this.guides = this.guides.filter(g => g.id !== id);
    this.notify();
    return guide;
  }

  moveGuideById(id: string, newOffset: number): boolean {
    const guide = this.guides.find(g => g.id === id);
    if (!guide || guide.locked) return false;
    this.guides = this.guides.map(g => g.id === id ? { ...g, offset: newOffset } : g);
    this.notify();
    return true;
  }

  moveDiagonalGuideById(id: string, newStart: Point2D, newEnd: Point2D): boolean {
    const guide = this.guides.find(g => g.id === id);
    if (!guide || guide.locked || guide.axis !== 'XZ') return false;
    this.guides = this.guides.map(g =>
      g.id === id ? { ...g, startPoint: { x: newStart.x, y: newStart.y }, endPoint: { x: newEnd.x, y: newEnd.y } } : g
    );
    this.notify();
    return true;
  }

  setGuideVisible(id: string, visible: boolean): boolean {
    const guide = this.guides.find(g => g.id === id);
    if (!guide || guide.visible === visible) return false;
    this.guides = this.guides.map(g => g.id === id ? { ...g, visible } : g);
    this.notify();
    return true;
  }

  setGuideLocked(id: string, locked: boolean): boolean {
    const guide = this.guides.find(g => g.id === id);
    if (!guide || guide.locked === locked) return false;
    this.guides = this.guides.map(g => g.id === id ? { ...g, locked } : g);
    this.notify();
    return true;
  }

  setGuideLabel(id: string, label: string | null): boolean {
    const guide = this.guides.find(g => g.id === id);
    if (!guide || guide.label === label) return false;
    this.guides = this.guides.map(g => g.id === id ? { ...g, label } : g);
    this.notify();
    return true;
  }

  setGuideColor(id: string, color: string | null): boolean {
    const guide = this.guides.find(g => g.id === id);
    if (!guide) return false;
    const newStyle = color
      ? { color, lineWidth: guide.style?.lineWidth ?? 0.5, dashPattern: guide.style?.dashPattern ?? [6, 3] }
      : null;
    this.guides = this.guides.map(g => g.id === id ? { ...g, style: newStyle } : g);
    this.notify();
    return true;
  }

  // ── Batch Operations (delegated to guide-store-group-ops) ──

  removeGuidesById(ids: readonly string[]): Guide[] {
    const { remaining, removed } = batchRemoveGuides(this.guides, ids);
    if (removed.length > 0) { this.guides = remaining; this.notify(); }
    return removed;
  }

  setGuidesLocked(ids: readonly string[], locked: boolean): void {
    const result = batchSetGuidesLocked(this.guides, ids, locked);
    if (result.changed) { this.guides = result.guides; this.notify(); }
  }

  setGuidesColor(ids: readonly string[], color: string | null): void {
    const result = batchSetGuidesColor(this.guides, ids, color);
    if (result.changed) { this.guides = result.guides; this.notify(); }
  }

  replaceGuideWithRotated(id: string, newStart: Point2D, newEnd: Point2D): Guide | undefined {
    const result = replaceRotatedOp(this.guides, id, newStart, newEnd);
    if (!result) return undefined;
    this.guides = result.guides;
    this.notify();
    return result.snapshot;
  }

  restoreGuideSnapshot(snapshot: Guide): boolean {
    const result = restoreSnapshotOp(this.guides, snapshot);
    if (!result) return false;
    this.guides = result;
    this.notify();
    return true;
  }

  removeTemporaryGuides(): Guide[] {
    const { remaining, removed } = removeTempOp(this.guides);
    if (removed.length > 0) { this.guides = remaining; this.notify(); }
    return removed;
  }

  // ── Global State ──

  setVisible(visible: boolean): void {
    if (this.visible === visible) return;
    this.visible = visible;
    this.notify();
  }

  setSnapEnabled(enabled: boolean): void {
    if (this.snapToGrid === enabled) return;
    this.snapToGrid = enabled;
    this.notify();
  }

  clear(): void {
    if (this.guides.length === 0 && this.groups.length === 0) return;
    this.guides = [];
    this.groups = [];
    this.notify();
  }

  // ── Group Operations (delegated to guide-store-group-ops) ──

  getGroups(): readonly GuideGroup[] { return this.groups; }
  getGroupById(id: string): GuideGroup | undefined { return this.groups.find(g => g.id === id); }
  getGuidesByGroupId(groupId: string): readonly Guide[] { return this.guides.filter(g => g.groupId === groupId); }

  addGroup(name: string, color = '#6366F1'): GuideGroup {
    const group = createGroupOp(name, color);
    this.groups = [...this.groups, group];
    this.notify();
    return group;
  }

  removeGroup(groupId: string): boolean {
    const result = removeGroupOp(this.guides, this.groups, groupId);
    if (!result) return false;
    this.guides = result.guides; this.groups = result.groups; this.notify();
    return true;
  }

  removeGroupWithGuides(groupId: string): readonly Guide[] {
    const result = removeGroupWithGuidesOp(this.guides, this.groups, groupId);
    if (!result) return [];
    this.guides = result.guides; this.groups = result.groups; this.notify();
    return result.removed;
  }

  renameGroup(groupId: string, name: string): boolean {
    const result = renameGroupOp(this.groups, groupId, name);
    if (!result) return false;
    this.groups = result; this.notify();
    return true;
  }

  setGroupLocked(groupId: string, locked: boolean): boolean {
    const result = setGroupLockedOp(this.guides, this.groups, groupId, locked);
    if (!result) return false;
    this.guides = result.guides; this.groups = result.groups; this.notify();
    return true;
  }

  setGroupVisible(groupId: string, visible: boolean): boolean {
    const result = setGroupVisibleOp(this.guides, this.groups, groupId, visible);
    if (!result) return false;
    this.guides = result.guides; this.groups = result.groups; this.notify();
    return true;
  }

  setGroupColor(groupId: string, color: string): boolean {
    const result = setGroupColorOp(this.groups, groupId, color);
    if (!result) return false;
    this.groups = result; this.notify();
    return true;
  }

  setGuideGroupId(guideId: string, groupId: string | null): boolean {
    const guide = this.guides.find(g => g.id === guideId);
    if (!guide || guide.groupId === groupId) return false;
    this.guides = this.guides.map(g => g.id === guideId ? { ...g, groupId } : g);
    this.notify();
    return true;
  }

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
      groups: [],
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

export function getGlobalGuideStore(): GuideStore {
  if (!globalInstance) {
    globalInstance = new GuideStore();
  }
  return globalInstance;
}

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
import type { Guide } from './guide-types';
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
  addGuideRaw(axis: GridAxis, offset: number, label: string | null = null, parentId: string | null = null): Guide | undefined {
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

  /** Clear all guides */
  clear(): void {
    if (this.guides.length === 0) return;
    this.guides = [];
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

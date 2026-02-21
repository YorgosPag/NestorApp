/**
 * @module hooks/state/useGuideState
 * @description React hook bridging GuideStore to the component tree.
 *
 * Uses `useSyncExternalStore` for tear-free subscription to the GuideStore
 * singleton. Mutations are wrapped in Commands (undo/redo) and fire EventBus
 * events so the rest of the system stays in sync.
 *
 * @see ADR-189 (Construction Grid & Guide System)
 * @since 2026-02-19
 */

import { useSyncExternalStore, useCallback } from 'react';
import { getGlobalGuideStore } from '../../systems/guides/guide-store';
import { CreateGuideCommand, DeleteGuideCommand, CreateParallelGuideCommand, CreateDiagonalGuideCommand } from '../../systems/guides/guide-commands';
import { EventBus } from '../../systems/events/EventBus';
import type { Guide } from '../../systems/guides/guide-types';
import type { Point2D } from '../../rendering/types/Types';
import type { GridAxis } from '../../ai-assistant/grid-types';

// ============================================================================
// HOOK
// ============================================================================

export interface UseGuideStateReturn {
  /** All current guides (readonly snapshot) */
  guides: readonly Guide[];
  /** Whether guides are globally visible */
  guidesVisible: boolean;
  /** Whether snap-to-guide is enabled */
  snapEnabled: boolean;
  /** Total guide count */
  guideCount: number;

  /** Add a guide on the given axis at a world offset. Returns the command for undo support. */
  addGuide: (axis: GridAxis, offset: number, label?: string | null) => CreateGuideCommand;
  /** Delete a guide by ID. Returns the command for undo support. */
  removeGuide: (guideId: string) => DeleteGuideCommand;
  /** Add a parallel guide relative to a reference guide. Returns the command. */
  addParallelGuide: (referenceGuideId: string, offsetDistance: number) => CreateParallelGuideCommand;
  /** Add a diagonal (XZ) guide from startPoint to endPoint. Returns the command. */
  addDiagonalGuide: (startPoint: Point2D, endPoint: Point2D, label?: string | null) => CreateDiagonalGuideCommand;
  /** Toggle global guide visibility */
  toggleVisibility: () => void;
  /** Toggle snap-to-guide */
  toggleSnap: () => void;
  /** Clear all guides (not undoable) */
  clearAll: () => void;
  /** Direct access to the GuideStore singleton (for lock/label/advanced ops) */
  getStore: () => ReturnType<typeof getGlobalGuideStore>;
}

/**
 * React hook for the Construction Guide system.
 *
 * Usage:
 * ```tsx
 * const { guides, guidesVisible, addGuide, removeGuide } = useGuideState();
 * const { execute } = useCommandHistory();
 *
 * // Add a vertical guide at X=100 (undoable)
 * const cmd = addGuide('X', 100);
 * execute(cmd);
 * ```
 *
 * The caller is responsible for passing the returned command to `useCommandHistory().execute()`
 * so it enters the undo stack. This follows the same pattern as entity creation.
 */
export function useGuideState(): UseGuideStateReturn {
  const store = getGlobalGuideStore();

  // Subscribe to store changes via useSyncExternalStore
  const guides = useSyncExternalStore(
    (callback) => store.subscribe(callback),
    () => store.getGuides(),
    () => store.getGuides(), // server snapshot
  );

  const guidesVisible = useSyncExternalStore(
    (callback) => store.subscribe(callback),
    () => store.isVisible(),
    () => store.isVisible(),
  );

  const snapEnabled = useSyncExternalStore(
    (callback) => store.subscribe(callback),
    () => store.isSnapEnabled(),
    () => store.isSnapEnabled(),
  );

  const guideCount = useSyncExternalStore(
    (callback) => store.subscribe(callback),
    () => store.count,
    () => store.count,
  );

  // ── Mutations (return Commands — caller executes them) ──

  const addGuide = useCallback((axis: GridAxis, offset: number, label: string | null = null): CreateGuideCommand => {
    const cmd = new CreateGuideCommand(store, axis, offset, label);
    cmd.execute();

    const createdGuide = cmd.getCreatedGuide();
    if (createdGuide) {
      EventBus.emit('grid:guide-added', { guide: createdGuide });
    }

    return cmd;
  }, [store]);

  const removeGuide = useCallback((guideId: string): DeleteGuideCommand => {
    const cmd = new DeleteGuideCommand(store, guideId);
    cmd.execute();

    EventBus.emit('grid:guide-removed', { guideId });

    return cmd;
  }, [store]);

  const addParallelGuide = useCallback((referenceGuideId: string, offsetDistance: number): CreateParallelGuideCommand => {
    const cmd = new CreateParallelGuideCommand(store, referenceGuideId, offsetDistance);
    cmd.execute();

    const createdGuide = cmd.getCreatedGuide();
    if (createdGuide) {
      EventBus.emit('grid:guide-added', { guide: createdGuide });
    }

    return cmd;
  }, [store]);

  const addDiagonalGuide = useCallback((startPoint: Point2D, endPoint: Point2D, label: string | null = null): CreateDiagonalGuideCommand => {
    const cmd = new CreateDiagonalGuideCommand(store, startPoint, endPoint, label);
    cmd.execute();

    const createdGuide = cmd.getCreatedGuide();
    if (createdGuide) {
      EventBus.emit('grid:guide-added', { guide: createdGuide });
    }

    return cmd;
  }, [store]);

  const toggleVisibility = useCallback(() => {
    store.setVisible(!store.isVisible());
  }, [store]);

  const toggleSnap = useCallback(() => {
    const newValue = !store.isSnapEnabled();
    store.setSnapEnabled(newValue);
    EventBus.emit('grid:snap-toggled', { enabled: newValue });
  }, [store]);

  const clearAll = useCallback(() => {
    store.clear();
  }, [store]);

  const getStore = useCallback(() => store, [store]);

  return {
    guides,
    guidesVisible,
    snapEnabled,
    guideCount,
    addGuide,
    removeGuide,
    addParallelGuide,
    addDiagonalGuide,
    toggleVisibility,
    toggleSnap,
    clearAll,
    getStore,
  };
}

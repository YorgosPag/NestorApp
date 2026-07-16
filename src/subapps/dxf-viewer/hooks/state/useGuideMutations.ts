/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 * After any architectural change → update the ADR changelog (same commit).
 *
 * @module hooks/state/useGuideMutations
 * @description Shared mutation callbacks for the Construction Guide system.
 *
 * Internal hook consumed by BOTH `useGuideState()` (reactive, useSyncExternalStore)
 * and `useGuideActions()` (imperative reads, orchestrator-safe). Contains ONLY the
 * command-dispatching `useCallback`s + `temporaryMode` state + `getStore` — ZERO
 * store reads, ZERO `useSyncExternalStore`. Each caller supplies its own `store`/
 * `history` and merges this return value with its own read strategy for
 * `guides` / `guidesVisible` / `snapEnabled` / `guideCount`.
 *
 * ADR-040: micro-leaf subscriber pattern — this module MUST stay subscription-free
 * so `useGuideActions()` (used by orchestrator `CanvasSection`) never re-renders
 * on guide store notifications. The reactive/imperative read split lives entirely
 * in `useGuideState.ts` / `useGuideActions.ts`; this file must never import or
 * call `useSyncExternalStore`.
 *
 * @see useGuideState.ts — reactive version (leaf renderers / panels)
 * @see useGuideActions.ts — imperative version (orchestrators, ADR-040)
 * @since 2026-07-16
 */

import { useCallback, useState } from 'react';
import type { GuideStore } from '../../systems/guides/guide-store';
import type { CommandHistory } from '../../core/commands/CommandHistory';
import type { CreatedGuidesCommand } from '../../systems/guides/commands/guide-command-base';
import {
  CreateGuideCommand, DeleteGuideCommand, CreateParallelGuideCommand,
  CreateDiagonalGuideCommand, RotateGuideCommand, RotateAllGuidesCommand,
  RotateGuideGroupCommand, EqualizeGuidesCommand, PolarArrayGuidesCommand,
  ScaleAllGuidesCommand, MirrorGuidesCommand, GuideFromEntityCommand,
  BatchDeleteGuidesCommand, CopyGuidePatternCommand, GuideOffsetFromEntityCommand,
  CreateGridFromPresetCommand, BatchGuideFromEntitiesCommand,
  type EntityGuideParams,
} from '../../systems/guides/commands';
import { EventBus } from '../../systems/events/EventBus';
import type { Point2D } from '../../rendering/types/Types';
import type { GridAxis } from '../../ai-assistant/grid-types';

/**
 * Shared "create guide" tail: execute via history, then emit `grid:guide-added`
 * for the first created guide (if any). Used by addGuide/addParallelGuide/
 * addDiagonalGuide, which differ only in which CreatedGuidesCommand subclass
 * they construct.
 */
function executeCreateGuideCommand<T extends CreatedGuidesCommand>(history: CommandHistory, cmd: T): T {
  history.execute(cmd);
  const createdGuide = cmd.getCreatedGuide();
  if (createdGuide) EventBus.emit('grid:guide-added', { guide: createdGuide });
  return cmd;
}

export interface UseGuideMutationsReturn {
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
  /** Rotate a guide around a pivot point by a typed angle. Returns the command for undo. */
  rotateGuide: (guideId: string, pivot: Point2D, angleDeg: number) => RotateGuideCommand;
  /** Rotate ALL visible, unlocked guides around a pivot point. Returns the command for undo. */
  rotateAllGuides: (pivot: Point2D, angleDeg: number) => RotateAllGuidesCommand;
  /** Rotate a selected group of guides around a pivot point. Returns the command for undo. */
  rotateGuideGroup: (guideIds: readonly string[], pivot: Point2D, angleDeg: number) => RotateGuideGroupCommand;
  /** Equalize spacing between 3+ same-axis guides. Returns the command for undo. */
  equalizeGuides: (guideIds: readonly string[]) => EqualizeGuidesCommand;
  /** Create N guides at equal angular intervals around center. startAngleDeg offsets the first spoke. */
  createPolarArray: (center: Point2D, count: number, startAngleDeg?: number) => PolarArrayGuidesCommand;
  /** Scale all visible/unlocked guides from origin by a factor. Returns the command for undo. */
  scaleAllGuides: (origin: Point2D, scaleFactor: number) => ScaleAllGuidesCommand;
  /** Mirror all visible/unlocked guides across a selected X/Y axis guide. Returns the command for undo. */
  mirrorGuides: (axisGuideId: string) => MirrorGuidesCommand;
  /** B8: Create guide(s) from a DXF entity. Returns the command for undo. */
  createGuideFromEntity: (params: EntityGuideParams) => GuideFromEntityCommand;
  /** B14: Batch-delete multiple guides. Skips locked. Returns the command for undo. */
  batchDeleteGuides: (guideIds: readonly string[]) => BatchDeleteGuidesCommand;
  /** B17: Copy selected guides with offset and repetitions. Returns the command for undo. */
  copyGuidePattern: (sourceGuideIds: readonly string[], offsetDistance: number, repetitions: number) => CopyGuidePatternCommand;
  /** B24: Create guide(s) offset from a DXF entity edge by a perpendicular distance. */
  createGuideOffsetFromEntity: (params: EntityGuideParams, offsetDistance: number) => GuideOffsetFromEntityCommand;
  /** B23: Create a structural grid from preset spacings. */
  createGridFromPreset: (xOffsets: readonly number[], yOffsets: readonly number[], xLabels?: readonly string[] | null, yLabels?: readonly string[] | null, groupName?: string) => CreateGridFromPresetCommand;
  /** B37: Batch create guides from multiple selected entities. */
  createGuidesFromSelection: (paramsList: readonly EntityGuideParams[]) => BatchGuideFromEntitiesCommand;
  /** B35: Whether new guides are created as temporary (auto-removed on drawing completion) */
  temporaryMode: boolean;
  /** B35: Toggle temporary guide creation mode */
  toggleTemporaryMode: () => void;
  /** B35: Remove all temporary guides (called on drawing completion) */
  removeTemporaryGuides: () => void;
  /** Direct access to the GuideStore singleton (for lock/label/advanced ops) */
  getStore: () => GuideStore;
}

/**
 * Shared mutation callbacks for the guide system. NOT exported as a public
 * hook for components — internal helper for `useGuideState()` / `useGuideActions()`.
 * Contains ZERO store reads and ZERO `useSyncExternalStore`; callers own reads.
 */
export function useGuideMutations(store: GuideStore, history: CommandHistory): UseGuideMutationsReturn {
  const [temporaryMode, setTemporaryMode] = useState(false);
  const toggleTemporaryMode = useCallback(() => setTemporaryMode(prev => !prev), []);
  const removeTemporaryGuides = useCallback(() => store.removeTemporaryGuides(), [store]);

  const addGuide = useCallback((axis: GridAxis, offset: number, label: string | null = null): CreateGuideCommand =>
    executeCreateGuideCommand(history, new CreateGuideCommand(store, axis, offset, label)), [store, history]);

  const removeGuide = useCallback((guideId: string): DeleteGuideCommand => {
    const cmd = new DeleteGuideCommand(store, guideId);
    history.execute(cmd);
    EventBus.emit('grid:guide-removed', { guideId });
    return cmd;
  }, [store, history]);

  const addParallelGuide = useCallback((referenceGuideId: string, offsetDistance: number): CreateParallelGuideCommand =>
    executeCreateGuideCommand(history, new CreateParallelGuideCommand(store, referenceGuideId, offsetDistance)), [store, history]);

  const addDiagonalGuide = useCallback((startPoint: Point2D, endPoint: Point2D, label: string | null = null): CreateDiagonalGuideCommand =>
    executeCreateGuideCommand(history, new CreateDiagonalGuideCommand(store, startPoint, endPoint, label)), [store, history]);

  const toggleVisibility = useCallback(() => { store.setVisible(!store.isVisible()); }, [store]);

  const toggleSnap = useCallback(() => {
    const newValue = !store.isSnapEnabled();
    store.setSnapEnabled(newValue);
    EventBus.emit('grid:snap-toggled', { enabled: newValue });
  }, [store]);

  const clearAll = useCallback(() => { store.clear(); }, [store]);

  const rotateGuide = useCallback((guideId: string, pivot: Point2D, angleDeg: number): RotateGuideCommand => {
    const cmd = new RotateGuideCommand(store, guideId, pivot, angleDeg);
    history.execute(cmd);
    EventBus.emit('grid:guide-rotated', { guideId, angleDeg });
    return cmd;
  }, [store, history]);

  const rotateAllGuides = useCallback((pivot: Point2D, angleDeg: number): RotateAllGuidesCommand => {
    const cmd = new RotateAllGuidesCommand(store, pivot, angleDeg);
    history.execute(cmd);
    EventBus.emit('grid:all-guides-rotated', { angleDeg, pivot });
    return cmd;
  }, [store, history]);

  const rotateGuideGroup = useCallback((guideIds: readonly string[], pivot: Point2D, angleDeg: number): RotateGuideGroupCommand => {
    const cmd = new RotateGuideGroupCommand(store, guideIds, pivot, angleDeg);
    history.execute(cmd);
    EventBus.emit('grid:guide-group-rotated', { guideIds, angleDeg, pivot });
    return cmd;
  }, [store, history]);

  const equalizeGuides = useCallback((guideIds: readonly string[]): EqualizeGuidesCommand => {
    const cmd = new EqualizeGuidesCommand(store, guideIds);
    if (cmd.isValid) {
      history.execute(cmd);
      EventBus.emit('grid:guides-equalized', { guideIds, spacing: cmd.spacing });
    }
    return cmd;
  }, [store, history]);

  const createPolarArray = useCallback((center: Point2D, count: number, startAngleDeg = 0): PolarArrayGuidesCommand => {
    const cmd = new PolarArrayGuidesCommand(store, center, count, startAngleDeg);
    if (cmd.isValid) {
      history.execute(cmd);
      EventBus.emit('grid:polar-array-created', { center, count, angleIncrement: cmd.angleIncrement });
    }
    return cmd;
  }, [store, history]);

  const scaleAllGuides = useCallback((origin: Point2D, scaleFactor: number): ScaleAllGuidesCommand => {
    const cmd = new ScaleAllGuidesCommand(store, origin, scaleFactor);
    if (cmd.isValid) {
      history.execute(cmd);
      EventBus.emit('grid:all-guides-scaled', { origin, scaleFactor });
    }
    return cmd;
  }, [store, history]);

  const mirrorGuides = useCallback((axisGuideId: string): MirrorGuidesCommand => {
    const cmd = new MirrorGuidesCommand(store, axisGuideId);
    if (cmd.isValid) {
      history.execute(cmd);
      const axisGuide = store.getGuides().find(g => g.id === axisGuideId);
      EventBus.emit('grid:guides-mirrored', {
        axisGuideId,
        mirrorAxis: axisGuide?.axis === 'Y' ? 'Y' : 'X',
        createdCount: cmd.getAffectedEntityIds().length,
      });
    }
    return cmd;
  }, [store, history]);

  const createGuideFromEntity = useCallback((params: EntityGuideParams): GuideFromEntityCommand => {
    const cmd = new GuideFromEntityCommand(store, params);
    history.execute(cmd);
    EventBus.emit('grid:guide-from-entity', { entityType: params.entityType, createdCount: cmd.getAffectedEntityIds().length });
    return cmd;
  }, [store, history]);

  const batchDeleteGuides = useCallback((guideIds: readonly string[]): BatchDeleteGuidesCommand => {
    const cmd = new BatchDeleteGuidesCommand(store, guideIds);
    history.execute(cmd);
    EventBus.emit('grid:guides-batch-deleted', { count: cmd.getAffectedEntityIds().length });
    return cmd;
  }, [store, history]);

  const copyGuidePattern = useCallback((sourceGuideIds: readonly string[], offsetDistance: number, repetitions: number): CopyGuidePatternCommand => {
    const cmd = new CopyGuidePatternCommand(store, sourceGuideIds, offsetDistance, repetitions);
    if (cmd.isValid) {
      history.execute(cmd);
      EventBus.emit('grid:guide-pattern-copied', { sourceCount: sourceGuideIds.length, repetitions, offset: offsetDistance });
    }
    return cmd;
  }, [store, history]);

  const createGuideOffsetFromEntity = useCallback((params: EntityGuideParams, offsetDistance: number): GuideOffsetFromEntityCommand => {
    const cmd = new GuideOffsetFromEntityCommand(store, params, offsetDistance);
    history.execute(cmd);
    EventBus.emit('grid:guide-offset-from-entity', { entityType: params.entityType, offset: offsetDistance, createdCount: cmd.getAffectedEntityIds().length });
    return cmd;
  }, [store, history]);

  const createGridFromPreset = useCallback((
    xOffsets: readonly number[], yOffsets: readonly number[],
    xLabels: readonly string[] | null = null, yLabels: readonly string[] | null = null,
    groupName = 'Structural Grid',
  ): CreateGridFromPresetCommand => {
    const cmd = new CreateGridFromPresetCommand(store, xOffsets, yOffsets, xLabels, yLabels, groupName);
    history.execute(cmd);
    EventBus.emit('grid:preset-applied', { presetId: groupName, xCount: xOffsets.length, yCount: yOffsets.length });
    return cmd;
  }, [store, history]);

  const createGuidesFromSelection = useCallback((paramsList: readonly EntityGuideParams[]): BatchGuideFromEntitiesCommand => {
    const cmd = new BatchGuideFromEntitiesCommand(store, paramsList);
    history.execute(cmd);
    EventBus.emit('grid:guide-from-entity', { entityType: 'BATCH', createdCount: cmd.getAffectedEntityIds().length });
    return cmd;
  }, [store, history]);

  const getStore = useCallback(() => store, [store]);

  return {
    addGuide,
    removeGuide,
    addParallelGuide,
    addDiagonalGuide,
    rotateGuide,
    rotateAllGuides,
    rotateGuideGroup,
    equalizeGuides,
    createPolarArray,
    scaleAllGuides,
    mirrorGuides,
    createGuideFromEntity,
    batchDeleteGuides,
    copyGuidePattern,
    createGuideOffsetFromEntity,
    createGridFromPreset,
    createGuidesFromSelection,
    temporaryMode,
    toggleTemporaryMode,
    removeTemporaryGuides,
    toggleVisibility,
    toggleSnap,
    clearAll,
    getStore,
  };
}

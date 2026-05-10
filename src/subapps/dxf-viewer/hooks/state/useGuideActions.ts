/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 * After any architectural change → update the ADR changelog (same commit).
 *
 * @module hooks/state/useGuideActions
 * @description Mutations-only guide hook — NO useSyncExternalStore.
 *
 * Drop-in replacement for `useGuideState()` for orchestrator components
 * (e.g. CanvasSection) that must NOT re-render when guide positions change
 * at 60fps during drag. Leaf renderers (DxfCanvasSubscriber) subscribe to
 * the guide store directly instead.
 *
 * `guides` / `guidesVisible` / `snapEnabled` / `guideCount` are read
 * imperatively at render time — always current for event handlers, but
 * they do NOT trigger React re-renders on guide store notifications.
 *
 * ADR-040: micro-leaf subscriber pattern.
 * ADR-065: extracted to keep useGuideState.ts under 500-line limit.
 *
 * @see useGuideState.ts — reactive version (use in leaf renderers)
 * @since 2026-05-10
 */

import { useCallback, useState } from 'react';
import { getGlobalGuideStore } from '../../systems/guides/guide-store';
import { getGlobalCommandHistory } from '../../core/commands/CommandHistory';
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
import type { UseGuideStateReturn } from './useGuideState';

export function useGuideActions(): UseGuideStateReturn {
  const store = getGlobalGuideStore();
  const history = getGlobalCommandHistory();

  // Imperative reads — NOT reactive. Correct for event-handler reads; leaf
  // renderers subscribe to the guide store directly for reactive rendering.
  const guides = store.getGuides();
  const guidesVisible = store.isVisible();
  const snapEnabled = store.isSnapEnabled();
  const guideCount = store.count;

  const [temporaryMode, setTemporaryMode] = useState(false);
  const toggleTemporaryMode = useCallback(() => setTemporaryMode(prev => !prev), []);
  const removeTemporaryGuides = useCallback(() => store.removeTemporaryGuides(), [store]);

  const addGuide = useCallback((axis: GridAxis, offset: number, label: string | null = null): CreateGuideCommand => {
    const cmd = new CreateGuideCommand(store, axis, offset, label);
    history.execute(cmd);
    const createdGuide = cmd.getCreatedGuide();
    if (createdGuide) EventBus.emit('grid:guide-added', { guide: createdGuide });
    return cmd;
  }, [store, history]);

  const removeGuide = useCallback((guideId: string): DeleteGuideCommand => {
    const cmd = new DeleteGuideCommand(store, guideId);
    history.execute(cmd);
    EventBus.emit('grid:guide-removed', { guideId });
    return cmd;
  }, [store, history]);

  const addParallelGuide = useCallback((referenceGuideId: string, offsetDistance: number): CreateParallelGuideCommand => {
    const cmd = new CreateParallelGuideCommand(store, referenceGuideId, offsetDistance);
    history.execute(cmd);
    const createdGuide = cmd.getCreatedGuide();
    if (createdGuide) EventBus.emit('grid:guide-added', { guide: createdGuide });
    return cmd;
  }, [store, history]);

  const addDiagonalGuide = useCallback((startPoint: Point2D, endPoint: Point2D, label: string | null = null): CreateDiagonalGuideCommand => {
    const cmd = new CreateDiagonalGuideCommand(store, startPoint, endPoint, label);
    history.execute(cmd);
    const createdGuide = cmd.getCreatedGuide();
    if (createdGuide) EventBus.emit('grid:guide-added', { guide: createdGuide });
    return cmd;
  }, [store, history]);

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
    guides,
    guidesVisible,
    snapEnabled,
    guideCount,
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

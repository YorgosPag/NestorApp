/**
 * @module useGuideEntityHandlers
 * @enterprise ADR-189 — Entity picking, selection, context menu, measurement handlers
 *
 * Extracted from useGuideWorkflowHandlers.ts (SRP split: >500 LOC).
 */
import { useCallback, useEffect } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { UseGuideStateReturn } from '../state/useGuideState';
import type { UseConstructionPointStateReturn } from '../state/useConstructionPointState';
import type { PromptDialogOptions } from '../../systems/prompt-dialog';
import type { SceneModel } from '../../types/scene';
import type { ToolType } from '../../ui/toolbar/types';
import type { GuideWorkflowState, ArcPickableEntity, LinePickableEntity } from './guide-workflow-types';

interface UseGuideEntityHandlersParams {
  activeTool: ToolType | string;
  guideState: UseGuideStateReturn;
  cpState: UseConstructionPointStateReturn;
  showPromptDialog: (opts: PromptDialogOptions) => Promise<string | null>;
  t: (key: string) => string;
  notifyWarning: (msg: string, opts?: Record<string, unknown>) => void;
  notifySuccess: (msg: string, opts?: { duration?: number; actions?: Array<{ label: string; onClick: () => void }> }) => void;
  universalSelection: { getIds: () => string[] };
  currentScene: SceneModel | null;
  state: GuideWorkflowState;
}

export function useGuideEntityHandlers(params: UseGuideEntityHandlersParams) {
  const {
    activeTool, guideState, cpState, showPromptDialog, t,
    notifyWarning, notifySuccess, universalSelection, currentScene, state,
  } = params;

  // ─── Guide from entity ───
  const handleGuideFromEntity = useCallback((
    entityType: 'LINE' | 'CIRCLE' | 'ARC' | 'POLYLINE',
    entityParams: { lineStart?: Point2D; lineEnd?: Point2D; center?: Point2D; radius?: number; clickPoint?: Point2D },
  ) => {
    guideState.createGuideFromEntity({ entityType, ...entityParams });
  }, [guideState]);

  const handleGuideOffsetFromEntity = useCallback((
    entityType: 'LINE' | 'CIRCLE' | 'ARC' | 'POLYLINE',
    entityParams: { lineStart?: Point2D; lineEnd?: Point2D; center?: Point2D; radius?: number; clickPoint?: Point2D },
  ) => {
    showPromptDialog({
      title: t('promptDialog.offsetDistance'),
      label: t('promptDialog.enterOffsetDistance'),
      placeholder: t('promptDialog.offsetDistancePlaceholder'),
    }).then(value => {
      if (value === null) return;
      const offset = parseFloat(value);
      if (isNaN(offset) || offset <= 0) return;
      guideState.createGuideOffsetFromEntity({ entityType, ...entityParams }, offset);
    });
  }, [guideState, showPromptDialog, t]);

  // ─── Preset grid ───
  const handlePresetGrid = useCallback(() => {
    showPromptDialog({
      title: t('promptDialog.selectPreset'),
      label: t('promptDialog.enterPresetChoice'),
      placeholder: t('promptDialog.presetPlaceholder'),
    }).then(value => {
      if (value === null) return;
      const input = value.trim().toLowerCase();

      const presetMap: Record<string, { x: readonly number[]; y: readonly number[]; name: string }> = {
        '4m': { x: [0, 4, 8, 12, 16], y: [0, 4, 8, 12], name: 'Bay 4m Grid' },
        '5m': { x: [0, 5, 10, 15, 20], y: [0, 5, 10, 15], name: 'Bay 5m Grid' },
        '6m': { x: [0, 6, 12, 18, 24], y: [0, 6, 12, 18], name: 'Bay 6m Grid' },
        '8m': { x: [0, 8, 16, 24], y: [0, 8, 16], name: 'Bay 8m Grid' },
      };

      const preset = presetMap[input];
      if (preset) {
        guideState.createGridFromPreset(preset.x, preset.y, null, null, preset.name);
        return;
      }

      showPromptDialog({
        title: t('promptDialog.enterXSpacings'),
        label: t('promptDialog.enterXSpacings'),
        placeholder: t('promptDialog.xSpacingsPlaceholder'),
      }).then(xInput => {
        if (xInput === null) return;
        const xValues = xInput.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
        if (xValues.length < 2) return;

        showPromptDialog({
          title: t('promptDialog.enterYSpacings'),
          label: t('promptDialog.enterYSpacings'),
          placeholder: t('promptDialog.ySpacingsPlaceholder'),
        }).then(yInput => {
          if (yInput === null) return;
          const yValues = yInput.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
          if (yValues.length < 2) return;
          guideState.createGridFromPreset(xValues, yValues, null, null, 'Custom Grid');
        });
      });
    });
  }, [guideState, showPromptDialog, t]);

  // ─── Guide from selection ───
  const handleGuideFromSelection = useCallback(() => {
    const selIds = universalSelection.getIds();
    if (selIds.length === 0) {
      notifyWarning(t('promptDialog.selectEntitiesFirst'));
      return;
    }

    const scene = currentScene;
    if (!scene) return;

    const paramsList: Array<{ entityType: 'LINE' | 'CIRCLE' | 'ARC' | 'POLYLINE'; lineStart?: Point2D; lineEnd?: Point2D; center?: Point2D; radius?: number; clickPoint?: Point2D }> = [];

    for (const entityId of selIds) {
      const entity = scene.entities?.find(e => e.id === entityId);
      if (!entity) continue;

      if (entity.type === 'line' && 'start' in entity && 'end' in entity) {
        const ent = entity as unknown as { start: Point2D; end: Point2D };
        paramsList.push({
          entityType: 'LINE',
          lineStart: { x: ent.start.x, y: ent.start.y },
          lineEnd: { x: ent.end.x, y: ent.end.y },
        });
      } else if (entity.type === 'circle' && 'center' in entity && 'radius' in entity) {
        const ent = entity as unknown as { center: Point2D; radius: number };
        paramsList.push({
          entityType: 'CIRCLE',
          center: { x: ent.center.x, y: ent.center.y },
          radius: ent.radius,
        });
      } else if (entity.type === 'arc' && 'center' in entity && 'radius' in entity) {
        const ent = entity as unknown as { center: Point2D; radius: number };
        paramsList.push({
          entityType: 'ARC',
          center: { x: ent.center.x, y: ent.center.y },
          radius: ent.radius,
          clickPoint: { x: ent.center.x, y: ent.center.y + ent.radius },
        });
      }
    }

    if (paramsList.length > 0) {
      guideState.createGuidesFromSelection(paramsList);
    }
  }, [guideState, universalSelection, currentScene, notifyWarning, t]);

  // Auto-trigger preset/selection when tool activated
  useEffect(() => {
    if (activeTool === 'guide-preset-grid') handlePresetGrid();
    else if (activeTool === 'guide-from-selection') handleGuideFromSelection();
  }, [activeTool]); // Intentional: fire only on tool change, handlers are stable refs

  // ─── Guide selection (multi-select) ───
  const handleGuideSelectToggle = useCallback((guideId: string, addToSelection: boolean) => {
    state.setSelectedGuideIds((() => {
      const next = new Set(state.selectedGuideIds);
      if (addToSelection) {
        if (next.has(guideId)) next.delete(guideId);
        else next.add(guideId);
      } else {
        if (next.size === 1 && next.has(guideId)) {
          next.clear();
        } else {
          next.clear();
          next.add(guideId);
        }
      }
      return next;
    })());
  }, [state]);

  const handleGuideDeselectAll = useCallback(() => {
    state.setSelectedGuideIds(new Set());
  }, [state]);

  // ─── Copy pattern ───
  const handleCopyPatternTrigger = useCallback(() => {
    if (state.selectedGuideIds.size === 0) {
      notifyWarning(t('promptDialog.selectGuidesFirst'));
      return;
    }
    showPromptDialog({
      title: t('promptDialog.copyPattern'),
      label: t('promptDialog.enterOffsetAndCount'),
      placeholder: t('promptDialog.copyPatternPlaceholder'),
      inputType: 'text',
      validate: (val) => {
        const parts = val.trim().split(',');
        if (parts.length < 2) return t('promptDialog.invalidNumber');
        const offset = parseFloat(parts[0]);
        const count = parseInt(parts[1], 10);
        if (isNaN(offset) || offset === 0) return t('promptDialog.invalidNumber');
        if (isNaN(count) || count < 1) return t('promptDialog.invalidNumber');
        return null;
      },
    }).then((result) => {
      if (result !== null) {
        const parts = result.trim().split(',');
        const offset = parseFloat(parts[0]);
        const count = parseInt(parts[1], 10);
        guideState.copyGuidePattern(Array.from(state.selectedGuideIds), offset, count);
      }
    });
  }, [state.selectedGuideIds, showPromptDialog, t, guideState, notifyWarning]);

  useEffect(() => {
    if (activeTool === 'guide-copy-pattern') handleCopyPatternTrigger();
  }, [activeTool]); // Intentional: fire only on tool change, handlers are stable refs

  // ─── Arc/Circle entity picking ───
  const handleArcSegmentsPicked = useCallback((entity: ArcPickableEntity) => {
    showPromptDialog({
      title: t('promptDialog.arcSegmentCount'),
      label: t('promptDialog.enterArcSegmentCount'),
      placeholder: t('promptDialog.segmentCountPlaceholder'),
      inputType: 'number',
      validate: (val) => {
        const n = parseInt(val, 10);
        if (isNaN(n) || n < 2) return t('promptDialog.invalidNumber');
        return null;
      },
    }).then((result) => {
      if (result !== null) {
        const count = parseInt(result, 10);
        if (!isNaN(count) && count >= 2) {
          cpState.addArcSegmentPoints(
            entity.center, entity.radius,
            entity.startAngle, entity.endAngle,
            count, entity.isFullCircle,
          );
        }
      }
    });
  }, [showPromptDialog, t, cpState]);

  const handleArcDistancePicked = useCallback((entity: ArcPickableEntity) => {
    showPromptDialog({
      title: t('promptDialog.arcPointDistance'),
      label: t('promptDialog.enterArcPointDistance'),
      placeholder: t('promptDialog.pointDistancePlaceholder'),
      inputType: 'number',
      unit: 'mm',
      validate: (val) => {
        const n = parseFloat(val);
        if (isNaN(n) || n <= 0) return t('promptDialog.invalidNumber');
        return null;
      },
    }).then((result) => {
      if (result !== null) {
        const distance = parseFloat(result);
        if (!isNaN(distance) && distance > 0) {
          cpState.addArcDistancePoints(
            entity.center, entity.radius,
            entity.startAngle, entity.endAngle,
            distance, entity.isFullCircle,
          );
        }
      }
    });
  }, [showPromptDialog, t, cpState]);

  const handleArcLineLinePicked = useCallback((entity: LinePickableEntity) => {
    state.setArcLineLine(entity);
    state.setArcLineStep(1);
  }, [state]);

  const handleArcLineArcPicked = useCallback((entity: ArcPickableEntity) => {
    if (!state.arcLineLine) return;
    const prevCount = cpState.pointCount;
    cpState.addLineArcIntersectionPoints(
      state.arcLineLine.start, state.arcLineLine.end,
      entity.center, entity.radius,
      entity.startAngle, entity.endAngle,
      entity.isFullCircle,
    );
    setTimeout(() => {
      if (cpState.getStore().count === prevCount) {
        notifyWarning(t('promptDialog.noIntersectionFound'));
      }
    }, 0);
    state.setArcLineStep(0);
    state.setArcLineLine(null);
  }, [state, cpState, notifyWarning, t]);

  const handleCircleIntersectFirstPicked = useCallback((entity: ArcPickableEntity) => {
    state.setCircleIntersectFirst(entity);
    state.setCircleIntersectStep(1);
  }, [state]);

  const handleCircleIntersectSecondPicked = useCallback((entity: ArcPickableEntity) => {
    if (!state.circleIntersectFirst) return;
    const prevCount = cpState.pointCount;
    cpState.addCircleCircleIntersectionPoints(
      state.circleIntersectFirst.center, state.circleIntersectFirst.radius,
      state.circleIntersectFirst.startAngle, state.circleIntersectFirst.endAngle, state.circleIntersectFirst.isFullCircle,
      entity.center, entity.radius,
      entity.startAngle, entity.endAngle, entity.isFullCircle,
    );
    setTimeout(() => {
      if (cpState.getStore().count === prevCount) {
        notifyWarning(t('promptDialog.noCircleIntersectionFound'));
      }
    }, 0);
    state.setCircleIntersectStep(0);
    state.setCircleIntersectFirst(null);
  }, [state, cpState, notifyWarning, t]);

  // ─── Construction point placement ───
  const handleRectCenterPlace = useCallback((center: Point2D) => {
    cpState.addPoint(center, 'RC');
  }, [cpState]);

  const handleLineMidpointPlace = useCallback((midpoint: Point2D) => {
    cpState.addPoint(midpoint, 'MP');
  }, [cpState]);

  const handleCircleCenterPlace = useCallback((center: Point2D) => {
    cpState.addPoint(center, 'CC');
  }, [cpState]);

  // ─── Context menu handlers ───
  const handleGuideContextDelete = useCallback((guideId: string) => {
    guideState.removeGuide(guideId);
  }, [guideState]);

  const handleGuideContextToggleLock = useCallback((guideId: string) => {
    const store = guideState.getStore();
    const guide = store.getGuideById(guideId);
    if (guide) {
      store.setGuideLocked(guideId, !guide.locked);
    }
  }, [guideState]);

  const handleGuideContextEditLabel = useCallback((guideId: string, currentLabel: string | null) => {
    showPromptDialog({
      title: t('promptDialog.editLabel'),
      label: t('promptDialog.enterLabel'),
      placeholder: currentLabel ?? '',
      defaultValue: currentLabel ?? '',
      inputType: 'text',
    }).then((result) => {
      if (result !== null) {
        const store = guideState.getStore();
        store.setGuideLabel(guideId, result || null);
      }
    });
  }, [showPromptDialog, t, guideState]);

  const handleGuideContextChangeColor = useCallback((guideId: string, color: string | null) => {
    const store = guideState.getStore();
    store.setGuideColor(guideId, color);
  }, [guideState]);

  // ─── Measurement → Guide notification ───
  const handleMeasurementComplete = useCallback((points: ReadonlyArray<{ x: number; y: number }>, _tool: ToolType) => {
    if (points.length < 2) return;
    notifySuccess(t('guides.measureToGuide'), {
      duration: 5000,
      actions: [{
        label: t('guides.createGuides'),
        onClick: () => {
          const xOffsets = new Set<number>();
          const yOffsets = new Set<number>();
          for (const p of points) {
            xOffsets.add(Math.round(p.x * 1000) / 1000);
            yOffsets.add(Math.round(p.y * 1000) / 1000);
          }
          for (const x of xOffsets) guideState.addGuide('X', x);
          for (const y of yOffsets) guideState.addGuide('Y', y);
        },
      }],
    });
  }, [notifySuccess, t, guideState]);

  return {
    handleGuideFromEntity, handleGuideOffsetFromEntity,
    handleGuideSelectToggle, handleGuideDeselectAll,
    handleArcSegmentsPicked, handleArcDistancePicked,
    handleArcLineLinePicked, handleArcLineArcPicked,
    handleCircleIntersectFirstPicked, handleCircleIntersectSecondPicked,
    handleRectCenterPlace, handleLineMidpointPlace, handleCircleCenterPlace,
    handleGuideContextDelete, handleGuideContextToggleLock,
    handleGuideContextEditLabel, handleGuideContextChangeColor,
    handleMeasurementComplete,
  } as const;
}

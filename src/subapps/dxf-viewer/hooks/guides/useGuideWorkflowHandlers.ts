/**
 * @module useGuideWorkflowHandlers
 * @enterprise ADR-189 — Core guide tool workflow handlers (parallel, rotate, equalize, etc.)
 *
 * Extracted from useGuideToolWorkflows.ts (SRP: core workflow handlers).
 * Entity/selection/context handlers are in useGuideEntityHandlers.ts.
 */
import { useCallback } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { UseGuideStateReturn } from '../state/useGuideState';
import type { UseConstructionPointStateReturn } from '../state/useConstructionPointState';
import type { PromptDialogOptions } from '../../systems/prompt-dialog';
import type { GuideWorkflowState } from './guide-workflow-types';

export interface UseGuideWorkflowHandlersParams {
  guideState: UseGuideStateReturn;
  cpState: UseConstructionPointStateReturn;
  showPromptDialog: (opts: PromptDialogOptions) => Promise<string | null>;
  t: (key: string) => string;
  notifyWarning: (msg: string, opts?: Record<string, unknown>) => void;
  state: GuideWorkflowState;
}

export function useGuideWorkflowHandlers(params: UseGuideWorkflowHandlersParams) {
  const { guideState, cpState, showPromptDialog, t, notifyWarning, state } = params;

  // ─── Parallel workflow ───
  const handleParallelRefSelected = useCallback((refGuideId: string) => {
    state.setParallelRefGuideId(refGuideId);
  }, [state]);

  const handleParallelSideChosen = useCallback((refGuideId: string, sign: 1 | -1) => {
    showPromptDialog({
      title: t('promptDialog.parallelDistance'),
      label: t('promptDialog.enterDistance'),
      placeholder: t('promptDialog.distancePlaceholder'),
      inputType: 'number',
      unit: 'mm',
      validate: (val) => {
        const n = parseFloat(val);
        if (isNaN(n) || n === 0) return t('promptDialog.invalidNumber');
        return null;
      },
    }).then((result) => {
      if (result !== null) {
        const distance = parseFloat(result);
        if (!isNaN(distance) && Math.abs(distance) > 0.001) {
          guideState.addParallelGuide(refGuideId, Math.abs(distance) * sign);
        }
      }
      state.setParallelRefGuideId(null);
    });
  }, [showPromptDialog, t, guideState, state]);

  // ─── Rotate workflow ───
  const handleRotateRefSelected = useCallback((guideId: string) => {
    state.setRotateRefGuideId(guideId);
  }, [state]);

  const handleRotatePivotSet = useCallback((guideId: string, pivot: Point2D) => {
    showPromptDialog({
      title: t('promptDialog.rotateGuideAngle'),
      label: t('promptDialog.enterRotateAngle'),
      placeholder: t('promptDialog.rotateAnglePlaceholder'),
      inputType: 'number',
      validate: (val) => {
        const n = parseFloat(val);
        if (isNaN(n)) return t('promptDialog.invalidNumber');
        if (n === 0 || n % 360 === 0) return t('promptDialog.invalidNumber');
        return null;
      },
    }).then((result) => {
      if (result !== null) {
        const angleDeg = parseFloat(result);
        if (!isNaN(angleDeg) && angleDeg !== 0 && angleDeg % 360 !== 0) {
          guideState.rotateGuide(guideId, pivot, angleDeg);
        }
      }
      state.setRotateRefGuideId(null);
    });
  }, [showPromptDialog, t, guideState, state]);

  const handleRotateAllPivotSet = useCallback((pivot: Point2D) => {
    showPromptDialog({
      title: t('promptDialog.rotateAllGuidesAngle'),
      label: t('promptDialog.enterRotateAngle'),
      placeholder: t('promptDialog.rotateAnglePlaceholder'),
      inputType: 'number',
      validate: (val) => {
        const n = parseFloat(val);
        if (isNaN(n)) return t('promptDialog.invalidNumber');
        if (n === 0 || n % 360 === 0) return t('promptDialog.invalidNumber');
        return null;
      },
    }).then((result) => {
      if (result !== null) {
        const angleDeg = parseFloat(result);
        if (!isNaN(angleDeg) && angleDeg !== 0 && angleDeg % 360 !== 0) {
          guideState.rotateAllGuides(pivot, angleDeg);
        }
      }
    });
  }, [showPromptDialog, t, guideState]);

  const handleRotateGroupToggle = useCallback((guideId: string) => {
    state.setRotateGroupSelectedIds((() => {
      const next = new Set(state.rotateGroupSelectedIds);
      if (next.has(guideId)) next.delete(guideId);
      else next.add(guideId);
      return next;
    })());
  }, [state]);

  const handleRotateGroupPivotSet = useCallback((guideIds: readonly string[], pivot: Point2D) => {
    showPromptDialog({
      title: t('promptDialog.rotateGuideGroupAngle'),
      label: t('promptDialog.enterRotateAngle'),
      placeholder: t('promptDialog.rotateAnglePlaceholder'),
      inputType: 'number',
      validate: (val) => {
        const n = parseFloat(val);
        if (isNaN(n)) return t('promptDialog.invalidNumber');
        if (n === 0 || n % 360 === 0) return t('promptDialog.invalidNumber');
        return null;
      },
    }).then((result) => {
      if (result !== null) {
        const angleDeg = parseFloat(result);
        if (!isNaN(angleDeg) && angleDeg !== 0 && angleDeg % 360 !== 0) {
          guideState.rotateGuideGroup(guideIds, pivot, angleDeg);
        }
      }
      state.setRotateGroupSelectedIds(new Set());
    });
  }, [showPromptDialog, t, guideState, state]);

  // ─── Equalize workflow ───
  const handleEqualizeToggle = useCallback((guideId: string) => {
    state.setEqualizeSelectedIds((() => {
      const next = new Set(state.equalizeSelectedIds);
      if (next.has(guideId)) next.delete(guideId);
      else next.add(guideId);
      return next;
    })());
  }, [state]);

  const handleEqualizeApply = useCallback((guideIds: readonly string[]) => {
    const cmd = guideState.equalizeGuides(guideIds);
    if (!cmd.isValid) {
      notifyWarning(t('guides.equalizeRequiresSameAxis'));
    }
    state.setEqualizeSelectedIds(new Set());
  }, [guideState, notifyWarning, t, state]);

  // ─── Diagonal 3-click workflow ───
  const handleDiagonalStartSet = useCallback((point: Point2D) => {
    state.setDiagonalStartPoint(point);
    state.setDiagonalStep(1);
  }, [state]);

  const handleDiagonalDirectionSet = useCallback((point: Point2D) => {
    state.setDiagonalDirectionPoint(point);
    state.setDiagonalStep(2);
  }, [state]);

  const handleDiagonalComplete = useCallback(() => {
    state.setDiagonalStep(0);
    state.setDiagonalStartPoint(null);
    state.setDiagonalDirectionPoint(null);
  }, [state]);

  // ─── Perpendicular workflow ───
  const handlePerpRefSelected = useCallback((guideId: string) => {
    state.setPerpRefGuideId(guideId);
  }, [state]);

  const handlePerpPlaced = useCallback(() => {
    state.setPerpRefGuideId(null);
  }, [state]);

  // ─── Segments workflow ───
  const handleSegmentsStartSet = useCallback((point: Point2D) => {
    state.setSegmentsStartPoint(point);
    state.setSegmentsStep(1);
  }, [state]);

  const handleSegmentsComplete = useCallback((start: Point2D, end: Point2D) => {
    showPromptDialog({
      title: t('promptDialog.segmentCount'),
      label: t('promptDialog.enterSegmentCount'),
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
          cpState.addSegmentPoints(start, end, count);
        }
      }
      state.setSegmentsStep(0);
      state.setSegmentsStartPoint(null);
    });
  }, [showPromptDialog, t, cpState, state]);

  // ─── Distance workflow ───
  const handleDistanceStartSet = useCallback((point: Point2D) => {
    state.setDistanceStartPoint(point);
    state.setDistanceStep(1);
  }, [state]);

  const handleDistanceComplete = useCallback((start: Point2D, end: Point2D) => {
    showPromptDialog({
      title: t('promptDialog.pointDistance'),
      label: t('promptDialog.enterPointDistance'),
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
          cpState.addDistancePoints(start, end, distance);
        }
      }
      state.setDistanceStep(0);
      state.setDistanceStartPoint(null);
    });
  }, [showPromptDialog, t, cpState, state]);

  // ─── Grid generation ───
  const handleGridOriginSet = useCallback((origin: Point2D) => {
    showPromptDialog({
      title: t('promptDialog.gridPattern'),
      label: t('promptDialog.enterGridPattern'),
      placeholder: t('promptDialog.gridPatternPlaceholder'),
      inputType: 'text',
      validate: (val) => {
        const trimmed = val.trim();
        if (!trimmed) return t('promptDialog.invalidNumber');
        const equalMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*[x×]\s*(\d+)$/i);
        if (equalMatch) return null;
        const parts = trimmed.split(',').map(s => parseFloat(s.trim()));
        if (parts.some(isNaN) || parts.some(n => n <= 0)) return t('promptDialog.invalidNumber');
        return null;
      },
    }).then((result) => {
      if (result !== null) {
        const trimmed = result.trim();
        const offsets: number[] = [];

        const equalMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*[x×]\s*(\d+)$/i);
        if (equalMatch) {
          const spacing = parseFloat(equalMatch[1]);
          const count = parseInt(equalMatch[2], 10);
          for (let i = 0; i <= count; i++) offsets.push(i * spacing);
        } else {
          offsets.push(0);
          const parts = trimmed.split(',').map(s => parseFloat(s.trim()));
          let cumulative = 0;
          for (const p of parts) {
            cumulative += p;
            offsets.push(cumulative);
          }
        }

        for (const off of offsets) guideState.addGuide('X', origin.x + off);
        for (const off of offsets) guideState.addGuide('Y', origin.y + off);
      }
    });
  }, [showPromptDialog, t, guideState]);

  // ─── Polar array ───
  const handlePolarArrayCenterSet = useCallback((center: Point2D) => {
    showPromptDialog({
      title: t('promptDialog.polarArrayCount'),
      label: t('promptDialog.enterPolarArrayCount'),
      placeholder: t('promptDialog.polarArrayCountPlaceholder'),
      inputType: 'text',
      validate: (val) => {
        const trimmed = val.trim();
        const parts = trimmed.split(',');
        const n = parseInt(parts[0], 10);
        if (isNaN(n) || n < 2) return t('promptDialog.invalidNumber');
        if (parts.length > 1) {
          const angle = parseFloat(parts[1]);
          if (isNaN(angle)) return t('promptDialog.invalidNumber');
        }
        return null;
      },
    }).then((result) => {
      if (result !== null) {
        const parts = result.trim().split(',');
        const count = parseInt(parts[0], 10);
        const startAngle = parts.length > 1 ? parseFloat(parts[1]) : 0;
        guideState.createPolarArray(center, count, startAngle);
      }
    });
  }, [showPromptDialog, t, guideState]);

  // ─── Scale ───
  const handleScaleOriginSet = useCallback((origin: Point2D) => {
    showPromptDialog({
      title: t('promptDialog.scaleAllGuides'),
      label: t('promptDialog.enterScaleFactor'),
      placeholder: t('promptDialog.scaleFactorPlaceholder'),
      inputType: 'number',
      validate: (val) => {
        const n = parseFloat(val);
        if (isNaN(n) || n === 0 || n === 1) return t('promptDialog.invalidNumber');
        return null;
      },
    }).then((result) => {
      if (result !== null) {
        const factor = parseFloat(result);
        guideState.scaleAllGuides(origin, factor);
      }
    });
  }, [showPromptDialog, t, guideState]);

  // ─── Guide at angle ───
  const handleGuideAngleOriginSet = useCallback((origin: Point2D) => {
    showPromptDialog({
      title: t('promptDialog.guideAtAngle'),
      label: t('promptDialog.enterGuideAngle'),
      placeholder: t('promptDialog.guideAnglePlaceholder'),
      inputType: 'number',
      validate: (val) => {
        const n = parseFloat(val);
        if (isNaN(n)) return t('promptDialog.invalidNumber');
        return null;
      },
    }).then((result) => {
      if (result !== null) {
        const angleDeg = parseFloat(result);
        const rad = (angleDeg * Math.PI) / 180;
        const extent = 10_000;
        const dx = Math.cos(rad) * extent;
        const dy = Math.sin(rad) * extent;
        const start: Point2D = { x: origin.x - dx, y: origin.y - dy };
        const end: Point2D = { x: origin.x + dx, y: origin.y + dy };
        guideState.addDiagonalGuide(start, end);
      }
    });
  }, [showPromptDialog, t, guideState]);

  // ─── Mirror ───
  const handleMirrorAxisSelected = useCallback((axisGuideId: string) => {
    guideState.mirrorGuides(axisGuideId);
  }, [guideState]);

  return {
    handleParallelRefSelected, handleParallelSideChosen,
    handleRotateRefSelected, handleRotatePivotSet, handleRotateAllPivotSet,
    handleRotateGroupToggle, handleRotateGroupPivotSet,
    handleEqualizeToggle, handleEqualizeApply,
    handleDiagonalStartSet, handleDiagonalDirectionSet, handleDiagonalComplete,
    handlePerpRefSelected, handlePerpPlaced,
    handleSegmentsStartSet, handleSegmentsComplete,
    handleDistanceStartSet, handleDistanceComplete,
    handleGridOriginSet,
    handlePolarArrayCenterSet, handleScaleOriginSet,
    handleGuideAngleOriginSet, handleMirrorAxisSelected,
  } as const;
}

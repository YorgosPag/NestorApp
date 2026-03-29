/**
 * @module guide-workflow-types
 * @enterprise ADR-189 — Shared types for guide tool workflow modules
 */
import type { Point2D } from '../../rendering/types/Types';
import type { ToolType } from '../../ui/toolbar/types';
import type { UseGuideStateReturn } from '../state/useGuideState';
import type { UseConstructionPointStateReturn } from '../state/useConstructionPointState';
import type { PromptDialogOptions } from '../../systems/prompt-dialog';
import type { ICommand } from '../../core/commands/interfaces';
import type { SceneModel } from '../../types/scene';

export type ArcPickableEntity = {
  center: Point2D;
  radius: number;
  startAngle: number;
  endAngle: number;
  isFullCircle: boolean;
};

export type LinePickableEntity = {
  start: Point2D;
  end: Point2D;
};

export interface GuideToolWorkflowsParams {
  activeTool: ToolType | string;
  guideState: UseGuideStateReturn;
  cpState: UseConstructionPointStateReturn;
  showPromptDialog: (opts: PromptDialogOptions) => Promise<string | null>;
  t: (key: string) => string;
  executeCommand: (cmd: ICommand) => void;
  notifyWarning: (msg: string, opts?: Record<string, unknown>) => void;
  notifySuccess: (msg: string, opts?: { duration?: number; actions?: Array<{ label: string; onClick: () => void }> }) => void;
  universalSelection: { getIds: () => string[] };
  currentScene: SceneModel | null;
  transform: { scale: number; offsetX: number; offsetY: number };
  mouseWorld: Point2D | null;
  eventBus: ReturnType<typeof import('../../systems/events').useEventBus>;
}

export interface GuideWorkflowState {
  parallelRefGuideId: string | null;
  setParallelRefGuideId: (id: string | null) => void;
  diagonalStep: 0 | 1 | 2;
  setDiagonalStep: (step: 0 | 1 | 2) => void;
  diagonalStartPoint: Point2D | null;
  setDiagonalStartPoint: (p: Point2D | null) => void;
  diagonalDirectionPoint: Point2D | null;
  setDiagonalDirectionPoint: (p: Point2D | null) => void;
  rotateRefGuideId: string | null;
  setRotateRefGuideId: (id: string | null) => void;
  rotateGroupSelectedIds: Set<string>;
  setRotateGroupSelectedIds: (ids: Set<string>) => void;
  equalizeSelectedIds: Set<string>;
  setEqualizeSelectedIds: (ids: Set<string>) => void;
  perpRefGuideId: string | null;
  setPerpRefGuideId: (id: string | null) => void;
  segmentsStep: 0 | 1;
  setSegmentsStep: (step: 0 | 1) => void;
  segmentsStartPoint: Point2D | null;
  setSegmentsStartPoint: (p: Point2D | null) => void;
  distanceStep: 0 | 1;
  setDistanceStep: (step: 0 | 1) => void;
  distanceStartPoint: Point2D | null;
  setDistanceStartPoint: (p: Point2D | null) => void;
  arcLineStep: 0 | 1;
  setArcLineStep: (step: 0 | 1) => void;
  arcLineLine: LinePickableEntity | null;
  setArcLineLine: (e: LinePickableEntity | null) => void;
  circleIntersectStep: 0 | 1;
  setCircleIntersectStep: (step: 0 | 1) => void;
  circleIntersectFirst: ArcPickableEntity | null;
  setCircleIntersectFirst: (e: ArcPickableEntity | null) => void;
  selectedGuideIds: ReadonlySet<string>;
  setSelectedGuideIds: (ids: ReadonlySet<string>) => void;
  panelHighlightGuideId: string | null;
  panelHighlightPointId: string | null;
}

/**
 * Preview Renderer Types — ADR-065 SRP split
 * Interfaces, constants, and helpers for the preview rendering system.
 */

import type { Point2D } from '../../rendering/types/Types';
import { UI_COLORS, OPACITY } from '../../config/color-config';

/** Arc preview entity type (ADR-059) */
export interface ArcPreviewEntity {
  type: 'arc';
  id: string;
  center: Point2D;
  radius: number;
  startAngle: number;
  endAngle: number;
  visible?: boolean;
  layer?: string;
  preview?: boolean;
  showPreviewGrips?: boolean;
  constructionVertices?: Point2D[];
  showConstructionLines?: boolean;
  showEdgeDistances?: boolean;
  counterclockwise?: boolean;
  constructionLineMode?: 'polyline' | 'radial';
}

export interface PreviewRenderOptions {
  color?: string;
  lineWidth?: number;
  opacity?: number;
  dashPattern?: number[];
  showGrips?: boolean;
  gripSize?: number;
  gripColor?: string;
}

export const DEFAULT_PREVIEW_OPTIONS: Required<PreviewRenderOptions> = {
  color: UI_COLORS.BRIGHT_GREEN,
  lineWidth: 1,
  opacity: OPACITY.HIGH,
  dashPattern: [],
  showGrips: true,
  gripSize: 6,
  gripColor: UI_COLORS.BRIGHT_GREEN,
};

/** Cached Path2D for grip points (performance optimization) */
const GRIP_PATH_CACHE = new Map<number, Path2D>();

export function getGripPath(size: number): Path2D {
  if (!GRIP_PATH_CACHE.has(size)) {
    const path = new Path2D();
    const half = size / 2;
    path.rect(-half, -half, size, size);
    GRIP_PATH_CACHE.set(size, path);
  }
  return GRIP_PATH_CACHE.get(size)!;
}

/** Helpers passed to entity render functions */
export interface PreviewRenderHelpers {
  viewport: import('../../rendering/types/Types').Viewport;
  renderGrip: (ctx: CanvasRenderingContext2D, pos: Point2D, opts: Required<PreviewRenderOptions>) => void;
  renderDistanceLabelFromWorld: (
    ctx: CanvasRenderingContext2D,
    worldP1: Point2D, worldP2: Point2D,
    screenP1: Point2D, screenP2: Point2D
  ) => void;
  renderInfoLabel: (ctx: CanvasRenderingContext2D, screenPos: Point2D, lines: string[]) => void;
}

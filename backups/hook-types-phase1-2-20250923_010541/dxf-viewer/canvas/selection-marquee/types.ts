/**
 * SELECTION MARQUEE TYPES
 * Shared types για το selection marquee system
 */

import type { Point2D } from '../../types/scene';

export type MarqueeKind = 'window' | 'crossing';

export interface MarqueeState {
  active: boolean;
  start?: Point2D;
  end?: Point2D;
  kind?: MarqueeKind;
}

export interface LassoState {
  active: boolean;
  points: Point2D[];
  startedAt?: number;
}

export interface SelectionOverlayState {
  marquee: MarqueeState;
  lasso: LassoState;
}

export interface SelectionMarqueeOverlayProps {
  state: SelectionOverlayState;
  className?: string;
}

export interface MarqueeRectProps {
  start: Point2D;
  end: Point2D;
  kind: MarqueeKind;
}

export interface LassoPolygonProps {
  points: Point2D[];
}

export interface RectGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SelectionColors {
  borderColor: string;
  fillColor: string;
  borderStyle: string;
  borderWidth: number;
}

export interface SelectionInstructionsProps {
  className?: string;
}

export interface SelectionStatusProps {
  marquee?: MarqueeState;
  lasso?: LassoState;
}
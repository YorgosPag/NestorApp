/**
 * Shared Canvas Callback Types
 * Eliminates duplicate callback interface definitions across canvas hooks
 */

import type { Point } from '../../../types/index';

/**
 * Common canvas interaction callbacks - eliminates duplicates
 */
export interface CanvasInteractionCallbacks {
  onMeasurementPoint?: (worldPoint: Point) => void;
  onMeasurementHover?: (worldPoint: Point | null) => void;
  onMeasurementCancel?: () => void;
  onDrawingPoint?: (worldPoint: Point) => void;
  onDrawingHover?: (worldPoint: Point | null) => void;
  onDrawingCancel?: () => void;
  onDrawingDoubleClick?: () => void;
}
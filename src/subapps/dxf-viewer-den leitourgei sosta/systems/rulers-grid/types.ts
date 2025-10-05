import React from 'react';
import type { Point2D } from './config';
import type { 
  RulerSettings, 
  GridSettings, 
  SnapResult, 
  ViewTransform, 
  DOMRect 
} from './config';

export interface RulersGridSystemProps {
  children: React.ReactNode;
  initialRulerSettings?: Partial<RulerSettings>;
  initialGridSettings?: Partial<GridSettings>;
  initialOrigin?: Point2D;
  initialVisibility?: boolean;
  enablePersistence?: boolean;
  persistenceKey?: string;
  onSettingsChange?: (rulers: RulerSettings, grid: GridSettings) => void;
  onOriginChange?: (origin: Point2D) => void;
  onVisibilityChange?: (visible: boolean) => void;
  onSnapResult?: (result: SnapResult | null) => void;
  viewTransform?: ViewTransform;
  canvasBounds?: DOMRect;
}

export const DEFAULT_ORIGIN: Point2D = { x: 0, y: 0 };
/**
 * @module AISnappingEngine.types
 * @description Types + enum for AISnappingEngine (extracted for Google SRP / size limits)
 * @see AISnappingEngine.ts — consumer
 *
 * Types-only module — zero runtime logic. Enum SnapConfidence retained as value-level
 * export (used in class body as numeric constant thresholds).
 */

import type { Point2D } from '../../rendering/types/Types';

/**
 * Snap prediction confidence levels
 */
export enum SnapConfidence {
  LOW = 0.3,
  MEDIUM = 0.6,
  HIGH = 0.9,
  PERFECT = 1.0
}

/**
 * Snap point με AI prediction data
 */
export interface AISnapPoint {
  point: Point2D;
  type: 'endpoint' | 'midpoint' | 'center' | 'intersection' | 'perpendicular' | 'tangent' | 'quadrant' | 'predicted';
  confidence: number;
  weight: number;
  source: string;
  predictedNext?: Point2D[];
}

/**
 * User pattern για learning
 */
export interface UserPattern {
  sequence: Point2D[];
  frequency: number;
  lastUsed: Date;
  context: string;
}

/**
 * Snapping preferences learned από user
 */
export interface LearnedPreferences {
  preferredSnapTypes: Record<string, number>;
  commonDistances: number[];
  commonAngles: number[];
  gridPreference: number;
  patterns: UserPattern[];
}

/**
 * Snap context contains entity and scene information for snapping decisions
 */
export interface SnapContext {
  entities?: Array<{ type: string; start?: Point2D; end?: Point2D; center?: Point2D; radius?: number }>;
  currentTool?: string;
  selectedEntities?: string[];
  viewBounds?: { min: Point2D; max: Point2D };
  gridSize?: number;
  snapMode?: string;
  lastPoint?: Point2D;
}

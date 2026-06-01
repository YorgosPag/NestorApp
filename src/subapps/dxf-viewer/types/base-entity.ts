/**
 * BaseEntity + EntityType extracted from entities.ts to break circular import:
 *   entities.ts → bim/types/wall-types.ts → bim/types/bim-base.ts → entities.ts
 *
 * bim-base.ts now imports BaseEntity from here instead of entities.ts.
 * entities.ts re-exports from here for backward compat.
 *
 * ADR-363 Phase 1 fix — 2026-05-18.
 */

import type { Point2D } from '../rendering/types/Types';
import type { LineweightMm } from './scene-types';
import type { Discipline } from '../bim/discipline/bim-discipline';

export interface PreviewGripPoint {
  position: Point2D;
  type: 'start' | 'end' | 'cursor' | 'vertex' | 'close';
  color?: string;
}

export type EntityType =
  | 'line'
  | 'polyline'
  | 'lwpolyline'
  | 'circle'
  | 'arc'
  | 'ellipse'
  | 'text'
  | 'mtext'
  | 'spline'
  | 'rectangle'
  | 'rect'
  | 'point'
  | 'dimension'
  | 'block'
  | 'angle-measurement'
  | 'leader'
  | 'hatch'
  | 'xline'
  | 'ray'
  | 'array'
  | 'stair'
  | 'center-mark'
  | 'centerline'
  | 'wall'
  | 'opening'
  | 'slab'
  | 'slab-opening'
  | 'column'
  | 'beam';

export interface BaseEntity {
  id: string;
  name?: string;
  type: EntityType;
  /** ADR-358 Phase 9E-6e: stable layer identifier `lyr_<UUID-v4>`. Required on all entities. */
  layerId: string;
  color?: string;
  selected?: boolean;
  preview?: boolean;
  measurement?: boolean;
  isOverlayPreview?: boolean;
  showPreviewGrips?: boolean;
  previewGripPoints?: Point2D[] | PreviewGripPoint[];
  visible?: boolean;
  locked?: boolean;
  metadata?: Record<string, unknown>;

  /**
   * ADR-405 — per-instance Discipline override (Firestore-persisted). Absent ⇒
   * discipline is type-derived via `DISCIPLINE_BY_CATEGORY` (BIM-native default).
   * Mirrors Revit's per-element discipline reassignment. Non-destructive: every
   * existing entity resolves to the correct discipline without migration.
   */
  discipline?: Discipline;

  lineweight?: number;
  opacity?: number;
  lineType?: 'solid' | 'dashed' | 'dotted' | 'dashdot';
  dashScale?: number;
  lineCap?: 'butt' | 'round' | 'square';
  lineJoin?: 'miter' | 'round' | 'bevel';
  dashOffset?: number;

  breakAtCenter?: boolean;
  showEdgeDistances?: boolean;

  colorMode?: 'ByLayer' | 'ByBlock' | 'Concrete';
  colorAci?: number;
  colorTrueColor?: number | null;
  linetypeName?: string;
  lineweightMm?: LineweightMm;
  transparency?: number;
}

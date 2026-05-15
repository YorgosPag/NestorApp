/**
 * TRIM TYPES — ADR-350
 *
 * Shared types for the Trim command. Discriminated unions describe each
 * mutation a single pick produces so the command/undo layer can replay
 * them without re-running geometry math.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-350-trim-command.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity, EntityType } from '../../types/entities';

export type TrimPhase =
  | 'idle'
  | 'selectingEdges'
  | 'picking'
  | 'fence'
  | 'crossing';

export type TrimMode = 'quick' | 'standard';
export type TrimEdgeMode = 'noExtend' | 'extend';
export type TrimProjectMode = 'none' | 'ucs' | 'view';

/** Geometry snapshot used to restore on undo. Same as Entity but read-only. */
export type EntityGeometry = Readonly<Entity>;

/**
 * One atomic mutation produced by a single pick on one entity.
 * The {@link TrimEntityCommand} executes/undoes each operation independently.
 */
export type TrimOperation =
  | {
      readonly kind: 'shorten';
      readonly entityId: string;
      readonly originalGeom: EntityGeometry;
      readonly newGeom: EntityGeometry;
    }
  | {
      readonly kind: 'split';
      readonly entityId: string;
      readonly originalGeom: EntityGeometry;
      readonly replacements: readonly EntityGeometry[]; // 2+ entities replace the original
    }
  | {
      readonly kind: 'promote';
      readonly entityId: string;
      readonly originalType: EntityType;
      readonly originalGeom: EntityGeometry;
      readonly newType: EntityType;
      readonly newGeom: EntityGeometry;
    }
  | {
      readonly kind: 'delete';
      readonly entityId: string;
      readonly originalGeom: EntityGeometry;
    };

/** Preview overlay rendering kind — red for trim, green for extend. */
export type TrimPreviewKind = 'remove' | 'add';

/**
 * Pure geometry payload for the live preview. The overlay renders a
 * semi-transparent stroke along these points; no entity mutation occurs.
 */
export interface TrimPreviewGeom {
  readonly kind: TrimPreviewKind;
  readonly entityId: string;
  /** Polyline path (≥2 points) that visualises the sub-segment under cursor. */
  readonly path: ReadonlyArray<Point2D>;
}

/**
 * Hover aggregator for fence/crossing live preview. Multiple sub-segments
 * may be highlighted simultaneously during drag.
 */
export interface TrimMultiPreview {
  readonly previews: ReadonlyArray<TrimPreviewGeom>;
}

/**
 * Per-pick result returned by the cutter modules. Empty `operations` means
 * the pick had no effect (e.g. degenerate math, hatch, locked).
 */
export interface TrimResult {
  readonly operations: ReadonlyArray<TrimOperation>;
}

/**
 * Cutting edge — either the entity itself (EDGEMODE=0) or a virtual
 * geometry extension (EDGEMODE=1) keyed back to the source entityId.
 */
export interface CuttingEdge {
  readonly sourceEntityId: string;
  readonly entity: Entity;
  /** true when geometry was virtually extended (EDGEMODE=1). */
  readonly extended: boolean;
}

/**
 * Warning aggregator counters — accumulated across one TRIM session and
 * flushed to a single toast on `reset()` (Q6/Q12).
 */
export interface TrimWarningAggregator {
  readonly hatch: number;
  readonly locked: number;
  readonly deletedNoIntersection: number;
}

/** Default zero aggregator. */
export const EMPTY_TRIM_WARNINGS: TrimWarningAggregator = {
  hatch: 0,
  locked: 0,
  deletedNoIntersection: 0,
};

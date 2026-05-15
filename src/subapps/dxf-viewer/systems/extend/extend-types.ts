/**
 * EXTEND TYPES — ADR-353
 *
 * Shared types for the Extend command. Mirrors trim-types.ts pattern (ADR-350).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-353-extend-command.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';

export type ExtendPhase =
  | 'idle'
  | 'selectingEdges'
  | 'picking'
  | 'fence'
  | 'crossing';

export type ExtendMode = 'quick' | 'standard';
export type ExtendEdgeMode = 'noExtend' | 'extend';
export type ExtendProjectMode = 'none' | 'ucs' | 'view';

/** Geometry snapshot used to restore on undo. */
export type EntityGeometry = Readonly<Entity>;

/**
 * One atomic extend mutation per pick. ExtendEntityCommand executes/undoes each
 * independently. noOp is recorded when no boundary is found (silent no-op per ADR-353 Q2).
 */
export type ExtendOperation =
  | {
      readonly kind: 'extend';
      readonly entityId: string;
      readonly originalGeom: EntityGeometry;
      readonly newGeom: EntityGeometry;
    }
  | {
      readonly kind: 'noOp';
      readonly entityId: string;
    };

/**
 * Pure geometry payload for the live hover preview.
 * Green path shows the ghost extension from endpoint to boundary.
 */
export interface ExtendPreviewGeom {
  readonly entityId: string;
  /** Polyline path ≥ 2 points visualising the ghost extension segment. */
  readonly path: ReadonlyArray<Point2D>;
}

/** Multi-entity preview during fence/crossing drag. */
export interface ExtendMultiPreview {
  readonly previews: ReadonlyArray<ExtendPreviewGeom>;
}

/**
 * Warning aggregator — accumulated across one EXTEND session, flushed to a
 * single toast on reset() (mirrors ADR-350 G9).
 */
export interface ExtendWarningAggregator {
  readonly locked: number;
}

export const EMPTY_EXTEND_WARNINGS: ExtendWarningAggregator = {
  locked: 0,
};

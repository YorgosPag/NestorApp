/**
 * ADR-353: Array Commands — core type definitions.
 *
 * Pure math/param types. ArrayEntity itself lives in types/entities.ts
 * to avoid the circular import Entity↔ArrayEntity.
 */

import type { Point2D } from '../../rendering/types/Types';

// ── Kind discriminant ─────────────────────────────────────────────────────────

export type ArrayKind = 'rect' | 'polar' | 'path';

// ── Param sets ────────────────────────────────────────────────────────────────

export interface RectParams {
  readonly kind: 'rect';
  readonly rows: number;
  readonly cols: number;
  readonly rowSpacing: number;
  readonly colSpacing: number;
  /** Array-level rotation in degrees (rotates both col/row basis vectors). */
  readonly angle: number;
}

export interface PolarParams {
  readonly kind: 'polar';
  readonly count: number;
  /** Total arc to fill in degrees. 360 = full circle. */
  readonly fillAngle: number;
  /** Start angle offset in degrees. */
  readonly startAngle: number;
  /** Whether items are rotated to face the center. */
  readonly rotateItems: boolean;
  readonly center: Point2D;
  /** Explicit radius override; 0 = auto-derive from source bbox center distance. */
  readonly radius: number;
}

export interface PathParams {
  readonly kind: 'path';
  readonly count: number;
  /** 'divide' = equal spacing by count; 'measure' = fixed spacing distance. */
  readonly method: 'divide' | 'measure';
  /** Used only when method='measure'. */
  readonly spacing?: number;
  /** Whether each item is tangent-rotated to follow the path direction. */
  readonly alignItems: boolean;
  /** ID of the path entity in the scene. */
  readonly pathEntityId: string;
  /** Reverse traversal direction of the path. */
  readonly reversed: boolean;

  // ── ADR-353 M1 — "magical" entourage extras (all optional → zero regression on legacy arrays).
  //    Big-player parity beyond AutoCAD ARRAYPATH: base align-offset (AutoCAD "Base angle") +
  //    seeded scatter/jitter (Lumion/Enscape/C4D Cloner) + per-point source variety (C4D Cloner).

  /**
   * Constant angle (degrees) ADDED on top of the tangent when `alignItems` is on — e.g. +90 makes
   * theatre chairs face perpendicular to the row / cars sit across a parking lane. Applied even when
   * `alignItems` is off? No — offset is meaningful only relative to the tangent, so it is a no-op
   * unless `alignItems` is true. 0 / undefined = pure tangent.
   */
  readonly alignOffsetDeg?: number;
  /** Seeded scatter: max ± random rotation (degrees) per item. 0 / undefined = none. */
  readonly rotationJitterDeg?: number;
  /** Seeded scatter: max ± lateral offset (drawing units) along the path NORMAL per item. */
  readonly offsetJitter?: number;
  /** Seeded scatter: max ± uniform scale variation, in PERCENT (e.g. 20 = ±20%). */
  readonly scaleJitterPct?: number;
  /** Deterministic seed for all jitter + random source pick. Same seed → same layout (undoable). */
  readonly seed?: number;
  /**
   * How multiple pre-selected sources populate the path:
   *  - 'group'      (default) — the whole source group is replicated at every sample point.
   *  - 'sequential' — ONE source per point, cycling in order (i % M).
   *  - 'random'     — ONE source per point, seeded-random pick (forest variety).
   */
  readonly sourceDistribution?: 'group' | 'sequential' | 'random';
}

export type ArrayParams = RectParams | PolarParams | PathParams;

// ── Transform result ──────────────────────────────────────────────────────────

/**
 * Per-item 2D transform. Translation + optional rotation (degrees).
 * Applied to each source entity clone to produce one item.
 */
export interface ItemTransform {
  readonly translateX: number;
  readonly translateY: number;
  /** Rotation in degrees around the item's own base point. 0 = no rotation. */
  readonly rotateDeg: number;
  /**
   * Uniform scale about the item's own center. undefined / 1 = no scaling. Applied via the
   * `scaleEntity` SSoT (ADR-348) after translate+rotate — used by seeded scatter (ADR-353 M1).
   */
  readonly scale?: number;
}

// ── Source bounding box ───────────────────────────────────────────────────────

export interface SourceBbox {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly width: number;
  readonly height: number;
  readonly center: Point2D;
}

// ── Validation result ─────────────────────────────────────────────────────────

export type ArrayValidationSeverity = 'ok' | 'warn' | 'error';

export interface ArrayValidationResult {
  readonly severity: ArrayValidationSeverity;
  /** i18n key — empty string when severity='ok'. */
  readonly messageKey: string;
  readonly totalCount: number;
}


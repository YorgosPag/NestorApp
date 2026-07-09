/**
 * ADR-612 — Opening Info Tag entity (πινακίδα ανοίγματος).
 *
 * A dedicated, **non-BIM** drawing annotation modelled as a SIBLING of
 * `ScaleBarEntity` / `DimensionEntity` in the generic scene `Entity[]` array
 * (mirrors the ADR-583 Φ2 scale-bar "separate scene-entity type" decision). It
 * rides the `.scene.json` snapshot exactly like scale-bar / dimension / text:
 * plain `extends BaseEntity`, no IFC export, no 3D mesh, no dedicated Firestore
 * collection → deliberately NOT added to `isBimEntityType`.
 *
 * ## Shape (Giorgio 2026-07-09)
 * A 120×80 (3:2) box with 3 editable numeric cells — a Greek building-permit
 * opening schedule box:
 *
 *   ┌─────────────────────────┐
 *   │        topText          │  top cell = full width (Μήκος)
 *   ├────────────┬────────────┤
 *   │ bottomLeft │ bottomRight│  bottom = two equal cells
 *   └────────────┴────────────┘  (Ποδιά)      (Ύψος)
 *
 * ## Sizing model — WORLD units (Giorgio 2026-07-09)
 * Unlike the scale-bar (annotative paper-mm), this tag lives in **world /
 * canonical-mm** space: `widthMm` is a real drawing dimension and the box scales
 * with zoom together with the drawing. Height is DERIVED from the locked 3:2
 * aspect (`OPENING_INFO_TAG_ASPECT`), never stored independently — "δυναμικός
 * οργανισμός, όχι κλείδωμα διάστασης": one DOF (`widthMm`) drives the whole box.
 *
 * The 3 numbers are FREE strings the user types inline on the canvas (no
 * auto-derive from BIM openings in v1 — manual entry, ADR-612 §Decisions).
 *
 * @see types/scale-bar.ts — the sibling annotation template
 * @see bim/opening-info-tag/opening-info-tag-geometry.ts — cell rects (derived cache)
 * @see bim/opening-info-tag/opening-info-tag-primitives.ts — frame-space layout SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-612-opening-info-tag.md
 */

import type { Point2D } from '../rendering/types/Types';
import type { BaseEntity } from './entities';

// ──────────────────────────────────────────────────────────────────────────────
// Geometry constants
// ──────────────────────────────────────────────────────────────────────────────

/** Locked box aspect = height / width = 80 / 120 = 2/3. Height is ALWAYS derived. */
export const OPENING_INFO_TAG_ASPECT = 80 / 120;

/** Numeral cap height as a fraction of the box height (each cell is height/2 tall). */
export const OPENING_INFO_TAG_TEXT_HEIGHT_RATIO = 0.25;

// ──────────────────────────────────────────────────────────────────────────────
// Derived geometry cache
// ──────────────────────────────────────────────────────────────────────────────

/** Which of the 3 editable cells a rect / hit refers to. */
export type OpeningInfoTagCellId = 'top' | 'bottomLeft' | 'bottomRight';

/** A point in the tag's own frame: `u` = along width, `v` = along height (+v up), canonical-mm from the box centre. */
export interface OpeningInfoTagFramePoint {
  readonly u: number;
  readonly v: number;
}

/** One editable cell, in frame space (centre + half-extents), used for hit-testing the inline editor. */
export interface OpeningInfoTagCellRect {
  readonly cell: OpeningInfoTagCellId;
  /** Cell centre in frame space (canonical-mm from the box centre). */
  readonly center: OpeningInfoTagFramePoint;
  /** Half width of the cell (canonical-mm). */
  readonly halfWidth: number;
  /** Half height of the cell (canonical-mm). */
  readonly halfHeight: number;
}

/** Axis-aligned bounding box (canonical-mm, world space AFTER rotation) for broad-phase hit-test / bounds. */
export interface OpeningInfoTagBBox {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/**
 * Pure, side-effect-free output of `computeOpeningInfoTagGeometry(entity)`. A
 * DERIVED cache — the params (`position` / `angleRad` / `widthMm` / the 3 texts)
 * are the SSoT; this is never mutated directly. All scalars are world canonical-mm.
 */
export interface OpeningInfoTagGeometry {
  /** Box width (canonical-mm) = the single sizing DOF. */
  readonly widthMm: number;
  /** Box height (canonical-mm) = `widthMm * OPENING_INFO_TAG_ASPECT`. */
  readonly heightMm: number;
  /** `widthMm / 2`. */
  readonly halfWidth: number;
  /** `heightMm / 2`. */
  readonly halfHeight: number;
  /** Numeral cap height (canonical-mm), shared by all 3 cells. */
  readonly textHeightMm: number;
  /** The 3 editable cell rects (frame space): top, bottomLeft, bottomRight. */
  readonly cells: readonly OpeningInfoTagCellRect[];
  /** Four box corners in WORLD space (canonical-mm), CCW from bottom-left, rotation applied. */
  readonly worldCorners: readonly Point2D[];
  /** World-space AABB (rotation-aware) for broad-phase. */
  readonly bbox: OpeningInfoTagBBox;
}

// ──────────────────────────────────────────────────────────────────────────────
// Entity
// ──────────────────────────────────────────────────────────────────────────────

export interface OpeningInfoTagEntity extends BaseEntity {
  type: 'opening-info-tag';

  /** Box CENTRE (world canonical-mm) — the move-grip anchor and rotation pivot. */
  position: Point2D;
  /** Rotation about `position` in radians (0 = upright). */
  angleRad: number;
  /**
   * Box width in world canonical-mm — the ONLY sizing DOF. Height is derived as
   * `widthMm * OPENING_INFO_TAG_ASPECT` (locked 3:2). Set at creation, changed by
   * the size grip.
   */
  widthMm: number;

  /** Top full-width cell numeral (Μήκος) — a free string the user types (e.g. "5.50"). */
  topText: string;
  /** Bottom-left cell numeral (Ποδιά). */
  bottomLeftText: string;
  /** Bottom-right cell numeral (Ύψος). */
  bottomRightText: string;

  /** DERIVED cache (never mutated; params above are the SSoT). Recomputed by `computeOpeningInfoTagGeometry`. */
  geometry?: OpeningInfoTagGeometry;
}

// ──────────────────────────────────────────────────────────────────────────────
// Defaults (ADR-612)
// ──────────────────────────────────────────────────────────────────────────────

/** Default box width in world canonical-mm (1.2 m wide → 0.8 m tall). */
export const DEFAULT_OPENING_INFO_TAG_WIDTH_MM = 1200;
/**
 * Fresh cells start at `'0.00'` (Giorgio 2026-07-09) — a centred, editable
 * placeholder numeral the user overtypes, scaling with the box on resize.
 */
export const DEFAULT_OPENING_INFO_TAG_TEXT = '0.00';

// ──────────────────────────────────────────────────────────────────────────────
// Type guard
// ──────────────────────────────────────────────────────────────────────────────

export const isOpeningInfoTagEntity = (e: { type: string }): e is OpeningInfoTagEntity =>
  e.type === 'opening-info-tag';

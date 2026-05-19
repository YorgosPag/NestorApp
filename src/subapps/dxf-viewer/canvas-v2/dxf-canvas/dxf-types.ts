/**
 * CANVAS V2 - DXF SPECIFIC TYPES
 * Τύποι μόνο για το DXF canvas module
 */

import type { Point2D } from '../../rendering/types/Types';
import type { SceneLayer, LineweightMm } from '../../types/entities';
import type { StairEntity } from '../../bim/types/stair-types';
// ADR-362 Phase C1 — Dimension entity wrapper for DXF render pipeline.
import type { DimensionEntity } from '../../types/dimension';
// ADR-363 Phase 3.7 — BIM slab / slab-opening wrappers for DXF render pipeline.
import type { SlabEntity } from '../../bim/types/slab-types';
import type { SlabOpeningEntity } from '../../bim/types/slab-opening-types';
// ADR-363 Phase 2 (deferred pipeline) — opening wrapper for DXF render pipeline.
import type { OpeningEntity } from '../../bim/types/opening-types';
// ADR-359 Phase 11 — construction line wrappers for grip computation pipeline.
import type { XLineEntity, RayEntity } from '../../types/entities';

// === DXF ENTITY TYPES ===
export interface DxfEntity {
  id: string;
  type: 'line' | 'circle' | 'arc' | 'polyline' | 'text' | 'angle-measurement' | 'stair' | 'dimension' | 'slab' | 'slab-opening' | 'opening' | 'xline' | 'ray';
  /**
   * @deprecated ADR-358 Phase 9D-5b-ii — transitional name backref. Resolve via
   * `LayerStore.resolveEntityLayerName()`. Made optional to align with BaseEntity
   * dual-write window. Collapses to `layerId` only at end of Phase 9D-5b-iii.
   */
  layer?: string;
  /**
   * ADR-358 Phase 9D-2 — Stable layer id (`lyr_<UUID-v4>`) mirror of `BaseEntity.layerId`.
   * Optional during transitional Phase 9D window; becomes required at end of Phase 9D-5b-iii
   * (paired with `BaseEntity.layerId` final flip). Forwarded by `useDxfSceneConversion`
   * so renderer/hit-test can resolve layer via id instead of name lookup.
   */
  layerId?: string;
  /**
   * ADR-358 §G7 Phase 6 — concrete hex color. Optional sentinel: when absent
   * AND `colorMode !== 'Concrete'`, the renderer cascades through
   * `resolveStyleForRender()` → layer color (ByLayer). Legacy entities that
   * emit a literal hex keep working unchanged.
   */
  color?: string;
  /**
   * ADR-358 §G7 Phase 6 — concrete stroke width in px. Optional sentinel:
   * when absent AND `lineweightMm` is missing or a -3/-2/-1 sentinel, the
   * renderer cascades to layer.lineweight via `resolveStyleForRender()`.
   */
  lineWidth?: number;
  visible: boolean;
  // ─── ADR-358 §G7 — ByLayer / ByBlock sentinel inputs (Phase 6) ──────────
  // Mirror of `BaseEntity` Phase-4 fields. Forwarded by `useDxfSceneConversion`
  // so `DxfRenderer.resolveStyleForRender()` can route through the full
  // `entityToStyleInput()` adapter (color + linetype + lineweight cascade).
  /** Explicit colour resolution mode. Missing or 'ByLayer' → inherit from layer. */
  colorMode?: 'ByLayer' | 'ByBlock' | 'Concrete';
  /** ACI 1-255 — DXF group 62. Takes priority over `color` hex when present. */
  colorAci?: number;
  /** TrueColor 0xRRGGBB — DXF group 420. Takes priority over ACI + hex. */
  colorTrueColor?: number | null;
  /** Linetype DXF name — literals 'ByLayer'/'ByBlock' opt into inheritance. */
  linetypeName?: string;
  /** Lineweight mm — DXF group 370. Accepts -3/-2/-1 sentinels. */
  lineweightMm?: LineweightMm;
  /** Transparency 0-90 — DXF group 1071. 0 = opaque. */
  transparency?: number;
}

export interface DxfLine extends DxfEntity {
  type: 'line';
  start: Point2D;
  end: Point2D;
}

export interface DxfCircle extends DxfEntity {
  type: 'circle';
  center: Point2D;
  radius: number;
}

export interface DxfPolyline extends DxfEntity {
  type: 'polyline';
  vertices: Point2D[];
  closed: boolean;
}

export interface DxfArc extends DxfEntity {
  type: 'arc';
  center: Point2D;
  radius: number;
  startAngle: number; // in degrees
  endAngle: number; // in degrees
  // 🔧 FIX (2026-01-31): Arc direction flag for correct rendering
  // true = draw counterclockwise, false = draw clockwise (default)
  counterclockwise?: boolean;
}

/**
 * ADR-344 Phase 6.E — Rich-text style derived from the first run of textNode.
 * Carries only what Canvas2D can render: font family, weight, italic, per-run color.
 */
export interface DxfTextStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  overline?: boolean;
  strikethrough?: boolean;
  fontFamily?: string;
  /** Per-run color override (overrides entity.color when set). */
  runColor?: string;
  /** Derived from textNode.attachment horizontal component (L/C/R). */
  textAlign?: 'left' | 'center' | 'right';
  /** Derived from textNode.attachment vertical component (T/M/B). */
  textBaseline?: 'top' | 'middle' | 'bottom';
}

export interface DxfText extends DxfEntity {
  type: 'text';
  position: Point2D;
  text: string;
  height: number;
  rotation?: number; // in degrees
  /** ADR-344 Phase 6.E: style derived from textNode first-run, used by TextRenderer. */
  textStyle?: DxfTextStyle;
}

export interface DxfAngleMeasurement extends DxfEntity {
  type: 'angle-measurement';
  vertex: Point2D; // Center point of the angle
  point1: Point2D; // First arm endpoint
  point2: Point2D; // Second arm endpoint
  angle: number; // Angle in degrees
}

/**
 * ADR-358 Phase 5b — DxfStair wrapper. Exposes a parametric `StairEntity`
 * (`SceneModel.entities`) to the DXF render + grip pipeline without expanding
 * it into N polylines. SSoT: geometry lives in `stairEntity.geometry` and is
 * recomputed by `computeStairGeometry()` at commit time, never duplicated.
 */
export interface DxfStair extends DxfEntity {
  type: 'stair';
  stairEntity: StairEntity;
}

/**
 * ADR-362 Phase C1 — DxfDimension wrapper. Carries the full discriminated-union
 * `DimensionEntity` (10 variants) through the DXF render pipeline without
 * flattening into legacy text+line primitives. `DimensionRenderer` resolves
 * `DimStyle` + `DimGeometry` on the fly using the registry singleton + the
 * per-frame `DimensionLookup` Map (set on `EntityRendererComposite` from
 * `DxfRenderer.render()`).
 */
export interface DxfDimension extends DxfEntity {
  type: 'dimension';
  dimensionEntity: DimensionEntity;
}

/** ADR-363 Phase 3.7 — DxfSlab wrapper. SlabRenderer renders from `slabEntity.geometry`. */
export interface DxfSlab extends DxfEntity {
  type: 'slab';
  slabEntity: SlabEntity;
}

/** ADR-363 Phase 3.7 — DxfSlabOpening wrapper. SlabOpeningRenderer renders from `slabOpeningEntity`. */
export interface DxfSlabOpening extends DxfEntity {
  type: 'slab-opening';
  slabOpeningEntity: SlabOpeningEntity;
}

/** ADR-363 Phase 2 (deferred pipeline) — DxfOpening wrapper. OpeningRenderer renders from `openingEntity.geometry`. WallRenderer uses per-frame `openingsByWall` map for boolean cutouts. */
export interface DxfOpening extends DxfEntity {
  type: 'opening';
  openingEntity: OpeningEntity;
}

/** ADR-359 Phase 11 — XLine wrapper for grip computation pipeline. */
export interface DxfXLine extends DxfEntity {
  type: 'xline';
  xlineEntity: XLineEntity;
}

/** ADR-359 Phase 11 — Ray wrapper for grip computation pipeline. */
export interface DxfRay extends DxfEntity {
  type: 'ray';
  rayEntity: RayEntity;
}

export type DxfEntityUnion = DxfLine | DxfCircle | DxfPolyline | DxfArc | DxfText | DxfAngleMeasurement | DxfStair | DxfDimension | DxfSlab | DxfSlabOpening | DxfOpening | DxfXLine | DxfRay;

// === DXF SCENE ===
export interface DxfScene {
  entities: DxfEntityUnion[];
  /** @deprecated ADR-358 §G7 Phase 5 — use `layersById` for full SceneLayer access. Kept lossy for legacy callers (bounds calc, FitToView, etc.). */
  layers: string[];
  /**
   * ADR-358 §G7 Phase 5 — full `SceneLayer` map keyed by layer name.
   * Bridges `SceneModel.layers` into the renderer so `resolveEntityStyle()` can
   * cascade ByLayer/ByBlock/DEFAULT sentinels. Absent → renderer falls back to
   * per-entity literal values (legacy path, Phase 1-4 baseline).
   */
  layersById?: Record<string, SceneLayer>;
  bounds: {
    min: Point2D;
    max: Point2D;
  } | null;
}

// === DXF RENDERING ===
export interface DxfRenderOptions {
  showGrid: boolean;
  showLayerNames: boolean;
  wireframeMode: boolean;
  selectedEntityIds: string[];
  hoveredEntityId?: string | null;
  /** Grip interaction state for visual feedback (hovered/active grip coloring) */
  gripInteractionState?: {
    hoveredGrip?: { entityId: string; gripIndex: number };
    activeGrip?: { entityId: string; gripIndex: number };
  };
  // ADR-049 SSOT (2026-05-12): the `dragPreview` field used to live here so
  // DxfRenderer could mutate the entity in-place during grip drag. It has
  // been removed — drag-time ghost rendering is now exclusively handled by
  // `useGripGhostPreview` on the PreviewCanvas overlay, mirroring the Move
  // tool path and freeing the bitmap cache from 60fps invalidation.
  /**
   * Phase D RE-IMPLEMENT (ADR-040, 2026-05-09): when true, render entities in
   * pure normal-state (no hover, no selection, no grips, no drag preview).
   * Used by the bitmap cache layer — interactive state is rendered separately
   * via DxfRenderer.renderSingleEntity() as a single-entity overlay on top.
   */
  skipInteractive?: boolean;
  /**
   * ADR-358 §G7 Phase 4 — ByLayer/ByBlock resolver layer map.
   * When provided, the renderer routes each entity through `resolveEntityStyle()`
   * to inherit color/linetype/lineweight from its owning `SceneLayer`. Absent or
   * missing layer → renderer falls back to per-entity literal values (legacy).
   */
  layersById?: Record<string, SceneLayer>;
}

// === DXF SELECTION ===
export interface DxfSelectionResult {
  entityId: string;
  distance: number;
  point: Point2D;
}
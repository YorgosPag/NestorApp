/**
 * CANVAS V2 - DXF SPECIFIC TYPES
 * Τύποι μόνο για το DXF canvas module
 */

import type { Point2D } from '../../rendering/types/Types';
import type { LineSpacingMode } from '../../text-engine/types';
import type { SceneLayer, LineweightMm, HatchEntity } from '../../types/entities';
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
// ADR-363 Phase 1B — wall wrapper for DXF render pipeline.
import type { WallEntity } from '../../bim/types/wall-types';
// ADR-363 Phase 5 — beam wrapper for DXF render pipeline.
import type { BeamEntity } from '../../bim/types/beam-types';
// ADR-363 Phase 4 — column direct entity for DXF render pipeline.
import type { ColumnEntity } from '../../bim/types/column-types';
// ADR-470 — per-element structural component visibility override.
import type { BimElementStyleOverride } from '../../config/bim-object-styles';
import type { FoundationEntity } from '../../bim/types/foundation-types';
// ADR-584 / N.18 — MEP fixture (406), electrical panel (408 Φ3), railing (407),
// furniture (410), imported-mesh, generic-solid (684 Φ2) via the shared barrel (one import).
import type {
  MepFixtureEntity, ElectricalPanelEntity, RailingEntity,
  FurnitureEntity, ImportedMeshEntity, GenericSolidEntity,
} from '../../bim/types/bim-placeable-entity-types';
// ADR-417 — roof direct entity for DXF render pipeline.
import type { RoofEntity } from '../../bim/types/roof-types';
import type { FloorFinishEntity } from '../../bim/types/floor-finish-types';
import type { WallCoveringEntity } from '../../bim/types/wall-covering-types';
import type { ThermalSpaceEntity } from '../../bim/types/thermal-space-types';
import type { SpaceSeparatorEntity } from '../../bim/types/space-separator-types';
import type { MepSegmentEntity } from '../../bim/types/mep-segment-types';
import type { MepFittingEntity } from '../../bim/types/mep-fitting-types';
// ADR-415 — floorplan symbol direct entity for DXF render pipeline.
import type { FloorplanSymbolEntity } from '../../bim/types/floorplan-symbol-types';
// ADR-583 — annotation symbol (North arrow) lightweight entity for DXF render pipeline.
import type { AnnotationSymbolEntity } from '../../types/annotation-symbol';
// ADR-583 Φ2 — graphic scale-bar lightweight entity for DXF render pipeline.
import type { ScaleBarEntity } from '../../types/scale-bar';
// ADR-612 — opening info tag lightweight entity for DXF render pipeline.
import type { OpeningInfoTagEntity } from '../../types/opening-info-tag';
// ADR-651 Φάση Ε — standalone raster image lightweight entity for DXF render pipeline.
import type { ImageEntity } from '../../types/image';
// ADR-662 Φάση 2β (Δρόμος Γ) — thin/derived topo surface entity for DXF render pipeline.
import type { TopoSurfaceEntity } from '../../types/topo-surface';
// ADR-635 Φάση B — leader callout annotation entity for DXF render pipeline.
import type { LeaderEntity } from '../../types/entities';
// ADR-408 Φ12 — plumbing manifold direct entity for DXF render pipeline.
import type { MepManifoldEntity } from '../../bim/types/mep-manifold-types';
// ADR-408 Εύρος Β — heating radiator direct entity for DXF render pipeline.
import type { MepRadiatorEntity } from '../../bim/types/mep-radiator-types';
// ADR-408 Εύρος Β #2 — heating boiler direct entity for DXF render pipeline.
import type { MepBoilerEntity } from '../../bim/types/mep-boiler-types';
// ADR-408 DHW — domestic hot water heater direct entity for DXF render pipeline.
import type { MepWaterHeaterEntity } from '../../bim/types/mep-water-heater-types';
// ADR-408 Εύρος Β #3 — underfloor heating direct entity for DXF render pipeline.
import type { MepUnderfloorEntity } from '../../bim/types/mep-underfloor-types';

// === DXF ENTITY TYPES ===
export interface DxfEntity {
  id: string;
  type: 'line' | 'circle' | 'arc' | 'polyline' | 'text' | 'angle-measurement' | 'stair' | 'dimension' | 'slab' | 'slab-opening' | 'opening' | 'wall' | 'column' | 'foundation' | 'xline' | 'ray' | 'beam' | 'mep-fixture' | 'electrical-panel' | 'railing' | 'furniture' | 'mep-segment' | 'mep-fitting' | 'floorplan-symbol' | 'annotation-symbol' | 'scale-bar' | 'opening-info-tag' | 'mep-manifold' | 'mep-radiator' | 'mep-boiler' | 'mep-water-heater' | 'mep-underfloor' | 'roof' | 'floor-finish' | 'wall-covering' | 'thermal-space' | 'space-separator' | 'hatch' | 'image';
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
  /**
   * ADR-470 — per-element structural component visibility override (forwarded από
   * το BIM entity μέσω `buildBase`). Διαβάζεται από τα scene-level overlay passes
   * (σοβάς/οπλισμός) ώστε το per-element override να ισχύει ΚΑΙ εκεί, όχι μόνο
   * στους leaf renderers. Absent ⇒ μόνο το per-view flag ισχύει.
   */
  styleOverride?: BimElementStyleOverride;
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
  /**
   * ADR-510 Φ3b/Φ3c — per-segment arc/width parallel arrays, index-aligned with
   * `vertices` (AutoCAD/DXF semantics: `bulges[i]` spans `vertices[i] → [i+1]`,
   * closed: `bulges[n-1]` spans n-1 → 0). Mirror of `PolylineEntity` in
   * `types/entities.ts` so the unified grip path (`computeDxfEntityGrips`) and
   * renderer see the same arc data. Absent ⇒ all segments straight, width 0.
   */
  bulges?: number[];
  startWidths?: number[];
  endWidths?: number[];
  /**
   * ADR-650 M3 — non-destructive «fitted curve» display flag (topographic contours,
   * «ακριβείς↔όμορφες»). `vertices` stay EXACT; only the STROKE is a Catmull-Rom curve.
   * Carried from the SceneModel entity so PolylineRenderer's smooth branch is reachable.
   */
  smoothDisplay?: boolean;
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
  /**
   * ADR-557 — AutoCAD TEXT oblique angle (degrees, +CW forward slant). Rendered as a
   * horizontal shear around the anchor by `TextRenderer` (`ctx.transform(1,0,-tan(θ),1,0,0)`);
   * independent of `italic` (which swaps to the italic font face). Default 0 (upright).
   */
  obliqueAngle?: number;
  /**
   * AutoCAD MTEXT `\T` character tracking — inter-glyph spacing FACTOR (1.0 = normal, >1
   * looser, <1 tighter). Applied by `TextRenderer`/`text-advance` as a per-glyph pen-advance
   * multiplier (shapes untouched, unlike `widthFactor`). Default 1.
   */
  tracking?: number;
}

export interface DxfText extends DxfEntity {
  type: 'text';
  position: Point2D;
  text: string;
  height: number;
  rotation?: number; // in degrees
  /** ADR-344 Phase 6.E: style derived from textNode first-run, used by TextRenderer. */
  textStyle?: DxfTextStyle;
  /**
   * ADR-557 — effective box width (world units) of the grip rectangle. Carried by
   * the scene→DxfText converter so `getTextGrips` / `applyTextGripDrag` read the
   * box width directly (DxfEntityUnion has no `mtext` variant): for MTEXT = the
   * real `MTextEntity.width`; for TEXT = `text.length·height·CHAR_WIDTH·widthFactor`.
   * Absent on legacy paths → the adapter falls back to the TEXT formula.
   */
  width?: number;
  /**
   * ADR-557 — AutoCAD TEXT X-scale (horizontal stretch factor, default 1). Drives
   * the e/w edge resize on a simple TEXT (MTEXT uses `width` instead). Read by the
   * grip adapter and `TextRenderer` (horizontal `ctx.scale(widthFactor, 1)`).
   */
  widthFactor?: number;
  /**
   * ADR-557 — node line-spacing `{ mode, factor }`, carried FLAT by the scene→DxfText
   * converter (the full `textNode` AST is deliberately flattened away — like `textStyle` /
   * `widthFactor`). `TextRenderer` / `text-box` / 3D read the `factor` via
   * `resolveLineSpacingRatio`; without this the render/box path never saw a non-default
   * factor (the ribbon «Διάστιχο» edit did nothing on canvas). Absent → factor 1.
   */
  lineSpacing?: { readonly mode: LineSpacingMode; readonly factor: number };
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

/**
 * ADR-363 Phase 1B — DxfWall direct entity (no nested wallEntity wrapper).
 * WallRenderer reads geometry.outerEdge/innerEdge/axisPolyline + params.category.
 * Direct pattern matches HitTestingService §1B contract: geometry.bbox accessible
 * at top level for BoundsCalculator spatial indexing (calculateBimEntityBounds).
 */
export interface DxfWall extends DxfEntity {
  type: 'wall';
  kind: WallEntity['kind'];
  params: WallEntity['params'];
  geometry: WallEntity['geometry'];
  validation?: WallEntity['validation'];
}

/**
 * ADR-363 Phase 5 — DxfBeam direct entity (same pattern as DxfWall).
 * BeamRenderer reads geometry.outline/axisPolyline + params directly.
 */
export interface DxfBeam extends DxfEntity {
  type: 'beam';
  kind: BeamEntity['kind'];
  params: BeamEntity['params'];
  geometry: BeamEntity['geometry'];
  validation?: BeamEntity['validation'];
}

/**
 * ADR-363 Phase 4 — DxfColumn direct entity (same pattern as DxfWall/DxfBeam).
 * ColumnRenderer reads geometry.footprint + kind + params fields at top level.
 */
export interface DxfColumn extends DxfEntity {
  type: 'column';
  kind: ColumnEntity['kind'];
  params: ColumnEntity['params'];
  geometry: ColumnEntity['geometry'];
  validation?: ColumnEntity['validation'];
}

/**
 * ADR-436 Slice 1 — DxfFoundation direct entity (same pattern as DxfColumn).
 * FoundationRenderer reads geometry.footprint + kind + params at top level.
 */
export interface DxfFoundation extends DxfEntity {
  type: 'foundation';
  kind: FoundationEntity['kind'];
  params: FoundationEntity['params'];
  geometry: FoundationEntity['geometry'];
  validation?: FoundationEntity['validation'];
}

/**
 * ADR-406 — DxfMepFixture direct entity (same pattern as DxfColumn).
 * MepFixtureRenderer reads geometry.footprint + kind + params fields at top level.
 */
export interface DxfMepFixture extends DxfEntity {
  type: 'mep-fixture';
  kind: MepFixtureEntity['kind'];
  params: MepFixtureEntity['params'];
  geometry: MepFixtureEntity['geometry'];
  validation?: MepFixtureEntity['validation'];
}

/**
 * ADR-408 Φ3 — DxfElectricalPanel direct entity (same pattern as DxfMepFixture).
 * ElectricalPanelRenderer reads geometry.footprint + kind + params at top level.
 */
export interface DxfElectricalPanel extends DxfEntity {
  type: 'electrical-panel';
  kind: ElectricalPanelEntity['kind'];
  params: ElectricalPanelEntity['params'];
  geometry: ElectricalPanelEntity['geometry'];
  validation?: ElectricalPanelEntity['validation'];
}

/**
 * ADR-407 — DxfRailing direct entity (same pattern as DxfMepFixture).
 * RailingRenderer reads geometry.resolvedPath + params fields at top level.
 */
export interface DxfRailing extends DxfEntity {
  type: 'railing';
  kind: RailingEntity['kind'];
  params: RailingEntity['params'];
  geometry: RailingEntity['geometry'];
  validation?: RailingEntity['validation'];
}

/**
 * ADR-410 — DxfFurniture direct entity (same pattern as DxfMepFixture).
 * FurnitureRenderer reads geometry.footprint + kind + params at top level.
 */
export interface DxfFurniture extends DxfEntity {
  type: 'furniture';
  kind: FurnitureEntity['kind'];
  params: FurnitureEntity['params'];
  geometry: FurnitureEntity['geometry'];
  validation?: FurnitureEntity['validation'];
}

/**
 * ADR-683 Φ3 — DxfImportedMesh direct entity (ίδιο σχήμα με το DxfFurniture).
 * Ο `ImportedMeshRenderer` διαβάζει `geometry.footprint` + `params` στο top level· το
 * ακριβές περίγραμμα το τραβά από το `bimMeshCache` όταν το glTF έχει φορτώσει.
 */
export interface DxfImportedMesh extends DxfEntity {
  type: 'imported-mesh';
  kind: ImportedMeshEntity['kind'];
  params: ImportedMeshEntity['params'];
  geometry: ImportedMeshEntity['geometry'];
  validation?: ImportedMeshEntity['validation'];
}

/**
 * ADR-684 Φ2 — DxfGenericSolid direct entity (ίδιο quartet passthrough με DxfImportedMesh).
 * Ο `GenericSolidRenderer` διαβάζει `geometry.footprint` + `params.shape` στο top level· το
 * περίγραμμα είναι το ορθογώνιο του bbox (κοινός πυρήνας με imported-mesh/furniture).
 */
export interface DxfGenericSolid extends DxfEntity {
  type: 'generic-solid';
  kind: GenericSolidEntity['kind'];
  params: GenericSolidEntity['params'];
  geometry: GenericSolidEntity['geometry'];
  validation?: GenericSolidEntity['validation'];
}

/**
 * ADR-408 Φ8 — DxfMepSegment direct entity (same pattern as DxfBeam).
 * MepSegmentRenderer reads geometry.outline + axisPolyline + params at top level.
 */
export interface DxfMepSegment extends DxfEntity {
  type: 'mep-segment';
  kind: MepSegmentEntity['kind'];
  params: MepSegmentEntity['params'];
  geometry: MepSegmentEntity['geometry'];
  validation?: MepSegmentEntity['validation'];
}

/**
 * ADR-408 Φ11 — DxfMepFitting direct entity (same pattern as DxfMepSegment).
 * MepFittingRenderer reads geometry.footprint + kind + params at top level.
 */
export interface DxfMepFitting extends DxfEntity {
  type: 'mep-fitting';
  kind: MepFittingEntity['kind'];
  params: MepFittingEntity['params'];
  geometry: MepFittingEntity['geometry'];
  validation?: MepFittingEntity['validation'];
}

/**
 * ADR-415 — DxfFloorplanSymbol direct entity (same pattern as DxfFurniture).
 * FloorplanSymbolRenderer reads geometry.footprint + kind + params at top level.
 */
export interface DxfFloorplanSymbol extends DxfEntity {
  type: 'floorplan-symbol';
  kind: FloorplanSymbolEntity['kind'];
  params: FloorplanSymbolEntity['params'];
  geometry: FloorplanSymbolEntity['geometry'];
  validation?: FloorplanSymbolEntity['validation'];
}

/**
 * ADR-583 — DxfAnnotationSymbol lightweight direct entity (non-BIM). Carries the
 * flat annotation fields (position / kind / symbolId / sizeMm / rotation) at top
 * level; `AnnotationSymbolRenderer` reads them + the catalog glyph. No
 * geometry/params/validation — it is a paper decoration, not a model element.
 */
export interface DxfAnnotationSymbol extends DxfEntity {
  type: 'annotation-symbol';
  position: AnnotationSymbolEntity['position'];
  kind: AnnotationSymbolEntity['kind'];
  symbolId: AnnotationSymbolEntity['symbolId'];
  sizeMm: AnnotationSymbolEntity['sizeMm'];
  rotation?: AnnotationSymbolEntity['rotation'];
}

/**
 * ADR-583 Φ2 — DxfScaleBar lightweight direct entity (non-BIM, sibling of DxfAnnotationSymbol).
 * Carries the flat scale-bar params (position / angleRad / length / unit / divisions /
 * subdivisions / style / annotative sizes) at top level; `ScaleBarRenderer` reads them +
 * `computeScaleBarGeometry`. No geometry/params/validation quartet — it is a paper
 * decoration whose span is DERIVED, not stored. Without this variant + its TO_DXF handler
 * the freshly-placed bar fell to `convertEntity`'s `null` default → invisible + un-grippable.
 */
export interface DxfScaleBar extends DxfEntity {
  type: 'scale-bar';
  position: ScaleBarEntity['position'];
  angleRad: ScaleBarEntity['angleRad'];
  length: ScaleBarEntity['length'];
  unit: ScaleBarEntity['unit'];
  divisions: ScaleBarEntity['divisions'];
  subdivisions: ScaleBarEntity['subdivisions'];
  style: ScaleBarEntity['style'];
  barHeightMm: ScaleBarEntity['barHeightMm'];
  labelHeightMm: ScaleBarEntity['labelHeightMm'];
  labelPlacement: ScaleBarEntity['labelPlacement'];
}

/**
 * ADR-612 — DxfOpeningInfoTag lightweight direct entity (non-BIM, sibling of DxfScaleBar).
 * Carries the flat opening-info-tag params (position / angleRad / widthMm / the 3
 * numeral texts) at top level; `OpeningInfoTagRenderer` reads them +
 * `computeOpeningInfoTagGeometry`. No geometry/params/validation quartet — it is a
 * WORLD-unit box whose cell rects are DERIVED, not stored. Without this variant +
 * its TO_DXF handler the freshly-placed tag would fall to `convertEntity`'s `null`
 * default → invisible + un-grippable (the ADR-583 trap).
 */
export interface DxfOpeningInfoTag extends DxfEntity {
  type: 'opening-info-tag';
  position: OpeningInfoTagEntity['position'];
  angleRad: OpeningInfoTagEntity['angleRad'];
  widthMm: OpeningInfoTagEntity['widthMm'];
  topText: OpeningInfoTagEntity['topText'];
  bottomLeftText: OpeningInfoTagEntity['bottomLeftText'];
  bottomRightText: OpeningInfoTagEntity['bottomRightText'];
}

/**
 * ADR-651 Φάση Ε — DxfImage lightweight direct entity (non-BIM, sibling of DxfScaleBar /
 * DxfOpeningInfoTag). Carries the flat image params (position / width / height / url /
 * rotation) at top level; `ImageRenderer` reads them + the shared `HatchImageCache`
 * (identity resolveSrc). No geometry/params/validation quartet — it is a raster paper
 * decoration, not a model element. Without this variant + its TO_DXF handler the
 * freshly-placed image would fall to `convertEntity`'s `null` default → invisible +
 * un-grippable (the ADR-583/612 trap).
 */
export interface DxfImage extends DxfEntity {
  type: 'image';
  position: ImageEntity['position'];
  width: ImageEntity['width'];
  height: ImageEntity['height'];
  url: ImageEntity['url'];
  rotation?: ImageEntity['rotation'];
  dxfImageExport?: ImageEntity['dxfImageExport'];
}

/**
 * ADR-408 Φ12 — DxfMepManifold direct entity (same pattern as DxfElectricalPanel).
 * MepManifoldRenderer reads geometry.footprint + kind + params at top level.
 */
export interface DxfMepManifold extends DxfEntity {
  type: 'mep-manifold';
  kind: MepManifoldEntity['kind'];
  params: MepManifoldEntity['params'];
  geometry: MepManifoldEntity['geometry'];
  validation?: MepManifoldEntity['validation'];
}

/**
 * ADR-408 Εύρος Β — DxfMepRadiator direct entity (same pattern as DxfMepManifold).
 * MepRadiatorRenderer reads geometry.footprint + kind + params at top level.
 */
export interface DxfMepRadiator extends DxfEntity {
  type: 'mep-radiator';
  kind: MepRadiatorEntity['kind'];
  params: MepRadiatorEntity['params'];
  geometry: MepRadiatorEntity['geometry'];
  validation?: MepRadiatorEntity['validation'];
}

/**
 * ADR-408 Εύρος Β #2 — DxfMepBoiler direct entity (same pattern as DxfMepRadiator).
 * MepBoilerRenderer reads geometry.footprint + kind + params at top level.
 */
export interface DxfMepBoiler extends DxfEntity {
  type: 'mep-boiler';
  kind: MepBoilerEntity['kind'];
  params: MepBoilerEntity['params'];
  geometry: MepBoilerEntity['geometry'];
  validation?: MepBoilerEntity['validation'];
}

/**
 * ADR-408 DHW — DxfMepWaterHeater direct entity (same pattern as DxfMepBoiler).
 * MepWaterHeaterRenderer reads geometry.footprint + kind + params at top level.
 */
export interface DxfMepWaterHeater extends DxfEntity {
  type: 'mep-water-heater';
  kind: MepWaterHeaterEntity['kind'];
  params: MepWaterHeaterEntity['params'];
  geometry: MepWaterHeaterEntity['geometry'];
  validation?: MepWaterHeaterEntity['validation'];
}

/**
 * ADR-408 Εύρος Β #3 — DxfMepUnderfloor direct entity (same pattern as DxfMepBoiler).
 * MepUnderfloorRenderer reads geometry.loopPath + geometry.bbox + params.footprint at top level.
 */
export interface DxfMepUnderfloor extends DxfEntity {
  type: 'mep-underfloor';
  kind: MepUnderfloorEntity['kind'];
  params: MepUnderfloorEntity['params'];
  geometry: MepUnderfloorEntity['geometry'];
  validation?: MepUnderfloorEntity['validation'];
}

/**
 * ADR-417 — DxfRoof direct entity (same pattern as DxfSlab/DxfFurniture).
 * RoofRenderer reads geometry.faces + geometry.ridges + footprint at top level.
 */
export interface DxfRoof extends DxfEntity {
  type: 'roof';
  kind: RoofEntity['kind'];
  params: RoofEntity['params'];
  geometry: RoofEntity['geometry'];
  validation?: RoofEntity['validation'];
}

/**
 * ADR-419 — DxfFloorFinish direct entity (same pattern as DxfSlab/DxfRoof).
 * FloorFinishRenderer reads geometry.bbox + params.footprint + params.materialId at top level.
 */
export interface DxfFloorFinish extends DxfEntity {
  type: 'floor-finish';
  kind: FloorFinishEntity['kind'];
  params: FloorFinishEntity['params'];
  geometry: FloorFinishEntity['geometry'];
}

/**
 * ADR-511 — DxfWallCovering direct entity (same pattern as DxfFloorFinish).
 * WallCoveringRenderer computes the live face strip from the host wall (per-frame index).
 */
export interface DxfWallCovering extends DxfEntity {
  type: 'wall-covering';
  kind: WallCoveringEntity['kind'];
  params: WallCoveringEntity['params'];
  geometry: WallCoveringEntity['geometry'];
}

/**
 * ADR-422 — DxfThermalSpace direct entity (same pattern as DxfFloorFinish).
 * ThermalSpaceRenderer reads geometry.bbox + params.footprint + params.useType at top level.
 */
export interface DxfThermalSpace extends DxfEntity {
  type: 'thermal-space';
  kind: ThermalSpaceEntity['kind'];
  params: ThermalSpaceEntity['params'];
  geometry: ThermalSpaceEntity['geometry'];
}

/**
 * ADR-437 — DxfSpaceSeparator direct entity (same pattern as DxfThermalSpace).
 * SpaceSeparatorRenderer reads geometry.bbox + params.start/end at top level.
 */
export interface DxfSpaceSeparator extends DxfEntity {
  type: 'space-separator';
  kind: SpaceSeparatorEntity['kind'];
  params: SpaceSeparatorEntity['params'];
  geometry: SpaceSeparatorEntity['geometry'];
}

/**
 * ADR-507 S2 — DxfHatch direct entity. HatchRenderer reads boundaryPaths +
 * fill/pattern fields at top level (μέσω `isHatchEntity` cast σε HatchEntity).
 */
export interface DxfHatch extends DxfEntity {
  type: 'hatch';
  boundaryPaths: HatchEntity['boundaryPaths'];
  fillType?: HatchEntity['fillType'];
  fillColor?: HatchEntity['fillColor'];
  patternType?: HatchEntity['patternType'];
  patternName?: HatchEntity['patternName'];
  patternScale?: HatchEntity['patternScale'];
  patternAngle?: HatchEntity['patternAngle'];
  patternOrigin?: HatchEntity['patternOrigin'];
  lineAngle?: HatchEntity['lineAngle'];
  lineSpacing?: HatchEntity['lineSpacing'];
  doubleCrossHatch?: HatchEntity['doubleCrossHatch'];
  /** ADR-531 Φ5b.6 — 'screen' = raster μοτίβο σταθερής πυκνότητας px (zoom-independent). */
  patternSpace?: HatchEntity['patternSpace'];
  islandStyle?: HatchEntity['islandStyle'];
  /** ADR-507 Φ5 — gradient γέμισμα· ο HatchRenderer το διαβάζει για fillType='gradient'. */
  gradient?: HatchEntity['gradient'];
  /** ADR-643 Φ1 — image fill· ο HatchRenderer το διαβάζει για fillType='image'. */
  imageFill?: HatchEntity['imageFill'];
  /**
   * ADR-531 Φ5b.6 — Background color (AutoCAD DXF 63· ο Τέκτων `raster_bgcolor`, π.χ. λευκό).
   * Ο HatchRenderer γεμίζει ΠΙΣΩ από τις γραμμές μοτίβου. Χωρίς αυτόν τον κρίκο ο scene→Dxf
   * handler δεν μπορούσε να το προωθήσει (το ίδιο trap που είχε κρύψει το gradient/lineweight).
   */
  backgroundColor?: HatchEntity['backgroundColor'];
  drawOrder?: HatchEntity['drawOrder'];
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

/**
 * ADR-662 Φάση 2β (Δρόμος Γ) — DxfTopoSurface thin/derived direct entity (non-BIM,
 * sibling of DxfImage). Carries the flat topo-surface params (surfaceId + footprint)
 * at top level; `TopoSurfaceRenderer` draws the footprint outline. No
 * geometry/params/validation quartet — the TIN geometry lives in `getTopoSurface`,
 * this variant only carries the clickable footprint. Without this variant + its
 * TO_DXF handler the surface entity would fall to `convertEntity`'s `null` default →
 * invisible + un-selectable (the ADR-583/612/651 trap).
 */
export interface DxfTopoSurface extends DxfEntity {
  type: 'topo-surface';
  surfaceId: TopoSurfaceEntity['surfaceId'];
  footprint: TopoSurfaceEntity['footprint'];
}

/**
 * ADR-635 Φάση B — DxfLeader direct entity (non-BIM annotation callout). Carries the flat
 * leader fields (vertices path + arrowHead + optional annotation text/hook) at top level;
 * `LeaderRenderer` strokes the path + stamps the tip arrowhead. Without this variant + its
 * TO_DXF handler an imported DXF LEADER (`convertLeader` → scene) would fall to
 * `convertEntity`'s `null` default → invisible on the 2D canvas even though the renderer is
 * registered (the ADR-583/612/651 trap — the gap the render-coverage orphan surfaced).
 */
export interface DxfLeader extends DxfEntity {
  type: 'leader';
  vertices: LeaderEntity['vertices'];
  arrowHead?: LeaderEntity['arrowHead'];
  annotationText?: LeaderEntity['annotationText'];
  annotationPosition?: LeaderEntity['annotationPosition'];
  hookLineLength?: LeaderEntity['hookLineLength'];
  hasHookLine?: LeaderEntity['hasHookLine'];
}

export type DxfEntityUnion = DxfLine | DxfCircle | DxfPolyline | DxfArc | DxfText | DxfAngleMeasurement | DxfStair | DxfDimension | DxfSlab | DxfSlabOpening | DxfOpening | DxfWall | DxfColumn | DxfFoundation | DxfMepFixture | DxfElectricalPanel | DxfRailing | DxfFurniture | DxfMepSegment | DxfMepFitting | DxfFloorplanSymbol | DxfAnnotationSymbol | DxfScaleBar | DxfOpeningInfoTag | DxfMepManifold | DxfMepRadiator | DxfMepBoiler | DxfMepWaterHeater | DxfMepUnderfloor | DxfRoof | DxfFloorFinish | DxfWallCovering | DxfThermalSpace | DxfSpaceSeparator | DxfBeam | DxfHatch | DxfXLine | DxfRay | DxfImage | DxfTopoSurface | DxfLeader | DxfImportedMesh | DxfGenericSolid;

// === WRAPPED (SUB-ENTITY) VARIANTS — SSoT ===
/**
 * ADR-363 — SSoT map of the five `DxfEntityUnion` variants that carry their BIM
 * payload in a NESTED sub-entity field, versus the ~30 "direct" variants that spread
 * `kind`/`params`/`geometry` at the top level (wall/beam/column/foundation/roof/…).
 *
 * This is the ONE place that owns "which field a wrapped variant nests under". Both
 * writers of the wrapped shape read it from here — `convertEntity`
 * (committed scene→Dxf, `dxf-scene-entity-converter`) and `toWrappedPreviewEntity`
 * (grip/Move drag preview, `draw-real-entity-preview`) — and `buildEntityModelFromDxf`
 * dereferences the same field on the read side. Adding a new wrapped type = one line
 * here (+ its interface above), never a scattered edit across the pipeline.
 */
export const DXF_WRAPPED_SUBENTITY_FIELD = {
  'slab': 'slabEntity',
  'slab-opening': 'slabOpeningEntity',
  'opening': 'openingEntity',
  'stair': 'stairEntity',
  'dimension': 'dimensionEntity',
} as const satisfies Partial<Record<DxfEntityUnion['type'], string>>;

/** A `DxfEntityUnion['type']` whose payload is nested under a sub-entity field. */
export type DxfWrappedType = keyof typeof DXF_WRAPPED_SUBENTITY_FIELD;

/**
 * The `{ <subEntityField>: entity }` fragment for a wrapped variant, or `{}` for a
 * direct one. Spread onto a scene entity to project it into a valid `DxfEntityUnion`
 * (the payload IS the entity itself — mirrors both `convertEntity` and the preview
 * wrapper). SSoT via {@link DXF_WRAPPED_SUBENTITY_FIELD} — no per-call-site field names.
 */
export function dxfSubEntityPayload(entity: { readonly type: string }): Record<string, unknown> {
  const field = DXF_WRAPPED_SUBENTITY_FIELD[entity.type as DxfWrappedType];
  return field ? { [field]: entity } : {};
}

/**
 * READ counterpart of {@link dxfSubEntityPayload}: return the geometry/params-bearing
 * object for an entity — the nested sub-entity for a wrapped variant
 * (slab/slab-opening/opening/stair/dimension), or the entity itself for a direct one.
 * SSoT via {@link DXF_WRAPPED_SUBENTITY_FIELD}, so callers that consume BOTH the flat
 * scene shape and the wrapped DxfScene shape (bounds/zoom-extents, cut-plane extents)
 * read the payload without a per-type `entity.xEntity ?? entity` ladder.
 */
export function unwrapDxfSubEntity<T = unknown>(entity: { readonly type: string }): T {
  const field = DXF_WRAPPED_SUBENTITY_FIELD[entity.type as DxfWrappedType];
  const nested = field ? (entity as Record<string, unknown>)[field] : undefined;
  return (nested ?? entity) as T;
}

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
  /**
   * ADR-362 Round 5 — propagate the active scene unit system so the dimension
   * renderer can convert paper-mm DIMSTYLE values (dimtxt, dimasz, dimgap) into
   * world units before applying view scale. Missing => caller falls back to
   * `'mm'` (back-compat with legacy mm-baked DXFs).
   */
  units?: 'mm' | 'cm' | 'm' | 'in' | 'ft';
}

// === DXF RENDERING ===
export interface DxfRenderOptions {
  showGrid: boolean;
  showLayerNames: boolean;
  wireframeMode: boolean;
  selectedEntityIds: string[];
  hoveredEntityId?: string | null;
  /**
   * ADR-575 §selection/hover semantics — ids of the GROUP containers in the live
   * scene. Every expanded member carries its container's id, so the interactive
   * overlay collapses a whole group to ONE arbitrary member via `entityMap.get(id)`.
   * With this set the overlay recognises a hovered/selected id as a GROUP and paints
   * ALL its members (whole-group highlight, no per-member grips — the gizmo owns the
   * handles), instead of one stray member. Absent → legacy single-entity overlay.
   */
  groupIds?: ReadonlySet<string>;
  /**
   * ADR-417 Φ-per-edge — redraw trigger για το live highlight της ακμής στέγης
   * υπό επεξεργασία («Κλίση ανά νερό»). Folded από το `roofEdgeSelectionStore`
   * (μέσω `useSelectedRoofEdge`) ώστε η αλλαγή επιλογής να ξανατρέχει το δυναμικό
   * «selected» pass — ίδιο μοτίβο με `hoveredEntityId`. Ο `RoofRenderer` διαβάζει
   * την τιμή με store-getter at render-time· εδώ ζει μόνο ως cache-busting σήμα.
   */
  selectedRoofEdge?: import('../../bim/roofs/roof-edge-selection-store').SelectedRoofEdge | null;
  /** Grip interaction state for visual feedback (hovered/active grip coloring) */
  gripInteractionState?: {
    hoveredGrip?: { entityId: string; gripIndex: number };
    activeGrip?: { entityId: string; gripIndex: number };
    /** ADR-501 — grip keys clicked-to-select for a multi-grip move (orange). */
    armedKeys?: ReadonlySet<string>;
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
  /**
   * When true, selected entities are rendered without grip handles (selection highlight
   * is preserved). Used when activeTool is not 'select' / 'layering' — e.g. Move tool,
   * matching AutoCAD behaviour where grips disappear once a command is active.
   */
  suppressGrips?: boolean;
  /**
   * When true (move tool awaiting-destination phase), selected entities render as ghost
   * at their original position — AutoCAD parity: originals fade out during preview move.
   * The solid preview at the cursor is drawn on PreviewCanvas by useMovePreview.
   */
  movePreviewActive?: boolean;
  /**
   * When true (a transform tool — Move/Copy/Rotate/Mirror — is armed with a selection but
   * BEFORE the base point is picked), selected entities paint ORANGE so the user sees WHAT is
   * selected while the grips are hidden. Mutually exclusive with `movePreviewActive` (which
   * begins once the ghost phase starts). Giorgio 2026-07-21. See RenderOptions twin field.
   */
  armedTransformHighlight?: boolean;
  /**
   * Id of the entity currently being GRIP-DRAGGED (null when idle). ADR-049 inverted
   * ghost: this one entity renders as a ghost at its original position, while its SOLID
   * real-colour moving copy is drawn on PreviewCanvas by useGripGhostPreview. Distinct
   * from `movePreviewActive` (which dims ALL selected) because a grip drag moves only the
   * single grabbed entity — not the rest of the selection.
   */
  gripDraggedEntityId?: string | null;
  /**
   * ADR-561 EXT — the active grip drag is a rotate-COPY (Ctrl / «Copy» toggle): the source
   * entity stays PUT as a permanent original, so it must NOT be dimmed as the inverted
   * ghost. When true the `gripDraggedEntityId` entity renders SOLID at its origin, while the
   * rotating clone is the translucent ghost on PreviewCanvas.
   */
  gripDragIsCopy?: boolean;
}

// === DXF SELECTION ===
export interface DxfSelectionResult {
  entityId: string;
  distance: number;
  point: Point2D;
}
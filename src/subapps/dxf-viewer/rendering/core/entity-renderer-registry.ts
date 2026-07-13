/**
 * Entity Renderer Registry — factory (file-size SRP split of EntityRendererComposite, N.7.1)
 * ============================================================================
 *
 * Builds the `entityType → BaseEntityRenderer` map the composite delegates to.
 * Extracted verbatim from `EntityRendererComposite.initializeRenderers` so the
 * composite keeps only orchestration (transform/grip forwarding, hit-test,
 * per-frame index injection). Registering a new renderer = one instantiation +
 * one `set()` here (SSoT for the leaf registry).
 */

import type { BaseEntityRenderer } from '../entities/BaseEntityRenderer';
import { LineRenderer } from '../entities/LineRenderer';
import { CircleRenderer } from '../entities/CircleRenderer';
import { PolylineRenderer } from '../entities/PolylineRenderer';
import { ArcRenderer } from '../entities/ArcRenderer';
import { TextRenderer } from '../entities/TextRenderer';
import { RectangleRenderer } from '../entities/RectangleRenderer';
import { EllipseRenderer } from '../entities/EllipseRenderer';
import { SplineRenderer } from '../entities/SplineRenderer';
import { AngleMeasurementRenderer } from '../entities/AngleMeasurementRenderer';
import { PointRenderer } from '../entities/PointRenderer';
import { StairRenderer } from '../../bim/renderers/StairRenderer';
// ADR-359 Phase 4.b — XLINE (infinite) + RAY (semi-infinite) construction line renderers.
import { XLineRenderer } from '../entities/XLineRenderer';
import { RayRenderer } from '../entities/RayRenderer';
// ADR-507 Φ1a — hatch leaf (solid fill + user-defined lines, AutoCAD HATCH).
import { HatchRenderer } from '../entities/HatchRenderer';
// ADR-583 — annotation symbol leaf (North arrow; lightweight non-BIM paper decoration).
import { AnnotationSymbolRenderer } from '../entities/AnnotationSymbolRenderer';
// ADR-583 Φ2 — graphic scale-bar leaf (dedicated non-BIM annotation; two-formula split).
import { ScaleBarRenderer } from '../entities/ScaleBarRenderer';
// ADR-612 — opening info tag leaf (dedicated non-BIM annotation; world-mm box, sibling of scale-bar).
import { OpeningInfoTagRenderer } from '../entities/OpeningInfoTagRenderer';
import { LeaderRenderer } from '../entities/LeaderRenderer';
// ADR-651 Φάση Ε — standalone raster image leaf (non-BIM, rectangle + rotation + contain-fit).
import { ImageRenderer } from '../entities/ImageRenderer';
// ADR-363 Phase 1B — parametric wall leaf (2D plan view).
import { WallRenderer } from '../../bim/renderers/WallRenderer';
// ADR-363 Phase 2 — opening leaf (door/window/sliding-door/french-door/fixed).
import { OpeningRenderer } from '../../bim/renderers/OpeningRenderer';
// ADR-363 Phase 3 — slab leaf (floor/ceiling/roof/ground/foundation).
import { SlabRenderer } from '../../bim/renderers/SlabRenderer';
// ADR-363 Phase 3.7 — slab-opening leaf (shaft/well/duct/chimney).
import { SlabOpeningRenderer } from '../../bim/renderers/SlabOpeningRenderer';
// ADR-363 Phase 4 — column leaf (rectangular/circular/L-shape/T-shape).
import { ColumnRenderer } from '../../bim/renderers/ColumnRenderer';
import { FoundationRenderer } from '../../bim/renderers/FoundationRenderer';
// ADR-363 Phase 5 — beam leaf (straight/curved/cantilever).
import { BeamRenderer } from '../../bim/renderers/BeamRenderer';
// ADR-406 — MEP fixture leaf (point-based light fixture).
import { MepFixtureRenderer } from '../../bim/renderers/MepFixtureRenderer';
// ADR-408 Φ3 — electrical panel leaf (point-based circuit source).
import { ElectricalPanelRenderer } from '../../bim/renderers/ElectricalPanelRenderer';
// ADR-407 — railing leaf (path-based guardrail, posts + balusters + top rail).
import { RailingRenderer } from '../../bim/renderers/RailingRenderer';
// ADR-417 — roof leaf (parametric pitched roof; faces + ridge lines).
import { RoofRenderer } from '../../bim/renderers/RoofRenderer';
// ADR-419 — floor finish leaf (thin polygon covering per room; hatch + fill).
import { FloorFinishRenderer } from '../../bim/renderers/FloorFinishRenderer';
import { WallCoveringRenderer } from '../../bim/renderers/WallCoveringRenderer';
import { ThermalSpaceRenderer } from '../../bim/renderers/ThermalSpaceRenderer';
import { SpaceSeparatorRenderer } from '../../bim/renderers/SpaceSeparatorRenderer';
// ADR-410 — furniture leaf (mesh-based CC0 item; 2D footprint + glyph).
import { FurnitureRenderer } from '../../bim/renderers/FurnitureRenderer';
// ADR-415 — 2D floorplan symbol leaf (WC/κουζίνα/έπιπλα κάτοψης; pure-vector footprint + kind glyph).
import { FloorplanSymbolRenderer } from '../../bim/renderers/FloorplanSymbolRenderer';
// ADR-408 Φ8 — MEP segment leaf (linear duct/pipe run, dashed outline + centerline).
import { MepSegmentRenderer } from '../../bim/renderers/MepSegmentRenderer';
// ADR-408 Φ11 — MEP fitting leaf (auto pipe junction element; footprint + per-kind glyph).
import { MepFittingRenderer } from '../../bim/renderers/MepFittingRenderer';
// ADR-408 Φ12 — plumbing manifold leaf (point-based floor-mounted distributor).
import { MepManifoldRenderer } from '../../bim/renderers/MepManifoldRenderer';
import { MepRadiatorRenderer } from '../../bim/renderers/MepRadiatorRenderer';
// ADR-408 Εύρος Β #2 — heating boiler leaf (point-based wall-mounted hydronic source).
import { MepBoilerRenderer } from '../../bim/renderers/MepBoilerRenderer';
// ADR-408 DHW — domestic hot water heater leaf (point-based wall-mounted DHW source).
import { MepWaterHeaterRenderer } from '../../bim/renderers/MepWaterHeaterRenderer';
// ADR-408 Εύρος Β #3 — underfloor heating leaf (area-based radiant floor loop).
import { MepUnderfloorRenderer } from '../../bim/renderers/MepUnderfloorRenderer';
// ADR-362 Phase C1 — persistent dimension leaf (consumes DimGeometry discriminated union).
import { DimensionRenderer } from '../entities/DimensionRenderer';

/**
 * Instantiate + register every entity renderer against a shared 2D context.
 * Returns the `entityType → renderer` map consumed by the composite.
 */
export function createEntityRenderers(
  ctx: CanvasRenderingContext2D,
): Map<string, BaseEntityRenderer> {
  const renderers = new Map<string, BaseEntityRenderer>();

  // Create instances of all entity renderers
  const lineRenderer = new LineRenderer(ctx);
  const circleRenderer = new CircleRenderer(ctx);
  const polylineRenderer = new PolylineRenderer(ctx);
  const arcRenderer = new ArcRenderer(ctx);
  const textRenderer = new TextRenderer(ctx);
  const rectangleRenderer = new RectangleRenderer(ctx);
  const ellipseRenderer = new EllipseRenderer(ctx);
  const splineRenderer = new SplineRenderer(ctx);
  const angleMeasurementRenderer = new AngleMeasurementRenderer(ctx);
  const pointRenderer = new PointRenderer(ctx);
  // ADR-358 Phase 5b — parametric stair renderer (2D plan view).
  const stairRenderer = new StairRenderer(ctx);
  // ADR-363 Phase 1B — parametric wall renderer (2D plan view).
  const wallRenderer = new WallRenderer(ctx);
  // ADR-363 Phase 2 — opening renderer (5 kinds, hinge/glazing/slide overlays).
  const openingRenderer = new OpeningRenderer(ctx);
  // ADR-363 Phase 3 — slab renderer (5 kinds, polygon outline + translucent fill).
  const slabRenderer = new SlabRenderer(ctx);
  // ADR-363 Phase 3.7 — slab-opening renderer (4 kinds, dashed outline + cutout).
  const slabOpeningRenderer = new SlabOpeningRenderer(ctx);
  // ADR-363 Phase 4 — column renderer (4 kinds, footprint outline + fill).
  const columnRenderer = new ColumnRenderer(ctx);
  // ADR-363 Phase 5 — beam renderer (3 kinds, dashed outline + axis centerline).
  const beamRenderer = new BeamRenderer(ctx);
  // ADR-436 — foundation renderer (pad/strip/tie-beam, hidden-line + concrete hatch).
  const foundationRenderer = new FoundationRenderer(ctx);
  // ADR-406 — MEP fixture renderer (point-based light fixture, family symbol).
  const mepFixtureRenderer = new MepFixtureRenderer(ctx);
  const electricalPanelRenderer = new ElectricalPanelRenderer(ctx);
  // ADR-407 — railing renderer (path-based guardrail, posts + balusters + rail).
  const railingRenderer = new RailingRenderer(ctx);
  // ADR-417 — roof renderer (parametric pitched roof; faces + ridge lines).
  const roofRenderer = new RoofRenderer(ctx);
  // ADR-419 — floor finish renderer (thin polygon covering per room; hatch + fill).
  const floorFinishRenderer = new FloorFinishRenderer(ctx);
  // ADR-511 — wall covering renderer (per-room/per-face finish strip on the wall face).
  const wallCoveringRenderer = new WallCoveringRenderer(ctx);
  // ADR-422 — thermal space renderer (analytical IfcSpace; fill + dashed outline + tag).
  const thermalSpaceRenderer = new ThermalSpaceRenderer(ctx);
  // ADR-437 — space separator renderer (IfcVirtualElement; thin dashed violet line).
  const spaceSeparatorRenderer = new SpaceSeparatorRenderer(ctx);
  // ADR-410 — furniture renderer (mesh-based CC0 item; 2D footprint + glyph).
  const furnitureRenderer = new FurnitureRenderer(ctx);
  // ADR-415 — floorplan symbol renderer (pure-vector 2D κάτοψη; footprint + kind strokes).
  const floorplanSymbolRenderer = new FloorplanSymbolRenderer(ctx);
  // ADR-408 Φ8 — MEP segment renderer (linear duct/pipe run, dashed outline + centerline).
  const mepSegmentRenderer = new MepSegmentRenderer(ctx);
  // ADR-408 Φ11 — MEP fitting renderer (auto pipe junction element; footprint + glyph).
  const mepFittingRenderer = new MepFittingRenderer(ctx);
  // ADR-408 Φ12 — plumbing manifold renderer (point-based floor-mounted distributor).
  const mepManifoldRenderer = new MepManifoldRenderer(ctx);
  // ADR-408 Εύρος Β — heating radiator renderer (point-based wall-mounted terminal).
  const mepRadiatorRenderer = new MepRadiatorRenderer(ctx);
  // ADR-408 Εύρος Β #2 — heating boiler renderer (point-based wall-mounted hydronic source).
  const mepBoilerRenderer = new MepBoilerRenderer(ctx);
  // ADR-408 DHW — domestic hot water heater renderer (point-based wall-mounted DHW source).
  const mepWaterHeaterRenderer = new MepWaterHeaterRenderer(ctx);
  // ADR-408 Εύρος Β #3 — underfloor heating renderer (area-based radiant floor loop).
  const mepUnderfloorRenderer = new MepUnderfloorRenderer(ctx);
  // ADR-362 Phase C1 — dimension renderer (10 variants via DimGeometry union).
  const dimensionRenderer = new DimensionRenderer(ctx);
  // ADR-359 Phase 4.b — Liang-Barsky clipped construction line renderers.
  const xlineRenderer = new XLineRenderer(ctx); const rayRenderer = new RayRenderer(ctx);
  const hatchRenderer = new HatchRenderer(ctx);
  // ADR-583 — annotation symbol renderer (North arrow; annotative unit-space glyph).
  const annotationSymbolRenderer = new AnnotationSymbolRenderer(ctx);
  // ADR-583 Φ2 — graphic scale-bar renderer (real-span axis + annotative thickness/labels).
  const scaleBarRenderer = new ScaleBarRenderer(ctx);
  // ADR-612 — opening info tag renderer (world-mm box, 3 editable numeral cells).
  const openingInfoTagRenderer = new OpeningInfoTagRenderer(ctx);
  const leaderRenderer = new LeaderRenderer(ctx); // ADR-635 — leader callout path + tip arrowhead
  // ADR-651 Φάση Ε — raster image renderer (contain-fit εικόνας μέσα σε rotated ορθογώνιο).
  const imageRenderer = new ImageRenderer(ctx);

  // Register renderers by entity type
  renderers.set('line', lineRenderer);
  renderers.set('circle', circleRenderer);
  renderers.set('polyline', polylineRenderer);
  renderers.set('lwpolyline', polylineRenderer); // Light-weight polyline uses same renderer
  renderers.set('arc', arcRenderer);
  renderers.set('text', textRenderer);
  renderers.set('mtext', textRenderer); // Multi-line text uses same renderer
  renderers.set('rectangle', rectangleRenderer);
  renderers.set('rect', rectangleRenderer); // Alias
  renderers.set('ellipse', ellipseRenderer);
  renderers.set('spline', splineRenderer);
  renderers.set('point', pointRenderer as BaseEntityRenderer); // ✅ ENTERPRISE FIX: Type compatibility resolved
  renderers.set('angle-measurement', angleMeasurementRenderer);
  renderers.set('stair', stairRenderer);
  renderers.set('wall', wallRenderer);
  renderers.set('opening', openingRenderer);
  renderers.set('slab', slabRenderer);
  renderers.set('slab-opening', slabOpeningRenderer);
  renderers.set('column', columnRenderer);
  renderers.set('beam', beamRenderer);
  renderers.set('foundation', foundationRenderer);
  renderers.set('mep-fixture', mepFixtureRenderer);
  renderers.set('electrical-panel', electricalPanelRenderer);
  renderers.set('railing', railingRenderer);
  renderers.set('roof', roofRenderer);
  renderers.set('floor-finish', floorFinishRenderer);
  renderers.set('wall-covering', wallCoveringRenderer);
  renderers.set('thermal-space', thermalSpaceRenderer);
  renderers.set('space-separator', spaceSeparatorRenderer);
  renderers.set('furniture', furnitureRenderer);
  renderers.set('floorplan-symbol', floorplanSymbolRenderer);
  renderers.set('mep-segment', mepSegmentRenderer);
  renderers.set('mep-fitting', mepFittingRenderer);
  renderers.set('mep-manifold', mepManifoldRenderer);
  renderers.set('mep-radiator', mepRadiatorRenderer);
  renderers.set('mep-boiler', mepBoilerRenderer);
  renderers.set('mep-water-heater', mepWaterHeaterRenderer);
  renderers.set('mep-underfloor', mepUnderfloorRenderer);
  renderers.set('dimension', dimensionRenderer);
  renderers.set('xline', xlineRenderer);
  renderers.set('ray', rayRenderer);
  renderers.set('hatch', hatchRenderer);
  renderers.set('annotation-symbol', annotationSymbolRenderer);
  renderers.set('scale-bar', scaleBarRenderer);
  renderers.set('opening-info-tag', openingInfoTagRenderer);
  renderers.set('leader', leaderRenderer);
  renderers.set('image', imageRenderer);

  return renderers;
}

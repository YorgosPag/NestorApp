/**
 * Entity Renderer Composite
 * Manages all entity-specific renderers and delegates rendering to appropriate renderer
 */

import { createModuleLogger } from '@/lib/telemetry';
import { BaseEntityRenderer } from '../entities/BaseEntityRenderer';
import type { Entity, GripInfo, RenderOptions, ViewTransform, Point2D, GripSettings, GripInteractionState, Viewport } from '../types/Types';
import { CoordinateTransforms } from './CoordinateTransforms';
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
// ADR-363 Phase 1B — parametric wall leaf (2D plan view).
import { WallRenderer, type OpeningsByWall } from '../../bim/renderers/WallRenderer';
// ADR-363 Phase 2 — opening leaf (door/window/sliding-door/french-door/fixed).
import { OpeningRenderer } from '../../bim/renderers/OpeningRenderer';
// ADR-363 Phase 3 — slab leaf (floor/ceiling/roof/ground/foundation).
import { SlabRenderer, type SlabOpeningsBySlab } from '../../bim/renderers/SlabRenderer';
// ADR-363 Phase 3.7 — slab-opening leaf (shaft/well/duct/chimney).
import { SlabOpeningRenderer } from '../../bim/renderers/SlabOpeningRenderer';
// ADR-363 Phase 4 — column leaf (rectangular/circular/L-shape/T-shape).
import { ColumnRenderer } from '../../bim/renderers/ColumnRenderer';
// ADR-363 Phase 5 — beam leaf (straight/curved/cantilever).
import { BeamRenderer } from '../../bim/renderers/BeamRenderer';
// ADR-406 — MEP fixture leaf (point-based light fixture).
import { MepFixtureRenderer } from '../../bim/renderers/MepFixtureRenderer';
// ADR-408 Φ3 — electrical panel leaf (point-based circuit source).
import { ElectricalPanelRenderer } from '../../bim/renderers/ElectricalPanelRenderer';
// ADR-407 — railing leaf (path-based guardrail, posts + balusters + top rail).
import { RailingRenderer } from '../../bim/renderers/RailingRenderer';
// ADR-410 — furniture leaf (mesh-based CC0 item; 2D footprint + glyph).
import { FurnitureRenderer } from '../../bim/renderers/FurnitureRenderer';
// ADR-408 Φ8 — MEP segment leaf (linear duct/pipe run, dashed outline + centerline).
import { MepSegmentRenderer } from '../../bim/renderers/MepSegmentRenderer';
// ADR-362 Phase C1 — persistent dimension leaf (consumes DimGeometry discriminated union).
import { DimensionRenderer } from '../entities/DimensionRenderer';
import type { DimensionLookup } from '../../systems/dimensions/dim-geometry-builder';
import { UI_COLORS } from '../../config/color-config';
// 🏢 ADR-044: Centralized Line Widths
import { RENDER_LINE_WIDTHS } from '../../config/text-rendering-config';
// 🏢 ADR-151: Centralized grip tolerance
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';
import { hitTestingService } from '../../services/HitTestingService';
// 🏢 ADR-344 Phase 11: Annotative scaling resolver — upstream of TextRenderer
import { resolveAnnotativeEntity } from '../entities/annotative-resolver';

const logger = createModuleLogger('EntityRendererComposite');

export class EntityRendererComposite {
  private renderers: Map<string, BaseEntityRenderer>;
  private ctx: CanvasRenderingContext2D;
  private transform: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };
  private gripSettings?: GripSettings;
  private gripInteraction: GripInteractionState = {};

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    this.renderers = new Map();
    this.initializeRenderers();
  }

  private initializeRenderers(): void {
    // Create instances of all entity renderers
    const lineRenderer = new LineRenderer(this.ctx);
    const circleRenderer = new CircleRenderer(this.ctx);
    const polylineRenderer = new PolylineRenderer(this.ctx);
    const arcRenderer = new ArcRenderer(this.ctx);
    const textRenderer = new TextRenderer(this.ctx);
    const rectangleRenderer = new RectangleRenderer(this.ctx);
    const ellipseRenderer = new EllipseRenderer(this.ctx);
    const splineRenderer = new SplineRenderer(this.ctx);
    const angleMeasurementRenderer = new AngleMeasurementRenderer(this.ctx);
    const pointRenderer = new PointRenderer(this.ctx);
    // ADR-358 Phase 5b — parametric stair renderer (2D plan view).
    const stairRenderer = new StairRenderer(this.ctx);
    // ADR-363 Phase 1B — parametric wall renderer (2D plan view).
    const wallRenderer = new WallRenderer(this.ctx);
    // ADR-363 Phase 2 — opening renderer (5 kinds, hinge/glazing/slide overlays).
    const openingRenderer = new OpeningRenderer(this.ctx);
    // ADR-363 Phase 3 — slab renderer (5 kinds, polygon outline + translucent fill).
    const slabRenderer = new SlabRenderer(this.ctx);
    // ADR-363 Phase 3.7 — slab-opening renderer (4 kinds, dashed outline + cutout).
    const slabOpeningRenderer = new SlabOpeningRenderer(this.ctx);
    // ADR-363 Phase 4 — column renderer (4 kinds, footprint outline + fill).
    const columnRenderer = new ColumnRenderer(this.ctx);
    // ADR-363 Phase 5 — beam renderer (3 kinds, dashed outline + axis centerline).
    const beamRenderer = new BeamRenderer(this.ctx);
    // ADR-406 — MEP fixture renderer (point-based light fixture, family symbol).
    const mepFixtureRenderer = new MepFixtureRenderer(this.ctx);
    const electricalPanelRenderer = new ElectricalPanelRenderer(this.ctx);
    // ADR-407 — railing renderer (path-based guardrail, posts + balusters + rail).
    const railingRenderer = new RailingRenderer(this.ctx);
    // ADR-410 — furniture renderer (mesh-based CC0 item; 2D footprint + glyph).
    const furnitureRenderer = new FurnitureRenderer(this.ctx);
    // ADR-408 Φ8 — MEP segment renderer (linear duct/pipe run, dashed outline + centerline).
    const mepSegmentRenderer = new MepSegmentRenderer(this.ctx);
    // ADR-362 Phase C1 — dimension renderer (10 variants via DimGeometry union).
    const dimensionRenderer = new DimensionRenderer(this.ctx);
    // ADR-359 Phase 4.b — Liang-Barsky clipped construction line renderers.
    const xlineRenderer = new XLineRenderer(this.ctx);
    const rayRenderer = new RayRenderer(this.ctx);

    // Register renderers by entity type
    this.renderers.set('line', lineRenderer);
    this.renderers.set('circle', circleRenderer);
    this.renderers.set('polyline', polylineRenderer);
    this.renderers.set('lwpolyline', polylineRenderer); // Light-weight polyline uses same renderer
    this.renderers.set('arc', arcRenderer);
    this.renderers.set('text', textRenderer);
    this.renderers.set('mtext', textRenderer); // Multi-line text uses same renderer
    this.renderers.set('rectangle', rectangleRenderer);
    this.renderers.set('rect', rectangleRenderer); // Alias
    this.renderers.set('ellipse', ellipseRenderer);
    this.renderers.set('spline', splineRenderer);
    this.renderers.set('point', pointRenderer as BaseEntityRenderer); // ✅ ENTERPRISE FIX: Type compatibility resolved
    this.renderers.set('angle-measurement', angleMeasurementRenderer);
    this.renderers.set('stair', stairRenderer);
    this.renderers.set('wall', wallRenderer);
    this.renderers.set('opening', openingRenderer);
    this.renderers.set('slab', slabRenderer);
    this.renderers.set('slab-opening', slabOpeningRenderer);
    this.renderers.set('column', columnRenderer);
    this.renderers.set('beam', beamRenderer);
    this.renderers.set('mep-fixture', mepFixtureRenderer);
    this.renderers.set('electrical-panel', electricalPanelRenderer);
    this.renderers.set('railing', railingRenderer);
    this.renderers.set('furniture', furnitureRenderer);
    this.renderers.set('mep-segment', mepSegmentRenderer);
    this.renderers.set('dimension', dimensionRenderer);
    this.renderers.set('xline', xlineRenderer);
    this.renderers.set('ray', rayRenderer);
  }

  /**
   * ADR-362 Phase C1 — forward the per-frame DimensionLookup map to the
   * dimension renderer. No-op if the dim renderer isn't registered (defensive
   * for partial test setups).
   */
  setDimensionLookup(lookup: DimensionLookup): void {
    const dim = this.renderers.get('dimension');
    if (dim instanceof DimensionRenderer) {
      dim.setDimensionLookup(lookup);
    }
  }

  /**
   * ADR-362 Phase C1 — forward the owning-layer hex colour so the dimension
   * renderer can resolve DIMCLRD/DIMCLRE/DIMCLRT sentinels (ByLayer / ByBlock).
   */
  setDimensionLayerColour(colour: string | undefined): void {
    const dim = this.renderers.get('dimension');
    if (dim instanceof DimensionRenderer) {
      dim.setLayerColour(colour);
    }
  }

  /**
   * ADR-362 Round 5 — forward the active scene unit system to the dimension
   * renderer so paper-mm DIMSTYLE values land in world units regardless of
   * whether the DXF was authored in mm / cm / m / in / ft. No-op when the dim
   * renderer is absent (defensive for partial test setups).
   */
  setDimensionSceneUnits(units: 'mm' | 'cm' | 'm' | 'in' | 'ft'): void {
    const dim = this.renderers.get('dimension');
    if (dim instanceof DimensionRenderer) {
      dim.setSceneUnits(units);
    }
  }

  /**
   * ADR-363 Phase 2.5 — forward the per-frame opening-by-wall index so the
   * wall renderer can punch boolean cutouts into its fill. No-op when the
   * wall renderer is absent (defensive for partial test setups).
   */
  setOpeningsByWall(map: OpeningsByWall): void {
    const wall = this.renderers.get('wall');
    if (wall instanceof WallRenderer) {
      wall.setOpeningsByWall(map);
    }
  }

  /**
   * ADR-363 Phase 3.7 — forward the per-frame slab-opening-by-slab index ώστε
   * ο slab renderer να τρυπάει boolean cutouts στο fill. No-op όταν ο slab
   * renderer απουσιάζει (defensive για partial test setups).
   */
  setSlabOpeningsBySlab(map: SlabOpeningsBySlab): void {
    const slab = this.renderers.get('slab');
    if (slab instanceof SlabRenderer) {
      slab.setSlabOpeningsBySlab(map);
    }
  }

  // Settings management
  setTransform(transform: ViewTransform): void {
    this.transform = { ...transform };
    // Update all renderers
    this.renderers.forEach(renderer => renderer.setTransform(transform));
  }

  setGripSettings(settings: GripSettings): void {
    this.gripSettings = settings;
    // Update all renderers
    this.renderers.forEach(renderer => renderer.setGripSettings(settings));
  }

  setGripInteractionState(state: GripInteractionState): void {
    this.gripInteraction = state || {};
    // Update all renderers
    this.renderers.forEach(renderer => renderer.setGripInteractionState(state));
  }

  // Main render method
  render(entity: Entity, options: RenderOptions = {}): void {
    const renderer = this.getRenderer(entity.type);
    if (renderer) {
      // 🏢 ADR-344 Phase 11: resolve annotative height before render (no-op
      // for non-annotative entities). Keeps TextRenderer simple-path intact.
      const resolved = resolveAnnotativeEntity(entity);
      renderer.render(resolved, options);
    } else {
      logger.warn(`No renderer found for entity type: ${entity.type}`);
      this.renderFallback(entity, options);
    }
  }

  // Render multiple entities
  renderEntities(entities: Entity[], options: RenderOptions = {}): void {
    entities.forEach(entity => {
      // ✅ ENTERPRISE FIX: Type-safe visibility check
      const isVisible = ('visible' in entity ? entity.visible : true) !== false;
      if (isVisible) {
        this.render(entity, options);
      }
    });
  }

  // Get grips for an entity
  getEntityGrips(entity: Entity): GripInfo[] {
    const renderer = this.getRenderer(entity.type);
    if (renderer) {
      return renderer.getGrips(entity);
    }
    return [];
  }

  // Find grip at point
  findGripAtPoint(entity: Entity, screenPoint: Point2D, tolerance: number = TOLERANCE_CONFIG.GRIP_APERTURE): GripInfo | null {
    const renderer = this.getRenderer(entity.type);
    if (renderer) {
      return renderer.findGripAtPoint(entity, screenPoint, tolerance);
    }
    return null;
  }

  /**
   * ADR-362 Round 4.1 (2026-05-19) — CSS-pixel viewport για το hitTestingService.
   * `point` έρχεται από mouse events σε CSS pixels (getBoundingClientRect-based),
   * άρα η `screenToWorld` εντός του service ΠΡΕΠΕΙ να λάβει CSS viewport. Backing
   * store (ctx.canvas.width/height) διαφέρει με DPR ≠ 1 → silent mis-hit στα grips
   * όταν browser zoom ≠ 100%. SSoT canonical: BaseEntityRenderer.getViewport.
   */
  private getCssViewport(): Viewport {
    const rect = this.ctx.canvas.getBoundingClientRect();
    return {
      x: 0,
      y: 0,
      width: rect.width || this.ctx.canvas.width,
      height: rect.height || this.ctx.canvas.height,
    };
  }

  // Hit test for entity - using centralized service
  hitTestEntity(entity: Entity, point: Point2D, tolerance: number): boolean {
    try {
      const viewport = this.getCssViewport();

      const result = hitTestingService.hitTest(point, this.transform, viewport, {
        tolerance,
        maxResults: 1
      });

      return result.entityId === entity.id;
    } catch (error) {
      logger.error('hitTestEntity failed', { error });
      return false;
    }
  }

  // Hit test for multiple entities - using centralized service
  hitTest(entities: Entity[], point: Point2D, tolerance: number): Entity | null {
    try {
      const viewport = this.getCssViewport();

      const result = hitTestingService.hitTest(point, this.transform, viewport, {
        tolerance,
        maxResults: 1
      });

      // Find the entity that matches the result
      if (result.entityId) {
        return entities.find(entity => entity.id === result.entityId) || null;
      }

      return null;
    } catch (error) {
      logger.error('hitTest failed', { error });
      return null;
    }
  }

  // Get renderer for entity type
  private getRenderer(entityType: string): BaseEntityRenderer | undefined {
    return this.renderers.get(entityType.toLowerCase());
  }

  // Fallback renderer for unknown entity types
  private renderFallback(entity: Entity, options: RenderOptions): void {
    // Safely handle unknown entity types without causing infinite loops
    try {
      // ✅ ENTERPRISE FIX: Type-safe property access with proper checks
      let position: Point2D | undefined;
      if ('position' in entity && entity.position) {
        position = entity.position as Point2D;
      } else if ('center' in entity && entity.center) {
        position = entity.center as Point2D;
      } else if ('start' in entity && entity.start) {
        position = entity.start as Point2D;
      }

      if (!position) return;

      const screenPos = this.worldToScreen(position);
      
      this.ctx.save();
      this.ctx.strokeStyle = UI_COLORS.SELECTION_HIGHLIGHT;
      this.ctx.lineWidth = RENDER_LINE_WIDTHS.THIN; // 🏢 ADR-044
      
      // ⚡ NUCLEAR: GENERIC POINT CIRCLE ELIMINATED
      
      this.ctx.restore();
    } catch (error) {
      // Silently handle any rendering errors to prevent crashes
      logger.warn(`Fallback rendering failed for entity ${entity.id}`, { error });
    }
  }

  private worldToScreen(point: Point2D): Point2D {
    const rect = this.ctx.canvas.getBoundingClientRect();
    const viewport: Viewport = { width: rect.width, height: rect.height };
    return CoordinateTransforms.worldToScreen(point, this.transform, viewport);
  }

  // Clear canvas
  clear(): void {
    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
  }

  // Get all registered entity types
  getSupportedEntityTypes(): string[] {
    return Array.from(this.renderers.keys());
  }
}
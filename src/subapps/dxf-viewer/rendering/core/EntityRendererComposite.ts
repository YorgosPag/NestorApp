/**
 * Entity Renderer Composite
 * Manages all entity-specific renderers and delegates rendering to appropriate renderer
 */

import { createModuleLogger } from '@/lib/telemetry';
import { BaseEntityRenderer } from '../entities/BaseEntityRenderer';
import type { Entity, GripInfo, RenderOptions, ViewTransform, Point2D, GripSettings, GripInteractionState, Viewport } from '../types/Types';
import { CoordinateTransforms } from './CoordinateTransforms';
// ADR-550 / N.7.1 — the full renderer instantiation + registration is the
// registry factory's job (file-size SRP split). The composite keeps only the
// renderer classes it `instanceof`-checks for per-frame index injection.
import { createEntityRenderers } from './entity-renderer-registry';
import { WallRenderer, type OpeningsByWall } from '../../bim/renderers/WallRenderer';
import { SlabRenderer, type SlabOpeningsBySlab } from '../../bim/renderers/SlabRenderer';
import { WallCoveringRenderer } from '../../bim/renderers/WallCoveringRenderer';
import type { WallCoveringHost } from '../../bim/wall-coverings/wall-covering-strip-geometry';
// ADR-583 — annotation symbol / scale-bar leaves need scene-units forwarding (instanceof).
import { AnnotationSymbolRenderer } from '../entities/AnnotationSymbolRenderer';
import { ScaleBarRenderer } from '../entities/ScaleBarRenderer';
// ADR-362 Phase C1 — persistent dimension leaf (lookup/colour/units forwarding).
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
    // ADR-550 / N.7.1 — leaf instantiation + registration lives in the registry factory.
    this.renderers = createEntityRenderers(ctx);
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
    // ADR-583 — the annotation symbol renderer folds paper-mm → model units too
    // (annotative North arrow), so it needs the SAME scene units the dimensions use.
    const anno = this.renderers.get('annotation-symbol');
    if (anno instanceof AnnotationSymbolRenderer) {
      anno.setSceneUnits(units);
    }
    // ADR-583 Φ2 — the scale-bar renderer folds paper-mm → model units for its
    // annotative thickness/labels (two-formula split), so it needs the same units.
    const scaleBar = this.renderers.get('scale-bar');
    if (scaleBar instanceof ScaleBarRenderer) {
      scaleBar.setSceneUnits(units);
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
   * ADR-509 §axis-clip — forward the per-frame column footprints so the wall
   * renderer clips its dashed axis at column faces (location line stops at the
   * column body, Revit/AutoCAD-style). No-op when the wall renderer is absent.
   */
  setColumnFootprints(footprints: readonly (readonly Point2D[])[]): void {
    const wall = this.renderers.get('wall');
    if (wall instanceof WallRenderer) {
      wall.setColumnFootprints(footprints);
    }
  }

  /**
   * ADR-511 — forward the per-frame wall index so the wall-covering renderer can
   * resolve its host wall (O(1)) and compute the live face strip. No-op when the
   * covering renderer is absent (defensive for partial test setups).
   */
  setWallsById(map: ReadonlyMap<string, WallCoveringHost>): void {
    const wc = this.renderers.get('wall-covering');
    if (wc instanceof WallCoveringRenderer) {
      wc.setWallsById(map);
    }
  }

  // ADR-449 Slice X2 μέρος Β — τα `setColumnFinishFaces`/`setBeamFinishFaces` αφαιρέθηκαν:
  // ο σοβάς (2Δ) σχεδιάζεται πλέον ως ΕΝΑ scene-level pass στον `DxfRenderer` από την ΕΝΙΑΙΑ
  // merged-silhouette SSoT (κοινή με 3Δ) — όχι per-entity injection.

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

  /**
   * ADR-398 — forward a canonical viewport override to every child renderer for
   * the WYSIWYG BIM preview pass (`BimPreviewRenderer`). `null` clears it so the
   * default `getBoundingClientRect()` measurement resumes on the main path.
   */
  setViewportOverride(viewport: Viewport | null): void {
    this.renderers.forEach(renderer => renderer.setViewportOverride(viewport));
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
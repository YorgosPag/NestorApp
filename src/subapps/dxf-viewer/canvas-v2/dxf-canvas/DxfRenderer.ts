import type { ViewTransform, Viewport, Point2D } from '../../rendering/types/Types';
import type { DxfScene, DxfEntityUnion, DxfRenderOptions, DxfText } from './dxf-types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { canvasBoundsService } from '../../services/CanvasBoundsService';
import { EntityRendererComposite } from '../../rendering/core/EntityRendererComposite';
import { Canvas2DContext } from '../../rendering/adapters/canvas2d/Canvas2DContext';
import type { EntityModel, RenderOptions } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { calculateDistance } from '../../rendering/entities/shared/geometry-rendering-utils';
import { viewportToWorldBBox, isEntityInViewport } from './dxf-viewport-culling';
function mapDxfLineTypeToEnterprise(dxfLineType: string | undefined): 'solid' | 'dashed' | 'dotted' | 'dashdot' {
  const mapping: Record<string, 'solid' | 'dashed' | 'dotted' | 'dashdot'> = {
    'solid': 'solid',
    'dashed': 'dashed',
    'dotted': 'dotted',
    'dashdot': 'dashdot', // ✅ ENTERPRISE FIX: Keep 'dashdot' for BaseEntity compatibility
    'dash-dot': 'dashdot', // ✅ Map 'dash-dot' to 'dashdot' for BaseEntity compatibility
    'dash-dot-dot': 'dashdot' // ✅ Fallback to 'dashdot' for complex patterns
  };

  const key = dxfLineType || 'solid';
  return mapping[key] || 'solid';
}
export class DxfRenderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private entityComposite: EntityRendererComposite; // ✅ ΝΕΟ: Centralized rendering
  private renderContext: Canvas2DContext; // ✅ ΝΕΟ: Backend abstraction
  // O(1) selection lookup — rebuilt before each render pass to avoid O(n²) Array.includes
  private _selectionSet: Set<string> = new Set();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context for DXF canvas');
    this.ctx = ctx;

    // ✅ ΝΕΟ: Initialize unified rendering system
    this.renderContext = new Canvas2DContext(canvas);
    this.entityComposite = new EntityRendererComposite(ctx);
  }

  /**
   * Set grip interaction state (hovered/active grip) for AutoCAD-style visual feedback.
   * Delegates to EntityRendererComposite → BaseEntityRenderer pipeline.
   */
  setGripInteractionState(state: { hovered?: { entityId: string; gripIndex: number }; active?: { entityId: string; gripIndex: number } }): void {
    this.entityComposite.setGripInteractionState(state);
  }

  /**
   * Κύρια render method
   * ✅ ΕΝΗΜΕΡΩΜΕΝΟ: Χρησιμοποιεί composite για entity rendering
   */
  render(
    scene: DxfScene | null,
    transform: ViewTransform,
    viewport: Viewport,
    options: DxfRenderOptions = {
      showGrid: false,
      showLayerNames: false,
      wireframeMode: false,
      selectedEntityIds: []
    }
  ): void {
    // 🚀 PERF (ADR-040, 2026-05-11): getBounds (cached) instead of refreshBounds.
    // Prior comment cited "fresh bounds" but cache is auto-invalidated on resize/scroll
    // + 5s TTL safety net, so getBounds returns identical value with zero layout cost.
    // Single `canvasRect` is computed once per frame and passed to both clear + draw,
    // preserving the original single-source-of-truth invariant.
    const canvasRect = canvasBoundsService.getBounds(this.canvas);
    const actualViewport: Viewport = { width: canvasRect.width, height: canvasRect.height };

    // Clear canvas using exact same fresh dimensions as rendering viewport
    this.ctx.clearRect(0, 0, canvasRect.width, canvasRect.height);

    // 🏢 Origin marker now rendered by GridRenderer (consolidated — no duplication)
    // Early return if no scene
      if (!scene || !scene.entities.length) {
        return;
      }

    this.ctx.save();

    // ✅ ΝΕΟ: Update composite settings
    this.entityComposite.setTransform(transform);

    // Phase D RE-IMPLEMENT (ADR-040, 2026-05-09): bitmap cache passes skipInteractive=true
    // to render entities in pure normal-state. Interactive overlays are drawn separately.
    const effectiveOptions: DxfRenderOptions = options.skipInteractive
      ? {
          showGrid: options.showGrid,
          showLayerNames: options.showLayerNames,
          wireframeMode: options.wireframeMode,
          selectedEntityIds: [],
          hoveredEntityId: null,
          gripInteractionState: undefined,
          dragPreview: undefined,
        }
      : options;

    // 🏢 GRIP EDITING: Update grip interaction state for visual feedback (always set, even when empty)
    const gripOpts = effectiveOptions.gripInteractionState;
    this.setGripInteractionState(gripOpts
      ? { hovered: gripOpts.hoveredGrip, active: gripOpts.activeGrip }
      : {}
    );

    // Rebuild selection Set for O(1) lookups in renderEntityUnified
    this._selectionSet = new Set(effectiveOptions.selectedEntityIds);
    // ADR-040 Phase IX: viewport culling — skip entities whose bbox does not
    // intersect the screen-space viewport. Computed once per frame.
    const worldViewport = viewportToWorldBBox(transform, actualViewport);
    for (const entity of scene.entities) {
      if (!entity.visible) continue;
      if (!isEntityInViewport(entity, worldViewport)) continue;
      this.renderEntityUnified(entity, transform, actualViewport, effectiveOptions);
    }
    // Render selection highlights (no-op currently, kept for call-site stability)
    this.renderSelectionHighlights(scene, transform, actualViewport, effectiveOptions);

    this.ctx.restore();
  }

  /**
   * Phase D RE-IMPLEMENT (ADR-040, 2026-05-09): render a single entity with
   * a forced visual mode. Used as a single-entity overlay drawn on top of the
   * cached bitmap to avoid invalidating the bitmap on every hover/selection/drag tick.
   *
   * Architectural rule: bitmap cache layers MUST contain only normal-state content;
   * interactive state (hover, selection grips, drag preview) is rendered here.
   */
  renderSingleEntity(
    entity: DxfEntityUnion,
    transform: ViewTransform,
    viewport: Viewport,
    mode: 'hovered' | 'selected' | 'drag-preview',
    interaction: {
      gripInteractionState?: DxfRenderOptions['gripInteractionState'];
      dragPreview?: DxfRenderOptions['dragPreview'];
    } = {},
  ): void {
    if (!entity.visible) return;

    // 🚀 PERF (ADR-040, 2026-05-11): getBounds (cached). Called per selected/hovered
    // entity — using refreshBounds here forced N+1 layout reflows per frame (one per overlay).
    const canvasRect = canvasBoundsService.getBounds(this.canvas);
    const actualViewport: Viewport = { width: canvasRect.width, height: canvasRect.height };

    this.ctx.save();
    this.entityComposite.setTransform(transform);

    // Apply grip interaction state only for selected/drag-preview modes
    const gripOpts = mode === 'selected' || mode === 'drag-preview'
      ? interaction.gripInteractionState
      : undefined;
    this.setGripInteractionState(gripOpts
      ? { hovered: gripOpts.hoveredGrip, active: gripOpts.activeGrip }
      : {}
    );

    const syntheticOptions: DxfRenderOptions = {
      showGrid: false,
      showLayerNames: false,
      wireframeMode: false,
      selectedEntityIds: mode === 'selected' || mode === 'drag-preview' ? [entity.id] : [],
      hoveredEntityId: mode === 'hovered' ? entity.id : null,
      gripInteractionState: gripOpts,
      dragPreview: mode === 'drag-preview' ? interaction.dragPreview : undefined,
    };

    this._selectionSet = new Set(syntheticOptions.selectedEntityIds);
    this.renderEntityUnified(entity, transform, actualViewport, syntheticOptions);

    this.ctx.restore();
  }

  /**
   * ✅ ΝΕΟ: Unified entity rendering με composite pattern
   * Αντικαθιστά τις 5 διπλογραφικές methods (renderLine, renderCircle, κλπ)
   */
  private renderEntityUnified(
    entity: DxfEntityUnion,
    transform: ViewTransform,
    viewport: Viewport,
    options: DxfRenderOptions
  ): void {
    const isSelected = this._selectionSet.has(entity.id);
    const isHovered = options.hoveredEntityId === entity.id;

    // 🏢 GRIP EDITING: Apply drag preview delta to entity geometry before rendering
    const renderedEntity = this.applyDragPreview(entity, options.dragPreview);

    const entityModel: EntityModel = this.toEntityModel(renderedEntity, isSelected);

    // ✅ COMPOSITE RENDERING: Ένα κεντρικό call αντί για switch
    const isDragGhost = options.dragPreview?.entityId === entity.id;
    const renderOptions: RenderOptions = {
      phase: isSelected ? 'selected' : isHovered ? 'highlighted' : 'normal',
      transform,
      viewport,
      showGrips: isSelected && !isDragGhost,
      grips: isSelected && !isDragGhost,
      hovered: isHovered,
      alpha: entity.visible ? 1.0 : 0.3
    };

    // 🏢 GHOST PREVIEW: Semi-transparent blue overlay during grip drag (ADR-040 bitmap overlay pattern)
    if (isDragGhost) this.ctx.globalAlpha = 0.45;
    this.entityComposite.render(entityModel, renderOptions);
    if (isDragGhost) this.ctx.globalAlpha = 1.0;
  }

  /**
   * Apply drag preview delta to an entity for live preview during grip editing.
   * Returns a cloned entity with modified geometry (original entity is NOT mutated).
   *
   * - movesEntity=true: offset ALL coordinates by delta (move entire entity)
   * - movesEntity=false: offset only the specific vertex/grip by delta (stretch)
   */
  private applyDragPreview(
    entity: DxfEntityUnion,
    preview?: DxfRenderOptions['dragPreview']
  ): DxfEntityUnion {
    if (!preview || preview.entityId !== entity.id) return entity;

    const { delta, gripIndex, movesEntity } = preview;
    if (delta.x === 0 && delta.y === 0) return entity;

    const offsetPoint = (p: Point2D): Point2D => ({
      x: p.x + delta.x,
      y: p.y + delta.y,
    });

    if (movesEntity) {
      // Move ALL coordinates
      switch (entity.type) {
        case 'line':
          return { ...entity, start: offsetPoint(entity.start), end: offsetPoint(entity.end) };
        case 'circle':
          return { ...entity, center: offsetPoint(entity.center) };
        case 'polyline':
          return { ...entity, vertices: entity.vertices.map(offsetPoint) };
        case 'arc':
          return { ...entity, center: offsetPoint(entity.center) };
        case 'text':
          return { ...entity, position: offsetPoint(entity.position) };
        case 'angle-measurement':
          return {
            ...entity,
            vertex: offsetPoint(entity.vertex),
            point1: offsetPoint(entity.point1),
            point2: offsetPoint(entity.point2),
          };
      }
    }

    // 🏢 FIX (2026-02-15): Edge-stretch preview — move both vertices of the edge
    const edgeIndices = (preview as { edgeVertexIndices?: [number, number] }).edgeVertexIndices;
    if (edgeIndices && entity.type === 'polyline') {
      const [v1, v2] = edgeIndices;
      const vertices = [...entity.vertices];
      if (v1 < vertices.length) vertices[v1] = offsetPoint(vertices[v1]);
      if (v2 < vertices.length) vertices[v2] = offsetPoint(vertices[v2]);
      return { ...entity, vertices };
    }
    if (edgeIndices && entity.type === 'line') {
      const [v1, v2] = edgeIndices;
      let result = { ...entity };
      if (v1 === 0 || v2 === 0) result = { ...result, start: offsetPoint(entity.start) };
      if (v1 === 1 || v2 === 1) result = { ...result, end: offsetPoint(entity.end) };
      return result;
    }

    // Stretch: move only the specific vertex
    switch (entity.type) {
      case 'line': {
        if (gripIndex === 0) return { ...entity, start: offsetPoint(entity.start) };
        if (gripIndex === 1) return { ...entity, end: offsetPoint(entity.end) };
        return entity;
      }
      case 'polyline': {
        if (gripIndex < entity.vertices.length) {
          const vertices = [...entity.vertices];
          vertices[gripIndex] = offsetPoint(vertices[gripIndex]);
          return { ...entity, vertices };
        }
        return entity;
      }
      case 'circle': {
        // Quadrant grip drag → change radius (center stays fixed)
        const newQuadrantPos = offsetPoint(this.getCircleQuadrant(entity, gripIndex));
        return { ...entity, radius: calculateDistance(entity.center, newQuadrantPos) };
      }
      case 'arc': {
        // Start/end grip drag → change angle + radius
        if (gripIndex === 1 || gripIndex === 2) {
          const arcPoint = gripIndex === 1
            ? this.getArcPoint(entity, entity.startAngle)
            : this.getArcPoint(entity, entity.endAngle);
          const newPos = offsetPoint(arcPoint);
          const newRadius = calculateDistance(entity.center, newPos);
          let angleDeg = Math.atan2(newPos.y - entity.center.y, newPos.x - entity.center.x) * (180 / Math.PI);
          if (angleDeg < 0) angleDeg += 360;
          if (gripIndex === 1) return { ...entity, startAngle: angleDeg, radius: newRadius };
          return { ...entity, endAngle: angleDeg, radius: newRadius };
        }
        return entity;
      }
      case 'angle-measurement': {
        if (gripIndex === 0) return { ...entity, vertex: offsetPoint(entity.vertex) };
        if (gripIndex === 1) return { ...entity, point1: offsetPoint(entity.point1) };
        if (gripIndex === 2) return { ...entity, point2: offsetPoint(entity.point2) };
        return entity;
      }
      default:
        return entity;
    }
  }

  /** Get quadrant point position for a circle grip (gripIndex 1-4) */
  private getCircleQuadrant(entity: { center: Point2D; radius: number }, gripIndex: number): Point2D {
    const { center, radius } = entity;
    switch (gripIndex) {
      case 1: return { x: center.x + radius, y: center.y };
      case 2: return { x: center.x, y: center.y + radius };
      case 3: return { x: center.x - radius, y: center.y };
      case 4: return { x: center.x, y: center.y - radius };
      default: return center;
    }
  }

  /** Get point on arc at given angle (degrees) */
  private getArcPoint(entity: { center: Point2D; radius: number }, angleDeg: number): Point2D {
    const rad = (angleDeg * Math.PI) / 180;
    return {
      x: entity.center.x + entity.radius * Math.cos(rad),
      y: entity.center.y + entity.radius * Math.sin(rad),
    };
  }

  private toEntityModel(entity: DxfEntityUnion, isSelected: boolean): Entity {
    const entityWithLineType = entity as typeof entity & { lineType?: string };
    const entityWithMeasurement = entity as typeof entity & {
      measurement?: boolean;
      showEdgeDistances?: boolean;
    };
    const base = {
      id: entity.id,
      visible: entity.visible,
      selected: isSelected,
      layer: entity.layer,
      color: entity.color,
      lineType: mapDxfLineTypeToEnterprise(entityWithLineType.lineType),
      lineweight: entity.lineWidth,
      ...(entityWithMeasurement.measurement !== undefined && { measurement: entityWithMeasurement.measurement }),
      ...(entityWithMeasurement.showEdgeDistances !== undefined && { showEdgeDistances: entityWithMeasurement.showEdgeDistances })
    };

    switch (entity.type) {
      case 'line':
        return { ...base, type: 'line', start: entity.start, end: entity.end };
      case 'circle':
        return { ...base, type: 'circle', center: entity.center, radius: entity.radius };
      case 'polyline':
        return { ...base, type: 'polyline', vertices: entity.vertices, closed: entity.closed };
      case 'arc':
        return {
          ...base,
          type: 'arc',
          center: entity.center,
          radius: entity.radius,
          startAngle: entity.startAngle,
          endAngle: entity.endAngle,
          counterclockwise: entity.counterclockwise
        };
      case 'text': {
        const te = entity as DxfText;
        // ADR-344 Phase 6.E: spread textStyle so TextRenderer can apply rich styling.
        // Cast required — Entity/TextEntity predates textStyle (rendering hint, not domain).
        return {
          ...base,
          type: 'text',
          position: te.position,
          text: te.text,
          height: te.height,
          rotation: te.rotation,
          ...(te.textStyle && { textStyle: te.textStyle }),
        } as unknown as Entity;
      }
      case 'angle-measurement':
        return {
          ...base,
          type: 'angle-measurement',
          vertex: entity.vertex,
          point1: entity.point1,
          point2: entity.point2,
          angle: entity.angle
        };
      default: {
        const exhaustiveCheck: never = entity;
        return exhaustiveCheck;
      }
    }
  }

  /**
   * Render selection highlights — grips are now rendered per-entity via renderWithPhases.
   * This method is kept as a no-op to avoid removing the call site.
   * The dashed orange bounding box has been replaced by proper AutoCAD-style grips.
   */
  private renderSelectionHighlights(
    _scene: DxfScene,
    _transform: ViewTransform,
    _viewport: Viewport,
    _options: DxfRenderOptions
  ): void {
    // Grips are now rendered inline during entity rendering (options.grips = true)
    // No additional selection overlay needed
  }

  /**
   * Calculate basic entity bounds για selection highlighting
   * TODO: Θα βελτιωθεί με proper bounding box calculation στη Φάση 4
   */
  private calculateEntityBounds(
    entity: DxfEntityUnion,
    transform: ViewTransform,
    viewport: Viewport
  ): { min: Point2D; max: Point2D } | null {
    switch (entity.type) {
      case 'line': {
        const start = CoordinateTransforms.worldToScreen(entity.start, transform, viewport);
        const end = CoordinateTransforms.worldToScreen(entity.end, transform, viewport);
        return {
          min: { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y) },
          max: { x: Math.max(start.x, end.x), y: Math.max(start.y, end.y) }
        };
      }

      case 'circle': {
        const center = CoordinateTransforms.worldToScreen(entity.center, transform, viewport);
        const screenRadius = entity.radius * transform.scale;
        return {
          min: { x: center.x - screenRadius, y: center.y - screenRadius },
          max: { x: center.x + screenRadius, y: center.y + screenRadius }
        };
      }

      case 'arc': {
        // 🏢 ENTERPRISE (2026-02-13): Arc highlight — bounding circle of the arc
        const arcCenter = CoordinateTransforms.worldToScreen(entity.center, transform, viewport);
        const arcScreenRadius = entity.radius * transform.scale;
        return {
          min: { x: arcCenter.x - arcScreenRadius, y: arcCenter.y - arcScreenRadius },
          max: { x: arcCenter.x + arcScreenRadius, y: arcCenter.y + arcScreenRadius }
        };
      }

      case 'polyline': {
        // 🏢 ENTERPRISE (2026-02-13): Polyline/polygon highlight — bounds from all vertices
        if (!entity.vertices || entity.vertices.length === 0) return null;
        const screenVerts = entity.vertices.map(v => CoordinateTransforms.worldToScreen(v, transform, viewport));
        let minX = screenVerts[0].x, minY = screenVerts[0].y;
        let maxX = screenVerts[0].x, maxY = screenVerts[0].y;
        for (let i = 1; i < screenVerts.length; i++) {
          minX = Math.min(minX, screenVerts[i].x);
          minY = Math.min(minY, screenVerts[i].y);
          maxX = Math.max(maxX, screenVerts[i].x);
          maxY = Math.max(maxY, screenVerts[i].y);
        }
        return { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } };
      }

      case 'angle-measurement': {
        // 🏢 ENTERPRISE (2026-02-13): Angle measurement highlight — bounds from 3 points
        const v = CoordinateTransforms.worldToScreen(entity.vertex, transform, viewport);
        const p1 = CoordinateTransforms.worldToScreen(entity.point1, transform, viewport);
        const p2 = CoordinateTransforms.worldToScreen(entity.point2, transform, viewport);
        return {
          min: { x: Math.min(v.x, p1.x, p2.x), y: Math.min(v.y, p1.y, p2.y) },
          max: { x: Math.max(v.x, p1.x, p2.x), y: Math.max(v.y, p1.y, p2.y) }
        };
      }

      case 'text': {
        // 🏢 ENTERPRISE (2026-02-13): Text highlight — approximate from position and height
        const textPos = CoordinateTransforms.worldToScreen(entity.position, transform, viewport);
        const screenHeight = entity.height * transform.scale;
        return {
          min: { x: textPos.x, y: textPos.y - screenHeight },
          max: { x: textPos.x + screenHeight * 4, y: textPos.y } // Approximate width = 4x height
        };
      }
      default:
        return null;
    }
  }
}

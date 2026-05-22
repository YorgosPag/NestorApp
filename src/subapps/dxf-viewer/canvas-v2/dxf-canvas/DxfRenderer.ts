import type { ViewTransform, Viewport, Point2D } from '../../rendering/types/Types';
import { GHOST_DEFAULTS } from '../../rendering/ghost';
import type { DxfScene, DxfEntityUnion, DxfRenderOptions, DxfText } from './dxf-types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { canvasBoundsService } from '../../services/CanvasBoundsService';
import { EntityRendererComposite } from '../../rendering/core/EntityRendererComposite';
import { Canvas2DContext } from '../../rendering/adapters/canvas2d/Canvas2DContext';
import type { EntityModel, RenderOptions } from '../../rendering/types/Types';
import type { Entity, SceneLayer } from '../../types/entities';
import { viewportToWorldBBox, isEntityInViewport } from './dxf-viewport-culling';
import { CAD_UI_COLORS } from '../../config/color-config';
// ADR-358 §G7 Phase 4 — ByLayer/ByBlock resolver
import { resolveEntityStyle, entityToStyleInput } from '../../systems/properties/resolve-entity-style';
import { lineweightToPx } from '../../config/lineweight-iso-catalog';
// 🏢 ADR-358 Phase 9D-3: id-first reader SSoT
import { resolveEntityLayerName, getLayer as getLayerStoreLayer } from '../../stores/LayerStore';
// ADR-358 §5.6.bis Phase 10 — Layer Isolate runtime effects (zero-cost passthrough when inactive).
import { getIsolateEffectsSnapshot } from '../../systems/isolate/IsolateEffectsStore';
import { dimOpacityToTransparency } from '../../services/layer-isolate-resolver';
// ADR-363 Phase 2 (deferred pipeline) — DxfOpening unwrap in toEntityModel().
import type { DxfOpening } from './dxf-types';
// Per-frame index builders (extracted Boy-Scout file-size split, 2026-05-19).
import { buildDimensionLookup, buildSlabOpeningsBySlab, buildOpeningsByWall } from './dxf-renderer-frame-builders';
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
    // CSS-space dimensions: prefer live getBoundingClientRect (main canvas in DOM);
    // fall back to the caller-supplied viewport for off-screen canvases (bitmap cache)
    // where getBoundingClientRect returns 0×0 — a 0×0 clearRect is a no-op and causes
    // ghost-trail artifacts as accumulated frames are never erased.
    const canvasRect = canvasBoundsService.getBounds(this.canvas);
    const cssW = canvasRect.width || viewport.width;
    const cssH = canvasRect.height || viewport.height;
    const actualViewport: Viewport = { width: cssW, height: cssH };
    // Clear canvas using exact same CSS-space dimensions as rendering viewport.
    // DPR ctx.setTransform is active → clearRect in CSS coords = full physical clear.
    this.ctx.clearRect(0, 0, cssW, cssH);
    // 🏢 Origin marker now rendered by GridRenderer (consolidated — no duplication)
    if (!scene || !scene.entities.length) return;
    this.ctx.save();
    // ✅ ΝΕΟ: Update composite settings
    this.entityComposite.setTransform(transform);
    // ADR-362 Phase C1 — build the per-frame DimensionLookup map once and
    // forward it to the dimension leaf. Cheap O(n) scene scan; only dim
    // entities land in the map (typically <100 per scene).
    this.entityComposite.setDimensionLookup(buildDimensionLookup(scene.entities));
    this.entityComposite.setSlabOpeningsBySlab(buildSlabOpeningsBySlab(scene.entities));
    // ADR-363 Phase 2 (deferred pipeline) — feed per-frame opening→wall index so
    // WallRenderer can punch boolean cutouts through wall fills.
    this.entityComposite.setOpeningsByWall(buildOpeningsByWall(scene.entities));
    // ADR-362 Round 5 — propagate active scene units so dim text + arrows scale
    // correctly in non-mm DXFs (e.g. meters). Default `'mm'` keeps legacy parity.
    this.entityComposite.setDimensionSceneUnits(scene.units ?? 'mm');

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
        }
      : options;
    // 🏢 GRIP EDITING: Update grip interaction state for visual feedback (always set, even when empty)
    const gripOpts = effectiveOptions.gripInteractionState;
    this.setGripInteractionState(gripOpts ? { hovered: gripOpts.hoveredGrip, active: gripOpts.activeGrip } : {});
    // Rebuild selection Set for O(1) lookups in renderEntityUnified
    this._selectionSet = new Set(effectiveOptions.selectedEntityIds);
    // ADR-040 Phase IX: viewport culling — skip entities whose bbox does not
    // intersect the screen-space viewport. Computed once per frame.
    const worldViewport = viewportToWorldBBox(transform, actualViewport);

    // ADR-040 Phase X: LINE batch rendering.
    // Normal-state solid LINE entities are grouped by (strokeColor × lineWidth) and
    // rendered as single paths — one ctx.stroke() per group instead of per entity.
    // Excludes: selected, hovered, measurement, non-solid line types.
    type LineBatch = { starts: Point2D[]; ends: Point2D[]; lw: number; alpha: number };
    const lineBatches = new Map<string, LineBatch>();
    const batchedIds = new Set<string>();

    for (const entity of scene.entities) {
      if (entity.type !== 'line') continue;
      if (!entity.visible) continue;
      if (!isEntityInViewport(entity, worldViewport)) continue;
      // ADR-358 §5.6.bis Phase 10 — skip frozen/invisible layers (perf parity AutoCAD).
      if (this.isEntityLayerSkipped(entity, effectiveOptions.layersById)) continue;
      if (this._selectionSet.has(entity.id)) continue;
      if (effectiveOptions.hoveredEntityId === entity.id) continue;
      const meta = entity as typeof entity & { measurement?: boolean; lineType?: string };
      if (meta.measurement) continue;
      if (meta.lineType && meta.lineType !== 'solid') continue;

      const resolved = this.resolveStyleForRender(entity, effectiveOptions.layersById);
      const color = resolved.colorHex;
      const lw = resolved.lineWidthPx;
      const alpha = resolved.alpha;
      const key = `${color}\0${lw}\0${alpha.toFixed(3)}`;
      let batch = lineBatches.get(key);
      if (!batch) { batch = { starts: [], ends: [], lw, alpha }; lineBatches.set(key, batch); }
      batch.starts.push(CoordinateTransforms.worldToScreen(entity.start, transform, actualViewport));
      batch.ends.push(CoordinateTransforms.worldToScreen(entity.end, transform, actualViewport));
      batchedIds.add(entity.id);
    }

    for (const [key, batch] of lineBatches) {
      const color = key.split('\0')[0];
      this.ctx.save();
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = batch.lw;
      this.ctx.setLineDash([]);
      this.ctx.globalAlpha = batch.alpha;
      this.ctx.lineCap = 'butt';
      this.ctx.beginPath();
      for (let i = 0; i < batch.starts.length; i++) {
        this.ctx.moveTo(batch.starts[i].x, batch.starts[i].y);
        this.ctx.lineTo(batch.ends[i].x, batch.ends[i].y);
      }
      this.ctx.stroke();
      this.ctx.restore();
    }
    // Per-entity rendering — non-line entities + interactive lines (selected/hovered/measurement)
    for (const entity of scene.entities) {
      if (!entity.visible) continue;
      if (!isEntityInViewport(entity, worldViewport)) continue;
      // ADR-358 §5.6.bis Phase 10 — skip frozen/invisible layers.
      if (this.isEntityLayerSkipped(entity, effectiveOptions.layersById)) continue;
      if (batchedIds.has(entity.id)) continue;
      this.renderEntityUnified(entity, transform, actualViewport, effectiveOptions);
    }
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
    mode: 'hovered' | 'selected',
    interaction: {
      gripInteractionState?: DxfRenderOptions['gripInteractionState'];
      // ADR-358 §G7 Phase 4 — pass-through for ByLayer/ByBlock resolver
      layersById?: Record<string, SceneLayer>;
      // When true, selected entities keep selection highlight but grips are hidden
      // (AutoCAD parity: grips disappear when a command such as Move is active).
      suppressGrips?: boolean;
      // When true, selected entity renders as ghost (alpha × GHOST_DEFAULTS.alpha).
      movePreviewActive?: boolean;
    } = {},
  ): void {
    if (!entity.visible) return;
    // 🚀 PERF (ADR-040, 2026-05-11): getBounds (cached). N+1 layout reflows avoided.
    const canvasRect = canvasBoundsService.getBounds(this.canvas);
    const actualViewport: Viewport = { width: canvasRect.width, height: canvasRect.height };
    this.ctx.save();
    this.entityComposite.setTransform(transform);
    // ADR-049 SSOT (2026-05-12): 'drag-preview' mode removed — dragged entity renders as 'selected'.
    const gripOpts = mode === 'selected' ? interaction.gripInteractionState : undefined;
    this.setGripInteractionState(gripOpts ? { hovered: gripOpts.hoveredGrip, active: gripOpts.activeGrip } : {});
    const syntheticOptions: DxfRenderOptions = {
      showGrid: false, showLayerNames: false, wireframeMode: false,
      selectedEntityIds: mode === 'selected' ? [entity.id] : [],
      hoveredEntityId: mode === 'hovered' ? entity.id : null,
      gripInteractionState: gripOpts,
      layersById: interaction.layersById,
      suppressGrips: interaction.suppressGrips,
      movePreviewActive: interaction.movePreviewActive,
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

    // ADR-049 SSOT (2026-05-12): grip-drag ghost is rendered on PreviewCanvas
    // by useGripGhostPreview, identical to the Move tool. The main canvas
    // always paints entities at their CURRENT scene-state position — no more
    // applyDragPreview mutation, no per-frame globalAlpha tweak.
    // ADR-358 §5.6.bis Phase 10 — single resolveStyleForRender call (shared with toEntityModel).
    const resolved = this.resolveStyleForRender(entity, options.layersById);
    const entityModel: EntityModel = this.toEntityModel(entity, isSelected, resolved);

    const gripsVisible = isSelected && !options.suppressGrips;
    const ghostMult = options.movePreviewActive && isSelected ? GHOST_DEFAULTS.alpha : 1.0;
    const renderOptions: RenderOptions = {
      phase: isSelected ? 'selected' : isHovered ? 'highlighted' : 'normal',
      transform,
      viewport,
      showGrips: gripsVisible,
      grips: gripsVisible,
      hovered: isHovered,
      selected: isSelected,
      alpha: (entity.visible ? 1.0 : 0.3) * resolved.alpha * ghostMult,
    };

    this.entityComposite.render(entityModel, renderOptions);
  }

  private toEntityModel(
    entity: DxfEntityUnion,
    isSelected: boolean,
    resolvedOrLayersById: { colorHex: string; lineWidthPx: number; alpha: number } | Record<string, SceneLayer> | undefined,
  ): Entity {
    const entityWithLineType = entity as typeof entity & { lineType?: string };
    const entityWithMeasurement = entity as typeof entity & {
      measurement?: boolean;
      showEdgeDistances?: boolean;
    };
    // ADR-358 §G7 Phase 4 — ByLayer/ByBlock resolution.
    // Accepts either a pre-resolved style (perf: avoid double-resolve in renderEntityUnified)
    // OR a layersById map (legacy / renderSingleEntity call sites).
    const isPreResolved =
      typeof resolvedOrLayersById === 'object' &&
      resolvedOrLayersById !== null &&
      'colorHex' in resolvedOrLayersById;
    const resolved = isPreResolved
      ? (resolvedOrLayersById as { colorHex: string; lineWidthPx: number; alpha: number })
      : this.resolveStyleForRender(entity, resolvedOrLayersById as Record<string, SceneLayer> | undefined);
    // ADR-358 Phase 9D-5a: id-only WRITE — legacy `layer` field dropped (schema flip deferred to 9D-5b).
    const base = {
      id: entity.id,
      visible: entity.visible,
      selected: isSelected,
      layerId: entity.layerId ?? '',
      color: resolved.colorHex,
      lineType: mapDxfLineTypeToEnterprise(entityWithLineType.lineType),
      lineweight: resolved.lineWidthPx,
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
      case 'stair': {
        // ADR-358 Phase 5b — unwrap the DxfStair wrapper back into a
        // first-class StairEntity for the renderer pipeline. The parametric
        // geometry comes from the SSoT (`stairEntity.geometry` — populated by
        // `computeStairGeometry()` at create/update time).
        const s = entity.stairEntity;
        return {
          ...base,
          type: 'stair',
          kind: s.kind,
          params: s.params,
          geometry: s.geometry,
          validation: s.validation,
        } as unknown as Entity;
      }
      case 'dimension': {
        // ADR-362 Phase C1 — unwrap the DxfDimension wrapper back into the
        // DimensionEntity SSoT. The renderer resolves DimStyle + DimGeometry
        // internally (via registry singleton + per-frame DimensionLookup).
        return { ...base, ...entity.dimensionEntity } as unknown as Entity;
      }
      case 'slab': {
        // ADR-363 Phase 3.7 — unwrap DxfSlab: SlabRenderer reads geometry.polygon + params.
        const s = entity.slabEntity;
        return { ...base, type: 'slab', kind: s.kind, params: s.params, geometry: s.geometry, validation: s.validation } as unknown as Entity;
      }
      case 'slab-opening': {
        // ADR-363 Phase 3.7 — unwrap DxfSlabOpening: SlabOpeningRenderer reads geometry + kind.
        const so = entity.slabOpeningEntity;
        return { ...base, type: 'slab-opening', kind: so.kind, params: so.params, geometry: so.geometry, validation: so.validation } as unknown as Entity;
      }
      case 'opening': {
        // ADR-363 Phase 2 (deferred pipeline) — unwrap DxfOpening: OpeningRenderer reads
        // geometry.outline + kind overlay; WallRenderer uses per-frame openingsByWall map.
        const o = (entity as DxfOpening).openingEntity;
        return { ...base, type: 'opening', kind: o.kind, params: o.params, geometry: o.geometry, validation: o.validation } as unknown as Entity;
      }
      case 'wall': {
        // ADR-363 Phase 1B — direct entity: geometry/params/kind already at top level
        // (DxfWall uses direct spread, no wallEntity wrapper). WallRenderer reads
        // geometry.outerEdge/innerEdge/axisPolyline + params.category/thickness/flip.
        return { ...base, type: 'wall', kind: entity.kind, params: entity.params, geometry: entity.geometry, validation: entity.validation } as unknown as Entity;
      }
      case 'beam': {
        // ADR-363 Phase 5 — direct entity: same pattern as DxfWall. BeamRenderer
        // reads geometry.outline/axisPolyline + params.width/depth/kind.
        return { ...base, type: 'beam', kind: entity.kind, params: entity.params, geometry: entity.geometry, validation: entity.validation } as unknown as Entity;
      }
      case 'xline':
        return { ...base, type: 'xline', basePoint: entity.xlineEntity.basePoint, direction: entity.xlineEntity.direction } as unknown as Entity;
      case 'ray':
        return { ...base, type: 'ray', basePoint: entity.rayEntity.basePoint, direction: entity.rayEntity.direction } as unknown as Entity;
      default: {
        const exhaustiveCheck: never = entity;
        return exhaustiveCheck;
      }
    }
  }
  // Per-frame index builders extracted to ./dxf-renderer-frame-builders.ts.
  /** ADR-358 §G7 Phase 6 — ByLayer/ByBlock style resolution; falls back to literal values when no layersById. */
  private resolveStyleForRender(
    entity: DxfEntityUnion,
    layersById?: Record<string, SceneLayer>,
  ): { colorHex: string; lineWidthPx: number; alpha: number } {
    const fallback = {
      colorHex: entity.color || CAD_UI_COLORS.entity.default,
      lineWidthPx: Math.max(1, entity.lineWidth || 1),
      alpha: 1,
    };
    if (!layersById) return this.applyIsolateAlpha(fallback, entity);
    // ADR-358 Phase 9E-1: id-keyed lookup first (scene.layersById populated by builder).
    // Name-keyed fallback handles legacy/Firestore scenes without layersById.
    const layerById = entity.layerId ? layersById[entity.layerId] : undefined;
    const layer = layerById ?? (() => {
      const name = resolveEntityLayerName(entity);
      return name ? layersById[name] : undefined;
    })();
    if (!layer) return this.applyIsolateAlpha(fallback, entity);
    const styleInput = entityToStyleInput({
      color: entity.color,
      colorMode: entity.colorMode,
      colorAci: entity.colorAci,
      colorTrueColor: entity.colorTrueColor,
      linetypeName: entity.linetypeName,
      lineweightMm: entity.lineweightMm,
      transparency: entity.transparency,
    });
    const resolved = resolveEntityStyle(styleInput, layer);
    const px = lineweightToPx(resolved.lineweight, 96);
    const baseAlpha = transparencyToAlpha(resolved.transparency);
    return this.applyIsolateAlpha(
      {
        colorHex: resolved.color,
        lineWidthPx: Math.max(1, px || fallback.lineWidthPx),
        alpha: baseAlpha,
      },
      entity,
    );
  }

  /**
   * ADR-358 §5.6.bis Phase 10 — Layer Isolate runtime alpha override.
   * Zero-cost passthrough when isolate is inactive (single boolean branch).
   * In `dim` mode, multiplies alpha for layers NOT in the isolated set by the
   * configured dimOpacityPercent. `freeze` mode is handled by the skip-path
   * (see `isEntityLayerSkipped`).
   */
  private applyIsolateAlpha(
    style: { colorHex: string; lineWidthPx: number; alpha: number },
    entity: DxfEntityUnion,
  ): { colorHex: string; lineWidthPx: number; alpha: number } {
    const isolate = getIsolateEffectsSnapshot();
    if (!isolate.active || isolate.mode !== 'dim') return style;
    const layerId = entity.layerId;
    if (layerId && isolate.isolatedLayerIds.has(layerId)) return style;
    const dimAlpha = transparencyToAlpha(dimOpacityToTransparency(isolate.dimOpacityPercent));
    return { ...style, alpha: Math.min(style.alpha, dimAlpha) };
  }

  /**
   * ADR-358 §5.6.bis Phase 10 — return true when the entity belongs to a
   * frozen or invisible layer (`LAYFRZ` / `LAYOFF` AutoCAD). Renderer skips
   * those entirely. Called per entity in both render loops — kept inline-fast.
   *
   * LayerStore is the runtime SSoT (hydrated from SceneModel via
   * `useDxfSceneConversion`); `layersById` is the cold fallback for legacy
   * call sites or test harnesses that didn't go through the level loader.
   */
  private isEntityLayerSkipped(
    entity: DxfEntityUnion,
    layersById?: Record<string, SceneLayer>,
  ): boolean {
    if (!entity.layerId && !layersById) return false;
    const storeLayer = entity.layerId ? getLayerStoreLayer(entity.layerId) : null;
    if (storeLayer) {
      return storeLayer.frozen === true || storeLayer.visible === false;
    }
    if (!layersById) return false;
    const layerById = entity.layerId ? layersById[entity.layerId] : undefined;
    const layer = layerById ?? (() => {
      const name = resolveEntityLayerName(entity);
      return name ? layersById[name] : undefined;
    })();
    if (!layer) return false;
    return layer.frozen === true || layer.visible === false;
  }
}

/** DXF transparency (0..90) → canvas alpha (0..1). 0 transparency = fully opaque. */
function transparencyToAlpha(transparency: number | undefined): number {
  if (typeof transparency !== 'number' || !Number.isFinite(transparency)) return 1;
  const clamped = Math.max(0, Math.min(90, transparency));
  return 1 - clamped / 100;
}

/**
 * Base Entity Renderer
 * Abstract base class for all entity-specific renderers
 */

// ✅ ΦΑΣΗ 7: Use unified coordinate transforms
import { CoordinateTransforms } from '../core/CoordinateTransforms';
import type { ViewTransform, Point2D, Viewport } from '../types/Types';
import { CAD_UI_COLORS, resolveGripColors } from '../../config/color-config';
import type { GripSettings } from '../../types/gripSettings';
import { PhaseManager } from '../../systems/phase-manager/PhaseManager';
// 🏢 ADR-397 — rotation snap SSoT: cyan 'snappable' marks ONLY the grip the cursor
// is currently snapped to (proximity), not the whole set.
import { getActiveRotationGripSnapKey } from '../../bim/grips/rotation-snap-store';
import { withMoveGlyphRotation } from '../../bim/grips/move-glyph-frame';
// 🏢 ADR-397 Φ2 — per-arm MOVE-glyph hover highlight: the hovered arm SSoT + the
// world→drawn-local-arm mapping (canvas Y-flip).
import { MoveGlyphZoneStore } from '../../bim/grips/move-glyph-zone-store';
import { worldZoneToLocalArm } from '../../bim/grips/move-glyph-zones';
import type { EntityModel, RenderOptions, GripInfo } from '../types/Types';
import type { Entity } from '../../types/entities';
import { DEFAULT_TOLERANCE } from '../../config/tolerance-config';
// 🏢 ADR-119: Centralized Opacity Constants
import { UI_COLORS, OPACITY, HOVER_HIGHLIGHT } from '../../config/color-config';
// 🏢 ADR-075: Centralized Grip Size Multipliers
import { GRIP_SIZE_MULTIPLIERS } from '../grips/constants';
// 🏢 ADR-065: Centralized Distance Calculation
import { renderSquareGrip, calculateDistance } from './shared/geometry-rendering-utils';
// 🏢 ADR-065: Extracted rendering helpers (arc/angle + distance text)
import {
  type BaseRenderingContext,
  calculateDistanceTextPositionImpl,
  renderDistanceTextCommonImpl,
  renderInlineDistanceTextImpl,
  renderDistanceTextCentralizedImpl,
  renderDistanceTextPhaseAwareImpl,
  shouldRenderSplitLineImpl,
  shouldRenderLinesImpl,
  renderSplitLineWithGapImpl,
  applyArcStyleToCtx,
  drawCentralizedArcImpl,
  drawInternalAngleArcImpl,
  renderAngleAtVertexImpl,
  drawInternalArcOnCanvas,
  applyAngleMeasurementTextStyleToCtx,
  applyDistanceMeasurementTextStyleToCtx,
  applyDistanceTextStyleToCtx,
  renderStyledDistanceTextOnCtx,
} from './base-entity-rendering-helpers';

// Interfaces moved to PhaseManager to avoid circular dependency

export abstract class BaseEntityRenderer {
  protected ctx: CanvasRenderingContext2D;
  protected transform: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };
  protected gripSettings?: GripSettings;
  protected gripInteraction: {
    hovered?: { entityId: string; gripIndex: number };
    active?: { entityId: string; gripIndex: number };
    /** ADR-501 — grip keys clicked-to-select for a multi-grip move (orange). */
    armedKeys?: ReadonlySet<string>;
  } = {};
  protected phaseManager: PhaseManager;
  private _viewportCache: Viewport | null = null;
  private _viewportCacheTime = 0;
  /**
   * ADR-398 — canonical viewport injected by the WYSIWYG BIM preview pass
   * (`BimPreviewRenderer`). When set, `getViewport()` returns it instead of this
   * renderer's own `getBoundingClientRect()`, so the preview ghost measures its
   * y-flip against the SAME viewport as the committed entity (DxfCanvas/container
   * rect) — otherwise a few-px height divergence yields a constant +Y offset.
   * `null` on the main render path → unchanged behaviour (zero regression).
   */
  private _viewportOverride: Viewport | null = null;
  protected _currentHovered = false;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    this.phaseManager = new PhaseManager({
      ctx: this.ctx,
      transform: this.transform,
      worldToScreen: this.worldToScreen.bind(this)
    });
  }

  // Transform setters
  setTransform(transform: ViewTransform): void {
    this.transform = { ...transform };
    this.phaseManager.updateTransform(this.transform);
  }

  setGripSettings(settings: GripSettings): void {
    this.gripSettings = settings;
    // Pass grip settings to PhaseManager for preview grips
    this.phaseManager.setGripSettings(settings);
  }

  public setGripInteractionState(next: typeof this.gripInteraction) {
    this.gripInteraction = next || {};
  }

  /** 🏢 ADR-065: Rendering context for delegated helper functions */
  protected get rc(): BaseRenderingContext {
    return {
      ctx: this.ctx,
      transform: this.transform,
      worldToScreen: this.worldToScreen.bind(this),
      phaseManager: this.phaseManager,
      applyAngleMeasurementTextStyle: this.applyAngleMeasurementTextStyle.bind(this),
      applyDistanceTextStyle: this.applyDistanceTextStyle.bind(this),
      textColorOverride: this._currentHovered ? HOVER_HIGHLIGHT.ENTITY.glowColor : undefined,
    };
  }

  /**
   * ADR-398 — inject/clear the canonical viewport for the BIM preview pass.
   * `null` restores the default `getBoundingClientRect()` measurement.
   */
  setViewportOverride(viewport: Viewport | null): void {
    this._viewportOverride = viewport;
  }

  private getViewport(): Viewport {
    // ADR-398 — preview pass: measure against the injected canonical viewport
    // (DxfCanvas / container rect), NOT this renderer's own canvas rect.
    if (this._viewportOverride) return this._viewportOverride;
    const now = performance.now();
    if (!this._viewportCache || now - this._viewportCacheTime > 16) {
      const rect = this.ctx.canvas.getBoundingClientRect();
      this._viewportCache = { width: rect.width, height: rect.height };
      this._viewportCacheTime = now;
    }
    return this._viewportCache;
  }

  // ✅ ΦΑΣΗ 7: Unified coordinate transformations
  protected worldToScreen(point: Point2D): Point2D {
    return CoordinateTransforms.worldToScreen(point, this.transform, this.getViewport());
  }

  protected screenToWorld(point: Point2D): Point2D {
    return CoordinateTransforms.screenToWorld(point, this.transform, this.getViewport());
  }

  // Abstract methods to be implemented by subclasses
  abstract render(entity: EntityModel, options: RenderOptions): void;
  abstract getGrips(entity: EntityModel): GripInfo[];
  abstract hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean;

  // New phase-based grip rendering
  protected renderGrips(entity: EntityModel, options: RenderOptions = {}): void {
    // ✅ ΠΡΟΣΩΡΙΝΗ ΔΙΟΡΘΩΣΗ: Force enable grips για να λειτουργήσουν
    if (!this.gripSettings?.showGrips) {
      // return; // ✅ Commented out για να δουλέψουν τα grips
    }

    let grips = withMoveGlyphRotation(
      this.getGrips(entity),
      entity as Entity,
      this.worldToScreen.bind(this),
    );
    // 🏢 ADR-397 Φ2 — per-arm hover highlight: if the cursor is over ONE arm of
    // this entity's MOVE glyph (and that grip is NOT the actively-pressed one),
    // tag that grip with the drawn-local arm so only it lights warm. The hovered
    // zone is tracked in WORLD space by `MoveGlyphZoneStore` and mapped to the
    // drawn local arm here (canvas Y-flip via `worldZoneToLocalArm`).
    const hov = this.gripInteraction.hovered;
    const act = this.gripInteraction.active;
    if (hov && hov.entityId === entity.id &&
        !(act && act.entityId === entity.id && act.gripIndex === hov.gripIndex)) {
      const worldZone = MoveGlyphZoneStore.getHoveredZone(entity.id, hov.gripIndex);
      const localArm = worldZone ? worldZoneToLocalArm(worldZone) : null;
      if (localArm) {
        grips = grips.map((g) =>
          g.shape === 'move' && (g.gripIndex ?? -1) === hov.gripIndex
            ? { ...g, moveHoveredZone: localArm }
            : g,
        );
      }
    }
    // 🏢 ENTERPRISE: EntityModel is alias for Entity, type assertion is safe
    const phaseState = this.phaseManager.determinePhase(entity as Entity, options);
    
    // Set grip interaction state for PhaseManager using consistent naming. The
    // PRESSED / actively-manipulated grip (`gripInteraction.active`, set during a
    // drag OR the click-armed hot-grip rotate/move flow) feeds `selectedGrip`. The
    // temperature SSoT (`resolveGripTemperature`) maps `active: selectedGrip ??
    // dragginGrip` → such a grip resolves HOT and stays hot for the whole operation
    // (ADR-397). No need to also stuff it into `dragginGrip` — that was a workaround
    // for the old getGripTemperature that read ONLY `dragginGrip`.
    // ADR-397 — only the grip the cursor is CURRENTLY snapped to (proximity) renders
    // cyan; all others stay warm/cold. Event-time read of the live snap result, so
    // it tracks the cursor exactly like hover. null/empty when not snapped, OSNAP
    // off, or not rotating.
    const snappedKey = getActiveRotationGripSnapKey();
    phaseState.gripState = {
      hoveredGrip: this.gripInteraction.hovered,
      selectedGrip: this.gripInteraction.active,
      dragginGrip: undefined,
      // ADR-501 — clicked-to-select grips render orange ('armed').
      armedKeys: this.gripInteraction.armedKeys,
      snappableKeys: snappedKey ? new Set([snappedKey]) : undefined,
    };

    this.phaseManager.renderPhaseGrips(entity as Entity, grips, phaseState);
  }

  /**
   * 🎨 ΚΕΝΤΡΙΚΟΠΟΙΗΜΈΝΟ TEXT STYLING SYSTEM
   * Όλα τα κείμενα χρησιμοποιούν αυτές τις μεθόδους
   */
  
  // Base font size - ΣΤΑΘΕΡΟ 11px όπως η πολυγραμμή
  protected getBaseFontSize(): number {
    return 11; // Σταθερό μέγεθος για consistency
  }

  // ─── Text styles (logic in base-entity-rendering-helpers, ADR-065/N.7.1) ─────
  /** 🏢 ADR-048 centralized fuchsia — γωνίες (μοίρες/radians). */
  protected applyAngleMeasurementTextStyle(): void {
    applyAngleMeasurementTextStyleToCtx(this.ctx, this.getBaseFontSize());
  }

  /** @deprecated → applyAngleMeasurementTextStyle / applyDistanceMeasurementTextStyle. */
  protected applyDimensionTextStyle(): void {
    this.applyAngleMeasurementTextStyle();
  }

  /** 🏢 ADR-048 centralized white — μήκη ευθύγραμμων τμημάτων. */
  protected applyDistanceMeasurementTextStyle(): void {
    applyDistanceMeasurementTextStyleToCtx(this.ctx, this.getBaseFontSize());
  }

  /** 🔺 Centralized distance-text με δυναμικό font styling + hover glow (preview). */
  protected applyDistanceTextStyle(): void {
    applyDistanceTextStyleToCtx(this.ctx, this._currentHovered);
  }

  /** 🎨 Advanced text render με decorations (underline/strikethrough). */
  protected renderStyledDistanceText(text: string, x: number, y: number): void {
    renderStyledDistanceTextOnCtx(this.ctx, text, x, y);
  }

  /** Κεντρικές μετρήσεις (εμβαδόν/περίμετρος) — fuchsia. */
  protected applyCenterMeasurementTextStyle(): void {
    this.applyDimensionTextStyle();
  }

  /** Corner/grip μετρήσεις — fuchsia. */
  protected applyCornerTextStyle(): void {
    this.applyDimensionTextStyle();
  }

  /** Γενική μέθοδος — όλα τα κείμενα. */
  protected applyMeasurementTextStyle(): void {
    this.applyDimensionTextStyle();
  }

  // viewport culling για grips - κερδίζουμε πολλά όταν έχουμε χιλιάδες
  private onScreen = (p: Point2D) => {
    const vp = this.getViewport();
    return p.x >= 0 && p.y >= 0 && p.x <= vp.width && p.y <= vp.height;
  };

  // 🏢 ADR-075: Use centralized grip size multipliers
  // 🏢 FIX (2026-02-15): Unified grip color/size policy — SSoT across DXF entities & colored layers
  // Visual distinction: edge grips at 60% size (not different color) — consistent temperature colors
  protected drawGrip(position: Point2D, state: 'cold' | 'warm' | 'hot', gripType?: string): void {
    const isEdge = gripType === 'edge';
    const rawBase = this.gripSettings?.gripSize || 10;
    // 🏢 SSoT: Edge grips at 60% of vertex size (matches LayerRenderer pattern)
    const base = isEdge ? rawBase * 0.6 : rawBase;
    const multiplier = GRIP_SIZE_MULTIPLIERS[state.toUpperCase() as keyof typeof GRIP_SIZE_MULTIPLIERS];
    const size = Math.round(base * multiplier);

    const colors = resolveGripColors(this.gripSettings?.colors ?? {
      cold: null,
      warm: CAD_UI_COLORS.grips.warm,
      hot: CAD_UI_COLORS.grips.hot,
      contour: CAD_UI_COLORS.grips.outline_color,
    });

    // 🏢 SSoT: Unified color policy — same temperature colors for ALL grip types
    // Visual distinction comes from SIZE (60% for edges), not color
    const fill = state === 'hot'  ? colors.hot
               : state === 'warm' ? colors.warm
                                  : colors.cold;

    renderSquareGrip(this.ctx, position, size, fill, UI_COLORS.GRIP_OUTLINE);
  }

  // Grip hit testing
  public findGripAtPoint(entity: EntityModel, screenPoint: Point2D, tolerance: number = DEFAULT_TOLERANCE): GripInfo | null {
    if (!this.gripSettings) return null;
    const grips = this.getGrips(entity);
    for (const grip of grips) {
      const screenGrip = this.worldToScreen(grip.position);
      // 🏢 ADR-065: Use centralized distance calculation
      if (calculateDistance(screenPoint, screenGrip) <= tolerance) return grip;
    }
    return null;
  }

  // New phase-based style setup.
  // 🎨 AutoCAD-like canvas state reset (2026-01-03): full per-entity reset prevents "πέπλο"
  // / αλλοιωμένα χρώματα — globalAlpha=1, source-over, no dash, butt/miter caps, no shadow.
  protected setupStyle(entity: EntityModel, options: RenderOptions = {}): void {
    this.ctx.save();

    // 🎯 CRITICAL: Full canvas state reset for AutoCAD-like colors
    this.ctx.globalAlpha = OPACITY.OPAQUE; // 🏢 ADR-119: Centralized opacity
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.setLineDash([]);
    this.ctx.lineCap = 'butt';
    this.ctx.lineJoin = 'miter';
    // Shadow reset: prevents bleed from guide-renderer or any previous shadow context
    this.ctx.shadowBlur = 0;
    this.ctx.shadowColor = 'transparent';

    // Determine current phase and apply appropriate styling
    const phaseState = this.phaseManager.determinePhase(entity as Entity, options);
    this.phaseManager.applyPhaseStyle(entity as Entity, phaseState);
    // Ghost alpha override (Move-tool AutoCAD parity): apply AFTER phase style so
    // applyNormalStyle's globalAlpha=1 reset cannot win. Only when explicitly < 1.
    if (options.alpha !== undefined && options.alpha < OPACITY.OPAQUE) {
      this.ctx.globalAlpha = options.alpha;
    }
  }

  protected applyEntityStyle(entity: EntityModel): void {
    // Apply authentic entity style (color from layer/entity)
    this.ctx.strokeStyle = entity.color || CAD_UI_COLORS.entity.default;
    this.ctx.fillStyle = entity.color || CAD_UI_COLORS.entity.default;
    // 🎯 AUTOCAD FIX: lineWidth >= 1 prevents sub-pixel color distortion
    this.ctx.lineWidth = Math.max(1, (entity as { lineWidth?: number }).lineWidth || 1);
    // Keep solid line for authentic style
    this.ctx.setLineDash([]);
    // 🎯 CRITICAL: Ensure full opacity for authentic colors
    this.ctx.globalAlpha = OPACITY.OPAQUE; // 🏢 ADR-119: Centralized opacity
  }

  protected cleanupStyle(): void {
    this.ctx.restore();
  }

  // ===== TEMPLATE METHOD PATTERN =====
  // Unified rendering flow to eliminate duplication
  
  /**
   * Universal Template Method for 3-Phase Entity Rendering
   * Handles all entities uniformly through PhaseManager
   */
  protected renderWithPhases(
    entity: EntityModel,
    options: RenderOptions = {},
    renderGeometry: () => void,
    renderMeasurements?: () => void,
    renderYellowDots?: () => void
  ): void {
    this._currentHovered = options.hovered ?? false;
    // 1. Determine current phase
    const phaseState = this.phaseManager.determinePhase(entity as Entity, options);

    // 2. Glow pre-pass for highlighted entities — double-stroke replaces shadowBlur (GPU-free)
    if (phaseState.phase === 'highlighted') {
      const entityLineWidth = Math.max(1, (entity as EntityModel & { lineWidth?: number }).lineWidth || 1);
      this.ctx.save();
      this.ctx.shadowBlur = 0;
      this.ctx.shadowColor = 'transparent';
      this.ctx.strokeStyle = HOVER_HIGHLIGHT.ENTITY.glowColor;
      this.ctx.lineWidth = entityLineWidth + HOVER_HIGHLIGHT.ENTITY.glowExtraWidth;
      this.ctx.globalAlpha = HOVER_HIGHLIGHT.ENTITY.glowOpacity;
      this.ctx.setLineDash([]);
      renderGeometry();
      this.ctx.restore();
    }

    // 3. Setup phase-appropriate style
    this.setupStyle(entity, options);

    // 4. Render geometry (always)
    renderGeometry();
    
    // 4. Render measurements if phase requires them
    const shouldMeasure = this.phaseManager.shouldRenderMeasurements(phaseState, entity as Entity);
    if (shouldMeasure && renderMeasurements) {
      renderMeasurements();
    }
    
    // 5. Render colored dots with centralized color management
    if (this.phaseManager.shouldRenderYellowDots(phaseState, entity as Entity) && renderYellowDots) {
      // Set centralized dot color before rendering dots
      this.ctx.save();
      this.ctx.fillStyle = this.phaseManager.getPreviewDotColor(entity as Entity);
      renderYellowDots();
      this.ctx.restore();
    }
    
    // 6. Draw grips with phase-appropriate colors
    // ✅ ΚΡΙΣΙΜΗ ΔΙΟΡΘΩΣΗ: Επιτρέπουμε grips σε preview entities!
    if (options.grips) {
      this.renderGrips(entity, options);
    }
    
    // 7. Cleanup
    this.cleanupStyle();
  }

  /** 🏢 ADR-065: Delegated to base-entity-rendering-helpers.ts */
  protected calculateDistanceTextPosition(screenStart: Point2D, screenEnd: Point2D, offsetDistance: number = 15): Point2D {
    return calculateDistanceTextPositionImpl(screenStart, screenEnd, offsetDistance);
  }

  /** 🏢 ADR-065: Delegated to base-entity-rendering-helpers.ts */
  protected renderInlineDistanceText(worldStart: Point2D, worldEnd: Point2D, screenStart: Point2D, screenEnd: Point2D): void {
    renderInlineDistanceTextImpl(this.rc, worldStart, worldEnd, screenStart, screenEnd);
  }

  /** 🏢 ADR-065: Delegated to base-entity-rendering-helpers.ts */
  protected renderDistanceTextCentralized(worldStart: Point2D, worldEnd: Point2D, screenStart: Point2D, screenEnd: Point2D, offsetDistance: number = 15): void {
    renderDistanceTextCentralizedImpl(this.rc, worldStart, worldEnd, screenStart, screenEnd, offsetDistance);
  }

  /** 🏢 ADR-065: Delegated to base-entity-rendering-helpers.ts */
  protected renderDistanceTextPhaseAware(worldStart: Point2D, worldEnd: Point2D, screenStart: Point2D, screenEnd: Point2D, entity: EntityModel, options: RenderOptions): void {
    renderDistanceTextPhaseAwareImpl(this.rc, worldStart, worldEnd, screenStart, screenEnd, entity, options);
  }

  /** 🏢 ADR-065: Delegated to base-entity-rendering-helpers.ts */
  protected shouldRenderSplitLine(entity: EntityModel, options: RenderOptions = {}): boolean {
    return shouldRenderSplitLineImpl(this.rc, entity, options);
  }

  /** 🏢 ADR-065: Delegated to base-entity-rendering-helpers.ts */
  protected shouldRenderLines(entity: EntityModel, options: RenderOptions = {}): boolean {
    return shouldRenderLinesImpl();
  }

  /** 🏢 ADR-065: Delegated to base-entity-rendering-helpers.ts */
  protected renderSplitLineWithGap(screenStart: Point2D, screenEnd: Point2D, entity: EntityModel, options: RenderOptions = {}): void {
    renderSplitLineWithGapImpl(this.rc, screenStart, screenEnd, entity, options);
  }

  /** 🏢 ADR-065: Delegated to base-entity-rendering-helpers.ts */
  protected applyArcStyle(): void {
    applyArcStyleToCtx(this.ctx);
  }

  /** 🏢 ADR-065: Delegated to base-entity-rendering-helpers.ts */
  protected drawCentralizedArc(centerX: number, centerY: number, radius: number, startAngle: number, endAngle: number): void {
    drawCentralizedArcImpl(this.rc, centerX, centerY, radius, startAngle, endAngle);
  }

  /** 🏢 ADR-065: Delegated to base-entity-rendering-helpers.ts */
  protected drawInternalAngleArc(vertex: Point2D, point1: Point2D, point2: Point2D, radiusWorld: number): void {
    drawInternalAngleArcImpl(this.rc, vertex, point1, point2, radiusWorld);
  }

  /** 🏢 ADR-065: Delegated to base-entity-rendering-helpers.ts */
  private renderDistanceTextCommon(worldStart: Point2D, worldEnd: Point2D, screenStart: Point2D, screenEnd: Point2D, textPosition: Point2D): void {
    renderDistanceTextCommonImpl(this.rc, worldStart, worldEnd, screenStart, screenEnd, textPosition);
  }

  /**
   * Common vertex dots rendering - eliminates duplication across renderers
   */
  protected renderVertexDots(vertices: Point2D[], dotRadius: number = 4): void {
    // 🔺 ΚΕΝΤΡΙΚΟΠΟΙΗΜΈΝΟ ΧΡΏΜΑ - το fillStyle έχει ήδη οριστεί από το renderWithPhases
    // ⚡ NUCLEAR: VERTEX DOTS ELIMINATED
  }

  /**
   * Common rendering finalization - grips and cleanup
   */
  protected finalizeRendering(entity: EntityModel, options: RenderOptions): void {
    if (options.grips) {
      this.renderGrips(entity, options);
    }
    this.cleanupStyle();
  }

  /** SSoT grip hook for BIM renderers that manage their own ctx save/restore */
  protected finalizeRender(entity: EntityModel, options: RenderOptions): void {
    if (options.grips) this.renderGrips(entity, options);
  }

  /** 🏢 ADR-065: Delegated to base-entity-rendering-helpers.ts */
  protected renderAngleAtVertex(
    prevVertex: Point2D, currentVertex: Point2D, nextVertex: Point2D,
    prevScreen: Point2D, currentScreen: Point2D, nextScreen: Point2D,
    arcRadius: number = 30, labelOffset: number = 15
  ): void {
    renderAngleAtVertexImpl(this.rc, prevVertex, currentVertex, nextVertex, prevScreen, currentScreen, nextScreen, arcRadius, labelOffset);
  }

  /** 🏢 ADR-065: Delegated to base-entity-rendering-helpers.ts */
  private drawInternalArc(vertex: Point2D, prevUnit: Point2D, nextUnit: Point2D, rPx: number): void {
    drawInternalArcOnCanvas(this.rc, vertex, prevUnit, nextUnit, rPx);
  }
}
/**
 * Base Entity Renderer
 * Abstract base class for all entity-specific renderers
 */

// ✅ ΦΑΣΗ 7: Use unified coordinate transforms
import { CoordinateTransforms } from '../core/CoordinateTransforms';
import type { ViewTransform, Point2D, Viewport } from '../types/Types';
import { CAD_UI_COLORS } from '../../config/color-config';
import type { GripSettings } from '../../types/gripSettings';
import { PhaseManager } from '../../systems/phase-manager/PhaseManager';
import type { EntityModel, RenderOptions, GripInfo } from '../types/Types';
import type { Entity } from '../../types/entities';
import { DEFAULT_TOLERANCE } from '../../config/tolerance-config';
// 🏢 ADR-119: Centralized Opacity Constants
import { UI_COLORS, OPACITY } from '../../config/color-config';
// 🏢 ADR-091: Centralized UI Fonts (buildUIFont for dynamic sizes)
import { buildUIFont } from '../../config/text-rendering-config';
// 🏢 ADR-075: Centralized Grip Size Multipliers
import { GRIP_SIZE_MULTIPLIERS } from '../grips/constants';
// 🏢 ADR-065: Centralized Distance Calculation
import { renderSquareGrip, calculateDistance } from './shared/geometry-rendering-utils';
import { renderStyledTextWithOverride, getTextPreviewStyleWithOverride } from '../../hooks/useTextPreviewStyle';
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
} from './base-entity-rendering-helpers';

// Interfaces moved to PhaseManager to avoid circular dependency

export abstract class BaseEntityRenderer {
  protected ctx: CanvasRenderingContext2D;
  protected transform: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };
  protected gripSettings?: GripSettings;
  protected gripInteraction: {
    hovered?: { entityId: string; gripIndex: number };
    active?: { entityId: string; gripIndex: number };
  } = {};
  protected phaseManager: PhaseManager;

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
    };
  }

  // ✅ ΦΑΣΗ 7: Unified coordinate transformations
  protected worldToScreen(point: Point2D): Point2D {
    const rect = this.ctx.canvas.getBoundingClientRect();
    const viewport: Viewport = { width: rect.width, height: rect.height };
    return CoordinateTransforms.worldToScreen(point, this.transform, viewport);
  }

  protected screenToWorld(point: Point2D): Point2D {
    const rect = this.ctx.canvas.getBoundingClientRect();
    const viewport: Viewport = { width: rect.width, height: rect.height };
    return CoordinateTransforms.screenToWorld(point, this.transform, viewport);
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

    const grips = this.getGrips(entity);
    // 🏢 ENTERPRISE: EntityModel is alias for Entity, type assertion is safe
    const phaseState = this.phaseManager.determinePhase(entity as Entity, options);
    
    // Set grip interaction state for PhaseManager
    phaseState.gripState = {
      hoveredGrip: this.gripInteraction.hovered,
      selectedGrip: this.gripInteraction.active,
      dragginGrip: undefined // Currently not implementing drag detection
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

  /**
   * Style για μετρήσεις γωνιών (μοίρες, radians)
   * 🏢 ADR-048: Uses centralized ANGLE_MEASUREMENT_TEXT color
   * 🎯 Φούξια χρώμα - κεντρικοποιημένο
   */
  protected applyAngleMeasurementTextStyle(): void {
    this.ctx.fillStyle = UI_COLORS.ANGLE_MEASUREMENT_TEXT;  // 🏢 Centralized fuchsia for angles
    this.ctx.font = buildUIFont(this.getBaseFontSize(), 'arial');
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
  }

  /**
   * @deprecated Χρησιμοποίησε applyAngleMeasurementTextStyle() ή applyDistanceMeasurementTextStyle()
   * Διατηρείται για backward compatibility
   */
  protected applyDimensionTextStyle(): void {
    this.applyAngleMeasurementTextStyle(); // Delegate to new method
  }

  /**
   * Style για μετρήσεις μηκών ευθύγραμμων τμημάτων
   * 🏢 ADR-048: Uses centralized DISTANCE_MEASUREMENT_TEXT color
   * 🎯 Λευκό χρώμα - κεντρικοποιημένο
   */
  protected applyDistanceMeasurementTextStyle(): void {
    this.ctx.fillStyle = UI_COLORS.DISTANCE_MEASUREMENT_TEXT;  // 🏢 Centralized white for distances
    this.ctx.font = buildUIFont(this.getBaseFontSize(), 'arial');
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
  }

  /**
   * 🔺 ΚΕΝΤΡΙΚΟΠΟΙΗΜΈΝΟ ΧΡΏΜΑ DISTANCE TEXT - για preview με δυναμικό styling
   * Χρώμα για τα κείμενα αποστάσεων στη φάση προεπισκόπησης
   */
  protected applyDistanceTextStyle(): void {
    // 🏢 ENTERPRISE: Χρήση κεντρικοποιημένου χρώματος, αλλά με δυναμικό font styling
    const textStyle = getTextPreviewStyleWithOverride();
    this.ctx.fillStyle = UI_COLORS.DISTANCE_MEASUREMENT_TEXT;  // 🎯 Centralized white color
    this.ctx.font = `${textStyle.fontStyle} ${textStyle.fontWeight} ${textStyle.fontSize} ${textStyle.fontFamily}`;
    this.ctx.globalAlpha = textStyle.opacity;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
  }

  /**
   * 🎨 ADVANCED TEXT RENDERING - με πλήρη υποστήριξη decorations
   * Κάνει render κείμενο με underline, strikethrough, κλπ.
   */
  protected renderStyledDistanceText(text: string, x: number, y: number): void {
    this.ctx.save();
    renderStyledTextWithOverride(this.ctx, text, x, y);
    this.ctx.restore();
  }

  /**
   * Style για κεντρικές μετρήσεις (εμβαδόν, περίμετρος) - Χρησιμοποιεί κεντρικοποιημένο χρώμα
   */
  protected applyCenterMeasurementTextStyle(): void {
    this.applyDimensionTextStyle(); // Use centralized fuchsia color and styling
  }

  /**
   * Style για corner/grip μετρήσεις - Χρησιμοποιεί κεντρικοποιημένο χρώμα
   */
  protected applyCornerTextStyle(): void {
    this.applyDimensionTextStyle(); // Use centralized fuchsia color and styling
  }


  /**
   * Γενική μέθοδος - όλα τα κείμενα
   */
  protected applyMeasurementTextStyle(): void {
    this.applyDimensionTextStyle(); // Default
  }

  private stateForGrip(entityId: string, idx: number): 'cold'|'warm'|'hot' {
    if (this.gripInteraction.active?.entityId === entityId &&
        this.gripInteraction.active?.gripIndex === idx) return 'hot';
    if (this.gripInteraction.hovered?.entityId === entityId &&
        this.gripInteraction.hovered?.gripIndex === idx) return 'warm';
    return 'cold';
  }

  private drawGripAtWorld(worldPt: Point2D, state: 'cold'|'warm'|'hot', gripType?: string) {
    const rect = this.ctx.canvas.getBoundingClientRect();
    const viewport: Viewport = { width: rect.width, height: rect.height };
    const screenPoint = CoordinateTransforms.worldToScreen(worldPt, this.transform, viewport);
    this.drawGrip(screenPoint, state, gripType);
  }

  // viewport culling για grips - κερδίζουμε πολλά όταν έχουμε χιλιάδες
  private onScreen = (p: Point2D) => {
    const rect = this.ctx.canvas.getBoundingClientRect();
    return p.x >= 0 && p.y >= 0 && p.x <= rect.width && p.y <= rect.height;
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

    const colors = this.gripSettings?.colors ?? {
      cold: CAD_UI_COLORS.grips.cold,  // ✅ AutoCAD standard: Blue (ACI 5) - unselected grips
      warm: CAD_UI_COLORS.grips.warm,  // ✅ AutoCAD standard: Hot Pink - hover grips
      hot: CAD_UI_COLORS.grips.hot,   // ✅ AutoCAD standard: Red (ACI 1) - selected grips
      contour: CAD_UI_COLORS.grips.outline_color // ✅ AutoCAD standard: Black contour
    };

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
      const distance = calculateDistance(screenPoint, screenGrip);

      if (distance <= tolerance) {
        return grip;
      }
    }
    
    return null;
  }

  // New phase-based style setup
  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║ 🎨 AUTOCAD-LIKE CANVAS STATE RESET (2026-01-03)                        ║
  // ║                                                                        ║
  // ║ ΚΡΙΣΙΜΟ: Πλήρες reset του canvas state σε κάθε entity!                ║
  // ║ Αυτό αποτρέπει "πέπλο" και αλλοιωμένα χρώματα.                        ║
  // ║                                                                        ║
  // ║ Fixes:                                                                 ║
  // ║ - globalAlpha = 1 (χωρίς transparency)                                ║
  // ║ - globalCompositeOperation = 'source-over' (normal blending)          ║
  // ║ - setLineDash([]) (solid lines)                                       ║
  // ║ - lineCap = 'butt', lineJoin = 'miter' (standard CAD)                ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  protected setupStyle(entity: EntityModel, options: RenderOptions = {}): void {
    this.ctx.save();

    // 🎯 CRITICAL: Full canvas state reset for AutoCAD-like colors
    this.ctx.globalAlpha = OPACITY.OPAQUE; // 🏢 ADR-119: Centralized opacity
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.setLineDash([]);
    this.ctx.lineCap = 'butt';
    this.ctx.lineJoin = 'miter';

    // Determine current phase and apply appropriate styling
    const phaseState = this.phaseManager.determinePhase(entity as Entity, options);
    this.phaseManager.applyPhaseStyle(entity as Entity, phaseState);
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
    // 1. Determine current phase
    const phaseState = this.phaseManager.determinePhase(entity as Entity, options);
    
    // 2. Setup phase-appropriate style
    this.setupStyle(entity, options);
    
    // 3. Render geometry (always)
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
    // Draw grips if needed
    // ✅ ΚΡΙΣΙΜΗ ΔΙΟΡΘΩΣΗ: Επιτρέπουμε grips σε preview entities!
    if (options.grips) {
      this.renderGrips(entity);
    }

    // Cleanup
    this.cleanupStyle();
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
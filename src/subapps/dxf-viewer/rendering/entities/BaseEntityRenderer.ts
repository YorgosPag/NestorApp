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
import { calculateSplitLineGap } from './shared/line-utils';
import { DEFAULT_TOLERANCE } from '../../config/tolerance-config';
import { UI_COLORS } from '../../config/color-config';
// 🏢 ADR-044: Centralized Line Widths
// 🏢 ADR-048: Centralized Rendering Geometry (2027-01-27)
import { RENDER_LINE_WIDTHS, RENDER_GEOMETRY } from '../../config/text-rendering-config';
import { renderSquareGrip } from './shared/geometry-rendering-utils';
import { renderStyledTextWithOverride, getTextPreviewStyleWithOverride } from '../../hooks/useTextPreviewStyle';
import { getLinePreviewStyleWithOverride } from '../../hooks/useLinePreviewStyle';

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
   * Style για μετρήσεις διαστάσεων (δίπλα στα grips)
   * 🏢 ADR-048: Uses centralized DIMENSION_TEXT color (2027-01-27)
   */
  protected applyDimensionTextStyle(): void {
    this.ctx.fillStyle = UI_COLORS.DIMENSION_TEXT;  // 🏢 Centralized fuchsia color
    this.ctx.font = `${this.getBaseFontSize()}px Arial`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
  }

  /**
   * 🔺 ΚΕΝΤΡΙΚΟΠΟΙΗΜΈΝΟ ΧΡΏΜΑ DISTANCE TEXT - παίρνει styling από ρυθμίσεις κειμένου
   * Χρώμα για τα κείμενα αποστάσεων στη φάση προεπισκόπησης
   */
  protected applyDistanceTextStyle(): void {
    // Χρήση δυναμικού styling από τις ρυθμίσεις κειμένου
    const textStyle = getTextPreviewStyleWithOverride();
    this.ctx.fillStyle = textStyle.color;
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


  protected drawGrip(position: Point2D, state: 'cold' | 'warm' | 'hot', gripType?: string): void {
    const base = this.gripSettings?.gripSize || 10;
    const size = state === 'hot'  ? Math.round(base * 1.5)
               : state === 'warm' ? Math.round(base * 1.25)
                                  : Math.round(base);

    const colors = this.gripSettings?.colors ?? {
      cold: CAD_UI_COLORS.grips.cold,  // ✅ AutoCAD standard: Blue (ACI 5) - unselected grips
      warm: CAD_UI_COLORS.grips.warm,  // ✅ AutoCAD standard: Hot Pink - hover grips
      hot: CAD_UI_COLORS.grips.hot,   // ✅ AutoCAD standard: Red (ACI 1) - selected grips
      contour: CAD_UI_COLORS.grips.outline_color // ✅ AutoCAD standard: Black contour
    };
    
    // Διαφοροποίηση χρώματος ανάλογα με το gripType
    let baseColor = colors.cold; // Default για vertex grips
    if (gripType === 'edge') {
      // Χρησιμοποιούμε πράσινο χρώμα για edge/midpoint grips
      baseColor = UI_COLORS.GRIP_DEFAULT; // Πράσινο για μεσαία grips
    }
    
    const fill = state === 'hot'  ? colors.hot
               : state === 'warm' ? colors.warm
                                  : baseColor;

    renderSquareGrip(this.ctx, position, size, fill, UI_COLORS.GRIP_OUTLINE);
  }

  // Grip hit testing
  public findGripAtPoint(entity: EntityModel, screenPoint: Point2D, tolerance: number = DEFAULT_TOLERANCE): GripInfo | null {
    if (!this.gripSettings) return null;
    
    const grips = this.getGrips(entity);
    
    for (const grip of grips) {
      const screenGrip = this.worldToScreen(grip.position);
      const dx = screenPoint.x - screenGrip.x;
      const dy = screenPoint.y - screenGrip.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
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
    this.ctx.globalAlpha = 1.0;
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
    this.ctx.globalAlpha = 1.0;
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

  /**
   * 🔺 ΚΕΝΤΡΙΚΟΠΟΙΗΜΈΝΗ ΤΟΠΟΘΈΤΗΣΗ ΚΕΙΜΈΝΩΝ ΑΠΟΣΤΆΣΕΩΝ
   * Υπολογίζει τη θέση του κειμένου ΕΣΩΤΕΡΙΚΑ της γραμμής 
   * για να μη κρύβει το midpoint grip
   */
  protected calculateDistanceTextPosition(screenStart: Point2D, screenEnd: Point2D, offsetDistance: number = 15): Point2D {
    // Calculate line direction
    const dx = screenEnd.x - screenStart.x;
    const dy = screenEnd.y - screenStart.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length === 0) {
      return { x: screenStart.x, y: screenStart.y };
    }
    
    // Unit vectors for line direction and perpendicular
    const unitX = dx / length;
    const unitY = dy / length;
    const perpX = -unitY; // Perpendicular to the left
    const perpY = unitX;
    
    // Midpoint of the line
    const midX = (screenStart.x + screenEnd.x) / 2;
    const midY = (screenStart.y + screenEnd.y) / 2;
    
    // Offset the text position INSIDE the line (perpendicular offset)
    // Positive offset moves text to the "left" side of the line direction
    return {
      x: midX + perpX * offsetDistance,
      y: midY + perpY * offsetDistance
    };
  }

  /**
   * 🔺 ΚΕΝΤΡΙΚΟΠΟΙΗΜΈΝΗ ΜΈΘΟΔΟΣ INLINE DISTANCE TEXT ΓΙΑ ΠΡΟΕΠΙΣΚΌΠΗΣΗ
   * Σχεδιάζει το κείμενο απόστασης ΣΤΗΝ ΊΔΙΑ ΕΥΘΕΊΑ της γραμμής (όχι έκκεντρα)
   */
  protected renderInlineDistanceText(worldStart: Point2D, worldEnd: Point2D, screenStart: Point2D, screenEnd: Point2D): void {
    // Calculate midpoint (στο κέντρο της γραμμής - inline)
    const midX = (screenStart.x + screenEnd.x) / 2;
    const midY = (screenStart.y + screenEnd.y) / 2;
    const textPosition = { x: midX, y: midY };
    
    // Use common distance text rendering
    this.renderDistanceTextCommon(worldStart, worldEnd, screenStart, screenEnd, textPosition);
  }

  /**
   * 🔺 ΚΕΝΤΡΙΚΟΠΟΙΗΜΈΝΗ ΜΈΘΟΔΟΣ ΑΠΌΣΤΑΣΗΣ ΓΙΑ ΌΛΕΣ ΤΙΣ ΓΡΑΜΜΈΣ
   * Σχεδιάζει το κείμενο απόστασης με περιστροφή στο εσωτερικό της γραμμής
   */
  protected renderDistanceTextCentralized(worldStart: Point2D, worldEnd: Point2D, screenStart: Point2D, screenEnd: Point2D, offsetDistance: number = 15): void {
    // Get text position inside the line
    const textPos = this.calculateDistanceTextPosition(screenStart, screenEnd, offsetDistance);
    
    // Use common distance text rendering
    this.renderDistanceTextCommon(worldStart, worldEnd, screenStart, screenEnd, textPos);
  }

  /**
   * 🔺 ΚΕΝΤΡΙΚΟΠΟΙΗΜΈΝΗ ΜΈΘΟΔΟΣ DISTANCE TEXT ΜΕ PHASE-AWARE POSITIONING
   * Επιλέγει την κατάλληλη μέθοδος ανάλογα με τη φάση (inline για preview, offset για measurements)
   */
  protected renderDistanceTextPhaseAware(worldStart: Point2D, worldEnd: Point2D, screenStart: Point2D, screenEnd: Point2D, entity: EntityModel, options: RenderOptions): void {
    const phaseState = this.phaseManager.determinePhase(entity as Entity, options);
    
    if (phaseState.phase === 'preview') {
      // Στη φάση προεπισκόπησης: inline positioning (στην ίδια ευθεία)
      this.renderInlineDistanceText(worldStart, worldEnd, screenStart, screenEnd);
    } else {
      // Στις άλλες φάσεις: offset positioning (έκκεντρα)
      this.renderDistanceTextCentralized(worldStart, worldEnd, screenStart, screenEnd);
    }
  }

  /**
   * 🔺 ΚΕΝΤΡΙΚΟΠΟΙΗΜΈΝΟΣ ΈΛΕΓΧΟΣ SPLIT LINE
   * Καθορίζει αν μια οντότητα χρειάζεται split line με distance text
   */
  protected shouldRenderSplitLine(entity: EntityModel, options: RenderOptions = {}): boolean {
    // Αν είναι preview phase και έχει showEdgeDistances flag
    const phaseState = this.phaseManager.determinePhase(entity as Entity, options);
    const hasDistanceFlag = ('showEdgeDistances' in entity && entity.showEdgeDistances === true);

    return phaseState.phase === 'preview' && hasDistanceFlag;
  }

  /**
   * 🔺 ΚΕΝΤΡΙΚΟΠΟΙΗΜΈΝΟΣ ΈΛΕΓΧΟΣ ΓΡΑΜΜΏΝ - PHASE AWARE
   * Καθορίζει αν οι γραμμές είναι ενεργοποιημένες με υποστήριξη override
   */
  protected shouldRenderLines(entity: EntityModel, options: RenderOptions = {}): boolean {
    const phaseState = this.phaseManager.determinePhase(entity as Entity, options);

    const lineStyle = phaseState.phase === 'preview'
      ? getLinePreviewStyleWithOverride()
      : getLinePreviewStyleWithOverride(); // ✅ ΔΙΟΡΘΩΣΗ: Χρήση WithOverride και για NORMAL phase

    return lineStyle.enabled;
  }

  /**
   * 🔺 ΚΕΝΤΡΙΚΟΠΟΙΗΜΈΝΗ ΜΈΘΟΔΟΣ ΣΠΑΣΜΈΝΗΣ ΓΡΑΜΜΉΣ ΓΙΑ ΌΛΕΣ ΤΙΣ ΟΝΤΌΤΗΤΕΣ
   * Σχεδιάζει γραμμή με κενό στο κέντρο για distance text - για όλες τις οντότητες κατά την προεπισκόπηση
   * 🏢 ADR-048: Uses centralized SPLIT_LINE_GAP constant (2027-01-27)
   */
  protected renderSplitLineWithGap(screenStart: Point2D, screenEnd: Point2D, entity: EntityModel, options: RenderOptions = {}, gapSize: number = RENDER_GEOMETRY.SPLIT_LINE_GAP): void {
    const phaseState = this.phaseManager.determinePhase(entity as Entity, options);

    // ✅ PHASE AWARE: Χρήση WithOverride για preview phase
    const textStyle = phaseState.phase === 'preview'
      ? getTextPreviewStyleWithOverride()
      : getTextPreviewStyleWithOverride(); // ✅ ΔΙΟΡΘΩΣΗ: Χρήση WithOverride και για NORMAL phase

    if (textStyle.enabled) {
      // Κείμενο ενεργοποιημένο: γραμμή με κενό
      // Use shared gap calculation logic
      const { gapStart, gapEnd } = calculateSplitLineGap(screenStart, screenEnd, gapSize);

      // Draw split line with gap for text
      this.ctx.beginPath();
      this.ctx.moveTo(screenStart.x, screenStart.y);
      this.ctx.lineTo(gapStart.x, gapStart.y);
      this.ctx.stroke();

      this.ctx.beginPath();
      this.ctx.moveTo(gapEnd.x, gapEnd.y);
      this.ctx.lineTo(screenEnd.x, screenEnd.y);
      this.ctx.stroke();
    } else {
      // Κείμενο απενεργοποιημένο: συνεχόμενη γραμμή
      this.ctx.beginPath();
      this.ctx.moveTo(screenStart.x, screenStart.y);
      this.ctx.lineTo(screenEnd.x, screenEnd.y);
      this.ctx.stroke();
    }
  }

  /**
   * 🔺 ΚΕΝΤΡΙΚΟΠΟΙΗΜΈΝΟ ΣΤΙΛ ΤΌΞΩΝ - πορτοκαλί χρώμα με διακεκομμένες γραμμές
   */
  protected applyArcStyle(): void {
    this.ctx.strokeStyle = UI_COLORS.DRAWING_TEMP; // Πορτοκαλί χρώμα
    this.ctx.setLineDash([3, 3]); // Διακεκομμένες γραμμές
    this.ctx.lineWidth = RENDER_LINE_WIDTHS.THIN; // 🏢 ADR-044
  }

  /**
   * 🔺 ΚΕΝΤΡΙΚΟΠΟΙΗΜΈΝΗ ΜΈΘΟΔΟΣ ΣΧΕΔΊΑΣΗΣ ΤΌΞΩΝ
   * - Πάντοτε ΕΣΩΤΕΡΙΚΆ τόξα (μικρότερη γωνία)
   * - Πάντα ορατά στη φάση προεπισκόπησης
   * - Για όλες τις οντότητες (σχεδίασης & μέτρησης)
   */
    // 🔺 ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΗ ΜΕΘΟΔΟΣ ΓΙΑ ΚΥΚΛΑ/ΤΟΞΑ (χωρίς γωνίες)
  protected drawCentralizedArc(
    centerX: number, 
    centerY: number, 
    radius: number, 
    startAngle: number, 
    endAngle: number
  ): void {
    this.ctx.save();
    this.applyArcStyle();
    
    const screenCenter = this.worldToScreen({ x: centerX, y: centerY });
    const screenRadius = radius * this.transform.scale;
    
    // Για κύκλα/τόξα χωρίς γωνίες, χρησιμοποιούμε απλή λογική
    // 🔧 FIX (2026-01-31): Use ellipse() instead of arc() - arc() has rendering bug!
    this.ctx.beginPath();
    this.ctx.ellipse(screenCenter.x, screenCenter.y, screenRadius, screenRadius, 0, startAngle, endAngle, false);
    this.ctx.stroke();
    
    this.ctx.restore();
  }

  /**
   * Common distance text rendering setup - eliminates duplication
   */
  private renderDistanceTextCommon(
    worldStart: Point2D, 
    worldEnd: Point2D, 
    screenStart: Point2D, 
    screenEnd: Point2D,
    textPosition: Point2D
  ): void {
    // Calculate world distance
    const worldDistance = Math.sqrt(
      Math.pow(worldEnd.x - worldStart.x, 2) + Math.pow(worldEnd.y - worldStart.y, 2)
    );
    
    // Calculate line angle for text rotation
    const dx = screenEnd.x - screenStart.x;
    const dy = screenEnd.y - screenStart.y;
    const angle = Math.atan2(dy, dx);
    
    // Format distance text
    const text = worldDistance.toFixed(2);
    
    // Save context for rotation
    this.ctx.save();
    
    // Move to text position and rotate
    this.ctx.translate(textPosition.x, textPosition.y);
    
    // Rotate text to be readable (don't flip upside down)
    let textAngle = angle;
    if (Math.abs(textAngle) > Math.PI / 2) {
      textAngle += Math.PI;
    }
    this.ctx.rotate(textAngle);
    
    // Apply distance text styling - χρήση δυναμικού styling με πλήρη υποστήριξη decorations
    this.applyDistanceTextStyle();
    renderStyledTextWithOverride(this.ctx, text, 0, 0);
    
    // Restore context
    this.ctx.restore();
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


  // 🔺 ΚΟΙΝΕΣ ΜΕΘΟΔΟΙ ΓΙΑ ΤΟΞΑ ΓΩΝΙΩΝ - Χρησιμοποιούνται από Rectangle, Polyline, AngleMeasurement
  // Χρήση ακριβούς λογικής από TODO.md με dot product για σωστή επιλογή τεταρτημορίου
  protected renderAngleAtVertex(
    prevVertex: Point2D, 
    currentVertex: Point2D, 
    nextVertex: Point2D,
    prevScreen: Point2D,
    currentScreen: Point2D,
    nextScreen: Point2D,
    arcRadius: number = 30, // Μεγαλύτερη default τιμή
    labelOffset: number = 15
  ): void {
    // Calculate unit vectors in world coordinates
    const toPrev = {
      x: prevVertex.x - currentVertex.x,
      y: prevVertex.y - currentVertex.y
    };
    const toNext = {
      x: nextVertex.x - currentVertex.x,  
      y: nextVertex.y - currentVertex.y
    };
    
    // Normalize vectors
    const prevLength = Math.sqrt(toPrev.x * toPrev.x + toPrev.y * toPrev.y);
    const nextLength = Math.sqrt(toNext.x * toNext.x + toNext.y * toNext.y);
    
    if (prevLength === 0 || nextLength === 0) return;
    
    const prevUnit = { x: toPrev.x / prevLength, y: toPrev.y / prevLength };
    const nextUnit = { x: toNext.x / nextLength, y: toNext.y / nextLength };
    
    // Calculate angle in degrees for label
    const angle1 = Math.atan2(prevUnit.y, prevUnit.x);
    const angle2 = Math.atan2(nextUnit.y, nextUnit.x);
    let angleDiff = angle2 - angle1;
    if (angleDiff < 0) angleDiff += 2 * Math.PI;
    if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
    const degrees = (angleDiff * 180) / Math.PI;
    
    // 🔺 ΕΦΑΡΜΟΓΗ ΑΚΡΙΒΟΥΣ ΛΟΓΙΚΗΣ ΑΠΟ TODO.MD
    this.drawInternalArc(currentVertex, prevUnit, nextUnit, arcRadius);
    
    // Calculate label position using bisector
    const bisectorAngle = (angle1 + angle2) / 2;
    const rTextPx = Math.max(arcRadius * 0.66, 6);
    const rWorld = rTextPx / this.transform.scale;
    
    const worldLabelX = currentVertex.x + Math.cos(bisectorAngle) * rWorld;
    const worldLabelY = currentVertex.y + Math.sin(bisectorAngle) * rWorld;
    const screenLabel = this.worldToScreen({ x: worldLabelX, y: worldLabelY });
    
    // Draw label
    this.ctx.save();
    this.applyArcStyle();
    this.ctx.fillStyle = this.ctx.strokeStyle;
    this.ctx.font = `${this.getBaseFontSize()}px Arial`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    
    const angleText = `${degrees.toFixed(1)}°`;
    // Χρήση δυναμικού styling με πλήρη υποστήριξη decorations
    renderStyledTextWithOverride(this.ctx, angleText, screenLabel.x, screenLabel.y);
    this.ctx.restore();
  }

  // 🔺 ΑΚΡΙΒΗΣ ΥΛΟΠΟΙΗΣΗ ΑΠΟ TODO.MD - Λογική με dot product για σωστή επιλογή τεταρτημορίου
  private drawInternalArc(
    vertex: Point2D,
    prevUnit: Point2D,
    nextUnit: Point2D,
    rPx: number
  ): void {
    const v = this.worldToScreen(vertex);
    
    // Υπολογισμός centerUnit (διάνυσμα προς το εσωτερικό της γωνίας)
    const bisectorX = (prevUnit.x + nextUnit.x) / 2;
    const bisectorY = (prevUnit.y + nextUnit.y) / 2;
    const bisectorLength = Math.sqrt(bisectorX * bisectorX + bisectorY * bisectorY);
    
    let centerUnit = { x: 0, y: 0 };
    if (bisectorLength > 0) {
      centerUnit = { x: bisectorX / bisectorLength, y: bisectorY / bisectorLength };
    }
    
    // Μετατροπή σε screen-space (flip Y)
    const u1 = { x: prevUnit.x, y: -prevUnit.y };
    const u2 = { x: nextUnit.x, y: -nextUnit.y };
    const c = { x: centerUnit.x, y: -centerUnit.y };
    
    // Normalize center προς τα μέσα
    const centerLength = Math.sqrt(c.x * c.x + c.y * c.y) || 1;
    const cNorm = { x: c.x / centerLength, y: c.y / centerLength };
    
    const a1 = Math.atan2(u1.y, u1.x);
    const a2 = Math.atan2(u2.y, u2.x);
    
    const norm = (t: number) => (t % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    const dCCW = norm(a2 - a1);
    const dCW = 2 * Math.PI - dCCW;
    
    const midCCW = a1 + dCCW / 2;
    const midCW = a1 - dCW / 2;
    
    const dot = (ax: number, ay: number, bx: number, by: number) => ax * bx + ay * by;
    const useCCW = dot(Math.cos(midCCW), Math.sin(midCCW), cNorm.x, cNorm.y) >
                   dot(Math.cos(midCW), Math.sin(midCW), cNorm.x, cNorm.y);
    
    this.ctx.save();
    this.applyArcStyle();
    this.ctx.beginPath();
    // 🔧 FIX (2026-01-31): Use ellipse() instead of arc() - arc() has rendering bug!
    this.ctx.ellipse(v.x, v.y, rPx, rPx, 0, a1, a2, useCCW);
    this.ctx.stroke();
    this.ctx.restore();
  }

}
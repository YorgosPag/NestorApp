/**
 * Phase Manager - Universal Entity Rendering Phase Control
 * Centralized logic for the 3-phase rendering system:
 * Phase 1: Preview (blue dashed, measurements, yellow dots)
 * Phase 2: Normal (white solid, authentic style)
 * Phase 3: Interactive (3a-Hover: white dashed, 3b-Selected: white solid)
 *
 * Also handles grip interaction states:
 * - Cold (blue): Normal grip state
 * - Warm (orange): Grip hovered
 * - Hot (red): Grip selected/dragging with real-time measurements
 */

// DEBUG FLAG - Set to false to disable performance-heavy logging
const DEBUG_PHASE_MANAGER = true; // ✅ ΕΝΕΡΓΟΠΟΙΗΣΗ για testing

import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import { renderStyledText, renderStyledTextWithOverride } from '../../hooks/useTextPreviewStyle';
import { getGripPreviewStyleWithOverride } from '../../hooks/useGripPreviewStyle';
import type { Entity } from '../../types/entities';
import type { GripInfo } from '../../rendering/types/Types';
import { UI_COLORS } from '../../config/color-config';
import type { RenderOptions } from '../../rendering/types/Types';
import type { GripSettings } from '../../types/gripSettings';
import { CAD_UI_COLORS } from '../../config/color-config';
import { createRectangleVertices } from '../selection/shared/selection-duplicate-utils';
import { renderSquareGrip } from '../../rendering/entities/shared/geometry-rendering-utils';
import { toolStyleStore } from '../../stores/ToolStyleStore';
import { getLinePreviewStyleWithOverride } from '../../hooks/useLinePreviewStyle';

// ✅ ENTERPRISE FIX: Export GripInfo for external usage
export type { GripInfo } from '../../rendering/types/Types';

// Local interface definitions
export interface PhaseManagerOptions {
  ctx: CanvasRenderingContext2D;
  transform: { scale: number; offsetX: number; offsetY: number };
  worldToScreen: (point: Point2D) => Point2D;
}

export interface PhaseRenderingState {
  phase: 'normal' | 'preview' | 'measurement';
  isActive: boolean;
  priority: number;
  context: {
    fromEntity?: boolean;
    fromDrawing?: boolean;
    hasPreview?: boolean;
    hasMeasurement?: boolean;
    hasOverlayPreview?: boolean;
  };
  gripState?: {
    hoveredGrip?: { entityId: string; gripIndex: number };
    selectedGrip?: { entityId: string; gripIndex: number };
    dragginGrip?: { entityId: string; gripIndex: number };
  };
}
// 🗑️ REMOVED: getLineCompletionStyle - δεν χρειάζεται πια

// Helper function to render measurements (eliminates code duplication)
function renderMeasurementText(
  ctx: CanvasRenderingContext2D,
  screenCenter: Point2D,
  measurements: { label: string; value: number; unit?: string }[]
) {
  ctx.save();
  ctx.fillStyle = UI_COLORS.WHITE; // ⚡ WHITE FOR LIVE MEASUREMENTS
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  measurements.forEach((measurement, index) => {
    const yOffset = screenCenter.y - (measurements.length - 1 - index) * 20;
    const text = `${measurement.label}: ${measurement.value.toFixed(measurement.unit === '°' ? 1 : 2)}${measurement.unit || ''}`;
    // Χρήση δυναμικού styling με πλήρη υποστήριξη decorations
    renderStyledText(ctx, text, screenCenter.x, yOffset);
  });
  
  ctx.restore();
}

export class PhaseManager {
  private ctx: CanvasRenderingContext2D;
  private transform: { scale: number; offsetX: number; offsetY: number };
  private worldToScreen: (point: Point2D) => Point2D;
  private gripSettings?: GripSettings;
  
  constructor(options: PhaseManagerOptions) {
    this.ctx = options.ctx;
    this.transform = options.transform;
    this.worldToScreen = options.worldToScreen;
  }

  /**
   * Main method to determine and apply rendering phase
   */
  determinePhase(entity: Entity, options: RenderOptions = {}): PhaseRenderingState {
    // ✅ ΚΡΙΣΙΜΗ ΔΙΟΡΘΩΣΗ: Έλεγχος για preview entity από το entity flag
    if (options.preview || entity.preview === true) {
      return {
        phase: 'preview',
        isActive: true,
        priority: 1,
        context: { fromEntity: true, hasPreview: true }
      };
    }

    if (options.hovered || options.selected) {
      // Interactive phase with sub-states
      const subState = options.hovered ? 'hover' : 'selected';

      return {
        phase: options.hovered ? 'preview' : 'normal', // ✅ FIX: Use valid phase values
        isActive: true,
        priority: options.selected ? 3 : 2,
        context: {
          fromEntity: true,
          hasPreview: options.hovered,
        },
        gripState: this.getGripState(entity)
      };
    }

    return {
      phase: 'normal',
      isActive: true,
      priority: 0,
      context: { fromEntity: true }
    };
  }

  /**
   * Apply phase-specific styling to canvas context
   */
  applyPhaseStyle(entity: Entity, state: PhaseRenderingState): void {
    // ALWAYS reset line dash first to prevent "sticking"
    this.ctx.setLineDash([]);
    
    switch (state.phase) {
      case 'preview':
        // Phase 1: Custom line style από preview settings ή overlay colors
        // Note: lineWidth και setLineDash θα οριστούν παρακάτω ανάλογα με το entity type

        // 🔺 ΔΙΟΡΘΩΣΗ: Χρήση ToolStyleStore χρωμάτων για overlay/layering entities μόνο
        const isOverlayEntity = entity.isOverlayPreview === true;

        if (isOverlayEntity) {
          const toolStyle = toolStyleStore.get();

          this.ctx.strokeStyle = toolStyle.strokeColor || UI_COLORS.SUCCESS_GREEN;
          this.ctx.fillStyle = toolStyle.fillColor || UI_COLORS.SEMI_TRANSPARENT_RED; // Semi-transparent fill
          this.ctx.lineWidth = toolStyle.lineWidth || 2;
          this.ctx.setLineDash([5, 5]); // Overlay entities keep dashed style
        } else {
          // ✅ ΔΙΟΡΘΩΣΗ: Χρήση ρυθμίσεων προσχεδίασης με έλεγχο checkbox "Παράκαμψη Γενικών"
          const previewStyle = getLinePreviewStyleWithOverride();

          this.ctx.strokeStyle = previewStyle.strokeColor;
          this.ctx.lineWidth = previewStyle.lineWidth;
          this.ctx.globalAlpha = previewStyle.opacity;
          this.ctx.setLineDash(previewStyle.lineDash); // Use custom line dash from settings
          // No fill for regular DXF previews
        }
        break;
        
      case 'normal':
        // 🔧 ΔΙΟΡΘΩΣΗ: Χρησιμοποίησε γενικές ρυθμίσεις αντί για completion settings
        // ✅ ΔΙΟΡΘΩΣΗ: Χρήση WithOverride και για NORMAL phase!
        const generalStyleForNormal = getLinePreviewStyleWithOverride();
        if (generalStyleForNormal.enabled) {
          this.ctx.lineWidth = generalStyleForNormal.lineWidth;  // Ίδιο πάχος με γενικές ρυθμίσεις
          this.ctx.setLineDash([]);  // Αλλά solid γραμμή (όχι dashed)
          this.ctx.strokeStyle = generalStyleForNormal.strokeColor;  // Ίδιο χρώμα με γενικές ρυθμίσεις
          this.ctx.globalAlpha = generalStyleForNormal.opacity;  // Ίδια διαφάνεια

        } else {
          // Αν disabled, χρησιμοποίησε transparent styling για να μην φαίνεται
          this.ctx.globalAlpha = 0;
        }
        break;
        
      case 'measurement':
        // ✅ FIX: Handle measurement phase
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([]);
        this.ctx.strokeStyle = UI_COLORS.WHITE;
        break;
    }
  }

  /**
   * Render measurements based on phase requirements
   * 🔺 MEASUREMENT ENTITIES: Always show measurements in all phases
   */
  shouldRenderMeasurements(state: PhaseRenderingState, entity?: Entity): boolean {
    // For measurement entities, ALWAYS show measurements
    if (entity && this.isMeasurementEntity(entity)) {
      return true;
    }
    
    // For normal entities, show measurements during preview, hover, or dragging
    return state.phase === 'preview' ||
           (state.phase === 'measurement') ||
           (state.gripState?.dragginGrip !== undefined);
  }

  /**
   * Render colored dots for preview phase and measurement entities
   * 🔺 MEASUREMENT ENTITIES: Always show dots in all phases
   */
  shouldRenderYellowDots(state: PhaseRenderingState, entity?: Entity): boolean {
    // For measurement entities, ALWAYS show dots
    if (entity && this.isMeasurementEntity(entity)) {
      return true;
    }
    
    // For normal entities, show dots only during preview phase (ORIGINAL BEHAVIOR)
    return state.phase === 'preview';
  }

  /**
   * Get appropriate dot color based on entity type and phase
   * 🔺 ΚΕΝΤΡΙΚΟΠΟΙΗΜΈΝΟ ΧΡΏΜΑ ΒΟΥΛΙΤΣΩΝ - μία αλλαγή εδώ αλλάζει όλα
   */
  getPreviewDotColor(entity?: Entity): string {
    // 🔺 Κίτρινο χρώμα για όλες τις οντότητες κατά την προεπισκόπηση - κεντρικοποιημένη λογική
    return UI_COLORS.YELLOW; // Κίτρινο για όλες τις οντότητες στη φάση προεπισκόπησης
  }

  /**
   * Check if entity is a measurement entity
   */
  private isMeasurementEntity(entity: Entity): boolean {
    return entity.measurement === true ||
           entity.type === 'angle-measurement' ||
           entity.type === 'dimension';
  }

  /**
   * Render grips with phase-appropriate colors
   * ⚠️ ΠΡΟΣΩΡΙΝΗ ΑΠΕΝΕΡΓΟΠΟΙΗΣΗ ΓΙΑ TESTING
   */
  renderPhaseGrips(entity: Entity, grips: GripInfo[], state: PhaseRenderingState): void {
    // ✅ ΕΝΕΡΓΟΠΟΙΗΜΕΝΟ: Εμφάνιση grips στην προσχεδίαση
    // ✅ ΕΝΗΜΕΡΩΣΗ: Επιτρέπουμε preview grips όταν έχουν το flag showPreviewGrips
    if (state.phase === 'preview' && !entity.showPreviewGrips) {
      return; // No grips during preview unless explicitly enabled
    }

    // ✅ ΝΕΟ! Για preview entities, χρησιμοποιούμε τα previewGripPoints αν υπάρχουν
    if (state.phase === 'preview' && entity.previewGripPoints) {
      const previewGrips = entity.previewGripPoints;
      for (let i = 0; i < previewGrips.length; i++) {
        const gripPoint = previewGrips[i];
        const screenPos = this.worldToScreen(gripPoint);

        // Preview grips χρησιμοποιούν το κρύο χρώμα από τις ρυθμίσεις
        this.drawPhaseGrip(screenPos, 'cold', state, undefined);
      }
      return;
    }

    for (let i = 0; i < grips.length; i++) {
      const grip = grips[i];
      const screenPos = this.worldToScreen(grip.position);

      // Determine grip color based on interaction state
      const gripColor = this.getGripColor(entity.id, i, state);

      this.drawPhaseGrip(screenPos, gripColor, state, grip.type);
    }
  }

  /**
   * Get appropriate grip color based on current phase and interaction state
   */
  private getGripColor(entityId: string, gripIndex: number, state: PhaseRenderingState): 'cold' | 'warm' | 'hot' {
    const gripState = state.gripState;
    
    if (!gripState) return 'cold';
    
    // Hot (red) - Active/dragging grip
    if (gripState.dragginGrip?.entityId === entityId &&
        gripState.dragginGrip?.gripIndex === gripIndex) {
      return 'hot';
    }

    // Warm (orange) - Hovered grip
    if (gripState.hoveredGrip?.entityId === entityId &&
        gripState.hoveredGrip?.gripIndex === gripIndex) {
      return 'warm';
    }
    
    // Cold (blue) - Normal grip
    return 'cold';
  }

  /**
   * Draw grip with appropriate color
   */
  private drawPhaseGrip(position: Point2D, colorState: 'cold' | 'warm' | 'hot', state: PhaseRenderingState, gripType?: string): void {
    // ✅ ΑΛΛΑΓΗ: Χρησιμοποιούμε το σωστό grip style hook ανάλογα με το phase
    const gripStyle = state.phase === 'preview'
      ? getGripPreviewStyleWithOverride()
      : getGripPreviewStyleWithOverride(); // ✅ ΔΙΟΡΘΩΣΗ: Χρήση WithOverride και για NORMAL phase
    const baseSize = gripStyle.gripSize;
    const size = colorState === 'hot' ? Math.round(baseSize * 1.5)
               : colorState === 'warm' ? Math.round(baseSize * 1.25)
                                       : Math.round(baseSize);

    // ✅ ΑΛΛΑΓΗ: Χρησιμοποιούμε χρώματα από το grip style hook (ίδια λογική με γραμμές/κείμενο)
    const colors = gripStyle.colors;

    let fillColor: string;
    if (gripType === 'edge') {
      // Edge/midpoint grips use specific colors
      fillColor = colorState === 'hot' ? colors.hot
                : colorState === 'warm' ? colors.warm
                                        : UI_COLORS.SUCCESS_BRIGHT;    // Green for edge grips (special case)

    } else {
      // Vertex grips use standard grip colors
      fillColor = colorState === 'hot' ? colors.hot
                : colorState === 'warm' ? colors.warm
                                        : colors.cold;

    }

    renderSquareGrip(this.ctx, position, size, fillColor);
  }

  /**
   * Get current grip state (to be extended with actual grip interaction logic)
   */
  private getGripState(entity: Entity): PhaseRenderingState['gripState'] {
    // TODO: This will be connected to actual grip interaction system
    // For now, return empty state
    return undefined;
  }

  /**
   * Render real-time measurements during grip dragging
   */
  renderDragMeasurements(entity: Entity, draggedGripIndex: number, currentPosition: Point2D): void {
    // This will render live distance/angle/area measurements while dragging
    // Implementation depends on entity type
    switch (entity.type) {
      case 'line':
        this.renderLineDragMeasurements(entity, draggedGripIndex, currentPosition);
        break;
      case 'circle':
        this.renderCircleDragMeasurements(entity, draggedGripIndex, currentPosition);
        break;
      case 'rectangle':
      // 'rect' is not a valid EntityType, removing
      // case 'rect':
      //   this.renderRectangleDragMeasurements(entity, draggedGripIndex, currentPosition);
      //   break;
      case 'arc':
        this.renderArcDragMeasurements(entity, draggedGripIndex, currentPosition);
        break;
      case 'polyline':
        this.renderPolylineDragMeasurements(entity, draggedGripIndex, currentPosition);
        break;
      // 'ellipse' is not a valid EntityType, removing
      // case 'ellipse':
      //   this.renderEllipseDragMeasurements(entity, draggedGripIndex, currentPosition);
      //   break;
    }
  }

  /**
   * Render live measurements for line during grip drag
   */
  private renderLineDragMeasurements(entity: Entity, gripIndex: number, currentPos: Point2D): void {
    if (entity.type !== 'line') return;
    const start = entity.start;
    const end = entity.end;
    
    let newStart = start, newEnd = end;
    if (gripIndex === 0) newStart = currentPos;
    if (gripIndex === 1) newEnd = currentPos;
    
    const distance = Math.sqrt(
      Math.pow(newEnd.x - newStart.x, 2) + Math.pow(newEnd.y - newStart.y, 2)
    );
    
    // Render live distance with intelligent positioning
    const screenCurrentPos = this.worldToScreen(currentPos);
    const canvasWidth = this.ctx.canvas.width;
    const canvasHeight = this.ctx.canvas.height;
    
    this.ctx.save();

    this.ctx.fillStyle = UI_COLORS.SELECTED_RED; // Red for live measurements
    this.ctx.font = '12px Arial';
    this.ctx.textBaseline = 'middle';
    
    // Smart positioning for line measurements
    let measurementX = screenCurrentPos.x + 20;
    let measurementY = screenCurrentPos.y - 10;
    let textAlign: CanvasTextAlign = 'left';
    
    // If too close to right edge, show on left side
    if (measurementX + 80 > canvasWidth) {
      measurementX = screenCurrentPos.x - 20;
      textAlign = 'right';
    }
    
    // If too close to top or bottom, adjust
    if (measurementY < 15) {
      measurementY = screenCurrentPos.y + 20;
    } else if (measurementY > canvasHeight - 15) {
      measurementY = screenCurrentPos.y - 30;
    }
    
    this.ctx.textAlign = textAlign;
    // Χρήση δυναμικού styling με πλήρη υποστήριξη decorations
    renderStyledText(this.ctx, `Α: ${distance.toFixed(2)}`, measurementX, measurementY);
    this.ctx.restore();
  }

  /**
   * Render live measurements for circle during grip drag
   */
  private renderCircleDragMeasurements(entity: Entity, gripIndex: number, currentPos: Point2D): void {
    if (entity.type !== 'circle') return;
    const center = entity.center;
    const originalRadius = entity.radius;
    
    // Calculate new radius based on dragged position
    const newRadius = Math.sqrt(
      Math.pow(currentPos.x - center.x, 2) + Math.pow(currentPos.y - center.y, 2)
    );
    
    // Render live measurements with intelligent positioning
    const screenCurrentPos = this.worldToScreen(currentPos);
    const canvasWidth = this.ctx.canvas.width;
    const canvasHeight = this.ctx.canvas.height;
    
    // Render live measurements
    this.ctx.save();

    this.ctx.fillStyle = UI_COLORS.SELECTED_RED; // Red for live measurements
    this.ctx.font = '12px Arial';
    this.ctx.textBaseline = 'middle';
    
    // Smart positioning for circle measurements
    let measurementX = screenCurrentPos.x + 20;
    let measurementY = screenCurrentPos.y;
    let textAlign: CanvasTextAlign = 'left';
    
    // If too close to right edge, show on left side
    if (measurementX + 120 > canvasWidth) {
      measurementX = screenCurrentPos.x - 20;
      textAlign = 'right';
    }
    
    // If too close to bottom, move up
    if (measurementY + 60 > canvasHeight) {
      measurementY = screenCurrentPos.y - 20;
    }
    
    // If too close to top, move down  
    if (measurementY - 30 < 0) {
      measurementY = screenCurrentPos.y + 60;
    }
    
    this.ctx.textAlign = textAlign;
    
    // Live measurements with Greek characters - χρήση δυναμικού styling
    renderStyledText(this.ctx, `Ρ: ${newRadius.toFixed(2)}`, measurementX, measurementY - 30);
    renderStyledText(this.ctx, `Δ: ${(newRadius * 2).toFixed(2)}`, measurementX, measurementY - 10);

    // Live area
    const area = Math.PI * newRadius * newRadius;
    renderStyledText(this.ctx, `Ε: ${area.toFixed(2)}`, measurementX, measurementY + 10);

    // Live circumference
    const circumference = 2 * Math.PI * newRadius;
    renderStyledText(this.ctx, `Περ: ${circumference.toFixed(2)}`, measurementX, measurementY + 30);
    
    this.ctx.restore();
  }

  /**
   * Render live measurements for rectangle during grip drag
   */
  private renderRectangleDragMeasurements(entity: Entity, gripIndex: number, currentPos: Point2D): void {
    if (entity.type !== 'rectangle') return;

    // Get vertices from rectangle entity properties
    const vertices = createRectangleVertices(
      { x: entity.x, y: entity.y },
      { x: entity.x + entity.width, y: entity.y + entity.height }
    );
    
    if (vertices.length < 4) return;
    
    // Create new vertices with dragged grip position
    const newVertices = [...vertices];
    
    // Determine which vertex/edge grip is being dragged
    if (gripIndex < 4) {
      // Corner grip - update that specific vertex
      newVertices[gripIndex] = currentPos;
      
      // For rectangle, we need to maintain rectangular shape
      // Update adjacent vertices to keep rectangle properties
      if (gripIndex === 0) { // Top-left
        newVertices[1] = { x: newVertices[2].x, y: currentPos.y };
        newVertices[3] = { x: currentPos.x, y: newVertices[2].y };
      } else if (gripIndex === 1) { // Top-right  
        newVertices[0] = { x: newVertices[3].x, y: currentPos.y };
        newVertices[2] = { x: currentPos.x, y: newVertices[3].y };
      } else if (gripIndex === 2) { // Bottom-right
        newVertices[1] = { x: currentPos.x, y: newVertices[0].y };
        newVertices[3] = { x: newVertices[0].x, y: currentPos.y };
      } else if (gripIndex === 3) { // Bottom-left
        newVertices[0] = { x: currentPos.x, y: newVertices[1].y };
        newVertices[2] = { x: newVertices[1].x, y: currentPos.y };
      }
    } else {
      // Edge grip - move entire edge
      const edgeIndex = gripIndex - 4;
      const nextEdge = (edgeIndex + 1) % 4;
      
      // Calculate which direction to move the edge
      if (edgeIndex === 0) { // Top edge
        newVertices[0].y = newVertices[1].y = currentPos.y;
      } else if (edgeIndex === 1) { // Right edge  
        newVertices[1].x = newVertices[2].x = currentPos.x;
      } else if (edgeIndex === 2) { // Bottom edge
        newVertices[2].y = newVertices[3].y = currentPos.y;
      } else if (edgeIndex === 3) { // Left edge
        newVertices[3].x = newVertices[0].x = currentPos.x;
      }
    }
    
    // Calculate new dimensions
    const width = Math.abs(newVertices[1].x - newVertices[0].x);
    const height = Math.abs(newVertices[2].y - newVertices[1].y);
    const area = width * height;
    const perimeter = 2 * (width + height);
    
    // Calculate intelligent position for measurements near the dragged grip
    const screenGripPos = this.worldToScreen(currentPos);
    const canvasWidth = this.ctx.canvas.width;
    const canvasHeight = this.ctx.canvas.height;
    
    // Render live measurements near the grip being dragged
    this.ctx.save();

    this.ctx.fillStyle = UI_COLORS.SELECTED_RED; // Red for live measurements
    this.ctx.font = '12px Arial';
    
    // Smart positioning - avoid screen edges and grip overlap
    let measurementX = screenGripPos.x + 20; // Start 20px right of grip
    let measurementY = screenGripPos.y;
    let textAlign: CanvasTextAlign = 'left';
    
    // If too close to right edge, show on left side
    if (measurementX + 120 > canvasWidth) {
      measurementX = screenGripPos.x - 20;
      textAlign = 'right';
    }
    
    // If too close to bottom, move up
    if (measurementY + 60 > canvasHeight) {
      measurementY = screenGripPos.y - 20;
    }
    
    // If too close to top, move down  
    if (measurementY - 30 < 0) {
      measurementY = screenGripPos.y + 60;
    }
    
    this.ctx.textAlign = textAlign;
    this.ctx.textBaseline = 'middle';
    
    // Live measurements with Greek characters - χρήση δυναμικού styling
    renderStyledText(this.ctx, `Π: ${width.toFixed(2)}`, measurementX, measurementY - 30);
    renderStyledText(this.ctx, `Υ: ${height.toFixed(2)}`, measurementX, measurementY - 10);
    renderStyledText(this.ctx, `Ε: ${area.toFixed(2)}`, measurementX, measurementY + 10);
    renderStyledText(this.ctx, `Περ: ${perimeter.toFixed(2)}`, measurementX, measurementY + 30);
    
    this.ctx.restore();
  }

  /**
   * Render live measurements for arc during grip drag
   */
  private renderArcDragMeasurements(entity: Entity, gripIndex: number, currentPos: Point2D): void {
    if (entity.type !== 'arc') return;
    const center = entity.center;
    const radius = entity.radius;
    const startAngle = entity.startAngle;
    const endAngle = entity.endAngle;
    
    if (!center || !radius) return;
    
    // Calculate new values based on grip being dragged
    let newRadius = radius;
    let newStartAngle = startAngle;
    let newEndAngle = endAngle;
    
    if (gripIndex === 0) {
      // Center grip - no change to measurements
      return;
    } else if (gripIndex === 1) {
      // Start point grip
      const dx = currentPos.x - center.x;
      const dy = currentPos.y - center.y;
      newRadius = Math.sqrt(dx * dx + dy * dy);
      newStartAngle = Math.atan2(dy, dx) * 180 / Math.PI;
    } else if (gripIndex === 2) {
      // End point grip
      const dx = currentPos.x - center.x;
      const dy = currentPos.y - center.y;
      newRadius = Math.sqrt(dx * dx + dy * dy);
      newEndAngle = Math.atan2(dy, dx) * 180 / Math.PI;
    } else if (gripIndex === 3) {
      // Radius grip - change radius only
      const dx = currentPos.x - center.x;
      const dy = currentPos.y - center.y;
      newRadius = Math.sqrt(dx * dx + dy * dy);
    }
    
    // Calculate measurements
    const arcAngle = Math.abs(newEndAngle - newStartAngle);
    const arcLength = (arcAngle * Math.PI / 180) * newRadius;
    
    const screenCenter = this.worldToScreen(center);
    
    // Render live measurements
    renderMeasurementText(this.ctx, screenCenter, [
      { label: 'R', value: newRadius },
      { label: '∠', value: arcAngle, unit: '°' },
      { label: 'L', value: arcLength }
    ]);
  }

  /**
   * Render live measurements for polyline during grip drag
   */
  private renderPolylineDragMeasurements(entity: Entity, gripIndex: number, currentPos: Point2D): void {
    if (entity.type !== 'polyline') return;
    const vertices = entity.vertices || [];
    if (vertices.length < 2 || gripIndex >= vertices.length) return;

    const newVertices = [...vertices];
    newVertices[gripIndex] = currentPos;

    // Calculate total length
    let totalLength = 0;
    for (let i = 0; i < newVertices.length - 1; i++) {
      const dx = newVertices[i + 1].x - newVertices[i].x;
      const dy = newVertices[i + 1].y - newVertices[i].y;
      totalLength += Math.sqrt(dx * dx + dy * dy);
    }

    // Calculate area if closed
    let area = 0;
    if (entity.closed && newVertices.length >= 3) {
      // Shoelace formula
      for (let i = 0; i < newVertices.length; i++) {
        const j = (i + 1) % newVertices.length;
        area += newVertices[i].x * newVertices[j].y;
        area -= newVertices[j].x * newVertices[i].y;
      }
      area = Math.abs(area) / 2;
    }
    
    // Find center for measurements
    const centerX = newVertices.reduce((sum, v) => sum + v.x, 0) / newVertices.length;
    const centerY = newVertices.reduce((sum, v) => sum + v.y, 0) / newVertices.length;
    const screenCenter = this.worldToScreen({ x: centerX, y: centerY });
    
    // Render live measurements
    const measurements = [{ label: 'L', value: totalLength }];
    if (area > 0) {
      measurements.push({ label: 'A', value: area });
    }
    renderMeasurementText(this.ctx, screenCenter, measurements);
  }

  /**
   * Render live measurements for ellipse during grip drag
   * Note: Ellipse is not in EntityType union, so this function is unused
   */
  private renderEllipseDragMeasurements(entity: Entity, gripIndex: number, currentPos: Point2D): void {
    // Ellipse is not in EntityType union, so this function is unused
    return;
  }

  /**
   * Update transform (called when viewport changes)
   */
  updateTransform(transform: { scale: number; offsetX: number; offsetY: number }): void {
    this.transform = transform;
  }

  /**
   * Set grip settings for dynamic color rendering
   */
  setGripSettings(settings: GripSettings): void {
    this.gripSettings = settings;
  }
}
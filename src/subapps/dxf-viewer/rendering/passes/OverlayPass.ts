/**
 * OVERLAY PASS - Render των UI elements (grips, selection, cursors)
 * ✅ ΦΑΣΗ 4: Τρίτη φάση του render pipeline για overlay elements
 */

import type { IRenderPass, IRenderContext, RenderPassOptions } from '../core/RenderPipeline';
import type { EntityModel } from '../types/Types';

export interface GripInfo {
  entityId: string;
  gripType: 'vertex' | 'edge' | 'center' | 'corner';
  gripIndex: number;
  position: { x: number; y: number };
  state: 'cold' | 'hot' | 'selected';
}

export interface SelectionInfo {
  selectedEntityIds: string[];
  hoveredEntityId?: string;
  selectionBounds?: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
}

export interface CursorInfo {
  position: { x: number; y: number };
  type: 'default' | 'crosshair' | 'grab' | 'move' | 'resize';
  snapPoint?: { x: number; y: number };
}

export interface OverlayPassConfig {
  gripsEnabled: boolean;
  selectionHighlightEnabled: boolean;
  cursorEnabled: boolean;
  snapIndicatorsEnabled: boolean;
  measurementLabelsEnabled: boolean;
  gridSnappingEnabled: boolean;
}

/**
 * 🔺 OVERLAY RENDER PASS
 * Τελευταίο pass για UI elements που πρέπει να εμφανίζονται πάνω από όλα:
 * - Selection highlights
 * - Grips (vertex/edge/corner handles)
 * - Cursor indicators
 * - Snap points
 * - Measurement labels
 * - Debug overlays
 */
export class OverlayPass implements IRenderPass {
  readonly name = 'overlay';
  readonly priority = 3; // Τελευταίο στη σειρά

  private config: OverlayPassConfig;
  private enabled = true;

  // Overlay data
  private grips: GripInfo[] = [];
  private selection: SelectionInfo = { selectedEntityIds: [] };
  private cursor: CursorInfo = { position: { x: 0, y: 0 }, type: 'default' };
  private snapPoints: { x: number; y: number }[] = [];

  constructor(config: OverlayPassConfig) {
    this.config = config;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  updateConfig(config: Partial<OverlayPassConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 🔺 UPDATE OVERLAY DATA
   * Ενημερώνει τα δεδομένα για τα overlay elements
   */
  setGrips(grips: GripInfo[]): void {
    this.grips = grips;
  }

  setSelection(selection: SelectionInfo): void {
    this.selection = selection;
  }

  setCursor(cursor: CursorInfo): void {
    this.cursor = cursor;
  }

  setSnapPoints(snapPoints: { x: number; y: number }[]): void {
    this.snapPoints = snapPoints;
  }

  render(context: IRenderContext, options: RenderPassOptions): void {
    if (!this.enabled) return;

    // 🔺 SELECTION HIGHLIGHTS (πρώτα, κάτω από τα άλλα)
    if (this.config.selectionHighlightEnabled) {
      this.renderSelectionHighlights(context, options);
    }

    // 🔺 SNAP INDICATORS
    if (this.config.snapIndicatorsEnabled) {
      this.renderSnapIndicators(context, options);
    }

    // 🔺 GRIPS (entity handles)
    if (this.config.gripsEnabled) {
      this.renderGrips(context, options);
    }

    // 🔺 CURSOR
    if (this.config.cursorEnabled) {
      this.renderCursor(context, options);
    }

    // 🔺 MEASUREMENT LABELS
    if (this.config.measurementLabelsEnabled) {
      this.renderMeasurementLabels(context, options);
    }
  }

  /**
   * 🔺 SELECTION HIGHLIGHTS
   * Highlight των επιλεγμένων entities
   */
  private renderSelectionHighlights(context: IRenderContext, options: RenderPassOptions): void {
    if (this.selection.selectedEntityIds.length === 0 && !this.selection.hoveredEntityId) return;

    context.save();

    // Selection highlight style
    context.setState({
      strokeStyle: '#00ff00', // Green for selection
      lineWidth: 2,
      lineDash: [5, 5],
      globalAlpha: 0.8
    });

    // Render selection bounds (if available)
    if (this.selection.selectionBounds) {
      const bounds = this.selection.selectionBounds;
      const topLeft = context.worldToScreen({ x: bounds.minX, y: bounds.minY });
      const bottomRight = context.worldToScreen({ x: bounds.maxX, y: bounds.maxY });

      context.beginPath();
      context.rect(
        topLeft.x,
        topLeft.y,
        bottomRight.x - topLeft.x,
        bottomRight.y - topLeft.y
      );
      context.stroke();
    }

    // Hover highlight (different color)
    if (this.selection.hoveredEntityId) {
      context.setState({
        strokeStyle: '#ffff00', // Yellow for hover
        lineWidth: 3,
        lineDash: []
      });

      // Would need entity data to render hover highlight
      // This is a simplified version
    }

    context.restore();
  }

  /**
   * 🔺 GRIPS RENDERING
   * Σχεδιάζει τα grips (handles) για τα επιλεγμένα entities
   */
  private renderGrips(context: IRenderContext, options: RenderPassOptions): void {
    if (this.grips.length === 0) return;

    for (const grip of this.grips) {
      this.renderSingleGrip(context, grip, options);
    }
  }

  /**
   * 🔺 SINGLE GRIP RENDERING
   * Σχεδιάζει ένα grip με βάση τον τύπο και την κατάσταση
   */
  private renderSingleGrip(context: IRenderContext, grip: GripInfo, options: RenderPassOptions): void {
    const screenPos = context.worldToScreen(grip.position);
    const gripSize = 6; // Screen pixels

    context.save();

    // Color based on state
    let fillColor: string;
    let strokeColor: string;

    switch (grip.state) {
      case 'hot':
        fillColor = '#ff0000'; // Red when hot (hovering)
        strokeColor = '#ffffff';
        break;
      case 'selected':
        fillColor = '#00ff00'; // Green when selected
        strokeColor = '#ffffff';
        break;
      default: // 'cold'
        fillColor = '#0000ff'; // Blue when cold
        strokeColor = '#ffffff';
    }

    context.setState({
      fillStyle: fillColor,
      strokeStyle: strokeColor,
      lineWidth: 1
    });

    // Shape based on type
    switch (grip.gripType) {
      case 'vertex':
      case 'corner':
        // Square grips
        context.beginPath();
        context.rect(
          screenPos.x - gripSize / 2,
          screenPos.y - gripSize / 2,
          gripSize,
          gripSize
        );
        context.fill();
        context.stroke();
        break;

      case 'edge':
      case 'center':
        // Circular grips
        context.beginPath();
        context.arc(screenPos.x, screenPos.y, gripSize / 2, 0, Math.PI * 2);
        context.fill();
        context.stroke();
        break;
    }

    context.restore();
  }

  /**
   * 🔺 SNAP INDICATORS
   * Σχεδιάζει snap points και snap guides
   */
  private renderSnapIndicators(context: IRenderContext, options: RenderPassOptions): void {
    if (this.snapPoints.length === 0) return;

    context.save();
    context.setState({
      strokeStyle: '#ff00ff', // Magenta for snap points
      fillStyle: '#ff00ff',
      lineWidth: 2,
      globalAlpha: 0.9
    });

    for (const snapPoint of this.snapPoints) {
      const screenPos = context.worldToScreen(snapPoint);

      // Draw snap crosshair
      const size = 8;
      context.beginPath();
      // Horizontal line
      context.moveTo(screenPos.x - size, screenPos.y);
      context.lineTo(screenPos.x + size, screenPos.y);
      // Vertical line
      context.moveTo(screenPos.x, screenPos.y - size);
      context.lineTo(screenPos.x, screenPos.y + size);
      context.stroke();

      // Draw center dot
      context.beginPath();
      context.arc(screenPos.x, screenPos.y, 2, 0, Math.PI * 2);
      context.fill();
    }

    context.restore();
  }

  /**
   * 🔺 CURSOR RENDERING
   * Σχεδιάζει custom cursor αν χρειάζεται
   */
  private renderCursor(context: IRenderContext, options: RenderPassOptions): void {
    if (this.cursor.type === 'default') return;

    const screenPos = this.cursor.position;

    context.save();
    context.setState({
      strokeStyle: '#000000',
      lineWidth: 1,
      globalAlpha: 0.8
    });

    switch (this.cursor.type) {
      case 'crosshair':
        // Draw crosshair cursor
        const size = 20;
        context.beginPath();
        // Horizontal line
        context.moveTo(screenPos.x - size, screenPos.y);
        context.lineTo(screenPos.x + size, screenPos.y);
        // Vertical line
        context.moveTo(screenPos.x, screenPos.y - size);
        context.lineTo(screenPos.x, screenPos.y + size);
        context.stroke();
        break;

      case 'grab':
        // Draw hand cursor indicator
        context.setState({ fillStyle: '#000000' });
        context.fillText('✋', screenPos.x + 10, screenPos.y - 10);
        break;

      case 'move':
        // Draw move cursor (4-way arrow)
        context.beginPath();
        const arrowSize = 8;
        // Up arrow
        context.moveTo(screenPos.x, screenPos.y - arrowSize);
        context.lineTo(screenPos.x - 3, screenPos.y - arrowSize + 3);
        context.moveTo(screenPos.x, screenPos.y - arrowSize);
        context.lineTo(screenPos.x + 3, screenPos.y - arrowSize + 3);
        // Down arrow
        context.moveTo(screenPos.x, screenPos.y + arrowSize);
        context.lineTo(screenPos.x - 3, screenPos.y + arrowSize - 3);
        context.moveTo(screenPos.x, screenPos.y + arrowSize);
        context.lineTo(screenPos.x + 3, screenPos.y + arrowSize - 3);
        // Left arrow
        context.moveTo(screenPos.x - arrowSize, screenPos.y);
        context.lineTo(screenPos.x - arrowSize + 3, screenPos.y - 3);
        context.moveTo(screenPos.x - arrowSize, screenPos.y);
        context.lineTo(screenPos.x - arrowSize + 3, screenPos.y + 3);
        // Right arrow
        context.moveTo(screenPos.x + arrowSize, screenPos.y);
        context.lineTo(screenPos.x + arrowSize - 3, screenPos.y - 3);
        context.moveTo(screenPos.x + arrowSize, screenPos.y);
        context.lineTo(screenPos.x + arrowSize - 3, screenPos.y + 3);
        context.stroke();
        break;
    }

    // Draw snap point if available
    if (this.cursor.snapPoint) {
      const snapScreen = context.worldToScreen(this.cursor.snapPoint);
      context.setState({
        strokeStyle: '#ff00ff',
        fillStyle: '#ff00ff'
      });
      context.beginPath();
      context.arc(snapScreen.x, snapScreen.y, 3, 0, Math.PI * 2);
      context.fill();
    }

    context.restore();
  }

  /**
   * 🔺 MEASUREMENT LABELS
   * Σχεδιάζει labels για measurements και dimensions
   */
  private renderMeasurementLabels(context: IRenderContext, options: RenderPassOptions): void {
    // This would be populated by the measurement system
    // For now, just a placeholder for the architecture

    context.save();
    context.setState({
      fillStyle: '#000000',
      font: '12px Arial',
      textAlign: 'center',
      textBaseline: 'middle'
    });

    // Example: render coordinate display at cursor
    const worldPos = context.screenToWorld(this.cursor.position);
    const label = `(${worldPos.x.toFixed(2)}, ${worldPos.y.toFixed(2)})`;

    context.fillText(
      label,
      this.cursor.position.x + 20,
      this.cursor.position.y - 20
    );

    context.restore();
  }

  cleanup(): void {
    this.grips = [];
    this.selection = { selectedEntityIds: [] };
    this.snapPoints = [];
  }
}

/**
 * 🔺 FACTORY FUNCTION
 * Δημιουργεί OverlayPass με default configuration
 */
export function createOverlayPass(config?: Partial<OverlayPassConfig>): OverlayPass {
  const defaultConfig: OverlayPassConfig = {
    gripsEnabled: true,
    selectionHighlightEnabled: true,
    cursorEnabled: true,
    snapIndicatorsEnabled: true,
    measurementLabelsEnabled: true,
    gridSnappingEnabled: true
  };

  return new OverlayPass({ ...defaultConfig, ...config });
}
/**
 * BACKGROUND PASS - Render του background (grid, rulers, coordinate system)
 * ✅ ΦΑΣΗ 4: Πρώτη φάση του render pipeline
 */

import type { IRenderPass, IRenderContext, RenderPassOptions } from '../core/RenderPipeline';

export interface BackgroundConfig {
  gridEnabled: boolean;
  rulersEnabled: boolean;
  coordinateSystemEnabled: boolean;
  gridSize: number;
  gridColor: string;
  rulerColor: string;
  backgroundColor: string;
}

/**
 * 🔺 BACKGROUND RENDER PASS
 * Υπεύθυνο για το rendering του background layer:
 * - Grid pattern
 * - Rulers/measurements
 * - Coordinate system indicators
 * - Background color/texture
 */
export class BackgroundPass implements IRenderPass {
  readonly name = 'background';
  readonly priority = 1; // Πρώτο στη σειρά

  private config: BackgroundConfig;
  private enabled = true;

  constructor(config: BackgroundConfig) {
    this.config = config;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  updateConfig(config: Partial<BackgroundConfig>): void {
    this.config = { ...this.config, ...config };
  }

  render(context: IRenderContext, options: RenderPassOptions): void {
    if (!this.enabled) return;

    // 🔺 BACKGROUND COLOR
    this.renderBackground(context, options);

    // 🔺 GRID PATTERN (αν ενεργοποιημένο)
    if (this.config.gridEnabled) {
      this.renderGrid(context, options);
    }

    // 🔺 RULERS (αν ενεργοποιημένο)
    if (this.config.rulersEnabled) {
      this.renderRulers(context, options);
    }

    // 🔺 COORDINATE SYSTEM (αν ενεργοποιημένο)
    if (this.config.coordinateSystemEnabled) {
      this.renderCoordinateSystem(context, options);
    }
  }

  /**
   * 🔺 BACKGROUND COLOR RENDERING
   * Γεμίζει το background με solid color
   */
  private renderBackground(context: IRenderContext, options: RenderPassOptions): void {
    const { width, height } = context.getSize();

    context.save();
    context.setState({
      fillStyle: this.config.backgroundColor
    });

    context.beginPath();
    context.rect(0, 0, width, height);
    context.fill();
    context.restore();
  }

  /**
   * 🔺 GRID PATTERN RENDERING
   * Σχεδιάζει grid pattern με βάση το scale και gridSize
   */
  private renderGrid(context: IRenderContext, options: RenderPassOptions): void {
    const { width, height } = context.getSize();
    const { transform } = options;
    const effectiveGridSize = this.config.gridSize * transform.scale;

    // Skip grid if too small or too large
    if (effectiveGridSize < 5 || effectiveGridSize > 200) return;

    context.save();
    context.setState({
      strokeStyle: this.config.gridColor,
      lineWidth: 1,
      globalAlpha: 0.3
    });

    // Calculate grid offset based on transform
    const offsetX = transform.offsetX % effectiveGridSize;
    const offsetY = transform.offsetY % effectiveGridSize;

    // Vertical lines
    context.beginPath();
    for (let x = offsetX; x < width; x += effectiveGridSize) {
      context.moveTo(Math.round(x), 0);
      context.lineTo(Math.round(x), height);
    }
    context.stroke();

    // Horizontal lines
    context.beginPath();
    for (let y = offsetY; y < height; y += effectiveGridSize) {
      context.moveTo(0, Math.round(y));
      context.lineTo(width, Math.round(y));
    }
    context.stroke();

    context.restore();
  }

  /**
   * 🔺 RULERS RENDERING
   * Σχεδιάζει rulers στα άκρα του canvas
   */
  private renderRulers(context: IRenderContext, options: RenderPassOptions): void {
    const { width, height } = context.getSize();
    const { transform } = options;

    context.save();
    context.setState({
      strokeStyle: this.config.rulerColor,
      fillStyle: this.config.rulerColor,
      lineWidth: 1,
      font: '12px Arial',
      textAlign: 'center',
      textBaseline: 'middle'
    });

    const rulerHeight = 20;
    const tickSpacing = 50 * transform.scale;

    // Skip rulers if spacing is too small
    if (tickSpacing < 20) {
      context.restore();
      return;
    }

    // Top ruler
    context.beginPath();
    context.rect(0, 0, width, rulerHeight);
    context.fill();

    // Left ruler
    context.beginPath();
    context.rect(0, 0, rulerHeight, height);
    context.fill();

    // Ruler ticks and labels
    const offsetX = transform.offsetX % tickSpacing;
    for (let x = offsetX; x < width; x += tickSpacing) {
      // Top ruler tick
      context.beginPath();
      context.moveTo(Math.round(x), rulerHeight - 5);
      context.lineTo(Math.round(x), rulerHeight);
      context.stroke();

      // Label
      const worldX = (x - transform.offsetX) / transform.scale;
      context.fillText(worldX.toFixed(0), x, rulerHeight / 2);
    }

    const offsetY = transform.offsetY % tickSpacing;
    for (let y = offsetY; y < height; y += tickSpacing) {
      // Left ruler tick
      context.beginPath();
      context.moveTo(rulerHeight - 5, Math.round(y));
      context.lineTo(rulerHeight, Math.round(y));
      context.stroke();

      // Label (rotated text would be better, but simplified for now)
      const worldY = (y - transform.offsetY) / transform.scale;
      context.save();
      context.translate(rulerHeight / 2, y);
      context.rotate(-Math.PI / 2);
      context.fillText(worldY.toFixed(0), 0, 0);
      context.restore();
    }

    context.restore();
  }

  /**
   * 🔺 COORDINATE SYSTEM RENDERING
   * Σχεδιάζει coordinate system indicators (origin, axes)
   */
  private renderCoordinateSystem(context: IRenderContext, options: RenderPassOptions): void {
    const { transform } = options;

    // Calculate screen position of world origin (0,0)
    const originScreen = context.worldToScreen({ x: 0, y: 0 });
    const { width, height } = context.getSize();

    // Only render if origin is visible on screen
    if (originScreen.x < -50 || originScreen.x > width + 50 ||
        originScreen.y < -50 || originScreen.y > height + 50) {
      return;
    }

    context.save();
    context.setState({
      strokeStyle: '#ff0000', // Red for X axis
      lineWidth: 2,
      globalAlpha: 0.8
    });

    const axisLength = 50;

    // X-axis (red)
    context.beginPath();
    context.moveTo(originScreen.x, originScreen.y);
    context.lineTo(originScreen.x + axisLength, originScreen.y);
    context.stroke();

    // Y-axis (green)
    context.setState({ strokeStyle: '#00ff00' });
    context.beginPath();
    context.moveTo(originScreen.x, originScreen.y);
    context.lineTo(originScreen.x, originScreen.y - axisLength);
    context.stroke();

    // Origin point
    context.setState({
      fillStyle: '#0000ff', // Blue for origin
      strokeStyle: '#0000ff'
    });
    context.beginPath();
    context.arc(originScreen.x, originScreen.y, 3, 0, Math.PI * 2);
    context.fill();

    // Labels
    context.setState({
      fillStyle: '#000000',
      font: '14px Arial',
      textAlign: 'left',
      textBaseline: 'top'
    });
    context.fillText('X', originScreen.x + axisLength + 5, originScreen.y - 7);
    context.fillText('Y', originScreen.x + 5, originScreen.y - axisLength - 20);
    context.fillText('(0,0)', originScreen.x + 5, originScreen.y + 5);

    context.restore();
  }

  cleanup(): void {
    // No cleanup needed for background pass
  }
}

/**
 * 🔺 FACTORY FUNCTION
 * Δημιουργεί BackgroundPass με default configuration
 */
export function createBackgroundPass(config?: Partial<BackgroundConfig>): BackgroundPass {
  const defaultConfig: BackgroundConfig = {
    gridEnabled: true,
    rulersEnabled: true,
    coordinateSystemEnabled: true,
    gridSize: 10,
    gridColor: '#e0e0e0',
    rulerColor: '#f0f0f0',
    backgroundColor: '#ffffff'
  };

  return new BackgroundPass({ ...defaultConfig, ...config });
}
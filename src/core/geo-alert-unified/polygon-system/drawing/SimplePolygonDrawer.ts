/**
 * 🎨 SIMPLE POLYGON DRAWER
 *
 * Απλό σύστημα σχεδίασης πολυγώνων
 *
 * @module core/polygon-system/drawing/SimplePolygonDrawer
 */

import type {
  UniversalPolygon,
  PolygonPoint,
  PolygonDrawingState,
  PolygonStyle,
  PolygonType
} from '../types';
import { DEFAULT_POLYGON_STYLES } from '../types';
import { validatePolygon, isPolygonClosed, closePolygon } from '../utils/polygon-utils';

/**
 * Simple polygon drawing system
 */
export class SimplePolygonDrawer {
  private state: PolygonDrawingState;
  protected canvas: HTMLCanvasElement | null = null;
  protected context: CanvasRenderingContext2D | null = null;

  constructor(canvas?: HTMLCanvasElement) {
    this.state = {
      isDrawing: false,
      currentPolygon: null,
      mode: 'simple',
      style: DEFAULT_POLYGON_STYLES.simple,
      snapToGrid: false,
      snapTolerance: 10
    };

    if (canvas) {
      this.setCanvas(canvas);
    }
  }

  /**
   * Set canvas για rendering
   */
  setCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');

    if (!this.context) {
      throw new Error('❌ Failed to get 2D context from canvas');
    }

    // Setup event listeners
    this.setupEventListeners();
  }

  /**
   * Start drawing new polygon
   */
  startDrawing(type: PolygonType = 'simple', style?: Partial<PolygonStyle>): void {
    if (this.state.isDrawing && this.state.currentPolygon) {
      console.warn('⚠️ Already drawing a polygon. Finishing current one.');
      this.finishDrawing();
    }

    this.state.isDrawing = true;
    this.state.mode = type;
    this.state.style = {
      ...DEFAULT_POLYGON_STYLES[type],
      ...style
    };

    this.state.currentPolygon = {
      id: `polygon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      points: [],
      isClosed: false,
      style: this.state.style,
      metadata: {
        createdAt: new Date(),
        modifiedAt: new Date()
      }
    };

    console.log('🎨 Started drawing polygon:', type);
  }

  /**
   * Add point to current polygon
   */
  addPoint(x: number, y: number): PolygonPoint | null {
    if (!this.state.isDrawing || !this.state.currentPolygon) {
      console.warn('⚠️ Not in drawing mode');
      return null;
    }

    // Apply grid snapping if enabled
    if (this.state.snapToGrid) {
      const snapped = this.snapToGrid(x, y);
      x = snapped.x;
      y = snapped.y;
    }

    const point: PolygonPoint = {
      x,
      y,
      id: `point_${this.state.currentPolygon.points.length}`,
      label: `Point ${this.state.currentPolygon.points.length + 1}`
    };

    this.state.currentPolygon.points.push(point);
    this.state.currentPolygon.metadata!.modifiedAt = new Date();

    // Render current state
    this.render();

    console.log(`📍 Added point ${this.state.currentPolygon.points.length}:`, point);
    return point;
  }

  /**
   * Remove last point
   */
  removeLastPoint(): PolygonPoint | null {
    if (!this.state.currentPolygon || this.state.currentPolygon.points.length === 0) {
      return null;
    }

    const removedPoint = this.state.currentPolygon.points.pop();
    this.state.currentPolygon.metadata!.modifiedAt = new Date();

    // Render updated state
    this.render();

    console.log('🗑️ Removed last point:', removedPoint);
    return removedPoint || null;
  }

  /**
   * Close current polygon
   */
  closePolygon(): UniversalPolygon | null {
    if (!this.state.currentPolygon || this.state.currentPolygon.points.length < 3) {
      console.warn('⚠️ Need at least 3 points to close polygon');
      return null;
    }

    // Close the polygon
    const closedPolygon = closePolygon(this.state.currentPolygon);
    this.state.currentPolygon = closedPolygon;

    // Render final state
    this.render();

    console.log('✅ Closed polygon with', closedPolygon.points.length, 'points');
    return closedPolygon;
  }

  /**
   * Finish drawing current polygon
   */
  finishDrawing(): UniversalPolygon | null {
    if (!this.state.isDrawing || !this.state.currentPolygon) {
      return null;
    }

    const polygon = this.state.currentPolygon;

    // Validate polygon
    const validation = validatePolygon(polygon);
    if (!validation.isValid) {
      console.error('❌ Invalid polygon:', validation.errors);
      // Continue anyway, but log errors
    }

    // Close if not already closed and has enough points
    if (!polygon.isClosed && polygon.points.length >= 3) {
      this.closePolygon();
    }

    // Reset drawing state
    this.state.isDrawing = false;
    const finishedPolygon = this.state.currentPolygon;
    this.state.currentPolygon = null;

    console.log('🏁 Finished drawing polygon:', finishedPolygon.id);
    return finishedPolygon;
  }

  /**
   * Cancel current drawing
   */
  cancelDrawing(): void {
    if (!this.state.isDrawing) {
      return;
    }

    this.state.isDrawing = false;
    this.state.currentPolygon = null;

    // Clear canvas
    this.clearCanvas();

    console.log('❌ Cancelled polygon drawing');
  }

  /**
   * Render current polygon state
   */
  render(): void {
    if (!this.context || !this.canvas) {
      return;
    }

    this.clearCanvas();

    if (!this.state.currentPolygon || this.state.currentPolygon.points.length === 0) {
      return;
    }

    const polygon = this.state.currentPolygon;
    const points = polygon.points;
    const style = polygon.style;

    this.context.save();

    // Draw polygon fill (if closed)
    if (polygon.isClosed && points.length >= 3) {
      this.context.fillStyle = style.fillColor;
      this.context.globalAlpha = style.fillOpacity;

      this.context.beginPath();
      this.context.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        this.context.lineTo(points[i].x, points[i].y);
      }
      this.context.closePath();
      this.context.fill();
    }

    // Draw polygon stroke
    this.context.strokeStyle = style.strokeColor;
    this.context.lineWidth = style.strokeWidth;
    this.context.globalAlpha = style.strokeOpacity;

    if (style.strokeDash) {
      this.context.setLineDash(style.strokeDash);
    }

    this.context.beginPath();
    if (points.length > 0) {
      this.context.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        this.context.lineTo(points[i].x, points[i].y);
      }

      // Close path if polygon is closed
      if (polygon.isClosed) {
        this.context.closePath();
      }
    }
    this.context.stroke();

    // Draw points
    if (style.pointRadius && style.pointRadius > 0) {
      this.context.fillStyle = style.pointColor || style.strokeColor;
      this.context.globalAlpha = 1;

      for (const point of points) {
        this.context.beginPath();
        this.context.arc(point.x, point.y, style.pointRadius, 0, 2 * Math.PI);
        this.context.fill();
      }
    }

    this.context.restore();
  }

  /**
   * Clear canvas
   */
  private clearCanvas(): void {
    if (!this.context || !this.canvas) {
      return;
    }

    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    if (!this.canvas) {
      return;
    }

    // Mouse click για adding points
    this.canvas.addEventListener('click', (event) => {
      if (!this.state.isDrawing) {
        return;
      }

      const rect = this.canvas!.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      this.addPoint(x, y);
    });

    // Right click για finishing/closing
    this.canvas.addEventListener('contextmenu', (event) => {
      event.preventDefault();

      if (!this.state.isDrawing) {
        return;
      }

      if (this.state.currentPolygon && this.state.currentPolygon.points.length >= 3) {
        this.closePolygon();
      }
    });

    // Keyboard shortcuts
    window.addEventListener('keydown', (event) => {
      if (!this.state.isDrawing) {
        return;
      }

      switch (event.key) {
        case 'Escape':
          this.cancelDrawing();
          break;
        case 'Enter':
          this.finishDrawing();
          break;
        case 'Backspace':
          this.removeLastPoint();
          break;
      }
    });
  }

  /**
   * Snap point to grid
   */
  private snapToGrid(x: number, y: number): PolygonPoint {
    const gridSize = 20; // Default grid size

    return {
      x: Math.round(x / gridSize) * gridSize,
      y: Math.round(y / gridSize) * gridSize
    };
  }

  /**
   * Get current drawing state
   */
  getState(): PolygonDrawingState {
    return { ...this.state };
  }

  /**
   * Set drawing options
   */
  setOptions(options: Partial<PolygonDrawingState>): void {
    this.state = { ...this.state, ...options };
  }
}
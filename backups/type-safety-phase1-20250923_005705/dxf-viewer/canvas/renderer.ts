import type { Point2D, ViewTransform } from '../systems/rulers-grid/config';
import { coordTransforms } from '../systems/rulers-grid/config';

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private transform: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    
    // Set initial offsetY to canvas height so rulers show (0,0) at bottom-left corner
    const rect = canvas.getBoundingClientRect();
    this.transform.offsetY = rect.height;
  }

  setTransform(transform: ViewTransform) {
    this.transform = transform;
  }

  getTransform(): ViewTransform {
    return this.transform;
  }

  worldToScreen(point: Point2D): Point2D {
    const rect = this.canvas.getBoundingClientRect();
    return coordTransforms.worldToScreen(point, this.transform, rect);
  }

  screenToWorld(point: Point2D): Point2D | null {
    const rect = this.canvas.getBoundingClientRect();
    return coordTransforms.screenToWorld(point, this.transform, rect);
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  render() {
    this.clear();
    // Basic rendering logic here
  }
}

export default Renderer;

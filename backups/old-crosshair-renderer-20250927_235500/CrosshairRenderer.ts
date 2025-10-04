/**
 * CANVAS V2 - CROSSHAIR RENDERER
 * Καθαρό crosshair rendering χωρίς legacy κώδικα
 */

import type { Point2D, Viewport } from '../../shared/types';
import type { CrosshairSettings } from '../layer-types';

export class CrosshairRenderer {
  private ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  /**
   * Render crosshair στη θέση του cursor
   */
  render(
    position: Point2D,
    viewport: Viewport,
    settings: CrosshairSettings
  ): void {
    if (!settings.enabled) return;

    this.ctx.save();

    // 🔺 ENHANCED STYLING - Σύνδεση με CursorSystem ρυθμίσεις
    this.ctx.strokeStyle = settings.color;
    this.ctx.lineWidth = settings.lineWidth ?? 1;
    this.ctx.globalAlpha = settings.opacity;

    // Enhanced line styles από floating panel
    this.setLineStyle(settings.style);

    // Calculate crosshair size based on viewport percentage
    // settings.size είναι ποσοστό (0-100), αλλά για πλήρη οθόνη χρησιμοποιούμε 100% = full screen
    let crosshairSize: number;

    if (settings.size === 100) {
      // Full screen - το σταυρόνημα καλύπτει ολόκληρη την οθόνη
      crosshairSize = Math.max(viewport.width, viewport.height);
    } else if (settings.size === 0) {
      // No crosshair - μόνο το κεντρικό dot
      crosshairSize = 0;
    } else {
      // Percentage of smaller viewport dimension για συνεπές μέγεθος
      const minDimension = Math.min(viewport.width, viewport.height);
      crosshairSize = (settings.size / 100) * minDimension;
    }

    const halfSize = crosshairSize / 2;

    this.ctx.beginPath();

    // Horizontal line - για Full (100%) φτάνει στα άκρα της οθόνης
    if (settings.size === 100) {
      this.ctx.moveTo(0, position.y);
      this.ctx.lineTo(viewport.width, position.y);
    } else {
      this.ctx.moveTo(Math.max(0, position.x - halfSize), position.y);
      this.ctx.lineTo(Math.min(viewport.width, position.x + halfSize), position.y);
    }

    // Vertical line - για Full (100%) φτάνει στα άκρα της οθόνης
    if (settings.size === 100) {
      this.ctx.moveTo(position.x, 0);
      this.ctx.lineTo(position.x, viewport.height);
    } else {
      this.ctx.moveTo(position.x, Math.max(0, position.y - halfSize));
      this.ctx.lineTo(position.x, Math.min(viewport.height, position.y + halfSize));
    }

    this.ctx.stroke();

    // Center dot (optional)
    this.ctx.fillStyle = settings.color;
    this.ctx.beginPath();
    this.ctx.arc(position.x, position.y, 2, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.restore();
  }

  /**
   * Render με gap στο κέντρο (για pickbox)
   */
  renderWithGap(
    position: Point2D,
    viewport: Viewport,
    settings: CrosshairSettings,
    gapSize?: number
  ): void {
    if (!settings.enabled) return;

    this.ctx.save();

    // 🔺 ENHANCED STYLING - Σύνδεση με CursorSystem ρυθμίσεις
    this.ctx.strokeStyle = settings.color;
    this.ctx.lineWidth = settings.lineWidth ?? 1;
    this.ctx.globalAlpha = settings.opacity;

    // Enhanced line styles από floating panel
    this.setLineStyle(settings.style);

    // Calculate crosshair size based on viewport percentage (same logic as render method)
    let crosshairSize: number;

    if (settings.size === 100) {
      // Full screen - το σταυρόνημα καλύπτει ολόκληρη την οθόνη
      crosshairSize = Math.max(viewport.width, viewport.height);
    } else if (settings.size === 0) {
      // No crosshair - μόνο το κεντρικό dot
      crosshairSize = 0;
    } else {
      // Percentage of smaller viewport dimension για συνεπές μέγεθος
      const minDimension = Math.min(viewport.width, viewport.height);
      crosshairSize = (settings.size / 100) * minDimension;
    }

    const halfSize = crosshairSize / 2;
    // 🔺 SMART GAP - Χρησιμοποιεί ρυθμίσεις από floating panel
    const actualGapSize = settings.useCursorGap && settings.centerGapPx
      ? settings.centerGapPx
      : (gapSize ?? 10);
    const halfGap = actualGapSize / 2;

    this.ctx.beginPath();

    // Horizontal lines with gap - για Full (100%) φτάνει στα άκρα της οθόνης
    if (settings.size === 100) {
      // Left side - από άκρο αριστερά μέχρι το gap
      this.ctx.moveTo(0, position.y);
      this.ctx.lineTo(position.x - halfGap, position.y);
      // Right side - από το gap μέχρι άκρο δεξιά
      this.ctx.moveTo(position.x + halfGap, position.y);
      this.ctx.lineTo(viewport.width, position.y);
    } else {
      // Left side
      this.ctx.moveTo(Math.max(0, position.x - halfSize), position.y);
      this.ctx.lineTo(position.x - halfGap, position.y);
      // Right side
      this.ctx.moveTo(position.x + halfGap, position.y);
      this.ctx.lineTo(Math.min(viewport.width, position.x + halfSize), position.y);
    }

    // Vertical lines with gap - για Full (100%) φτάνει στα άκρα της οθόνης
    if (settings.size === 100) {
      // Top side - από άκρο πάνω μέχρι το gap
      this.ctx.moveTo(position.x, 0);
      this.ctx.lineTo(position.x, position.y - halfGap);
      // Bottom side - από το gap μέχρι άκρο κάτω
      this.ctx.moveTo(position.x, position.y + halfGap);
      this.ctx.lineTo(position.x, viewport.height);
    } else {
      // Top side
      this.ctx.moveTo(position.x, Math.max(0, position.y - halfSize));
      this.ctx.lineTo(position.x, position.y - halfGap);
      // Bottom side
      this.ctx.moveTo(position.x, position.y + halfGap);
      this.ctx.lineTo(position.x, Math.min(viewport.height, position.y + halfSize));
    }

    this.ctx.stroke();
    this.ctx.restore();
  }

  /**
   * 🔺 ENHANCED LINE STYLES - Υποστήριξη όλων των line styles από floating panel
   */
  private setLineStyle(style: 'solid' | 'dashed' | 'dotted' | 'dash-dot'): void {
    switch (style) {
      case 'solid':
        this.ctx.setLineDash([]);
        break;
      case 'dashed':
        this.ctx.setLineDash([6, 6]);
        break;
      case 'dotted':
        this.ctx.setLineDash([2, 4]);
        break;
      case 'dash-dot':
        this.ctx.setLineDash([8, 4, 2, 4]);
        break;
      default:
        this.ctx.setLineDash([]);
    }
  }
}
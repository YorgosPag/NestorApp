/**
 * CANVAS V2 - CURSOR RENDERER
 * Καθαρό cursor rendering χωρίς legacy κώδικα
 * Σχεδιάζει το pickbox/cursor shape στη θέση του mouse
 */

import type { Point2D, Viewport } from '../../shared/types';
import type { CursorSettings } from '../../../systems/cursor/config';

export class CursorRenderer {
  private ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  /**
   * Render cursor shape στη θέση του mouse
   * ✅ ADAPTED για CursorSettings από systems/cursor/config.ts (nested structure)
   */
  render(
    position: Point2D,
    viewport: Viewport,
    settings: CursorSettings
  ): void {
    if (!settings.cursor.enabled) return;

    this.ctx.save();

    // 🔺 CURSOR STYLING - Χρήση nested structure από κεντρικό CursorSettings
    this.ctx.strokeStyle = settings.cursor.color;
    this.ctx.lineWidth = settings.cursor.line_width;
    this.ctx.globalAlpha = settings.cursor.opacity;

    // Enhanced line styles από floating panel
    this.setLineStyle(settings.cursor.line_style);

    // Calculate cursor size
    const cursorSize = settings.cursor.size;
    const halfSize = cursorSize / 2;

    this.ctx.beginPath();

    // Render shape βάσει του cursor shape setting
    if (settings.cursor.shape === 'circle') {
      // Κυκλικό cursor
      this.ctx.arc(position.x, position.y, halfSize, 0, Math.PI * 2);
    } else {
      // Τετράγωνο cursor (default)
      this.ctx.rect(
        position.x - halfSize,
        position.y - halfSize,
        cursorSize,
        cursorSize
      );
    }

    // ⚠️ REMOVED FILL SUPPORT - δεν υπάρχει στο κεντρικό CursorSettings
    // Το fill θα προστεθεί αργότερα αν χρειαστεί

    // Stroke
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
/**
 * CANVAS V2 - SNAP INDICATOR RENDERER
 * Καθαρό snap indicator rendering χωρίς legacy κώδικα
 */

import type { Point2D, Viewport } from '../../shared/types';
import type { SnapResult, SnapSettings } from '../layer-types';

export class SnapRenderer {
  private ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  /**
   * Render όλα τα snap indicators
   */
  render(
    snapResults: SnapResult[],
    viewport: Viewport,
    settings: SnapSettings
  ): void {
    if (!settings.enabled || !snapResults.length) return;

    for (const snap of snapResults) {
      this.renderSnapIndicator(snap, viewport);
    }
  }

  /**
   * Render single snap indicator
   */
  private renderSnapIndicator(
    snap: SnapResult,
    viewport: Viewport
  ): void {
    this.ctx.save();

    // Common styling
    this.ctx.strokeStyle = '#ffff00'; // Yellow για snap indicators
    this.ctx.fillStyle = 'transparent';
    this.ctx.lineWidth = 2;
    this.ctx.globalAlpha = 0.9;

    const size = 8;
    const halfSize = size / 2;
    const { x, y } = snap.point;

    this.ctx.beginPath();

    switch (snap.type) {
      case 'endpoint':
        // Square για endpoints
        this.ctx.rect(x - halfSize, y - halfSize, size, size);
        break;

      case 'midpoint':
        // Triangle για midpoints
        this.ctx.moveTo(x, y - halfSize);
        this.ctx.lineTo(x - halfSize, y + halfSize);
        this.ctx.lineTo(x + halfSize, y + halfSize);
        this.ctx.closePath();
        break;

      case 'center':
        // Circle για centers
        this.ctx.arc(x, y, halfSize, 0, Math.PI * 2);
        break;

      case 'intersection':
        // X για intersections
        this.ctx.moveTo(x - halfSize, y - halfSize);
        this.ctx.lineTo(x + halfSize, y + halfSize);
        this.ctx.moveTo(x + halfSize, y - halfSize);
        this.ctx.lineTo(x - halfSize, y + halfSize);
        break;
    }

    this.ctx.stroke();

    // Render snap type label
    this.renderSnapLabel(snap, viewport);

    this.ctx.restore();
  }

  /**
   * Render snap type label
   */
  private renderSnapLabel(
    snap: SnapResult,
    viewport: Viewport
  ): void {
    const labelText = this.getSnapTypeLabel(snap.type);
    if (!labelText) return;

    this.ctx.save();

    this.ctx.fillStyle = '#000000';
    this.ctx.font = '12px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'top';

    // Background για το label
    const metrics = this.ctx.measureText(labelText);
    const padding = 2;
    const labelX = snap.point.x;
    const labelY = snap.point.y + 12;

    this.ctx.fillStyle = 'rgba(255, 255, 0, 0.8)';
    this.ctx.fillRect(
      labelX - metrics.width / 2 - padding,
      labelY - padding,
      metrics.width + padding * 2,
      12 + padding * 2
    );

    // Text
    this.ctx.fillStyle = '#000000';
    this.ctx.fillText(labelText, labelX, labelY);

    this.ctx.restore();
  }

  /**
   * Get label text για snap type
   */
  private getSnapTypeLabel(type: SnapResult['type']): string {
    switch (type) {
      case 'endpoint': return 'End';
      case 'midpoint': return 'Mid';
      case 'center': return 'Cen';
      case 'intersection': return 'Int';
      default: return '';
    }
  }
}
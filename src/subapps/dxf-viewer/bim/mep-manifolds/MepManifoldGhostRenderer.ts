/**
 * MepManifoldGhostRenderer — ADR-408 Φ12 (2D placement ghost).
 *
 * Paints the translucent manifold footprint preview directly onto the preview
 * canvas while the plumbing manifold tool awaits a position — the 2D counterpart
 * of the 3D `MepManifoldPlacementGhost`, mirror of `ElectricalPanelGhostRenderer`.
 * Pure ctx draw in CSS pixels; the caller (leaf hook) supplies the ctx + DPR
 * transform and schedules the redraw (ADR-040 — no React re-render above leaf).
 *
 * Palette mirrors `MepManifoldRenderer` (cyan-teal) so the preview reads as
 * "exactly what the click creates" (WYSIWYG).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import type { MepManifoldKind } from '../types/mep-manifold-types';
import { isDrainageCollectorKind } from '../types/mep-manifold-types';
import { resolveManifoldPalette, buildDrainageGratingStrokes } from './mep-manifold-symbol';
// 🏢 ADR-571: hexToRgba SSoT (fill derived from strokeHex — μηδέν rgb tuple)
import { hexToRgba } from '../../config/color-math';

/** Ghost fill translucency (slightly more opaque than the committed renderer). */
const GHOST_FILL_ALPHA = 0.3;
const GHOST_LINE_WIDTH = 2;
const GHOST_GRATING_LINE_WIDTH = 1;
const ANCHOR_MARKER_SIZE_PX = 5;

export interface MepManifoldGhostRenderInput {
  /** Footprint vertices in world/scene units (from `getGhostFootprint`). */
  readonly footprint: ReadonlyArray<{ x: number; y: number }>;
  /** Manifold kind — drives the palette + grating, so the ghost == the commit. */
  readonly kind: MepManifoldKind;
  /** Cursor world position (anchor marker). */
  readonly cursor: Readonly<Point2D>;
  readonly transform: ViewTransform;
  readonly viewport: { readonly width: number; readonly height: number };
}

export class MepManifoldGhostRenderer {
  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  render(input: Readonly<MepManifoldGhostRenderInput>): void {
    const { footprint, kind, cursor, transform, viewport } = input;
    const palette = resolveManifoldPalette(kind);
    if (footprint.length >= 3) {
      this.drawFill(footprint, palette.strokeHex, transform, viewport);
      this.drawOutline(footprint, palette.strokeHex, transform, viewport);
      // ADR-408 Φ14 — a drainage collector (φρεάτιο) previews its grating too, so
      // the ghost reads exactly as the committed catch-basin symbol (WYSIWYG).
      if (footprint.length === 4 && isDrainageCollectorKind(kind)) {
        this.drawGrating(footprint, palette.strokeHex, transform, viewport);
      }
    }
    this.drawAnchorMarker(cursor, palette.strokeHex, transform, viewport);
  }

  private tracePath(
    vertices: ReadonlyArray<{ x: number; y: number }>,
    transform: ViewTransform,
    viewport: { readonly width: number; readonly height: number },
  ): void {
    const ctx = this.ctx;
    ctx.beginPath();
    const first = CoordinateTransforms.worldToScreen({ x: vertices[0].x, y: vertices[0].y }, transform, viewport);
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < vertices.length; i++) {
      const s = CoordinateTransforms.worldToScreen({ x: vertices[i].x, y: vertices[i].y }, transform, viewport);
      ctx.lineTo(s.x, s.y);
    }
    ctx.closePath();
  }

  private drawFill(
    vertices: ReadonlyArray<{ x: number; y: number }>,
    fillHex: string,
    transform: ViewTransform,
    viewport: { readonly width: number; readonly height: number },
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = hexToRgba(fillHex, GHOST_FILL_ALPHA);
    this.tracePath(vertices, transform, viewport);
    ctx.fill();
    ctx.restore();
  }

  private drawOutline(
    vertices: ReadonlyArray<{ x: number; y: number }>,
    strokeHex: string,
    transform: ViewTransform,
    viewport: { readonly width: number; readonly height: number },
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = strokeHex;
    ctx.lineWidth = GHOST_LINE_WIDTH;
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
    this.tracePath(vertices, transform, viewport);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * ADR-408 Φ14 — preview the φρεάτιο grating (parallel bars), reusing the same
   * `buildDrainageGratingStrokes` SSoT as the committed symbol. `footprint` is the
   * 4 rotated rectangle verts (v0..v3) in world units.
   */
  private drawGrating(
    footprint: ReadonlyArray<{ x: number; y: number }>,
    strokeHex: string,
    transform: ViewTransform,
    viewport: { readonly width: number; readonly height: number },
  ): void {
    const [v0, v1, v2, v3] = footprint.map((v) => ({ x: v.x, y: v.y, z: 0 }));
    const bars = buildDrainageGratingStrokes(v0, v1, v2, v3);
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = strokeHex;
    ctx.lineWidth = GHOST_GRATING_LINE_WIDTH;
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
    for (const bar of bars) {
      const a = CoordinateTransforms.worldToScreen({ x: bar[0].x, y: bar[0].y }, transform, viewport);
      const b = CoordinateTransforms.worldToScreen({ x: bar[1].x, y: bar[1].y }, transform, viewport);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawAnchorMarker(
    cursor: Readonly<Point2D>,
    strokeHex: string,
    transform: ViewTransform,
    viewport: { readonly width: number; readonly height: number },
  ): void {
    const s = CoordinateTransforms.worldToScreen(cursor, transform, viewport);
    const half = ANCHOR_MARKER_SIZE_PX / 2;
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = strokeHex;
    ctx.globalAlpha = 1;
    ctx.fillRect(s.x - half, s.y - half, ANCHOR_MARKER_SIZE_PX, ANCHOR_MARKER_SIZE_PX);
    ctx.restore();
  }
}

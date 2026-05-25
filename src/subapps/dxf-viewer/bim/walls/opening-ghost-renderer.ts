/**
 * OpeningGhostRenderer — ADR-363 Phase 2 (canvas-wiring follow-up, 2026-05-25).
 *
 * Pure canvas renderer για opening placement ghost preview. Draws a
 * dashed-stroke rectangle (cutout outline projected onto the locked host wall
 * axis) + 25% opacity fill + centre crosshair. Optional dashed quarter-arc
 * (door / french-door) hinge swing preview. No React, no RAF — caller
 * (useOpeningGhostPreview) schedules redraws.
 *
 * Pattern: mirror SlabOpeningGhostRenderer + OpeningRenderer colour palette
 * για visual consistency μεταξύ ghost και committed entity.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.4
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import type { OpeningKind } from '../types/opening-types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';

const KIND_STROKE: Readonly<Record<OpeningKind, string>> = {
  'door':         '#c97c2f',
  'window':       '#2d72b8',
  'sliding-door': '#7c5fa1',
  'french-door':  '#b96b2c',
  'fixed':        '#3d7a6f',
};

const KIND_FILL: Readonly<Record<OpeningKind, string>> = {
  'door':         'rgba(201,124,47,0.25)',
  'window':       'rgba(45,114,184,0.25)',
  'sliding-door': 'rgba(124,95,161,0.25)',
  'french-door':  'rgba(185,107,44,0.25)',
  'fixed':        'rgba(61,122,111,0.25)',
};

const DASH_PATTERN = [6, 4] as const;
const HINGE_DASH = [4, 3] as const;
const LINE_WIDTH = 1.5;
const HINGE_LINE_WIDTH = 1;
const CROSSHAIR_HALF_PX = 10;

export interface OpeningGhostRenderInput {
  /** 4 rectangle vertices in scene-unit world coords (CCW from start-outer). */
  readonly vertices: ReadonlyArray<{ x: number; y: number }>;
  /** Optional quarter-arc points (door / french-door swing indicator). */
  readonly hingeArcPoints?: ReadonlyArray<{ x: number; y: number }>;
  readonly kind: OpeningKind;
  readonly transform: ViewTransform;
  readonly viewport: { readonly width: number; readonly height: number };
}

/**
 * Pure renderer. Constructor receives a `CanvasRenderingContext2D` whose DPR
 * transform is already applied by the caller — same contract as
 * `SlabOpeningGhostRenderer`.
 */
export class OpeningGhostRenderer {
  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  render(input: Readonly<OpeningGhostRenderInput>): void {
    const { vertices, hingeArcPoints, kind, transform, viewport } = input;
    if (vertices.length < 3) return;
    const stroke = KIND_STROKE[kind];
    const fill = KIND_FILL[kind];

    this.drawFill(vertices, transform, viewport, fill);
    this.drawOutline(vertices, transform, viewport, stroke);

    if (hingeArcPoints && hingeArcPoints.length >= 2) {
      this.drawHingeArc(hingeArcPoints, transform, viewport, stroke);
    }

    const cx = vertices.reduce((s, v) => s + v.x, 0) / vertices.length;
    const cy = vertices.reduce((s, v) => s + v.y, 0) / vertices.length;
    this.drawCrosshair({ x: cx, y: cy }, transform, viewport, stroke);
  }

  private drawFill(
    vertices: ReadonlyArray<{ x: number; y: number }>,
    transform: ViewTransform,
    viewport: { readonly width: number; readonly height: number },
    fill: string,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = fill;
    ctx.beginPath();
    const first = CoordinateTransforms.worldToScreen({ x: vertices[0].x, y: vertices[0].y }, transform, viewport);
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < vertices.length; i++) {
      const s = CoordinateTransforms.worldToScreen({ x: vertices[i].x, y: vertices[i].y }, transform, viewport);
      ctx.lineTo(s.x, s.y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawOutline(
    vertices: ReadonlyArray<{ x: number; y: number }>,
    transform: ViewTransform,
    viewport: { readonly width: number; readonly height: number },
    stroke: string,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = LINE_WIDTH;
    ctx.setLineDash([...DASH_PATTERN]);
    ctx.beginPath();
    const first = CoordinateTransforms.worldToScreen({ x: vertices[0].x, y: vertices[0].y }, transform, viewport);
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < vertices.length; i++) {
      const s = CoordinateTransforms.worldToScreen({ x: vertices[i].x, y: vertices[i].y }, transform, viewport);
      ctx.lineTo(s.x, s.y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  private drawHingeArc(
    points: ReadonlyArray<{ x: number; y: number }>,
    transform: ViewTransform,
    viewport: { readonly width: number; readonly height: number },
    stroke: string,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = HINGE_LINE_WIDTH;
    ctx.setLineDash([...HINGE_DASH]);
    ctx.beginPath();
    const first = CoordinateTransforms.worldToScreen({ x: points[0].x, y: points[0].y }, transform, viewport);
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < points.length; i++) {
      const s = CoordinateTransforms.worldToScreen({ x: points[i].x, y: points[i].y }, transform, viewport);
      ctx.lineTo(s.x, s.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  private drawCrosshair(
    centerWorld: Readonly<Point2D>,
    transform: ViewTransform,
    viewport: { readonly width: number; readonly height: number },
    stroke: string,
  ): void {
    const s = CoordinateTransforms.worldToScreen(centerWorld, transform, viewport);
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.moveTo(s.x - CROSSHAIR_HALF_PX, s.y);
    ctx.lineTo(s.x + CROSSHAIR_HALF_PX, s.y);
    ctx.moveTo(s.x, s.y - CROSSHAIR_HALF_PX);
    ctx.lineTo(s.x, s.y + CROSSHAIR_HALF_PX);
    ctx.stroke();
    ctx.restore();
  }
}

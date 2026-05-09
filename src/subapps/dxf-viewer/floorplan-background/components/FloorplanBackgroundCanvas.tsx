'use client';

import { useCallback, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useFloorplanBackground } from '../hooks/useFloorplanBackground';
import { useFloorplanBackgroundStore } from '../stores/floorplanBackgroundStore';
import type { CadCoordinateAdaptation, ViewTransform } from '../providers/types';
import type { CalibrationSession } from '../stores/floorplanBackgroundStore';
import type { Point2D } from '../providers/types';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface FloorplanBackgroundCanvasProps {
  floorId: string;
  worldToCanvas: ViewTransform;
  viewport: { width: number; height: number };
  /** Optional CAD adaptation (Y-flip + margins). Required for DXF integration. */
  cad?: CadCoordinateAdaptation;
  /** Consumer sets z-index appropriate for their stacking context (ADR-002). */
  className?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FloorplanBackgroundCanvas({
  floorId,
  worldToCanvas,
  viewport,
  cad,
  className,
}: FloorplanBackgroundCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { background, provider } = useFloorplanBackground(floorId);
  const calibrationSession = useFloorplanBackgroundStore((s) => s.calibrationSession);
  const isCalibrating = calibrationSession?.floorId === floorId;

  // Resize canvas backing store when viewport changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
  }, [viewport.width, viewport.height]);

  // Render only when inputs change — Phase G: eliminated continuous 60fps RAF loop.
  // Previous implementation re-rendered every frame even in idle (~6s/11s per trace 2026-05-09).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, viewport.width, viewport.height);

    if (background?.visible && provider) {
      provider.render(ctx, {
        transform: background.transform,
        worldToCanvas,
        viewport,
        opacity: background.opacity,
        cad,
      });
    }

    _drawCalibrationMarkers(ctx, calibrationSession, floorId);
  }, [
    background,
    provider,
    worldToCanvas,
    viewport,
    cad,
    calibrationSession,
    floorId,
  ]);

  // Click handler for calibration point picking — reads fresh store state
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { calibrationSession: session, setCalibrationPoint } =
      useFloorplanBackgroundStore.getState();
    if (session?.floorId !== floorId) return;
    if (session.pointA && session.pointB) return; // both already set, waiting for dialog
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    // Account for CSS scaling vs canvas resolution (device pixel ratio)
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    setCalibrationPoint(
      { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY },
      worldToCanvas.scale,
    );
  }, [floorId, worldToCanvas]);

  return (
    <canvas
      ref={canvasRef}
      width={viewport.width}
      height={viewport.height}
      onClick={isCalibrating ? handleClick : undefined}
      style={isCalibrating ? { pointerEvents: 'auto' } : undefined}
      className={cn(
        'absolute top-0 left-0 pointer-events-none',
        isCalibrating && 'cursor-crosshair',
        className,
      )}
      aria-hidden
    />
  );
}

// ── Canvas drawing helpers (module-level, no closure captures) ────────────────

function _drawCalibrationMarkers(
  ctx: CanvasRenderingContext2D,
  session: CalibrationSession | null,
  floorId: string,
): void {
  if (!session || session.floorId !== floorId) return;
  ctx.save();
  if (session.pointA && session.pointB) _drawCalibrationLine(ctx, session.pointA, session.pointB);
  if (session.pointA) _drawCrosshair(ctx, session.pointA, '#00D4FF');
  if (session.pointB) _drawCrosshair(ctx, session.pointB, '#FF6B6B');
  ctx.restore();
}

function _drawCrosshair(ctx: CanvasRenderingContext2D, pt: Point2D, color: string): void {
  const size = 10;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(pt.x - size, pt.y);
  ctx.lineTo(pt.x + size, pt.y);
  ctx.moveTo(pt.x, pt.y - size);
  ctx.lineTo(pt.x, pt.y + size);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
  ctx.stroke();
}

function _drawCalibrationLine(ctx: CanvasRenderingContext2D, a: Point2D, b: Point2D): void {
  ctx.strokeStyle = '#00D4FF';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.setLineDash([]);
}

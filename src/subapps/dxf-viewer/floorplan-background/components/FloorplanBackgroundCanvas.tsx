'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useFloorplanBackground } from '../hooks/useFloorplanBackground';
import type { CadCoordinateAdaptation, FloorplanBackground, ViewTransform } from '../providers/types';
import type { IFloorplanBackgroundProvider } from '../providers/IFloorplanBackgroundProvider';

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

  // Refs for RAF loop — avoid stale closures without restarting the loop
  const backgroundRef = useRef<FloorplanBackground | null>(background);
  const providerRef = useRef<IFloorplanBackgroundProvider | null>(provider);
  const worldToCanvasRef = useRef<ViewTransform>(worldToCanvas);
  const viewportRef = useRef<{ width: number; height: number }>(viewport);
  const cadRef = useRef<CadCoordinateAdaptation | undefined>(cad);

  useEffect(() => { backgroundRef.current = background; }, [background]);
  useEffect(() => { providerRef.current = provider; }, [provider]);
  useEffect(() => { worldToCanvasRef.current = worldToCanvas; }, [worldToCanvas]);
  useEffect(() => { viewportRef.current = viewport; }, [viewport]);
  useEffect(() => { cadRef.current = cad; }, [cad]);

  // Resize canvas backing store when viewport changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
  }, [viewport.width, viewport.height]);

  // Single RAF loop for the component lifetime — reads refs each frame
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId: number;

    const draw = () => {
      const bg = backgroundRef.current;
      const prov = providerRef.current;
      const vp = viewportRef.current;

      ctx.clearRect(0, 0, vp.width, vp.height);

      if (bg?.visible && prov) {
        prov.render(ctx, {
          transform: bg.transform,
          worldToCanvas: worldToCanvasRef.current,
          viewport: vp,
          opacity: bg.opacity,
          cad: cadRef.current,
        });
      }

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, []); // single mount — loop reads latest values from refs

  return (
    <canvas
      ref={canvasRef}
      width={viewport.width}
      height={viewport.height}
      className={cn('absolute top-0 left-0 pointer-events-none', className)}
      aria-hidden
    />
  );
}

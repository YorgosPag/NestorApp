'use client';
import React from 'react';
import type { Point2D } from '../../rendering/types/Types';
import { portalComponents, canvasUtilities } from '@/styles/design-tokens';

interface MarqueeState {
  active: boolean;
  start?: Point2D;
  end?: Point2D;
  kind?: 'window' | 'crossing';
}

interface SelectionState {
  marquee: MarqueeState;
  lasso: { active: boolean; points: Point2D[] };
}

interface SelectionMarqueeOverlayProps {
  state: SelectionState;
  className?: string;
}

export default function SelectionMarqueeOverlay({
  state,
  className = ''
}: SelectionMarqueeOverlayProps) {
  const { marquee } = state;

  if (!marquee.active || !marquee.start || !marquee.end) return null;

  const left = Math.min(marquee.start.x, marquee.end.x);
  const top = Math.min(marquee.start.y, marquee.end.y);
  const width = Math.abs(marquee.end.x - marquee.start.x);
  const height = Math.abs(marquee.end.y - marquee.start.y);

  return (
    <div className={`absolute inset-0 pointer-events-none ${className}`}>
      <div
        style={canvasUtilities.overlays.marquee.rectangle(
          left,
          top,
          width,
          height,
          marquee.kind
        )}
      />
    </div>
  );
}

'use client';

interface Point {
  x: number;
  y: number;
}

interface SnapIndicatorProps {
  position: Point;
}

export function SnapIndicator({ position }: SnapIndicatorProps) {
  return (
    <circle
      cx={position.x}
      cy={position.y}
      r="4"
      fill="none"
      stroke="rgba(255, 0, 0, 0.7)"
      strokeWidth="1.5"
      strokeDasharray="2 2"
      className="pointer-events-none"
    />
  );
}

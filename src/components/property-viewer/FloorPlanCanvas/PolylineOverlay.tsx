
'use client';

import { colors } from '@/styles/design-tokens';

/** Polyline stroke color — SSoT: design-tokens indigo-600 */
const POLYLINE_STROKE = colors.indigo['600']; // #4f46e5

interface Point {
  x: number;
  y: number;
}

interface PolylineOverlayProps {
  polylines: Point[][];
  currentPoints: Point[];
  mousePosition: Point | null;
  isDrawing: boolean;
}

export function PolylineOverlay({
  polylines,
  currentPoints,
  mousePosition,
  isDrawing
}: PolylineOverlayProps) {
  return (
    <g className="polyline-overlay pointer-events-none">
      {/* Render completed polylines */}
      {polylines.map((points, index) => (
        <polyline
          key={`p-${index}`}
          points={points.map(p => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke={POLYLINE_STROKE}
          strokeWidth="2"
        />
      ))}

      {/* Render current polyline being drawn */}
      {isDrawing && currentPoints.length > 0 && mousePosition && (
        <polyline
          points={[
            ...currentPoints.map(p => `${p.x},${p.y}`),
            `${mousePosition.x},${mousePosition.y}`
          ].join(' ')}
          fill="none"
          stroke={POLYLINE_STROKE}
          strokeWidth="2"
          strokeDasharray="4 4"
        />
      )}
    </g>
  );
}

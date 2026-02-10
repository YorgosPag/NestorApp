
'use client';

import { svgUtilities, colors } from '@/styles/design-tokens';

/** Measurement tool color — SSoT: design-tokens red-500 */
const MEASUREMENT_COLOR = colors.red['500']; // #ef4444

interface Point {
  x: number;
  y: number;
}

interface MeasurementOverlayProps {
  startPoint: Point | null;
  endPoint: Point | null;
  scale: number;
}

export function MeasurementOverlay({ startPoint, endPoint, scale }: MeasurementOverlayProps) {
  if (!startPoint || !endPoint) {
    return null;
  }

  const dist = Math.sqrt(
    Math.pow(endPoint.x - startPoint.x, 2) +
    Math.pow(endPoint.y - startPoint.y, 2)
  );
  const realDist = (dist * scale).toFixed(2);
  const midPoint = {
    x: (startPoint.x + endPoint.x) / 2,
    y: (startPoint.y + endPoint.y) / 2
  };

  return (
    <g className="measurement-tool pointer-events-none">
      <line
        x1={startPoint.x}
        y1={startPoint.y}
        x2={endPoint.x}
        y2={endPoint.y}
        stroke={MEASUREMENT_COLOR}
        strokeWidth="2"
        strokeDasharray="5 5"
      />
      <text
        x={midPoint.x}
        y={midPoint.y - 10}
        textAnchor="middle"
        fontSize="12"
        fill={MEASUREMENT_COLOR}
        style={svgUtilities.text.withStroke('white', 3)}
      >
        {realDist}m
      </text>
    </g>
  );
}

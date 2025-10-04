
'use client';

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
        stroke="#ef4444"
        strokeWidth="2"
        strokeDasharray="5 5"
      />
      <text
        x={midPoint.x}
        y={midPoint.y - 10}
        textAnchor="middle"
        fontSize="12"
        fill="#ef4444"
        style={{ paintOrder: 'stroke', stroke: 'white', strokeWidth: '3px', strokeLinejoin: 'round' }}
      >
        {realDist}m
      </text>
    </g>
  );
}

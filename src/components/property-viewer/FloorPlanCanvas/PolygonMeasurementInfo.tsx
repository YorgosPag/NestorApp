

'use client';

import type { Property } from '@/types/property-viewer';

interface PolygonMeasurementInfoProps {
  polygon: Property;
  scale: number;
}

export function PolygonMeasurementInfo({ polygon, scale }: PolygonMeasurementInfoProps) {
  const vertices = polygon.vertices;
  
  // Calculate Area (Shoelace formula)
  let area = 0;
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    area += vertices[i].x * vertices[j].y;
    area -= vertices[j].x * vertices[i].y;
  }
  const realArea = Math.abs(area / 2) * scale * scale;

  // Calculate Perimeter
  let perimeter = 0;
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    perimeter += Math.sqrt(
      Math.pow(vertices[j].x - vertices[i].x, 2) +
      Math.pow(vertices[j].y - vertices[i].y, 2)
    );
  }
  const realPerimeter = perimeter * scale;

  const centroid = vertices.reduce(
    (acc, vertex) => ({
      x: acc.x + vertex.x / vertices.length,
      y: acc.y + vertex.y / vertices.length,
    }),
    { x: 0, y: 0 }
  );

  return (
    <g className="measurement-info pointer-events-none">
      <text
        x={centroid.x}
        y={centroid.y + 25}
        textAnchor="middle"
        fontSize="10"
        fill="#1f2937"
        className="font-mono"
        style={{ paintOrder: 'stroke', stroke: 'white', strokeWidth: '3px', strokeLinejoin: 'round' }}
      >
        {realArea.toFixed(2)}m² / {realPerimeter.toFixed(2)}m
      </text>
    </g>
  );
}

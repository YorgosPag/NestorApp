

'use client';

import { svgUtilities } from '@/styles/design-tokens';

interface PropertyPolygonLabelsProps {
  name: string;
  type: string;
  centroid: { x: number; y: number };
}

export function PropertyPolygonLabels({ name, type, centroid }: PropertyPolygonLabelsProps) {
  return (
    <g className="property-label pointer-events-none">
      <text
        x={centroid.x}
        y={centroid.y + 3}
        textAnchor="middle"
        fontSize="10"
        fill="black"
        className="select-none font-medium"
        style={svgUtilities.text.withStroke('hsl(var(--background) / 0.8)', 3)} // ✅ ENTERPRISE: CSS variable (adapts to dark mode)
      >
        {name.replace(/ - .*/, '')}
      </text>
      <text
        x={centroid.x}
        y={centroid.y + 15}
        textAnchor="middle"
        fontSize="8"
        fill="black"
        className="select-none"
        style={svgUtilities.text.outlined('hsl(var(--background) / 0.7)', 2)} // ✅ ENTERPRISE: CSS variable (adapts to dark mode)
      >
        {type}
      </text>
    </g>
  );
}

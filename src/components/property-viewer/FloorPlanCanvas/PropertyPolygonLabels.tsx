

'use client';

import { svgUtilities } from '@/styles/design-tokens';

/** Property polygon label layout — component-specific positioning */
const LABEL_LAYOUT = {
  nameOffsetY: 3,
  typeOffsetY: 15,
  fontSize: { name: 10, type: 8 },
} as const;

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
        y={centroid.y + LABEL_LAYOUT.nameOffsetY}
        textAnchor="middle"
        fontSize={LABEL_LAYOUT.fontSize.name}
        fill="black"
        className="select-none font-medium"
        style={svgUtilities.text.withStroke('hsl(var(--background) / 0.8)', 3)}
      >
        {name.replace(/ - .*/, '')}
      </text>
      <text
        x={centroid.x}
        y={centroid.y + LABEL_LAYOUT.typeOffsetY}
        textAnchor="middle"
        fontSize={LABEL_LAYOUT.fontSize.type}
        fill="black"
        className="select-none"
        style={svgUtilities.text.outlined('hsl(var(--background) / 0.7)', 2)}
      >
        {type}
      </text>
    </g>
  );
}

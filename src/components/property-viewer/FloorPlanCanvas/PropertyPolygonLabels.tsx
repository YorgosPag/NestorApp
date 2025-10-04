

'use client';

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
        style={{ paintOrder: 'stroke', stroke: 'rgba(255,255,255,0.8)', strokeWidth: '3px', strokeLinejoin: 'round' }}
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
        style={{ paintOrder: 'stroke', stroke: 'rgba(255,255,255,0.7)', strokeWidth: '2px', strokeLinejoin: 'round' }}
      >
        {type}
      </text>
    </g>
  );
}


'use client';

interface SelectionOverlayProps {
  vertices: Array<{ x: number, y: number }>;
}

export function SelectionOverlay({ vertices }: SelectionOverlayProps) {
  const pathData = vertices
    .map((vertex, index) => `${index === 0 ? 'M' : 'L'} ${vertex.x} ${vertex.y}`)
    .join(' ') + ' Z';
    
  return (
    <path
      d={pathData}
      fill="none"
      stroke={'#7c3aed'}
      strokeWidth={3}
      strokeDasharray="3,3"
      opacity={0.8}
      className="pointer-events-none animate-pulse"
    />
  );
}

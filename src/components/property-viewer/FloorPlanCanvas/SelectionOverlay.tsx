
'use client';

import { colors } from '@/styles/design-tokens';

/** Selection overlay color — SSoT: design-tokens purple-600 */
const SELECTION_STROKE = colors.purple['600']; // #7c3aed

interface SelectionOverlayProps {
  vertices: Array<{ x: number; y: number }>;
}

export function SelectionOverlay({ vertices }: SelectionOverlayProps) {
  const pathData = vertices
    .map((vertex, index) => `${index === 0 ? 'M' : 'L'} ${vertex.x} ${vertex.y}`)
    .join(' ') + ' Z';

  return (
    <path
      d={pathData}
      fill="none"
      stroke={SELECTION_STROKE}
      strokeWidth={3}
      strokeDasharray="3,3"
      opacity={0.8}
      className="pointer-events-none animate-pulse"
    />
  );
}

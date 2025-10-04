

'use client';

import { ChevronsUpDown } from 'lucide-react';
import type { Property } from '@/types/property-viewer';

interface PropertyMultiLevelIndicatorProps {
  property: Property;
  centroid: { x: number; y: number };
  onNavigateLevels: (property: Property) => void;
}

export function PropertyMultiLevelIndicator({ property, centroid, onNavigateLevels }: PropertyMultiLevelIndicatorProps) {
  return (
    <g 
      className="multi-level-indicator cursor-pointer"
      onClick={(e) => {
        e.stopPropagation();
        onNavigateLevels(property);
      }}
    >
      <rect
        x={centroid.x - 30}
        y={centroid.y + 22}
        width={60}
        height={16}
        fill="#3b82f6"
        fillOpacity={0.8}
        rx={2}
      />
      <ChevronsUpDown className="h-3 w-3 text-white pointer-events-none" x={centroid.x - 28} y={centroid.y + 24} />
      <text
        x={centroid.x - 12}
        y={centroid.y + 33}
        textAnchor="start"
        fontSize="8"
        fill="white"
        className="font-bold pointer-events-none"
      >
        {property.name.includes("Ισόγειο") ? "1ος Όροφος" : "Ισόγειο"}
      </text>
    </g>
  );
}

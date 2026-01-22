

'use client';

import type { Property } from '@/types/property-viewer';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface PropertyPolygonTooltipProps {
  property: Property;
  centroid: { x: number; y: number };
}

export function PropertyPolygonTooltip({ property, centroid }: PropertyPolygonTooltipProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('properties');

  return (
    <g className="hover-tooltip">
      <rect
        x={centroid.x + 40}
        y={centroid.y - 25}
        width={120}
        height={50}
        fill="white"
        fillOpacity={0.95}
        stroke="#d1d5db"
        strokeWidth={1}
        rx={4}
        className="pointer-events-none drop-shadow-md"
      />
      <text
        x={centroid.x + 50}
        y={centroid.y - 15}
        fontSize="10"
        fill="#111827"
        className="pointer-events-none select-none font-semibold"
      >
        {property.name}
      </text>
      <text
        x={centroid.x + 50}
        y={centroid.y - 5}
        fontSize="9"
        fill="#6b7280"
        className="pointer-events-none select-none"
      >
        {property.type}
      </text>
      {/* ❌ REMOVED: Price display (commercial data - domain separation)
      Migration: PR1.1 - Units Tooltip Cleanup - Price moved to /sales
      */}
      {property.area && (
        <text
          x={centroid.x + 50}
          y={centroid.y + 5}
          fontSize="8"
          fill="#6b7280"
          className="pointer-events-none select-none"
        >
          {property.area}{t('tooltip.sqm')}
        </text>
      )}
    </g>
  );
}

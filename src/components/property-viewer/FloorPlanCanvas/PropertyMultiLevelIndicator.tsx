

'use client';

import { ChevronsUpDown } from 'lucide-react';
import { colors } from '@/styles/design-tokens';
import type { Property } from '@/types/property-viewer';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';

/** Multi-level indicator layout — component-specific positioning */
const INDICATOR_LAYOUT = {
  width: 60,
  height: 16,
  offsetX: -30,
  offsetY: 22,
  iconOffsetX: -28,
  iconOffsetY: 24,
  textOffsetX: -12,
  textOffsetY: 33,
  rx: 2,
  fontSize: 8,
} as const;

/** Multi-level indicator visual style — SSoT: design-tokens */
const INDICATOR_STYLE = {
  fill: colors.blue['500'],               // #3b82f6
  fillOpacity: 0.8,
  textFill: colors.text.inverse,           // white
} as const;

interface PropertyMultiLevelIndicatorProps {
  property: Property;
  centroid: { x: number; y: number };
  onNavigateLevels: (property: Property) => void;
}

export function PropertyMultiLevelIndicator({ property, centroid, onNavigateLevels }: PropertyMultiLevelIndicatorProps) {
  const iconSizes = useIconSizes();
  const { t } = useTranslation('properties');

  const groundFloor = t('multiLevelIndicator.groundFloor');
  const firstFloor = t('multiLevelIndicator.firstFloor');
  const floorLabel = property.name.includes(groundFloor) ? firstFloor : groundFloor;

  return (
    <g
      className="multi-level-indicator cursor-pointer"
      onClick={(e) => {
        e.stopPropagation();
        onNavigateLevels(property);
      }}
    >
      <rect
        x={centroid.x + INDICATOR_LAYOUT.offsetX}
        y={centroid.y + INDICATOR_LAYOUT.offsetY}
        width={INDICATOR_LAYOUT.width}
        height={INDICATOR_LAYOUT.height}
        fill={INDICATOR_STYLE.fill}
        fillOpacity={INDICATOR_STYLE.fillOpacity}
        rx={INDICATOR_LAYOUT.rx}
      />
      <ChevronsUpDown
        className={`${iconSizes.xs} text-white pointer-events-none`}
        x={centroid.x + INDICATOR_LAYOUT.iconOffsetX}
        y={centroid.y + INDICATOR_LAYOUT.iconOffsetY}
      />
      <text
        x={centroid.x + INDICATOR_LAYOUT.textOffsetX}
        y={centroid.y + INDICATOR_LAYOUT.textOffsetY}
        textAnchor="start"
        fontSize={INDICATOR_LAYOUT.fontSize}
        fill={INDICATOR_STYLE.textFill}
        className="font-bold pointer-events-none"
      >
        {floorLabel}
      </text>
    </g>
  );
}

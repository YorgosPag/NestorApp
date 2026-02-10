

'use client';

import { colors } from '@/styles/design-tokens';
import type { Property } from '@/types/property-viewer';
import { useTranslation } from '@/i18n/hooks/useTranslation';

/** SVG tooltip layout — component-specific positioning */
const TOOLTIP_LAYOUT = {
  offsetX: 40,
  offsetY: -25,
  width: 120,
  height: 50,
  textPaddingX: 10,
  lineHeight: 10,
} as const;

/** SVG tooltip visual style — SSoT: design-tokens */
const TOOLTIP_STYLE = {
  background: colors.background.primary,  // white
  border: colors.gray['300'],             // #d1d5db
  titleColor: colors.gray['900'],         // #111827
  textColor: colors.gray['500'],          // #6b7280
  rx: 4,
  fontSize: { title: 10, subtitle: 9, detail: 8 },
} as const;

interface PropertyPolygonTooltipProps {
  property: Property;
  centroid: { x: number; y: number };
}

export function PropertyPolygonTooltip({ property, centroid }: PropertyPolygonTooltipProps) {
  const { t } = useTranslation('properties');
  const boxX = centroid.x + TOOLTIP_LAYOUT.offsetX;
  const boxY = centroid.y + TOOLTIP_LAYOUT.offsetY;
  const textX = boxX + TOOLTIP_LAYOUT.textPaddingX;

  return (
    <g className="hover-tooltip">
      <rect
        x={boxX}
        y={boxY}
        width={TOOLTIP_LAYOUT.width}
        height={TOOLTIP_LAYOUT.height}
        fill={TOOLTIP_STYLE.background}
        fillOpacity={0.95}
        stroke={TOOLTIP_STYLE.border}
        strokeWidth={1}
        rx={TOOLTIP_STYLE.rx}
        className="pointer-events-none drop-shadow-md"
      />
      <text
        x={textX}
        y={boxY + TOOLTIP_LAYOUT.lineHeight}
        fontSize={TOOLTIP_STYLE.fontSize.title}
        fill={TOOLTIP_STYLE.titleColor}
        className="pointer-events-none select-none font-semibold"
      >
        {property.name}
      </text>
      <text
        x={textX}
        y={boxY + TOOLTIP_LAYOUT.lineHeight * 2}
        fontSize={TOOLTIP_STYLE.fontSize.subtitle}
        fill={TOOLTIP_STYLE.textColor}
        className="pointer-events-none select-none"
      >
        {property.type}
      </text>
      {property.area && (
        <text
          x={textX}
          y={boxY + TOOLTIP_LAYOUT.lineHeight * 3}
          fontSize={TOOLTIP_STYLE.fontSize.detail}
          fill={TOOLTIP_STYLE.textColor}
          className="pointer-events-none select-none"
        >
          {property.area}{t('tooltip.sqm')}
        </text>
      )}
    </g>
  );
}

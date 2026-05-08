'use client';

/**
 * Property status legend — color swatch + i18n label per status.
 *
 * Renders only the statuses present in `properties` (data-driven). Designed
 * to be overlaid bottom-left on the floorplan canvas. Color swatches reuse
 * the canonical overlay color SSoT (`STATUS_COLORS_MAPPING`) so the legend
 * always matches what the renderer paints.
 *
 * @module components/property-viewer/PropertyStatusLegend
 * @enterprise ADR-340 §3.6 / ADR-258 SSoT colors
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  PROPERTY_STATUS_LABELS,
  type PropertyStatus,
} from '@/constants/domains/property-status-core';
import { STATUS_COLORS_MAPPING } from '@/subapps/dxf-viewer/config/color-mapping';
import { getDynamicBackgroundClass } from '@/components/ui/utils/dynamic-styles';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import type { Property } from '@/types/property-viewer';

interface PropertyStatusLegendProps {
  properties: ReadonlyArray<Property>;
  className?: string;
}

export function PropertyStatusLegend({ properties, className }: PropertyStatusLegendProps) {
  const { t } = useTranslation([
    'properties',
    'properties-detail',
    'properties-enums',
    'properties-viewer',
  ]);
  const colors = useSemanticColors();

  const presentStatuses = React.useMemo<PropertyStatus[]>(() => {
    const seen = new Set<PropertyStatus>();
    for (const p of properties) {
      const key = (p.commercialStatus ?? p.status) as PropertyStatus | undefined;
      if (key && key in STATUS_COLORS_MAPPING) seen.add(key);
    }
    return Array.from(seen);
  }, [properties]);

  if (presentStatuses.length === 0) return null;

  return (
    <aside
      className={cn(
        'pointer-events-auto rounded-md border bg-background/85 backdrop-blur-sm shadow-sm px-2 py-1.5 flex flex-col gap-1',
        className,
      )}
    >
      {presentStatuses.map((status) => {
        const stroke = STATUS_COLORS_MAPPING[status]?.stroke;
        const swatchClass = getDynamicBackgroundClass(stroke);
        const labelKey = PROPERTY_STATUS_LABELS[status];
        return (
          <div key={status} className="flex items-center gap-2 text-xs leading-none">
            <span
              className={cn('inline-block w-3 h-3 rounded-sm border border-black/10', swatchClass)}
              aria-hidden="true"
            />
            <span className={cn('font-medium', colors.text.foreground)}>
              {t(labelKey)}
            </span>
          </div>
        );
      })}
    </aside>
  );
}

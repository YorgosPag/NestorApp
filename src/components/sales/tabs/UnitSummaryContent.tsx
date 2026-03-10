'use client';

/**
 * @fileoverview Unit Summary Tab Content — ADR-197 §2.7 Tab 2
 * @description Read-only preview of physical unit data + link to /units
 * @pattern Enterprise card layout, read-only mode
 */

import React from 'react';
import {
  Home,
  Layers,
  Maximize2,
  Bed,
  Bath,
  Compass,
  ExternalLink,
  Building2,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { Unit } from '@/types/unit';

// =============================================================================
// 🏢 TYPES
// =============================================================================

interface UnitSummaryContentProps {
  data?: Unit;
}

// =============================================================================
// 🏢 READ-ONLY FIELD
// =============================================================================

function SummaryField({
  icon: Icon,
  iconColor,
  label,
  value,
}: {
  icon: React.ElementType;
  iconColor: string;
  label: string;
  value: string | number | undefined;
}) {
  const iconSizes = useIconSizes();
  if (value === undefined || value === null || value === '') return null;

  return (
    <div className="flex items-center gap-2 py-1">
      <Icon className={`${iconSizes.sm} ${iconColor} flex-shrink-0`} />
      <span className="text-xs text-muted-foreground">{label}:</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

// =============================================================================
// 🏢 COMPONENT
// =============================================================================

export function UnitSummaryContent({ data: unit }: UnitSummaryContentProps) {
  const { t } = useTranslation('common');
  const iconSizes = useIconSizes();

  if (!unit) return null;

  const area = unit.areas?.gross ?? unit.area;
  const orientation = unit.orientations?.[0];

  return (
    <section className="flex flex-col gap-2 p-2" aria-label={t('sales.tabs.unitSummary', { defaultValue: 'Φυσικά Στοιχεία' })}>
      <Card>
        <CardHeader className="p-3 pb-0">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Home className={`${iconSizes.sm} text-teal-600`} />
            {t('sales.unitSummary.physicalData', { defaultValue: 'Φυσικά Στοιχεία' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <SummaryField
              icon={Home}
              iconColor="text-teal-600"
              label={t('sales.unitSummary.type', { defaultValue: 'Τύπος' })}
              value={t(`sales.unitTypes.${unit.type}`, { defaultValue: unit.type })}
            />
            <SummaryField
              icon={Maximize2}
              iconColor="text-pink-600"
              label={t('sales.unitSummary.area', { defaultValue: 'Εμβαδόν' })}
              value={area ? `${area} m²` : undefined}
            />
            <SummaryField
              icon={Layers}
              iconColor="text-orange-600"
              label={t('sales.unitSummary.floor', { defaultValue: 'Όροφος' })}
              value={unit.floor !== undefined ? `${unit.floor}ος` : undefined}
            />
            <SummaryField
              icon={Building2}
              iconColor="text-blue-600"
              label={t('sales.unitSummary.building', { defaultValue: 'Κτίριο' })}
              value={unit.building}
            />
            <SummaryField
              icon={Bed}
              iconColor="text-violet-600"
              label={t('sales.unitSummary.bedrooms', { defaultValue: 'Υπνοδωμάτια' })}
              value={unit.layout?.bedrooms}
            />
            <SummaryField
              icon={Bath}
              iconColor="text-cyan-600"
              label={t('sales.unitSummary.bathrooms', { defaultValue: 'Μπάνια' })}
              value={unit.layout?.bathrooms}
            />
            <SummaryField
              icon={Compass}
              iconColor="text-amber-600"
              label={t('sales.unitSummary.orientation', { defaultValue: 'Προσανατολισμός' })}
              value={orientation ? t(`orientations.${orientation}`, { defaultValue: orientation }) : undefined}
            />
            <SummaryField
              icon={Zap}
              iconColor="text-yellow-600"
              label={t('sales.unitSummary.energy', { defaultValue: 'Ενεργειακή' })}
              value={unit.energy?.class}
            />
          </div>

          {/* Link to /units page */}
          <div className="mt-3 pt-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-center gap-2 text-sm"
              onClick={() => {
                window.location.href = `/units?unitId=${unit.id}`;
              }}
            >
              <ExternalLink className={iconSizes.sm} />
              {t('sales.unitSummary.openInSpaces', { defaultValue: 'Άνοιγμα στους Χώρους' })}
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

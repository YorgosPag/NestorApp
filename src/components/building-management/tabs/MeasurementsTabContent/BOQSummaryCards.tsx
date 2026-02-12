/**
 * BOQSummaryCards — 4 Summary Cards (Materials, Labor, Equipment, Total)
 *
 * @module components/building-management/tabs/MeasurementsTabContent/BOQSummaryCards
 * @see ADR-175 §4.4.3 (SCREEN 1)
 */

'use client';

import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrency } from '@/lib/intl-utils';
import { cn } from '@/lib/utils';
import type { BOQItem } from '@/types/boq';
import { computeItemCost } from '@/services/measurements';
import { Package, Wrench, Truck, Calculator } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface BOQSummaryCardsProps {
  items: BOQItem[];
}

interface SummaryCardData {
  labelKey: string;
  amount: number;
  icon: typeof Package;
  accentClass: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function BOQSummaryCards({ items }: BOQSummaryCardsProps) {
  const { t } = useTranslation('building');

  const totals = useMemo(() => {
    let materialCost = 0;
    let laborCost = 0;
    let equipmentCost = 0;

    for (const item of items) {
      const cost = computeItemCost(item);
      materialCost += cost.materialCost;
      laborCost += cost.laborCost;
      equipmentCost += cost.equipmentCost;
    }

    return {
      materialCost,
      laborCost,
      equipmentCost,
      totalCost: materialCost + laborCost + equipmentCost,
    };
  }, [items]);

  const cards: SummaryCardData[] = [
    {
      labelKey: 'tabs.measurements.summary.materials',
      amount: totals.materialCost,
      icon: Package,
      accentClass: 'text-blue-600 dark:text-blue-400',
    },
    {
      labelKey: 'tabs.measurements.summary.labor',
      amount: totals.laborCost,
      icon: Wrench,
      accentClass: 'text-amber-600 dark:text-amber-400',
    },
    {
      labelKey: 'tabs.measurements.summary.equipment',
      amount: totals.equipmentCost,
      icon: Truck,
      accentClass: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      labelKey: 'tabs.measurements.summary.total',
      amount: totals.totalCost,
      icon: Calculator,
      accentClass: 'text-purple-600 dark:text-purple-400',
    },
  ];

  return (
    <section
      aria-label={t('tabs.measurements.title')}
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
    >
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.labelKey} className="overflow-hidden">
            <CardContent className="p-4">
              <header className="flex items-center gap-2 mb-2">
                <Icon className={cn('h-4 w-4', card.accentClass)} />
                <span className="text-sm text-muted-foreground">
                  {t(card.labelKey)}
                </span>
              </header>
              <p className={cn('text-xl font-semibold tabular-nums', card.accentClass)}>
                {formatCurrency(card.amount)}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}

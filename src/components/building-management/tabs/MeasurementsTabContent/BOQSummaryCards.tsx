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
import { computeItemCost, countableBoqLines } from '@/services/measurements';
import { Package, Wrench, Truck, Calculator } from 'lucide-react';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import '@/lib/design-system';

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
  const colors = useSemanticColors();

  const totals = useMemo(() => {
    let materialCost = 0;
    let laborCost = 0;
    let equipmentCost = 0;

    // ADR-917 Λ7 — γονέας-σύνοψη (τοίχος DNA) δεν αθροίζεται· μετρούν οι στρώσεις του
    for (const item of countableBoqLines(items)) {
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
      // ⛔ ΟΧΙ `text-primary`: στο σκοτεινό θέμα `--primary` ≡ `--card` ⇒ το ποσό ήταν ΑΟΡΑΤΟ (CHECK 3.38, ADR-770).
      accentClass: 'text-[hsl(var(--text-info))]',
    },
    {
      labelKey: 'tabs.measurements.summary.labor',
      amount: totals.laborCost,
      icon: Wrench,
      accentClass: 'text-[hsl(var(--text-warning))]',
    },
    {
      labelKey: 'tabs.measurements.summary.equipment',
      amount: totals.equipmentCost,
      icon: Truck,
      accentClass: 'text-[hsl(var(--text-success))]',
    },
    {
      labelKey: 'tabs.measurements.summary.total',
      amount: totals.totalCost,
      icon: Calculator,
      accentClass: 'text-foreground',
    },
  ];

  return (
    <section
      aria-label={t('tabs.measurements.title')}
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2"
    >
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.labelKey} className="overflow-hidden">
            <CardContent className="p-2">
              <header className="flex items-center gap-2 mb-2">
                <Icon className={cn('h-4 w-4', card.accentClass)} />
                <span className={cn("text-sm", colors.text.muted)}>
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

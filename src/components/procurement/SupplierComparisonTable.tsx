'use client';

/**
 * SupplierComparisonTable — Sortable ranking of all suppliers
 *
 * Columns: Name, Orders, Spend, On-Time %, Lead Time, Cancel %.
 * Desktop: full table. Mobile: stacked cards.
 *
 * @see ADR-267 Phase C (Supplier Metrics)
 */

import { useState, useMemo } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTypography } from '@/hooks/useTypography';
import { cn } from '@/lib/design-system';
import {
  ArrowUpDown,
  Trophy,
  Users,
} from 'lucide-react';

import type { SupplierMetrics } from '@/types/procurement';
import { formatPOCurrency } from './utils/procurement-format';

// ============================================================================
// TYPES
// ============================================================================

interface SupplierComparisonTableProps {
  suppliers: SupplierMetrics[];
  className?: string;
}

type SortField = 'totalSpend' | 'totalOrders' | 'onTimeDeliveryRate' | 'averageLeadTimeDays' | 'cancellationRate';

// ============================================================================
// COMPONENT
// ============================================================================

export function SupplierComparisonTable({ suppliers, className }: SupplierComparisonTableProps) {
  const typography = useTypography();
  const { t } = useTranslation('procurement');
  const [sortField, setSortField] = useState<SortField>('totalSpend');
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = useMemo(() => {
    return [...suppliers].sort((a, b) => {
      const aVal = a[sortField] ?? 0;
      const bVal = b[sortField] ?? 0;
      return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [suppliers, sortField, sortAsc]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  }

  if (suppliers.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-12">
          <p className={typography.body.sm}>{t('supplierMetrics.noSuppliers')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="pb-3">
        <h3 className={cn(typography.heading.h4, 'flex items-center gap-2')}>
          <Users className="h-5 w-5" />
          {t('supplierMetrics.comparison')}
          <Badge variant="secondary" className="ml-auto text-xs">
            {suppliers.length} {t('supplierMetrics.suppliers')}
          </Badge>
        </h3>
      </CardHeader>
      <CardContent className="p-0">
        {/* Desktop table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2 text-left font-medium">#</th>
                <th className="px-4 py-2 text-left font-medium">{t('list.supplier')}</th>
                <SortHeader label={t('supplierMetrics.totalOrders')} field="totalOrders" current={sortField} asc={sortAsc} onSort={toggleSort} />
                <SortHeader label={t('supplierMetrics.spend')} field="totalSpend" current={sortField} asc={sortAsc} onSort={toggleSort} />
                <SortHeader label={t('supplierMetrics.onTimeRate')} field="onTimeDeliveryRate" current={sortField} asc={sortAsc} onSort={toggleSort} />
                <SortHeader label={t('supplierMetrics.leadTime')} field="averageLeadTimeDays" current={sortField} asc={sortAsc} onSort={toggleSort} />
                <SortHeader label={t('supplierMetrics.cancellationRate')} field="cancellationRate" current={sortField} asc={sortAsc} onSort={toggleSort} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((s, i) => (
                <tr key={s.supplierId} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    {i < 3 ? <Trophy className={cn('h-4 w-4', getRankColor(i))} /> : <span className={typography.body.sm}>{i + 1}</span>}
                  </td>
                  <td className="px-4 py-3 font-medium">{s.supplierName}</td>
                  <td className="px-4 py-3 text-center">{s.totalOrders}</td>
                  <td className="px-4 py-3 text-right">{formatPOCurrency(s.totalSpend)}</td>
                  <td className="px-4 py-3 text-center">
                    <OnTimeBadge rate={s.onTimeDeliveryRate} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    {s.averageLeadTimeDays !== null ? `${s.averageLeadTimeDays} ${t('supplierMetrics.days')}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn(s.cancellationRate > 20 && 'text-amber-600 dark:text-amber-400')}>
                      {s.cancellationRate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="space-y-3 p-4 md:hidden">
          {sorted.map((s, i) => (
            <MobileSupplierCard key={s.supplierId} supplier={s} rank={i + 1} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface SortHeaderProps {
  label: string;
  field: SortField;
  current: SortField;
  asc: boolean;
  onSort: (field: SortField) => void;
}

function SortHeader({ label, field, current, asc, onSort }: SortHeaderProps) {
  const isActive = current === field;
  return (
    <th className="px-4 py-2 text-center">
      <Button
        variant="ghost"
        size="sm"
        className={cn('h-auto p-0 text-xs font-medium', isActive && 'text-primary')}
        onClick={() => onSort(field)}
      >
        {label}
        <ArrowUpDown className={cn('ml-1 h-3 w-3', isActive && (asc ? 'rotate-180' : ''))} />
      </Button>
    </th>
  );
}

function OnTimeBadge({ rate }: { rate: number }) {
  if (rate >= 80) {
    return <Badge variant="default" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">{rate}%</Badge>;
  }
  if (rate >= 50) {
    return <Badge variant="secondary">{rate}%</Badge>;
  }
  return <Badge variant="destructive">{rate}%</Badge>;
}

function MobileSupplierCard({ supplier, rank }: { supplier: SupplierMetrics; rank: number }) {
  const typography = useTypography();
  const { t } = useTranslation('procurement');

  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <span className="font-medium">{rank}. {supplier.supplierName}</span>
        <OnTimeBadge rate={supplier.onTimeDeliveryRate} />
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className={typography.body.sm}>{t('supplierMetrics.totalOrders')}</dt>
          <dd className="font-medium">{supplier.totalOrders}</dd>
        </div>
        <div>
          <dt className={typography.body.sm}>{t('supplierMetrics.totalSpend')}</dt>
          <dd className="font-medium">{formatPOCurrency(supplier.totalSpend)}</dd>
        </div>
        <div>
          <dt className={typography.body.sm}>{t('supplierMetrics.avgLeadTime')}</dt>
          <dd className="font-medium">
            {supplier.averageLeadTimeDays !== null ? `${supplier.averageLeadTimeDays} ${t('supplierMetrics.days')}` : '—'}
          </dd>
        </div>
      </dl>
    </div>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function getRankColor(index: number): string {
  switch (index) {
    case 0: return 'text-amber-500';
    case 1: return 'text-gray-400';
    case 2: return 'text-amber-700';
    default: return 'text-muted-foreground';
  }
}

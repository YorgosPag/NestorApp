/**
 * BOQCategoryAccordion — ATOE category groups with item tables
 *
 * Groups BOQ items by categoryCode, displays in EnterpriseAccordion.
 * Each section has a table with item rows.
 *
 * @module components/building-management/tabs/MeasurementsTabContent/BOQCategoryAccordion
 * @see ADR-175 §4.4.3 (Category Accordion)
 */

'use client';

import { useMemo } from 'react';
import { EnterpriseAccordion } from '@/components/ui/accordion';
import type { EnterpriseAccordionItem } from '@/components/ui/accordion';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrency, formatNumber } from '@/lib/intl-utils';
import { cn } from '@/lib/utils';
import { Pencil, Trash2 } from 'lucide-react';
import type { BOQItem, BOQItemStatus } from '@/types/boq';
import type { MasterBOQCategory } from '@/config/boq-categories';
import { computeItemCost, computeVariance } from '@/services/measurements';

// ============================================================================
// TYPES
// ============================================================================

interface BOQCategoryAccordionProps {
  items: BOQItem[];
  categories: readonly MasterBOQCategory[];
  onEdit: (item: BOQItem) => void;
  onDelete: (item: BOQItem) => void;
  onStatusChange: (item: BOQItem, status: BOQItemStatus) => void;
}

interface CategoryGroup {
  code: string;
  name: string;
  sortOrder: number;
  items: BOQItem[];
  totalCost: number;
}

// ============================================================================
// STATUS BADGE STYLES
// ============================================================================

const STATUS_VARIANT: Record<BOQItemStatus, 'secondary' | 'default' | 'outline' | 'destructive'> = {
  draft: 'secondary',
  submitted: 'default',
  approved: 'default',
  certified: 'default',
  locked: 'outline',
};

const STATUS_CLASS: Record<BOQItemStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  submitted: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  certified: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  locked: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
};

// ============================================================================
// VARIANCE INDICATOR
// ============================================================================

function getVarianceClass(percent: number): string {
  const abs = Math.abs(percent);
  if (abs <= 5) return 'text-green-600 dark:text-green-400';
  if (abs <= 15) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

// ============================================================================
// COMPONENT
// ============================================================================

export function BOQCategoryAccordion({
  items,
  categories,
  onEdit,
  onDelete,
  onStatusChange,
}: BOQCategoryAccordionProps) {
  const { t } = useTranslation('building');

  // Group items by category
  const groups = useMemo<CategoryGroup[]>(() => {
    const map = new Map<string, CategoryGroup>();

    for (const item of items) {
      const existing = map.get(item.categoryCode);
      const cost = computeItemCost(item);

      if (existing) {
        existing.items.push(item);
        existing.totalCost += cost.totalCost;
      } else {
        const cat = categories.find((c) => c.code === item.categoryCode);
        map.set(item.categoryCode, {
          code: item.categoryCode,
          name: cat?.nameEL ?? item.categoryCode,
          sortOrder: cat?.sortOrder ?? 999,
          items: [item],
          totalCost: cost.totalCost,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => a.sortOrder - b.sortOrder);
  }, [items, categories]);

  // Build accordion items
  const accordionItems: EnterpriseAccordionItem[] = groups.map((group) => ({
    value: group.code,
    trigger: (
      <span className="flex items-center justify-between w-full pr-2">
        <span className="font-medium">
          {group.code} — {group.name}
        </span>
        <span className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>
            {group.items.length} {t('tabs.measurements.table.items')}
          </span>
          <span className="font-semibold tabular-nums">
            {formatCurrency(group.totalCost)}
          </span>
        </span>
      </span>
    ),
    content: (
      <CategoryItemsTable
        items={group.items}
        onEdit={onEdit}
        onDelete={onDelete}
        onStatusChange={onStatusChange}
        t={t}
      />
    ),
  }));

  if (groups.length === 0) return null;

  return (
    <EnterpriseAccordion
      items={accordionItems}
      type="multiple"
      variant="card"
      size="md"
      defaultValue={groups.map((g) => g.code)}
    />
  );
}

// ============================================================================
// INNER TABLE COMPONENT
// ============================================================================

interface CategoryItemsTableProps {
  items: BOQItem[];
  onEdit: (item: BOQItem) => void;
  onDelete: (item: BOQItem) => void;
  onStatusChange: (item: BOQItem, status: BOQItemStatus) => void;
  t: (key: string) => string;
}

function CategoryItemsTable({ items, onEdit, onDelete, t }: CategoryItemsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">{t('tabs.measurements.table.index')}</TableHead>
          <TableHead>{t('tabs.measurements.table.description')}</TableHead>
          <TableHead className="w-16 text-center">{t('tabs.measurements.table.unit')}</TableHead>
          <TableHead className="w-24 text-right">{t('tabs.measurements.table.estimatedQty')}</TableHead>
          <TableHead className="w-16 text-right">{t('tabs.measurements.table.waste')}</TableHead>
          <TableHead className="w-28 text-right">{t('tabs.measurements.table.totalCost')}</TableHead>
          <TableHead className="w-28 text-center">{t('tabs.measurements.table.statusLabel')}</TableHead>
          <TableHead className="w-20 text-center">{t('tabs.measurements.table.actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item, idx) => {
          const cost = computeItemCost(item);
          const variance = computeVariance(item);

          return (
            <TableRow key={item.id}>
              <TableCell className="tabular-nums text-muted-foreground">{idx + 1}</TableCell>
              <TableCell>
                <p className="font-medium text-sm">{item.title}</p>
                {variance && (
                  <p className={cn('text-xs tabular-nums mt-0.5', getVarianceClass(variance.percent))}>
                    {variance.percent > 0 ? '+' : ''}{formatNumber(variance.percent, { maximumFractionDigits: 1 })}%
                  </p>
                )}
              </TableCell>
              <TableCell className="text-center text-xs text-muted-foreground">
                {t(`tabs.measurements.units.${item.unit}`)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatNumber(item.estimatedQuantity, { maximumFractionDigits: 2 })}
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {formatNumber(item.wasteFactor * 100, { maximumFractionDigits: 0 })}%
              </TableCell>
              <TableCell className="text-right tabular-nums font-medium">
                {formatCurrency(cost.totalCost)}
              </TableCell>
              <TableCell className="text-center">
                <Badge
                  variant={STATUS_VARIANT[item.status]}
                  className={cn('text-xs', STATUS_CLASS[item.status])}
                >
                  {t(`tabs.measurements.status.${item.status}`)}
                </Badge>
              </TableCell>
              <TableCell>
                <nav className="flex items-center justify-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(item)}
                    aria-label={t('tabs.measurements.actions.edit')}
                    className="h-7 w-7"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {item.status === 'draft' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(item)}
                      aria-label={t('tabs.measurements.actions.delete')}
                      className="h-7 w-7 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </nav>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

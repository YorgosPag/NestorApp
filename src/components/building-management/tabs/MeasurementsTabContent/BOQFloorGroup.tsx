/**
 * BOQFloorGroup — ATOE category tables for a single floor
 *
 * Renders the BOQ items of ONE floor, grouped by ATOE category, each as a
 * labeled table with a subtotal footer. The parent `BOQCategoryAccordion`
 * groups items by floor (ADR-395 Phase 1 / G7) and mounts one of these per
 * floor inside the outer floor accordion.
 *
 * @module components/building-management/tabs/MeasurementsTabContent/BOQFloorGroup
 * @see ADR-175 §4.4.3 (Category Accordion) · ADR-395 §4 (per-floor grouping)
 */

/* eslint-disable design-system/enforce-semantic-colors */
'use client';

import { useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatNumber } from '@/lib/intl-utils';
import { cn } from '@/lib/utils';
import { Pencil, Trash2, Unlink } from 'lucide-react';
import type { BOQItem, BOQItemStatus } from '@/types/boq';
import type { MasterBOQCategory } from '@/config/boq-categories';
import { findSubCategory } from '@/config/boq-subcategories';
import { computeItemCost, computeVariance } from '@/services/measurements';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import '@/lib/design-system';

// ============================================================================
// TYPES
// ============================================================================

interface CategoryGroup {
  code: string;
  name: string;
  sortOrder: number;
  items: BOQItem[];
  totalCost: number;
}

interface BOQFloorGroupProps {
  items: BOQItem[];
  categories: readonly MasterBOQCategory[];
  onEdit: (item: BOQItem) => void;
  onDelete: (item: BOQItem) => void;
  onStatusChange: (item: BOQItem, status: BOQItemStatus) => void;
  onDetach?: (item: BOQItem) => void;
  t: (key: string) => string;
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
  submitted: 'bg-[hsl(var(--bg-info))]/20 text-primary',
  approved: 'bg-[hsl(var(--bg-success))]/10 text-[hsl(var(--text-success))]',
  certified: 'bg-accent text-primary',
  locked: 'bg-[hsl(var(--bg-warning))]/40 text-[hsl(var(--text-warning))]',
};

function getVarianceClass(percent: number): string {
  const abs = Math.abs(percent);
  if (abs <= 5) return 'text-[hsl(var(--text-success))]';
  if (abs <= 15) return 'text-[hsl(var(--text-warning))]';
  return 'text-destructive';
}

// ============================================================================
// COMPONENT — one floor's category tables
// ============================================================================

export function BOQFloorGroup({
  items,
  categories,
  onEdit,
  onDelete,
  onStatusChange,
  onDetach,
  t,
}: BOQFloorGroupProps) {
  const groups = useMemo<CategoryGroup[]>(() => {
    const map = new Map<string, CategoryGroup>();
    for (const item of items) {
      const cost = computeItemCost(item);
      const existing = map.get(item.categoryCode);
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

  return (
    <section className="space-y-3">
      {groups.map((group) => (
        <CategoryItemsTable
          key={group.code}
          items={group.items}
          totalCost={group.totalCost}
          categoryName={`${group.code} — ${group.name}`}
          onEdit={onEdit}
          onDelete={onDelete}
          onStatusChange={onStatusChange}
          onDetach={onDetach}
          t={t}
        />
      ))}
    </section>
  );
}

// ============================================================================
// INNER TABLE COMPONENT
// ============================================================================

interface CategoryItemsTableProps {
  items: BOQItem[];
  totalCost: number;
  categoryName: string;
  onEdit: (item: BOQItem) => void;
  onDelete: (item: BOQItem) => void;
  onStatusChange: (item: BOQItem, status: BOQItemStatus) => void;
  onDetach?: (item: BOQItem) => void;
  t: (key: string) => string;
}

function CategoryItemsTable({ items, totalCost, categoryName, onEdit, onDelete, onDetach, t }: CategoryItemsTableProps) {
  const colors = useSemanticColors();
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">{t('tabs.measurements.table.index')}</TableHead>
          <TableHead>{categoryName}</TableHead>
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
              <TableCell className={cn("tabular-nums", colors.text.muted)}>{idx + 1}</TableCell>
              <TableCell>
                <p className="font-medium text-sm">{item.title}</p>
                {item.subCategoryCode && (
                  <p className={cn('text-xs mt-0.5', colors.text.muted)}>
                    {findSubCategory(item.subCategoryCode)?.nameEL ?? item.subCategoryCode}
                  </p>
                )}
                {item.sourceType === 'bim-auto' && (
                  <Badge
                    variant="secondary"
                    className={cn('text-xs mt-1', item.detached
                      ? 'bg-muted text-muted-foreground'
                      : 'bg-accent text-primary'
                    )}
                  >
                    {item.detached
                      ? t('tabs.measurements.badge.bimDetached')
                      : t('tabs.measurements.badge.bimAuto')}
                  </Badge>
                )}
                {variance && (
                  <p className={cn('text-xs tabular-nums mt-0.5', getVarianceClass(variance.percent))}>
                    {variance.percent > 0 ? '+' : ''}{formatNumber(variance.percent, { maximumFractionDigits: 1 })}%
                  </p>
                )}
              </TableCell>
              <TableCell className={cn("text-center text-xs", colors.text.muted)}>
                {t(`tabs.measurements.units.${item.unit}`)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatNumber(item.estimatedQuantity, { maximumFractionDigits: 2 })}
              </TableCell>
              <TableCell className={cn("text-right tabular-nums", colors.text.muted)}>
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
                  {item.sourceType === 'bim-auto' && !item.detached && onDetach && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDetach(item)}
                      aria-label={t('tabs.measurements.actions.detachFromBim')}
                      className="h-7 w-7 text-primary hover:text-primary"
                    >
                      <Unlink className="h-3.5 w-3.5" />
                    </Button>
                  )}
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
      <TableFooter>
        <TableRow>
          <TableCell colSpan={5} className="text-right font-medium text-sm">
            {t('tabs.measurements.table.subtotal')} — {categoryName}
          </TableCell>
          <TableCell className="text-right tabular-nums font-bold">
            {formatCurrency(totalCost)}
          </TableCell>
          <TableCell colSpan={2} />
        </TableRow>
      </TableFooter>
    </Table>
  );
}

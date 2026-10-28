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
import { Badge, type BadgeVariantProps } from '@/components/ui/badge';
import { IconButton } from '@/components/ui/icon-button';
import { formatCurrency, formatNumber } from '@/lib/intl-utils';
import { cn } from '@/lib/utils';
import { Link2, Pencil, Trash2, Unlink } from 'lucide-react';
import type { BOQItem, BOQItemStatus } from '@/types/boq';
import type { MasterBOQCategory } from '@/config/boq-categories';
import { findSubCategory } from '@/config/boq-subcategories';
import { computeItemCost, computeVariance, computeBaselineDrift, groupBoqCost, type DerivedSummaryCost } from '@/services/measurements';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useUomLabel } from '@/hooks/useUomLabel';
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

/** Shared row-action callbacks + translator for the floor-group tables (SSoT — N.18). */
interface BOQRowActions {
  onEdit: (item: BOQItem) => void;
  onDelete: (item: BOQItem) => void;
  onStatusChange: (item: BOQItem, status: BOQItemStatus) => void;
  onDetach?: (item: BOQItem) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}

interface BOQFloorGroupProps extends BOQRowActions {
  items: BOQItem[];
  /** ADR-917 Ε2 — a summary shows Σ of its layers (decided on the FULL set), never its own price */
  derivedCosts: ReadonlyMap<string, DerivedSummaryCost>;
  categories: readonly MasterBOQCategory[];
}

// ============================================================================
// STATUS BADGE STYLES
// ============================================================================

/**
 * Κατάσταση ⇒ σημασιολογική παραλλαγή του `Badge` — το γέμισμα **και** το μετρημένο μελάνι του ζουν εκεί (`SOLID_FILL_INK`).
 * ⛔ Όχι χειροποίητες κλάσεις χρώματος: το `text-primary` πάνω σε `bg-accent` ήταν **αόρατο** στο σκοτεινό θέμα (CHECK 3.38).
 */
type BadgeVariant = NonNullable<BadgeVariantProps['variant']>;

const STATUS_VARIANT: Record<BOQItemStatus, BadgeVariant> = {
  draft: 'muted',
  submitted: 'info',
  approved: 'success',
  certified: 'purple',
  locked: 'warning',
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
  derivedCosts,
  categories,
  onEdit,
  onDelete,
  onStatusChange,
  onDetach,
  t,
}: BOQFloorGroupProps) {
  // ADR-917 Λ7 — η σύνοψη τοίχου DNA φαίνεται, αλλά ΔΕΝ αθροίζεται (μετρούν οι στρώσεις)
  const summaryIds = useMemo(() => new Set(derivedCosts.keys()), [derivedCosts]);
  const groups = useMemo<CategoryGroup[]>(() => {
    return groupBoqCost(items, (item) => item.categoryCode, summaryIds)
      .map(({ key, items: groupItems, totalCost }) => {
        const cat = categories.find((c) => c.code === key);
        return { code: key, name: cat?.nameEL ?? key, sortOrder: cat?.sortOrder ?? 999, items: groupItems, totalCost };
      })
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [items, categories, summaryIds]);

  return (
    <section className="space-y-3">
      {groups.map((group) => (
        <CategoryItemsTable
          key={group.code}
          items={group.items}
          totalCost={group.totalCost}
          derivedCosts={derivedCosts}
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
// COST CELL — a summary shows Σ of its layers (ADR-917 Ε2)
// ============================================================================

interface SummaryAwareCostCellProps {
  cost: number;
  /** Present ⇔ the row is a summary replaced by its layers: its own price is never shown as its cost */
  derived: DerivedSummaryCost | undefined;
  mutedClass: string;
  t: BOQRowActions['t'];
}

function SummaryAwareCostCell({ cost, derived, mutedClass, t }: SummaryAwareCostCellProps) {
  if (!derived) return <TableCell className="text-right tabular-nums font-medium">{formatCurrency(cost)}</TableCell>;
  return (
    <TableCell className={cn('text-right tabular-nums italic', mutedClass)}>
      {formatCurrency(derived.totalCost)}
      <small className="block not-italic">{t('tabs.measurements.table.derivedFromLayers', { count: derived.layerCount })}</small>
    </TableCell>
  );
}

// ============================================================================
// INNER TABLE COMPONENT
// ============================================================================

interface CategoryItemsTableProps extends BOQRowActions {
  items: BOQItem[];
  totalCost: number;
  /** ADR-917 Λ7 · Ε2 — γονείς-σύνοψη: φαίνονται με το Σ των στρώσεών τους, δεν αθροίζονται */
  derivedCosts: ReadonlyMap<string, DerivedSummaryCost>;
  categoryName: string;
}

function CategoryItemsTable({ items, totalCost, derivedCosts, categoryName, onEdit, onDelete, onDetach, t }: CategoryItemsTableProps) {
  const colors = useSemanticColors();
  const uomLabel = useUomLabel();
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
          const drift = computeBaselineDrift(item);

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
                  <Badge variant={item.detached ? 'muted' : 'outline'} className="text-xs mt-1 gap-1">
                    {item.detached
                      ? <Unlink className="h-3 w-3" aria-hidden="true" />
                      : <Link2 className="h-3 w-3" aria-hidden="true" />}
                    {item.detached
                      ? t('tabs.measurements.badge.bimDetached')
                      : t('tabs.measurements.badge.bimAuto')}
                  </Badge>
                )}
                {derivedCosts.has(item.id) && (
                  <Badge variant="outline" className="text-xs mt-1">
                    {t('tabs.measurements.badge.groupSummary')}
                  </Badge>
                )}
                {variance && (
                  <p className={cn('text-xs tabular-nums mt-0.5', getVarianceClass(variance.percent))}>
                    {variance.percent > 0 ? '+' : ''}{formatNumber(variance.percent, { maximumFractionDigits: 1 })}%
                  </p>
                )}
                {drift && (
                  <p className={cn('text-xs tabular-nums mt-0.5', getVarianceClass(drift.percent))}>
                    {t('tabs.measurements.drift.summary', {
                      baseline: formatNumber(drift.baseline, { maximumFractionDigits: 2 }),
                      live: formatNumber(drift.live, { maximumFractionDigits: 2 }),
                      delta: `${drift.delta > 0 ? '+' : ''}${formatNumber(drift.delta, { maximumFractionDigits: 2 })}`,
                    })}
                  </p>
                )}
              </TableCell>
              <TableCell className={cn("text-center text-xs", colors.text.muted)}>
                {uomLabel(item.unit)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatNumber(item.estimatedQuantity, { maximumFractionDigits: 2 })}
              </TableCell>
              <TableCell className={cn("text-right tabular-nums", colors.text.muted)}>
                {formatNumber(item.wasteFactor * 100, { maximumFractionDigits: 0 })}%
              </TableCell>
              <SummaryAwareCostCell cost={cost.totalCost} derived={derivedCosts.get(item.id)} mutedClass={colors.text.muted} t={t} />
              <TableCell className="text-center">
                <Badge variant={STATUS_VARIANT[item.status]} className="text-xs">
                  {t(`tabs.measurements.status.${item.status}`)}
                </Badge>
              </TableCell>
              <TableCell>
                <div role="group" aria-label={t('tabs.measurements.table.actions')} className="flex items-center justify-center gap-1">
                  <IconButton label={t('tabs.measurements.actions.edit')} onClick={() => onEdit(item)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </IconButton>
                  {item.sourceType === 'bim-auto' && !item.detached && onDetach && (
                    <IconButton label={t('tabs.measurements.actions.detachFromBim')} onClick={() => onDetach(item)}>
                      <Unlink className="h-3.5 w-3.5" />
                    </IconButton>
                  )}
                  {item.status === 'draft' && (
                    <IconButton
                      label={t('tabs.measurements.actions.delete')}
                      onClick={() => onDelete(item)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </IconButton>
                  )}
                </div>
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

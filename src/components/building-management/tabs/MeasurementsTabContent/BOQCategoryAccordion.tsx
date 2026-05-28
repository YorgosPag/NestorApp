/**
 * BOQCategoryAccordion — per-floor BOQ groups (ADR-395 Phase 1 / G7)
 *
 * Outer axis = floor (Ισόγειο / Α' όροφος / …), resolved via
 * `useFloorsByBuilding`. Inside each floor, items are grouped by ATOE category
 * (see `BOQFloorGroup`). Items without a `linkedFloorId` (manual building-level
 * rows + legacy BIM rows) fall into a «Γενικά κτιρίου» bucket shown last.
 * A compact per-category quantity total closes the view.
 *
 * @module components/building-management/tabs/MeasurementsTabContent/BOQCategoryAccordion
 * @see ADR-175 §4.4.3 (Category Accordion) · ADR-395 §4 (per-floor grouping)
 */

/* eslint-disable design-system/enforce-semantic-colors */
'use client';

import { useMemo } from 'react';
import { EnterpriseAccordion } from '@/components/ui/accordion';
import type { EnterpriseAccordionItem } from '@/components/ui/accordion';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrency, formatNumber } from '@/lib/intl-utils';
import { cn } from '@/lib/utils';
import type { BOQItem, BOQItemStatus } from '@/types/boq';
import type { MasterBOQCategory } from '@/config/boq-categories';
import { computeItemCost } from '@/services/measurements';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useFloorsByBuilding } from '@/components/properties/shared/useFloorsByBuilding';
import { BOQFloorGroup } from './BOQFloorGroup';
import '@/lib/design-system';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Bucket key for items with no `linkedFloorId` (building-level / legacy). */
const NO_FLOOR_KEY = '__no_floor__';

// ============================================================================
// TYPES
// ============================================================================

interface BOQCategoryAccordionProps {
  items: BOQItem[];
  categories: readonly MasterBOQCategory[];
  /** Building scope — resolves the floor list for per-floor grouping (G7). */
  buildingId: string;
  onEdit: (item: BOQItem) => void;
  onDelete: (item: BOQItem) => void;
  onStatusChange: (item: BOQItem, status: BOQItemStatus) => void;
  onDetach?: (item: BOQItem) => void;
  /** Controlled expanded floor keys (for expand/collapse all) */
  expandedCategories?: string[];
  /** Callback when user manually expands/collapses a floor */
  onExpandedChange?: (expanded: string[]) => void;
}

interface FloorGroup {
  key: string;
  label: string;
  /** Sort key — floor.number ascending; NO_FLOOR bucket last. */
  sortKey: number;
  items: BOQItem[];
  totalCost: number;
}

interface CategoryTotal {
  code: string;
  name: string;
  sortOrder: number;
  unit: string;
  quantity: number;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function BOQCategoryAccordion({
  items,
  categories,
  buildingId,
  onEdit,
  onDelete,
  onStatusChange,
  onDetach,
  expandedCategories,
  onExpandedChange,
}: BOQCategoryAccordionProps) {
  const { t } = useTranslation(['building', 'building-address', 'building-filters', 'building-storage', 'building-tabs', 'building-timeline']);
  const colors = useSemanticColors();
  const { floors } = useFloorsByBuilding(buildingId);

  // floorId → { name, number } for label + ordering.
  const floorMeta = useMemo(() => {
    const map = new Map<string, { name: string; number: number }>();
    for (const f of floors) map.set(f.id, { name: f.name, number: f.number });
    return map;
  }, [floors]);

  // Group items by floor (linkedFloorId), ordered by floor.number; NO_FLOOR last.
  const floorGroups = useMemo<FloorGroup[]>(() => {
    const map = new Map<string, FloorGroup>();
    for (const item of items) {
      const key = item.linkedFloorId ?? NO_FLOOR_KEY;
      const cost = computeItemCost(item);
      const existing = map.get(key);
      if (existing) {
        existing.items.push(item);
        existing.totalCost += cost.totalCost;
      } else {
        const meta = key === NO_FLOOR_KEY ? null : floorMeta.get(key);
        map.set(key, {
          key,
          label: key === NO_FLOOR_KEY
            ? t('tabs.measurements.floorGroup.noFloor')
            : (meta?.name || key),
          sortKey: key === NO_FLOOR_KEY ? Number.POSITIVE_INFINITY : (meta?.number ?? 9998),
          items: [item],
          totalCost: cost.totalCost,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.sortKey - b.sortKey);
  }, [items, floorMeta, t]);

  // Per-category quantity totals across all floors (Σύνολα ανά κατηγορία).
  const categoryTotals = useMemo<CategoryTotal[]>(() => {
    const map = new Map<string, CategoryTotal>();
    for (const item of items) {
      const existing = map.get(item.categoryCode);
      if (existing) {
        existing.quantity += item.estimatedQuantity;
      } else {
        const cat = categories.find((c) => c.code === item.categoryCode);
        map.set(item.categoryCode, {
          code: item.categoryCode,
          name: cat?.nameEL ?? item.categoryCode,
          sortOrder: cat?.sortOrder ?? 999,
          unit: item.unit,
          quantity: item.estimatedQuantity,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.sortOrder - b.sortOrder);
  }, [items, categories]);

  const accordionItems: EnterpriseAccordionItem[] = floorGroups.map((group) => ({
    value: group.key,
    trigger: (
      <span className="flex items-center justify-between w-full pr-2">
        <span className="font-medium">{group.label}</span>
        <span className={cn("flex items-center gap-2 text-sm", colors.text.muted)}>
          <span>{group.items.length} {t('tabs.measurements.table.items')}</span>
          <span className="font-semibold tabular-nums">{formatCurrency(group.totalCost)}</span>
        </span>
      </span>
    ),
    content: (
      <BOQFloorGroup
        items={group.items}
        categories={categories}
        onEdit={onEdit}
        onDelete={onDelete}
        onStatusChange={onStatusChange}
        onDetach={onDetach}
        t={t}
      />
    ),
  }));

  if (floorGroups.length === 0) return null;

  const isControlled = expandedCategories !== undefined;

  return (
    <section className="space-y-3">
      <EnterpriseAccordion
        items={accordionItems}
        type="multiple"
        variant="card"
        size="md"
        {...(isControlled
          ? { value: expandedCategories, onValueChange: onExpandedChange as (v: string | string[]) => void }
          : { defaultValue: floorGroups.map((g) => g.key) }
        )}
      />

      {categoryTotals.length > 0 && (
        <section className="rounded-md border p-3">
          <h4 className={cn("text-sm font-semibold mb-2", colors.text.muted)}>
            {t('tabs.measurements.floorGroup.totalsByCategory')}
          </h4>
          <ul className="space-y-1">
            {categoryTotals.map((ct) => (
              <li key={ct.code} className="flex items-center justify-between text-sm">
                <span>{ct.code} — {ct.name}</span>
                <span className="tabular-nums font-medium">
                  {formatNumber(ct.quantity, { maximumFractionDigits: 2 })} {t(`tabs.measurements.units.${ct.unit}`)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}

/** Returns the floor-group keys present in items — used by parent for expand/collapse all. */
export function getFloorGroupKeys(items: BOQItem[]): string[] {
  const keys = new Set<string>();
  for (const item of items) {
    keys.add(item.linkedFloorId ?? NO_FLOOR_KEY);
  }
  return Array.from(keys);
}

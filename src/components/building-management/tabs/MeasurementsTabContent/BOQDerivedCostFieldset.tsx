'use client';

/**
 * BOQDerivedCostFieldset — the cost of a wall SUMMARY, shown as what it is: derived (ADR-917 Ε2).
 *
 * Replaces the price inputs + totals of the editor for a summary parent. Nothing here is typed: the total is
 * Σ of the layers (`derivedSummaryCosts`, the ONE rule the tables and the 3D tab also read), and the unit
 * rate is that sum ÷ the wall's quantity (Autodesk Build: subitems roll up into the parent). Beyond Autodesk:
 * each layer is listed with its own cost, so the human sees WHERE the money is and where to price it.
 *
 * @module components/building-management/tabs/MeasurementsTabContent/BOQDerivedCostFieldset
 * @see ADR-917 Ε2 · ADR-363 §6.1
 */

import { useMemo } from 'react';
import { formatCurrency } from '@/lib/intl-utils';
import { cn } from '@/lib/utils';
import { computeItemCost, derivedSummaryCosts, isSummaryBoqLine, type DerivedSummaryCost } from '@/services/measurements';
import type { BOQItem } from '@/types/boq';
import type { FieldsetCommon } from './BOQEditorFieldsets';
import '@/lib/design-system';

interface BOQDerivedCostFieldsetProps extends FieldsetCommon {
  summary: BOQItem;
  /** `null` ⇒ no present layers: the price stays locked, the human is told how to bring them back */
  derived: DerivedSummaryCost | null;
  layers: readonly BOQItem[];
}

function DerivedFigures({ summary, derived, colors, t }: Omit<BOQDerivedCostFieldsetProps, 'layers'> & { derived: DerivedSummaryCost }) {
  const unit = t(`tabs.measurements.units.${summary.unit}`);
  return (
    <dl className="grid grid-cols-2 gap-2 text-sm">
      <dt className={colors.text.muted}>{t('tabs.measurements.editor.derived.unitRate')}</dt>
      <dd className="text-right tabular-nums">
        {derived.unitRate === null ? '—' : t('tabs.measurements.editor.derived.unitRateValue', { value: formatCurrency(derived.unitRate), unit })}
      </dd>
      <dt className="font-semibold">{t('tabs.measurements.editor.derived.total')}</dt>
      <dd className="text-right font-bold tabular-nums">
        {formatCurrency(derived.totalCost)}
        <small className={cn('block font-normal', colors.text.muted)}>
          {t('tabs.measurements.editor.derived.totalNote', { count: derived.layerCount })}
        </small>
      </dd>
    </dl>
  );
}

export function BOQDerivedCostFieldset({ summary, derived, layers, colors, t }: BOQDerivedCostFieldsetProps) {
  return (
    <fieldset className="space-y-3 rounded-lg bg-muted/50 p-3">
      <legend className={cn('text-sm font-semibold', colors.text.muted)}>{t('tabs.measurements.editor.derived.title')}</legend>
      <p className="text-xs">{derived ? t('tabs.measurements.editor.derived.note') : t('tabs.measurements.editor.derived.noLayers')}</p>
      {derived ? <DerivedFigures summary={summary} derived={derived} colors={colors} t={t} /> : null}
      {layers.length > 0 ? (
        <section aria-label={t('tabs.measurements.editor.derived.layers')}>
          <h4 className={cn('text-xs font-semibold', colors.text.muted)}>{t('tabs.measurements.editor.derived.layers')}</h4>
          <ul className="divide-y text-sm">
            {layers.map((layer) => (
              <li key={layer.id} className="flex justify-between gap-2 py-1">
                <span>{layer.title}</span>
                <span className="tabular-nums">{formatCurrency(computeItemCost(layer).totalCost)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </fieldset>
  );
}

export interface SummaryPriceLock {
  /** The item is a summary parent ⇒ its price fields are not editable and are never sent */
  locked: boolean;
  derived: DerivedSummaryCost | null;
  layers: BOQItem[];
}

/** Is the edited item a summary, and what does it derive from? Read from the building's FULL item set. */
export function useSummaryPriceLock(item: BOQItem | null, buildingItems: readonly BOQItem[]): SummaryPriceLock {
  return useMemo(() => {
    if (!item || !isSummaryBoqLine(item)) return { locked: false, derived: null, layers: [] };
    return {
      locked: true,
      derived: derivedSummaryCosts(buildingItems).get(item.id) ?? null,
      layers: buildingItems.filter((candidate) => candidate.parentBoqItemId === item.id),
    };
  }, [item, buildingItems]);
}

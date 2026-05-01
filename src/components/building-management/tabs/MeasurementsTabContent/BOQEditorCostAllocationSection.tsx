'use client';

/**
 * BOQEditorCostAllocationSection — Cost allocation method picker (ADR-329 §3.1.1)
 *
 * Three methods: by_area (default) / equal / custom. When 'custom' selected,
 * shows percentages table per target property with live Σ=100 validation.
 *
 * Visible only for multi-property scopes (building / common_areas / floor /
 * properties). Hidden for scope='property' (single unit, no split).
 *
 * @module components/building-management/tabs/MeasurementsTabContent/BOQEditorCostAllocationSection
 * @see ADR-329 §3.1.1
 */

import { useMemo } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from '@/components/ui/tooltip';
import type { BOQScope, CostAllocationMethod } from '@/types/boq';
import type { Property } from '@/types/property';

const METHODS: CostAllocationMethod[] = ['by_area', 'equal', 'custom'];

interface BOQEditorCostAllocationSectionProps {
  scope: BOQScope;
  method: CostAllocationMethod;
  customAllocations: Record<string, number>;
  targetProperties: Property[];
  scopeLocked: boolean;
  onMethodChange: (m: CostAllocationMethod) => void;
  onCustomAllocationsChange: (next: Record<string, number>) => void;
}

export function BOQEditorCostAllocationSection({
  scope, method, customAllocations, targetProperties, scopeLocked,
  onMethodChange, onCustomAllocationsChange,
}: BOQEditorCostAllocationSectionProps) {
  const { t } = useTranslation(['building-tabs']);
  const colors = useSemanticColors();

  const sum = useMemo(
    () => Object.values(customAllocations).reduce((s, v) => s + v, 0),
    [customAllocations],
  );
  const sumValid = Math.abs(sum - 100) < 0.01;

  if (scope === 'property') return null;

  const allowedMethods = scope === 'common_areas'
    ? METHODS.filter((m) => m !== 'equal')
    : METHODS;

  const handleCustomChange = (propertyId: string, raw: string) => {
    const parsed = parseFloat(raw);
    const next = { ...customAllocations };
    if (Number.isNaN(parsed)) delete next[propertyId];
    else next[propertyId] = parsed;
    onCustomAllocationsChange(next);
  };

  return (
    <fieldset className={cn('space-y-2', scopeLocked && 'opacity-60')}>
      <legend className={cn('text-sm font-semibold inline-flex items-center gap-1', colors.text.muted)}>
        {t('tabs.measurements.scope.costAllocation.label')}
        <InfoTooltip content={t('tabs.measurements.scope.costAllocation.tooltips.section')} />
      </legend>

      <ul className="flex flex-col gap-1.5">
        {allowedMethods.map((m) => (
          <li key={m}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant={method === m ? 'default' : 'outline'}
                  size="sm"
                  className="w-full justify-start whitespace-normal text-left leading-tight"
                  disabled={scopeLocked}
                  onClick={() => onMethodChange(m)}
                >
                  {t(`tabs.measurements.scope.costAllocation.${m === 'by_area' ? 'byArea' : m}`)}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs text-xs">
                {t(`tabs.measurements.scope.costAllocation.tooltips.${m === 'by_area' ? 'byArea' : m}`)}
              </TooltipContent>
            </Tooltip>
          </li>
        ))}
      </ul>

      {method === 'custom' && targetProperties.length > 0 && (
        <section className="rounded-md border p-2">
          <p className={cn('mb-1 text-xs font-medium', colors.text.muted)}>
            {t('tabs.measurements.scope.costAllocation.previewHeader')}
          </p>
          <ul className="flex flex-col gap-1.5">
            {targetProperties.map((p) => (
              <li key={p.id} className="flex items-center gap-2">
                <span className="flex-1 text-sm">{p.code ?? p.name}</span>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  className="h-7 w-20 tabular-nums"
                  value={customAllocations[p.id] ?? ''}
                  onChange={(e) => handleCustomChange(p.id, e.target.value)}
                  disabled={scopeLocked}
                />
                <span className="text-xs text-muted-foreground">%</span>
              </li>
            ))}
          </ul>
          <p className={cn('mt-2 text-xs', sumValid ? 'text-green-600' : 'text-destructive')}>
            {sumValid
              ? t('tabs.measurements.scope.costAllocation.customTotalValid')
              : t('tabs.measurements.scope.costAllocation.customTotalInvalid', { percent: sum.toFixed(2) })}
          </p>
        </section>
      )}
    </fieldset>
  );
}

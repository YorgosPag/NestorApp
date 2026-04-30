'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { X, Lock, Unlock } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { UNITS, OTHER_UNIT, isKnownUnit } from '@/subapps/procurement/utils/units';
import { validateLine, collectInconsistencies } from '@/subapps/procurement/utils/line-validation';
import type { QuoteLine, ExtractedQuoteLine } from '@/subapps/procurement/types/quote';

// ============================================================================
// CONFIDENCE BADGE (local)
// ============================================================================

function ConfidenceBadge({ confidence }: { confidence: number }) {
  if (confidence >= 80) {
    return <Badge variant="outline" className="border-green-500 text-green-700 dark:text-green-400 text-xs">{confidence}%</Badge>;
  }
  if (confidence >= 50) {
    return <Badge variant="outline" className="border-yellow-500 text-yellow-700 dark:text-yellow-400 text-xs">{confidence}%</Badge>;
  }
  return <Badge variant="outline" className="border-red-500 text-red-700 dark:text-red-400 text-xs">{confidence}%</Badge>;
}

// ============================================================================
// TYPES
// ============================================================================

export interface QuoteLineEditorTableProps {
  lines: QuoteLine[];
  extractedLineItems?: ExtractedQuoteLine[];
  /** Corresponding RFQ line quantities, indexed by position */
  rfqQuantities?: (number | null)[];
  vatIncluded?: boolean | null;
  onChange: (lines: QuoteLine[]) => void;
  onValidationChange: (hasErrors: boolean, inconsistencies: string[]) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function QuoteLineEditorTable({
  lines,
  extractedLineItems,
  rfqQuantities,
  vatIncluded,
  onChange,
  onValidationChange,
}: QuoteLineEditorTableProps) {
  const { t } = useTranslation('quotes');

  // Set of row indices with user-overridden lineTotal (not auto-computed)
  const [overriddenRows, setOverriddenRows] = useState<Set<number>>(new Set());
  // Set of row indices using custom (non-UNITS) unit input
  const [customUnitRows, setCustomUnitRows] = useState<Set<number>>(() => {
    const initial = new Set<number>();
    lines.forEach((line, i) => { if (!isKnownUnit(line.unit)) initial.add(i); });
    return initial;
  });

  const lineConfidence = useCallback((idx: number): number | null => {
    const ec = extractedLineItems?.[idx];
    if (!ec) return null;
    return Math.round((ec.description.confidence + ec.quantity.confidence + ec.unitPrice.confidence) / 3);
  }, [extractedLineItems]);

  const validations = useMemo(
    () => lines.map((line, i) => validateLine(line, {
      vatIncluded,
      rfqQuantity: rfqQuantities?.[i] ?? null,
      totalOverridden: overriddenRows.has(i),
    })),
    [lines, vatIncluded, rfqQuantities, overriddenRows],
  );

  useEffect(() => {
    const hasErrors = validations.some((v) => v.hasErrors);
    const allInconsistencies = validations.flatMap((v) => collectInconsistencies(v.warnings));
    onValidationChange(hasErrors, allInconsistencies);
  }, [validations, onValidationChange]);

  const updateLine = useCallback((index: number, patch: Partial<QuoteLine>) => {
    const next = lines.map((l, i) => {
      if (i !== index) return l;
      const merged = { ...l, ...patch };
      if (!overriddenRows.has(index) && ('quantity' in patch || 'unitPrice' in patch)) {
        merged.lineTotal = parseFloat((merged.quantity * merged.unitPrice).toFixed(2));
      }
      return merged;
    });
    onChange(next);
  }, [lines, overriddenRows, onChange]);

  const removeLine = useCallback((index: number) => {
    onChange(lines.filter((_, i) => i !== index));
    setOverriddenRows((prev) => { const s = new Set(prev); s.delete(index); return s; });
    setCustomUnitRows((prev) => { const s = new Set(prev); s.delete(index); return s; });
  }, [lines, onChange]);

  const toggleOverride = useCallback((index: number) => {
    setOverriddenRows((prev) => {
      const s = new Set(prev);
      if (s.has(index)) {
        s.delete(index);
        const line = lines[index];
        updateLine(index, { lineTotal: parseFloat((line.quantity * line.unitPrice).toFixed(2)) });
      } else {
        s.add(index);
      }
      return s;
    });
  }, [lines, updateLine]);

  const handleUnitSelect = useCallback((index: number, value: string) => {
    if (value === OTHER_UNIT) {
      setCustomUnitRows((prev) => new Set(prev).add(index));
      updateLine(index, { unit: '' });
    } else {
      setCustomUnitRows((prev) => { const s = new Set(prev); s.delete(index); return s; });
      updateLine(index, { unit: value });
    }
  }, [updateLine]);

  if (lines.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('quotes.scan.noLinesExtracted')}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b text-xs text-muted-foreground">
            <th className="pb-1 pr-2 text-center font-normal">{t('quotes.scan.rowNumber')}</th>
            <th className="pb-1 pr-2 text-left font-normal">{t('quotes.lineDescription')}</th>
            <th className="pb-1 pr-2 text-left font-normal">{t('quotes.quantity')}</th>
            <th className="pb-1 pr-2 text-left font-normal">{t('quotes.unit')}</th>
            <th className="pb-1 pr-2 text-left font-normal">{t('quotes.unitPrice')}</th>
            <th className="pb-1 pr-2 text-right font-normal">{t('quotes.lineTotal')}</th>
            {extractedLineItems && (
              <th className="pb-1 pr-2 text-center font-normal">{t('quotes.scan.confidence')}</th>
            )}
            <th />
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => {
            const v = validations[i];
            const conf = lineConfidence(i);
            const isOverridden = overriddenRows.has(i);
            const isCustomUnit = customUnitRows.has(i);
            const unitSelectValue = isCustomUnit ? OTHER_UNIT : (isKnownUnit(line.unit) ? line.unit : OTHER_UNIT);

            const rowNumber = extractedLineItems?.[i]?.parentRowNumber ?? String(i + 1);

            return (
              <tr key={line.id} className="border-b align-top text-sm">
                <td className="w-10 py-1 pr-2 text-center text-xs text-muted-foreground tabular-nums">
                  {rowNumber}
                </td>
                <td className="py-1 pr-2">
                  <Input value={line.description} onChange={(e) => updateLine(i, { description: e.target.value })} className="h-8 text-sm" />
                  {v.errors.description && <p className="mt-0.5 text-xs text-destructive">{t(v.errors.description)}</p>}
                </td>
                <td className="w-20 py-1 pr-2">
                  <Input
                    value={line.quantity}
                    onChange={(e) => updateLine(i, { quantity: parseFloat(e.target.value) || 0 })}
                    className="h-8 text-sm"
                    min={0}
                  />
                  {v.errors.quantity && <p className="mt-0.5 text-xs text-destructive">{t(v.errors.quantity)}</p>}
                  {v.warnings.quantityMismatch && (
                    <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
                      {t('rfqs.lineEdit.warning.quantityMismatch', {
                        vendorQty: v.warnings.quantityMismatch.vendorQty,
                        requestedQty: v.warnings.quantityMismatch.requestedQty,
                      })}
                    </p>
                  )}
                </td>
                <td className="w-28 py-1 pr-2">
                  <Select value={unitSelectValue} onValueChange={(val) => handleUnitSelect(i, val)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                      <SelectSeparator />
                      <SelectItem value={OTHER_UNIT}>{t('rfqs.lineEdit.unitOption.other')}</SelectItem>
                    </SelectContent>
                  </Select>
                  {isCustomUnit && (
                    <Input
                      value={line.unit}
                      onChange={(e) => updateLine(i, { unit: e.target.value })}
                      placeholder={t('rfqs.lineEdit.unitOption.otherPlaceholder')}
                      className="mt-1 h-7 text-xs"
                    />
                  )}
                  {v.errors.unit && <p className="mt-0.5 text-xs text-destructive">{t(v.errors.unit)}</p>}
                </td>
                <td className="w-24 py-1 pr-2">
                  <Input
                    value={line.unitPrice}
                    onChange={(e) => updateLine(i, { unitPrice: parseFloat(e.target.value) || 0 })}
                    className="h-8 text-sm"
                    step={0.01}
                  />
                  {v.errors.unitPrice && <p className="mt-0.5 text-xs text-destructive">{t(v.errors.unitPrice)}</p>}
                  {v.warnings.negativePrice && <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">{t('rfqs.lineEdit.warning.negativePrice')}</p>}
                  {v.warnings.zeroQuantityWithPrice && <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">{t('rfqs.lineEdit.warning.zeroQuantityWithPrice')}</p>}
                </td>
                <td className="w-32 py-1 pr-2 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {isOverridden ? (
                      <Input
                        value={line.lineTotal}
                        onChange={(e) => updateLine(i, { lineTotal: parseFloat(e.target.value) || 0 })}
                        className="h-8 w-20 text-right text-sm"
                        step={0.01}
                      />
                    ) : (
                      <span className="font-medium">{line.lineTotal.toFixed(2)}</span>
                    )}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 shrink-0"
                          aria-label={isOverridden ? t('rfqs.lineEdit.totalAuto') : t('rfqs.lineEdit.totalOverride')}
                          onClick={() => toggleOverride(i)}
                        >
                          {isOverridden ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3 text-muted-foreground" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        {isOverridden ? t('rfqs.lineEdit.totalAuto') : t('rfqs.lineEdit.totalOverride')}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  {v.warnings.totalMismatch && (
                    <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
                      {t('rfqs.lineEdit.warning.totalMismatch', {
                        statedTotal: v.warnings.totalMismatch.statedTotal.toFixed(2),
                        computedTotal: v.warnings.totalMismatch.computedTotal.toFixed(2),
                      })}
                    </p>
                  )}
                </td>
                {extractedLineItems && (
                  <td className="w-20 py-1 pr-2 text-center">
                    {conf !== null && <ConfidenceBadge confidence={conf} />}
                  </td>
                )}
                <td className="py-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        aria-label={t('quotes.actions.removeLine')}
                        onClick={() => removeLine(i)}
                      >
                        <X className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      {t('quotes.actions.removeLine')}
                    </TooltipContent>
                  </Tooltip>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

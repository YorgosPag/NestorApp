'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { UomSelect } from '@/components/shared/UomSelect';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { X, Lock, Unlock } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { PROCUREMENT_UNIT_OPTIONS } from '@/config/procurement-units';
import { validateLine, collectInconsistencies } from '@/subapps/procurement/utils/line-validation';
import type { QuoteLine, ExtractedQuoteLine } from '@/subapps/procurement/types/quote';

// ============================================================================
// CONFIDENCE BADGE (local)
// ============================================================================

function ConfidenceBadge({ confidence }: { confidence: number }) {
  if (confidence >= 80) {
    return <Badge variant="outline" className="border-[hsl(var(--text-success))] text-[hsl(var(--text-success))] text-xs">{confidence}%</Badge>;
  }
  if (confidence >= 50) {
    return <Badge variant="outline" className="border-[hsl(var(--text-warning))] text-[hsl(var(--text-warning))] text-xs">{confidence}%</Badge>;
  }
  return <Badge variant="outline" className="border-destructive text-destructive text-xs">{confidence}%</Badge>;
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

  if (lines.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('quotes.scan.noLinesExtracted')}</p>;
  }

  const showConfidence = extractedLineItems !== undefined;
  const figureColumns = showConfidence ? 5 : 4;

  // ADR-327 §8.5.4 — κάθε γραμμή είναι ΟΜΑΔΑ ΔΥΟ ΣΕΙΡΩΝ: η περιγραφή σε όλο το πλάτος (αναδιπλώνεται), οι αριθμοί από
  // κάτω. Μετρημένο 2026-10-28: σε μία σειρά οι σταθερές αριθμητικές στήλες άφηναν στην περιγραφή ~69px («Θερμ»).
  // Το περιεχόμενο αποφασίζει, όχι ένας αριθμός πλάτους — και ΧΩΡΙΣ `@container` (βλ. `components/ui/header-bar.tsx`).
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="text-xs text-muted-foreground">
          <tr>
            <th rowSpan={2} className="w-10 pb-1 pr-2 text-center align-bottom font-normal">{t('quotes.scan.rowNumber')}</th>
            <th colSpan={figureColumns} className="pr-2 text-left font-normal">{t('quotes.lineDescription')}</th>
            <th rowSpan={2} className="w-9"><span className="sr-only">{t('quotes.actions.removeLine')}</span></th>
          </tr>
          <tr className="border-b">
            <th className="pb-1 pr-2 text-left font-normal">{t('quotes.quantity')}</th>
            <th className="pb-1 pr-2 text-left font-normal">{t('quotes.unit')}</th>
            <th className="pb-1 pr-2 text-left font-normal">{t('quotes.unitPrice')}</th>
            <th className="pb-1 pr-2 text-right font-normal">{t('quotes.lineTotal')}</th>
            {showConfidence && <th className="pb-1 pr-2 text-center font-normal">{t('quotes.scan.confidence')}</th>}
          </tr>
        </thead>
        {lines.map((line, i) => (
          <QuoteLineRowGroup
            key={line.id}
            line={line}
            index={i}
            rowNumber={extractedLineItems?.[i]?.parentRowNumber ?? String(i + 1)}
            validation={validations[i]}
            confidence={lineConfidence(i)}
            showConfidence={showConfidence}
            figureColumns={figureColumns}
            isOverridden={overriddenRows.has(i)}
            onUpdate={updateLine}
            onRemove={removeLine}
            onToggleOverride={toggleOverride}
          />
        ))}
      </table>
    </div>
  );
}

// ============================================================================
// ROW GROUP — μία γραμμή προσφοράς (περιγραφή · αριθμοί)
// ============================================================================

interface QuoteLineRowGroupProps {
  line: QuoteLine;
  index: number;
  rowNumber: string;
  validation: ReturnType<typeof validateLine>;
  confidence: number | null;
  showConfidence: boolean;
  figureColumns: number;
  isOverridden: boolean;
  onUpdate: (index: number, patch: Partial<QuoteLine>) => void;
  onRemove: (index: number) => void;
  onToggleOverride: (index: number) => void;
}

function QuoteLineRowGroup(props: QuoteLineRowGroupProps) {
  const { line, index: i, rowNumber, validation: v, figureColumns, onUpdate, onRemove } = props;
  const { t } = useTranslation('quotes');

  return (
    <tbody className="border-b text-sm">
      <tr className="align-top">
        <td rowSpan={2} className="py-1 pr-2 text-center text-xs text-muted-foreground tabular-nums">{rowNumber}</td>
        <td colSpan={figureColumns} className="pt-1 pr-2">
          {/* `field-sizing: content` — το πεδίο μεγαλώνει με το κείμενο· όπου δεν υποστηρίζεται, `resize-y` */}
          <Textarea
            value={line.description}
            onChange={(e) => onUpdate(i, { description: e.target.value })}
            aria-label={t('quotes.lineDescription')}
            rows={1}
            size="sm"
            className="min-h-8 resize-y py-1.5 text-sm md:min-h-8 md:py-1.5 [field-sizing:content]"
          />
          {v.errors.description && <p className="mt-0.5 text-xs text-destructive">{t(v.errors.description)}</p>}
        </td>
        <td rowSpan={2} className="py-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={t('quotes.actions.removeLine')} onClick={() => onRemove(i)}>
                <X className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{t('quotes.actions.removeLine')}</TooltipContent>
          </Tooltip>
        </td>
      </tr>
      <QuoteLineFigures {...props} />
    </tbody>
  );
}

function QuoteLineFigures({ line, index: i, validation: v, confidence, showConfidence, isOverridden, onUpdate, onToggleOverride }: QuoteLineRowGroupProps) {
  const { t } = useTranslation('quotes');
  const overrideLabel = isOverridden ? t('rfqs.lineEdit.totalAuto') : t('rfqs.lineEdit.totalOverride');

  return (
    <tr className="align-top">
      <td className="w-24 py-1 pr-2">
        <Input value={line.quantity} onChange={(e) => onUpdate(i, { quantity: parseFloat(e.target.value) || 0 })} className="h-8 text-sm" min={0} aria-label={t('quotes.quantity')} />
        {v.errors.quantity && <p className="mt-0.5 text-xs text-destructive">{t(v.errors.quantity)}</p>}
        {v.warnings.quantityMismatch && (
          <p className="mt-0.5 text-xs text-[hsl(var(--text-warning))]">
            {t('rfqs.lineEdit.warning.quantityMismatch', {
              vendorQty: v.warnings.quantityMismatch.vendorQty,
              requestedQty: v.warnings.quantityMismatch.requestedQty,
            })}
          </p>
        )}
      </td>
      <td className="w-28 py-1 pr-2">
        {/* ADR-923 §5.11 «3γ» 4β: μονάδα μόνο από το μητρώο (SAP/Oracle) — παλιά γραφή εκτός λίστας μένει ορατή */}
        <UomSelect value={line.unit} onValueChange={(unit) => onUpdate(i, { unit })} units={PROCUREMENT_UNIT_OPTIONS} ariaLabel={t('quotes.unit')} size="sm" compact />
        {v.errors.unit && <p className="mt-0.5 text-xs text-destructive">{t(v.errors.unit)}</p>}
      </td>
      <td className="w-28 py-1 pr-2">
        <Input value={line.unitPrice} onChange={(e) => onUpdate(i, { unitPrice: parseFloat(e.target.value) || 0 })} className="h-8 text-sm" step={0.01} aria-label={t('quotes.unitPrice')} />
        {v.errors.unitPrice && <p className="mt-0.5 text-xs text-destructive">{t(v.errors.unitPrice)}</p>}
        {v.warnings.negativePrice && <p className="mt-0.5 text-xs text-[hsl(var(--text-warning))]">{t('rfqs.lineEdit.warning.negativePrice')}</p>}
        {v.warnings.zeroQuantityWithPrice && <p className="mt-0.5 text-xs text-[hsl(var(--text-warning))]">{t('rfqs.lineEdit.warning.zeroQuantityWithPrice')}</p>}
      </td>
      <td className="py-1 pr-2 text-right">
        <div className="flex items-center justify-end gap-1">
          {isOverridden ? (
            <Input value={line.lineTotal} onChange={(e) => onUpdate(i, { lineTotal: parseFloat(e.target.value) || 0 })} className="h-8 w-24 text-right text-sm" step={0.01} aria-label={t('quotes.lineTotal')} />
          ) : (
            <span className="font-medium tabular-nums">{line.lineTotal.toFixed(2)}</span>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" aria-label={overrideLabel} onClick={() => onToggleOverride(i)}>
                {isOverridden ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3 text-muted-foreground" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{overrideLabel}</TooltipContent>
          </Tooltip>
        </div>
        {v.warnings.totalMismatch && (
          <p className="mt-0.5 text-xs text-[hsl(var(--text-warning))]">
            {t('rfqs.lineEdit.warning.totalMismatch', {
              statedTotal: v.warnings.totalMismatch.statedTotal.toFixed(2),
              computedTotal: v.warnings.totalMismatch.computedTotal.toFixed(2),
            })}
          </p>
        )}
      </td>
      {showConfidence && (
        <td className="w-20 py-1 pr-2 text-center">{confidence !== null && <ConfidenceBadge confidence={confidence} />}</td>
      )}
    </tr>
  );
}

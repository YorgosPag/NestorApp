'use client';

/**
 * ExtractedDataReviewPanel — ADR-327 §6 (Phase 2).
 *
 * Renders AI-extracted quote fields with per-field confidence highlighting:
 *   - green ≥ 80, yellow 50-79, red < 50, gray = no value.
 *
 * Lines are editable inline; confirm posts edited lines back via PATCH
 * (overrides the auto-materialized lines from `applyExtractedData`).
 */

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertTriangle, X, Save } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { computeQuoteTotals } from '@/subapps/procurement/types/quote';
import type {
  ExtractedQuoteData,
  FieldWithConfidence,
  QuoteLine,
  Quote,
} from '@/subapps/procurement/types/quote';

// ============================================================================
// HELPERS
// ============================================================================

type ConfidenceLevel = 'high' | 'medium' | 'low' | 'empty';

function levelOf(value: unknown, confidence: number): ConfidenceLevel {
  if (value === null || value === '' || value === undefined) return 'empty';
  if (confidence >= 80) return 'high';
  if (confidence >= 50) return 'medium';
  return 'low';
}

function levelClasses(level: ConfidenceLevel): string {
  switch (level) {
    case 'high':   return 'border-l-4 border-l-green-500 bg-green-50/40 dark:bg-green-950/20';
    case 'medium': return 'border-l-4 border-l-yellow-500 bg-yellow-50/40 dark:bg-yellow-950/20';
    case 'low':    return 'border-l-4 border-l-red-500 bg-red-50/40 dark:bg-red-950/20';
    case 'empty':  return 'border-l-4 border-l-muted bg-muted/20';
  }
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  if (confidence >= 80) {
    return <Badge variant="outline" className="border-green-500 text-green-700 dark:text-green-400">{confidence}%</Badge>;
  }
  if (confidence >= 50) {
    return <Badge variant="outline" className="border-yellow-500 text-yellow-700 dark:text-yellow-400">{confidence}%</Badge>;
  }
  return <Badge variant="outline" className="border-red-500 text-red-700 dark:text-red-400">{confidence}%</Badge>;
}

// ============================================================================
// FIELD ROW
// ============================================================================

interface FieldRowProps<T> {
  label: string;
  field: FieldWithConfidence<T>;
}

function FieldRow<T>({ label, field }: FieldRowProps<T>) {
  const level = levelOf(field.value, field.confidence);
  const display = field.value === null || field.value === ''
    ? '—'
    : String(field.value);

  return (
    <div className={`rounded-md px-3 py-2 ${levelClasses(level)}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <Label className="text-xs text-muted-foreground">{label}</Label>
          <p className="truncate text-sm font-medium">{display}</p>
        </div>
        <ConfidenceBadge confidence={field.confidence} />
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PANEL
// ============================================================================

export interface ExtractedDataReviewPanelProps {
  quote: Quote;
  onConfirm: (lines: QuoteLine[]) => Promise<void> | void;
  onReject?: () => Promise<void> | void;
  isSaving?: boolean;
}

export function ExtractedDataReviewPanel({
  quote,
  onConfirm,
  onReject,
  isSaving = false,
}: ExtractedDataReviewPanelProps) {
  const { t } = useTranslation('quotes');
  const extracted = quote.extractedData;
  const [lines, setLines] = useState<QuoteLine[]>(quote.lines);

  const overall = extracted?.overallConfidence ?? 0;
  const totals = useMemo(() => computeQuoteTotals(lines), [lines]);

  const updateLine = (index: number, field: keyof QuoteLine, value: QuoteLine[keyof QuoteLine]) => {
    setLines((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      if (field === 'quantity' || field === 'unitPrice') {
        const qty = field === 'quantity' ? Number(value) || 0 : next[index].quantity;
        const price = field === 'unitPrice' ? Number(value) || 0 : next[index].unitPrice;
        next[index].lineTotal = parseFloat((qty * price).toFixed(2));
      }
      return next;
    });
  };

  const removeLine = (index: number) => {
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  if (!extracted) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          {t('quotes.scan.processing')}
        </CardContent>
      </Card>
    );
  }

  const lineConfidence = (idx: number) => {
    const ec = extracted.lineItems[idx];
    if (!ec) return null;
    return Math.round(
      (ec.description.confidence + ec.quantity.confidence + ec.unitPrice.confidence) / 3,
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">{t('quotes.scan.reviewTitle')}</CardTitle>
        <div className="flex items-center gap-2">
          {overall >= 80 ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          )}
          <span className="text-sm text-muted-foreground">
            {t('quotes.scan.overallConfidence')}:
          </span>
          <ConfidenceBadge confidence={overall} />
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <section>
          <h3 className="mb-2 text-sm font-semibold">{t('quotes.scan.vendorSection')}</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <FieldRow label={t('quotes.vendor')} field={extracted.vendorName} />
            <FieldRow label={t('quotes.scan.vendorVat')} field={extracted.vendorVat} />
            <FieldRow label={t('quotes.scan.vendorPhone')} field={extracted.vendorPhone} />
            <FieldRow label={t('quotes.scan.vendorEmail')} field={extracted.vendorEmail} />
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold">{t('quotes.scan.metaSection')}</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <FieldRow label={t('quotes.scan.quoteDate')} field={extracted.quoteDate} />
            <FieldRow label={t('quotes.validUntil')} field={extracted.validUntil} />
            <FieldRow label={t('quotes.scan.quoteReference')} field={extracted.quoteReference} />
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">{t('quotes.scan.linesSection')}</h3>
            <span className="text-xs text-muted-foreground">{t('quotes.scan.editableHint')}</span>
          </div>
          {lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('quotes.scan.noLinesExtracted')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="pb-1 pr-2 text-left font-normal">{t('quotes.lineDescription')}</th>
                    <th className="pb-1 pr-2 text-left font-normal">{t('quotes.quantity')}</th>
                    <th className="pb-1 pr-2 text-left font-normal">{t('quotes.unit')}</th>
                    <th className="pb-1 pr-2 text-left font-normal">{t('quotes.unitPrice')}</th>
                    <th className="pb-1 pr-2 text-right font-normal">{t('quotes.lineTotal')}</th>
                    <th className="pb-1 pr-2 text-center font-normal">{t('quotes.scan.confidence')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, i) => {
                    const conf = lineConfidence(i);
                    return (
                      <tr key={line.id} className="border-b text-sm">
                        <td className="py-1 pr-2">
                          <Input
                            value={line.description}
                            onChange={(e) => updateLine(i, 'description', e.target.value)}
                            className="h-8 text-sm"
                          />
                        </td>
                        <td className="py-1 pr-2 w-20">
                          <Input
                            type="number"
                            value={line.quantity}
                            onChange={(e) => updateLine(i, 'quantity', parseFloat(e.target.value) || 0)}
                            className="h-8 text-sm"
                            min={0}
                          />
                        </td>
                        <td className="py-1 pr-2 w-20">
                          <Input
                            value={line.unit}
                            onChange={(e) => updateLine(i, 'unit', e.target.value)}
                            className="h-8 text-sm"
                          />
                        </td>
                        <td className="py-1 pr-2 w-24">
                          <Input
                            type="number"
                            value={line.unitPrice}
                            onChange={(e) => updateLine(i, 'unitPrice', parseFloat(e.target.value) || 0)}
                            className="h-8 text-sm"
                            min={0}
                            step={0.01}
                          />
                        </td>
                        <td className="py-1 pr-2 w-24 text-right font-medium">{line.lineTotal.toFixed(2)}</td>
                        <td className="py-1 pr-2 w-20 text-center">
                          {conf !== null && <ConfidenceBadge confidence={conf} />}
                        </td>
                        <td className="py-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => removeLine(i)}>
                            <X className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-2 flex justify-end gap-4 text-sm">
            <span className="text-muted-foreground">{t('quotes.subtotal')}: {totals.subtotal.toFixed(2)}</span>
            <span className="text-muted-foreground">{t('quotes.vatAmount')}: {totals.vatAmount.toFixed(2)}</span>
            <span className="font-semibold">{t('quotes.total')}: {totals.total.toFixed(2)} €</span>
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold">{t('quotes.scan.termsSection')}</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <FieldRow label={t('quotes.paymentTerms')} field={extracted.paymentTerms} />
            <FieldRow label={t('quotes.deliveryTerms')} field={extracted.deliveryTerms} />
            <FieldRow label={t('quotes.scan.warranty')} field={extracted.warranty} />
            <FieldRow label={t('quotes.notes')} field={extracted.notes} />
          </div>
        </section>

        <div className="flex justify-end gap-2 pt-2">
          {onReject && (
            <Button variant="ghost" onClick={() => onReject()} disabled={isSaving}>
              <X className="mr-1 h-4 w-4" />
              {t('quotes.scan.reject')}
            </Button>
          )}
          <Button onClick={() => onConfirm(lines)} disabled={isSaving}>
            <Save className="mr-1 h-4 w-4" />
            {t('quotes.scan.confirm')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

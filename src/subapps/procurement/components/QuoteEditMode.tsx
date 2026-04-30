'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock, Save, X } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { QuoteLineEditorTable } from './QuoteLineEditorTable';
import { computeQuoteTotals } from '../types/quote';
import type { Quote, QuoteLine, UpdateQuoteDTO } from '../types/quote';

// ============================================================================
// CONFIDENCE HELPERS — ADR-333 Q4 (≥85 high, 60-84 medium, <60 low)
// ============================================================================

function confidenceBorderClass(confidence: number): string {
  if (confidence >= 85) return 'border-l-4 border-l-green-500 pl-2';
  if (confidence >= 60) return 'border-l-4 border-l-yellow-500 pl-2';
  return 'border-l-4 border-l-red-500 pl-2';
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  if (confidence >= 85) {
    return <Badge variant="outline" className="border-green-500 text-green-700 dark:text-green-400 text-[10px]">{confidence}%</Badge>;
  }
  if (confidence >= 60) {
    return <Badge variant="outline" className="border-yellow-500 text-yellow-700 dark:text-yellow-400 text-[10px]">{confidence}%</Badge>;
  }
  return <Badge variant="outline" className="border-red-500 text-red-700 dark:text-red-400 text-[10px]">{confidence}%</Badge>;
}

// ============================================================================
// HELPERS
// ============================================================================

function timestampToDateStr(ts: unknown): string {
  if (!ts) return '';
  if (typeof ts === 'object' && ts !== null && 'seconds' in ts) {
    return new Date((ts as { seconds: number }).seconds * 1000).toISOString().split('T')[0];
  }
  return '';
}

function resolveFlag(topLevel: boolean | null | undefined, extracted: boolean | null | undefined): boolean | null {
  if (topLevel !== undefined && topLevel !== null) return topLevel;
  return extracted ?? null;
}

// ============================================================================
// PROPS
// ============================================================================

export interface QuoteEditModeProps {
  quote: Quote;
  onCancel: () => void;
  onSaved: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function QuoteEditMode({ quote, onCancel, onSaved }: QuoteEditModeProps) {
  const { t } = useTranslation('quotes');

  const [validUntil, setValidUntil] = useState(() => timestampToDateStr(quote.validUntil));
  const [paymentTerms, setPaymentTerms] = useState(quote.paymentTerms ?? '');
  const [deliveryTerms, setDeliveryTerms] = useState(quote.deliveryTerms ?? '');
  const [warranty, setWarranty] = useState(quote.warranty ?? '');
  const [vatIncluded, setVatIncluded] = useState<boolean | null>(
    () => resolveFlag(quote.vatIncluded, quote.extractedData?.vatIncluded?.value)
  );
  const [laborIncluded, setLaborIncluded] = useState<boolean | null>(
    () => resolveFlag(quote.laborIncluded, quote.extractedData?.laborIncluded?.value)
  );
  const [lines, setLines] = useState<QuoteLine[]>(quote.lines);
  const [lineErrors, setLineErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleValidationChange = useCallback((hasErrors: boolean) => {
    setLineErrors(hasErrors);
  }, []);

  const handleSave = useCallback(async () => {
    if (lineErrors) return;
    setSaving(true);
    setError(null);
    try {
      const dto: UpdateQuoteDTO = {
        lines,
        validUntil: validUntil || null,
        paymentTerms: paymentTerms || null,
        deliveryTerms: deliveryTerms || null,
        warranty: warranty || null,
        vatIncluded,
        laborIncluded,
      };
      const res = await fetch(`/api/quotes/${quote.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error ?? `Save failed (${res.status})`);
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('quotes.errors.updateFailed'));
    } finally {
      setSaving(false);
    }
  }, [quote.id, lines, validUntil, paymentTerms, deliveryTerms, warranty, vatIncluded, laborIncluded, lineErrors, onSaved, t]);

  const extractedData = quote.extractedData;
  const vatConf = extractedData?.vatIncluded?.confidence ?? null;
  const laborConf = extractedData?.laborIncluded?.confidence ?? null;
  const validUntilConf = extractedData?.validUntil?.confidence ?? null;
  const paymentConf = extractedData?.paymentTerms?.confidence ?? null;
  const deliveryConf = extractedData?.deliveryTerms?.confidence ?? null;
  const warrantyConf = extractedData?.warranty?.confidence ?? null;

  const totals = computeQuoteTotals(lines);

  return (
    <article className="flex flex-col gap-5 p-4 sm:p-6">
      {/* Toolbar */}
      <header className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{t('rfqs.editDialog.title')}</h2>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
            <X className="mr-1 h-4 w-4" />
            {t('rfqs.editDialog.cancel')}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || lineErrors}>
            <Save className="mr-1 h-4 w-4" />
            {saving ? t('rfqs.editDialog.saving') : t('rfqs.editDialog.save')}
          </Button>
        </div>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Header fields */}
      <section aria-label={t('rfqs.editDialog.headerSection')} className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground">{t('rfqs.editDialog.headerSection')}</h3>

        <FieldRow
          id="edit-validUntil"
          label={t('quotes.validUntil')}
          confidence={validUntilConf}
        >
          <Input
            id="edit-validUntil"
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            className="h-8 text-sm"
          />
        </FieldRow>

        <FieldRow
          id="edit-paymentTerms"
          label={t('quotes.paymentTerms')}
          confidence={paymentConf}
        >
          <Input
            id="edit-paymentTerms"
            value={paymentTerms}
            onChange={(e) => setPaymentTerms(e.target.value)}
            placeholder={t('rfqs.editDialog.placeholders.paymentTerms')}
            className="h-8 text-sm"
          />
        </FieldRow>

        <FieldRow
          id="edit-deliveryTerms"
          label={t('quotes.deliveryTerms')}
          confidence={deliveryConf}
        >
          <Input
            id="edit-deliveryTerms"
            value={deliveryTerms}
            onChange={(e) => setDeliveryTerms(e.target.value)}
            placeholder={t('rfqs.editDialog.placeholders.deliveryTerms')}
            className="h-8 text-sm"
          />
        </FieldRow>

        <FieldRow
          id="edit-warranty"
          label={t('quotes.warranty')}
          confidence={warrantyConf}
        >
          <Input
            id="edit-warranty"
            value={warranty}
            onChange={(e) => setWarranty(e.target.value)}
            placeholder={t('rfqs.editDialog.placeholders.warranty')}
            className="h-8 text-sm"
          />
        </FieldRow>
      </section>

      {/* Inclusions */}
      <section aria-label={t('rfqs.editDialog.inclusionsSection')} className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground">{t('rfqs.editDialog.inclusionsSection')}</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <InclusionToggle
            id="edit-vatIncluded"
            label={t('rfqs.editDialog.vatIncluded')}
            confidence={vatConf}
            value={vatIncluded}
            onChange={setVatIncluded}
          />
          <InclusionToggle
            id="edit-laborIncluded"
            label={t('rfqs.editDialog.laborIncluded')}
            confidence={laborConf}
            value={laborIncluded}
            onChange={setLaborIncluded}
          />
        </div>
      </section>

      {/* Lines */}
      <section aria-label={t('rfqs.editDialog.linesSection')} className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground">{t('rfqs.editDialog.linesSection')}</h3>
        <QuoteLineEditorTable
          lines={lines}
          extractedLineItems={extractedData?.lineItems}
          vatIncluded={vatIncluded}
          onChange={setLines}
          onValidationChange={handleValidationChange}
        />
        <div className="rounded-md bg-muted/30 p-3 text-sm">
          <div className="grid grid-cols-2 gap-1">
            <span className="text-muted-foreground">{t('quotes.subtotal')}</span>
            <span className="text-right">{totals.subtotal.toFixed(2)}</span>
            <span className="text-muted-foreground">{t('quotes.vatAmount')} ({totals.vatRate}%)</span>
            <span className="text-right">{totals.vatAmount.toFixed(2)}</span>
            <span className="font-semibold">{t('quotes.total')}</span>
            <span className="text-right font-bold">{totals.total.toFixed(2)}</span>
          </div>
        </div>
      </section>
    </article>
  );
}

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

interface FieldRowProps {
  id: string;
  label: string;
  confidence: number | null;
  children: React.ReactNode;
}

function FieldRow({ id, label, confidence, children }: FieldRowProps) {
  return (
    <div className={`space-y-1 ${confidence !== null ? confidenceBorderClass(confidence) : ''}`}>
      <div className="flex items-center gap-2">
        <Label htmlFor={id} className="text-sm">{label}</Label>
        {confidence !== null && <ConfidenceBadge confidence={confidence} />}
      </div>
      {children}
    </div>
  );
}

interface InclusionToggleProps {
  id: string;
  label: string;
  confidence: number | null;
  value: boolean | null;
  onChange: (v: boolean | null) => void;
}

function InclusionToggle({ id, label, confidence, value, onChange }: InclusionToggleProps) {
  return (
    <div className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 ${confidence !== null ? confidenceBorderClass(confidence) : ''}`}>
      <div className="flex items-center gap-2">
        <Label htmlFor={id} className="text-sm cursor-pointer">{label}</Label>
        {confidence !== null && <ConfidenceBadge confidence={confidence} />}
        {value === null && (
          <Lock className="h-3 w-3 text-muted-foreground" aria-label="unknown" />
        )}
      </div>
      <Switch
        id={id}
        checked={value === true}
        onCheckedChange={(checked) => onChange(checked)}
      />
    </div>
  );
}

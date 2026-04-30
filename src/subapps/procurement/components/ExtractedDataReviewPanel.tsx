'use client';

/**
 * ExtractedDataReviewPanel — ADR-327 §6 (Phase 2).
 *
 * Renders AI-extracted quote fields with per-field confidence highlighting:
 *   - green ≥ 80, yellow 50-79, red < 50, gray = no value.
 *
 * Lines are editable via QuoteLineEditorTable (Phase 13 — §5.Z validation).
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, Loader2, Save, X } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { computeQuoteTotals } from '@/subapps/procurement/types/quote';
import { detectVendorMismatch } from '@/subapps/procurement/utils/vendor-mismatch';
import { validateQuote } from '@/subapps/procurement/utils/quote-validation';
import { QuoteLineEditorTable } from '@/subapps/procurement/components/QuoteLineEditorTable';
import { SignatoryProposalCard } from '@/subapps/procurement/components/signatory/SignatoryProposalCard';
import { formatEuro } from '@/lib/number/greek-decimal';
import type {
  ExtractedQuoteData,
  FieldWithConfidence,
  QuoteLine,
  Quote,
} from '@/subapps/procurement/types/quote';
import type { Contact } from '@/types/contacts';

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
  const display = field.value === null || field.value === '' ? '—' : String(field.value);

  return (
    <div className={`rounded-md px-3 py-2 ${levelClasses(level)}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <Label className="text-xs text-muted-foreground">{label}</Label>
          <p className="break-words text-sm font-medium">{display}</p>
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
  supplierContact?: Contact | null;
  onConfirm: (lines: QuoteLine[]) => Promise<void> | void;
  onReject?: () => Promise<void> | void;
  onGoBack?: () => void;
  onSwitchVendor?: (
    name: string | null,
    vat: string | null,
    phone: string | null,
    emails: string[],
    vendorAddress: string | null,
    vendorCity: string | null,
    vendorPostalCode: string | null,
    vendorCountry: string | null,
    bankAccounts: Array<{ bankName: string; bic: string | null; iban: string; currency: string | null; accountHolder: string | null }>,
    logoUrl: string | null,
  ) => Promise<void>;
  isSaving?: boolean;
  isSwitchingVendor?: boolean;
}

export function ExtractedDataReviewPanel({
  quote,
  supplierContact,
  onConfirm,
  onReject,
  onGoBack,
  onSwitchVendor,
  isSaving = false,
  isSwitchingVendor = false,
}: ExtractedDataReviewPanelProps) {
  const { t } = useTranslation('quotes');
  const extracted = quote.extractedData;
  const [lines, setLines] = useState<QuoteLine[]>(quote.lines);
  const [mismatchDismissed, setMismatchDismissed] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [hasLineErrors, setHasLineErrors] = useState(false);
  const savedLinesRef = useRef<QuoteLine[]>(quote.lines);

  const overall = extracted?.overallConfidence ?? 0;
  const totals = useMemo(() => computeQuoteTotals(lines), [lines]);

  const isDirty = useMemo(() => {
    const saved = savedLinesRef.current;
    if (lines.length !== saved.length) return true;
    return lines.some((line, i) => {
      const s = saved[i];
      return (
        line.description !== s.description ||
        line.quantity !== s.quantity ||
        line.unit !== s.unit ||
        line.unitPrice !== s.unitPrice
      );
    });
  }, [lines]);

  const quoteValidation = useMemo(
    () => validateQuote(lines, extracted?.totalAmount?.value ?? null),
    [lines, extracted],
  );

  const hasWarnings = quoteValidation.hasWarnings;
  const showWarningBanner = hasWarnings && !bannerDismissed;

  const handleLinesChange = useCallback((newLines: QuoteLine[]) => {
    setLines(newLines);
    setBannerDismissed(false);
  }, []);

  const handleValidationChange = useCallback((hasErrors: boolean) => {
    setHasLineErrors(hasErrors);
  }, []);

  const mismatch = useMemo(() => {
    if (!extracted || !supplierContact) return null;
    return detectVendorMismatch(extracted, supplierContact);
  }, [extracted, supplierContact]);

  const showMismatchBanner = !mismatchDismissed && mismatch?.hasMismatch;

  if (!extracted) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          {t('quotes.scan.processing')}
        </CardContent>
      </Card>
    );
  }

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
          <span className="text-sm text-muted-foreground">{t('quotes.scan.overallConfidence')}:</span>
          <ConfidenceBadge confidence={overall} />
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {showMismatchBanner && mismatch && (
          <div className="flex flex-col gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-950/40">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                  {t('quotes.scan.vendorMismatch.title')}
                </p>
                <p className="mt-0.5 break-words text-sm text-amber-700 dark:text-amber-400">
                  {mismatch.type === 'vat'
                    ? t('quotes.scan.vendorMismatch.bodyVat', {
                        extractedVat: mismatch.extractedVat ?? '—',
                        extractedName: mismatch.extractedVendorName ?? '—',
                      })
                    : t('quotes.scan.vendorMismatch.bodyName', { extractedName: mismatch.extractedVendorName ?? '—' })}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              {onSwitchVendor && mismatch.extractedVendorName && (
                <Button
                  size="sm"
                  className="bg-amber-600 text-white hover:bg-amber-700"
                  disabled={isSwitchingVendor || isSaving}
                  onClick={() =>
                    void onSwitchVendor(
                      mismatch.extractedVendorName,
                      mismatch.extractedVat,
                      extracted?.vendorPhone.value ?? null,
                      extracted?.vendorEmails?.value ?? [],
                      extracted?.vendorAddress.value ?? null,
                      extracted?.vendorCity.value ?? null,
                      extracted?.vendorPostalCode.value ?? null,
                      extracted?.vendorCountry.value ?? null,
                      extracted?.vendorBankAccounts ?? [],
                      extracted?.vendorLogoUrl ?? null,
                    )
                  }
                >
                  {isSwitchingVendor ? (
                    <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />{t('quotes.scan.vendorMismatch.switching')}</>
                  ) : (
                    t('quotes.scan.vendorMismatch.switchVendor', { name: mismatch.extractedVendorName })
                  )}
                </Button>
              )}
              {onGoBack && (
                <Button size="sm" variant="outline" disabled={isSwitchingVendor} onClick={onGoBack}>
                  {t('quotes.scan.vendorMismatch.goBack')}
                </Button>
              )}
              <Button size="sm" variant="ghost" className="text-amber-700 hover:text-amber-900 dark:text-amber-400" disabled={isSwitchingVendor} onClick={() => setMismatchDismissed(true)}>
                {t('quotes.scan.vendorMismatch.dismiss')}
              </Button>
            </div>
          </div>
        )}

        <section>
          <h3 className="mb-2 text-sm font-semibold">{t('quotes.scan.vendorSection')}</h3>
          {extracted.vendorLogoUrl && (
            <div className="mb-3 flex items-center gap-3 rounded-md border bg-muted/20 px-3 py-2">
              <img src={extracted.vendorLogoUrl} alt="vendor logo" className="h-12 max-w-[180px] rounded object-contain" />
              <span className="text-xs text-muted-foreground">{t('quotes.scan.vendorLogoPreview')}</span>
            </div>
          )}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <FieldRow label={t('quotes.vendor')} field={extracted.vendorName} />
            <FieldRow label={t('quotes.scan.vendorVat')} field={extracted.vendorVat} />
            <FieldRow label={t('quotes.scan.vendorPhone')} field={extracted.vendorPhone} />
            <FieldRow
              label={t('quotes.scan.vendorEmail')}
              field={{ value: extracted.vendorEmails?.value?.join(', ') || null, confidence: extracted.vendorEmails?.confidence ?? 0 }}
            />
          </div>
        </section>

        {extracted.signatory && (
          extracted.signatory.firstName.value ||
          extracted.signatory.lastName.value ||
          extracted.signatory.mobile.value ||
          extracted.signatory.email.value ||
          extracted.signatory.role.value ||
          extracted.signatory.profession.value ||
          extracted.signatory.vatNumber.value
        ) ? (
          <section>
            <SignatoryProposalCard quoteId={quote.id} signatory={extracted.signatory} />
          </section>
        ) : null}

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
          <QuoteLineEditorTable
            lines={lines}
            extractedLineItems={extracted.lineItems}
            vatIncluded={extracted.vatIncluded?.value}
            onChange={handleLinesChange}
            onValidationChange={handleValidationChange}
          />
          <div className="mt-2 flex justify-end gap-4 text-sm">
            <span className="text-muted-foreground">{t('quotes.subtotal')}: {totals.subtotal.toFixed(2)}</span>
            <span className="text-muted-foreground">{t('quotes.vatAmount')}: {totals.vatAmount.toFixed(2)}</span>
            <span className="font-semibold">
              {t('quotes.total')}: {extracted?.totalAmount?.value != null && totals.total === 0
                ? extracted.totalAmount.value.toFixed(2)
                : totals.total.toFixed(2)} €
            </span>
          </div>
          {extracted && (
            <div className="mt-1.5 flex flex-wrap justify-end gap-1.5">
              {extracted.pricingType?.value === 'lump_sum' && (
                <Badge variant="secondary" className="text-xs">{t('quotes.scan.pricingTypeLumpSum')}</Badge>
              )}
              {extracted.vatIncluded?.value === true && (
                <Badge variant="outline" className="border-blue-400 text-blue-700 dark:text-blue-400 text-xs">{t('quotes.scan.vatIncludedYes')}</Badge>
              )}
              {extracted.vatIncluded?.value === false && (
                <Badge variant="outline" className="border-orange-400 text-orange-700 dark:text-orange-400 text-xs">{t('quotes.scan.vatIncludedNo')}</Badge>
              )}
              {extracted.vatIncluded?.value === null && (
                <Badge variant="outline" className="border-muted-foreground/40 text-muted-foreground text-xs">{t('quotes.scan.vatIncludedUnknown')}</Badge>
              )}
              {extracted.laborIncluded?.value === true && (
                <Badge variant="outline" className="border-green-500 text-green-700 dark:text-green-400 text-xs">{t('quotes.scan.laborIncludedYes')}</Badge>
              )}
              {extracted.laborIncluded?.value === false && (
                <Badge variant="outline" className="border-red-400 text-red-700 dark:text-red-400 text-xs">{t('quotes.scan.laborIncludedNo')}</Badge>
              )}
              {extracted.laborIncluded?.value === null && (
                <Badge variant="outline" className="border-muted-foreground/40 text-muted-foreground text-xs">{t('quotes.scan.laborIncludedUnknown')}</Badge>
              )}
            </div>
          )}
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

        {showWarningBanner && quoteValidation.warnings.linesSumMismatch && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-950/40">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-sm text-amber-800 dark:text-amber-300">
                {t('rfqs.quoteEdit.warning.linesSumMismatch', {
                  sum: formatEuro(quoteValidation.warnings.linesSumMismatch.sum),
                  stated: formatEuro(quoteValidation.warnings.linesSumMismatch.stated),
                })}
              </p>
            </div>
            <div className="mt-2 flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setBannerDismissed(true)}>
                {t('rfqs.lineEdit.warning.fixButton')}
              </Button>
              <Button size="sm" onClick={() => onConfirm(lines)} disabled={isSaving}>
                {t('rfqs.lineEdit.warning.saveAnywayButton')}
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          {onReject && (
            <div className="flex items-center gap-1">
              <Button variant="outline" onClick={() => onReject()} disabled={isSaving}>
                <X className="mr-1 h-4 w-4" />
                {t('quotes.scan.archive')}
              </Button>
              <InfoTooltip content={t('quotes.scan.archiveTooltip')} side="top" />
            </div>
          )}
          <div className="flex items-center gap-1">
            <Button
              onClick={() => onConfirm(lines)}
              disabled={isSaving || hasLineErrors || (quote.status === 'under_review' && !isDirty)}
            >
              <Save className="mr-1 h-4 w-4" />
              {t('quotes.scan.confirm')}
            </Button>
            <InfoTooltip content={t('quotes.scan.confirmTooltip')} side="top" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

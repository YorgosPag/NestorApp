'use client';

/**
 * QuoteDetailSummary — view-only detail card per split layout su /procurement/quotes
 *
 * Mostra info essenziali del quote selezionato (vendor, source/trade, totals,
 * lines preview, terms). Header (displayNumber + status badge + actions
 * "+Νέα/Επεξεργασία/Αρχειοθέτηση") vive ora nel `QuoteDetailsHeader` SSoT
 * sopra questo componente — niente duplicate header.
 *
 * @see ADR-267 §Phase H — Quote Detail Header SSoT
 * @see QuoteDetailsHeader
 */

import { FileText } from 'lucide-react';
import { formatCurrency } from '@/lib/intl-formatting';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useAuth } from '@/auth/hooks/useAuth';
import { QuoteOriginalDocumentPanel } from '@/subapps/procurement/components/QuoteOriginalDocumentPanel';
import type { Quote } from '@/subapps/procurement/types/quote';

const MAX_LINES_PREVIEW = 5;

interface QuoteDetailSummaryProps {
  quote: Quote;
}

function formatValidUntil(quote: Quote): string {
  if (!quote.validUntil) return '—';
  const ts = quote.validUntil as { seconds: number };
  return new Date(ts.seconds * 1000).toLocaleDateString('el-GR');
}

export function QuoteDetailSummary({ quote }: QuoteDetailSummaryProps) {
  const { t } = useTranslation('quotes');
  const { user } = useAuth();
  const companyId = user?.companyId ?? '';

  const visibleLines = quote.lines.slice(0, MAX_LINES_PREVIEW);
  const hiddenLinesCount = Math.max(0, quote.lines.length - MAX_LINES_PREVIEW);
  const vendorName = quote.extractedData?.vendorName?.value ?? t('quotes.vendor');

  return (
    <article
      className="flex flex-col h-full overflow-y-auto p-4 sm:p-6 gap-4"
      aria-label={t('quotes.titleSingle')}
    >
      <section
        aria-label={t('quotes.vendor')}
        className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b"
      >
        <div className="space-y-1 min-w-0">
          <h2 className="text-lg font-semibold truncate">{vendorName}</h2>
          <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
            <span>{t(`quotes.sources.${quote.source}`)}</span>
            <span>·</span>
            <span>{t(`trades.${quote.trade}`)}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-2xl font-bold">{formatCurrency(quote.totals.total)}</span>
          <span className="text-xs text-muted-foreground">
            {t('quotes.validUntil')}: {formatValidUntil(quote)}
          </span>
        </div>
      </section>

      <section aria-label={t('quotes.lines')} className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
          <FileText className="h-4 w-4" />
          {t('quotes.lines')} ({quote.lines.length})
        </h3>
        {quote.lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">—</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {visibleLines.map((line) => (
              <li
                key={line.id}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <span className="flex-1 truncate">{line.description}</span>
                <span className="text-muted-foreground whitespace-nowrap">
                  {line.quantity} {line.unit}
                </span>
                <span className="font-medium whitespace-nowrap">
                  {formatCurrency(line.lineTotal)}
                </span>
              </li>
            ))}
            {hiddenLinesCount > 0 && (
              <li className="px-3 py-2 text-xs text-muted-foreground italic">
                {t('detail.moreLines', { count: hiddenLinesCount })}
              </li>
            )}
          </ul>
        )}
      </section>

      <section
        aria-label={t('quotes.subtotal')}
        className="grid grid-cols-2 gap-2 text-sm rounded-md bg-muted/30 p-3"
      >
        <span className="text-muted-foreground">{t('quotes.subtotal')}</span>
        <span className="text-right font-medium">{formatCurrency(quote.totals.subtotal)}</span>
        <span className="text-muted-foreground">{t('quotes.vatAmount')} ({quote.totals.vatRate}%)</span>
        <span className="text-right font-medium">{formatCurrency(quote.totals.vatAmount)}</span>
        <span className="font-semibold">{t('quotes.total')}</span>
        <span className="text-right font-bold">{formatCurrency(quote.totals.total)}</span>
      </section>

      {companyId && (
        <QuoteOriginalDocumentPanel
          quoteId={quote.id}
          companyId={companyId}
          compact
        />
      )}

      {(quote.paymentTerms || quote.deliveryTerms || quote.warranty) && (
        <section aria-label={t('quotes.paymentTerms')} className="space-y-2 text-sm">
          {quote.paymentTerms && (
            <div className="grid grid-cols-[120px_1fr] gap-2">
              <span className="text-muted-foreground">{t('quotes.paymentTerms')}:</span>
              <span>{quote.paymentTerms}</span>
            </div>
          )}
          {quote.deliveryTerms && (
            <div className="grid grid-cols-[120px_1fr] gap-2">
              <span className="text-muted-foreground">{t('quotes.deliveryTerms')}:</span>
              <span>{quote.deliveryTerms}</span>
            </div>
          )}
          {quote.warranty && (
            <div className="grid grid-cols-[120px_1fr] gap-2">
              <span className="text-muted-foreground">{t('quotes.warranty')}:</span>
              <span>{quote.warranty}</span>
            </div>
          )}
        </section>
      )}
    </article>
  );
}

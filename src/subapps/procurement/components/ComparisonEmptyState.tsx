'use client';

import { BarChart3, Plus, ScanLine, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { QuoteStatusBadge } from '@/subapps/procurement/components/QuoteStatusBadge';
import { formatCurrency } from '@/lib/intl-formatting';
import type { Quote } from '@/subapps/procurement/types/quote';

interface ComparisonEmptyStateProps {
  quotes: Quote[];
  onNewQuote: () => void;
  onScan: () => void;
  onViewInvites: () => void;
  onViewQuoteDetails: (quoteId: string) => void;
}

export function ComparisonEmptyState({
  quotes,
  onNewQuote,
  onScan,
  onViewInvites,
  onViewQuoteDetails,
}: ComparisonEmptyStateProps) {
  const { t } = useTranslation('quotes');
  const singleQuote = quotes.length === 1 ? quotes[0] : null;

  const vendorName =
    singleQuote?.extractedData?.vendorName?.value ?? t('quotes.vendor');
  const deliveryTerms = singleQuote?.deliveryTerms ?? null;

  return (
    <div className="flex flex-col items-center gap-6 py-12 text-center">
      <BarChart3 className="size-14 text-muted-foreground/40" />

      <div className="space-y-2">
        <h3 className="text-base font-semibold">
          {singleQuote
            ? t('rfqs.comparison.empty.one.title')
            : t('rfqs.comparison.empty.zero.title')}
        </h3>
        <p className="max-w-md text-sm text-muted-foreground">
          {singleQuote
            ? t('rfqs.comparison.empty.one.body')
            : t('rfqs.comparison.empty.zero.body')}
        </p>
      </div>

      {singleQuote && (
        <Card className="w-full max-w-sm text-left">
          <CardContent className="pt-4 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t('rfqs.comparison.empty.one.currentLabel')}
            </p>
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1 min-w-0">
                <p className="font-semibold truncate">{vendorName}</p>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(singleQuote.totals.total)}
                  {deliveryTerms && (
                    <span>{' · '}{deliveryTerms}</span>
                  )}
                </p>
              </div>
              <QuoteStatusBadge status={singleQuote.status} />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => onViewQuoteDetails(singleQuote.id)}
            >
              {t('rfqs.comparison.empty.one.viewDetails')}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap justify-center gap-2">
        <Button size="sm" onClick={onNewQuote}>
          <Plus className="mr-1 size-4" />
          {t('quotes.create')}
        </Button>
        <Button variant="outline" size="sm" onClick={onScan}>
          <ScanLine className="mr-1 size-4" />
          {t('quotes.scan.scanFromRfq')}
        </Button>
        <Button variant="outline" size="sm" onClick={onViewInvites}>
          <Users className="mr-1 size-4" />
          {t('rfqs.actions.activate')}
        </Button>
      </div>
    </div>
  );
}

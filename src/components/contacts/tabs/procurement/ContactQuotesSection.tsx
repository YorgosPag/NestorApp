'use client';

import { useRouter } from '@/lib/workspace/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ProcurementRowLink,
  ProcurementTableNotice,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/procurement/shared/procurement-table-parts';
import { Plus } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrency, formatDate } from '@/lib/intl-formatting';
import { normalizeToDate } from '@/lib/date-local';
import { QuoteStatusBadge } from '@/subapps/procurement/components/QuoteStatusBadge';
import type { Quote } from '@/subapps/procurement/types/quote';

interface ContactQuotesSectionProps {
  quotes: Quote[];
  loading: boolean;
  archived: boolean;
  contactId: string;
  onCreateManual?: () => void;
}

function timestampToDate(ts: unknown): string {
  const date = normalizeToDate(ts);
  return date ? formatDate(date) : '—';
}

export function ContactQuotesSection({
  quotes,
  loading,
  archived,
  contactId: _contactId,
  onCreateManual,
}: ContactQuotesSectionProps) {
  const { t } = useTranslation(['contacts', 'quotes']);
  const router = useRouter();

  const handleView = (quoteId: string) =>
    router.push(`/procurement/quotes/${quoteId}/review`);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">
          {t('contacts:procurementTab.sections.quotes')}
        </CardTitle>
        {!archived && (
          <Button size="sm" variant="outline" onClick={() => onCreateManual?.()}>
            <Plus className="mr-1 h-4 w-4" />
            {t('quotes:quotes.create')}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <ProcurementTableNotice>
            {t('quotes:quotes.loading')}
          </ProcurementTableNotice>
        ) : quotes.length === 0 ? (
          <ProcurementTableNotice>
            {t('quotes:quotes.empty')}
          </ProcurementTableNotice>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('quotes:quotes.number')}</TableHead>
                <TableHead>{t('quotes:quotes.status')}</TableHead>
                <TableHead>{t('quotes:quotes.createdAt')}</TableHead>
                <TableHead className="text-right">
                  {t('quotes:quotes.total')}
                </TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.map((quote) => (
                <ProcurementRowLink
                  key={quote.id}
                  onClick={() => handleView(quote.id)}
                  testId={`quote-row-${quote.id}`}
                >
                  <TableCell className="font-mono text-sm">
                    {quote.displayNumber}
                  </TableCell>
                  <TableCell>
                    <QuoteStatusBadge status={quote.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {timestampToDate(quote.createdAt)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(quote.totals.total)}
                  </TableCell>
                </ProcurementRowLink>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

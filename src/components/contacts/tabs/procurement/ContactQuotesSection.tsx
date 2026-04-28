'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowRight, Plus } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrency, formatDate } from '@/lib/intl-formatting';
import { QuoteStatusBadge } from '@/subapps/procurement/components/QuoteStatusBadge';
import type { Quote } from '@/subapps/procurement/types/quote';

interface ContactQuotesSectionProps {
  quotes: Quote[];
  loading: boolean;
  archived: boolean;
  contactId: string;
}

function timestampToDate(ts: unknown): string {
  if (ts === null || ts === undefined) return '—';
  if (ts instanceof Date) {
    return isNaN(ts.getTime()) ? '—' : formatDate(ts);
  }
  if (typeof ts === 'string' || typeof ts === 'number') {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? '—' : formatDate(d);
  }
  if (typeof ts === 'object') {
    const obj = ts as { seconds?: unknown; _seconds?: unknown; toDate?: () => Date };
    if (typeof obj.toDate === 'function') {
      try {
        const d = obj.toDate();
        return isNaN(d.getTime()) ? '—' : formatDate(d);
      } catch {
        return '—';
      }
    }
    if (typeof obj.seconds === 'number') return formatDate(obj.seconds * 1000);
    if (typeof obj._seconds === 'number') return formatDate(obj._seconds * 1000);
  }
  return '—';
}

export function ContactQuotesSection({
  quotes,
  loading,
  archived,
  contactId,
}: ContactQuotesSectionProps) {
  const { t } = useTranslation(['contacts', 'quotes']);
  const router = useRouter();

  const handleView = (quoteId: string) =>
    router.push(`/procurement/quotes/${quoteId}/review`);

  const handleCreate = () =>
    router.push(
      `/procurement/quotes/new?vendorContactId=${encodeURIComponent(contactId)}`,
    );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">
          {t('contacts:procurementTab.sections.quotes')}
        </CardTitle>
        {!archived && (
          <Button size="sm" variant="outline" onClick={handleCreate}>
            <Plus className="mr-1 h-4 w-4" />
            {t('quotes:quotes.create')}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t('quotes:quotes.loading')}
          </p>
        ) : quotes.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t('quotes:quotes.empty')}
          </p>
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
                <TableRow
                  key={quote.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleView(quote.id)}
                  data-testid={`quote-row-${quote.id}`}
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
                  <TableCell>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Search, Eye, Archive } from 'lucide-react';
import { cn } from '@/lib/design-system';
import { formatCurrency } from '@/lib/intl-formatting';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { QuoteStatusBadge } from './QuoteStatusBadge';
import type { Quote, QuoteStatus, QuoteSource } from '@/subapps/procurement/types/quote';
import type { TradeCode } from '@/subapps/procurement/types/trade';

// ============================================================================
// SOURCE BADGE
// ============================================================================

const SOURCE_VARIANTS: Record<QuoteSource, string> = {
  manual:      'bg-slate-100 text-slate-700',
  scan:        'bg-amber-100 text-amber-700',
  portal:      'bg-blue-100 text-blue-700',
  email_inbox: 'bg-purple-100 text-purple-700',
};

function SourceBadge({ source }: { source: QuoteSource }) {
  const { t } = useTranslation('quotes');
  return (
    <span className={cn('rounded px-1.5 py-0.5 text-xs font-medium', SOURCE_VARIANTS[source])}>
      {t(`quotes.sources.${source}`)}
    </span>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

interface QuoteListProps {
  quotes: Quote[];
  loading: boolean;
  onCreateNew?: () => void;
  onView?: (quoteId: string) => void;
  onArchive?: (quoteId: string) => void;
}

export function QuoteList({ quotes, loading, onCreateNew, onView, onArchive }: QuoteListProps) {
  const { t } = useTranslation('quotes');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | ''>('');
  const [tradeFilter, setTradeFilter] = useState<TradeCode | ''>('');

  const filtered = quotes.filter((q) => {
    if (statusFilter && q.status !== statusFilter) return false;
    if (tradeFilter && q.trade !== tradeFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return q.displayNumber.toLowerCase().includes(s) || q.trade.includes(s);
    }
    return true;
  });

  const hasActions = !!(onView || onArchive);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
        <CardTitle className="text-base">{t('quotes.title')}</CardTitle>
        {onCreateNew && (
          <Button size="sm" onClick={onCreateNew}>
            <Plus className="mr-1 h-4 w-4" />
            {t('quotes.create')}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder={t('quotes.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('quotes.loading')}</p>
        ) : filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('quotes.empty')}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('quotes.number')}</TableHead>
                <TableHead>{t('quotes.trade')}</TableHead>
                <TableHead>{t('quotes.source')}</TableHead>
                <TableHead>{t('quotes.status')}</TableHead>
                <TableHead className="text-right">{t('quotes.total')}</TableHead>
                <TableHead>{t('quotes.validUntil')}</TableHead>
                {hasActions && <TableHead className="w-[90px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((q) => (
                <TableRow
                  key={q.id}
                  className={cn(onView && 'cursor-pointer hover:bg-muted/50')}
                  onClick={onView ? () => onView(q.id) : undefined}
                >
                  <TableCell className="font-mono text-sm">{q.displayNumber}</TableCell>
                  <TableCell className="text-sm">{q.trade}</TableCell>
                  <TableCell>
                    <SourceBadge source={q.source} />
                  </TableCell>
                  <TableCell>
                    <QuoteStatusBadge status={q.status} />
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(q.totals.total)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {q.validUntil
                      ? new Date((q.validUntil as { seconds: number }).seconds * 1000).toLocaleDateString('el-GR')
                      : '—'}
                  </TableCell>
                  {hasActions && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1">
                        {onView && (
                          <Button variant="ghost" size="icon" onClick={() => onView(q.id)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        {onArchive && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => onArchive(q.id)}
                          >
                            <Archive className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

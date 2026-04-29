'use client';

import { Package, Users, Briefcase, Trophy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrency } from '@/lib/intl-formatting';
import type { SourcingEventAggregate } from '@/app/api/procurement/sourcing-events/[eventId]/aggregate/route';

interface SourcingEventSummaryCardProps {
  aggregate: SourcingEventAggregate | null;
  loading: boolean;
  currentRfqId: string;
}

export function SourcingEventSummaryCard({
  aggregate,
  loading,
  currentRfqId,
}: SourcingEventSummaryCardProps) {
  const { t } = useTranslation('quotes');

  if (loading) {
    return (
      <Card className="border-purple-200/60 bg-purple-50/30 dark:border-purple-800/40 dark:bg-purple-950/10">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-4 w-40" />
        </CardContent>
      </Card>
    );
  }

  if (!aggregate) return null;

  return (
    <Card className="border-purple-200/60 bg-purple-50/30 dark:border-purple-800/40 dark:bg-purple-950/10">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-purple-900 dark:text-purple-200">
          <Package className="h-5 w-5 shrink-0" />
          <span>{t('comparison.sourcingEvent.cardTitle')}</span>
          <span className="ml-1 font-normal text-muted-foreground">—</span>
          <span className="ml-1 font-medium">{aggregate.title}</span>
        </CardTitle>

        <div className="flex flex-wrap items-center gap-3 pt-1 text-sm text-muted-foreground">
          <StatPill icon={<Briefcase className="h-3.5 w-3.5" />}>
            {t('comparison.sourcingEvent.rfqsCount', { count: aggregate.rfqCount })}
          </StatPill>
          <StatPill icon={<Briefcase className="h-3.5 w-3.5" />}>
            {t('comparison.sourcingEvent.tradesCount', { count: aggregate.tradeCount })}
          </StatPill>
          <StatPill icon={<Users className="h-3.5 w-3.5" />}>
            {t('comparison.sourcingEvent.vendorsCount', { count: aggregate.uniqueVendorCount })}
          </StatPill>
          {aggregate.bestPackageTotal !== null && (
            <StatPill icon={<Trophy className="h-3.5 w-3.5 text-emerald-600" />}>
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                {t('comparison.sourcingEvent.bestTotal')}:{' '}
                {formatCurrency(aggregate.bestPackageTotal)}
              </span>
              {aggregate.isPartialTotal && (
                <span className="ml-1 text-xs text-amber-600">
                  ({t('comparison.sourcingEvent.partialHint')})
                </span>
              )}
            </StatPill>
          )}
        </div>
      </CardHeader>

      {aggregate.rfqs.length > 0 && (
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('comparison.sourcingEvent.tradeColumn')}</TableHead>
                <TableHead>{t('quotes.rfq')}</TableHead>
                <TableHead className="text-right">
                  {t('comparison.sourcingEvent.bestQuoteColumn')}
                </TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {aggregate.rfqs.map((row) => (
                <TableRow
                  key={row.rfqId}
                  className={
                    row.rfqId === currentRfqId
                      ? 'bg-purple-100/60 dark:bg-purple-900/20 font-medium'
                      : undefined
                  }
                >
                  <TableCell className="text-sm text-muted-foreground">
                    {row.trade ?? '—'}
                  </TableCell>
                  <TableCell className="text-sm">{row.title}</TableCell>
                  <TableCell className="text-right text-sm">
                    {row.bestQuoteTotal !== null
                      ? formatCurrency(row.bestQuoteTotal)
                      : t('comparison.sourcingEvent.noQuotes')}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.rfqId === currentRfqId && (
                      <Badge variant="outline" className="text-[10px] text-purple-700 border-purple-300">
                        {t('comparison.sourcingEvent.currentRfq')}
                      </Badge>
                    )}
                    {row.winnerQuoteId && (
                      <Trophy className="inline h-3.5 w-3.5 text-emerald-600 ml-1" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      )}
    </Card>
  );
}

function StatPill({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {icon}
      {children}
    </span>
  );
}

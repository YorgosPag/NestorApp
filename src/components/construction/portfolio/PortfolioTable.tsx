'use client';

import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { BuildingPortfolioItem } from '@/hooks/useConstructionPortfolio';

interface PortfolioTableProps {
  items: BuildingPortfolioItem[];
  loading?: boolean;
}

function MetricCell({ value, warn }: { value: number; warn: boolean }) {
  return (
    <span
      className={[
        'tabular-nums font-medium',
        warn
          ? 'text-[hsl(var(--text-error))]'
          : 'text-[hsl(var(--text-success))]',
      ].join(' ')}
    >
      {value.toFixed(2)}
    </span>
  );
}

export function PortfolioTable({ items, loading }: PortfolioTableProps) {
  const { t } = useTranslation('building-timeline');
  const router = useRouter();

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded bg-muted" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground">{t('portfolio.empty')}</p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('portfolio.table.building')}</TableHead>
          <TableHead className="w-32">{t('portfolio.table.progress')}</TableHead>
          <TableHead className="w-16 text-right">{t('portfolio.table.spi')}</TableHead>
          <TableHead className="w-16 text-right">{t('portfolio.table.cpi')}</TableHead>
          <TableHead className="w-24 text-right">{t('portfolio.table.delayedTasks')}</TableHead>
          <TableHead className="w-20 text-right">{t('portfolio.table.alerts')}</TableHead>
          <TableHead>{t('portfolio.table.nextMilestone')}</TableHead>
          <TableHead className="w-28">{t('portfolio.table.status')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map(item => (
          <TableRow
            key={item.buildingId}
            className="cursor-pointer hover:bg-muted/50"
            onClick={() =>
              router.push(`/buildings/${item.buildingId}?tab=timeline&view=dashboard`)
            }
          >
            <TableCell className="font-medium">{item.buildingName}</TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <Progress value={item.progress} className="h-2 w-24" />
                <span className="text-xs tabular-nums text-muted-foreground">
                  {item.progress}%
                </span>
              </div>
            </TableCell>
            <TableCell className="text-right">
              <MetricCell value={item.spi} warn={item.spi < 0.85} />
            </TableCell>
            <TableCell className="text-right">
              <MetricCell value={item.cpi} warn={item.cpi < 0.85} />
            </TableCell>
            <TableCell className="text-right">
              {item.delayedTasksCount > 0 ? (
                <span className="tabular-nums text-[hsl(var(--text-error))]">
                  {item.delayedTasksCount}
                </span>
              ) : (
                <span className="tabular-nums text-muted-foreground">0</span>
              )}
            </TableCell>
            <TableCell className="text-right">
              {item.activeAlertsCount > 0 ? (
                <Badge variant="destructive" className="tabular-nums">
                  {item.activeAlertsCount}
                </Badge>
              ) : (
                <span className="tabular-nums text-muted-foreground">0</span>
              )}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {item.nextMilestone
                ? `${item.nextMilestone.title} · ${item.nextMilestone.date}`
                : t('portfolio.table.noMilestone')}
            </TableCell>
            <TableCell>
              <Badge variant="outline" className="capitalize">
                {item.status}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

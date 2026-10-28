'use client';

/**
 * **Σύγκριση ανά γραμμή (bid leveling)** — ADR-327 §8.5. Γραμμές = ζητούμενες γραμμές RFQ, στήλες = προσφορές.
 *
 * Κάθε κελί λέει ΠΩΣ απάντησε η προσφορά (τιμή · περιλαμβάνεται · εξαιρείται · χωρίς απάντηση) και κάθε
 * ποσό που ΔΕΝ έδωσε ο προμηθευτής (κάλυψη κενού) δείχνει την πηγή του. Το κάτω μέρος είναι η αριθμητική του
 * εξισορροπημένου συνόλου — ο PM βλέπει γιατί η «φθηνότερη» προσφορά δεν είναι πάντα η φθηνότερη.
 *
 * @module subapps/procurement/components/BidLevelingTable
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Rows3, Trophy } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useUomLabel } from '@/hooks/useUomLabel';
import { formatCurrency, formatNumber } from '@/lib/intl-formatting';
import type {
  BidLevelingResult,
  LevelingCell,
  LevelingColumn,
  LevelingPlugSource,
  LevelingRow,
  LevelingRowCoverage,
} from '@/subapps/procurement/types/bid-leveling';
import type { QuoteComparisonEntry } from '@/subapps/procurement/types/comparison';
import { LevelingPlugEditor } from './LevelingPlugEditor';

interface Props {
  leveling: BidLevelingResult;
  /** Η σειρά και τα ονόματα των στηλών — από την ΙΔΙΑ σύγκριση (κατάταξη). */
  entries: readonly QuoteComparisonEntry[];
}

export function BidLevelingTable({ leveling, entries }: Props) {
  const { t } = useTranslation('quotes');
  const columns = new Map(leveling.columns.map((c) => [c.quoteId, c] as const));
  const ordered = entries.filter((e) => columns.has(e.quoteId));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Rows3 className="h-5 w-5" />
          {t('comparison.leveling.title')}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{t('comparison.leveling.subtitle')}</p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[220px]">{t('comparison.leveling.lineHeader')}</TableHead>
              {ordered.map((e) => <TableHead key={e.quoteId} className="min-w-[180px] text-right">{e.vendorName}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {leveling.rows.map((row) => <LevelingRowView key={row.rfqLineId} row={row} order={ordered} />)}
          </TableBody>
          <LevelingFooter columns={ordered.map((e) => columns.get(e.quoteId)).filter((c): c is LevelingColumn => !!c)} />
        </Table>
      </CardContent>
    </Card>
  );
}

function LevelingRowView({ row, order }: { row: LevelingRow; order: readonly QuoteComparisonEntry[] }) {
  const { t } = useTranslation('quotes');
  const uomLabel = useUomLabel();
  const coverageText: Readonly<Record<Exclude<LevelingRowCoverage, 'full'>, string>> = {
    partial: t('comparison.leveling.coverage.partial'),
    none: t('comparison.leveling.coverage.none'),
  };
  const cells = new Map(row.cells.map((c) => [c.quoteId, c] as const));
  return (
    <TableRow>
      <TableCell className="align-top">
        <p className="font-medium">{row.description}</p>
        {row.quantity != null && (
          <p className="text-xs text-muted-foreground">{formatNumber(row.quantity)} {uomLabel(row.unit)}</p>
        )}
        {row.coverage !== 'full' && (
          <Badge variant={row.coverage === 'none' ? 'destructive' : 'outline'} className="mt-1 text-[10px]">
            {coverageText[row.coverage]}
          </Badge>
        )}
      </TableCell>
      {order.map((e) => {
        const cell = cells.get(e.quoteId);
        return (
          <TableCell key={e.quoteId} className="align-top text-right">
            {cell ? <LevelingCellView cell={cell} isLowest={row.lowestQuoteId === e.quoteId} /> : null}
          </TableCell>
        );
      })}
    </TableRow>
  );
}

function LevelingCellView({ cell, isLowest }: { cell: LevelingCell; isLowest: boolean }) {
  return (
    <div className="flex flex-col items-end gap-0.5">
      {cell.state === 'priced' ? <PricedCell cell={cell} isLowest={isLowest} /> : <GapCell cell={cell} />}
      {cell.note && <span className="text-[10px] italic text-muted-foreground">{cell.note}</span>}
      {cell.alternates.map((alt) => <AlternateLine key={alt.lineId} description={alt.description} amount={alt.lineTotal} />)}
    </div>
  );
}

function PricedCell({ cell, isLowest }: { cell: LevelingCell; isLowest: boolean }) {
  const { t } = useTranslation('quotes');
  const uomLabel = useUomLabel();
  return (
    <>
      <span className={isLowest ? 'flex items-center gap-1 font-semibold text-[hsl(var(--text-success))]' : 'tabular-nums'}>
        {isLowest && <Trophy className="h-3 w-3" aria-label={t('comparison.leveling.lowest')} />}
        {formatCurrency(cell.leveledAmount ?? 0)}
      </span>
      <span className="text-[10px] text-muted-foreground tabular-nums">
        {formatNumber(cell.quantity ?? 0)} {uomLabel(cell.unit)} × {formatCurrency(cell.unitPrice ?? 0)}
      </span>
      {cell.unitMismatch && (
        <span className="text-[10px] text-[hsl(var(--text-warning))]">{t('comparison.leveling.unitMismatch')}</span>
      )}
      {cell.quantityDeviation !== null && cell.quantityDeviation !== 0 && (
        <span className="text-[10px] text-[hsl(var(--text-warning))]">
          {t('comparison.leveling.quantityDeviation', { quantity: formatNumber(cell.quantity ?? 0), unit: uomLabel(cell.unit) })}
        </span>
      )}
      {cell.binding === 'inferred' && (
        <span className="text-[10px] text-muted-foreground">{t('comparison.leveling.inferred')}</span>
      )}
    </>
  );
}

function GapCell({ cell }: { cell: LevelingCell }) {
  const { t } = useTranslation('quotes');
  const stateText: Readonly<Record<Exclude<LevelingCell['state'], 'priced'>, string>> = {
    included: t('comparison.leveling.state.included'),
    excluded: t('comparison.leveling.state.excluded'),
    unanswered: t('comparison.leveling.state.unanswered'),
  };
  const plugText: Readonly<Record<LevelingPlugSource, (amount: string) => string>> = {
    manual: (amount) => t('comparison.leveling.plug.manual', { amount }),
    estimate: (amount) => t('comparison.leveling.plug.estimate', { amount }),
    highest_bid: (amount) => t('comparison.leveling.plug.highestBid', { amount }),
  };
  if (cell.state === 'priced') return null;
  const isGap = cell.state !== 'included';
  return (
    <>
      <span className={isGap ? 'text-[hsl(var(--text-warning))]' : 'text-muted-foreground'}>{stateText[cell.state]}</span>
      {isGap && (
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {cell.plug ? plugText[cell.plug.source](formatCurrency(cell.plug.amount)) : t('comparison.leveling.plug.none')}
        </span>
      )}
      {isGap && cell.plug?.source === 'manual' && cell.plug.note && (
        <span className="text-[10px] italic text-muted-foreground">{cell.plug.note}</span>
      )}
      {isGap && <LevelingPlugEditor cell={cell} />}
    </>
  );
}

function AlternateLine({ description, amount }: { description: string; amount: number }) {
  const { t } = useTranslation('quotes');
  return (
    <span className="text-[10px] text-muted-foreground">
      {t('comparison.leveling.alternate', { description, amount: formatCurrency(amount) })}
    </span>
  );
}

function LevelingFooter({ columns }: { columns: readonly LevelingColumn[] }) {
  const { t } = useTranslation('quotes');
  const lines: ReadonlyArray<{ label: string; value: (c: LevelingColumn) => string; strong?: boolean }> = [
    { label: t('comparison.leveling.footer.submitted'), value: (c) => formatCurrency(c.submittedNet) },
    { label: t('comparison.leveling.footer.additional'), value: (c) => formatCurrency(c.additionalItems.amount) },
    { label: t('comparison.leveling.footer.plugs'), value: (c) => formatCurrency(c.plugs.amount) },
    { label: t('comparison.leveling.footer.leveled'), value: (c) => formatCurrency(c.leveledNet), strong: true },
  ];
  return (
    <TableFooter>
      {lines.map((line) => (
        <TableRow key={line.label}>
          <TableCell className={line.strong ? 'font-semibold' : 'text-muted-foreground'}>{line.label}</TableCell>
          {columns.map((c) => (
            <TableCell key={c.quoteId} className={line.strong ? 'text-right font-semibold tabular-nums' : 'text-right tabular-nums'}>
              {line.value(c)}
              {line.strong && <ColumnCaveat column={c} />}
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableFooter>
  );
}

/** Πότε το εξισορροπημένο σύνολο ΔΕΝ είναι πλήρες — ειπωμένο, ποτέ σιωπηλό. */
function ColumnCaveat({ column }: { column: LevelingColumn }) {
  const { t } = useTranslation('quotes');
  if (column.lumpSum) return <p className="text-[10px] font-normal text-muted-foreground">{t('comparison.leveling.footer.lumpSum')}</p>;
  if (column.unpluggedGaps === 0) return null;
  return (
    <p className="text-[10px] font-normal text-[hsl(var(--text-warning))]">
      {t('comparison.leveling.footer.unplugged', { count: column.unpluggedGaps })}
    </p>
  );
}

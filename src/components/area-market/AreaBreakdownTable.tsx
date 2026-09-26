'use client';

/**
 * **Ένας πίνακας ανάλυσης** — τιμή μονάδας ανά εμβαδόν / υπνοδωμάτια / όροφο (ADR-890 Φ1).
 *
 * 🏆 **Το πλήθος σε ΚΑΘΕ γραμμή, και η σιωπή ονομάζεται.** Κανείς από τους μεγάλους (Zillow, Redfin, Idealista,
 * Rightmove) δεν δείχνει από πόσες αγγελίες βγαίνει κάθε κελί· ο Redfin αφήνει απλώς κενό. Εδώ η γραμμή κάτω
 * από το κατώφλι **λέει** «λιγότερες από 5», και κάτω από τον πίνακα λέγεται πόσες αγγελίες δεν δήλωσαν τον άξονα.
 */

import React from 'react';

import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { MarketSegment } from '@/lib/market/market-segments';
import { isReportedStatCell, MARKET_STAT_MIN_SAMPLE } from '@/lib/market/market-statistics';
import type { AskingOffer } from '@/types/area-market';

import { unitPriceLabel } from './area-market-format';
import type { BreakdownRow, BreakdownView } from './area-market-view';

const NS = 'area-market';

interface AreaBreakdownTableProps {
  readonly offer: AskingOffer;
  readonly segment: MarketSegment;
  readonly view: BreakdownView;
}

function BreakdownTableRow({ offer, segment, axis, row }: { readonly offer: AskingOffer; readonly segment: MarketSegment; readonly axis: BreakdownView['axis']; readonly row: BreakdownRow }) {
  const { t } = useTranslation([NS, 'common']);
  const reported = isReportedStatCell(row.cell) ? row.cell : null;
  return (
    <TableRow>
      <TableHead scope="row" className="font-normal">{t(`${NS}:bucket.${axis}.${row.key}`)}</TableHead>
      <TableCell className="tabular-nums">
        {reported === null ? '—' : unitPriceLabel(t, offer, segment, reported.median)}
      </TableCell>
      <TableCell className="tabular-nums text-muted-foreground">
        {reported === null
          ? t(`${NS}:breakdown.belowThreshold`, { min: MARKET_STAT_MIN_SAMPLE })
          : `${unitPriceLabel(t, offer, segment, reported.p25)} – ${unitPriceLabel(t, offer, segment, reported.p75)}`}
      </TableCell>
      <TableCell className="text-right tabular-nums">{row.cell.n}</TableCell>
    </TableRow>
  );
}

export function AreaBreakdownTable({ offer, segment, view }: AreaBreakdownTableProps) {
  const { t } = useTranslation([NS]);
  return (
    <figure className="m-0 flex flex-col gap-1">
      <Table>
        <TableCaption className="mt-0 caption-top text-left font-medium text-foreground">
          {t(`${NS}:breakdown.${view.axis}`)}
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">{t(`${NS}:breakdown.columnBucket`)}</TableHead>
            <TableHead scope="col">{t(`${NS}:breakdown.columnMedian`)}</TableHead>
            <TableHead scope="col">{t(`${NS}:breakdown.columnRange`)}</TableHead>
            <TableHead scope="col" className="text-right">{t(`${NS}:breakdown.columnCount`)}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {view.rows.map((row) => (
            <BreakdownTableRow key={row.key} offer={offer} segment={segment} axis={view.axis} row={row} />
          ))}
        </TableBody>
      </Table>
      {view.undeclared > 0 && (
        <figcaption className="text-xs text-muted-foreground">
          {t(`${NS}:breakdown.undeclared`, { count: view.undeclared })}
        </figcaption>
      )}
    </figure>
  );
}

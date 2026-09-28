'use client';

/**
 * **Ένας πίνακας ανάλυσης** — τιμή μονάδας ανά κάδο: εμβαδόν / υπνοδωμάτια / όροφο των αγγελιών (ADR-890 Φ1),
 * έτος κατασκευής των συμβολαίων (ADR-890 Φ2).
 *
 * 🏆 **Το πλήθος σε ΚΑΘΕ γραμμή, και η σιωπή ονομάζεται.** Κανείς από τους μεγάλους (Zillow, Redfin, Idealista,
 * Rightmove) δεν δείχνει από πόσα δείγματα βγαίνει κάθε κελί· ο Redfin αφήνει απλώς κενό. Εδώ η γραμμή κάτω
 * από το κατώφλι **λέει** «λιγότερες από 5», και κάτω από τον πίνακα λέγεται πόσα δεν δήλωσαν τον άξονα.
 *
 * 🔑 **Καθαρά παρουσιαστικό** (ADR-890 Φ2): τα κείμενα έρχονται έτοιμα από τον καλούντα, ώστε η ΙΔΙΑ απόδοση να
 * εξυπηρετεί δύο πηγές (αγγελίες · συμβόλαια) με διαφορετικές λέξεις, χωρίς δίδυμο πίνακα.
 *
 * 🔑 **Προαιρετική στήλη σύγκρισης** (ADR-890 §12): δίπλα στη διάμεσο, π.χ. «ζητούν +12%» ανά κάδο. Ο καλών αποφασίζει
 * αν υπάρχει (`comparisonHeader`)· ο πίνακας δεν ξέρει τι συγκρίνεται.
 */

import React from 'react';

import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { isReportedStatCell, type StatCell } from '@/lib/market/market-statistics';

const NS = 'area-market';

export interface BreakdownTableRow {
  readonly key: string;
  readonly label: string;
  readonly cell: StatCell;
  /** Το κείμενο της στήλης σύγκρισης, ή `null` («—»). Αγνοείται χωρίς `comparisonHeader`. */
  readonly comparison?: string | null;
}

export interface AreaBreakdownTableProps {
  readonly caption: string;
  readonly bucketHeader: string;
  readonly countHeader: string;
  readonly rows: readonly BreakdownTableRow[];
  /** Ποσό μονάδας → κείμενο με τη μονάδα του (π.χ. «2.450 €/m²»). */
  readonly formatPrice: (amount: number) => string;
  /** Το κείμενο του κελιού κάτω από το κατώφλι. */
  readonly belowThreshold: string;
  /** Υποσημείωση (π.χ. «3 αγγελίες δεν δήλωσαν όροφο»), ή `null`. */
  readonly footnote: string | null;
  /** Η κεφαλίδα της στήλης σύγκρισης· `null`/απούσα = καμία στήλη. */
  readonly comparisonHeader?: string | null;
}

type StatRowProps = { readonly row: BreakdownTableRow; readonly compared: boolean } & Pick<AreaBreakdownTableProps, 'formatPrice' | 'belowThreshold'>;

function StatRow({ row, compared, formatPrice, belowThreshold }: StatRowProps) {
  const reported = isReportedStatCell(row.cell) ? row.cell : null;
  return (
    <TableRow>
      <TableHead scope="row" className="font-normal">{row.label}</TableHead>
      <TableCell className="tabular-nums">{reported === null ? '—' : formatPrice(reported.median)}</TableCell>
      {compared && <TableCell className="tabular-nums">{row.comparison ?? '—'}</TableCell>}
      <TableCell className="tabular-nums text-muted-foreground">
        {reported === null ? belowThreshold : `${formatPrice(reported.p25)} – ${formatPrice(reported.p75)}`}
      </TableCell>
      <TableCell className="text-right tabular-nums">{row.cell.n}</TableCell>
    </TableRow>
  );
}

export function AreaBreakdownTable({ caption, bucketHeader, countHeader, rows, formatPrice, belowThreshold, footnote, comparisonHeader = null }: AreaBreakdownTableProps) {
  const { t } = useTranslation([NS]);
  const compared = comparisonHeader !== null;
  return (
    <figure className="m-0 flex flex-col gap-1">
      <Table>
        <TableCaption className="mt-0 caption-top text-left font-medium text-foreground">{caption}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">{bucketHeader}</TableHead>
            <TableHead scope="col">{t(`${NS}:breakdown.columnMedian`)}</TableHead>
            {compared && <TableHead scope="col">{comparisonHeader}</TableHead>}
            <TableHead scope="col">{t(`${NS}:breakdown.columnRange`)}</TableHead>
            <TableHead scope="col" className="text-right">{countHeader}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <StatRow key={row.key} row={row} compared={compared} formatPrice={formatPrice} belowThreshold={belowThreshold} />
          ))}
        </TableBody>
      </Table>
      {footnote !== null && <figcaption className="text-xs text-muted-foreground">{footnote}</figcaption>}
    </figure>
  );
}

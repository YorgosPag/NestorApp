'use client';

/**
 * @fileoverview **SSoT: η ενότητα «γραμμές» ενός εγγράφου προμήθειας (προσφορά, RFQ).**
 * @module subapps/procurement/components/LineItemsSection
 * @related ADR-598 §3 procurement · ADR-584 (CHECK 3.28) · WCAG 1.3.1
 *
 * Ήταν γραμμένη **δύο** φορές (`QuoteForm` · `RfqBuilder`) — το CHECK 3.28 έπιασε το
 * κέλυφος του πίνακα ως δίδυμο — και στις δύο με το ίδιο σημασιολογικό λάθος: ο τίτλος
 * ήταν `<Label>` **χωρίς πεδίο** (ετικέτα που δεν ονομάζει τίποτα), και η στήλη ενεργειών
 * είχε **κενό** `<th />`.
 *
 * Εδώ: ο τίτλος είναι **επικεφαλίδα** (`h4`, κάτω από το `h3` του `CardTitle`) που
 * ονομάζει **και** την ενότητα **και** τον πίνακα (`aria-labelledby`)· κάθε στήλη είναι
 * `<th scope="col">`· η στήλη ενεργειών έχει όνομα για τον αναγνώστη οθόνης (`sr-only`).
 * Τα κουμπιά ενεργειών (`actions`) δίνονται έτοιμα από τον γονέα.
 */

import { useId, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface LineItemColumn {
  readonly key: string;
  readonly label: string;
  readonly align?: 'left' | 'right';
}

export interface LineItemsSectionProps {
  readonly title: string;
  readonly columns: readonly LineItemColumn[];
  /** Όνομα της τελευταίας στήλης (κουμπί αφαίρεσης) — ορατό μόνο στον αναγνώστη οθόνης. */
  readonly actionsColumnLabel: string;
  readonly hasLines: boolean;
  /** Κουμπιά στην κεφαλίδα (π.χ. «Προσθήκη γραμμής») — `type="button"` από τον γονέα. */
  readonly actions?: ReactNode;
  /** Περιεχόμενο κάτω από τον πίνακα (π.χ. σύνολα). */
  readonly footer?: ReactNode;
  /** Οι γραμμές (`<tr>`). */
  readonly children: ReactNode;
}

const HEADER_CELL = 'pb-1 pr-2 font-normal';

function LineItemsHeaderRow({ columns, actionsColumnLabel }: Pick<LineItemsSectionProps, 'columns' | 'actionsColumnLabel'>) {
  return (
    <tr className="border-b text-xs text-muted-foreground">
      {columns.map((column) => (
        <th key={column.key} scope="col" className={cn(HEADER_CELL, column.align === 'right' ? 'text-right' : 'text-left')}>
          {column.label}
        </th>
      ))}
      <th scope="col" className={HEADER_CELL}>
        <span className="sr-only">{actionsColumnLabel}</span>
      </th>
    </tr>
  );
}

export function LineItemsSection({
  title,
  columns,
  actionsColumnLabel,
  hasLines,
  actions,
  footer,
  children,
}: LineItemsSectionProps) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId}>
      <header className="mb-2 flex items-center justify-between">
        <h4 id={headingId} className="text-sm font-medium">{title}</h4>
        {actions && <div className="flex gap-1.5">{actions}</div>}
      </header>
      {hasLines && (
        <div className="overflow-x-auto">
          <table className="w-full" aria-labelledby={headingId}>
            <thead>
              <LineItemsHeaderRow columns={columns} actionsColumnLabel={actionsColumnLabel} />
            </thead>
            <tbody>{children}</tbody>
          </table>
        </div>
      )}
      {footer}
    </section>
  );
}

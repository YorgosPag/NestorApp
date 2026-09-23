'use client';

/**
 * @fileoverview **Η ΕΞΕΛΙΞΗ ΤΗΣ ΤΙΜΗΣ ΣΕ ΒΗΜΑΤΑ** — Ημερομηνία · Γεγονός · Τιμή · Μεταβολή (ADR-777 §8.72).
 * @related lib/listings/listing-stats-view.ts (`listingPriceEvents`) · lib/listings/price-history.ts ·
 *   lib/listings/listing-price-label.ts (το ποσό ΜΕ τη μονάδα του ρόλου)
 * @module components/owner-property/OwnerPropertyPriceSteps
 *
 * 🏆 **Πίνακας, όχι γραμμή** — η πρακτική του Zillow («Price history»): μια αγγελία έχει συνήθως
 * 1-3 αλλαγές τιμής, και ένα γράφημα βημάτων με τρία σημεία λέει λιγότερα από τρεις γραμμές
 * κειμένου με ημερομηνία και ποσοστό. Η **θέση** των αλλαγών στον χρόνο φαίνεται ήδη ως κάθετες
 * γραμμές στο γράφημα προβολών.
 *
 * ⚠️ **Εκτός αγοράς = γεγονός, όχι κενό** (`price: null`, §8.69): γράφεται «Αποσύρθηκε», και η
 * επανεμφάνιση «Επαναδημοσίευση» — ποτέ ψεύτικο «↓ 7%» ανάμεσα σε τιμή που κανείς δεν μπορούσε
 * να αγοράσει και στη νέα.
 */

import React from 'react';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCalendarDay, formatPercentage } from '@/lib/intl-formatting';
import { resolvedPriceLabel } from '@/lib/listings/listing-price-label';
import type { ListingPriceEvent } from '@/lib/listings/listing-stats-view';

const S = 'property-market:offer.stats.price';

function changeLabel(changeBasisPoints: number | null): string {
  if (changeBasisPoints === null) return '—';
  const sign = changeBasisPoints > 0 ? '+' : '−';
  return `${sign}${formatPercentage(Math.abs(changeBasisPoints) / 100)}`;
}

export function OwnerPropertyPriceSteps({ events }: { readonly events: readonly ListingPriceEvent[] }): React.ReactElement {
  const { t } = useTranslation(['property-market', 'common']);
  const headingId = React.useId();

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h4 id={headingId} className="m-0 text-sm font-semibold text-foreground">
        {t(`${S}.heading`)}
      </h4>
      {events.length === 0 ? (
        <p className="m-0 text-sm text-muted-foreground">{t(`${S}.none`)}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">{t(`${S}.date`)}</TableHead>
              <TableHead scope="col">{t(`${S}.event`)}</TableHead>
              <TableHead scope="col" className="text-right">{t(`${S}.amount`)}</TableHead>
              <TableHead scope="col" className="text-right">{t(`${S}.change`)}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Νεότερο πρώτο — η τρέχουσα τιμή είναι αυτό που ρωτά πρώτα ο κάτοχος. */}
            {[...events].reverse().map((event) => (
              <TableRow key={`${event.day}-${event.kind}`}>
                <TableCell className="tabular-nums">{formatCalendarDay(event.day, true)}</TableCell>
                <TableCell>{t(`${S}.kind.${event.kind}`)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {event.price === null ? t(`${S}.offMarket`) : resolvedPriceLabel(t, event.price)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{changeLabel(event.changeBasisPoints)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}

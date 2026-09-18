'use client';

/**
 * @fileoverview **Υποσύνολα τιμής ανά ρόλο, μέσα σε κάρτα στατιστικού** (ADR-777 §8.60.14.13).
 * @module components/shared/price-totals/PriceTotalsBreakdown
 *
 * Ζωγραφίζει ό,τι αποφάσισε το `priceTotalsView` — **καμία** κρίση εδώ: ούτε ποιες κλάσεις,
 * ούτε σειρά, ούτε μορφή ποσού. Κοινό για το `StatsCard` (πίνακες ελέγχου) **και** το
 * `ReportKPIGrid` (αναφορές): δύο αντίγραφα της ίδιας λίστας θα ήταν δίδυμο (N.18).
 *
 * 🔑 `<dl>`: ζεύγη «όρος → τιμή» είναι ακριβώς αυτό που δηλώνει ο αναγνώστης οθόνης.
 * ⚠️ **Στοιβαγμένα, όχι δίπλα-δίπλα, και ΧΩΡΙΣ `truncate`**: σε κάρτα ~170px η επιγραφή
 * «Βραχυχρόνια διαμονή · 3 καταλύματα» θα έχανε **το πλήθος** — δηλαδή ακριβώς τη λογιστική
 * που η γραμμή υπάρχει για να πει. Αναδιπλώνεται αντί να κοπεί.
 */

import { cn } from '@/lib/utils';
import type { PriceTotalsRow } from '@/lib/listings/listing-price-label';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

interface PriceTotalsBreakdownProps {
  readonly rows: readonly PriceTotalsRow[];
  /** Το χρώμα του ποσού — το αποφασίζει η κάρτα που φιλοξενεί τη λίστα. */
  readonly valueClassName?: string;
}

export function PriceTotalsBreakdown({ rows, valueClassName }: PriceTotalsBreakdownProps) {
  const colors = useSemanticColors();

  return (
    <dl className="mt-0.5 flex min-w-0 flex-col gap-0.5">
      {rows.map((row) => (
        <div key={row.key} className="flex min-w-0 flex-col">
          <dt className={cn('min-w-0 break-words text-xs leading-tight', colors.text.muted)}>
            {row.label}
          </dt>
          {row.value !== null && (
            <dd className={cn('text-sm font-bold leading-tight tabular-nums', valueClassName)}>
              {row.value}
            </dd>
          )}
        </div>
      ))}
    </dl>
  );
}

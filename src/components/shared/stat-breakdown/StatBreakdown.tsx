'use client';

/**
 * @fileoverview **Υποσύνολα μέσα σε κάρτα στατιστικού** — τιμή ανά ρόλο (ADR-777 §8.60.14.13) · εμβαδόν ανά είδος (§8.101).
 * @module components/shared/stat-breakdown/StatBreakdown
 *
 * Ζωγραφίζει ό,τι αποφάσισε το `priceTotalsView` ή το `areaTotalsView` — **καμία** κρίση εδώ: ούτε ποιες κλάσεις,
 * ούτε σειρά, ούτε μορφή μεγέθους. Ως τις 2026-11-11 λεγόταν `PriceTotalsBreakdown` (`components/shared/price-totals/`)
 * και δεχόταν μόνο κλάσεις τιμής — το εμβαδόν δεν είχε πού να πάει (§8.101). Κοινό για το `StatsCard` (πίνακες ελέγχου) **και** το
 * `ReportKPIGrid` (αναφορές): δύο αντίγραφα της ίδιας λίστας θα ήταν δίδυμο (N.18).
 *
 * 🔑 `<dl>`: ζεύγη «όρος → τιμή» είναι ακριβώς αυτό που δηλώνει ο αναγνώστης οθόνης.
 * ⚠️ **Στοιβαγμένα, όχι δίπλα-δίπλα, και ΧΩΡΙΣ `truncate`**: σε κάρτα ~170px η επιγραφή
 * «Βραχυχρόνια διαμονή · 3 καταλύματα» θα έχανε **το πλήθος** — δηλαδή ακριβώς τη λογιστική
 * που η γραμμή υπάρχει για να πει. Αναδιπλώνεται αντί να κοπεί.
 */

import { cn } from '@/lib/utils';
import type { StatBreakdownRow } from '@/types/stat-breakdown';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

interface StatBreakdownProps {
  readonly rows: readonly StatBreakdownRow[];
  /** Το χρώμα του ποσού — το αποφασίζει η κάρτα που φιλοξενεί τη λίστα. */
  readonly valueClassName?: string;
}

export function StatBreakdown({ rows, valueClassName }: StatBreakdownProps) {
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

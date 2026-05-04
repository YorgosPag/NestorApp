'use client';

/**
 * ChartTooltip — SSoT Recharts tooltip for the analytics page.
 *
 * Renders with app-themed bg-popover / text-popover-foreground CSS vars
 * so the tooltip respects both light and dark mode.
 *
 * Usage: <Tooltip content={<ChartTooltip formatter={(value, dataKey) => ...} />} />
 * Recharts clones the element and injects active / payload / label at runtime.
 *
 * @see ADR-331 §2.5 Phase E fix
 */

import type { TooltipProps } from 'recharts';

/** Receives the numeric value and the series dataKey (e.g. 'total', 'cumulativePct'). */
export type ChartValueFormatter = (value: number, dataKey: string) => string;

interface ChartTooltipProps extends Partial<TooltipProps<number, string>> {
  formatter: ChartValueFormatter;
}

export function ChartTooltip({ active, payload, label, formatter }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <section className="min-w-[120px] rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      {label != null && (
        <p className="mb-1 font-semibold">{String(label)}</p>
      )}
      {payload.map((entry, i) => (
        <p key={String(entry.dataKey ?? i)} className="flex gap-1.5">
          {payload.length > 1 && (
            <span className="shrink-0 text-muted-foreground">{entry.name}:</span>
          )}
          <span className="font-medium">
            {formatter(entry.value ?? 0, String(entry.dataKey ?? ''))}
          </span>
        </p>
      ))}
    </section>
  );
}

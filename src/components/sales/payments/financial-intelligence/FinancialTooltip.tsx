'use client';

/**
 * FinancialTooltip — Enterprise Recharts Tooltip for Financial Charts
 *
 * Standardized tooltip matching the app's semantic color system.
 * Usable as `content` prop on Recharts `<Tooltip>` without
 * requiring ChartContainer/ChartContext.
 *
 * @enterprise ADR-242 - Financial Intelligence Suite
 */

import React from 'react';

// =============================================================================
// TYPES
// =============================================================================

interface TooltipPayloadEntry {
  value: number | string;
  name: string;
  dataKey?: string;
  color?: string;
  fill?: string;
  stroke?: string;
  payload?: Record<string, unknown>;
}

interface FinancialTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string | number;
  /** Custom label formatter */
  labelFormatter?: (label: string | number) => string;
  /** Custom value formatter per entry: returns [formatted value, display name] */
  valueFormatter?: (value: number | string, name: string) => [string, string];
}

// =============================================================================
// COMPONENT
// =============================================================================

export function FinancialTooltip({
  active,
  payload,
  label,
  labelFormatter,
  valueFormatter,
}: FinancialTooltipProps) {
  if (!active || !payload?.length) return null;

  const displayLabel = labelFormatter && label != null
    ? labelFormatter(label)
    : label;

  return (
    <div className="rounded-lg border border-border/50 bg-popover px-3 py-2 text-xs shadow-xl">
      {displayLabel != null && (
        <p className="mb-1.5 font-medium text-foreground">{displayLabel}</p>
      )}
      <div className="grid gap-1">
        {payload.map((entry, i) => {
          const color = entry.color || entry.fill || entry.stroke || 'hsl(var(--foreground))';
          const [formattedValue, displayName] = valueFormatter
            ? valueFormatter(entry.value, entry.name)
            : [String(entry.value), entry.name];

          return (
            <div key={entry.dataKey ?? i} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: color }}
                />
                {displayName}
              </span>
              <span className="font-mono font-medium tabular-nums text-foreground">
                {formattedValue}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

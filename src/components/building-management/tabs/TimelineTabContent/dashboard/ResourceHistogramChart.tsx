"use client";

/**
 * @module ResourceHistogramChart
 * @enterprise ADR-266 Phase C, Sub-phase 4 — Resource Histogram
 *
 * Stacked bar chart showing hours/week per resource.
 * Reference line at 40hrs (standard weekly capacity).
 * Follows DelayBreakdownChart pattern (raw Recharts + ReportSection).
 *
 * ⚠️ **ADR-710 (μετανάστευση 2026-08-01)**: ChartPlot, όχι ChartCard — το
 * ReportSection έχει ήδη ξοδέψει κάρτα και επικεφαλίδα.
 *
 * 🔑 Το `chartConfig` **δεν** καταργείται: οι πόροι είναι **δυναμικοί** (ένας
 * ανά συνεργείο) και το χρώμα τους το αποφασίζει ο υπολογιστής πάνω, όχι μια
 * σταθερή λίστα. Άρα ταξιδεύει ως ρητό `ChartSeries.color` — που είναι
 * ακριβώς η περίπτωση για την οποία υπάρχει το override. Ο ίδιος πίνακας
 * δίνει και τις **ετικέτες**, οπότε δεν μένει δεύτερη δήλωση.
 *
 * 🔑 Ο χειρόγραφος πίνακας sr-only αφαιρέθηκε — το shell παράγει τον ίδιο,
 * ορατό σε όλους. **Χάνεται η στήλη «Σύνολο»**: είναι **παράγωγο**, όχι σειρά
 * του γραφήματος· εξακολουθεί να φαίνεται στο tooltip, όπου και ανήκει.
 */

import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine } from "recharts";
import { ChartPlot, type ChartSeries } from "@/components/ui/chart-card";
import { ReportSection } from "@/components/reports/core/ReportSection";
import { ReportEmptyState } from "@/components/reports/core/ReportEmptyState";
import { useTranslation } from "@/i18n/hooks/useTranslation";
import { cn } from "@/lib/utils";
import "@/lib/design-system";
import type {
  ResourceHistogramBar,
  ResourceChartConfigEntry,
} from "./resource-histogram.types";

// ─── Props ───────────────────────────────────────────────────────────────

interface ResourceHistogramChartProps {
  data: ResourceHistogramBar[];
  chartConfig: Record<string, ResourceChartConfigEntry>;
  resourceNames: string[];
  loading?: boolean;
}

// ─── Custom Tooltip ─────────────────────────────────────────────────────

interface TooltipPayloadEntry {
  name: string;
  value: number;
  color: string;
}

function CustomTooltip({
  active,
  payload,
  label,
  totalLabel,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
  totalLabel: string;
}) {
  if (!active || !payload?.length) return null;

  const total = payload.reduce((sum, entry) => sum + (entry.value || 0), 0);
  const isOver = total > 40;

  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((entry) => (
        <div
          key={entry.name}
          className="flex items-center justify-between gap-4"
        >
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            {entry.name}
          </span>
          <span className="tabular-nums font-medium">{entry.value}h</span>
        </div>
      ))}
      <div
        className={cn(
          "mt-1 pt-1 border-t flex justify-between font-semibold",
          isOver && "text-destructive",
        )}
      >
        <span>{totalLabel}</span>
        <span>{Math.round(total * 10) / 10}h</span>
      </div>
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────

export function ResourceHistogramChart({
  data,
  chartConfig,
  resourceNames,
  loading,
}: ResourceHistogramChartProps) {
  const { t } = useTranslation(['building', 'building-address', 'building-filters', 'building-storage', 'building-tabs', 'building-timeline']);
  const tBase = "tabs.timeline.dashboard.resourceHistogram";

  /**
   * Η **μία** δήλωση. Το χρώμα κάθε πόρου έρχεται από το `chartConfig` επειδή
   * οι πόροι είναι δυναμικοί — θεσιακή παλέτα θα άλλαζε απόχρωση σε κάθε
   * φιλτράρισμα, δηλαδή η ταυτότητα θα μετακινούνταν κάτω από τον χρήστη.
   */
  const series = useMemo<readonly ChartSeries<ResourceHistogramBar>[]>(
    () =>
      resourceNames.map((name) => ({
        key: name as Extract<keyof ResourceHistogramBar, string>,
        label: chartConfig[name]?.label ?? name,
        color: chartConfig[name]?.color ?? "hsl(var(--muted))",
      })),
    [resourceNames, chartConfig],
  );

  if (!loading && data.length === 0) {
    return (
      <ReportSection
        title={t(`${tBase}.title`)}
        tooltip={t("tabs.timeline.dashboard.tooltips.resourceHistogramTitle")}
        id="resource-histogram"
      >
        <ReportEmptyState
          title={t(`${tBase}.empty`)}
          description={t(`${tBase}.emptyDesc`)}
        />
      </ReportSection>
    );
  }

  return (
    <ReportSection
      title={t(`${tBase}.title`)}
      tooltip={t("tabs.timeline.dashboard.tooltips.resourceHistogramTitle")}
      id="resource-histogram"
    >
      <ChartPlot
        series={series}
        data={data}
        categoryKey="weekLabel"
        categoryLabel={t(`${tBase}.colWeek`)}
        formatValue={(v) => `${v}h`}
      >
        <ChartPlot.Figure
          caption={t(`${tBase}.ariaLabel`)}
          emptyMessage={t(`${tBase}.empty`)}
          size="lg"
        >
          <BarChart
            data={data}
            margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
          >
            <XAxis
              dataKey="weekLabel"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              label={{
                value: t(`${tBase}.hoursPerWeek`),
                angle: -90,
                position: "insideLeft",
                style: { fontSize: 11, fill: "hsl(var(--muted-foreground))" },
              }}
            />
            <Tooltip
              content={<CustomTooltip totalLabel={t(`${tBase}.total`)} />}
            />
            {/* Capacity reference line at 40hrs */}
            <ReferenceLine
              y={40}
              stroke="hsl(var(--destructive))"
              strokeDasharray="4 4"
              label={{
                value: t(`${tBase}.capacity`),
                position: "right",
                style: { fontSize: 10, fill: "hsl(var(--destructive))" },
              }}
            />

            {/* Stacked bars — one per resource */}
            {resourceNames.map((name) => (
              <Bar
                key={name}
                dataKey={name}
                stackId="resources"
                fill={`var(--color-${name})`}
                radius={
                  resourceNames.indexOf(name) === resourceNames.length - 1
                    ? [2, 2, 0, 0]
                    : [0, 0, 0, 0]
                }
              />
            ))}
          </BarChart>
        </ChartPlot.Figure>
      </ChartPlot>
    </ReportSection>
  );
}

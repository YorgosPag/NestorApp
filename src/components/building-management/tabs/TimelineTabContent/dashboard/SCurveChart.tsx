"use client";

/**
 * @module SCurveChart
 * @enterprise ADR-266 Phase A — S-Curve chart (PV/EV/AC)
 *
 * Uses recharts LineChart with 3 lines + today marker.
 * Colors from useSemanticColors() — no hardcoded hex.
 *
 * ⚠️ **ADR-710 (μετανάστευση 2026-08-01)**: `<ChartPlot>`, **όχι** `<ChartCard>` —
 * το `ReportSection` έχει ήδη ξοδέψει κάρτα και επικεφαλίδα, οπότε το `ChartCard`
 * θα **έριχνε** και θα ονόμαζε τη διόρθωση (`surface-context.tsx`).
 *
 * 🔑 **Ο πίνακας `sr-only` αφαιρέθηκε.** Ήταν χειρόγραφος και **μόνο** για
 * αναγνώστες οθόνης· το shell παράγει τον ίδιο πίνακα ως `<details>` ορατό σε
 * **όλους** — που είναι το ζητούμενο του ADR-710 §10, αφού δύο βήματα της
 * μετρημένης παλέτας πέφτουν κάτω από 3:1 σε light mode και ο πίνακας είναι η
 * ανακούφιση που οφείλεται σε κάθε αναγνώστη, όχι μόνο στον τυφλό.
 *
 * 🔑 Τα χρώματα δηλώνονται **ρητά** (`ChartSeries.color`) και όχι θεσιακά: PV
 * είναι **γραμμή βάσης** (σβησμένο, διακεκομμένο), AC είναι **δαπάνη**
 * (`--destructive`). Είναι κωδικοποίηση **σημασίας**, ακριβώς η περίπτωση για
 * την οποία υπάρχει το `color` override.
 *
 * ⚠️ Το tooltip μένει χειρόγραφο: υπολογίζει **παράγωγα** μεγέθη (SV = EV−PV,
 * CV = EV−AC) που δεν είναι σειρές του γραφήματος, άρα δεν υπάρχουν στην
 * περιγραφή που διαβάζει το ChartPlot.Tooltip.
 */

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Brush,
} from "recharts";
import { ChartPlot, type ChartSeries } from "@/components/ui/chart-card";
import { ReportSection } from "@/components/reports/core/ReportSection";
import { ReportEmptyState } from "@/components/reports/core/ReportEmptyState";
import { useTranslation } from "@/i18n/hooks/useTranslation";
import { formatCurrency, formatDateShort } from "@/lib/intl-utils";
import { getStatusColor } from "@/lib/design-system";
import type { SCurveDataPoint } from "@/services/report-engine/evm-calculator";

// ─── Custom Tooltip ──────────────────────────────────────────────────────

interface TooltipPayloadItem {
  value: number;
  color: string;
  dataKey?: string | number;
  payload?: SCurveDataPoint;
}

interface SCurveTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  labelMap: Record<string, string>;
  svLabel: string;
  cvLabel: string;
}

/**
 * 🔴 Τα τρία μεγέθη διαβάζονται από το **σημείο δεδομένων**, όχι από την
 * ετικέτα της σειράς.
 *
 * Μέχρι τη μετανάστευση ADR-710 έψαχνε `payload.find(p => p.name === "PV")`,
 * δηλαδή το `name` prop του `<Line>`. Μόλις η δήλωση σειρών ανέλαβε τα
 * ονόματα, το `name` έγινε το `dataKey` και τα SV/CV θα υπολογίζονταν
 * **σιωπηλά** ως `0 − 0` — σωστό σχήμα, λάθος αριθμός, καμία εξαίρεση.
 * *Ταυτότητα με το κλειδί, ποτέ με την ετικέτα.*
 */
function SCurveTooltip({
  active,
  payload,
  label,
  labelMap,
  svLabel,
  cvLabel,
}: SCurveTooltipProps) {
  if (!active || !payload?.length) return null;

  const point = payload[0]?.payload;
  const pv = point?.plannedValue ?? 0;
  const ev = point?.earnedValue ?? 0;
  const ac = point?.actualCost ?? 0;
  const sv = ev - pv;
  const cv = ev - ac;

  const SERIES_LABEL: Record<string, string> = {
    plannedValue: "PV",
    earnedValue: "EV",
    actualCost: "AC",
  };

  return (
    <div className="rounded-md border bg-popover p-3 shadow-md text-sm">
      <p className="font-medium mb-2">{label ? formatDateShort(label) : ""}</p>
      {payload.map((entry) => {
        const key = String(entry.dataKey ?? "");
        const short = SERIES_LABEL[key] ?? key;
        return (
          <p key={key} style={{ color: entry.color }}>
            <span className="font-medium">{short}</span>
            <span className="text-muted-foreground text-xs ml-1">
              {labelMap[short] ?? ""}
            </span>
            : {formatCurrency(entry.value)}
          </p>
        );
      })}
      <hr className="my-1.5 border-border" />
      <p
        className={
          sv >= 0
            ? getStatusColor("available", "text")
            : getStatusColor("error", "text")
        }
      >
        <span className="font-medium">SV</span>
        <span className="text-muted-foreground text-xs ml-1">{svLabel}</span>:{" "}
        {sv >= 0 ? "+" : ""}
        {formatCurrency(sv)}
      </p>
      <p
        className={
          cv >= 0
            ? getStatusColor("available", "text")
            : getStatusColor("error", "text")
        }
      >
        <span className="font-medium">CV</span>
        <span className="text-muted-foreground text-xs ml-1">{cvLabel}</span>:{" "}
        {cv >= 0 ? "+" : ""}
        {formatCurrency(cv)}
      </p>
    </div>
  );
}

// ─── Props ───────────────────────────────────────────────────────────────

interface SCurveChartProps {
  data: SCurveDataPoint[];
  loading?: boolean;
  /** Enable recharts Brush for zoom (Phase B). Shown only when data.length >= 6 */
  enableBrush?: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────

export function SCurveChart({ data, loading, enableBrush }: SCurveChartProps) {
  const { t } = useTranslation(['building', 'building-address', 'building-filters', 'building-storage', 'building-tabs', 'building-timeline']);
  const tt = (key: string) => t(`tabs.timeline.dashboard.tooltips.${key}`);

  const sCurveLabelMap: Record<string, string> = {
    PV: tt("pvShort"),
    EV: tt("evShort"),
    AC: tt("acShort"),
  };

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  }, []);

  /**
   * Η **μία** δήλωση: θεματοποίηση, υπόμνημα, πίνακας δεδομένων και σήμανση
   * διαβάζουν όλα από εδώ. Το υπόμνημα εμφανίζεται επειδή οι σειρές είναι
   * **τρεις** — όχι επειδή κάποιος πέρασε `<Legend />`.
   */
  const series = useMemo<readonly ChartSeries<SCurveDataPoint>[]>(
    () => [
      {
        key: "plannedValue",
        label: "PV",
        description: tt("pvShort"),
        color: "hsl(var(--muted-foreground))",
      },
      { key: "earnedValue", label: "EV", description: tt("evShort") },
      {
        key: "actualCost",
        label: "AC",
        description: tt("acShort"),
        color: "hsl(var(--destructive))",
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- το tt κλείνει πάνω στο t
    [t],
  );

  const isEmpty = data.length === 0;

  if (!loading && isEmpty) {
    return (
      <ReportSection
        title={t("tabs.timeline.dashboard.sCurve.title")}
        tooltip={t("tabs.timeline.dashboard.tooltips.sCurveTitle")}
        id="schedule-scurve"
      >
        <ReportEmptyState
          title={t("tabs.timeline.dashboard.empty.noBOQ")}
          description={t("tabs.timeline.dashboard.empty.noBOQDesc")}
        />
      </ReportSection>
    );
  }

  return (
    <ReportSection
      title={t("tabs.timeline.dashboard.sCurve.title")}
      tooltip={t("tabs.timeline.dashboard.tooltips.sCurveTitle")}
      id="schedule-scurve"
    >
      <ChartPlot
        series={series}
        data={data}
        categoryKey="date"
        categoryLabel={t("tabs.timeline.dashboard.sCurve.colDate")}
        formatValue={(v) => formatCurrency(v)}
        formatCategory={(v) => formatDateShort(String(v ?? ""))}
      >
        <ChartPlot.Figure
          caption={t("tabs.timeline.dashboard.sCurve.ariaLabel")}
          emptyMessage={t("tabs.timeline.dashboard.empty.noBOQ")}
          size="lg"
        >
            <LineChart
              data={data}
              margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="date"
                tickFormatter={(v: string) => formatDateShort(v)}
                className="text-xs"
              />
              <YAxis
                tickFormatter={(v: number) => formatCurrency(v)}
                className="text-xs"
                width={80}
              />
              <Tooltip
                content={
                  <SCurveTooltip
                    labelMap={sCurveLabelMap}
                    svLabel={tt("svShort")}
                    cvLabel={tt("cvShort")}
                  />
                }
              />
              {/* Today marker */}
              <ReferenceLine
                x={todayStr}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="4 4"
                label={{
                  value: t("tabs.timeline.dashboard.sCurve.today"),
                  position: "top",
                  fontSize: 11,
                }}
              />

              {/* PV — dashed gray (baseline) */}
              <Line
                type="monotone"
                dataKey="plannedValue"
                stroke="var(--color-plannedValue)"
                strokeDasharray="5 5"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />

              {/* EV — solid (value produced) */}
              <Line
                type="monotone"
                dataKey="earnedValue"
                stroke="var(--color-earnedValue)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />

              {/* AC — solid red (money spent) */}
              <Line
                type="monotone"
                dataKey="actualCost"
                stroke="var(--color-actualCost)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              {/* Brush zoom — Phase B (ADR-266) */}
              {enableBrush && data.length >= 6 && (
                <Brush
                  dataKey="date"
                  height={28}
                  stroke="hsl(var(--chart-1))"
                  tickFormatter={(v: string) => formatDateShort(v)}
                />
              )}
            </LineChart>
        </ChartPlot.Figure>
      </ChartPlot>
    </ReportSection>
  );
}

"use client";

/**
 * @module DelayBreakdownChart
 * @enterprise ADR-266 Phase C — Stacked bar chart: delay reasons per phase
 *
 * Shows per-reason breakdown (weather, materials, permits, subcontractor, other, unspecified).
 * Colors from design system CSS variables — no hardcoded hex.
 * Reason keys derive from DELAY_REASONS SSoT array.
 *
 * ⚠️ **ADR-710 (μετανάστευση 2026-08-01)**: ChartPlot, όχι ChartCard — το
 * ReportSection έχει ήδη ξοδέψει κάρτα και επικεφαλίδα. Το REASON_COLORS
 * καταργήθηκε: τα πέντε πρώτα ήταν ήδη τα θεσιακά slots 1..5, οπότε ήταν
 * **δεύτερη δήλωση της παλέτας** — και η σειρά των slots ΕΙΝΑΙ ο μηχανισμός
 * διαχωρισμού CVD (CHECK 3.32). Το «unspecified» κρατά ρητό color override
 * επειδή σημαίνει **απουσία αιτίας**, όχι έκτη αιτία.
 *
 * 🔑 Ο χειρόγραφος πίνακας sr-only αφαιρέθηκε — το shell παράγει τον ίδιο
 * ορατό σε όλους.
 */

import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import {
  ChartPlot,
  seriesColorVar,
  type ChartSeries,
} from "@/components/ui/chart-card";
import { ReportSection } from "@/components/reports/core/ReportSection";
import { ReportEmptyState } from "@/components/reports/core/ReportEmptyState";
import { useTranslation } from "@/i18n/hooks/useTranslation";
import "@/lib/design-system";
import { DELAY_REASONS } from "@/types/building/construction";
import type { DelayBreakdownDataPoint } from "./schedule-dashboard.types";

// ─── Reason Chart Config (SSoT — keys from DELAY_REASONS) ──────────────

const REASON_KEYS = [...DELAY_REASONS, "unspecified"] as const;

/**
 * «Απροσδιόριστη» δεν είναι έκτη αιτία — είναι **απουσία** αιτίας, οπότε δεν
 * παίρνει slot της κατηγορικής παλέτας. Το μόνο ρητό χρώμα που επιβιώνει.
 */
const UNSPECIFIED_COLOR = "hsl(var(--muted-foreground))";

/** Η γραμμή δεδομένων που φτάνει στο γράφημα: φάση + ένα πεδίο ανά αιτία. */
type ReasonRow = { phaseCode: string } & Partial<Record<(typeof REASON_KEYS)[number], number>>;

// ─── Custom Tooltip ──────────────────────────────────────────────────────

interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
  dataKey: string;
}

interface ReasonTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  labelMap: Map<string, string>;
  t: (key: string) => string;
}

function ReasonTooltip({
  active,
  payload,
  label,
  labelMap,
  t,
}: ReasonTooltipProps) {
  if (!active || !payload?.length) return null;

  const phaseName = labelMap.get(label ?? "") ?? label;
  const nonZeroEntries = payload.filter((p) => p.value > 0);

  return (
    <div className="rounded-md border bg-popover p-3 shadow-md text-sm">
      <p className="font-medium mb-1.5">{phaseName}</p>
      {nonZeroEntries.map((entry) => (
        <p key={entry.dataKey} style={{ color: entry.color }}>
          {entry.name}: {entry.value}{" "}
          {t("tabs.timeline.dashboard.delayBreakdown.tasks")}
        </p>
      ))}
    </div>
  );
}

// ─── Props ───────────────────────────────────────────────────────────────

interface DelayBreakdownChartProps {
  data: DelayBreakdownDataPoint[];
  loading?: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────

export function DelayBreakdownChart({
  data,
  loading,
}: DelayBreakdownChartProps) {
  const { t } = useTranslation(['building', 'building-address', 'building-filters', 'building-storage', 'building-tabs', 'building-timeline']);

  const labelMap = useMemo(
    () => new Map(data.map((d) => [d.phaseCode, d.phaseName])),
    [data],
  );

  // Flatten byReason into top-level keys for Recharts
  const chartData = useMemo(
    () =>
      data.map<ReasonRow>((d) => ({
        phaseCode: d.phaseCode,
        ...d.byReason,
      })),
    [data],
  );

  if (!loading && data.length === 0) {
    return (
      <ReportSection
        title={t("tabs.timeline.dashboard.delayBreakdown.title")}
        tooltip={t("tabs.timeline.dashboard.tooltips.delayBreakdownTitle")}
        id="schedule-delay-breakdown"
      >
        <ReportEmptyState
          title={t("tabs.timeline.dashboard.delayBreakdown.empty")}
          description={t("tabs.timeline.dashboard.delayBreakdown.emptyDesc")}
        />
      </ReportSection>
    );
  }

  /**
   * Η **μία** δήλωση σειρών: θεματοποίηση, υπόμνημα, πίνακας δεδομένων και
   * σήμανση διαβάζουν όλα από εδώ. Το υπόμνημα βγαίνει επειδή οι σειρές είναι
   * έξι — όχι επειδή κάποιος πέρασε Legend.
   */
  const series = useMemo<readonly ChartSeries<ReasonRow>[]>(
    () =>
      REASON_KEYS.map((reason) => ({
        key: reason,
        label: t(`tabs.timeline.dashboard.delayBreakdown.${reason}`),
        ...(reason === "unspecified" ? { color: UNSPECIFIED_COLOR } : {}),
      })),
    [t],
  );

  const rotateLabels = data.length > 6;

  return (
    <ReportSection
      title={t("tabs.timeline.dashboard.delayBreakdown.title")}
      tooltip={t("tabs.timeline.dashboard.tooltips.delayBreakdownTitle")}
      id="schedule-delay-breakdown"
    >
      <ChartPlot
        series={series}
        data={chartData}
        categoryKey="phaseCode"
        categoryLabel={t("tabs.timeline.dashboard.variance.colName")}
        formatValue={(v) => String(v)}
        formatCategory={(v) => labelMap.get(String(v ?? "")) ?? String(v ?? "")}
      >
        <ChartPlot.Figure
          caption={t("tabs.timeline.dashboard.delayBreakdown.ariaLabel")}
          emptyMessage={t("tabs.timeline.dashboard.delayBreakdown.empty")}
          size="lg"
        >
            <BarChart
              data={chartData}
              margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="phaseCode"
                className="text-xs"
                interval={0}
                angle={rotateLabels ? -45 : 0}
                textAnchor={rotateLabels ? "end" : "middle"}
                height={rotateLabels ? 60 : 30}
              />
              <YAxis allowDecimals={false} className="text-xs" width={40} />
              <Tooltip content={<ReasonTooltip labelMap={labelMap} t={t} />} />

              {REASON_KEYS.map((reason, idx) => (
                <Bar
                  key={reason}
                  dataKey={reason}
                  name={t(`tabs.timeline.dashboard.delayBreakdown.${reason}`)}
                  stackId="reasons"
                  fill={seriesColorVar(reason)}
                  radius={
                    idx === REASON_KEYS.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]
                  }
                />
              ))}
            </BarChart>
        </ChartPlot.Figure>
      </ChartPlot>
    </ReportSection>
  );
}

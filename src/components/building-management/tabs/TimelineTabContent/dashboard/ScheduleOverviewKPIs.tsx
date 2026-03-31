"use client";

/**
 * @module ScheduleOverviewKPIs
 * @enterprise ADR-266 Phase A — 6 KPI cards with vs-Plan traffic lights
 *
 * Reuses ReportKPIGrid + ReportKPI from ADR-265 report core.
 */

import { useMemo } from "react";
import {
  Activity,
  TrendingUp,
  CircleDollarSign,
  CalendarDays,
  CheckCircle2,
  AlertTriangle,
  Route,
} from "lucide-react";
import { ReportSection } from "@/components/reports/core/ReportSection";
import {
  ReportKPIGrid,
  type ReportKPI,
} from "@/components/reports/core/ReportKPIGrid";
import {
  getTrafficLight,
  type TrafficLight,
} from "@/services/report-engine/evm-calculator";
import type { RAGStatus } from "@/components/reports/core/ReportTrafficLight";
import { useTranslation } from "@/i18n/hooks/useTranslation";
import type { ScheduleKPIs } from "./schedule-dashboard.types";

// ─── Helpers ─────────────────────────────────────────────────────────────

function trafficToRAG(tl: TrafficLight): RAGStatus {
  if (tl === "green") return "green";
  if (tl === "amber") return "amber";
  return "red";
}

function progressRAG(actual: number, expected: number): RAGStatus {
  const delta = actual - expected;
  if (delta >= -1) return "green";
  if (delta >= -5) return "amber";
  return "red";
}

function phasesRAG(onTrack: number, total: number): RAGStatus {
  if (total === 0) return "gray";
  const pct = (onTrack / total) * 100;
  if (pct > 80) return "green";
  if (pct >= 50) return "amber";
  return "red";
}

function delayedRAG(count: number): RAGStatus {
  if (count === 0) return "green";
  if (count <= 3) return "amber";
  return "red";
}

// ─── Props ───────────────────────────────────────────────────────────────

interface ScheduleOverviewKPIsProps {
  kpis: ScheduleKPIs;
  loading?: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────

export function ScheduleOverviewKPIs({
  kpis,
  loading,
}: ScheduleOverviewKPIsProps) {
  const { t } = useTranslation("building");

  const cards = useMemo((): ReportKPI[] => {
    const progressDelta = kpis.overallProgress - kpis.expectedProgress;
    const progressSign = progressDelta >= 0 ? "+" : "";

    const tt = (key: string) => t(`tabs.timeline.dashboard.tooltips.${key}`);

    return [
      {
        title: t("tabs.timeline.dashboard.kpis.overallProgress"),
        value: `${kpis.overallProgress}%`,
        icon: Activity,
        color: "blue",
        status: progressRAG(kpis.overallProgress, kpis.expectedProgress),
        trend: {
          value: progressDelta,
          label: `${progressSign}${progressDelta.toFixed(1)}% ${t("tabs.timeline.dashboard.kpis.vsPlan")}`,
        },
        tooltip: tt("overallProgress"),
        loading,
      },
      {
        title: t("tabs.timeline.dashboard.kpis.spi"),
        value: kpis.spi.toFixed(2),
        description: t("tabs.timeline.dashboard.kpis.spiDesc"),
        icon: TrendingUp,
        color: kpis.spi >= 0.95 ? "green" : kpis.spi >= 0.85 ? "orange" : "red",
        status: trafficToRAG(getTrafficLight(kpis.spi)),
        tooltip: tt("spi"),
        loading,
      },
      {
        title: t("tabs.timeline.dashboard.kpis.cpi"),
        value: kpis.cpi.toFixed(2),
        description: t("tabs.timeline.dashboard.kpis.cpiDesc"),
        icon: CircleDollarSign,
        color: kpis.cpi >= 0.95 ? "green" : kpis.cpi >= 0.85 ? "orange" : "red",
        status: trafficToRAG(getTrafficLight(kpis.cpi)),
        tooltip: tt("cpi"),
        loading,
      },
      {
        title: t("tabs.timeline.dashboard.kpis.daysRemaining"),
        value: kpis.daysRemaining,
        icon: CalendarDays,
        color: "orange",
        status:
          kpis.daysRemaining <= 0
            ? "green"
            : kpis.daysRemaining <= 7
              ? "amber"
              : "gray",
        tooltip: tt("daysRemaining"),
        loading,
      },
      {
        title: t("tabs.timeline.dashboard.kpis.phasesOnTrack"),
        value: `${kpis.phasesOnTrack}/${kpis.totalPhases}`,
        icon: CheckCircle2,
        color: "green",
        status: phasesRAG(kpis.phasesOnTrack, kpis.totalPhases),
        tooltip: tt("phasesOnTrack"),
        loading,
      },
      {
        title: t("tabs.timeline.dashboard.kpis.delayedTasks"),
        value: kpis.delayedTasks,
        description: `/ ${kpis.totalTasks} ${t("tabs.timeline.dashboard.kpis.totalTasks")}`,
        icon: AlertTriangle,
        color: kpis.delayedTasks === 0 ? "green" : "red",
        status: delayedRAG(kpis.delayedTasks),
        tooltip: tt("delayedTasks"),
        loading,
      },
      {
        title: t("tabs.timeline.dashboard.kpis.criticalPathLength"),
        value:
          kpis.criticalPathLength > 0
            ? t("tabs.timeline.dashboard.kpis.criticalPathDays", {
                days: kpis.criticalPathLength,
              })
            : "—",
        icon: Route,
        color: "orange",
        status: "gray" as RAGStatus,
        tooltip: tt("criticalPathLength"),
        loading,
      },
    ];
  }, [kpis, loading, t]);

  return (
    <ReportSection
      title={t("tabs.timeline.dashboard.kpis.title")}
      id="schedule-kpis"
    >
      <ReportKPIGrid kpis={cards} />
    </ReportSection>
  );
}

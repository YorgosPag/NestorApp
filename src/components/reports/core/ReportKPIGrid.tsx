"use client";

/**
 * @module ReportKPIGrid
 * @enterprise ADR-265 — KPI cards grid with sparkline + traffic light
 *
 * Extends the UnifiedDashboard/StatsCard pattern with:
 * - Sparkline mini-trend (Decision 12.25)
 * - RAG traffic light status
 * - Period-vs-period comparison delta
 * - Responsive grid (4→2→1 columns, Decision 12.26)
 */

import "@/lib/design-system";
import { useSemanticColors } from "@/hooks/useSemanticColors";

import { useTranslation } from "react-i18next";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { cn } from "@/lib/utils";
import { ReportSparkline } from "./ReportSparkline";
import { ReportTrafficLight, type RAGStatus } from "./ReportTrafficLight";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReportKPI {
  /** KPI title */
  title: string;
  /** Display value (pre-formatted string or number) */
  value: string | number;
  /** Optional description */
  description?: string;
  /** Tooltip explanation shown via info icon next to the title */
  tooltip?: string;
  /** Icon component */
  icon: React.ElementType;
  /** Color accent */
  color?:
    | "blue"
    | "green"
    | "purple"
    | "orange"
    | "cyan"
    | "pink"
    | "gray"
    | "red"
    | "yellow"
    | "indigo";
  /** Trend indicator */
  trend?: {
    /** Percentage change */
    value: number;
    /** Label e.g. "vs last quarter" */
    label: string;
  };
  /** Mini sparkline data */
  sparklineData?: number[];
  /** RAG status indicator */
  status?: RAGStatus;
  /** Period comparison */
  comparison?: {
    /** Previous period value */
    value: number;
    /** Label e.g. "Q1 2025" */
    label: string;
  };
  /** Loading state */
  loading?: boolean;
}

export interface ReportKPIGridProps {
  /** Array of KPI definitions */
  kpis: ReportKPI[];
  /** Max columns (default: 4) */
  columns?: number;
  /** Click handler */
  onKPIClick?: (kpi: ReportKPI, index: number) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLOR_MAP: Record<string, string> = {
  blue: "text-primary",
  green: "text-[hsl(var(--text-success))]",
  purple: "text-primary",
  orange: "text-[hsl(var(--text-warning))]",
  cyan: "text-primary",
  pink: "text-primary",
  gray: "text-muted-foreground",
  red: "text-destructive",
  yellow: "text-[hsl(var(--text-warning))]",
  indigo: "text-primary",
};

const ICON_BG_MAP: Record<string, string> = {
  blue: "bg-[hsl(var(--bg-info))]/20",
  green: "bg-[hsl(var(--bg-success))]/10",
  purple: "bg-accent",
  orange: "bg-[hsl(var(--bg-warning))]/40",
  cyan: "bg-accent",
  pink: "bg-accent",
  gray: "bg-muted",
  red: "bg-destructive/10",
  yellow: "bg-[hsl(var(--bg-warning))]/40",
  indigo: "bg-accent",
};

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

function KPICard({
  kpi,
  index,
  onClick,
}: {
  kpi: ReportKPI;
  index: number;
  onClick?: (kpi: ReportKPI, index: number) => void;
}) {
  const colors = useSemanticColors();
  const { t } = useTranslation("reports");

  const color = kpi.color ?? "blue";
  const Icon = kpi.icon;

  const handleKeyDown = onClick
    ? (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(kpi, index);
        }
      }
    : undefined;

  if (kpi.loading) {
    return (
      <Card>
        <CardContent className="p-2">
          <div className="space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const trendIcon = kpi.trend ? (
    kpi.trend.value > 0 ? (
      <TrendingUp className="h-3.5 w-3.5 text-[hsl(var(--text-success))]" />
    ) : kpi.trend.value < 0 ? (
      <TrendingDown className="h-3.5 w-3.5 text-destructive" />
    ) : (
      <Minus className="h-3.5 w-3.5 text-muted-foreground" />
    )
  ) : null;

  const trendColor = kpi.trend
    ? kpi.trend.value > 0
      ? "text-[hsl(var(--text-success))]"
      : kpi.trend.value < 0
        ? "text-destructive"
        : "text-muted-foreground"
    : "";

  return (
    <Card
      className={cn(
        onClick && "cursor-pointer transition-shadow hover:shadow-md",
        onClick &&
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      )}
      onClick={() => onClick?.(kpi, index)}
      {...(onClick && {
        role: "button" as const,
        tabIndex: 0,
        onKeyDown: handleKeyDown,
        "aria-label": `${kpi.title}: ${kpi.value}${kpi.description ? `. ${kpi.description}` : ""}`,
      })}
    >
      <CardContent className="p-2">
        <article className="flex flex-col gap-2">
          {/* Header: Icon + Title + Status */}
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg",
                  ICON_BG_MAP[color],
                )}
              >
                <Icon className={cn("h-4 w-4", COLOR_MAP[color])} />
              </span>
              <span
                className={cn("text-sm font-medium", colors.text.secondary)}
              >
                {kpi.title}
              </span>
              {kpi.tooltip && (
                <InfoTooltip content={kpi.tooltip} side="bottom" />
              )}
            </div>
            {kpi.status && <ReportTrafficLight status={kpi.status} size="sm" />}
          </header>

          {/* Value + Sparkline */}
          <div className="flex items-end justify-between">
            <span
              className={cn(
                "text-2xl font-bold tabular-nums",
                colors.text.primary,
              )}
            >
              {kpi.value}
            </span>
            {kpi.sparklineData && kpi.sparklineData.length >= 2 && (
              <ReportSparkline
                data={kpi.sparklineData}
                height={28}
                width={72}
              />
            )}
          </div>

          {/* Trend + Comparison */}
          {(kpi.trend || kpi.comparison) && (
            <footer className="flex items-center gap-2 text-xs">
              {kpi.trend && (
                <span className={cn("flex items-center gap-0.5", trendColor)}>
                  {trendIcon}
                  <span className="font-medium">
                    {kpi.trend.value > 0 ? "+" : ""}
                    {kpi.trend.value}%
                  </span>
                  <span className={colors.text.muted}>{kpi.trend.label}</span>
                </span>
              )}
              {kpi.comparison && (
                <span className={cn(colors.text.muted)}>
                  {t("kpi.vs")} {kpi.comparison.label}: {kpi.comparison.value}
                </span>
              )}
            </footer>
          )}

          {/* Description */}
          {kpi.description && (
            <p className={cn("text-xs", colors.text.muted)}>
              {kpi.description}
            </p>
          )}
        </article>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Grid
// ---------------------------------------------------------------------------

export function ReportKPIGrid({
  kpis,
  columns = 4,
  onKPIClick,
  className,
}: ReportKPIGridProps) {
  return (
    <section
      className={cn(
        "grid gap-2",
        columns === 4 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
        columns === 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
        columns === 2 && "grid-cols-1 sm:grid-cols-2",
        columns === 1 && "grid-cols-1",
        className,
      )}
      aria-label="KPI indicators"
    >
      {kpis.map((kpi, index) => (
        <KPICard
          key={`${kpi.title}-${index}`}
          kpi={kpi}
          index={index}
          onClick={onKPIClick}
        />
      ))}
    </section>
  );
}

/**
 * 📜 AuditTimelineView — Shared Timeline Renderer
 *
 * Stateless presentation component for audit trail entries.
 * Consumed by:
 *   - `ActivityTab` (per-entity history — drilled-down view)
 *   - `GlobalAuditLogView` (admin — company-wide activity log)
 *
 * Controlled component: parent owns filter state and data fetching.
 *
 * @module components/shared/audit/AuditTimelineView
 * @enterprise ADR-195 — Entity Audit Trail
 * @ssot ADR-294 — Canonical renderer for audit timelines.
 *                 Do NOT duplicate — both per-entity and global views must
 *                 reuse this component to keep UX consistent.
 */

"use client";

import React from "react";
import {
  Clock,
  History,
  ChevronDown,
  BarChart3,
  Filter,
  FileEdit,
  Users,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import type {
  AuditAction,
  EntityAuditEntry,
} from "@/types/audit-trail";
import { StatsCard } from "@/components/property-management/dashboard/StatsCard";
import { useTranslation } from "@/i18n/hooks/useTranslation";
import { cn } from "@/lib/utils";
import { useSemanticColors } from "@/ui-adapters/react/useSemanticColors";
import "@/lib/design-system";
import { FILTER_OPTIONS } from "./activity-tab-config";
import {
  groupEntriesByDate,
  type Stats,
} from "./activity-tab-helpers";
import { AuditTimelineEntry } from "./audit-timeline-entry";

// ============================================================================
// MAIN VIEW
// ============================================================================

export interface AuditTimelineViewProps {
  entries: EntityAuditEntry[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  onLoadMore: () => void;
  stats: Stats;
  activeFilter: AuditAction | "all";
  onFilterChange: (next: AuditAction | "all") => void;
  /** When true, each entry shows the affected entity as a clickable link (global view). */
  showEntityLink?: boolean;
}

export function AuditTimelineView({
  entries,
  isLoading,
  error,
  hasMore,
  onLoadMore,
  stats,
  activeFilter,
  onFilterChange,
  showEntityLink = false,
}: AuditTimelineViewProps) {
  const { t } = useTranslation("common");
  const colors = useSemanticColors();

  const filteredEntries = React.useMemo(() => {
    if (activeFilter === "all") return entries;
    return entries.filter((e) => e.action === activeFilter);
  }, [entries, activeFilter]);

  const groupedEntries = React.useMemo(
    () => groupEntriesByDate(filteredEntries),
    [filteredEntries],
  );

  return (
    <section className="space-y-4 p-4">
      <header
        className={cn(
          "flex items-center gap-2 text-sm font-medium",
          colors.text.muted,
        )}
      >
        <History className="h-4 w-4" />
        <span>{t("audit.changeHistory")}</span>
      </header>

      {entries.length > 0 && <StatsPanel stats={stats} />}

      {entries.length > 0 && (
        <QuickFilters
          active={activeFilter}
          onChange={onFilterChange}
          stats={stats}
        />
      )}

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {isLoading && entries.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      )}

      {!isLoading && entries.length === 0 && !error && (
        <div
          className={cn(
            "flex flex-col items-center justify-center py-12",
            colors.text.muted,
          )}
        >
          <Clock className="mb-2 h-8 w-8 opacity-40" />
          <p className="text-sm">{t("audit.noHistory")}</p>
          <p className="text-xs opacity-60">{t("audit.changesWillAppear")}</p>
        </div>
      )}

      {!isLoading &&
        entries.length > 0 &&
        filteredEntries.length === 0 && (
          <div
            className={cn(
              "flex flex-col items-center justify-center py-8",
              colors.text.muted,
            )}
          >
            <Filter className="mb-2 h-6 w-6 opacity-40" />
            <p className="text-sm">{t("audit.noFilterResults")}</p>
          </div>
        )}

      {groupedEntries.map(({ dateLabel, dateKey, entries: dayEntries }) => (
        <DayGroup key={dateKey} dateLabel={dateLabel}>
          {dayEntries.map((entry) => (
            <AuditTimelineEntry
              key={entry.id}
              entry={entry}
              showEntityLink={showEntityLink}
            />
          ))}
        </DayGroup>
      ))}

      {hasMore && (
        <footer className="flex justify-center pt-2">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={isLoading}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50",
              colors.text.muted,
            )}
          >
            {isLoading ? (
              <Spinner size="small" color="inherit" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
            {t("audit.loadMore")}
          </button>
        </footer>
      )}
    </section>
  );
}

// ============================================================================
// STATISTICS PANEL
// ============================================================================

function StatsPanel({ stats }: { stats: Stats }) {
  const { t } = useTranslation("common");

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <StatsCard
        title={t("audit.totalLabel")}
        value={stats.total}
        icon={BarChart3}
        color="blue"
      />
      <StatsCard
        title={t("audit.stats.lastChange")}
        value={stats.lastChangeRelative ?? "—"}
        icon={Clock}
        color="gray"
      />
      <StatsCard
        title={t("audit.stats.fieldsChanged")}
        value={stats.uniqueFieldsChanged}
        icon={FileEdit}
        color="orange"
      />
      <StatsCard
        title={t("audit.stats.users")}
        value={stats.uniqueUsers}
        icon={Users}
        color="teal"
      />
    </div>
  );
}

// ============================================================================
// QUICK FILTERS
// ============================================================================

function QuickFilters({
  active,
  onChange,
  stats,
}: {
  active: AuditAction | "all";
  onChange: (v: AuditAction | "all") => void;
  stats: Stats;
}) {
  const colors = useSemanticColors();
  const { t } = useTranslation("common");
  return (
    <nav
      className="flex flex-wrap gap-1.5"
      aria-label={t("audit.historyFilters")}
    >
      {FILTER_OPTIONS.map(({ value, labelKey }) => {
        const isActive = active === value;
        const count =
          value === "all" ? stats.total : (stats.byAction[value] ?? 0);

        if (value !== "all" && count === 0) return null;

        return (
          <button
            key={value}
            type="button"
            onClick={() =>
              onChange(isActive && value !== "all" ? "all" : value)
            }
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              isActive
                ? "bg-primary text-primary-foreground"
                : `bg-muted/60 ${colors.text.muted} hover:bg-muted`
            }`}
          >
            {t(labelKey)}
            <span
              className={`text-[10px] ${
                isActive ? "opacity-80" : "opacity-50"
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

// ============================================================================
// DAY GROUP
// ============================================================================

function DayGroup({
  dateLabel,
  children,
}: {
  dateLabel: string;
  children: React.ReactNode;
}) {
  const colors = useSemanticColors();
  return (
    <section>
      <div className="sticky top-0 z-10 mb-2 flex items-center gap-2 bg-background/95 py-1 backdrop-blur-sm">
        <div className="h-px flex-1 bg-border" />
        <span className={cn("text-[11px] font-medium", colors.text.muted)}>
          {dateLabel}
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <ol className="relative ml-3 space-y-0 border-l-2 border-muted">
        {children}
      </ol>
    </section>
  );
}

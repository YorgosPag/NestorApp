/* eslint-disable custom/no-hardcoded-strings */
/**
 * 📜 ActivityTab — Enterprise Entity Audit Trail Component
 *
 * Displays a vertical timeline of entity changes with:
 * - Statistics header (total + per action type)
 * - Quick filters by action type
 * - Day-grouped timeline entries
 * - Field-level diffs with human-readable nested object display
 * - Real-time updates via RealtimeService
 *
 * Generic — works for any entity type (unit, building, contact, etc.)
 *
 * @module components/shared/audit/ActivityTab
 * @enterprise ADR-195 — Entity Audit Trail
 */

"use client";

import React, { useMemo, useState } from "react";
import { Clock, History, ChevronDown, BarChart3, Filter } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useEntityAudit } from "@/hooks/useEntityAudit";
import { formatRelativeTime, formatDateTime } from "@/lib/intl-utils";
import type { AuditEntityType, AuditAction } from "@/types/audit-trail";
import type { TabComponentProps } from "@/components/generic/UniversalTabsRenderer";
import { StatsCard } from "@/components/property-management/dashboard/StatsCard";
import { useTranslation } from "@/i18n/hooks/useTranslation";
import { cn } from "@/lib/utils";
import { useSemanticColors } from "@/ui-adapters/react/useSemanticColors";
import "@/lib/design-system";
import { ACTION_MAP, FILTER_OPTIONS } from "./activity-tab-config";
import {
  formatDisplayValue,
  groupEntriesByDate,
  computeStats,
} from "./activity-tab-helpers";
import type { Stats } from "./activity-tab-helpers";

// ============================================================================
// COMPONENT
// ============================================================================

interface ActivityTabProps extends TabComponentProps {
  entityType?: AuditEntityType;
  entityId?: string;
}

export function ActivityTab({
  entityType,
  entityId,
  unit,
  data,
}: ActivityTabProps) {
  const resolvedEntityId =
    entityId ??
    ((unit as Record<string, unknown> | undefined)?.id as string | undefined) ??
    ((data as Record<string, unknown> | undefined)?.id as string | undefined);

  const resolvedEntityType = entityType ?? "property";
  const { t } = useTranslation("common");
  const colors = useSemanticColors();
  const [activeFilter, setActiveFilter] = useState<AuditAction | "all">("all");

  const { entries, isLoading, error, hasMore, loadMore } = useEntityAudit({
    entityType: resolvedEntityType,
    entityId: resolvedEntityId,
  });

  // Filter entries by action type
  const filteredEntries = useMemo(() => {
    if (activeFilter === "all") return entries;
    return entries.filter((e) => e.action === activeFilter);
  }, [entries, activeFilter]);

  // Group filtered entries by date
  const groupedEntries = useMemo(
    () => groupEntriesByDate(filteredEntries),
    [filteredEntries],
  );

  // Statistics
  const stats = useMemo(() => computeStats(entries), [entries]);

  if (!resolvedEntityId) {
    return (
      <section
        className={cn(
          "flex items-center justify-center p-8",
          colors.text.muted,
        )}
      >
        <History className="mr-2 h-5 w-5" />
        <span>{t('audit.noEntityId')}</span>
      </section>
    );
  }

  return (
    <section className="space-y-4 p-4">
      {/* ── Header ── */}
      <header
        className={cn(
          "flex items-center gap-2 text-sm font-medium",
          colors.text.muted,
        )}
      >
        <History className="h-4 w-4" />
        <span>{t("audit.changeHistory")}</span>
      </header>

      {/* ── Statistics ── */}
      {entries.length > 0 && <StatsPanel stats={stats} />}

      {/* ── Quick Filters ── */}
      {entries.length > 0 && (
        <QuickFilters
          active={activeFilter}
          onChange={setActiveFilter}
          stats={stats}
        />
      )}

      {/* ── Error ── */}
      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* ── Loading (initial) ── */}
      {isLoading && entries.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      )}

      {/* ── Empty ── */}
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

      {/* ── Empty after filter ── */}
      {!isLoading && entries.length > 0 && filteredEntries.length === 0 && (
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

      {/* ── Day-Grouped Timeline ── */}
      {groupedEntries.map(({ dateLabel, dateKey, entries: dayEntries }) => (
        <DayGroup key={dateKey} dateLabel={dateLabel}>
          {dayEntries.map((entry) => (
            <AuditEntryItem key={entry.id} entry={entry} />
          ))}
        </DayGroup>
      ))}

      {/* ── Load more ── */}
      {hasMore && (
        <footer className="flex justify-center pt-2">
          <button
            type="button"
            onClick={loadMore}
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
            Περισσότερα
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
  const visibleActions: AuditAction[] = [
    "updated",
    "created",
    "deleted",
    "status_changed",
    "professional_assigned",
    "professional_removed",
    "email_sent",
    "invoice_created",
  ];

  const actionColorMap: Record<string, string> = {
    created: "green",
    updated: "blue",
    deleted: "red",
    status_changed: "orange",
    professional_assigned: "teal",
    professional_removed: "orange",
    email_sent: "sky",
    invoice_created: "green",
  };

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      <StatsCard
        title={t('audit.totalLabel')}
        value={stats.total}
        icon={BarChart3}
        color="gray"
      />
      {visibleActions.map((action) => {
        const config = ACTION_MAP[action];
        const count = stats.byAction[action] ?? 0;
        if (count === 0) return null;
        return (
          <StatsCard
            key={action}
            title={config.label}
            value={count}
            icon={config.icon}
            color={actionColorMap[action] ?? "gray"}
          />
        );
      })}
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
    <nav className="flex flex-wrap gap-1.5" aria-label={t('audit.historyFilters')}>
      {FILTER_OPTIONS.map(({ value, label }) => {
        const isActive = active === value;
        const count =
          value === "all" ? stats.total : (stats.byAction[value] ?? 0);

        // Hide filter buttons with 0 entries (except "all")
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
            {label}
            <span
              className={`text-[10px] ${isActive ? "opacity-80" : "opacity-50"}`}
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
      {/* Day header */}
      <div className="sticky top-0 z-10 mb-2 flex items-center gap-2 bg-background/95 py-1 backdrop-blur-sm">
        <div className="h-px flex-1 bg-border" />
        <span className={cn("text-[11px] font-medium", colors.text.muted)}>
          {dateLabel}
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Day entries */}
      <ol className="relative ml-3 space-y-0 border-l-2 border-muted">
        {children}
      </ol>
    </section>
  );
}

// ============================================================================
// TIMELINE ENTRY
// ============================================================================

function AuditEntryItem({ entry }: { entry: EntityAuditEntry }) {
  const colors = useSemanticColors();
  const config = ACTION_MAP[entry.action] ?? ACTION_MAP.updated;
  const Icon = config.icon;

  const timestamp = entry.timestamp ? new Date(entry.timestamp) : null;
  const relativeTime = timestamp ? formatRelativeTime(timestamp) : "";
  const absoluteTime = timestamp ? formatDateTime(timestamp) : "";

  return (
    <li className="relative pb-5 pl-8 last:pb-0">
      {/* Timeline dot */}
      <div
        className={`absolute -left-[9px] top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-muted bg-background ${config.color}`}
      >
        <Icon className="h-2.5 w-2.5" />
      </div>

      <article className="space-y-1">
        {/* Header: action + who + time */}
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className={`text-sm font-medium ${config.color}`}>
            {config.label}
          </span>
          {entry.performedByName && (
            <span className={cn("text-xs", colors.text.muted)}>
              από {entry.performedByName}
            </span>
          )}
          {timestamp && (
            <time
              dateTime={entry.timestamp}
              className={cn("ml-auto text-[11px]", colors.text.muted)}
              title={absoluteTime}
            >
              {relativeTime}
            </time>
          )}
        </div>

        {/* Field-level changes */}
        {entry.changes.length > 0 && (
          <ul className="mt-1.5 space-y-1">
            {entry.changes.map((change, idx) => (
              <li
                key={`${change.field}-${idx}`}
                className="rounded bg-muted/50 px-2.5 py-1 text-xs"
              >
                <span className="font-medium">
                  {change.label ?? change.field}
                </span>
                {": "}
                <span
                  className={cn(
                    colors.text.muted,
                    "line-through decoration-red-400/60",
                  )}
                >
                  {formatDisplayValue(change.oldValue)}
                </span>
                {" → "}
                <span className="font-medium text-foreground">
                  {formatDisplayValue(change.newValue)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </article>
    </li>
  );
}

export default ActivityTab;

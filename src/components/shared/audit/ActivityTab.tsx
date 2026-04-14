/**
 * 📜 ActivityTab — Per-Entity Audit Trail Tab
 *
 * Thin wrapper around `AuditTimelineView` that wires the per-entity data
 * source (`useEntityAudit` hook). Used inside entity detail pages (contacts,
 * properties, projects, etc.) to show "what changed on THIS record".
 *
 * For the company-wide admin view, see `GlobalAuditLogView` which reuses
 * the same `AuditTimelineView` component with `showEntityLink` enabled.
 *
 * @module components/shared/audit/ActivityTab
 * @enterprise ADR-195 — Entity Audit Trail
 * @ssot ADR-294 — Canonical per-entity history component. Do NOT create
 *                 per-type duplicates — the renderer is entity-agnostic.
 */

"use client";

import React, { useMemo, useState } from "react";
import { History } from "lucide-react";
import { useEntityAudit } from "@/hooks/useEntityAudit";
import type { AuditEntityType, AuditAction } from "@/types/audit-trail";
import type { TabComponentProps } from "@/components/generic/UniversalTabsRenderer";
import { useTranslation } from "@/i18n/hooks/useTranslation";
import { cn } from "@/lib/utils";
import { useSemanticColors } from "@/ui-adapters/react/useSemanticColors";
import { computeStats } from "./activity-tab-helpers";
import { AuditTimelineView } from "./AuditTimelineView";

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
  const { t } = useTranslation(['common', 'common-account', 'common-actions', 'common-empty-states', 'common-navigation', 'common-photos', 'common-sales', 'common-shared', 'common-status', 'common-validation']);
  const colors = useSemanticColors();
  const [activeFilter, setActiveFilter] = useState<AuditAction | "all">("all");

  const { entries, isLoading, error, hasMore, loadMore } = useEntityAudit({
    entityType: resolvedEntityType,
    entityId: resolvedEntityId,
  });

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
        <span>{t("audit.noEntityId")}</span>
      </section>
    );
  }

  return (
    <AuditTimelineView
      entries={entries}
      isLoading={isLoading}
      error={error}
      hasMore={hasMore}
      onLoadMore={loadMore}
      stats={stats}
      activeFilter={activeFilter}
      onFilterChange={setActiveFilter}
    />
  );
}

export default ActivityTab;

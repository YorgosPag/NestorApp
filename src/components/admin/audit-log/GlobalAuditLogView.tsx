/**
 * 📜 GlobalAuditLogView — Admin page for company-wide audit trail
 *
 * Google Workspace Admin Console pattern: filterable, paginated view of
 * ALL entity changes across the current tenant. Combines the filter bar,
 * refresh control, and the shared `AuditTimelineView` renderer (with
 * `showEntityLink` enabled so each entry links back to its entity).
 *
 * @module components/admin/audit-log/GlobalAuditLogView
 * @enterprise ADR-195 — Entity Audit Trail (Phase 7)
 * @permission super_admin | company_admin (enforced by /admin/layout.tsx)
 */

"use client";

import React, { useMemo, useState } from "react";
import { RefreshCw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/hooks/useTranslation";
import { cn } from "@/lib/utils";
import { useSemanticColors } from "@/ui-adapters/react/useSemanticColors";
import type { AuditAction } from "@/types/audit-trail";
import {
  useGlobalAuditTrail,
  type GlobalAuditFilters,
} from "@/hooks/useGlobalAuditTrail";
import { computeStats } from "@/components/shared/audit/activity-tab-helpers";
import { AuditTimelineView } from "@/components/shared/audit/AuditTimelineView";
import { AuditLogFilters } from "./AuditLogFilters";

// ============================================================================
// COMPONENT
// ============================================================================

export function GlobalAuditLogView() {
  const { t } = useTranslation("admin");
  const colors = useSemanticColors();

  const [filters, setFilters] = useState<GlobalAuditFilters>({});
  const [activeFilter, setActiveFilter] = useState<AuditAction | "all">("all");

  const {
    entries,
    isLoading,
    error,
    hasMore,
    loadMore,
    refetch,
  } = useGlobalAuditTrail({ filters, pageSize: 30 });

  const stats = useMemo(() => computeStats(entries), [entries]);

  return (
    <main className="container mx-auto space-y-4 p-4 sm:p-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <ShieldAlert className="h-6 w-6 text-primary" />
            {t("auditLog.title")}
          </h1>
          <p className={cn("text-sm", colors.text.muted)}>
            {t("auditLog.description")}
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={refetch}
          disabled={isLoading}
          className="gap-1.5"
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5", isLoading && "animate-spin")}
          />
          {t("auditLog.refresh")}
        </Button>
      </header>

      <AuditLogFilters filters={filters} onChange={setFilters} />

      <div className="rounded-lg border bg-card">
        <AuditTimelineView
          entries={entries}
          isLoading={isLoading}
          error={error}
          hasMore={hasMore}
          onLoadMore={loadMore}
          stats={stats}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          showEntityLink
        />
      </div>
    </main>
  );
}

export default GlobalAuditLogView;

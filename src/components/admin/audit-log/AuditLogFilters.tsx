/**
 * 📜 AuditLogFilters — Filter bar for the global audit log
 *
 * Controls: entity type, action, performedBy (free text), date range.
 * Emits a flat `GlobalAuditFilters` object to the parent, which debounces
 * and feeds it to the `useGlobalAuditTrail` hook.
 *
 * @module components/admin/audit-log/AuditLogFilters
 * @enterprise ADR-195 — Entity Audit Trail (Phase 7)
 */

"use client";

import React from "react";
import { Search, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/hooks/useTranslation";
import type {
  AuditAction,
  AuditEntityType,
} from "@/types/audit-trail";
import type { GlobalAuditFilters } from "@/hooks/useGlobalAuditTrail";

// ============================================================================
// CONSTANTS
// ============================================================================

const ENTITY_TYPE_OPTIONS: AuditEntityType[] = [
  "contact",
  "company",
  "project",
  "building",
  "property",
  "parking",
  "storage",
  "purchase_order",
];

const ACTION_OPTIONS: AuditAction[] = [
  "created",
  "updated",
  "deleted",
  "soft_deleted",
  "restored",
  "status_changed",
  "linked",
  "unlinked",
];

const ALL_SENTINEL = "__all__";

// ============================================================================
// COMPONENT
// ============================================================================

interface AuditLogFiltersProps {
  filters: GlobalAuditFilters;
  onChange: (next: GlobalAuditFilters) => void;
}

export function AuditLogFilters({ filters, onChange }: AuditLogFiltersProps) {
  const { t } = useTranslation(["admin", "common"]);

  const hasActiveFilters =
    !!filters.entityType ||
    !!filters.action ||
    !!filters.performedBy ||
    !!filters.fromDate ||
    !!filters.toDate;

  const handleReset = () => onChange({});

  return (
    <section
      className="grid grid-cols-1 gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5"
      aria-label={t("auditLog.filters.label")}
    >
      {/* Entity Type */}
      <div className="space-y-1">
        <Label htmlFor="audit-filter-entity-type" className="text-xs">
          {t("auditLog.filters.entityType")}
        </Label>
        <Select
          value={filters.entityType ?? ALL_SENTINEL}
          onValueChange={(value) =>
            onChange({
              ...filters,
              entityType:
                value === ALL_SENTINEL
                  ? undefined
                  : (value as AuditEntityType),
            })
          }
        >
          <SelectTrigger id="audit-filter-entity-type" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_SENTINEL}>
              {t("auditLog.filters.allEntityTypes")}
            </SelectItem>
            {ENTITY_TYPE_OPTIONS.map((type) => (
              <SelectItem key={type} value={type}>
                {t(`common:audit.entityTypes.${type}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Action */}
      <div className="space-y-1">
        <Label htmlFor="audit-filter-action" className="text-xs">
          {t("auditLog.filters.action")}
        </Label>
        <Select
          value={filters.action ?? ALL_SENTINEL}
          onValueChange={(value) =>
            onChange({
              ...filters,
              action:
                value === ALL_SENTINEL ? undefined : (value as AuditAction),
            })
          }
        >
          <SelectTrigger id="audit-filter-action" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_SENTINEL}>
              {t("auditLog.filters.allActions")}
            </SelectItem>
            {ACTION_OPTIONS.map((action) => (
              <SelectItem key={action} value={action}>
                {t(`common:audit.actions.${action}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* From Date */}
      <div className="space-y-1">
        <Label htmlFor="audit-filter-from-date" className="text-xs">
          {t("auditLog.filters.fromDate")}
        </Label>
        <Input
          id="audit-filter-from-date"
          type="date"
          value={filters.fromDate ?? ""}
          onChange={(e) =>
            onChange({
              ...filters,
              fromDate: e.target.value || undefined,
            })
          }
          className="h-8 text-sm"
        />
      </div>

      {/* To Date */}
      <div className="space-y-1">
        <Label htmlFor="audit-filter-to-date" className="text-xs">
          {t("auditLog.filters.toDate")}
        </Label>
        <Input
          id="audit-filter-to-date"
          type="date"
          value={filters.toDate ?? ""}
          onChange={(e) =>
            onChange({
              ...filters,
              toDate: e.target.value || undefined,
            })
          }
          className="h-8 text-sm"
        />
      </div>

      {/* Performed By (free-text search) + Reset */}
      <div className="space-y-1">
        <Label htmlFor="audit-filter-performed-by" className="text-xs">
          {t("auditLog.filters.performedBy")}
        </Label>
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 opacity-50" />
            <Input
              id="audit-filter-performed-by"
              type="text"
              placeholder={t("auditLog.filters.performedByPlaceholder")}
              value={filters.performedBy ?? ""}
              onChange={(e) =>
                onChange({
                  ...filters,
                  performedBy: e.target.value || undefined,
                })
              }
              className="h-8 pl-7 text-sm"
            />
          </div>
          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="h-8 w-8 p-0"
              aria-label={t("auditLog.filters.reset")}
              title={t("auditLog.filters.reset")}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

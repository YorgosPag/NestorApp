/**
 * 📜 AuditTimelineEntry — Single audit entry renderer
 *
 * Extracted from `AuditTimelineView` per Google SRP (500 line limit).
 * Renders one row in the audit timeline: action icon + who + when + optional
 * entity link + field-level diffs with translated values.
 *
 * @module components/shared/audit/audit-timeline-entry
 * @enterprise ADR-195 — Entity Audit Trail
 */

"use client";

import React from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { formatRelativeTime, formatDateTime } from "@/lib/intl-utils";
import type {
  AuditEntityType,
  EntityAuditEntry,
} from "@/types/audit-trail";
import { useTranslation } from "@/i18n/hooks/useTranslation";
import { cn } from "@/lib/utils";
import { useSemanticColors } from "@/ui-adapters/react/useSemanticColors";
import { ACTION_MAP } from "./activity-tab-config";
import { formatDisplayValue } from "./activity-tab-helpers";
import { resolveAuditValue } from "./audit-value-resolver";

// ============================================================================
// ENTITY LINK MAPPING (for global view)
// ============================================================================

/**
 * Build the canonical detail route for each entity type.
 * Used when rendering in `showEntityLink` mode (global admin view).
 */
export function buildEntityHref(
  type: AuditEntityType,
  id: string,
): string | null {
  switch (type) {
    case "contact":
      return `/contacts/${id}`;
    case "company":
      return `/contacts/${id}`;
    case "project":
      return `/projects/${id}`;
    case "building":
      return `/buildings/${id}`;
    case "property":
      return `/properties/${id}`;
    case "parking":
      return `/parking/${id}`;
    case "storage":
      return `/storage/${id}`;
    case "floor":
      return null;
    case "purchase_order":
      return `/procurement/purchase-orders/${id}`;
    default:
      return null;
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

interface AuditTimelineEntryProps {
  entry: EntityAuditEntry;
  showEntityLink: boolean;
}

export function AuditTimelineEntry({
  entry,
  showEntityLink,
}: AuditTimelineEntryProps) {
  const { t } = useTranslation("common");
  const colors = useSemanticColors();
  const config = ACTION_MAP[entry.action] ?? ACTION_MAP.updated;
  const Icon = config.icon;

  const timestamp = entry.timestamp ? new Date(entry.timestamp) : null;
  const relativeTime = timestamp ? formatRelativeTime(timestamp) : "";
  const absoluteTime = timestamp ? formatDateTime(timestamp) : "";

  const entityHref = showEntityLink
    ? buildEntityHref(entry.entityType, entry.entityId)
    : null;

  /** Country-code labels (kept local — not a tracked enum field). */
  const COUNTRY_KEYS: Readonly<Record<string, string>> = {
    GR: "countries.greece",
    CY: "countries.cyprus",
    US: "countries.usa",
    DE: "countries.germany",
    FR: "countries.france",
    IT: "countries.italy",
    ES: "countries.spain",
    UK: "countries.uk",
    AU: "countries.australia",
    CA: "countries.canada",
    OTHER: "countries.other",
  };

  /**
   * Build a field-aware translator: resolver handles catalog + audit.values +
   * ISO-date fallbacks; the country-code map is layered on top for non-enum
   * fields (e.g. `birthCountry`).
   */
  const makeFieldTranslator = (field: string) =>
    (v: string): string | undefined => {
      const resolved = resolveAuditValue(field, v, t);
      if (resolved) return resolved;

      const countryKey = COUNTRY_KEYS[v];
      if (countryKey) {
        const countryResult = t(countryKey);
        if (countryResult !== countryKey) return countryResult;
      }
      return undefined;
    };

  return (
    <li className="relative pb-5 pl-8 last:pb-0">
      <div
        className={`absolute -left-[9px] top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-muted bg-background ${config.color}`}
      >
        <Icon className="h-2.5 w-2.5" />
      </div>

      <article className="space-y-1">
        {showEntityLink && (
          <div className="flex items-center gap-1.5 text-xs">
            <span
              className={cn(
                "rounded bg-muted px-1.5 py-0.5 font-mono uppercase",
                colors.text.muted,
              )}
            >
              {t(`audit.entityTypes.${entry.entityType}`)}
            </span>
            {entityHref ? (
              <Link
                href={entityHref}
                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
              >
                {entry.entityName ?? entry.entityId}
                <ExternalLink className="h-3 w-3 opacity-60" />
              </Link>
            ) : (
              <span className="font-medium">
                {entry.entityName ?? entry.entityId}
              </span>
            )}
          </div>
        )}

        <div className="flex items-baseline gap-2 flex-wrap">
          <span className={`text-sm font-medium ${config.color}`}>
            {t(config.labelKey)}
          </span>
          {entry.performedByName && (
            <span className={cn("text-xs", colors.text.muted)}>
              {t("audit.byUser", { name: entry.performedByName })}
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

        {entry.changes.length > 0 && (
          <ul className="mt-1.5 space-y-1">
            {entry.changes.map((change, idx) => {
              const translateFieldValue = makeFieldTranslator(change.field);
              const fieldKey = `audit.fields.${change.field}`;
              const resolvedFieldLabel = t(fieldKey);
              const fieldLabel = resolvedFieldLabel !== fieldKey
                ? resolvedFieldLabel
                : (change.label ?? change.field);
              return (
                <li
                  key={`${change.field}-${idx}`}
                  className="rounded bg-muted/50 px-2.5 py-1 text-xs"
                >
                  <span className="font-medium">{fieldLabel}</span>
                  {": "}
                  <span
                    className={cn(
                      colors.text.muted,
                      "line-through decoration-red-400/60",
                    )}
                  >
                    {formatDisplayValue(change.oldValue, translateFieldValue)}
                  </span>
                  {" → "}
                  <span className="font-medium text-foreground">
                    {formatDisplayValue(change.newValue, translateFieldValue)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </article>
    </li>
  );
}

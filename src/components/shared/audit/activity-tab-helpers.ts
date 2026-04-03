/* eslint-disable custom/no-hardcoded-strings */
/**
 * ActivityTab helpers — grouping, formatting, stats
 *
 * Extracted from ActivityTab.tsx per Google SRP (500 line limit).
 *
 * @module components/shared/audit/activity-tab-helpers
 * @enterprise ADR-195 — Entity Audit Trail
 */

import { safeJsonParse } from "@/lib/json-utils";
import { formatDate } from "@/lib/intl-utils";
import type { AuditAction, EntityAuditEntry } from "@/types/audit-trail";

export interface Stats {
  total: number;
  byAction: Partial<Record<AuditAction, number>>;
}

/** Nested object key labels for human-readable display */
const NESTED_KEY_LABELS: Record<string, string> = {
  bedrooms: "Υ/Δ",
  bathrooms: "Μπάνια",
  wc: "WC",
  gross: "Μικτό",
  net: "Καθαρό",
  balcony: "Μπαλκόνι",
  terrace: "Βεράντα",
  garden: "Κήπος",
  class: "Κλάση",
  flooring: "Δάπεδο",
  windowFrames: "Κουφώματα",
  glazing: "Υαλοπίνακες",
  heatingType: "Θέρμανση",
  coolingType: "Ψύξη",
};

export function formatDisplayValue(
  value: string | number | boolean | null,
): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Ναι" : "Όχι";
  if (value === "") return "—";

  if (
    typeof value === "string" &&
    (value.startsWith("{") || value.startsWith("["))
  ) {
    const parsed = safeJsonParse<unknown>(value, undefined);
    if (parsed !== undefined) {
      if (Array.isArray(parsed)) {
        return parsed.length === 0 ? "—" : parsed.join(", ");
      }
      if (typeof parsed === "object" && parsed !== null) {
        return Object.entries(parsed)
          .map(([k, v]) => `${NESTED_KEY_LABELS[k] ?? k}: ${v}`)
          .join(", ");
      }
    }
  }

  return String(value);
}

/** Create a YYYY-MM-DD key from a date */
function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Group entries by calendar date */
export function groupEntriesByDate(
  entries: EntityAuditEntry[],
): { dateLabel: string; dateKey: string; entries: EntityAuditEntry[] }[] {
  if (entries.length === 0) return [];

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const todayKey = toDateKey(today);
  const yesterdayKey = toDateKey(yesterday);

  const groups = new Map<string, EntityAuditEntry[]>();

  for (const entry of entries) {
    const dateKey = entry.timestamp
      ? toDateKey(new Date(entry.timestamp))
      : "unknown";
    const existing = groups.get(dateKey);
    if (existing) {
      existing.push(entry);
    } else {
      groups.set(dateKey, [entry]);
    }
  }

  return Array.from(groups.entries()).map(([dateKey, dayEntries]) => {
    let dateLabel: string;
    if (dateKey === todayKey) {
      dateLabel = "Σήμερα";
    } else if (dateKey === yesterdayKey) {
      dateLabel = "Χθες";
    } else if (dateKey === "unknown") {
      dateLabel = "Άγνωστη ημερομηνία";
    } else {
      const [y, m, d] = dateKey.split("-");
      dateLabel = formatDate(new Date(Number(y), Number(m) - 1, Number(d)));
    }

    return { dateLabel, dateKey, entries: dayEntries };
  });
}

/** Compute statistics from entries */
export function computeStats(entries: EntityAuditEntry[]): Stats {
  const byAction: Partial<Record<AuditAction, number>> = {};
  for (const entry of entries) {
    byAction[entry.action] = (byAction[entry.action] ?? 0) + 1;
  }
  return { total: entries.length, byAction };
}

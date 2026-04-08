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
import { formatDate, formatRelativeTime } from "@/lib/intl-utils";
import type { AuditAction, EntityAuditEntry } from "@/types/audit-trail";

export interface Stats {
  total: number;
  byAction: Partial<Record<AuditAction, number>>;
  lastChangeRelative: string | null;
  uniqueFieldsChanged: number;
  uniqueUsers: number;
}

/** Translate enum-like type values to Greek for audit display */
const TYPE_LABELS: Record<string, string> = {
  // Phone types
  mobile: "Κινητό",
  home: "Σπίτι",
  work: "Εργασία",
  fax: "Φαξ",
  other: "Άλλο",
  // Email types
  personal: "Προσωπικό",
  // Address types
  headquarters: "Έδρα",
  branch: "Υποκατάστημα",
  warehouse: "Αποθήκη",
  // Website types
  company: "Εταιρική",
  portfolio: "Portfolio",
  blog: "Blog",
  // Social media types
  professional: "Επαγγελματικό",
  business: "Επιχειρηματικό",
  official: "Επίσημο",
  informational: "Ενημερωτικό",
  corporate: "Εταιρικό",
  marketing: "Marketing",
};

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

/**
 * Detect and format a known entity object (address, phone, email, etc.)
 * Returns null if not a recognized entity — caller should fallback.
 */
function formatKnownEntity(obj: Record<string, unknown>): string | null {
  // AddressInfo → "Σταδίου 15, Αθήνα, 10561"
  // MUST be checked BEFORE PhoneInfo — both have `number` + `type`
  if ("street" in obj || "isPrimary" in obj && "country" in obj) {
    const parts: string[] = [];
    if (obj.street) {
      parts.push(obj.number ? `${obj.street} ${obj.number}` : String(obj.street));
    } else if (obj.number) {
      parts.push(String(obj.number));
    }
    if (obj.city) parts.push(String(obj.city));
    if (obj.postalCode) parts.push(String(obj.postalCode));
    if (obj.municipality) parts.push(String(obj.municipality));
    return parts.length > 0 ? parts.join(", ") : null;
  }
  // PhoneInfo → "+30 6971234567 (Κινητό, Προσωπικό)"
  if ("number" in obj && "countryCode" in obj) {
    const code = obj.countryCode ? `${obj.countryCode} ` : "";
    const num = String(obj.number || "");
    const typeLabel = obj.type ? TYPE_LABELS[String(obj.type)] ?? String(obj.type) : "";
    const details = [typeLabel, obj.label].filter(Boolean).join(", ");
    const suffix = details ? ` (${details})` : "";
    return num ? `${code}${num}${suffix}` : null;
  }
  // EmailInfo → "user@example.com (Προσωπικό)"
  if ("email" in obj) {
    const email = String(obj.email || "");
    const typeLabel = obj.type ? TYPE_LABELS[String(obj.type)] ?? String(obj.type) : "";
    const details = [typeLabel, obj.label].filter(Boolean).join(", ");
    const suffix = details ? ` (${details})` : "";
    return email ? `${email}${suffix}` : null;
  }
  // WebsiteInfo → "https://example.com (Εταιρική, Κύρια)"
  if ("url" in obj && !("platform" in obj)) {
    const url = String(obj.url || "");
    const typeLabel = obj.type ? TYPE_LABELS[String(obj.type)] ?? String(obj.type) : "";
    const details = [typeLabel, obj.label].filter(Boolean).join(", ");
    const suffix = details ? ` (${details})` : "";
    return url ? `${url}${suffix}` : null;
  }
  // SocialMediaInfo → "@user (LinkedIn, Επαγγελματικό, Label) — https://linkedin.com/in/user"
  if ("platform" in obj && ("username" in obj || "url" in obj)) {
    const parts: string[] = [];
    if (obj.username) parts.push(`@${obj.username}`);
    const typeLabel = obj.type ? TYPE_LABELS[String(obj.type)] ?? String(obj.type) : "";
    const details = [obj.platform, typeLabel, obj.label].filter(Boolean).join(", ");
    if (details) parts.push(`(${details})`);
    if (obj.url) parts.push(`— ${obj.url}`);
    return parts.length > 0 ? parts.join(" ") : null;
  }
  // EscoSkillValue → "Java"
  if ("preferredLabel" in obj) return String(obj.preferredLabel);
  if ("label" in obj && !String(obj.label).includes(".")) return String(obj.label);
  if ("name" in obj) return String(obj.name);
  return null;
}

/**
 * Format a raw audit value for display.
 * @param value - Raw value from Firestore audit entry
 * @param translateValue - Optional translator for known values (e.g. status labels)
 */
export function formatDisplayValue(
  value: string | number | boolean | null,
  translateValue?: (v: string) => string | undefined,
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
        if (parsed.length === 0) return "—";
        const first = parsed[0];
        // Array of URLs (photos/media) → "N φωτογραφίες"
        if (typeof first === "string" && first.includes("firebasestorage.googleapis.com")) {
          return parsed.length === 1 ? "1 φωτογραφία" : `${parsed.length} φωτογραφίες`;
        }
        if (typeof first === "object" && first !== null) {
          const formatted = (parsed as Array<Record<string, unknown>>)
            .map((item) => formatKnownEntity(item))
            .filter(Boolean);
          if (formatted.length > 0) return formatted.join(" | ");
        }
        return parsed.join(", ");
      }
      if (typeof parsed === "object" && parsed !== null) {
        return Object.entries(parsed)
          .map(([k, v]) => `${NESTED_KEY_LABELS[k] ?? k}: ${v}`)
          .join(", ");
      }
    }
  }

  // Firebase Storage URLs → human-readable label
  if (typeof value === "string" && value.includes("firebasestorage.googleapis.com")) {
    return "Φωτογραφία";
  }

  // Try translating known values (e.g. "active" → "Ενεργό")
  if (typeof value === "string" && translateValue) {
    const translated = translateValue(value);
    if (translated) return translated;
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
  const fieldSet = new Set<string>();
  const userSet = new Set<string>();

  for (const entry of entries) {
    byAction[entry.action] = (byAction[entry.action] ?? 0) + 1;
    if (entry.performedByName) userSet.add(entry.performedByName);
    else if (entry.performedBy) userSet.add(entry.performedBy);
    for (const change of entry.changes ?? []) {
      fieldSet.add(change.field);
    }
  }

  // Last change relative time
  let lastChangeRelative: string | null = null;
  if (entries.length > 0) {
    const newest = entries[0];
    const ts = newest.timestamp;
    if (ts) {
      const date = (typeof ts === 'object' && ts !== null && 'toDate' in ts && typeof (ts as { toDate: unknown }).toDate === 'function')
        ? (ts as { toDate(): Date }).toDate()
        : new Date(ts as string | number);
      if (!isNaN(date.getTime())) {
        lastChangeRelative = formatRelativeTime(date);
      }
    }
  }

  return {
    total: entries.length,
    byAction,
    lastChangeRelative,
    uniqueFieldsChanged: fieldSet.size,
    uniqueUsers: userSet.size,
  };
}

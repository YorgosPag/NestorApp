/**
 * ActivityTab helpers — grouping, formatting, stats
 *
 * Extracted from ActivityTab.tsx per Google SRP (500 line limit).
 *
 * 🌐 ADR-195 (ζ) — **καμία λέξη εδώ.** Ζούσαν ελληνικοί πίνακες (τύποι επικοινωνίας, ΚΑΔ, `NESTED_KEY_LABELS`, «εσωτ.»,
 * «τ.μ.», «Ναι/Όχι», «Φωτογραφία») πίσω από `eslint-disable`: δεύτερη, μονόγλωσση αλήθεια δίπλα στα locale της φόρμας.
 * Οι λέξεις έρχονται πλέον από το λεξιλόγιο που δηλώνει το πεδίο (`AuditValueFormat`, ο καλών τα λύνει με `t`) — ο
 * helper μένει καθαρός και ελέγξιμος χωρίς i18next. Άγκυρα Λ5: ούτε ένας ελληνικός χαρακτήρας έξω από σχόλια.
 *
 * @module components/shared/audit/activity-tab-helpers
 * @enterprise ADR-195 — Entity Audit Trail
 */

import { safeJsonParse } from "@/lib/json-utils";
import { formatDate, formatRelativeTime } from "@/lib/intl-utils";
import { calendarDayLabel, groupByCalendarDay } from "@/lib/audit/calendar-day-groups";
import type { AuditAction, EntityAuditEntry } from "@/types/audit-trail";
import type { QuantitySpec } from "@/constants/quantity-specs";
import type { AuditCatalogRef } from "@/config/audit-value-catalogs";
import { AUDIT_AREA_FIELDS, type AuditValueWord } from "@/config/audit-value-vocabularies";
import { formatQuantityValue } from "./audit-quantity-format";

export interface Stats {
  total: number;
  byAction: Partial<Record<AuditAction, number>>;
  lastChangeRelative: string | null;
  uniqueFieldsChanged: number;
  uniqueUsers: number;
}

/**
 * Ό,τι χρειάζεται ο μορφοποιητής για να γράψει **μία** τιμή ιστορικού — ένα αντικείμενο αντί για θέσιμα ορίσματα.
 *
 * Οι λέξεις λύνονται από τον καλώντα (`t`), από τους καταλόγους που δηλώνει το πεδίο (`TrackedFieldDef`).
 */
export interface AuditValueFormat {
  /** Μεταφραστής τιμής enum του πεδίου (κατάλογος του περιγραφέα / ανά όνομα — `audit-value-resolver`). */
  readonly translateValue?: (v: string) => string | undefined;
  /** Ποσότητα του περιγραφέα (ADR-852). */
  readonly quantity?: QuantitySpec;
  /** Ο ΕΝΑΣ μορφοποιητής ορόφου (ADR-903 `useFloorLabel`). */
  readonly floorLabel?: (value: string | number) => string;
  /** Το λεξιλόγιο κάθε ιδιότητας των στοιχείων της τιμής (`TrackedFieldDef.itemCatalogs`). */
  readonly itemCatalogs?: Readonly<Record<string, AuditCatalogRef>>;
  /** Τα ονόματα των κλειδιών όταν η τιμή είναι αντικείμενο (`TrackedFieldDef.nestedKeyCatalog`). */
  readonly nestedKeyCatalog?: AuditCatalogRef;
  /** Η λέξη μιας τιμής **από** κατάλογο — `undefined` όταν δεν λύνεται. */
  readonly catalogWord: (catalog: AuditCatalogRef | undefined, value: string) => string | undefined;
  /** Οι λέξεις του μορφοποιητή που δεν είναι τιμές λεξιλογίου (`AUDIT_VALUE_WORDS`). */
  readonly word: (word: AuditValueWord) => string;
}

/** Η λέξη της ιδιότητας `property` ενός στοιχείου, από το λεξιλόγιο που δηλώνει το πεδίο — άγνωστη ⇒ η τιμή (ποτέ κενό). */
function itemWord(format: AuditValueFormat, property: string, value: unknown): string {
  if (!value) return "";
  const raw = String(value);
  return format.catalogWord(format.itemCatalogs?.[property], raw) ?? raw;
}

/** Το όνομα ενός κλειδιού αντικειμένου — άγνωστο ⇒ το ίδιο το κλειδί. */
function nestedKeyWord(format: AuditValueFormat, key: string): string {
  return format.catalogWord(format.nestedKeyCatalog, key) ?? key;
}

/** «(λέξη τύπου, ετικέτα)» — κοινό επίθεμα τηλεφώνου / email / ιστοσελίδας. */
function typeSuffix(format: AuditValueFormat, obj: Record<string, unknown>): string {
  const details = [itemWord(format, "type", obj.type), obj.label].filter(Boolean).join(", ");
  return details ? ` (${details})` : "";
}

/** AddressInfo → "Σταδίου 15, Αθήνα, 10561" */
function formatAddressItem(obj: Record<string, unknown>): string | null {
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

/** PhoneInfo → "+30 6971234567 εσωτ. 123 (Κινητό, Προσωπικό)" */
function formatPhoneItem(obj: Record<string, unknown>, format: AuditValueFormat): string | null {
  const code = obj.countryCode ? `${obj.countryCode} ` : "";
  const num = String(obj.number || "");
  const ext = obj.extension ? ` ${format.word("extension")} ${String(obj.extension).trim()}` : "";
  return num ? `${code}${num}${ext}${typeSuffix(format, obj)}` : null;
}

/** SocialMediaInfo → "@user (LinkedIn, Επαγγελματικό, Label) — https://linkedin.com/in/user" */
function formatSocialItem(obj: Record<string, unknown>, format: AuditValueFormat): string | null {
  const parts: string[] = [];
  if (obj.username) parts.push(`@${obj.username}`);
  const details = [itemWord(format, "platform", obj.platform), itemWord(format, "type", obj.type), obj.label]
    .filter(Boolean)
    .join(", ");
  if (details) parts.push(`(${details})`);
  if (obj.url) parts.push(`— ${obj.url}`);
  return parts.length > 0 ? parts.join(" ") : null;
}

/** KadActivity → "01.11 — Καλλιέργεια δημητριακών (Κύρια)" */
function formatKadItem(obj: Record<string, unknown>, format: AuditValueFormat): string | null {
  const code = String(obj.code || "");
  const desc = String(obj.description || "");
  const typeLabel = itemWord(format, "type", obj.type);
  const suffix = typeLabel ? ` (${typeLabel})` : "";
  return code ? `${code} — ${desc}${suffix}` : desc || null;
}

/**
 * Detect and format a known entity object (address, phone, email, etc.)
 * Returns null if not a recognized entity — caller should fallback.
 */
function formatKnownEntity(obj: Record<string, unknown>, format: AuditValueFormat): string | null {
  // MUST be checked BEFORE PhoneInfo — both have `number` + `type`
  if ("street" in obj || "isPrimary" in obj && "country" in obj) return formatAddressItem(obj);
  if ("number" in obj && "countryCode" in obj) return formatPhoneItem(obj, format);
  // EmailInfo → "user@example.com (Προσωπικό)"
  if ("email" in obj) {
    const email = String(obj.email || "");
    return email ? `${email}${typeSuffix(format, obj)}` : null;
  }
  // WebsiteInfo → "https://example.com (Εταιρική, Κύρια)"
  if ("url" in obj && !("platform" in obj)) {
    const url = String(obj.url || "");
    return url ? `${url}${typeSuffix(format, obj)}` : null;
  }
  if ("platform" in obj && ("username" in obj || "url" in obj)) return formatSocialItem(obj, format);
  if ("code" in obj && "description" in obj) return formatKadItem(obj, format);
  // EscoSkillValue → "Java"
  if ("preferredLabel" in obj) return String(obj.preferredLabel);
  if ("label" in obj && !String(obj.label).includes(".")) return String(obj.label);
  if ("name" in obj) return String(obj.name);
  return null;
}

/**
 * Extract a short identifier from a Firebase Storage URL for audit display.
 * e.g. "...file_f76a661d-8667-4199-8d8a-2a8cc7e9c37f.png?..." → "Φωτογραφία (f76a661d.png)"
 *
 * @param photo - η λέξη «Φωτογραφία» στη γλώσσα του θεατή (`AUDIT_VALUE_WORDS.photo`).
 */
export function formatStorageUrl(url: string, photo: string): string {
  const fileMatch = url.match(/file_([a-f0-9]{8})[^.]*(\.\w+)/);
  if (fileMatch) return `${photo} (${fileMatch[1]}${fileMatch[2]})`;
  const extMatch = url.match(/(\.\w{3,4})\?/);
  return extMatch ? `${photo} (${extMatch[1]})` : photo;
}

// ============================================================================
// FIELD-SPECIFIC FORMATTING (floor numbers, area units)
// ============================================================================
// ADR-903: ο όροφος ΔΕΝ μορφοποιείται πια εδώ (ήταν ελληνικά γραμμένα στον κώδικα, «1ος» χωρίς
// «όροφος»). Ο καλών περνά τον ΕΝΑ μορφοποιητή (`useFloorLabel`) ως `floorLabel`.

/**
 * Wrap a scalar area number with the m² unit label.
 */
function formatAreaScalar(value: string | number | boolean | null, sqm: string): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'boolean') return undefined;
  const num = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(num)) return undefined;
  return `${num} ${sqm}`;
}

/**
 * Format the `areas` nested-object JSON with the area unit on each value.
 * Input: '{"gross":120,"net":100,"balcony":15}'
 * Output: "Μικτό: 120 τ.μ., Καθαρό: 100 τ.μ., Μπαλκόνι: 15 τ.μ."
 */
function formatAreasObject(raw: string, format: AuditValueFormat): string | undefined {
  const parsed = safeJsonParse<Record<string, unknown> | null>(raw, null);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;
  const sqm = format.word('sqm');
  const parts = Object.entries(parsed)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${nestedKeyWord(format, k)}: ${v} ${sqm}`);
  return parts.length > 0 ? parts.join(', ') : undefined;
}

/**
 * Field-aware wrapper around {@link formatDisplayValue}.
 *
 * Applies special formatting for fields whose stored values carry implicit
 * semantics not covered by the generic renderer:
 *   - `floor`  — via the caller's `floorLabel` (ADR-903 `useFloorLabel`: «Ισόγειο» / «2nd Floor»)
 *   - `AUDIT_AREA_FIELDS` — scalar → value + area unit · JSON object → key names with the unit on each value
 *
 * Falls through to `formatDisplayValue` for all other fields.
 */
export function formatFieldAwareValue(
  field: string,
  value: string | number | boolean | null,
  format: AuditValueFormat,
): string {
  // 🏢 ADR-852 Φ2 — Η ΠΟΣΟΤΗΤΑ ΠΡΟΗΓΕΙΤΑΙ, ΚΑΙ ΜΟΝΟ ΟΤΑΝ ΕΙΝΑΙ ΔΗΛΩΜΕΝΗ.
  //
  // Ο περιγραφέας ξέρει κάτι που το όνομα του πεδίου δεν λέει: ότι το `749.99…` είναι
  // μήκος αποθηκευμένο σε canonical mm. Όταν το δηλώνει, κερδίζει — είναι ρητή γνώση.
  // Όταν δεν το δηλώνει, το `formatQuantityValue` γυρίζει `undefined` και η συνάρτηση
  // συνεχίζει **ακριβώς** όπως πριν: μηδέν αλλαγή για κάθε υπάρχον πεδίο.
  //
  // ⚠️ ΠΑΝΩ από τους ειδικούς κανόνες `floor`/`area`/`areas`: εκείνοι μαντεύουν από το
  // ΟΝΟΜΑ, αυτό διαβάζει τη ΔΗΛΩΣΗ. Δήλωση > μαντεψιά, πάντα.
  const byQuantity = formatQuantityValue(format.quantity, value);
  if (byQuantity !== undefined) return byQuantity;

  const { floorLabel } = format;
  if (field === 'floor' && floorLabel && (typeof value === 'number' || typeof value === 'string')) {
    return floorLabel(value) || formatDisplayValue(value, format);
  }
  if (AUDIT_AREA_FIELDS.has(field)) {
    const asArea = typeof value === 'string' && value.startsWith('{')
      ? formatAreasObject(value, format)
      : formatAreaScalar(value, format.word('sqm'));
    return asArea ?? formatDisplayValue(value, format);
  }
  return formatDisplayValue(value, format);
}

/** Πίνακας από JSON → κείμενο: φωτογραφίες, γνωστά στοιχεία, ή απλή λίστα. */
function formatParsedArray(parsed: unknown[], format: AuditValueFormat): string {
  if (parsed.length === 0) return "—";
  const first = parsed[0];
  // Array of URLs (photos/media) → "Φωτογραφία (id1) | Φωτογραφία (id2)"
  if (typeof first === "string" && first.includes("firebasestorage.googleapis.com")) {
    const photo = format.word("photo");
    return (parsed as string[]).map((url) => formatStorageUrl(url, photo)).join(" | ");
  }
  if (typeof first === "object" && first !== null) {
    const formatted = (parsed as Array<Record<string, unknown>>)
      .map((item) => formatKnownEntity(item, format))
      .filter(Boolean);
    if (formatted.length > 0) return formatted.join(" | ");
  }
  return parsed.join(", ");
}

/** Τιμή JSON (`{…}` / `[…]`) → κείμενο, ή `undefined` αν δεν είναι έγκυρο JSON. */
function formatJsonValue(value: string, format: AuditValueFormat): string | undefined {
  const parsed = safeJsonParse<unknown>(value, undefined);
  if (parsed === undefined) return undefined;
  if (Array.isArray(parsed)) return formatParsedArray(parsed, format);
  if (typeof parsed === "object" && parsed !== null) {
    return Object.entries(parsed)
      .map(([k, v]) => `${nestedKeyWord(format, k)}: ${v}`)
      .join(", ");
  }
  return undefined;
}

/**
 * Format a raw audit value for display.
 * @param value - Raw value from Firestore audit entry
 * @param format - Οι λέξεις και οι κατάλογοι του πεδίου. Για field-aware (catalog-based) επίλυση, ο καλών
 *   φτιάχνει `translateValue` ανά αλλαγή που κρατά το `change.field` και καλεί `resolveAuditValue(field, v, t)`
 *   του `audit-value-resolver`. See ADR-195 / ADR-279.
 */
export function formatDisplayValue(
  value: string | number | boolean | null,
  format: AuditValueFormat,
): string {
  if (value === null || value === undefined) return "—";
  // Runtime guard: CDC may store raw objects even when the type says primitive
  if (typeof value === 'object') {
    const formatted = formatKnownEntity(value as Record<string, unknown>, format);
    if (formatted) return formatted;
    return JSON.stringify(value);
  }
  if (typeof value === "boolean") return format.word(value ? "yes" : "no");
  if (value === "") return "—";

  if (typeof value === "string" && (value.startsWith("{") || value.startsWith("["))) {
    const formatted = formatJsonValue(value, format);
    if (formatted !== undefined) return formatted;
  }

  // Firebase Storage URLs → human-readable label with short ID for diffing
  if (typeof value === "string" && value.includes("firebasestorage.googleapis.com")) {
    return formatStorageUrl(value, format.word("photo"));
  }

  // Try translating known values (e.g. "active" → "Ενεργό")
  if (typeof value === "string" && format.translateValue) {
    const translated = format.translateValue(value);
    if (translated) return translated;
  }

  return String(value);
}

/**
 * Ομαδοποίηση του χρονολογίου ανά ημέρα — λεπτός προσαρμογέας πάνω στο SSoT `groupByCalendarDay` (ADR-327).
 * Οι σχετικές ετικέτες έρχονται από το `audit.dateGroups.*` (ήταν σκληροκωδικοποιημένα ελληνικά — N.11).
 */
export function groupEntriesByDate(
  entries: EntityAuditEntry[],
  t: (key: string) => string,
): { dateLabel: string; dateKey: string; entries: EntityAuditEntry[] }[] {
  const labels = {
    today: t("audit.dateGroups.today"),
    yesterday: t("audit.dateGroups.yesterday"),
    unknown: t("audit.dateGroups.unknown"),
  };
  return groupByCalendarDay(entries, (entry) => entry.timestamp).map((group) => ({
    dateKey: group.dateKey,
    dateLabel: calendarDayLabel(group, labels, (date) => formatDate(date)),
    entries: group.entries,
  }));
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

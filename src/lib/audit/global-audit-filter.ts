/**
 * 🔎 **ΤΑ ΦΙΛΤΡΑ ΤΟΥ ΙΣΤΟΡΙΚΟΥ ΟΛΗΣ ΤΗΣ ΕΤΑΙΡΕΙΑΣ — ΕΝΑΣ ΚΡΙΤΗΣ** (ADR-195 Φ7 · pending «Δρομέας keyset»)
 *
 * Η οθόνη «Ιστορικό» έχει ΔΥΟ πηγές: το ζωντανό παράθυρο (συνδρομή στον πελάτη,
 * `EntityAuditClientService.subscribeGlobal`) και την ουρά των παλαιότερων (`GET /api/audit-trail/global`). Ως
 * 2026-10-30 φιλτράριζαν **διαφορετικά**:
 *   - `performedBy`: ο πελάτης ακριβή ισότητα uid, ο διακομιστής υποσυμβολοσειρά σε uid/όνομα — το πεδίο της οθόνης είναι
 *     **ελεύθερο κείμενο** ⇒ με όνομα το ζωντανό παράθυρο ήταν πάντα άδειο·
 *   - `toDate`: ο πελάτης `ts > μεσάνυχτα UTC` ⇒ η ημέρα «έως» αποκλειόταν **ολόκληρη**· ο διακομιστής 23:59:59 στη
 *     ζώνη ώρας του **server**.
 * Τώρα και οι δύο ρωτούν **αυτόν** τον κριτή.
 *
 * Ημέρες: `[από 00:00, επόμενη του «έως» 00:00)` σε **UTC** — ίδια σύμβαση με το ιστορικό ρόλων
 * (`api/admin/role-management/audit-log`). Ημέρα Αθήνας: ανοιχτό θέμα (pending).
 *
 * **Layering**: καθαρό module — χωρίς Firebase, χρησιμοποιείται από πελάτη ΚΑΙ διακομιστή.
 *
 * @module lib/audit/global-audit-filter
 */

import { isCalendarDay } from '@/lib/date/calendar-day';
import type { AuditAction, AuditEntityType, EntityAuditEntry } from '@/types/audit-trail';

export interface GlobalAuditFilters {
  entityType?: AuditEntityType;
  action?: AuditAction;
  /** Ελεύθερο κείμενο: μέρος του uid **ή** του ονόματος του δράστη, χωρίς διάκριση πεζών-κεφαλαίων. */
  performedBy?: string;
  /** `YYYY-MM-DD`, συμπεριλαμβάνεται. */
  fromDate?: string;
  /** `YYYY-MM-DD`, συμπεριλαμβάνεται ολόκληρη. */
  toDate?: string;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** Αρχή της ημέρας σε ms (UTC) — `null` για τιμή που δεν είναι ημέρα (ο διακομιστής την έχει ήδη απορρίψει με 400). */
function dayStartMs(day: string | undefined): number | null {
  return day !== undefined && isCalendarDay(day) ? Date.parse(`${day}T00:00:00.000Z`) : null;
}

export function hasGlobalAuditFilter(filters: GlobalAuditFilters | undefined): boolean {
  return Boolean(
    filters &&
      (filters.entityType || filters.action || filters.performedBy || filters.fromDate || filters.toDate),
  );
}

/**
 * Ο κριτής, με τα όρια υπολογισμένα **μία** φορά. Με ενεργό φίλτρο ημερομηνίας, εγγραφή χωρίς έγκυρη ώρα **δεν**
 * περνά — δεν αποδεικνύεται ότι ανήκει στο διάστημα.
 */
export function globalAuditFilterPredicate(
  filters: GlobalAuditFilters | undefined,
): (entry: EntityAuditEntry) => boolean {
  if (!hasGlobalAuditFilter(filters) || !filters) return () => true;

  const fromMs = dayStartMs(filters.fromDate);
  const toStart = dayStartMs(filters.toDate);
  const toExclusiveMs = toStart === null ? null : toStart + ONE_DAY_MS;
  const needle = filters.performedBy?.toLowerCase() ?? null;

  return (entry) => {
    if (filters.entityType && entry.entityType !== filters.entityType) return false;
    if (filters.action && entry.action !== filters.action) return false;
    if (needle) {
      const haystack = `${entry.performedBy ?? ''} ${entry.performedByName ?? ''}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    if (fromMs !== null || toExclusiveMs !== null) {
      const ts = Date.parse(entry.timestamp);
      if (!Number.isFinite(ts)) return false;
      if (fromMs !== null && ts < fromMs) return false;
      if (toExclusiveMs !== null && ts >= toExclusiveMs) return false;
    }
    return true;
  };
}

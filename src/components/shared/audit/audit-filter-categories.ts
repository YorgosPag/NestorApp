/**
 * Κατηγορίες φίλτρων του Ιστορικού — η ΜΙΑ αρχή που αποφασίζει σε ποιο chip ανήκει κάθε ενέργεια.
 *
 * 🔑 Το ερώτημα: *«κάθε γραμμή που βλέπω ανήκει σε ΑΚΡΙΒΩΣ ΕΝΑ φίλτρο — και το «Όλα» είναι το άθροισμά τους;»*
 *
 * Μέχρι 2026-11-18 τα chips ήταν χειρόγραφη λίστα **10 από τις 29** ενέργειες: ό,τι έμενε έξω (άνοιγμα εγγράφου,
 * κοινή χρήση, σύνδεση, επαναφορά…) μετρούσε στο «Όλα» και σε **κανένα** chip — «Όλα 5 · Ενημερώσεις 3 ·
 * Δημιουργίες 1». Τώρα κάθε ενέργεια **δηλώνει** κατηγορία στο `ACTION_MAP` (`Record<AuditAction, …>` ⇒ ο compiler
 * απαιτεί απάντηση για κάθε νέα ενέργεια), και το «Όλα» ισούται με το άθροισμα **από κατασκευής**.
 *
 * Πρότυπο: οικογένειες ενεργειών όπως στο Google Drive Activity (create · edit · delete · permission change ·
 * comment) και στο Box (File Management › Previewed / Downloaded) — όχι ένα chip ανά ωμή ενέργεια.
 *
 * @module components/shared/audit/audit-filter-categories
 * @enterprise ADR-195 — Entity Audit Trail
 */

import type { AuditAction } from "@/types/audit-trail";
import { ACTION_MAP } from "./activity-tab-config";

/**
 * Η γραμμή φίλτρων — **η μία πηγή**: σειρά, κατηγορίες και τύποι προκύπτουν από εδώ. Το `labelKey` είναι ρητό
 * literal επίτηδες: το διαβάζει η γεννήτρια του shell slice (`t(option.labelKey)`, ADR-744).
 */
export const AUDIT_FILTER_OPTIONS = [
  { value: "all", labelKey: "audit.filters.all" },
  { value: "created", labelKey: "audit.filters.created" },
  { value: "changed", labelKey: "audit.filters.changed" },
  { value: "deleted", labelKey: "audit.filters.deleted" },
  { value: "viewed", labelKey: "audit.filters.viewed" },
  { value: "access", labelKey: "audit.filters.access" },
  { value: "communication", labelKey: "audit.filters.communication" },
] as const;

/** Ό,τι μπορεί να είναι ενεργό στη γραμμή φίλτρων. */
export type AuditFilter = (typeof AUDIT_FILTER_OPTIONS)[number]["value"];

/** Μια οικογένεια ενεργειών — κάθε `AuditAction` ανήκει σε ακριβώς μία (`ActionConfig.category`). */
export type AuditFilterCategory = Exclude<AuditFilter, "all">;

function isCategory(value: AuditFilter): value is AuditFilterCategory {
  return value !== "all";
}

/** Οι οικογένειες, με τη σειρά των chips. */
export const AUDIT_FILTER_CATEGORIES: readonly AuditFilterCategory[] = AUDIT_FILTER_OPTIONS.map(
  (option) => option.value,
).filter(isCategory);

export function auditFilterCategoryOf(action: AuditAction): AuditFilterCategory {
  return ACTION_MAP[action].category;
}

export function matchesAuditFilter(action: AuditAction, filter: AuditFilter): boolean {
  return filter === "all" || auditFilterCategoryOf(action) === filter;
}

/** Πόσες γραμμές δείχνει κάθε chip — μετρά **ό,τι θα αποκαλύψει το κλικ**, ούτε περισσότερο ούτε λιγότερο. */
export function countAuditFilterCategories(actions: Iterable<AuditAction>): Record<AuditFilterCategory, number> {
  const counts = Object.fromEntries(AUDIT_FILTER_CATEGORIES.map((category) => [category, 0])) as Record<
    AuditFilterCategory,
    number
  >;
  for (const action of actions) counts[auditFilterCategoryOf(action)] += 1;
  return counts;
}

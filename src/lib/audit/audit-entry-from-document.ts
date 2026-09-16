/**
 * 📜 **ΤΟ ΣΥΝΟΡΟ ΑΝΑΓΝΩΣΗΣ ΤΟΥ ΙΣΤΟΡΙΚΟΥ** — ωμό έγγραφο `entity_audit_trail` → `EntityAuditEntry`
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ — ΤΡΙΑ ΑΝΤΙΓΡΑΦΑ, ΤΡΕΙΣ ΣΥΜΠΕΡΙΦΟΡΕΣ (μετρημένο 2026-09-16)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η ίδια μετατροπή ζούσε σε **τρία** σημεία: `api/audit-trail/[entityType]/[entityId]`,
 * `api/audit-trail/global` και το `normalizeEntry` του `entity-audit-client.service.ts`. Και
 * **δεν** ήταν ίδια: οι διαδρομές έγραφαν `changes: data.changes ?? []` (ένα μη-πίνακας περνούσε)
 * και `entityName ?? null` (ένα αντικείμενο `{name, number}` από CDC έριχνε το React #31)· μόνο ο
 * πελάτης είχε φρουρούς. Ο ίδιος χρήστης, στην ίδια οθόνη, έβλεπε τη ζωντανή σελίδα **σωστά** και
 * το «φόρτωσε περισσότερα» **σπασμένο**.
 *
 * Η ADR-864 Φ1β πρόσθεσε **τέταρτο** λόγο: η εμβέλεια έγινε διακριτή ένωση (`companyId` **ή**
 * `userId`), και τρεις χειρόγραφες εκδοχές του «ποιο βιβλίο;» θα απέκλιναν σίγουρα.
 *
 * 🔑 **Ένα σύνορο, η αυστηρότερη από τις τρεις συμπεριφορές, για όλους.**
 *
 * ⚠️ **`null` = ΜΗΝ ΑΠΟΔΩΣΕΙΣ.** Εγγραφή χωρίς **ακριβώς μία** εμβέλεια δεν ξέρουμε σε ποιον
 * ανήκει — άρα δεν ξέρουμε ποιος δικαιούται να τη δει. Ο καλών την **παραλείπει**.
 *
 * **Layering**: leaf — καμία εξάρτηση Firebase (ο `Timestamp` αναγνωρίζεται από το `toDate()`
 * του, ίδιο για Admin και client SDK). Το εισάγουν διακομιστής και πελάτης.
 *
 * @module lib/audit/audit-entry-from-document
 * @enterprise ADR-195 · ADR-864 Φ1β
 */

import { auditLedgerScopeFromData } from '@/lib/audit/audit-ledger';
import type {
  AuditAction,
  AuditEntityType,
  AuditSource,
  EntityAuditEntry,
} from '@/types/audit-trail';

/** Timestamp → ISO. Admin **και** client `Timestamp` έχουν `toDate()`. */
function toIsoTimestamp(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value !== null && typeof value === 'object' && 'toDate' in value) {
    const toDate = (value as { toDate: unknown }).toDate;
    if (typeof toDate === 'function') {
      const date: unknown = toDate.call(value);
      if (date instanceof Date) return date.toISOString();
    }
  }
  // Εκκρεμής `serverTimestamp()` σε τοπικό snapshot ⇒ `null` ⇒ ταξινομείται τελευταίο.
  return new Date(0).toISOString();
}

function toSource(value: unknown): AuditSource | undefined {
  return value === 'cdc' || value === 'service' ? value : undefined;
}

/**
 * Ωμό πεδίο που **πρέπει** να είναι όνομα προς εμφάνιση.
 *
 * Τα CDC Cloud Functions γράφουν ενίοτε αντικείμενο `{name, number}` αντί για συμβολοσειρά —
 * χωρίς αυτόν τον φρουρό το React ρίχνει #31.
 */
function toDisplayString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return value || null;
  if (typeof value === 'object') {
    const named = (value as { name?: unknown }).name;
    return named != null ? String(named) : JSON.stringify(value);
  }
  return String(value) || null;
}

/**
 * **Η ΜΙΑ μετατροπή** εγγράφου ιστορικού σε εγγραφή προς απόδοση.
 *
 * @returns `null` όταν η εγγραφή **δεν** ανήκει σε ακριβώς ένα βιβλίο.
 */
export function entityAuditEntryFromData(
  id: string,
  data: Readonly<Record<string, unknown>>,
): EntityAuditEntry | null {
  const scope = auditLedgerScopeFromData(data);
  if (scope === null) return null;

  const source = toSource(data.source);
  return {
    id,
    entityType: data.entityType as AuditEntityType,
    entityId: typeof data.entityId === 'string' ? data.entityId : '',
    entityName: toDisplayString(data.entityName),
    action: data.action as AuditAction,
    changes: Array.isArray(data.changes) ? data.changes : [],
    performedBy: typeof data.performedBy === 'string' ? data.performedBy : '',
    performedByName: toDisplayString(data.performedByName),
    timestamp: toIsoTimestamp(data.timestamp),
    ...(source ? { source } : {}),
    ...scope,
  };
}

/** Πολλά έγγραφα — όσα **δεν** ανήκουν σε ακριβώς ένα βιβλίο **παραλείπονται**. */
export function entityAuditEntriesFromData(
  docs: ReadonlyArray<{ readonly id: string; readonly data: Readonly<Record<string, unknown>> }>,
): EntityAuditEntry[] {
  const entries: EntityAuditEntry[] = [];
  for (const doc of docs) {
    const entry = entityAuditEntryFromData(doc.id, doc.data);
    if (entry !== null) entries.push(entry);
  }
  return entries;
}

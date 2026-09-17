/**
 * @fileoverview **ΤΟ ΙΣΤΟΡΙΚΟ ΤΟΥ ΗΜΕΡΟΛΟΓΙΟΥ** — στο ΙΔΙΟ βιβλίο με την αγγελία.
 * @related ADR-835 §20 (Στάδιο Α) · CHECK 3.17 · services/owner-property/owner-property-audit.ts
 * @module services/stay-calendar/stay-calendar-audit
 *
 * 🔑 **Χωρίς νέο `entityType`**: το ημερολόγιο είναι κομμάτι της αγγελίας, και ο
 * ιδιοκτήτης βλέπει στο «Ιστορικό» της **μία** χρονολογία — «έκλεισε 10–14/10» δίπλα στο
 * «άλλαξε η τιμή». Το βιβλίο (προσωπικό ή εταιρικό) βγαίνει από τη **θεματοφυλακή**,
 * ακριβώς όπως στο `recordOwnerPropertyWrite`.
 *
 * ⚠️ **Κανένα όνομα επισκέπτη στο ίχνος.** Το ίχνος ζει περισσότερο από την κράτηση· η
 * κράτηση αναφέρεται με την ταυτότητά της.
 *
 * ⚠️ Δεν πετά ποτέ (το `recordChange` καταπίνει) — ίχνος που αποτυγχάνει δεν ακυρώνει
 * πράξη που ήδη δεσμεύτηκε.
 */

import 'server-only';
import { auditLedgerScopeOf } from '@/lib/audit/audit-ledger';
import { custodyOf, custodyWorkspace } from '@/lib/owner-property/listing-custody';
import { EntityAuditService } from '@/services/entity-audit.service';
import type { StayCalendarCommand } from '@/lib/stay/stay-calendar-command';
import type { OwnerProperty } from '@/types/owner-property';

/** Η κράτηση ως γραμμή — 🏆 με τη ρητή αποδοχή κανόνων (ADR-835 §21), ποτέ σιωπηλή παράκαμψη. */
function bookingLine(command: Extract<StayCalendarCommand, { action: 'book' }>, entryId: string | null): string {
  const acknowledged = command.acknowledgedWarnings.length === 0
    ? ''
    : ` · acknowledged: ${command.acknowledgedWarnings.join(', ')}`;
  return `${entryId} · ${command.checkIn}→${command.checkOut}${acknowledged}`;
}

function restrictionLine(command: Extract<StayCalendarCommand, { action: 'restrict' }>): string {
  return `${command.from}→${command.to} · ${JSON.stringify({ set: command.set, clear: command.clear })}`;
}

/** Η πράξη ως **μία** γραμμή αλλαγής — ίδιο σχήμα για κάθε πράξη, όχι πέντε διατυπώσεις. */
function changeOf(command: StayCalendarCommand, entryId: string | null): {
  readonly field: string;
  readonly oldValue: string | null;
  readonly newValue: string | null;
} {
  switch (command.action) {
    case 'declare':
      return { field: 'stayCalendar.declared', oldValue: null, newValue: String(command.declared) };
    case 'block':
      return { field: 'stayCalendar.block', oldValue: null, newValue: `${entryId} · ${command.from}→${command.to}` };
    case 'unblock':
      return { field: 'stayCalendar.block', oldValue: command.blockId, newValue: null };
    case 'book':
      return { field: 'stayCalendar.booking', oldValue: null, newValue: bookingLine(command, entryId) };
    case 'cancel':
      return { field: 'stayCalendar.booking', oldValue: command.bookingId, newValue: 'cancelled' };
    case 'rules':
      return { field: 'stayCalendar.rules', oldValue: null, newValue: JSON.stringify(command.rules) };
    case 'restrict':
      return { field: 'stayCalendar.days', oldValue: null, newValue: restrictionLine(command) };
  }
}

export async function recordStayCalendarWrite(
  property: OwnerProperty,
  command: StayCalendarCommand,
  entryId: string | null,
  performedBy: string,
): Promise<void> {
  const change = changeOf(command, entryId);
  await EntityAuditService.recordChange({
    entityType: 'owner_property',
    entityId: property.id,
    entityName: property.title.trim() || null,
    action: 'updated',
    changes: [{ ...change, label: change.field }],
    performedBy,
    performedByName: null,
    ...auditLedgerScopeOf(custodyWorkspace(custodyOf(property))),
  });
}

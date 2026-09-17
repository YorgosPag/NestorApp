/**
 * @fileoverview **Η ΑΙΣΙΟΔΟΞΗ ΕΚΔΟΧΗ** — πώς φαίνεται το ημερολόγιο ΑΝ ο διακομιστής δεχτεί.
 * @related ADR-835 §20 (Στάδιο Α) · hooks/stay/useStayCalendar.ts
 * @module lib/stay/stay-calendar-optimistic
 *
 * 🔑 **Πρόβλεψη, ποτέ απόφαση.** Η οθόνη αλλάζει αμέσως (Google Calendar), αλλά το «χωράει;»
 * το λέει **μόνο** ο κριτής μέσα στη συναλλαγή. Άρνηση ⇒ επαναφορά στο **προηγούμενο**
 * στιγμιότυπο, όχι «αναίρεση» της πρόβλεψης — η αναίρεση θα μπορούσε να σβήσει κάτι που
 * ήρθε στο μεταξύ.
 *
 * ⚠️ Προσωρινή ταυτότητα `pending:*` — δεν μοιάζει με enterprise id, άρα καμία πράξη δεν
 * μπορεί να σταλεί πάνω της κατά λάθος (το πάνελ τη βλέπει ως «αποθηκεύεται»).
 *
 * **Layering**: leaf — καθαρές συναρτήσεις.
 */

import type { StayCalendarCommand } from '@/lib/stay/stay-calendar-command';
import type { StayCalendarEntryView, StayCalendarView } from '@/lib/stay/stay-calendar-view';
import { restrictDays } from '@/lib/stay/stay-day-restriction';
import type { StayDayRules } from '@/types/stay-rules';

export const PENDING_ENTRY_PREFIX = 'pending:';

export function isPendingEntry(entry: StayCalendarEntryView): boolean {
  return entry.id.startsWith(PENDING_ENTRY_PREFIX);
}

type Readable = Extract<StayCalendarView, { kind: 'readable' }>;

function entriesAfter(
  entries: readonly StayCalendarEntryView[],
  command: StayCalendarCommand,
  pendingId: string,
): readonly StayCalendarEntryView[] {
  switch (command.action) {
    case 'declare':
    case 'rules':
    case 'restrict':
      return entries;
    case 'block':
      return [...entries, { kind: 'block', id: pendingId, from: command.from, to: command.to, source: 'owner', note: command.note }];
    case 'book':
      return [...entries, {
        kind: 'booking', id: pendingId, from: command.checkIn, to: command.checkOut, guests: command.guests,
        guestLabel: command.guestLabel, channel: 'direct', lifecycle: 'confirmed', occupies: true,
      }];
    case 'unblock':
      return entries.filter((entry) => entry.id !== command.blockId);
    case 'cancel':
      return entries.map((entry) => (entry.kind === 'booking' && entry.id === command.bookingId
        ? { ...entry, lifecycle: 'cancelled', occupies: false }
        : entry));
  }
}

/** Το στιγμιότυπο όπως θα είναι αν η πράξη δεσμευτεί. */
export function optimisticView(view: Readable, command: StayCalendarCommand, pendingId: string, nowIso: string): Readable {
  const declaredAt = command.action === 'declare' ? (command.declared ? nowIso : null) : view.declaredAt;
  return {
    ...view,
    declaredAt,
    entries: entriesAfter(view.entries, command, pendingId),
    rules: command.action === 'rules' ? command.rules : view.rules,
    days: daysAfter(view.days, command),
  };
}

/** Οι μέρες μετά τη ρύθμιση — με την ΙΔΙΑ συγχώνευση του διακομιστή· αντίφαση ⇒ αμετάβλητες. */
function daysAfter(days: StayDayRules, command: StayCalendarCommand): StayDayRules {
  if (command.action !== 'restrict') return days;
  const outcome = restrictDays(days, command);
  return outcome.kind === 'ok' ? outcome.days : days;
}

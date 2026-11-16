/**
 * @fileoverview ADR-089 — **ποιο γεγονός του ημερολογίου μετακινείται/αλλάζει από εδώ**: μόνο όσα έχουν κάτοχο το ίδιο το
 *   CRM (εργασίες). Ραντεβού και (ADR-915 §45 Φ4) αναθέσεις του μητρώου λήξεων έχουν **άλλον** κάτοχο ⇒ μόνο ανάγνωση.
 * @related components/crm/calendar/{CrmCalendar,useCrmCalendarMutations,useCalendarCrossMonthDrag}.tsx
 * @module services/calendar/calendar-event-editability
 *
 * 🔑 Ήταν **τέσσερα** αντίγραφα του `source === 'appointment'` — μια νέα πηγή θα γινόταν σιωπηλά «μετακινήσιμη» όπου
 *    ξεχνιόταν. Πλέον: λίστα **επιτρεπόμενων** (όχι απαγορευμένων) ⇒ κάθε νέα πηγή γεννιέται μόνο για ανάγνωση.
 */

import type { CalendarEventSource } from '@/types/calendar-event';

const EDITABLE_SOURCES: ReadonlySet<CalendarEventSource> = new Set<CalendarEventSource>(['task']);

export function isCalendarEventEditable(source: CalendarEventSource): boolean {
  return EDITABLE_SOURCES.has(source);
}

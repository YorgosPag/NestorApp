/**
 * @fileoverview **Ο ΓΡΑΦΕΑΣ iCalendar** — νύχτες → `.ics` ολοήμερων `VEVENT`,
 *   δημοσιευμένο ημερολόγιο (`METHOD:PUBLISH`).
 * @related ADR-835 §22 (Στάδιο Γ) · RFC 5545 §3.6.1 · RFC 7986 §5.7 (REFRESH-INTERVAL) ·
 *   lib/ical/ical-text.ts · lib/ical/ical-read.ts
 * @module lib/ical/ical-write
 *
 * 🔑 **Μοιράζεται το `ical-text` με τον αναγνώστη**, άρα η άγκυρα `read(write(x)) === x`
 * ελέγχει **και τις δύο** κατευθύνσεις — δίπλωμα, διαφυγή, ημι-ανοιχτό διάστημα.
 *
 * ⚠️ **ΟΛΟΗΜΕΡΑ, ΠΑΝΤΑ** (`VALUE=DATE`): μια νύχτα δεν έχει ώρα, και μια ώρα θα
 * ανάγκαζε κάθε παραλήπτη να μαντέψει ζώνη. Το `DTEND` είναι **αποκλειστικό** — η
 * πρώτη ανοιχτή μέρα — δηλαδή **το ίδιο** `[from, to)` που κρατά ο κριτής κατάληψης.
 *
 * ⚠️ **ΚΑΝΕΝΑ ΠΡΟΣΩΠΟ.** Ο γραφέας δεν έχει καν πεδίο για όνομα, σημείωση ή πλήθος
 * ατόμων: το σχήμα του {@link IcalWriteEvent} κάνει τη διαρροή **μη εκφράσιμη**, αντί
 * να τη φυλάει έλεγχος που κάποιος θα ξεχάσει.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O, μηδέν ρολόι (η στιγμή δίνεται).
 */

import { foldIcalLine, escapeIcalText, ICAL_CRLF } from './ical-text';

/** Η κατάσταση ενός γεγονότος — `TENTATIVE` για κράτηση υπό προθεσμία (holds, Στάδιο Δ). */
export const ICAL_EVENT_STATUSES = ['CONFIRMED', 'TENTATIVE'] as const;

export type IcalEventStatus = (typeof ICAL_EVENT_STATUSES)[number];

/** Ένα γεγονός προς δημοσίευση. Ημι-ανοιχτό `[from, to)` σε `YYYY-MM-DD`. */
export interface IcalWriteEvent {
  readonly uid: string;
  readonly from: string;
  readonly to: string;
  readonly summary: string;
  readonly status: IcalEventStatus;
  /** ISO στιγμή τελευταίας αλλαγής — γίνεται `DTSTAMP` + `LAST-MODIFIED`. */
  readonly updatedAt: string;
}

export interface IcalCalendarInput {
  readonly prodId: string;
  readonly name: string;
  /** Διάρκεια ISO-8601 για `REFRESH-INTERVAL` / `X-PUBLISHED-TTL`, π.χ. `PT1H`. */
  readonly refreshInterval: string;
  readonly events: readonly IcalWriteEvent[];
}

/** `YYYY-MM-DD` → `YYYYMMDD`. Δεν επικυρώνει: ο καλών περνά κλειδιά ημέρας. */
function basicDate(dateKey: string): string {
  return dateKey.replace(/-/g, '');
}

/** ISO στιγμή → `YYYYMMDDTHHMMSSZ`. Άκυρη στιγμή ⇒ η εφεδρεία του καλούντος. */
function basicUtcStamp(iso: string, fallback: string): string {
  const parsed = new Date(iso);
  const instant = Number.isNaN(parsed.getTime()) ? new Date(fallback) : parsed;
  return `${instant.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
}

function eventLines(event: IcalWriteEvent, stamp: string): readonly string[] {
  return [
    'BEGIN:VEVENT',
    `UID:${escapeIcalText(event.uid)}`,
    `DTSTAMP:${stamp}`,
    `LAST-MODIFIED:${stamp}`,
    `DTSTART;VALUE=DATE:${basicDate(event.from)}`,
    `DTEND;VALUE=DATE:${basicDate(event.to)}`,
    `SUMMARY:${escapeIcalText(event.summary)}`,
    `STATUS:${event.status}`,
    'TRANSP:OPAQUE',
    'END:VEVENT',
  ];
}

/**
 * **Γεγονότα → `.ics`.** Το αποτέλεσμα τελειώνει σε `CRLF`, όπως το θέλει το πρωτόκολλο.
 *
 * 🔑 Το `X-PUBLISHED-TTL` μπαίνει **μαζί** με το πρότυπο `REFRESH-INTERVAL` (RFC 7986):
 * το δεύτερο είναι ο διάδοχος, το πρώτο είναι ό,τι διαβάζουν ακόμη οι παλιοί πελάτες.
 * Και τα δύο είναι **υπόδειξη** — μετρημένα, Google/Outlook τα αγνοούν.
 */
export function writeIcalCalendar(input: IcalCalendarInput): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${escapeIcalText(input.prodId)}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcalText(input.name)}`,
    `REFRESH-INTERVAL;VALUE=DURATION:${input.refreshInterval}`,
    `X-PUBLISHED-TTL:${input.refreshInterval}`,
  ];
  for (const event of input.events) {
    lines.push(...eventLines(event, basicUtcStamp(event.updatedAt, '1970-01-01T00:00:00.000Z')));
  }
  lines.push('END:VCALENDAR');

  const folded: string[] = [];
  for (const line of lines) folded.push(...foldIcalLine(line));
  return `${folded.join(ICAL_CRLF)}${ICAL_CRLF}`;
}

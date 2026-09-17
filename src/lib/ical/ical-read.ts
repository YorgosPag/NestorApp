/**
 * @fileoverview **Ο ΑΥΣΤΗΡΟΣ ΑΝΑΓΝΩΣΤΗΣ iCalendar** — `.ics` → νύχτες, ή **ονομασμένη
 *   αποτυχία**. Ποτέ «διάβασα ό,τι κατάλαβα».
 * @related ADR-835 §22 (Στάδιο Γ) · §6.4 · RFC 5545 §3.6.1 (VEVENT) · §3.3.4-5 (DATE /
 *   DATE-TIME) · lib/ical/ical-text.ts · lib/stay/stay-channel-reconcile.ts
 * @module lib/ical/ical-read
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΔΙΚΟΣ ΜΑΣ ΚΑΙ ΟΧΙ ΒΙΒΛΙΟΘΗΚΗ — Η ΣΗΜΑΣΙΟΛΟΓΙΑ ΤΗΣ ΑΠΟΤΥΧΙΑΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Οι βιβλιοθήκες iCalendar είναι **ανεκτικές**: γεγονός που δεν καταλαβαίνουν, το
 * **παραλείπουν σιωπηλά**. Εδώ, παράλειψη γεγονότος σημαίνει **«ελεύθερη νύχτα»** —
 * δηλαδή overbooking με τη σφραγίδα μας (§6.4). Είναι **ακριβώς** το σχήμα «`0`
 * σημαίνει *κανείς δεν κοίταξε*» που το έργο έχει πληρώσει τέσσερις φορές (N.11 · N.12
 * · N.18 · CHECK 3.18).
 *
 * Άρα: **ό,τι δεν αναγνωρίζεται ⇒ ολόκληρη η ανάγνωση αποτυγχάνει με όνομα**, ο
 * καλών κρατά ό,τι είχε, και ο ιδιοκτήτης διαβάζει τι φταίει. Η άδεια (MPL-2.0 του
 * `ical.js`) ήταν **δεύτερος** λόγος (N.5), όχι ο πρώτος.
 *
 * ⚠️ **Ό,τι είναι ΜΕΣΑ σε `VTIMEZONE` δεν είναι γεγονός.** Τα `VTIMEZONE` έχουν δικά
 * τους `DTSTART` **και `RRULE`** (αλλαγή ώρας): αναγνώστης που δεν κρατά στοίβα
 * συστατικών θα κήρυττε **κάθε** ημερολόγιο με ζώνη ώρας «επαναλαμβανόμενο» και δεν θα
 * διάβαζε **ποτέ** τίποτα.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O, **μηδέν ρολόι και μηδέν ζώνη
 * ώρας**: η μετάφραση στιγμής `Z` σε ημέρα δίνεται από τον καλούντα (ο δικός μας τομέας
 * ρωτά την **Αθήνα**, `STAY_CALENDAR_TIMEZONE`).
 */

import { addDaysToDateKey, isDateKey } from '@/lib/calendar/date-key';
import { parseIcalContentLine, unescapeIcalText, unfoldIcalLines } from './ical-text';

/** Ανώτατο πλήθος γεγονότων σε ένα feed — πέρα από αυτό δεν είναι ημερολόγιο καταλύματος. */
export const ICAL_MAX_EVENTS = 5_000;

/**
 * **Ένα γεγονός ως νύχτες.** Ημι-ανοιχτό `[from, to)`, ίδιο ιδίωμα με `StayBlock` και
 * `StayBooking`: το `to` είναι η πρώτη **ανοιχτή** μέρα.
 */
export interface IcalEvent {
  readonly uid: string;
  readonly from: string;
  readonly to: string;
  /** Ο τίτλος όπως τον στέλνει το κανάλι («Reserved», «CLOSED - Not available») — ενδεικτικός. */
  readonly summary: string | null;
}

/**
 * **Γιατί δεν διαβάστηκε.** Μηχανικοί κωδικοί: η οθόνη τους μεταφράζει σε πρόταση με
 * **διέξοδο** («ο σύνδεσμος δεν δείχνει ημερολόγιο» ≠ «το ημερολόγιο έχει
 * επαναλαμβανόμενα γεγονότα»).
 */
export type IcalReadFailure =
  | 'not-a-calendar'
  | 'truncated'
  | 'event-without-uid'
  | 'event-without-start'
  | 'unreadable-date'
  | 'recurrence-unsupported'
  | 'too-many-events';

export type IcalReadResult =
  | {
      readonly ok: true;
      readonly events: readonly IcalEvent[];
      /** `X-WR-CALNAME`, όταν το στέλνει το κανάλι. */
      readonly calendarName: string | null;
    }
  | { readonly ok: false; readonly failure: IcalReadFailure };

/** Πώς μια **στιγμή** (UTC, `…Z`) γίνεται ημερολογιακή ημέρα του καταλύματος. */
export interface IcalReadOptions {
  readonly dateKeyOfInstant: (epochMs: number) => string;
}

const DATE_ONLY = /^(\d{4})(\d{2})(\d{2})$/;
const DATE_TIME = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/;
const DURATION_DAYS = /^[+-]?P(?:(\d+)W|(\d+)D)(?:T.*)?$/;

type Moment =
  | { readonly kind: 'date'; readonly dateKey: string }
  | { readonly kind: 'datetime'; readonly dateKey: string };

// =============================================================================
// 1. ΣΤΙΓΜΕΣ — DATE, DATE-TIME ΜΕ ΖΩΝΗ, DATE-TIME ΣΕ UTC
// =============================================================================

function dateKeyOfParts(year: string, month: string, day: string): string | null {
  const key = `${year}-${month}-${day}`;
  return isDateKey(key) ? key : null;
}

/**
 * **Η ημέρα μιας τιμής χρόνου.**
 *
 * 🔑 **Το `TZID` και η «αιωρούμενη» ώρα δεν μεταφράζονται**: η γραμμένη ημερομηνία
 * **είναι** η ημέρα. Μόνο το `Z` (UTC) περνά από τη ζώνη του καταλύματος — αλλιώς μια
 * άφιξη «22:00 τοπικά» θα γινόταν η **επόμενη** μέρα και η νύχτα θα έλειπε.
 */
function momentOf(value: string, options: IcalReadOptions): Moment | null {
  const dateOnly = DATE_ONLY.exec(value);
  if (dateOnly !== null) {
    const dateKey = dateKeyOfParts(dateOnly[1] ?? '', dateOnly[2] ?? '', dateOnly[3] ?? '');
    return dateKey === null ? null : { kind: 'date', dateKey };
  }
  const dateTime = DATE_TIME.exec(value);
  if (dateTime === null) return null;
  const written = dateKeyOfParts(dateTime[1] ?? '', dateTime[2] ?? '', dateTime[3] ?? '');
  if (written === null) return null;
  if (dateTime[7] !== 'Z') return { kind: 'datetime', dateKey: written };
  const epochMs = Date.UTC(
    Number(dateTime[1]), Number(dateTime[2]) - 1, Number(dateTime[3]),
    Number(dateTime[4]), Number(dateTime[5]), Number(dateTime[6]),
  );
  const zoned = options.dateKeyOfInstant(epochMs);
  return isDateKey(zoned) ? { kind: 'datetime', dateKey: zoned } : null;
}

/** `DURATION` σε **ημέρες** (`dur-day` / `dur-week`) — ώρες/λεπτά στρογγυλοποιούνται πάνω σε 1 ημέρα. */
function durationDays(value: string): number | null {
  const match = DURATION_DAYS.exec(value.trim().toUpperCase());
  if (match === null) return value.trim().toUpperCase().startsWith('P') ? 1 : null;
  const weeks = match[1] === undefined ? 0 : Number(match[1]);
  const days = match[2] === undefined ? 0 : Number(match[2]);
  const total = weeks * 7 + days;
  return total > 0 ? total : 1;
}

// =============================================================================
// 2. ΤΟ ΓΕΓΟΝΟΣ — ΑΠΟ ΤΙΣ ΓΡΑΜΜΕΣ ΤΟΥ `VEVENT`
// =============================================================================

interface EventDraft {
  uid: string | null;
  start: Moment | null;
  end: Moment | null;
  duration: number | null;
  summary: string | null;
  cancelled: boolean;
  recurring: boolean;
  malformedDate: boolean;
}

function newDraft(): EventDraft {
  return {
    uid: null, start: null, end: null, duration: null,
    summary: null, cancelled: false, recurring: false, malformedDate: false,
  };
}

function collectEventLine(draft: EventDraft, name: string, value: string, options: IcalReadOptions): void {
  switch (name) {
    case 'UID':
      draft.uid = value.trim() === '' ? null : unescapeIcalText(value).trim();
      return;
    case 'SUMMARY':
      draft.summary = unescapeIcalText(value);
      return;
    case 'STATUS':
      draft.cancelled = value.trim().toUpperCase() === 'CANCELLED';
      return;
    case 'RRULE':
    case 'RDATE':
    case 'RECURRENCE-ID':
      draft.recurring = true;
      return;
    case 'DTSTART':
    case 'DTEND': {
      const moment = momentOf(value.trim(), options);
      if (moment === null) draft.malformedDate = true;
      else if (name === 'DTSTART') draft.start = moment;
      else draft.end = moment;
      return;
    }
    case 'DURATION': {
      const days = durationDays(value);
      if (days === null) draft.malformedDate = true;
      else draft.duration = days;
      return;
    }
    default:
      return;
  }
}

/**
 * **Το προσχέδιο ως νύχτες**, ή ονομασμένη αποτυχία.
 *
 * 🔴 **Μηδενικό διάστημα ⇒ ΜΙΑ νύχτα, όχι παράλειψη.** Γεγονός με `DTEND == DTSTART`
 * (μετρημένο σε feeds) δεν είναι «τίποτα»: κάποιος **δήλωσε** κάτι εκείνη τη μέρα. Η
 * ασφαλής κατεύθυνση είναι να **κλείσει** τη νύχτα — ένα άνοιγμα εδώ είναι το
 * overbooking.
 */
function eventOf(draft: EventDraft): IcalEvent | IcalReadFailure {
  if (draft.recurring) return 'recurrence-unsupported';
  if (draft.malformedDate) return 'unreadable-date';
  if (draft.uid === null) return 'event-without-uid';
  if (draft.start === null) return 'event-without-start';

  const from = draft.start.dateKey;
  const to = endDateKeyOf(draft, from);
  if (to === null) return 'unreadable-date';
  if (to < from) return 'unreadable-date';
  const nights = to === from ? addDaysToDateKey(from, 1) : to;
  if (nights === null) return 'unreadable-date';
  return { uid: draft.uid, from, to: nights, summary: draft.summary };
}

function endDateKeyOf(draft: EventDraft, from: string): string | null {
  if (draft.end !== null) return draft.end.dateKey;
  if (draft.duration !== null) return addDaysToDateKey(from, draft.duration);
  // RFC 5545 §3.6.1: `DTSTART;VALUE=DATE` χωρίς `DTEND` ⇒ μία ημέρα. Για `DATE-TIME` το
  // RFC λέει «ίδια στιγμή» — που ως νύχτες είναι μηδέν· fail-closed ⇒ μία νύχτα.
  return addDaysToDateKey(from, 1);
}

// =============================================================================
// 3. Η ΑΝΑΓΝΩΣΗ — ΣΤΟΙΒΑ ΣΥΣΤΑΤΙΚΩΝ, ΠΟΤΕ «ΟΠΟΥ ΒΡΩ `DTSTART`»
// =============================================================================

interface ReadState {
  readonly stack: string[];
  readonly events: IcalEvent[];
  draft: EventDraft | null;
  calendarName: string | null;
  sawCalendar: boolean;
  closedCalendar: boolean;
}

function beginComponent(state: ReadState, component: string): void {
  state.stack.push(component);
  if (component === 'VCALENDAR') state.sawCalendar = true;
  if (component === 'VEVENT' && state.stack.includes('VCALENDAR')) state.draft = newDraft();
}

function endComponent(state: ReadState, component: string): IcalReadFailure | null {
  const open = state.stack.pop();
  if (open !== component) return 'truncated';
  if (component === 'VCALENDAR') state.closedCalendar = true;
  if (component !== 'VEVENT' || state.draft === null) return null;
  const draft = state.draft;
  state.draft = null;
  if (draft.cancelled) return null;
  const event = eventOf(draft);
  if (typeof event === 'string') return event;
  state.events.push(event);
  return state.events.length > ICAL_MAX_EVENTS ? 'too-many-events' : null;
}

/** Είμαστε **μέσα** σε `VEVENT` και όχι σε φωλιασμένο συστατικό του (π.χ. `VALARM`); */
function insideEvent(state: ReadState): boolean {
  return state.draft !== null && state.stack[state.stack.length - 1] === 'VEVENT';
}

/**
 * **`.ics` → γεγονότα.** Η ΜΙΑ ανάγνωση: κάθε καταναλωτής (cron, δοκιμή, μελλοντική
 * εισαγωγή από αρχείο) περνά από εδώ.
 */
export function readIcalCalendar(raw: string, options: IcalReadOptions): IcalReadResult {
  const state: ReadState = {
    stack: [], events: [], draft: null,
    calendarName: null, sawCalendar: false, closedCalendar: false,
  };

  for (const logical of unfoldIcalLines(raw)) {
    const line = parseIcalContentLine(logical);
    if (line === null) continue;
    if (line.name === 'BEGIN') {
      beginComponent(state, line.value.trim().toUpperCase());
      continue;
    }
    if (line.name === 'END') {
      const failure = endComponent(state, line.value.trim().toUpperCase());
      if (failure !== null) return { ok: false, failure };
      continue;
    }
    if (line.name === 'X-WR-CALNAME' && state.stack[state.stack.length - 1] === 'VCALENDAR') {
      state.calendarName = unescapeIcalText(line.value);
      continue;
    }
    if (insideEvent(state) && state.draft !== null) {
      collectEventLine(state.draft, line.name, line.value, options);
    }
  }

  if (!state.sawCalendar) return { ok: false, failure: 'not-a-calendar' };
  // Ανοιχτό συστατικό ή απουσία `END:VCALENDAR` = **κολοβό σώμα** (μετρημένο σε feeds):
  // ό,τι λείπει από το τέλος θα φαινόταν «ελεύθερο».
  if (!state.closedCalendar || state.stack.length > 0) return { ok: false, failure: 'truncated' };
  return { ok: true, events: state.events, calendarName: state.calendarName };
}

/**
 * @fileoverview **ΟΙ ΠΡΑΞΕΙΣ ΠΑΝΩ ΣΤΟ ΗΜΕΡΟΛΟΓΙΟ** — κλειστό λεξιλόγιο + ο ΜΟΝΟΣ
 *   αναλυτής σώματος αιτήματος.
 * @related ADR-835 §20 (Στάδιο Α) · CHECK 3.78 (παραλλαγή σώματος, όχι νέα διαδρομή) ·
 *   services/stay-calendar/stay-calendar-write.service.ts · lib/calendar/date-key.ts
 * @module lib/stay/stay-calendar-command
 *
 * 🔑 **Ένας αναλυτής, δώδεκα πράξεις** (Στάδιο Β: `rules` · `restrict` · Στάδιο Δ: `request` · `withdraw` ·
 * `accept` · `decline` · `expire`) — ίδιο ιδίωμα με το `PATCH /api/owner-properties/[id]`
 * (`lifecycle` · `marketingAudience` · `privateMarketing`). Κάθε πράξη είναι μέλος
 * διακριτής ένωσης, άρα ο διακομιστής **δεν μπορεί** να δεχτεί «κράτηση χωρίς επισκέπτη».
 *
 * ⚠️ **Εδώ κρίνεται μόνο το ΣΧΗΜΑ.** Το «χωράει;» το κρίνει ο κριτής κατάληψης **μέσα
 * στη συναλλαγή** — ποτέ εδώ, όπου τα δεδομένα θα ήταν ήδη μπαγιάτικα.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O, μηδέν ρολόι.
 */

import { daysBetweenDateKeys, isDateKey } from '@/lib/calendar/date-key';
import { isMinorAmount, type MinorAmount } from '@/lib/money/money';
import { isDeclaredPetCount, isWholeGuestCount } from '@/lib/offers/offer-amount';
import { isRecord } from '@/lib/type-guards';
import { isStayRuleWarningKind, type StayRuleWarningKind } from '@/lib/stay/stay-rule-warnings';
import { stayDayRuleFrom, stayRulesFrom } from '@/lib/stay/stay-rules-shape';
import {
  STAY_DAY_RULE_FIELDS,
  type StayDayRule,
  type StayDayRuleField,
  type StayRules,
} from '@/types/stay-rules';

/** Ανώτατη διάρκεια ενός block — τρία χρόνια. Πέρα από αυτό είναι απόσυρση, όχι κλείσιμο. */
export const STAY_BLOCK_MAX_NIGHTS = 1096;
/** Ανώτατη διάρκεια χειροκίνητης κράτησης. Το όριο των 59 ημερών ΔΕΝ μπαίνει εδώ (§4.9). */
export const STAY_BOOKING_MAX_NIGHTS = 366;
export const STAY_NOTE_MAX_LENGTH = 500;
export const STAY_GUEST_LABEL_MAX_LENGTH = 120;
/** Ανώτατο εύρος ρύθμισης ημερών σε μία πράξη — ένα έτος. */
export const STAY_RESTRICT_MAX_NIGHTS = 366;

export type StayCalendarCommand =
  /** «Το ημερολόγιο είναι ενημερωμένο» — ή η ανάκλησή του. */
  | { readonly action: 'declare'; readonly declared: boolean }
  | { readonly action: 'block'; readonly from: string; readonly to: string; readonly note: string | null }
  | { readonly action: 'unblock'; readonly blockId: string }
  | {
      readonly action: 'book';
      readonly checkIn: string;
      readonly checkOut: string;
      readonly guests: number;
      /** Κατοικίδια της διαμονής: `0` = κανένα (ADR-777 §8.60.21.7). */
      readonly pets: number;
      readonly guestLabel: string;
      /** Οι κανόνες που ο οικοδεσπότης **ρητά** αποδέχεται να παρακάμψει (ADR-835 §21). */
      readonly acknowledgedWarnings: readonly StayRuleWarningKind[];
    }
  | { readonly action: 'cancel'; readonly bookingId: string }
  /**
   * **Αίτημα επισκέπτη** (Στάδιο Δ, §23.4). Το `riskAcknowledged` είναι η **ρητή** αποδοχή ότι το
   * ακίνητο πωλείται (§4.7): όταν ισχύει και λείπει, ο γραφέας αρνείται — η αποκάλυψη είναι γεγονός.
   */
  | {
      readonly action: 'request';
      readonly checkIn: string;
      readonly checkOut: string;
      readonly guests: number;
      /**
       * Κατοικίδια: `0` = κανένα, **ρητά** (ADR-777 §8.60.21.7). Κρίνονται από τον **ίδιο** κριτή
       * (`petsVerdict`) μέσα στη συναλλαγή και μπαίνουν στην **ίδια** τιμολόγηση.
       */
      readonly pets: number;
      /**
       * 🏆 **Το σύνολο που ΕΙΔΕ ο επισκέπτης** — `null` = δεν του δείχτηκε σύνολο (νύχτες χωρίς τιμή).
       * Ο γραφέας ξαναϋπολογίζει μέσα στη συναλλαγή· διαφορά ⇒ `price-changed`, ποτέ δέσμευση σε
       * ποσό που δεν είδε (Οδηγία 2011/83/ΕΕ άρ. 6(6)).
       */
      readonly expectedTotalMinor: MinorAmount | null;
      readonly riskAcknowledged: boolean;
    }
  /** Ο επισκέπτης αποσύρει το αίτημά του πριν απαντηθεί. */
  | { readonly action: 'withdraw'; readonly bookingId: string }
  /** Ο οικοδεσπότης δέχεται — ο κριτής ξανατρέχει μέσα στη συναλλαγή. */
  | { readonly action: 'accept'; readonly bookingId: string }
  /** Ο οικοδεσπότης αρνείται. */
  | { readonly action: 'decline'; readonly bookingId: string }
  /** Το σύστημα καταγράφει λήξη — **μόνο** με νεκρό hold (cron `stay-hold-expiry`). */
  | { readonly action: 'expire'; readonly bookingId: string }
  /** Αντικατάσταση των κανόνων βάσης (Στάδιο Β). */
  | { readonly action: 'rules'; readonly rules: StayRules }
  /**
   * Ρύθμιση των ημερών `[from, to)`: τα πεδία του `set` γράφονται, τα πεδία του `clear`
   * σβήνονται (επιστροφή στη βάση). Κάθε ημέρα κρατά ό,τι άλλο είχε.
   */
  | {
      readonly action: 'restrict';
      readonly from: string;
      readonly to: string;
      readonly set: StayDayRule;
      readonly clear: readonly StayDayRuleField[];
    };

export type StayCalendarCommandParse =
  | { readonly ok: true; readonly command: StayCalendarCommand }
  | { readonly ok: false; readonly malformed: readonly string[] };

type Body = Readonly<Record<string, unknown>>;

function malformed(...fields: string[]): StayCalendarCommandParse {
  return { ok: false, malformed: fields };
}

function idOf(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

/** Κείμενο με όριο μήκους· κενό ⇒ `null`. `undefined` = παραβίαση. */
function boundedText(value: unknown, max: number): string | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (trimmed.length > max) return undefined;
  return trimmed.length === 0 ? null : trimmed;
}

/** Νύχτες `[from, to)`: έγκυρες ημερομηνίες, ≥1 νύχτα, ≤ `max`. */
function nightsWithin(from: unknown, to: unknown, max: number): boolean {
  if (!isDateKey(from) || !isDateKey(to)) return false;
  const nights = daysBetweenDateKeys(from, to);
  return nights !== null && nights >= 1 && nights <= max;
}

function parseBlock(body: Body): StayCalendarCommandParse {
  const note = boundedText(body.note, STAY_NOTE_MAX_LENGTH);
  const bad: string[] = [];
  if (!nightsWithin(body.from, body.to, STAY_BLOCK_MAX_NIGHTS)) bad.push('from', 'to');
  if (note === undefined) bad.push('note');
  if (bad.length > 0 || note === undefined) return malformed(...bad);
  return { ok: true, command: { action: 'block', from: String(body.from), to: String(body.to), note } };
}

/**
 * Ο **κοινός** πυρήνας κράτησης και αιτήματος: νύχτες `[checkIn, checkOut)` + πλήθος επισκεπτών.
 * Γράφει τα άκυρα πεδία στο `bad`· επιστρέφει τους επισκέπτες, ή `null` αν είναι άκυροι.
 */
function stayGuestsWithin(body: Body, bad: string[]): number | null {
  if (!nightsWithin(body.checkIn, body.checkOut, STAY_BOOKING_MAX_NIGHTS)) bad.push('checkIn', 'checkOut');
  const { guests } = body;
  if (isWholeGuestCount(guests)) return guests;
  bad.push('guests');
  return null;
}

/** Κατοικίδια του σώματος: **υποχρεωτικό** `0..5` — ποτέ σιωπηλό «κανένα» από απουσία. */
function petsWithin(body: Body, bad: string[]): number | null {
  if (isDeclaredPetCount(body.pets)) return body.pets;
  bad.push('pets');
  return null;
}

/** Το σύνολο που είδε ο επισκέπτης: λεπτά ή ρητό `null`. Απών ⇒ άκυρο (`undefined`). */
function expectedTotalOf(value: unknown): MinorAmount | null | undefined {
  if (value === null) return null;
  return isMinorAmount(value) ? value : undefined;
}

function parseBook(body: Body): StayCalendarCommandParse {
  const guestLabel = boundedText(body.guestLabel, STAY_GUEST_LABEL_MAX_LENGTH);
  const bad: string[] = [];
  const guests = stayGuestsWithin(body, bad);
  const pets = petsWithin(body, bad);
  // 🔑 Χειροκίνητη κράτηση **χωρίς** όνομα δεν είναι κράτηση — είναι block.
  if (guestLabel === undefined || guestLabel === null) bad.push('guestLabel');
  const acknowledgedWarnings = warningsOf(body.acknowledgedWarnings);
  if (acknowledgedWarnings === null) bad.push('acknowledgedWarnings');
  if (bad.length > 0 || guests === null || pets === null || !guestLabel || acknowledgedWarnings === null) {
    return malformed(...bad);
  }
  return {
    ok: true,
    command: {
      action: 'book', checkIn: String(body.checkIn), checkOut: String(body.checkOut), guests, pets, guestLabel,
      acknowledgedWarnings,
    },
  };
}

function parseRequest(body: Body): StayCalendarCommandParse {
  const { riskAcknowledged } = body;
  const bad: string[] = [];
  const guests = stayGuestsWithin(body, bad);
  const pets = petsWithin(body, bad);
  const expectedTotalMinor = expectedTotalOf(body.expectedTotalMinor);
  if (expectedTotalMinor === undefined) bad.push('expectedTotalMinor');
  // Ρητό `boolean`, ποτέ «απών = όχι»: η αποκάλυψη είναι γεγονός και γράφεται μόνο αν ειπώθηκε.
  if (typeof riskAcknowledged !== 'boolean') bad.push('riskAcknowledged');
  if (bad.length > 0 || guests === null || pets === null || expectedTotalMinor === undefined
    || typeof riskAcknowledged !== 'boolean') return malformed(...bad);
  return {
    ok: true,
    command: {
      action: 'request', checkIn: String(body.checkIn), checkOut: String(body.checkOut), guests, pets,
      expectedTotalMinor, riskAcknowledged,
    },
  };
}

/** Οι πράξεις που αγγίζουν **μία** κράτηση με το id της. */
type BookingAction = 'cancel' | 'withdraw' | 'accept' | 'decline' | 'expire';

function parseBookingAction(action: BookingAction, body: Body): StayCalendarCommandParse {
  const bookingId = idOf(body.bookingId);
  return bookingId === null ? malformed('bookingId') : { ok: true, command: { action, bookingId } };
}

/** Απών = καμία αποδοχή· παρών = πίνακας γνωστών προειδοποιήσεων χωρίς διπλότυπα. */
function warningsOf(value: unknown): readonly StayRuleWarningKind[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every(isStayRuleWarningKind)) return null;
  return new Set(value).size === value.length ? value : null;
}

/** Πεδία προς «καθάρισε»: γνωστά, χωρίς διπλότυπα. */
function clearFieldsOf(value: unknown): readonly StayDayRuleField[] | null {
  if (value === undefined) return [];
  const known: readonly unknown[] = STAY_DAY_RULE_FIELDS;
  if (!Array.isArray(value) || !value.every((field) => known.includes(field))) return null;
  return new Set(value).size === value.length ? (value as StayDayRuleField[]) : null;
}

function parseRestrict(body: Body): StayCalendarCommandParse {
  const set = body.set === undefined ? {} : stayDayRuleFrom(body.set);
  const clear = clearFieldsOf(body.clear);
  const bad: string[] = [];
  if (!nightsWithin(body.from, body.to, STAY_RESTRICT_MAX_NIGHTS)) bad.push('from', 'to');
  if (set === null) bad.push('set');
  if (clear === null) bad.push('clear');
  if (bad.length > 0 || set === null || clear === null) return malformed(...bad);
  // Κενή πράξη, ή το ίδιο πεδίο και «γράψε» και «σβήσε» ⇒ δεν είναι εντολή.
  const setFields = Object.keys(set);
  if (setFields.length + clear.length === 0) return malformed('set', 'clear');
  if (clear.some((field) => setFields.includes(field))) return malformed('clear');
  return { ok: true, command: { action: 'restrict', from: String(body.from), to: String(body.to), set, clear } };
}

/** **Ο αναλυτής.** Άγνωστη πράξη ⇒ `malformed(['action'])`, ποτέ σιωπηλή προεπιλογή. */
export function stayCalendarCommandFrom(raw: unknown): StayCalendarCommandParse {
  if (!isRecord(raw)) return malformed('body');
  switch (raw.action) {
    case 'declare':
      return typeof raw.declared === 'boolean'
        ? { ok: true, command: { action: 'declare', declared: raw.declared } }
        : malformed('declared');
    case 'block':
      return parseBlock(raw);
    case 'unblock': {
      const blockId = idOf(raw.blockId);
      return blockId === null ? malformed('blockId') : { ok: true, command: { action: 'unblock', blockId } };
    }
    case 'book':
      return parseBook(raw);
    case 'cancel':
      return parseBookingAction('cancel', raw);
    case 'withdraw':
      return parseBookingAction('withdraw', raw);
    case 'accept':
      return parseBookingAction('accept', raw);
    case 'decline':
      return parseBookingAction('decline', raw);
    case 'expire':
      return parseBookingAction('expire', raw);
    case 'request':
      return parseRequest(raw);
    case 'rules': {
      const rules = stayRulesFrom(raw.rules);
      return rules === null ? malformed('rules') : { ok: true, command: { action: 'rules', rules } };
    }
    case 'restrict':
      return parseRestrict(raw);
    default:
      return malformed('action');
  }
}

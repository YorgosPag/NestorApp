/**
 * @fileoverview **ΟΙ ΠΡΑΞΕΙΣ ΠΑΝΩ ΣΤΟ ΗΜΕΡΟΛΟΓΙΟ** — κλειστό λεξιλόγιο + ο ΜΟΝΟΣ
 *   αναλυτής σώματος αιτήματος.
 * @related ADR-835 §20 (Στάδιο Α) · CHECK 3.78 (παραλλαγή σώματος, όχι νέα διαδρομή) ·
 *   services/stay-calendar/stay-calendar-write.service.ts · lib/calendar/date-key.ts
 * @module lib/stay/stay-calendar-command
 *
 * 🔑 **Μία διαδρομή, επτά πράξεις** (Στάδιο Β: `rules` · `restrict`) — ίδιο ιδίωμα με το `PATCH /api/owner-properties/[id]`
 * (`lifecycle` · `marketingAudience` · `privateMarketing`). Κάθε πράξη είναι μέλος
 * διακριτής ένωσης, άρα ο διακομιστής **δεν μπορεί** να δεχτεί «κράτηση χωρίς επισκέπτη».
 *
 * ⚠️ **Εδώ κρίνεται μόνο το ΣΧΗΜΑ.** Το «χωράει;» το κρίνει ο κριτής κατάληψης **μέσα
 * στη συναλλαγή** — ποτέ εδώ, όπου τα δεδομένα θα ήταν ήδη μπαγιάτικα.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O, μηδέν ρολόι.
 */

import { daysBetweenDateKeys, isDateKey } from '@/lib/calendar/date-key';
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
export const STAY_BOOKING_MAX_GUESTS = 50;
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
      readonly guestLabel: string;
      /** Οι κανόνες που ο οικοδεσπότης **ρητά** αποδέχεται να παρακάμψει (ADR-835 §21). */
      readonly acknowledgedWarnings: readonly StayRuleWarningKind[];
    }
  | { readonly action: 'cancel'; readonly bookingId: string }
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

function parseBook(body: Body): StayCalendarCommandParse {
  const guestLabel = boundedText(body.guestLabel, STAY_GUEST_LABEL_MAX_LENGTH);
  const guests = body.guests;
  const bad: string[] = [];
  if (!nightsWithin(body.checkIn, body.checkOut, STAY_BOOKING_MAX_NIGHTS)) bad.push('checkIn', 'checkOut');
  if (typeof guests !== 'number' || !Number.isInteger(guests) || guests < 1 || guests > STAY_BOOKING_MAX_GUESTS) {
    bad.push('guests');
  }
  // 🔑 Χειροκίνητη κράτηση **χωρίς** όνομα δεν είναι κράτηση — είναι block.
  if (guestLabel === undefined || guestLabel === null) bad.push('guestLabel');
  const acknowledgedWarnings = warningsOf(body.acknowledgedWarnings);
  if (acknowledgedWarnings === null) bad.push('acknowledgedWarnings');
  if (bad.length > 0 || typeof guests !== 'number' || !guestLabel || acknowledgedWarnings === null) {
    return malformed(...bad);
  }
  return {
    ok: true,
    command: {
      action: 'book', checkIn: String(body.checkIn), checkOut: String(body.checkOut), guests, guestLabel,
      acknowledgedWarnings,
    },
  };
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
    case 'cancel': {
      const bookingId = idOf(raw.bookingId);
      return bookingId === null ? malformed('bookingId') : { ok: true, command: { action: 'cancel', bookingId } };
    }
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

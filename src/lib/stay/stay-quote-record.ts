/**
 * @fileoverview **ΤΟ ΣΤΙΓΜΙΟΤΥΠΟ ΤΙΜΗΣ ΜΙΑΣ ΚΡΑΤΗΣΗΣ** — ο ΕΝΑΣ αναγνώστης του `StayBooking.price`.
 * @related ADR-777 §8.60.21.7 · ADR-835 §23.4 · types/stay-booking.ts (`StayBookingPrice`) ·
 *   lib/stay/stay-nightly-quote.ts · lib/stay/stay-quote-fees.ts · lib/stay/stay-calendar-from-document.ts
 * @module lib/stay/stay-quote-record
 *
 * 🔴 **Ένα αποθηκευμένο ποσό διαβάζεται ΜΟΝΟ αν η αριθμητική του κλείνει**: `nightsMinor = Σ νύχτες`,
 * `amountMinor = unitMinor × units` ανά χρέωση, `totalMinor = nightsMinor + Σ χρεώσεις`. Ένα σύνολο
 * που δεν ισούται με τα μέρη του δεν είναι «σχεδόν σωστό» — είναι **δύο** απαντήσεις στο
 * *«πόσο κάνει;»*, και ο οικοδεσπότης θα έβλεπε τη μία ενώ ο επισκέπτης υποσχέθηκε την άλλη.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O.
 */

import { isDateKey } from '@/lib/calendar/date-key';
import { isMinorAmount, MONEY_CURRENCY, sumMinor } from '@/lib/money/money';
import { isRecord } from '@/lib/type-guards';
import { PET_FEE_BASES, type PetFeeBasis } from '@/types/property-offers';
import type { StayBookingPrice } from '@/types/stay-booking';

import type { StayPricedQuote, StayQuotedNight } from './stay-nightly-quote';
import { STAY_QUOTE_FEE_KINDS, type StayQuoteFee, type StayQuoteFeeKind } from './stay-quote-fees';

/** Η τιμολόγηση → το στιγμιότυπο που γράφεται στην κράτηση. Η **μία** κατασκευή. */
export function stayBookingPriceOf(quote: StayPricedQuote): StayBookingPrice {
  return { ...quote, currency: MONEY_CURRENCY };
}

function nightOf(raw: unknown): StayQuotedNight | null {
  if (!isRecord(raw) || !isDateKey(raw.date) || !isMinorAmount(raw.amountMinor)) return null;
  if (raw.source !== 'day' && raw.source !== 'base') return null;
  return { date: raw.date, amountMinor: raw.amountMinor, source: raw.source };
}

const isFeeKind = (value: unknown): value is StayQuoteFeeKind =>
  (STAY_QUOTE_FEE_KINDS as readonly unknown[]).includes(value);
const isFeeBasis = (value: unknown): value is PetFeeBasis => (PET_FEE_BASES as readonly unknown[]).includes(value);
const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

function feeOf(raw: unknown): StayQuoteFee | null {
  if (!isRecord(raw) || !isFeeKind(raw.kind) || !isFeeBasis(raw.basis)) return null;
  const { unitMinor, units, pets, amountMinor } = raw;
  if (!isMinorAmount(unitMinor) || !isCount(units) || !isCount(pets) || !isMinorAmount(amountMinor)) return null;
  if (amountMinor !== unitMinor * units) return null;
  return { kind: raw.kind, basis: raw.basis, unitMinor, units, pets, amountMinor };
}

/** Κάθε στοιχείο διαβάζεται, ή κανένα: ένας πίνακας με «τρύπα» δεν είναι μικρότερος πίνακας. */
function allOf<T>(raw: unknown, read: (item: unknown) => T | null): T[] | null {
  if (!Array.isArray(raw)) return null;
  const items = raw.map(read);
  return items.every((item): item is T => item !== null) ? items : null;
}

/**
 * **Αποθηκευμένη τιμή → στιγμιότυπο.** `undefined` = παρόν αλλά **χαλασμένο** (ο καλών αρνείται
 * όλο το έγγραφο — αυστηρό δόγμα του αναγνώστη κρατήσεων)· απόν/`null` = «δεν τιμολογήθηκε».
 */
export function stayBookingPriceFrom(raw: unknown): StayBookingPrice | null | undefined {
  if (raw === null || raw === undefined) return null;
  if (!isRecord(raw) || raw.kind !== 'priced' || raw.currency !== MONEY_CURRENCY) return undefined;
  const nights = allOf(raw.nights, nightOf);
  const fees = allOf(raw.fees, feeOf);
  const { nightsMinor, totalMinor } = raw;
  if (nights === null || nights.length === 0 || fees === null) return undefined;
  if (!isMinorAmount(nightsMinor) || !isMinorAmount(totalMinor)) return undefined;
  if (nightsMinor !== sumMinor(nights.map((n) => n.amountMinor))) return undefined;
  if (totalMinor !== nightsMinor + sumMinor(fees.map((fee) => fee.amountMinor))) return undefined;
  return { kind: 'priced', nights, nightsMinor, fees, totalMinor, currency: MONEY_CURRENCY };
}

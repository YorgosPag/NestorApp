/**
 * @fileoverview **ΠΟΣΟ ΚΟΣΤΙΖΕΙ 10–14/08;** — τιμή ανά νύχτα, σε ακέραια λεπτά.
 * @related ADR-835 §4.4 · §4.8 · §21 · lib/properties/price-resolver.ts ·
 *   lib/money/money.ts · types/stay-rules.ts
 * @module lib/stay/stay-nightly-quote
 *
 * 🔑 **Ένας επιλυτής τιμής** (§4.4): η βάση της νύχτας έρχεται **μόνο** από τον ρόλο
 * `nightly` του `price-resolver`· η υπέρβαση ημέρας (`nightlyRateMinor`) την αντικαθιστά
 * για εκείνη τη νύχτα — σημασιολογία «τιμή ανά ημέρα» της Booking.com.
 *
 * 🔴 **Νύχτα χωρίς τιμή ⇒ `unpriced` με ΠΟΙΕΣ νύχτες, ποτέ 0.** Ένα σύνολο που μετρά μια
 * άγνωστη νύχτα ως δωρεάν είναι ψέμα με νούμερο πάνω του.
 *
 * **Layering**: καθαρές συναρτήσεις, μηδέν I/O.
 */

import { addDaysToDateKey, daysBetweenDateKeys } from '@/lib/calendar/date-key';
import { minorFromMajor, sumMinor, type MinorAmount } from '@/lib/money/money';
import { resolveNightlyPrice, type PricedPropertyLike } from '@/lib/properties/price-resolver';
import type { StayDayRules } from '@/types/stay-rules';

import { dayRuleOn } from './stay-rules';

/** Η τιμή μίας νύχτας, και από πού ήρθε. */
export interface StayQuotedNight {
  /** `YYYY-MM-DD` — η νύχτα που **ξεκινά** αυτή τη μέρα. */
  readonly date: string;
  readonly amountMinor: MinorAmount;
  /** `day` = υπέρβαση ημέρας · `base` = τιμή της αγγελίας. */
  readonly source: 'day' | 'base';
}

/** Η τιμολόγηση μιας διαμονής. */
export type StayQuote =
  | {
      readonly kind: 'priced';
      readonly nights: readonly StayQuotedNight[];
      readonly totalMinor: MinorAmount;
    }
  /** Κάποιες νύχτες **δεν έχουν τιμή** — τις ονομάζουμε. */
  | { readonly kind: 'unpriced'; readonly missing: readonly string[] };

/** Άνω όριο νυχτών τιμολόγησης — ίδιο μέγεθος με μια διαμονή βραχυχρόνιας. */
const QUOTE_MAX_NIGHTS = 366;

/**
 * **Η τιμή της νύχτας `date`** — υπέρβαση ημέρας ή βάση. `null` αν καμία.
 */
export function nightlyRateOn(
  listing: PricedPropertyLike,
  days: StayDayRules,
  date: string,
): StayQuotedNight | null {
  const override = dayRuleOn(days, date).nightlyRateMinor;
  if (override !== undefined) return { date, amountMinor: override, source: 'day' };
  const base = resolveNightlyPrice(listing);
  const amountMinor = base === null ? null : minorFromMajor(base.amount);
  return amountMinor === null ? null : { date, amountMinor, source: 'base' };
}

/**
 * **Τιμολόγηση `[checkIn, checkOut)`** νύχτα-νύχτα.
 *
 * @returns `null` αν το διάστημα δεν είναι γνήσιο (ανάποδο, κενό, άκυρο, υπερβολικό).
 */
export function stayQuoteOf(
  listing: PricedPropertyLike,
  days: StayDayRules,
  checkIn: string,
  checkOut: string,
): StayQuote | null {
  const count = daysBetweenDateKeys(checkIn, checkOut);
  if (count === null || count < 1 || count > QUOTE_MAX_NIGHTS) return null;

  const nights: StayQuotedNight[] = [];
  const missing: string[] = [];
  for (let offset = 0; offset < count; offset += 1) {
    const date = addDaysToDateKey(checkIn, offset);
    if (date === null) return null;
    const night = nightlyRateOn(listing, days, date);
    if (night === null) missing.push(date);
    else nights.push(night);
  }

  if (missing.length > 0) return { kind: 'unpriced', missing };
  return { kind: 'priced', nights, totalMinor: sumMinor(nights.map((n) => n.amountMinor)) };
}

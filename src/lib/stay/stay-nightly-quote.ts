/**
 * @fileoverview **ΠΟΣΟ ΚΟΣΤΙΖΕΙ 10–14/08;** — τιμή ανά νύχτα, σε ακέραια λεπτά.
 * @related ADR-835 §4.4 · §4.8 · §21 · ADR-777 §8.60.21.7 · lib/properties/price-resolver.ts ·
 *   lib/money/money.ts · types/stay-rules.ts · lib/stay/stay-quote-fees.ts
 * @module lib/stay/stay-nightly-quote
 *
 * 🔑 **Ένας επιλυτής τιμής** (§4.4): η βάση της νύχτας έρχεται **μόνο** από τον ρόλο
 * `nightly` του `price-resolver`· η υπέρβαση ημέρας (`nightlyRateMinor`) την αντικαθιστά
 * για εκείνη τη νύχτα — σημασιολογία «τιμή ανά ημέρα» της Booking.com.
 *
 * 🔴 **Νύχτα χωρίς τιμή ⇒ `unpriced` με ΠΟΙΕΣ νύχτες, ποτέ 0.** Ένα σύνολο που μετρά μια
 * άγνωστη νύχτα ως δωρεάν είναι ψέμα με νούμερο πάνω του.
 *
 * 🔑 **Το σύνολο είναι ΟΛΟΚΛΗΡΟ** (ADR-777 §8.60.21.7): νύχτες **+** χρεώσεις (σήμερα το
 * κατοικίδιο, `stay-quote-fees.ts`). Οδηγία 2011/83/ΕΕ άρ. 6(1)(e)·6(6): πρόσθετη χρέωση που δεν
 * ειπώθηκε πριν τη δέσμευση **δεν οφείλεται** — άρα δεν υπάρχει «σύνολο χωρίς τις χρεώσεις».
 *
 * **Layering**: καθαρές συναρτήσεις, μηδέν I/O.
 */

import { addDaysToDateKey, daysBetweenDateKeys } from '@/lib/calendar/date-key';
import { minorFromMajor, sumMinor, type MinorAmount } from '@/lib/money/money';
import { resolveNightlyPrice, type PricedPropertyLike } from '@/lib/properties/price-resolver';
import type { StayPetPolicy } from '@/types/property-offers';
import type { StayDayRules } from '@/types/stay-rules';

import { dayRuleOn } from './stay-rules';
import { petFeeOf, type StayQuoteFee, type StayQuoteFeeKind } from './stay-quote-fees';

/** Η τιμή μίας νύχτας, και από πού ήρθε. */
export interface StayQuotedNight {
  /** `YYYY-MM-DD` — η νύχτα που **ξεκινά** αυτή τη μέρα. */
  readonly date: string;
  readonly amountMinor: MinorAmount;
  /** `day` = υπέρβαση ημέρας · `base` = τιμή της αγγελίας. */
  readonly source: 'day' | 'base';
}

/**
 * **Η τιμολογημένη διαμονή** — και το **στιγμιότυπο** που κρατά η κράτηση (`StayBooking.price`).
 * Αναλλοίωτο: `nightsMinor = Σ nights` · `totalMinor = nightsMinor + Σ fees` (δες `stay-quote-record.ts`).
 */
export interface StayPricedQuote {
  readonly kind: 'priced';
  readonly nights: readonly StayQuotedNight[];
  /** Το άθροισμα **μόνο** των νυχτών. */
  readonly nightsMinor: MinorAmount;
  /** Οι χρεώσεις πάνω από τις νύχτες, με την αριθμητική τους. Κενό = καμία. */
  readonly fees: readonly StayQuoteFee[];
  /** **Το σύνολο** — νύχτες + χρεώσεις. Αυτό πληρώνει ο επισκέπτης. */
  readonly totalMinor: MinorAmount;
}

/** Η τιμολόγηση μιας διαμονής. */
export type StayQuote =
  | StayPricedQuote
  /**
   * Κάτι **δεν έχει τιμή** — το ονομάζουμε: ποιες νύχτες (`missing`) και ποιες χρεώσεις
   * (`missingFees`: δηλωμένη χρέωση που δεν γίνεται λεπτά).
   */
  | {
      readonly kind: 'unpriced';
      readonly missing: readonly string[];
      readonly missingFees: readonly StayQuoteFeeKind[];
    };

/** Τι ρωτιέται: `[checkIn, checkOut)` και —προαιρετικά— πόσα κατοικίδια (ADR-777 §8.60.21). */
export interface StayQuoteRequest {
  readonly checkIn: string;
  readonly checkOut: string;
  /** Απόν / `null` / `0` = χωρίς κατοικίδιο — ίδια σημασία με το `StayQuery.pets`. */
  readonly pets?: number | null;
}

/** Η αγγελία όπως την τιμολογεί η μηχανή: τιμή + (αν είναι κατάλυμα) πολιτική κατοικιδίων. */
export type QuotedStayLike = PricedPropertyLike & {
  readonly stay?: { readonly pets?: StayPetPolicy | null } | null;
};

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

/** Οι νύχτες `[checkIn, checkOut)` με τιμή, ή οι ημερομηνίες που λείπουν. `null` = άκυρο διάστημα. */
function quotedNights(
  listing: PricedPropertyLike,
  days: StayDayRules,
  checkIn: string,
  count: number,
): { readonly nights: StayQuotedNight[]; readonly missing: string[] } | null {
  const nights: StayQuotedNight[] = [];
  const missing: string[] = [];
  for (let offset = 0; offset < count; offset += 1) {
    const date = addDaysToDateKey(checkIn, offset);
    if (date === null) return null;
    const night = nightlyRateOn(listing, days, date);
    if (night === null) missing.push(date);
    else nights.push(night);
  }
  return { nights, missing };
}

/**
 * **Τιμολόγηση `[checkIn, checkOut)`** νύχτα-νύχτα, **μαζί** με τις χρεώσεις (κατοικίδιο).
 *
 * @returns `null` αν το διάστημα δεν είναι γνήσιο (ανάποδο, κενό, άκυρο, υπερβολικό).
 */
export function stayQuoteOf(
  listing: QuotedStayLike,
  days: StayDayRules,
  request: StayQuoteRequest,
): StayQuote | null {
  const count = daysBetweenDateKeys(request.checkIn, request.checkOut);
  if (count === null || count < 1 || count > QUOTE_MAX_NIGHTS) return null;
  const quoted = quotedNights(listing, days, request.checkIn, count);
  if (quoted === null) return null;

  const pet = petFeeOf(listing.stay?.pets ?? null, request.pets, count);
  const missingFees: StayQuoteFeeKind[] = pet.kind === 'unpriced' ? ['pet'] : [];
  if (quoted.missing.length > 0 || missingFees.length > 0) {
    return { kind: 'unpriced', missing: quoted.missing, missingFees };
  }
  const fees: StayQuoteFee[] = pet.kind === 'fee' ? [pet.fee] : [];
  const nightsMinor = sumMinor(quoted.nights.map((n) => n.amountMinor));
  const totalMinor = nightsMinor + sumMinor(fees.map((fee) => fee.amountMinor));
  return { kind: 'priced', nights: quoted.nights, nightsMinor, fees, totalMinor };
}

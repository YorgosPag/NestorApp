/**
 * @fileoverview **ΟΙ ΑΝΑΓΝΩΣΕΙΣ ΤΩΝ ΣΤΑΤΙΣΤΙΚΩΝ ΓΙΑ ΤΗΝ ΟΘΟΝΗ** (ADR-777 §8.72 Φάση 2).
 * @related lib/listings/listing-stats.ts (το ΣΥΜΒΟΛΑΙΟ + η καθαρή λογική της συλλογής) ·
 *   lib/listings/price-history.ts (το ιστορικό τιμής) ·
 *   components/owner-property/OwnerPropertyStatsRow.tsx · OwnerPropertyStatsPanel.tsx
 * @module lib/listings/listing-stats-view
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΑΡΧΕΙΟ ΑΠΟ ΤΟ `listing-stats.ts`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Εκείνο το αρχείο το διαβάζουν ο **γραφέας**, το **cron** και ο **αναγνώστης** του διακομιστή.
 * Αυτό το διαβάζει **μόνο** η οθόνη: απαντά «τι λέμε στον άνθρωπο» πάνω στο έτοιμο
 * `ListingStatsSummary`. Κάθε κρίση που θα μπορούσε να γραφτεί μέσα σε component (μέσοι όροι,
 * φραγμοί δείγματος, κενά εκτός αγοράς) ζει **εδώ**, καθαρή και ελέγξιμη — ένα JSX δεν
 * μπορεί να αποφασίσει μόνο του ότι «μισή εβδομάδα είναι εβδομάδα».
 *
 * ⇒ **Layering**: leaf — τύποι και καθαρές συναρτήσεις. Κανένα ρολόι: η «σήμερα» έρχεται
 * από τον διακομιστή (`OwnerPortfolioStats.today`), ώστε κάρτα και γράφημα να μετρούν με
 * το **ίδιο** ημερολόγιο που μέτρησε ο γραφέας.
 */

import {
  LISTING_STATS_WINDOW_DAYS,
  listingTrend,
  marketDayOf,
  marketDaysBetween,
  shiftMarketDay,
  windowSum,
  type ListingStatsSummary,
  type ListingTrend,
  type ListingViewDaily,
} from '@/lib/listings/listing-stats';
import { readPriceHistory } from '@/lib/listings/price-history';
import type { PriceObservation } from '@/types/price-history';

// ============================================================================
// ΣΤΑΘΕΡΕΣ — μία θέση
// ============================================================================

/**
 * **Τα εύρη του γραφήματος** — 30 ημέρες (η κρίσιμη πρώτη περίοδος μιας αγγελίας) και 90
 * (όσο κρατά η σειρά του διακομιστή, `LISTING_STATS_SERIES_DAYS`). Το Rightmove δίνει
 * 7/14/30/60 ημέρες· το 7 το λέει ήδη η γραμμή της κάρτας.
 */
export const LISTING_STATS_RANGES = [30, 90] as const;
export type ListingStatsRange = (typeof LISTING_STATS_RANGES)[number];

/**
 * **Πόσες μετρημένες ημέρες χρειάζεται η προηγούμενη περίοδος για να συγκριθεί.**
 *
 * 🏆 Η σύγκριση γίνεται σε **μέσο όρο ανά μετρημένη ημέρα** — ο κανόνας του Rightmove
 * («average daily views, last 7 days vs the 7 days previous»), όχι σε σύνολα. Με σύνολα, μια
 * αγγελία που μετράμε 9 μέρες θα έβγαζε «↑ 250%» μόνο επειδή η προηγούμενη εβδομάδα της είχε
 * **δύο** μέρες. Με μέσο όρο η σύγκριση είναι δίκαιη — αλλά σε 1-2 ημέρες ο μέσος όρος είναι
 * θόρυβος, οπότε κάτω από αυτό το κατώφλι η τάση λέγεται «νέα μέτρηση» και **δεν** έχει ποσοστό.
 */
export const LISTING_TREND_MIN_BASELINE_DAYS = 3;

/**
 * **Κάτω από τόσες προβολές, ο δείκτης «επαφές / 1.000 προβολές» δεν λέγεται.**
 *
 * Σε 20 προβολές, **μία** επαφή = «50‰» — ένας αριθμός που μοιάζει με μέτρηση αλλά είναι
 * τύχη, και οδηγεί σε αποφάσεις (αλλαγή τιμής) πάνω σε θόρυβο. Στις 100, μία επαφή κινεί τον
 * δείκτη το πολύ 10‰. Ο δείκτης δείχνεται **πάντα** μαζί με τους απόλυτους αριθμούς
 * («3 από 412 προβολές») — ο λόγος χωρίς παρονομαστή κρύβει το μέγεθος του δείγματος.
 */
export const CONTACT_RATE_MIN_VIEWS = 100;

// ============================================================================
// Η ΤΑΣΗ ΤΗΣ ΚΑΡΤΑΣ
// ============================================================================

/** Η τάση όπως τη λέει η οθόνη — `partial` = «μετράμε λιγότερο από ό,τι χρειάζεται η σύγκριση». */
export type ComparableTrend = ListingTrend | { readonly kind: 'partial' };

/** Πόσες ημέρες του `[from, to]` είναι μετρημένες (`>= countingSince`). */
export function countedDaysIn(countingSince: string, from: string, to: string): number {
  const start = countingSince > from ? countingSince : from;
  return start > to ? 0 : marketDaysBetween(start, to).length;
}

/**
 * **Οι προβολές ενός εύρους όπως τις λέει η οθόνη** — ποτέ «0 σε 7 ημέρες» όταν μετράμε 2.
 *
 * `not-yet` = καμία μετρημένη ημέρα στο εύρος (η μέτρηση αρχίζει αργότερα): «δεν κοιτάξαμε» ≠
 * «κανείς δεν ήρθε», άρα **κανένας** αριθμός. `counted.days` = οι **μετρημένες** ημέρες, ώστε το
 * κείμενο να λέει το πραγματικό διάστημα («12 προβολές σε 3 ημέρες»).
 */
export type ViewsReading =
  | { readonly kind: 'unknown' }
  | { readonly kind: 'not-yet'; readonly countingSince: string }
  | { readonly kind: 'counted'; readonly views: number; readonly days: number };

export function viewsIn(summary: ListingStatsSummary, from: string, to: string): ViewsReading {
  const { views, countingSince } = summary;
  if (views === null) return { kind: 'unknown' };
  const days = countedDaysIn(countingSince, from, to);
  if (days === 0) return { kind: 'not-yet', countingSince };
  const start = countingSince > from ? countingSince : from;
  return { kind: 'counted', views: windowSum(views.daily, start, to), days };
}

/** Το εύρος της γραμμής της κάρτας — οι τελευταίες `LISTING_STATS_WINDOW_DAYS` ημέρες. */
export function cardViewsReading(summary: ListingStatsSummary, today: string): ViewsReading {
  return viewsIn(summary, shiftMarketDay(today, -(LISTING_STATS_WINDOW_DAYS - 1)), today);
}

/**
 * **Προβολές τελευταίων 7 ημερών έναντι των 7 πριν** — σε μέσο όρο ανά **μετρημένη** ημέρα.
 * `null` όταν οι προβολές είναι άγνωστες (βλάβη): η τάση του αγνώστου δεν είναι «σταθερή».
 */
export function comparableViewTrend(summary: ListingStatsSummary, today: string): ComparableTrend | null {
  const { views, countingSince } = summary;
  if (views === null) return null;
  const lastFrom = shiftMarketDay(today, -(LISTING_STATS_WINDOW_DAYS - 1));
  const previousTo = shiftMarketDay(lastFrom, -1);
  const previousFrom = shiftMarketDay(previousTo, -(LISTING_STATS_WINDOW_DAYS - 1));
  const lastDays = countedDaysIn(countingSince, lastFrom, today);
  const previousDays = countedDaysIn(countingSince, previousFrom, previousTo);
  if (previousDays < LISTING_TREND_MIN_BASELINE_DAYS || lastDays === 0) return { kind: 'partial' };
  return listingTrend(views.lastWindow / lastDays, views.previousWindow / previousDays);
}

// ============================================================================
// Ο ΔΕΙΚΤΗΣ «ΕΠΑΦΕΣ / 1.000 ΠΡΟΒΟΛΕΣ»
// ============================================================================

export type ContactRate =
  | { readonly kind: 'rate'; readonly perThousand: number; readonly views: number; readonly contacts: number }
  /** Λίγες προβολές ακόμη — δείχνονται οι αριθμοί, όχι ο λόγος. */
  | { readonly kind: 'insufficient'; readonly views: number; readonly contacts: number }
  /** Μία από τις δύο πηγές δεν φορτώθηκε — ο λόγος του αγνώστου είναι άγνωστος. */
  | { readonly kind: 'unknown' };

/**
 * **Ο δείκτης του idealista, στην ΙΔΙΑ περίοδο και για τα δύο μέρη του κλάσματος.**
 *
 * 🔴 Οι επαφές υπήρχαν **πριν** αρχίσει η μέτρηση προβολών. Το `contacts.total / views.total`
 * θα διαιρούσε επαφές δύο ετών με προβολές δύο εβδομάδων. Εδώ και οι δύο αθροίζονται στις
 * **μετρημένες** ημέρες του εύρους `[from, to]`.
 */
export function contactRateIn(summary: ListingStatsSummary, from: string, to: string): ContactRate {
  const { views, contacts, countingSince } = summary;
  if (views === null || contacts === null) return { kind: 'unknown' };
  const start = countingSince > from ? countingSince : from;
  const viewCount = windowSum(views.daily, start, to);
  const contactCount = windowSum(contacts.daily, start, to);
  if (viewCount < CONTACT_RATE_MIN_VIEWS) {
    return { kind: 'insufficient', views: viewCount, contacts: contactCount };
  }
  return { kind: 'rate', perThousand: (contactCount / viewCount) * 1000, views: viewCount, contacts: contactCount };
}

// ============================================================================
// ΟΙ ΓΡΑΜΜΕΣ ΤΟΥ ΓΡΑΦΗΜΑΤΟΣ
// ============================================================================

/**
 * **Μία ημέρα του γραφήματος.** `null` = **δεν ξέρουμε** (πριν αρχίσει η μέτρηση ή πηγή σε
 * βλάβη) — το recharts δεν σχεδιάζει ράβδο για `null`, ενώ θα σχεδίαζε «0» για μηδέν. Αυτή
 * είναι όλη η διαφορά ανάμεσα στο «κανείς δεν ήρθε» και στο «δεν κοιτάξαμε».
 */
export interface ListingStatsDay {
  readonly day: string;
  readonly views: number | null;
  readonly contacts: number | null;
}

function countOn(daily: ListingViewDaily | undefined, day: string, counted: boolean): number | null {
  if (daily === undefined || !counted) return null;
  return daily[day] ?? 0;
}

/**
 * Οι `range` τελευταίες ημέρες (μαζί με τη σημερινή), σε αύξουσα σειρά.
 *
 * 🔴 Το `countingSince` αφορά **μόνο τις προβολές**. Οι επαφές έρχονται από το `first_contacts`,
 * που υπήρχε πριν από τη μέτρηση προβολών, και ο διακομιστής τις στέλνει για **όλη** τη σειρά —
 * άρα είναι γνωστές κάθε ημέρα. Αν σβήνονταν κι αυτές, ο δείκτης «Επαφές: 1» πάνω από το γράφημα
 * θα διαφωνούσε με μια άδεια ζώνη από κάτω (μετρημένο σε ζωντανή σελίδα, §8.72.8).
 */
export function listingStatsDays(
  summary: ListingStatsSummary,
  today: string,
  range: ListingStatsRange,
): readonly ListingStatsDay[] {
  const from = shiftMarketDay(today, -(range - 1));
  return marketDaysBetween(from, today).map((day) => ({
    day,
    views: countOn(summary.views?.daily, day, day >= summary.countingSince),
    contacts: countOn(summary.contacts?.daily, day, true),
  }));
}

// ============================================================================
// ΤΑ ΓΕΓΟΝΟΤΑ ΤΙΜΗΣ ΠΑΝΩ ΣΤΟΝ ΑΞΟΝΑ ΤΟΥ ΧΡΟΝΟΥ
// ============================================================================

/**
 * **Τι άλλαξε στην αγγελία εκείνη την ημέρα.** 🏆 Το Rightmove σημειώνει στο γράφημα τα
 * **δικά του** γεγονότα (αναβάθμιση σε «Featured»)· εδώ σημειώνεται η απόφαση που ο κάτοχος
 * **πραγματικά** παίρνει — η τιμή — ώστε να φαίνεται η αιτία δίπλα στο αποτέλεσμα:
 * «μείωσα ⇒ ανέβηκαν οι προβολές ⇒ ήρθαν επαφές».
 */
export type ListingPriceEventKind = 'listed' | 'reduced' | 'raised' | 'withdrawn' | 'relisted';

export interface ListingPriceEvent {
  readonly day: string;
  readonly kind: ListingPriceEventKind;
  /** Η τιμή **μετά** το γεγονός (ρόλος + ποσό) — `null` όταν η αγγελία βγήκε από την αγορά. */
  readonly price: PriceObservation['price'];
  /** Η μεταβολή σε μονάδες βάσης έναντι της προηγούμενης τιμής **του ίδιου ρόλου**. */
  readonly changeBasisPoints: number | null;
}

function eventKindOf(previous: PriceObservation | undefined, next: PriceObservation): ListingPriceEventKind | null {
  if (next.price === null) return previous?.price ? 'withdrawn' : null;
  if (previous === undefined) return 'listed';
  if (previous.price === null) return 'relisted';
  // 🔴 Αλλαγή ρόλου (πώληση ⇄ ενοικίαση) δεν είναι «μείωση»: ποσά διαφορετικών ρόλων δεν συγκρίνονται.
  if (previous.price.role !== next.price.role) return 'listed';
  if (next.price.amount === previous.price.amount) return null;
  return next.price.amount < previous.price.amount ? 'reduced' : 'raised';
}

function changeOf(previous: PriceObservation | undefined, next: PriceObservation): number | null {
  const before = previous?.price;
  const after = next.price;
  if (!before || !after || before.role !== after.role || before.amount === 0) return null;
  return Math.round(((after.amount - before.amount) / before.amount) * 10_000);
}

/**
 * **Όλα τα γεγονότα τιμής του ακινήτου**, νεότερο **τελευταίο**. Διαβάζει το αποθηκευμένο
 * `priceHistory` **μόνο** μέσα από τον ΕΝΑ αναγνώστη (`readPriceHistory`) — ποτέ ωμό.
 */
export function listingPriceEvents(storedHistory: unknown): readonly ListingPriceEvent[] {
  const history = readPriceHistory(storedHistory);
  const events: ListingPriceEvent[] = [];
  history.forEach((observation, index) => {
    const previous = index > 0 ? history[index - 1] : undefined;
    const kind = eventKindOf(previous, observation);
    const atMs = Date.parse(observation.at);
    if (kind === null || !Number.isFinite(atMs)) return;
    events.push({
      day: marketDayOf(atMs),
      kind,
      price: observation.price,
      changeBasisPoints: changeOf(previous, observation),
    });
  });
  return events;
}

/** Τα γεγονότα που πέφτουν μέσα στις ημέρες του γραφήματος. */
export function priceEventsIn(
  events: readonly ListingPriceEvent[],
  days: readonly ListingStatsDay[],
): readonly ListingPriceEvent[] {
  const first = days[0]?.day;
  const last = days[days.length - 1]?.day;
  if (first === undefined || last === undefined) return [];
  return events.filter((event) => event.day >= first && event.day <= last);
}

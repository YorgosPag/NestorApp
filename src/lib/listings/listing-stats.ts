/**
 * @fileoverview **ΤΑ ΣΤΑΤΙΣΤΙΚΑ ΜΙΑΣ ΑΓΓΕΛΙΑΣ — η καθαρή λογική** (ADR-777 §8.72).
 * @related services/listings/listing-view-recorder.ts (ο ΓΡΑΦΕΑΣ) ·
 *   services/listings/listing-stats.service.ts (ο ΑΝΑΓΝΩΣΤΗΣ) · lib/listings/price-history.ts
 * @module lib/listings/listing-stats
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΙ ΕΙΝΑΙ «ΠΡΟΒΟΛΗ» — ΚΑΙ ΓΙΑΤΙ ΕΙΝΑΙ ΑΥΣΤΗΡΟΤΕΡΗ ΑΠΟ ΤΟΥ ZILLOW
 * ────────────────────────────────────────────────────────────────────────────
 *
 * **Ένας μοναδικός επισκέπτης, μία φορά ανά ημέρα, ανά αγγελία** — χωρίς τον κάτοχο και χωρίς
 * bots. Ο Zillow μετρά **κάθε** άνοιγμα, μαζί με τις επαναλήψεις του ίδιου ανθρώπου **και του
 * ίδιου του κατόχου** (Showcase: *«including repeat page views by the same unique user»*) — ένας
 * αριθμός που φουσκώνει όσο ο ιδιοκτήτης ελέγχει την αγγελία του. Εδώ ο αριθμός σημαίνει
 * **ανθρώπους που ενδιαφέρθηκαν**.
 *
 * ⚠️ **Η «ημέρα» είναι ημέρα ΑΓΟΡΑΣ, ώρα Αθήνας** — όχι UTC. Ο κάτοχος διαβάζει «χθες είχες 12
 * προβολές» με το δικό του ρολόι· ένας κάδος UTC θα έκοβε τη μέρα στις 02:00/03:00 τοπική.
 *
 * ⇒ **Layering**: leaf — μόνο τύποι και καθαρές συναρτήσεις. Καμία ανάγνωση, κανένα ρολόι
 * (ο χρόνος περνά **πάντα** ως όρισμα).
 */

import { MS_PER_DAY, utcDateOf } from '@/lib/date-local';
import type { ListedAt } from '@/types/public-listing';

// ============================================================================
// ΣΤΑΘΕΡΕΣ — ΜΙΑ ΦΟΡΑ
// ============================================================================

/** Η ζώνη της «ημέρας αγοράς». Ίδια με του cron (`CRON_TIMEZONE`) — μία μέρα, ένα ρολόι. */
export const LISTING_STATS_TIME_ZONE = 'Europe/Athens';

/**
 * Πόσα shards ανά (ακίνητο, ημέρα). Το Firestore αντέχει ~1 εγγραφή/s **διαρκώς** ανά έγγραφο·
 * 5 shards ⇒ ~5/s ανά αγγελία, πολύ πάνω από κάθε ρεαλιστική κίνηση — χωρίς να πληρώνει η ανάγνωση
 * (η σύνοψη γράφεται από το cron, οι κάρτες δεν διαβάζουν ποτέ shards παλαιότερων ημερών).
 */
export const LISTING_VIEW_SHARD_COUNT = 5;

/** Πόσες ημέρες κρατά η ψυχρή σύνοψη. Ίδιο με το `PRICE_HISTORY_RETENTION_DAYS`. */
export const LISTING_STATS_RETENTION_DAYS = 180;

/** Πόσες κλειστές ημέρες ξαναπερνά κάθε νύχτα η σύνοψη — αντέχει έως δύο χαμένες νύχτες. */
export const LISTING_STATS_ROLLUP_LOOKBACK_DAYS = 3;

/**
 * **Πότε λήγουν τα εφήμερα έγγραφα** (TTL `expiresAt`) — δίχτυ ασφαλείας, όχι ο κύριος δρόμος.
 * Ο κύριος: η σύνοψη σβήνει shards και αλάτια. Το TTL μαζεύει ό,τι έμεινε από χαμένες νύχτες.
 *
 * | Έγγραφο | Μετά από | Γιατί τόσο |
 * |---|---|---|
 * | αλάτι · σημάδι | 2 ημέρες | χρειάζονται μόνο όσο η ημέρα είναι ανοιχτή |
 * | shard | lookback + 2 | δεν επιτρέπεται να σβηστεί πριν τον συνοψίσει κάποια νύχτα |
 */
export const LISTING_VIEW_TTL_DAYS = {
  salt: 2,
  mark: 2,
  shard: LISTING_STATS_ROLLUP_LOOKBACK_DAYS + 2,
} as const;

/** Η στιγμή λήξης ενός εφήμερου εγγράφου της `day` — μεσάνυχτα UTC, `afterDays` μέρες μετά. */
export function ephemeralExpiryOf(day: string, afterDays: number): Date {
  return new Date(`${shiftMarketDay(day, afterDays)}T00:00:00.000Z`);
}

/** Το παράθυρο της κάρτας και η σύγκρισή του — «αυτή την εβδομάδα vs την προηγούμενη». */
export const LISTING_STATS_WINDOW_DAYS = 7;

/** Πόσες ημέρες σειράς φεύγουν στο σύρμα — το μεγαλύτερο εύρος του γραφήματος (30/90). */
export const LISTING_STATS_SERIES_DAYS = 90;

/**
 * 🔴 **Η ΠΡΩΤΗ ΜΕΡΑ ΠΟΥ ΜΕΤΡΑΜΕ.** Πριν από αυτήν, το «0 προβολές» θα ήταν **ψέμα**: δεν
 * είδε κανείς — **δεν κοιτάξαμε**. Η οθόνη λέει «μετράμε από …» (N.12: άγνωστο ≠ μηδέν).
 * ⚠️ Ίση με την ημέρα που η καταγραφή **ανέβηκε στην παραγωγή** (ADR-777 §8.72).
 */
export const LISTING_VIEWS_TRACKING_EPOCH = '2026-09-24';

// ============================================================================
// ΗΜΕΡΕΣ
// ============================================================================

const MARKET_DAY_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: LISTING_STATS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * **Ποια ημέρα αγοράς είναι αυτή η στιγμή** — `YYYY-MM-DD`, ώρα Αθήνας.
 * ⚠️ `en-CA` επειδή γράφει **ακριβώς** ISO σειρά· ποτέ `toLocaleDateString` χωρίς locale.
 */
export function marketDayOf(ms: number): string {
  return MARKET_DAY_FORMAT.format(new Date(ms));
}

/**
 * **Μετακίνησε ημέρα κατά `delta`** — αριθμητική πάνω στην ίδια την ημερομηνία (UTC μεσάνυχτα),
 * ώστε η αλλαγή θερινής ώρας να μη «χάνει» ή «διπλασιάζει» ποτέ μέρα.
 */
export function shiftMarketDay(day: string, delta: number): string {
  const shifted = utcDateOf(Date.parse(`${day}T00:00:00.000Z`) + delta * MS_PER_DAY);
  if (shifted === null) throw new Error(`shiftMarketDay: unparseable day "${day}"`);
  return shifted;
}

/** Οι ημέρες `[from, to]` συμπεριλαμβανομένων, σε αύξουσα σειρά. Κενό αν `from > to`. */
export function marketDaysBetween(from: string, to: string): readonly string[] {
  const days: string[] = [];
  for (let day = from; day <= to; day = shiftMarketDay(day, 1)) days.push(day);
  return days;
}

/**
 * **Μέρες στην αγορά** — συμπληρωμένες ημέρες από τη σφραγίδα `listedAt` (§8.61).
 * `null` όταν η σφραγίδα λείπει ή είναι `unknown`: **ποτέ** 0 που θα έλεγε «μόλις μπήκε».
 */
export function daysOnMarket(listedAt: ListedAt | undefined, nowMs: number): number | null {
  if (listedAt?.kind !== 'known') return null;
  const since = Date.parse(listedAt.at);
  if (!Number.isFinite(since)) return null;
  return Math.max(0, Math.floor((nowMs - since) / MS_PER_DAY));
}

// ============================================================================
// ΣΕΙΡΕΣ ΚΑΙ ΠΑΡΑΘΥΡΑ
// ============================================================================

/** Προβολές ανά ημέρα αγοράς — `{ 'YYYY-MM-DD': n }`. Απούσα μέρα = 0 **μόνο** μετά το `countingSince`. */
export type ListingViewDaily = Readonly<Record<string, number>>;

/** Άθροισμα των ημερών `[from, to]`. */
export function windowSum(daily: ListingViewDaily, from: string, to: string): number {
  let sum = 0;
  for (const [day, views] of Object.entries(daily)) {
    if (day >= from && day <= to) sum += views;
  }
  return sum;
}

/** Κράτα μόνο ημέρες `>= oldest` — η περικοπή της σύνοψης. */
export function trimDaily(daily: ListingViewDaily, oldest: string): ListingViewDaily {
  return Object.fromEntries(Object.entries(daily).filter(([day]) => day >= oldest));
}

/** Συγχώνευσε δύο σειρές — ίδια μέρα ⇒ άθροισμα (σύνοψη + ζωντανή σημερινή). */
export function mergeDaily(a: ListingViewDaily, b: ListingViewDaily): ListingViewDaily {
  const merged: Record<string, number> = { ...a };
  for (const [day, views] of Object.entries(b)) merged[day] = (merged[day] ?? 0) + views;
  return merged;
}

/**
 * **Από πότε μετράμε ΑΥΤΗ την αγγελία** — η μεταγενέστερη από την εποχή καταγραφής και την
 * ημέρα που μπήκε στην αγορά. Ένα ακίνητο που δημοσιεύτηκε χθες δεν «είχε 0 τον Ιούνιο».
 */
export function countingSinceOf(listedAt: ListedAt | undefined): string {
  if (listedAt?.kind !== 'known') return LISTING_VIEWS_TRACKING_EPOCH;
  const listedDay = marketDayOf(Date.parse(listedAt.at));
  return listedDay > LISTING_VIEWS_TRACKING_EPOCH ? listedDay : LISTING_VIEWS_TRACKING_EPOCH;
}

// ============================================================================
// ΑΝΑΓΝΩΣΕΙΣ ΓΙΑ ΤΟΝ ΑΝΘΡΩΠΟ
// ============================================================================

/** Κάτω από αυτό το σχετικό ποσοστό η τάση λέγεται «σταθερή» — ±1 προβολή δεν είναι είδηση. */
const TREND_FLAT_RATIO = 0.1;

export type ListingTrend =
  | { readonly kind: 'up' | 'down' | 'flat'; readonly ratio: number }
  /** Καμία προβολή την προηγούμενη περίοδο — ποσοστό από το μηδέν δεν ορίζεται. */
  | { readonly kind: 'new' }
  /** Καμία προβολή και στις δύο — τίποτα να συγκριθεί. */
  | { readonly kind: 'none' };

/** Η τάση `current` έναντι `previous` — πρότυπο Rightmove «σε σχέση με την προηγούμενη περίοδο». */
export function listingTrend(current: number, previous: number): ListingTrend {
  if (previous === 0) return current === 0 ? { kind: 'none' } : { kind: 'new' };
  const ratio = (current - previous) / previous;
  if (Math.abs(ratio) < TREND_FLAT_RATIO) return { kind: 'flat', ratio };
  return { kind: ratio > 0 ? 'up' : 'down', ratio };
}

/**
 * **Επαφές ανά 1.000 προβολές** — ο δείκτης του idealista («leads/1000 visitas»).
 * `null` χωρίς προβολές: η διαίρεση με το μηδέν δεν είναι «0%», είναι «δεν ορίζεται».
 */
export function contactsPerThousandViews(views: number, contacts: number): number | null {
  return views > 0 ? (contacts / views) * 1000 : null;
}

// ============================================================================
// ΤΟ ΣΥΜΒΟΛΑΙΟ ΤΟΥ ΣΥΡΜΑΤΟΣ
// ============================================================================

/** Η διαδρομή του beacon — ένα σημείο για route και πελάτη. */
export function listingViewPath(listingId: string): string {
  return `/api/public-listings/${encodeURIComponent(listingId)}/view`;
}

/** Η διαδρομή των στατιστικών του χαρτοφυλακίου. */
export const OWNER_PORTFOLIO_STATS_PATH = '/api/owner-properties/stats';

/** Οι επαφές ενός ακινήτου — από το `first_contacts`, **ποτέ** δεύτερος μετρητής. */
export interface ListingContactCounts {
  readonly total: number;
  readonly lastWindow: number;
  /** Επαφές ανά ημέρα αγοράς — για το γράφημα της λεπτομέρειας. */
  readonly daily: ListingViewDaily;
}

/** Ό,τι μαθαίνει ο κάτοχος για **ένα** ακίνητο. */
export interface ListingStatsSummary {
  readonly propertyId: string;
  readonly countingSince: string;
  readonly views: {
    readonly lastWindow: number;
    readonly previousWindow: number;
    readonly total: number;
    readonly daily: ListingViewDaily;
  } | null;
  /** `null` = **δεν μπορέσαμε να ρωτήσουμε** (βλάβη) — ποτέ «0 επαφές». */
  readonly contacts: ListingContactCounts | null;
}

/** Η απάντηση της διαδρομής χαρτοφυλακίου — κλειδί το ακίνητο. */
export interface OwnerPortfolioStats {
  readonly today: string;
  readonly byProperty: Readonly<Record<string, ListingStatsSummary>>;
}

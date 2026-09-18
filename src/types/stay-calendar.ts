/**
 * @fileoverview **ΤΟ ΗΜΕΡΟΛΟΓΙΟ ΤΟΥ ΚΑΤΑΛΥΜΑΤΟΣ** — κεφαλή, κλεισμένες μέρες, και η
 *   ΜΙΑ μετάφραση όλων προς τον κριτή κατάληψης.
 * @related ADR-835 §20 (Στάδιο Α) · §6.2 · types/stay-booking.ts ·
 *   lib/occupancy/occupancy-conflict.ts · lib/stay/stay-conflict.ts
 * @module types/stay-calendar
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΡΙΑ ΕΓΓΡΑΦΑ, ΜΙΑ ΑΠΑΝΤΗΣΗ (§6.2)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Έγγραφο | Συλλογή | Τι λέει |
 * |---|---|---|
 * | {@link StayCalendarHead} | `stay_calendars/{propertyId}` | «δηλώθηκε ημερολόγιο;» + σειριοποίηση εγγραφών |
 * | {@link StayBlock} | `stay_blocks/{sblk_*}` | «αυτές οι νύχτες είναι κλειστές» — χωρίς επισκέπτη |
 * | `StayBooking` | `stay_bookings/{stay_*}` | «αυτές οι νύχτες είναι κάποιου» |
 *
 * Και τα δύο τελευταία γίνονται {@link StayCalendarEntry} **πριν** φτάσουν στον κριτή,
 * άρα ο κριτής **δεν ξέρει** τι είναι το καθένα — και δεν πρέπει.
 *
 * ⚠️ **Γιατί block ΚΑΙ κράτηση, όχι ένα έγγραφο με `kind`**: διαφορετικοί αναγνώστες.
 * Η κράτηση κουβαλά **άνθρωπο** (GDPR, Στάδιο Ε: ο διαχειριστής με `calendar` βλέπει
 * blocks, όχι απαραίτητα επισκέπτες). Ένα έγγραφο με προαιρετικά πεδία επισκέπτη θα
 * έκανε κάθε κανόνα ανάγνωσης ερώτηση **πεδίου**, που η Firestore δεν μπορεί να κάνει.
 *
 * **Layering**: leaf — καθαροί τύποι + καθαρές συναρτήσεις, μηδέν I/O, μηδέν ρολόι.
 */

import type { Occupancy } from '@/lib/occupancy/occupancy-conflict';
import type { StayRules } from '@/types/stay-rules';
import {
  STAY_LIFECYCLE_OCCUPIES,
  stayBookingOccupiesAt,
  stayHolderId,
  stayResourcesOf,
  type StayBooking,
  type StaySpaceRef,
} from '@/types/stay-booking';

// =============================================================================
// 1. Η ΚΕΦΑΛΗ
// =============================================================================

/** Η ζώνη ώρας που ορίζει τι σημαίνει «σήμερα» για το κατάλυμα. Μία, σήμερα. */
export const STAY_CALENDAR_TIMEZONE = 'Europe/Athens';

/**
 * **Η κεφαλή του ημερολογίου** — ένα έγγραφο ανά ακίνητο, id = `propertyId`.
 *
 * 🔴 **ΤΟ `version` ΔΕΝ ΕΙΝΑΙ ΔΙΑΚΟΣΜΗΤΙΚΟ — ΕΙΝΑΙ Η ΑΜΥΝΑ ΚΑΤΑ ΤΟΥ OVERBOOKING.**
 * Η Firestore κλειδώνει τα **έγγραφα** που διάβασε μια συναλλαγή, **όχι το εύρος** του
 * ερωτήματος: δύο παράλληλες συναλλαγές που διαβάζουν «καμία κράτηση 10–14/10» και
 * γράφουν η καθεμιά **νέο** έγγραφο δεν συγκρούονται ποτέ (phantom insert). Κάθε
 * εγγραφή στο ημερολόγιο **διαβάζει και αυξάνει** αυτό το πεδίο μέσα στη συναλλαγή της,
 * άρα η δεύτερη ξαναπαίζεται **πάνω στα φρέσκα** δεδομένα και ο κριτής τη σταματά.
 *
 * ⚠️ **`declaredAt: null` ⇒ `undeclared`, ΟΧΙ «ελεύθερο».** Ο οικοδεσπότης που δεν
 * άνοιξε ποτέ το ημερολόγιο δεν είπε «όλα ελεύθερα» — δεν είπε τίποτα. Ίδια διάκριση με
 * το `StayCalendar` (`lib/stay/stay-availability-vocabulary.ts`).
 */
export interface StayCalendarHead {
  readonly propertyId: string;
  /** Για τον κανόνα ανάγνωσης — δες `StayBooking.authorUserId`. */
  readonly authorUserId: string;
  /** ISO — πότε ο οικοδεσπότης **δήλωσε** ότι το ημερολόγιο είναι ενημερωμένο. */
  readonly declaredAt: string | null;
  /**
   * Οι κανόνες βάσης (Στάδιο Β, ADR-835 §21). Κεφαλή γραμμένη **πριν** το Στάδιο Β δεν έχει
   * το πεδίο και διαβάζεται ρητά ως `STAY_RULES_NONE` — όχι ως χαλασμένη.
   */
  readonly rules: StayRules;
  readonly version: number;
  readonly timezone: typeof STAY_CALENDAR_TIMEZONE;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// =============================================================================
// 2. ΟΙ ΚΛΕΙΣΜΕΝΕΣ ΜΕΡΕΣ
// =============================================================================

/**
 * **Ποιος έκλεισε τις νύχτες.**
 *
 * - `owner`: ο οικοδεσπότης, με το χέρι (δική του χρήση, συντήρηση, «δεν θέλω»)
 * - `external`: εισαγωγή από άλλο κανάλι (iCal, Στάδιο Γ) — **ο οικοδεσπότης δεν το ανοίγει
 *   από εδώ**: το ανοίγει η πηγή του, αλλιώς το επόμενο poll θα το ξανάκλεινε
 */
export const STAY_BLOCK_SOURCES = ['owner', 'external'] as const;

export type StayBlockSource = (typeof STAY_BLOCK_SOURCES)[number];

/** `true` αν το `value` είναι γνωστή πηγή κλεισίματος. */
export function isStayBlockSource(value: unknown): value is StayBlockSource {
  return (
    typeof value === 'string' &&
    (STAY_BLOCK_SOURCES as readonly string[]).includes(value)
  );
}

/**
 * **Η προέλευση ενός εξωτερικού block** (ADR-835 §22, Στάδιο Γ) — ποια πηγή το έφερε και
 * με ποια ταυτότητα το ονομάζει **εκείνη**.
 *
 * 🔑 **Το `externalUid` δεν είναι διακοσμητικό**: είναι η ταυτότητα του γεγονότος **στο
 * feed**, και το μόνο που επιτρέπει «το ίδιο γεγονός ξανά ⇒ το ίδιο έγγραφο». ⚠️ Δεν
 * είναι πάντα σταθερό: η **Booking.com δίνει νέο `UID` κάθε μέρα** για την ίδια κράτηση
 * (μετρημένο) — γι' αυτό η ταύτιση έχει **δεύτερο** δρόμο (`stay-channel-reconcile.ts`).
 */
export interface StayBlockChannelRef {
  readonly feedId: string;
  readonly externalUid: string;
}

/**
 * **Κλεισμένες νύχτες.** Enterprise id `sblk_*` (N.6). Ημι-ανοιχτό `[from, to)`, όπως
 * η κράτηση: το `to` είναι η πρώτη **ανοιχτή** μέρα.
 *
 * 🔑 **Ποτέ επισκέπτης εδώ.** Το `note` είναι σημείωση του οικοδεσπότη προς τον εαυτό
 * του («ανακαίνιση μπάνιου») και δεν φεύγει ποτέ από το ιδιωτικό του ημερολόγιο.
 *
 * 🔴 **`source === 'external'` ⇔ `channel !== null`** — δεν είναι σύμβαση σε σχόλιο: το
 * σύνορο ανάγνωσης (`stay-calendar-from-document.ts`) **αρνείται** το έγγραφο που τα
 * διαφωνεί. Ένα εξωτερικό block χωρίς πηγή δεν θα μπορούσε ποτέ να σβηστεί όταν το
 * γεγονός φύγει από το feed — θα έκλεινε νύχτες **για πάντα**, χωρίς ιδιοκτήτη.
 */
export interface StayBlock {
  readonly id: string;
  /** Πεδίο-ευρετήριο — ο κριτής διαβάζει **μόνο** το {@link StayBlock.covers}. */
  readonly propertyId: string;
  readonly authorUserId: string;
  readonly covers: readonly StaySpaceRef[];
  /** ISO `YYYY-MM-DD` — πρώτη κλειστή νύχτα. */
  readonly from: string;
  /** ISO `YYYY-MM-DD` — πρώτη **ανοιχτή** μέρα. */
  readonly to: string;
  readonly source: StayBlockSource;
  /** Η πηγή του, όταν είναι εξωτερικό (Στάδιο Γ) — `null` για block του ιδιοκτήτη. */
  readonly channel: StayBlockChannelRef | null;
  readonly note: string | null;
  /** uid του ανθρώπου που έκλεισε — ή του λογαριασμού που συνέδεσε την πηγή. */
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// =============================================================================
// 3. Η ΕΓΓΡΑΦΗ ΗΜΕΡΟΛΟΓΙΟΥ — ό,τι βλέπει ο κριτής
// =============================================================================

/**
 * **Ό,τι πιάνει νύχτες**, ως διακριτή ένωση — η πηγή της κάθε `Occupancy`.
 *
 * 🔑 Η ένωση ταξιδεύει μέσα στη σύγκρουση (`OccupancyConflict.with.source`), άρα η
 * απάντηση *«συγκρούεται με τι;»* φτάνει στην οθόνη **με όνομα** — «με κράτηση 14–18/10»
 * ή «με κλεισμένες μέρες» — χωρίς δεύτερη ανάγνωση.
 */
export type StayCalendarEntry =
  | { readonly kind: 'booking'; readonly booking: StayBooking }
  | { readonly kind: 'block'; readonly block: StayBlock };

/**
 * **Πιάνει νύχτες αυτή η εγγραφή τη στιγμή `instant`;** Το block **πάντα** (υπάρχει ⇒ κλείνει)·
 * η κράτηση κατά {@link stayBookingOccupiesAt} — η **μία** πηγή της απάντησης, ποτέ δεύτερη λίστα.
 *
 * 🔑 Η στιγμή είναι **υποχρεωτική** (Στάδιο Δ, §23.2): ένα αίτημα καταλαμβάνει **όσο ζει** η
 * προθεσμία του. Προαιρετική στιγμή θα σήμαινε σιωπηλή προεπιλογή — και κάθε προεπιλογή εδώ είναι
 * λάθος για κάποιον (ή διπλοκράτηση, ή μέρες κλειστές για πάντα).
 */
export function stayEntryOccupies(entry: StayCalendarEntry, instant: string): boolean {
  return entry.kind === 'block' || stayBookingOccupiesAt(entry.booking, instant);
}

/**
 * **Είναι αυτή η εγγραφή ζωντανό αίτημα σε αναμονή;** — η διάκριση που κάνει τον επισκέπτη να βλέπει
 * *«σε αναμονή ως 14:00»* αντί για σκέτο «κλειστό» (§23.5). Επιστρέφει την προθεσμία, ή `null`.
 */
export function stayEntryHeldUntil(entry: StayCalendarEntry, instant: string): string | null {
  if (entry.kind !== 'booking') return null;
  const { booking } = entry;
  if (STAY_LIFECYCLE_OCCUPIES[booking.lifecycle] !== 'while-hold-lives') return null;
  return stayBookingOccupiesAt(booking, instant) && booking.hold !== null ? booking.hold.expiresAt : null;
}

/**
 * **Η εγγραφή ως κατάληψη** — η **μόνη** μετάφραση προς τον κριτή.
 *
 * 🔴 `mode: 'exclusive'`, πάντα, και για το block: κλειστή νύχτα δεν «μοιράζεται» με
 * κράτηση. Ο κάτοχος του block είναι **το ίδιο το block** (`block:<id>`): ο
 * οικοδεσπότης που κλείνει δύο φορές τις ίδιες νύχτες **συγκρούεται** με τον εαυτό του,
 * γιατί διαφορετικά το «άνοιγμα» του ενός θα άνοιγε νύχτες που κρατά το άλλο.
 */
export function stayEntryOccupancyOf(
  entry: StayCalendarEntry,
): Occupancy<StayCalendarEntry> {
  if (entry.kind === 'booking') {
    const { booking } = entry;
    return {
      occupancyId: booking.id,
      holderId: stayHolderId(booking),
      mode: 'exclusive',
      resources: stayResourcesOf(booking.covers),
      startsAt: booking.checkIn,
      expiresAt: booking.checkOut,
      source: entry,
    };
  }
  const { block } = entry;
  return {
    occupancyId: block.id,
    holderId: `block:${block.id}`,
    mode: 'exclusive',
    resources: stayResourcesOf(block.covers),
    startsAt: block.from,
    expiresAt: block.to,
    source: entry,
  };
}

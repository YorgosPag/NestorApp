/**
 * @fileoverview **ΤΑ ΚΑΝΑΛΙΑ ΕΝΟΣ ΚΑΤΑΛΥΜΑΤΟΣ** — οι πηγές iCal, η κατάστασή τους, και η
 *   γενιά του μυστικού συνδέσμου εξαγωγής.
 * @related ADR-835 §22 (Στάδιο Γ) · §6.4 · types/stay-calendar.ts ·
 *   lib/stay/stay-channel-health.ts · lib/ical/ical-read.ts
 * @module types/stay-channels
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΕΝΑ ΕΓΓΡΑΦΟ ΑΝΑ ΑΚΙΝΗΤΟ (`stay_channels/{propertyId}`), ΜΟΝΟ ΔΙΑΚΟΜΙΣΤΗΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * 🔴 **Το URL ενός feed ΕΙΝΑΙ διαπιστευτήριο**: ο σύνδεσμος `.ics` της Airbnb δίνει σε
 * όποιον τον έχει **ολόκληρο** το ημερολόγιο του οικοδεσπότη εκεί. Γι' αυτό η συλλογή
 * είναι **αδιάβαστη από τον πελάτη** (`firestore.rules`) και η προβολή προς την οθόνη
 * κρύβει το URL (δες `StayChannelFeedView`) — ίδιο ιδίωμα με το `StayCalendarView`:
 * *προβολή, ποτέ το έγγραφο*.
 *
 * ⚠️ **Τα feeds ζουν ως ΠΙΝΑΚΑΣ μέσα σε ΕΝΑ έγγραφο**, όχι ως συλλογή. Λόγος: κάθε
 * εισαγωγή γράφει **μαζί** blocks + κατάσταση feed + `version` της κεφαλής μέσα στην
 * **ίδια** συναλλαγή, και ένα έγγραφο ανά ακίνητο κάνει αυτή τη συναλλαγή **μία
 * ανάγνωση**. Το πλήθος είναι φραγμένο ({@link STAY_CHANNEL_MAX_FEEDS}) — η Vrbo δέχεται
 * 5, εμείς 10.
 *
 * **Layering**: leaf — τύποι + φρουροί σχήματος, μηδέν I/O, μηδέν ρολόι.
 */

import type { IcalReadFailure } from '@/lib/ical/ical-read';

// =============================================================================
// 1. ΤΟ ΚΑΝΑΛΙ — ΟΝΟΜΑ, ΟΧΙ ΕΛΕΥΘΕΡΟ ΚΕΙΜΕΝΟ
// =============================================================================

/**
 * **Ποιο κανάλι είναι η πηγή.** Αναγνωρίζεται από το host του URL, ποτέ από τον χρήστη:
 * η ετικέτα που γράφει ο άνθρωπος είναι για τα μάτια του, η **συμπεριφορά** κρίνεται από
 * το κανάλι (π.χ. η Booking.com **δεν δέχεται** τον σύνδεσμό μας, §22).
 */
export const STAY_CHANNEL_KINDS = ['airbnb', 'booking', 'vrbo', 'other'] as const;

export type StayChannelKind = (typeof STAY_CHANNEL_KINDS)[number];

export function isStayChannelKind(value: unknown): value is StayChannelKind {
  return typeof value === 'string' && (STAY_CHANNEL_KINDS as readonly string[]).includes(value);
}

/**
 * **Δέχεται αυτό το κανάλι ΤΟΝ ΔΙΚΟ ΜΑΣ σύνδεσμο;** — `Record`, ώστε πέμπτο κανάλι να
 * **μη μεταγλωττίζεται** μέχρι κάποιος να απαντήσει.
 *
 * 🔴 **Η Booking.com απαντά `false`** (από 03/2025 κρίνει το **origin** του URL και
 * δέχεται μόνο OTA). Η οθόνη το **λέει** αντί να αφήσει τον οικοδεσπότη να νομίζει ότι
 * συγχρόνισε — «σιωπηλή επιτυχία που δεν έγινε» είναι το χειρότερο είδος ψέματος εδώ.
 */
export const STAY_CHANNEL_ACCEPTS_IMPORT: Readonly<Record<StayChannelKind, boolean>> = {
  airbnb: true,
  booking: false,
  vrbo: true,
  other: true,
};

// =============================================================================
// 2. ΓΙΑΤΙ ΔΕΝ ΔΙΑΒΑΣΤΗΚΕ — ΔΙΚΤΥΟ ΚΑΙ ΠΕΡΙΕΧΟΜΕΝΟ ΜΑΖΙ
// =============================================================================

/**
 * **Οι αποτυχίες του δικτύου**, σε λεξιλόγιο του τομέα (ο φρουρός SSRF μιλά τη δική του
 * γλώσσα· εδώ ενώνεται με τις αποτυχίες του αναγνώστη iCal).
 */
export const STAY_CHANNEL_FETCH_FAILURES = [
  /** Το URL δεν είναι `https`, έχει διαπιστευτήρια, ή δείχνει σε **ιδιωτική** διεύθυνση. */
  'url-refused',
  'dns-failed',
  'timeout',
  'too-large',
  /** 401/403 — ο σύνδεσμος ανακλήθηκε από το κανάλι. */
  'unauthorized',
  /** 404/410 — ο σύνδεσμος δεν υπάρχει πια. */
  'not-found',
  /** 5xx και κάθε άλλος κωδικός. */
  'channel-error',
] as const;

export type StayChannelFetchFailure = (typeof STAY_CHANNEL_FETCH_FAILURES)[number];

/** Η **μία** ένωση: δικτυακή αποτυχία **ή** αποτυχία ανάγνωσης iCal. */
export type StayChannelFailure = StayChannelFetchFailure | IcalReadFailure;

/**
 * Οι αποτυχίες ανάγνωσης iCal **ως τιμές** — ο τύπος ζει στο `lib/ical` (γενικός), η
 * λίστα εδώ (τομέας). ⚠️ `satisfies` ώστε **νέα** αποτυχία του αναγνώστη να μη
 * μεταγλωττίζεται μέχρι να αποκτήσει γραμμή εδώ **και** πρόταση στην οθόνη.
 */
const ICAL_FAILURES = [
  'not-a-calendar',
  'truncated',
  'event-without-uid',
  'event-without-start',
  'unreadable-date',
  'recurrence-unsupported',
  'too-many-events',
] as const satisfies readonly IcalReadFailure[];

export const STAY_CHANNEL_FAILURES: readonly StayChannelFailure[] = [
  ...STAY_CHANNEL_FETCH_FAILURES,
  ...ICAL_FAILURES,
];

export function isStayChannelFailure(value: unknown): value is StayChannelFailure {
  return typeof value === 'string' && (STAY_CHANNEL_FAILURES as readonly string[]).includes(value);
}

/**
 * 🔴 **Ο ΦΡΟΥΡΟΣ ΤΗΣ ΠΛΗΡΟΤΗΤΑΣ.** Αν ο αναγνώστης iCal αποκτήσει **νέα** αποτυχία και
 * κανείς δεν τη γράψει παραπάνω, ο τύπος γίνεται `never` και **αυτή η γραμμή δεν
 * μεταγλωττίζεται** — αντί να παραμείνει σιωπηλά «άγνωστη αιτία» στην οθόνη του
 * οικοδεσπότη. Ίδιος μηχανισμός με το `Record<>` πάνω σε κλειστά σύνολα.
 */
export const STAY_CHANNEL_FAILURES_COMPLETE: Exclude<
  IcalReadFailure,
  (typeof ICAL_FAILURES)[number]
> extends never
  ? true
  : never = true;

/** Η στιγμή και ο λόγος της τελευταίας αποτυχίας — με τον κωδικό HTTP όταν υπήρξε. */
export interface StayChannelFailureRecord {
  readonly at: string;
  readonly failure: StayChannelFailure;
  readonly httpStatus: number | null;
}

// =============================================================================
// 3. Η ΚΑΤΑΣΤΑΣΗ ΜΙΑΣ ΠΗΓΗΣ
// =============================================================================

/**
 * **Τι ξέρουμε για μια πηγή.** Ίδιο σχήμα με το `CronJobState` (`lib/cron/cron-lease.ts`)
 * — επίτηδες: η ερώτηση *«πότε πέτυχε τελευταία και τι έσπασε;»* είναι η ίδια.
 *
 * 🔑 Το `etag`/`lastModified` κρατιούνται για **conditional GET**: τα κανάλια
 * δημοσκοπούνται κάθε 30′ και ένα `304` είναι **επιτυχία χωρίς σώμα**.
 */
export interface StayChannelFeedStatus {
  readonly lastAttemptAt: string | null;
  readonly lastSuccessAt: string | null;
  readonly lastFailure: StayChannelFailureRecord | null;
  readonly consecutiveFailures: number;
  /** Πόσα γεγονότα είχε η τελευταία **επιτυχής** ανάγνωση. */
  readonly eventCount: number;
  readonly etag: string | null;
  readonly lastModified: string | null;
  /** Πότε είναι η επόμενη δημοσκόπηση — το κριτήριο του cron. */
  readonly nextPollAt: string;
}

export const STAY_CHANNEL_STATUS_NEW: StayChannelFeedStatus = {
  lastAttemptAt: null,
  lastSuccessAt: null,
  lastFailure: null,
  consecutiveFailures: 0,
  eventCount: 0,
  etag: null,
  lastModified: null,
  nextPollAt: '1970-01-01T00:00:00.000Z',
};

/**
 * **Μια πηγή εισαγωγής.**
 *
 * 🏆 `pendingRemovals`: block που **έλειψε** από μια επιτυχή ανάγνωση δεν σβήνεται
 * αμέσως — καταγράφεται εδώ και σβήνεται στην **επόμενη** επιτυχή ανάγνωση που
 * εξακολουθεί να το μη-βλέπει. Το «άνοιγμα» νύχτας είναι η **μόνη** μη αναστρέψιμη
 * κατεύθυνση, και τα feeds μετρημένα στέλνουν κολοβά ή κενά σώματα.
 */
export interface StayChannelFeed {
  readonly id: string;
  /** Ό,τι έγραψε ο άνθρωπος («Airbnb — σαλόνι»). Ποτέ κριτής συμπεριφοράς. */
  readonly label: string;
  /** 🔴 **Μυστικό.** Δεν φεύγει ποτέ προς τον πελάτη. */
  readonly url: string;
  readonly channel: StayChannelKind;
  readonly status: StayChannelFeedStatus;
  /** `blockId` → ISO στιγμή που πρώτη φορά έλειψε. */
  readonly pendingRemovals: Readonly<Record<string, string>>;
  readonly createdAt: string;
  readonly createdBy: string;
}

/** **Τα κανάλια ενός ακινήτου** — ένα έγγραφο, id = `propertyId`. */
export interface StayChannels {
  readonly propertyId: string;
  /** Για τον κανόνα ανάγνωσης — ίδιος άξονας με την κεφαλή. */
  readonly authorUserId: string;
  /**
   * 🔑 **Η ανάκληση του συνδέσμου εξαγωγής.** Η γενιά είναι **μέσα στην υπογραφή** του
   * token: `+1` και **όλοι** οι παλιοί σύνδεσμοι πεθαίνουν, χωρίς μητρώο, χωρίς ερώτημα.
   */
  readonly exportGeneration: number;
  readonly feeds: readonly StayChannelFeed[];
  /** Το **ελάχιστο** `nextPollAt` των feeds — το πεδίο που ερωτά το cron. */
  readonly nextPollAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Ακίνητο χωρίς έγγραφο καναλιών — **ρητά** «κανένα κανάλι», ποτέ «άγνωστο». */
export const STAY_CHANNELS_NONE = {
  exportGeneration: 0,
  feeds: [] as readonly StayChannelFeed[],
} as const;

// =============================================================================
// 4. ΤΑ ΟΡΙΑ — ΟΛΑ ΜΕ ΜΕΤΡΗΜΕΝΟ ΛΟΓΟ
// =============================================================================

/** Πόσες πηγές ανά κατάλυμα. Η Vrbo δέχεται 5· 10 φτάνει για κανάλια + ιστότοπο. */
export const STAY_CHANNEL_MAX_FEEDS = 10;
/** Βασικό διάστημα δημοσκόπησης, σε λεπτά. Η Airbnb δημοσκοπεί ανά ~3h — είμαστε 6× πιο γρήγοροι. */
export const STAY_CHANNEL_POLL_MINUTES = 30;
/** Υποχώρηση στις συνεχείς αποτυχίες: 30′ → 1h → 2h → 3h (πλαφόν). */
export const STAY_CHANNEL_BACKOFF_MINUTES: readonly number[] = [30, 60, 120, 180];
/** Πάνω από αυτό, η τελευταία επιτυχία δεν είναι «φρέσκια» — αλλά ακόμη αξιόπιστη. */
export const STAY_CHANNEL_FRESH_MINUTES = 60;
/** 🔴 Το όριο **της Airbnb** (~3h): πέρα από αυτό ΔΕΝ υποσχόμαστε διαθεσιμότητα. */
export const STAY_CHANNEL_TRUST_MINUTES = 180;
/** Το όριο **της Guesty** (24h): η σύνδεση θεωρείται «παγωμένη» και ζητά ανθρώπινη πράξη. */
export const STAY_CHANNEL_PAUSE_MINUTES = 1_440;
/** …ή τόσες συνεχείς αποτυχίες (12 × 30′ ≈ 6h σφάλματος χωρίς καμία επιτυχία). */
export const STAY_CHANNEL_PAUSE_FAILURES = 12;
/** Ανώτατο σώμα feed. Το «ημερολόγιο» των 20 MB είναι επίθεση, όχι ημερολόγιο. */
export const STAY_CHANNEL_MAX_BYTES = 2 * 1024 * 1024;
/** Χρόνος αναμονής ανά ανάγνωση. Τα OTA feeds είναι αργά — 5s θα έκοβε νόμιμες. */
export const STAY_CHANNEL_TIMEOUT_MS = 15_000;
/** Χειροκίνητος «συγχρονισμός τώρα»: όχι πιο συχνά από αυτό (η Airbnb επίσης ρυθμίζει). */
export const STAY_CHANNEL_MANUAL_SYNC_MINUTES = 2;

// =============================================================================
// 5. Η ΦΡΕΣΚΑΔΑ — ΒΑΘΜΙΔΕΣ ΜΕ ΟΝΟΜΑ, ΟΧΙ `boolean`
// =============================================================================

/**
 * **Πόσο εμπιστευόμαστε αυτήν την πηγή τώρα.**
 *
 * 🔴 **Γιατί βαθμίδες και όχι «συγχρονισμένο / χαλασμένο»**: η αγορά δίνει **δύο**
 * μετρημένα όρια (Airbnb ~3h δημοσκόπηση, Guesty 24h πριν «Paused»), και τα δύο
 * σημαίνουν **άλλη** πράξη. Ίδιο ιδίωμα με το §17.4 του ADR-835: *το όνομα αντί για
 * `boolean`*.
 *
 * | Βαθμίδα | Επισκέπτης | Ιδιοκτήτης |
 * |---|---|---|
 * | `fresh` | κανονικά | «συγχρονίστηκε πριν X′» |
 * | `lagging` | κανονικά — **δεν είμαστε χειρότεροι από την Airbnb** | προειδοποίηση |
 * | `stale` | οι **ελεύθερες** νύχτες γίνονται «δεν επιβεβαιώνεται» | σφάλμα + διέξοδος |
 * | `paused` | ίδιο | «επανασύνδεσε» |
 *
 * 🏆 Στο `paused` **δεν σβήνουμε** τα γνωστά blocks (η Guesty σταματά την εισαγωγή):
 * μηδέν σιωπηλό άνοιγμα νύχτας.
 */
export const STAY_CHANNEL_FRESHNESS = ['fresh', 'lagging', 'stale', 'paused'] as const;

export type StayChannelFreshness = (typeof STAY_CHANNEL_FRESHNESS)[number];

/**
 * **Υπόσχεται διαθεσιμότητα αυτή η βαθμίδα;** — `Record` πάνω σε κλειστό σύνολο, ώστε
 * πέμπτη βαθμίδα να μη μεταγλωττίζεται πριν απαντήσει *«και αυτή, τι λέει στον
 * επισκέπτη;»*. Ίδιος φρουρός με το `STAY_LIFECYCLE_OCCUPIES`.
 */
export const STAY_FRESHNESS_TRUSTED: Readonly<Record<StayChannelFreshness, boolean>> = {
  fresh: true,
  lagging: true,
  stale: false,
  paused: false,
};

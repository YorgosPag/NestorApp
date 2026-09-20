/**
 * =============================================================================
 * 🗓️ ΤΟ ΕΝΑ ΛΕΞΙΛΟΓΙΟ ΤΟΥ «ΠΟΤΕ» — appointment schedule SSoT
 * =============================================================================
 *
 * **Η ερώτηση**: *«πότε είναι αυτό το ραντεβού;»* — και μέχρι το ADR-869 την απαντούσαν
 * **τρία** αντίγραφα, το καθένα με δικό του κανονικοποιητή ημερομηνίας:
 *
 * | Πού | Τι έκανε |
 * |---|---|
 * | `services/calendar/AppointmentsRepository.ts` | `confirmedDate ?? requestedDate ?? date` + `resolveDateStr` |
 * | `services/calendar/mappers.ts` | το ίδιο, με δεύτερο `resolveDateStr` |
 * | `components/crm/tasks/task-activity.ts` | το ίδιο, με τρίτο — inline |
 *
 * …και **κανένα** από τα τρία δεν ήταν ερωτήσιμο: η απάντηση ζούσε **μόνο** στη μνήμη του
 * πελάτη, άρα το Firestore δεν μπορούσε να τη φιλτράρει. Γι' αυτό το `getByDateRange`
 * ήταν **πλήρης σάρωση** — ένα ερώτημα εύρους στο `requestedDate` θα **έχανε** ραντεβού
 * που εγκρίθηκε για άλλη μέρα (ADR-869 §3).
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * 🔑 Η ΑΡΧΗ: **παραγόμενο πεδίο σε χρόνο εγγραφής, γραμμένο ΜΟΝΟ από τον διακομιστή**
 * ──────────────────────────────────────────────────────────────────────────────
 * Η πρακτική των μεγάλων για ακριβώς αυτό το σχήμα: *«denormalization optimizes data reads
 * by writing extra data at write-time»* + *«secure derived fields so only the function's
 * service account can write them»*. Το δεύτερο **το έχουμε ήδη δωρεάν**: το
 * `firestore.rules` δηλώνει `allow write: if false` για τα `appointments` — κανένας
 * πελάτης δεν μπορεί να αγγίξει το πεδίο, ό,τι κι αν στείλει.
 *
 * **Και ένα σκαλί παραπάνω από τη συνήθη πρακτική**: οι μεγάλοι κρατούν τον παραγόμενο
 * συγχρονισμένο με **πειθαρχία** (ή με Cloud Function που τρέχει *μετά*, δηλαδή αφήνει
 * παράθυρο ασυνέπειας). Εδώ ο συγχρονισμός είναι **δομικός**: κανένας γραφέας δεν
 * συναρμολογεί `appointment: { … }` με το χέρι πια — περνά από `withAppointmentSchedule()`
 * ή `appointmentConfirmationPatch()`, που **επιστρέφουν** τα κανονικά πεδία μαζί με τα
 * ιστορικά. Η λήθη παύει να είναι ζήτημα προσοχής: το αντικείμενο **δεν υπάρχει** χωρίς
 * αυτά, και δεν χρειάζεται δεύτερη εγγραφή που μπορεί να αποτύχει.
 *
 * ⚠️ **Ο αναγνώστης ΔΕΝ εμπιστεύεται ότι το πεδίο υπάρχει.** Το `resolveAppointmentSchedule`
 * προτιμά το αποθηκευμένο και **παράγει** όταν λείπει — ώστε έγγραφο γραμμένο πριν από το
 * πεδίο να μη γίνει ποτέ αόρατο στην οθόνη. (Στο **ερώτημα** εύρους αυτό δεν μεταφέρεται:
 * εκεί κρίνει ο διακομιστής. Μετρημένο 2026-09-20: η συλλογή έχει **0 έγγραφα**, άρα δεν
 * υπάρχει τίποτα να μεταναστεύσει — δες ADR-869 §12.4 για τη συνταγή αν αυτό αλλάξει.)
 *
 * @module services/appointments/appointment-schedule
 * @see docs/centralized-systems/reference/adrs/ADR-869-firestore-index-blind-zone.md §12
 */

import { normalizeCalendarDay } from '@/lib/date-local';
import { FIELDS } from '@/config/firestore-field-constants';
import type { AppointmentDetails } from '@/types/appointment';

// ============================================================================
// ΤΟ ΛΕΞΙΛΟΓΙΟ — οι διαδρομές που μπαίνουν σε where()/orderBy() και σε update()
// ============================================================================

/**
 * Οι **διαδρομές πεδίων** που γράφει η έγκριση, ως κλειδιά ενός `update()`.
 *
 * 🔑 Τα δύο **ερωτήσιμα** ονόματα **δεν** ορίζονται εδώ: έρχονται από το `FIELDS`
 * (`config/firestore-field-constants.ts`), που είναι ο **μόνος** κατάλογος ονομάτων τον
 * οποίο **λύνει η στατική ανάλυση** (CHECK 3.15 §12.5 · CHECK 3.35). Ορισμένα εδώ, τα
 * ερωτήματα που τα χρησιμοποιούν θα ήταν **αόρατα στις πύλες** — μετρημένο, όχι θεωρητικό:
 * η πρώτη εκδοχή αυτού του αρχείου τα όριζε εδώ και το ερώτημα εύρους του ημερολογίου
 * έγινε αμέσως `unanalyzable`.
 *
 * Τα `CONFIRMED_*` μένουν εδώ γιατί **δεν ρωτιούνται ποτέ** — είναι ιστορικό, και το μόνο
 * που χρειάζονται είναι να γραφτούν σωστά, σε **ένα** σημείο.
 */
export const APPOINTMENT_SCHEDULE_PATHS = {
  EFFECTIVE_DATE: FIELDS.APPOINTMENT_EFFECTIVE_DATE,
  EFFECTIVE_TIME: FIELDS.APPOINTMENT_EFFECTIVE_TIME,
  CONFIRMED_DATE: 'appointment.confirmedDate',
  CONFIRMED_TIME: 'appointment.confirmedTime',
} as const;

/**
 * Η ώρα που υπονοείται όταν κανείς δεν δήλωσε ώρα.
 *
 * ⚠️ Ήταν **ήδη** `'09:00'` σε **δύο** αντίγραφα (`calendar/mappers.ts`,
 * `crm/tasks/task-activity.ts`) — απλώς κανένα δεν το ονόμαζε.
 */
export const APPOINTMENT_DEFAULT_TIME = '09:00';

const CLOCK_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

// ============================================================================
// ΚΑΝΟΝΙΚΟΠΟΙΗΣΗ
// ============================================================================
//
// 🔑 Η μετάφραση **ημέρας** (`DD/MM/YYYY` ⇄ `YYYY-MM-DD`) ΔΕΝ ζει εδώ: ζει στο
// `@/lib/date-local`, που δηλώνει ρητά ότι είναι *«το SSoT ημερομηνίας»*. Ήταν
// γραμμένη σε **τέσσερα** σημεία — τρία στα ραντεβού και ένα στα tasks
// (`calendar/mappers.ts`, για `dueDate`) — δηλαδή δεν ήταν ποτέ ερώτηση του τομέα
// «ραντεβού», ήταν ερώτηση «τι μορφή έχει αυτή η ημέρα;».

/** Ώρα σε μορφή `HH:mm` **που υπάρχει σε ρολόι**, ή `null`. Φρουρός σχήματος, όχι μετατροπέας ζώνης. */
export function normalizeClockTime(raw: unknown): string | null {
  return typeof raw === 'string' && CLOCK_TIME.test(raw) ? raw : null;
}

// ============================================================================
// Η ΠΑΡΑΓΩΓΗ — μία συνάρτηση, δύο πρόσωπα (γραφέας / αναγνώστης)
// ============================================================================

/** Το κανονικό πρόγραμμα ενός ραντεβού: η μέρα που ισχύει και η ώρα της. */
export interface AppointmentSchedule {
  /** `YYYY-MM-DD` — πάντα κανονικοποιημένη. */
  readonly date: string;
  /** `HH:mm`. */
  readonly time: string;
}

/**
 * Ό,τι μοιάζει με ραντεβού: οι λεπτομέρειες, και (για παλαιά έγγραφα) τα επίπεδα
 * `date`/`time` στη ρίζα που έγραφε κάποτε ο πράκτορας μέσω Telegram.
 */
export interface AppointmentScheduleSource {
  readonly appointment?: Partial<AppointmentDetails> | null;
  readonly date?: unknown;
  readonly time?: unknown;
}

/**
 * **Η ΠΗΓΗ ΤΗΣ ΑΛΗΘΕΙΑΣ** — η σειρά προτίμησης, γραμμένη **μία** φορά.
 *
 * Επιβεβαιωμένο ⇒ αιτούμενο ⇒ παλαιό επίπεδο πεδίο. Το «επιβεβαιωμένο πρώτο» είναι
 * **απόφαση τομέα**: ένα ραντεβού που μετακινήθηκε ζει στη **νέα** του μέρα.
 */
function deriveSchedule(source: AppointmentScheduleSource): AppointmentSchedule | null {
  const details = source.appointment ?? undefined;
  const date =
    normalizeCalendarDay(details?.confirmedDate) ??
    normalizeCalendarDay(details?.requestedDate) ??
    normalizeCalendarDay(source.date);
  if (date === null) return null;

  const time =
    normalizeClockTime(details?.confirmedTime) ??
    normalizeClockTime(details?.requestedTime) ??
    normalizeClockTime(source.time) ??
    APPOINTMENT_DEFAULT_TIME;

  return { date, time };
}

/**
 * **ΓΡΑΦΕΑΣ** — οι λεπτομέρειες μαζί με τα κανονικά πεδία τους.
 *
 * Κάθε διαδρομή που **γεννά** ραντεβού περνά από εδώ. Το αντικείμενο που επιστρέφει
 * **είναι** αυτό που αποθηκεύεται· δεν υπάρχει εκδοχή του χωρίς `effectiveDate`.
 */
export function withAppointmentSchedule(details: AppointmentDetails): AppointmentDetails {
  const schedule = deriveSchedule({ appointment: details });
  return {
    ...details,
    effectiveDate: schedule?.date ?? null,
    effectiveTime: schedule?.time ?? null,
  };
}

/**
 * **ΓΡΑΦΕΑΣ ΕΓΚΡΙΣΗΣ** — το patch που επιβεβαιώνει ραντεβού.
 *
 * 🔑 Επιστρέφει **και** τα επιβεβαιωμένα **και** τα κανονικά πεδία, σε **ένα** αντικείμενο:
 * έτσι η ενημέρωση είναι **μία** ατομική εγγραφή και είναι **αδύνατο** να επιβεβαιωθεί
 * ημερομηνία χωρίς να μετακινηθεί μαζί της η ερωτήσιμη. (Το προηγούμενο `update()`
 * έγραφε τα δύο dotted κλειδιά με το χέρι — τίποτα δεν θα εμπόδιζε έναν τρίτο γραφέα
 * να γράψει μόνο το ένα.)
 */
export function appointmentConfirmationPatch(
  confirmedDate: string,
  confirmedTime: string,
): Record<string, string> {
  const schedule = deriveSchedule({
    appointment: { confirmedDate, confirmedTime, description: '' },
  });
  return {
    [APPOINTMENT_SCHEDULE_PATHS.CONFIRMED_DATE]: confirmedDate,
    [APPOINTMENT_SCHEDULE_PATHS.CONFIRMED_TIME]: confirmedTime,
    [APPOINTMENT_SCHEDULE_PATHS.EFFECTIVE_DATE]: schedule?.date ?? confirmedDate,
    [APPOINTMENT_SCHEDULE_PATHS.EFFECTIVE_TIME]: schedule?.time ?? confirmedTime,
  };
}

/**
 * **ΑΝΑΓΝΩΣΤΗΣ** — προτιμά το αποθηκευμένο κανονικό πεδίο, **παράγει** όταν λείπει.
 *
 * Η πρόταξη του αποθηκευμένου δεν είναι μόνο ταχύτητα: είναι **η ίδια απάντηση** με
 * αυτήν που έκρινε το ερώτημα του διακομιστή. Αν ο αναγνώστης ξαναπαρήγαγε πάντα, μια
 * μελλοντική αλλαγή στη σειρά προτίμησης θα έκανε οθόνη και ερώτημα να διαφωνούν χωρίς
 * να αλλάξει τίποτα ορατό.
 */
export function resolveAppointmentSchedule(
  source: AppointmentScheduleSource,
): AppointmentSchedule | null {
  const stored = normalizeCalendarDay(source.appointment?.effectiveDate);
  if (stored !== null) {
    return {
      date: stored,
      time: normalizeClockTime(source.appointment?.effectiveTime) ?? APPOINTMENT_DEFAULT_TIME,
    };
  }
  return deriveSchedule(source);
}

/** Η **στιγμή** έναρξης — για ταξινόμηση και για το ημερολόγιο. `null` όταν δεν υπάρχει μέρα. */
export function appointmentStartAt(source: AppointmentScheduleSource): Date | null {
  const schedule = resolveAppointmentSchedule(source);
  if (schedule === null) return null;
  const start = new Date(`${schedule.date}T${schedule.time}:00`);
  return Number.isNaN(start.getTime()) ? null : start;
}

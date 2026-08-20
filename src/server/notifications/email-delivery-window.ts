/**
 * =============================================================================
 * ΠΑΡΑΘΥΡΟ ΠΑΡΑΔΟΣΗΣ EMAIL — «πότε επιτρέπεται να διακόψω αυτόν τον άνθρωπο;»
 * =============================================================================
 *
 * **Καθαρή συνάρτηση. Καμία Firestore, κανένα δίκτυο, κανένα ρολόι** — το `now`
 * δίνεται. Έτσι η πολιτική είναι δοκιμάσιμη εξαντλητικά, και δεν μπορεί να
 * απαντήσει διαφορετικά ανάλογα με το πότε τρέχει το test.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΠΡΟΒΛΗΜΑ: ΟΙ ΡΥΘΜΙΣΕΙΣ ΕΛΕΓΑΝ ΨΕΜΑΤΑ — ΜΕΤΡΗΜΕΝΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η οθόνη ρυθμίσεων προσφέρει **τέσσερις** συχνότητες (`realtime` · `daily` ·
 * `weekly` · `disabled`) και **ώρες ησυχίας** (`quietHours`). Πριν από αυτό το
 * module ο orchestrator έκανε **έναν** έλεγχο:
 *
 * ```ts
 * settings.emailFrequency !== 'disabled'      // ← και τίποτα άλλο
 * ```
 *
 * Δηλαδή: **τρεις από τις τέσσερις τιμές ήταν ταυτόσημες**, και η προεπιλογή για
 * κάθε νέο χρήστη είναι `'daily'` — άρα *όλοι* έπαιρναν άμεσο email ενώ η οθόνη
 * τους έλεγε «ημερησίως». Οι `quietHours` δεν διαβάζονταν από **κανέναν**
 * (grep = 0 καταναλωτές πέρα από αποθήκευση/ανάγνωση ρυθμίσεων): ένα email στις
 * 03:00 ήταν απολύτως εφικτό.
 *
 * Μια ρύθμιση που δεν τηρείται είναι **χειρότερη** από ρύθμιση που δεν υπάρχει:
 * η δεύτερη δεν υπόσχεται τίποτα.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΑΝΑΒΟΛΗ, ΟΧΙ ΑΠΟΡΡΙΨΗ — και είναι η πρακτική των μεγάλων, ερευνημένη
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Όλες οι πλατφόρμες ειδοποιήσεων (Courier · Braze · Knock · Customer.io ·
 * Novu · OneSignal) **βάζουν το μήνυμα σε ουρά και το στέλνουν όταν ανοίξει το
 * παράθυρο** — δεν το πετούν. Μόνο το Braze προσφέρει και «άκυρο εντελώς», ως
 * *επιλογή*. Ένα μήνυμα που χάνεται επειδή έτυχε να γεννηθεί στις 03:00 είναι
 * σιωπηλή απώλεια, και ο παραλήπτης δεν μαθαίνει ποτέ ότι υπήρχε.
 *
 * Και όλες προβλέπουν **παράκαμψη για τα κρίσιμα** (Courier: *«security alerts
 * skip quiet hours entirely»*). Εδώ η παράκαμψη είναι το **υπάρχον**
 * `mapping.isMandatory` — **5 από τα 29** συμβάντα, μετρημένα, όχι νέα σημαία.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΤΙ **ΔΕΝ** ΕΙΝΑΙ ΑΥΤΟ: ΔΕΝ ΕΙΝΑΙ ΣΥΝΟΨΗ (digest) — ΔΗΛΩΜΕΝΟ ΟΡΙΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το module αποφασίζει **πότε** παραδίδεται το κάθε μήνυμα, όχι πώς **ενώνονται
 * πολλά σε ένα**. Τρία γεγονότα με `daily` γίνονται τρία email στις 20:00, όχι
 * ένα με τρεις γραμμές. Η ονομασία είναι **παράθυρο παράδοσης** ακριβώς γι'
 * αυτό: μια συνάρτηση που λεγόταν «digest» χωρίς να συναθροίζει θα ήταν ψέμα
 * στο όνομα — το ίδιο σφάλμα που διορθώνει.
 *
 * 🔑 **Και ο λόγος που αυτό ΔΕΝ πονάει σήμερα είναι μετρημένος**: για τη ζήτηση
 * ακινήτων η συνάθροιση γίνεται **νωρίτερα και καλύτερα**, από τις **ζώνες**
 * (`lib/demand/demand-announcement.ts`: 1·3·8·20·50). Είκοσι άνθρωποι που
 * ψάχνουν το ίδιο ακίνητο μέσα στη μέρα παράγουν **τέσσερα** μηνύματα, όχι 20 —
 * και η συνάθροιση εκεί γίνεται κατά **σημασία**, όχι κατά ρολόι, που είναι
 * αυστηρά ανώτερο: ένα παράθυρο 15 λεπτών εξακολουθεί να στέλνει 20 μηνύματα σε
 * 20 ώρες για κάτι που δεν άλλαξε ουσιαστικά.
 *
 * Η πραγματική συνάθροιση («ένα email, N γραμμές») ανήκει στον **αποστολέα**
 * που αδειάζει την ουρά, γιατί μόνο εκεί υπάρχουν όλα τα εκκρεμή ενός ανθρώπου
 * ταυτόχρονα. Είναι ονομασμένο επόμενο βήμα, όχι ξεχασμένο.
 *
 * @module server/notifications/email-delivery-window
 * @see ADR-777 §8.23
 * @see ADR-026 — orchestrator ειδοποιήσεων
 */

import {
  DEFAULT_NOTIFICATION_TIMEZONE,
  type UserNotificationSettings,
} from '@/services/user-notification-settings/user-notification-settings.types';

/**
 * ✅ **ΤΟ ΟΡΙΟ ΕΚΛΕΙΣΕ (§8.28): η ζώνη είναι πλέον ΑΝΑ ΧΡΗΣΤΗ.**
 *
 * Αυτή η σταθερά ήταν η **καθολική** ζώνη: το «22:00» **κάθε** χρήστη σήμαινε 22:00
 * Ελλάδας. Παραμένει μόνο ως **προεπιλογή** — και ζει στο SSoT των ρυθμίσεων
 * (`DEFAULT_NOTIFICATION_TIMEZONE`), όχι εδώ, ώστε να μην υπάρχουν δύο τιμές που
 * μπορούν να αποκλίνουν.
 *
 * Είναι η **ίδια** ζώνη με το `CRON_TIMEZONE`, και σκόπιμα δηλώνεται ξεχωριστά:
 * το «πότε τρέχει ο σαρωτής» και το «πότε επιτρέπεται να ενοχλήσω άνθρωπο» είναι
 * δύο διαφορετικές αποφάσεις που σήμερα συμπίπτουν.
 *
 * @deprecated Χρησιμοποίησε το `settings.timezone`. Μένει εξαγόμενο για καταναλωτές
 * που χρειάζονται την προεπιλογή ονομαστικά.
 */
export const NOTIFICATION_TIMEZONE = DEFAULT_NOTIFICATION_TIMEZONE;

/**
 * **Είναι αυτό αναγνωρίσιμη ζώνη ώρας;**
 *
 * ⚠️ **Fail-safe, και δεν είναι πολυτέλεια.** Το `Intl.DateTimeFormat` πετά
 * `RangeError` σε άγνωστο identifier. Το πεδίο `timezone` έρχεται από **έγγραφο
 * Firestore** — δηλαδή από δεδομένα, όχι από τον μεταγλωττιστή. Ένα κακογραμμένο
 * `"Europe/Athina"` σε **έναν** χρήστη θα έριχνε την εργασία που παραδίδει
 * αλληλογραφία για **όλους**.
 *
 * Ίδιο σχήμα με το `minutesOfDay`: άκυρη ρύθμιση ⇒ **αγνοείται**, ποτέ κατάρρευση.
 */
function isKnownTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Η ζώνη του χρήστη, ή η προεπιλογή όταν λείπει/είναι άκυρη. */
export function resolveTimeZone(timeZone: string | undefined): string {
  if (!timeZone || !isKnownTimeZone(timeZone)) return DEFAULT_NOTIFICATION_TIMEZONE;
  return timeZone;
}

/** Ώρα του ημερήσιου παραθύρου — απόγευμα, αφού τελειώσει η δουλειά. */
export const DAILY_WINDOW_HOUR = 20;

/** Ώρα του εβδομαδιαίου παραθύρου. */
export const WEEKLY_WINDOW_HOUR = 9;

/** Ημέρα του εβδομαδιαίου παραθύρου: Δευτέρα (`Date#getDay` → 1). */
export const WEEKLY_WINDOW_WEEKDAY = 1;

/** Γιατί αναβλήθηκε. Ονομασμένο, ποτέ boolean. */
export type DeferReason = 'quiet-hours' | 'daily-window' | 'weekly-window';

/** Γιατί δεν φεύγει καθόλου. Ονομασμένο, ποτέ boolean. */
export type SuppressReason = 'global-disabled' | 'email-disabled' | 'frequency-disabled';

/**
 * Η απόφαση.
 *
 * **Τρεις ρητές καταστάσεις**, ποτέ `boolean | Date | null`: ο καλών δεν
 * επιτρέπεται να μπερδέψει «στείλ' το αργότερα» με «μην το στείλεις» — η πρώτη
 * είναι υπόσχεση προς τον παραλήπτη, η δεύτερη είναι επιλογή του.
 */
export type EmailDeliveryDecision =
  | { readonly kind: 'send-now' }
  | { readonly kind: 'defer'; readonly deliverAt: Date; readonly reason: DeferReason }
  | { readonly kind: 'suppressed'; readonly reason: SuppressReason };

/** Τα μέρη μιας στιγμής, **στη ζώνη του παραλήπτη**. */
interface ZonedParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  /** 0 = Κυριακή, όπως το `Date#getDay`. */
  readonly weekday: number;
}

const WEEKDAY_INDEX: Readonly<Record<string, number>> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

/**
 * Ανάλυση μιας στιγμής στα μέρη της, στη ζώνη `NOTIFICATION_TIMEZONE`.
 *
 * ⚠️ **Μέσω `Intl`, ΠΟΤΕ μέσω `getHours()`.** Το `getHours()` απαντά στη ζώνη του
 * **διακομιστή** — και ο διακομιστής είναι ένα container Docker που τρέχει σε
 * UTC. Οι «ώρες ησυχίας 22:00–08:00» θα ίσχυαν τότε 01:00–11:00 τοπικά τον
 * χειμώνα και 00:00–10:00 το καλοκαίρι: λάθος, **και διαφορετικά λάθος δύο φορές
 * τον χρόνο**.
 */
function zonedParts(instant: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false,
  }).formatToParts(instant);

  const value = (type: string): string =>
    parts.find((part) => part.type === type)?.value ?? '';

  // Το `hour12: false` αποδίδει μεσάνυχτα ως «24» σε ορισμένες εκδόσεις ICU.
  const rawHour = Number(value('hour'));

  return {
    year: Number(value('year')),
    month: Number(value('month')),
    day: Number(value('day')),
    hour: rawHour === 24 ? 0 : rawHour,
    minute: Number(value('minute')),
    weekday: WEEKDAY_INDEX[value('weekday')] ?? 0,
  };
}

/** `"HH:MM"` → λεπτά από τα μεσάνυχτα· `null` όταν η μορφή δεν είναι έγκυρη. */
function minutesOfDay(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;

  return hour * 60 + minute;
}

/**
 * Η στιγμή που αντιστοιχεί σε τοπική ώρα `hour:00`, `dayOffset` μέρες μετά το
 * `from` — υπολογισμένη **αναζητητικά**, γιατί η αντίστροφη απεικόνιση
 * (τοπική ώρα → στιγμή) δεν είναι συνάρτηση: την ημέρα αλλαγής ώρας μια τοπική
 * ώρα μπορεί να **μην υπάρχει** ή να υπάρχει **δύο φορές**.
 *
 * Ξεκινά από την εκτίμηση UTC και διορθώνει με τη μετρημένη απόκλιση. Δύο
 * περάσματα αρκούν: η πρώτη διόρθωση φέρνει μέσα στη σωστή μέρα, η δεύτερη
 * απορροφά την αλλαγή ζώνης αν η πρώτη πέρασε το σύνορό της.
 */
function instantAtLocalHour(
  from: Date,
  dayOffset: number,
  hour: number,
  timeZone: string,
): Date {
  const base = zonedParts(from, timeZone);
  let candidate = new Date(
    Date.UTC(base.year, base.month - 1, base.day + dayOffset, hour, 0, 0, 0),
  );

  for (let pass = 0; pass < 2; pass += 1) {
    const got = zonedParts(candidate, timeZone);
    const wantedMinutes = hour * 60;
    const gotMinutes = got.hour * 60 + got.minute;
    // Η διαφορά μέρας μετριέται σε λεπτά μέσω της ίδιας της υποψηφιότητας.
    const dayDrift =
      Date.UTC(got.year, got.month - 1, got.day) -
      Date.UTC(base.year, base.month - 1, base.day + dayOffset);
    const driftMinutes = gotMinutes - wantedMinutes + dayDrift / 60_000;
    if (driftMinutes === 0) break;
    candidate = new Date(candidate.getTime() - driftMinutes * 60_000);
  }

  return candidate;
}

/** Είναι η στιγμή μέσα στο παράθυρο ησυχίας; */
function insideQuietHours(
  instant: Date,
  quietHours: UserNotificationSettings['quietHours'],
  timeZone: string,
): boolean {
  if (!quietHours.enabled) return false;

  const start = minutesOfDay(quietHours.startTime);
  const end = minutesOfDay(quietHours.endTime);
  // Άκυρη μορφή ⇒ **καμία** ησυχία, όχι μόνιμη ησυχία: μια κακογραμμένη ρύθμιση
  // δεν επιτρέπεται να αποκλείσει σιωπηλά κάθε email για πάντα.
  if (start === null || end === null || start === end) return false;

  const parts = zonedParts(instant, timeZone);
  const nowMinutes = parts.hour * 60 + parts.minute;

  // ⚠️ Το παράθυρο **συνήθως περνά τα μεσάνυχτα** (η προεπιλογή είναι 22:00→08:00).
  // Ένας αφελής έλεγχος `start <= now && now < end` είναι ΠΑΝΤΑ ψευδής εκεί —
  // δηλαδή θα ανέφερε «ποτέ ησυχία» ακριβώς στη ρύθμιση που έχουν όλοι.
  return start < end
    ? nowMinutes >= start && nowMinutes < end
    : nowMinutes >= start || nowMinutes < end;
}

/** Η επόμενη στιγμή που κλείνει το παράθυρο ησυχίας. */
function quietHoursEnd(
  instant: Date,
  quietHours: UserNotificationSettings['quietHours'],
  timeZone: string,
): Date {
  const end = minutesOfDay(quietHours.endTime) ?? 0;
  const endHour = Math.floor(end / 60);
  const parts = zonedParts(instant, timeZone);
  const nowMinutes = parts.hour * 60 + parts.minute;

  // Αν η ώρα λήξης έχει ήδη περάσει σήμερα, το παράθυρο κλείνει **αύριο**.
  const sameDay = nowMinutes < end;
  const candidate = instantAtLocalHour(instant, sameDay ? 0 : 1, endHour, timeZone);

  // Τα λεπτά της ώρας λήξης προστίθενται χωριστά: το `instantAtLocalHour` δουλεύει
  // σε ακέραιες ώρες, και μια ρύθμιση «08:30» δεν επιτρέπεται να στρογγυλοποιηθεί
  // σιωπηλά σε 08:00 — θα ήταν email μέσα στην ησυχία που ο χρήστης ζήτησε.
  return new Date(candidate.getTime() + (end % 60) * 60_000);
}

/** Η επόμενη στιγμή του ημερήσιου παραθύρου. */
function nextDailyWindow(instant: Date, timeZone: string): Date {
  const parts = zonedParts(instant, timeZone);
  const passed = parts.hour > DAILY_WINDOW_HOUR ||
    (parts.hour === DAILY_WINDOW_HOUR && parts.minute > 0);
  return instantAtLocalHour(instant, passed ? 1 : 0, DAILY_WINDOW_HOUR, timeZone);
}

/** Η επόμενη στιγμή του εβδομαδιαίου παραθύρου. */
function nextWeeklyWindow(instant: Date, timeZone: string): Date {
  const parts = zonedParts(instant, timeZone);
  let offset = (WEEKLY_WINDOW_WEEKDAY - parts.weekday + 7) % 7;

  const passedToday =
    parts.hour > WEEKLY_WINDOW_HOUR ||
    (parts.hour === WEEKLY_WINDOW_HOUR && parts.minute > 0);
  // Αν είναι σήμερα Δευτέρα και η ώρα πέρασε, το παράθυρο είναι την **επόμενη**.
  if (offset === 0 && passedToday) offset = 7;

  return instantAtLocalHour(instant, offset, WEEKLY_WINDOW_HOUR, timeZone);
}

/** Τι ρωτά ο καλών. */
export interface EmailDeliveryContext {
  /** Η στιγμή αναφοράς. **Δίνεται πάντα** — η συνάρτηση δεν διαβάζει ρολόι. */
  readonly now: Date;
  /**
   * Παρακάμπτει **και** τη συχνότητα **και** τις ώρες ησυχίας.
   *
   * Είναι το υπάρχον `EVENT_CATEGORY_MAP[eventType].isMandatory` — **5 από τα 29**
   * συμβάντα. Δεν είναι νέα σημαία και **δεν** πρέπει να γίνει: κάθε νέο συμβάν
   * που θα αυτοχαρακτηριζόταν «επείγον» θα ακύρωνε την πολιτική για όλους.
   */
  readonly isMandatory: boolean;
}

/**
 * **Πότε φεύγει αυτό το email;**
 *
 * Η σειρά των ελέγχων είναι συμβόλαιο:
 *
 * 1. **Υποχρεωτικό** ⇒ τώρα. Πριν από κάθε άλλον έλεγχο, γιατί ένα κρίσιμο
 *    μήνυμα δεν επιτρέπεται να σιωπήσει από ρύθμιση άνεσης.
 * 2. **Καθολικός / καναλιού διακόπτης** ⇒ σιωπή. Είναι **απόφαση ανθρώπου**.
 * 3. **Συχνότητα** ⇒ παράθυρο (ή τώρα, για `realtime`).
 * 4. **Ώρες ησυχίας** ⇒ **μετά** τη συχνότητα, γιατί εφαρμόζεται στη
 *    **στιγμή παράδοσης**, όχι στη στιγμή γέννησης. Ένα `daily` που θα έφτανε
 *    στις 20:00 δεν ενοχλείται από ησυχία 22:00–08:00· ένα `realtime` στις 03:00
 *    ενοχλείται.
 */
export function decideEmailDelivery(
  settings: UserNotificationSettings,
  context: EmailDeliveryContext,
): EmailDeliveryDecision {
  if (context.isMandatory) {
    return { kind: 'send-now' };
  }

  if (!settings.globalEnabled) {
    return { kind: 'suppressed', reason: 'global-disabled' };
  }
  if (!settings.emailEnabled) {
    return { kind: 'suppressed', reason: 'email-disabled' };
  }
  if (settings.emailFrequency === 'disabled') {
    return { kind: 'suppressed', reason: 'frequency-disabled' };
  }

  // 🕐 §8.28 — **η ζώνη ΤΟΥ ΧΡΗΣΤΗ**, λυμένη μία φορά και περασμένη παντού. Άκυρη ή
  // απούσα τιμή πέφτει στην προεπιλογή αντί να ρίξει το `Intl`.
  const timeZone = resolveTimeZone(settings.timezone);

  if (settings.emailFrequency === 'daily') {
    return withQuietHours(
      { kind: 'defer', deliverAt: nextDailyWindow(context.now, timeZone), reason: 'daily-window' },
      settings,
      timeZone,
    );
  }

  if (settings.emailFrequency === 'weekly') {
    return withQuietHours(
      { kind: 'defer', deliverAt: nextWeeklyWindow(context.now, timeZone), reason: 'weekly-window' },
      settings,
      timeZone,
    );
  }

  // `realtime` — η μόνη περίπτωση όπου η στιγμή παράδοσης είναι το τώρα.
  return withQuietHours({ kind: 'send-now' }, settings, timeZone, context.now);
}

/**
 * Σπρώχνει μια απόφαση έξω από τις ώρες ησυχίας.
 *
 * 🔑 **Η ΜΟΝΟΤΟΝΙΑ ΕΙΝΑΙ ΘΕΩΡΗΜΑ, ΟΧΙ ΕΛΕΓΧΟΣ — και αυτό μετρήθηκε.**
 *
 * Η πρώτη γραφή είχε εδώ φρουρό «αν το τέλος της ησυχίας είναι πριν από τη
 * στιγμή παράδοσης, κράτα τη στιγμή» — για να μην μπορεί η ησυχία να φέρει το
 * email **νωρίτερα**. Η μετάλλαξη έδειξε ότι **η αφαίρεσή του δεν χαλούσε
 * τίποτα**: ο φρουρός ήταν **ανέφικτος**.
 *
 * Ο λόγος: μπαίνουμε εδώ **μόνο** όταν το `at` είναι *μέσα* στο παράθυρο
 * ησυχίας, και το `quietHoursEnd(at)` επιστρέφει το **επόμενο** κλείσιμο του
 * παραθύρου μετρημένο **από το `at`** — άρα είναι πάντα γνησίως μετά. Η
 * συνθήκη δεν μπορούσε να αληθεύσει σε καμία είσοδο.
 *
 * ⚠️ Ένας φρουρός που δεν μπορεί να πυροδοτήσει είναι **αδρανής φρουρός**
 * (ADR-749 §5) και διαβάζεται λανθασμένα ως απόδειξη ασφάλειας. Διαγράφηκε.
 * Η ιδιότητα που υποσχόταν **δεν** χάθηκε: επιβάλλεται από την άγκυρα `Η5`,
 * που τη **σαρώνει** σε κάθε ώρα του 24ώρου αντί να την υποθέτει.
 */
function withQuietHours(
  decision: EmailDeliveryDecision,
  settings: UserNotificationSettings,
  timeZone: string,
  nowForImmediate?: Date,
): EmailDeliveryDecision {
  const at = decision.kind === 'defer' ? decision.deliverAt : nowForImmediate;
  if (!at) return decision;

  if (!insideQuietHours(at, settings.quietHours, timeZone)) return decision;

  return {
    kind: 'defer',
    deliverAt: quietHoursEnd(at, settings.quietHours, timeZone),
    reason: 'quiet-hours',
  };
}

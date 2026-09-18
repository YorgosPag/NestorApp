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
  categorySettingEnabled,
  emailModeFor,
  type NotificationSettingRef,
} from '@/services/user-notification-settings/notification-preference-policy';
import {
  DEFAULT_NOTIFICATION_TIMEZONE,
  type UserNotificationSettings,
} from '@/services/user-notification-settings/user-notification-settings.types';

// 🔗 ADR-867 Β6 (N.7.1) — η αριθμητική «ώρα σε ζώνη» (ησυχία, τοπική ώρα → στιγμή) ζει σε
// δικό της module: εδώ μένει η ΠΟΛΙΤΙΚΗ («πότε επιτρέπεται να διακόψω;»).
import { insideQuietHours, instantAtLocalHour, quietHoursEnd, zonedParts } from './email-delivery-clock';

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

/**
 * Γιατί αναβλήθηκε. Ονομασμένο, ποτέ boolean.
 *
 * `unread-grace` (ADR-867 Β6) — ο **παραγωγός** δήλωσε ότι το email έχει νόημα **μόνο αν μείνει
 * αδιάβαστο** για λίγο (Slack: ανά 15′ · Teams missed activity: από 10′). Η πύλη αποστολής ρωτά
 * ύστερα αν διαβάστηκε στο μεταξύ.
 */
export type DeferReason = 'quiet-hours' | 'daily-window' | 'weekly-window' | 'unread-grace';

/**
 * Γιατί δεν φεύγει καθόλου. Ονομασμένο, ποτέ boolean.
 *
 * ADR-849: `category-disabled` = ο άνθρωπος έκλεισε ολόκληρο τον τύπο (κουδούνι **και**
 * email)· `type-email-disabled` = κράτησε τον τύπο, αλλά **όχι** με email. Δύο λόγοι, όχι
 * ένας: το «ποιος από τους δύο διακόπτες» είναι η απάντηση στο «γιατί δεν μου ήρθε;».
 */
export type SuppressReason =
  | 'global-disabled'
  | 'email-disabled'
  | 'frequency-disabled'
  | 'category-disabled'
  | 'type-email-disabled'
  /**
   * ADR-841 §7 Α21.21 Φάση Β — **γεγονός του αιτήματος, όχι ρύθμιση του ανθρώπου**: η ερώτηση αργιών απαντήθηκε (στη φόρμα
   * ή από άλλον διαχειριστή), έληξε ή η βιτρίνα αποσύρθηκε **αφού** το email μπήκε στην ουρά. Ερώτηση χωρίς νόημα δεν φεύγει.
   */
  | 'question-settled'
  /**
   * ADR-867 Β6 — **γεγονός του νήματος, όχι ρύθμιση**: το μήνυμα διαβάστηκε, το νήμα σιγάστηκε, ο παραλήπτης
   * βγήκε από το ακροατήριο ή λείπει **αφού** το email μπήκε στην ουρά. Το «έχεις αδιάβαστο» δεν ισχύει πια.
   */
  | 'thread-settled';

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
  /**
   * 📧 ADR-849 — **ο διακόπτης του τύπου** (κατηγορία + κλειδί του `EVENT_CATEGORY_MAP`).
   *
   * ⚠️ **Προαιρετικό, και μένει προαιρετικό**: τα έγγραφα της ουράς που γράφτηκαν πριν το
   * ADR-849 δεν ξέρουν τον τύπο τους. Απουσία ⇒ μόνο οι **καθολικοί** έλεγχοι — δηλαδή
   * ακριβώς η συμπεριφορά πριν, ποτέ μαντεψιά.
   */
  readonly setting?: NotificationSettingRef;
  /**
   * ADR-867 Β6 — **η νωρίτερη στιγμή που το email έχει νόημα**, όπως τη δηλώνει ο παραγωγός.
   *
   * ⚠️ **Μόνο ΑΝΕΒΑΖΕΙ τη στιγμή παράδοσης, ποτέ δεν τη φέρνει νωρίτερα**: ένα `daily` μένει στις
   * 20:00· ένα `realtime` περιμένει ως εδώ. Οι ώρες ησυχίας εφαρμόζονται **μετά**, στη στιγμή που προκύπτει.
   * Τα υποχρεωτικά την αγνοούν (φεύγουν αμέσως, όπως πάντα).
   */
  readonly notBefore?: Date;
}

/**
 * **Επιτρέπεται καθόλου αυτό το email;** — `null` = ναι, αλλιώς **ο λόγος** που όχι.
 *
 * 🔑 ADR-849 — **ΜΙΑ απάντηση, δύο στιγμές.** Τη ρωτά το σκέλος email όταν γράφει στην
 * ουρά **και** η πύλη του αγωγού (`email-send-gate.ts`) λίγο πριν φύγει το μήνυμα: ένας
 * άνθρωπος που πατά «Διακοπή» στις 15:00 **δεν** παίρνει τη σύνοψη των 20:00. Αν οι δύο
 * στιγμές ρωτούσαν διαφορετικές συναρτήσεις, θα διαφωνούσαν την πρώτη φορά που θα
 * προστεθεί διακόπτης.
 *
 * Η σειρά είναι συμβόλαιο: **υποχρεωτικό ⇒ ποτέ σίγαση** → καθολικός → email → συχνότητα
 * → κύριος διακόπτης του τύπου → email του τύπου.
 */
export function emailSuppressionReason(
  settings: UserNotificationSettings,
  context: Pick<EmailDeliveryContext, 'isMandatory' | 'setting'>,
): SuppressReason | null {
  if (context.isMandatory) return null;
  if (!settings.globalEnabled) return 'global-disabled';
  if (!settings.emailEnabled) return 'email-disabled';
  if (settings.emailFrequency === 'disabled') return 'frequency-disabled';
  if (!context.setting) return null;
  if (!categorySettingEnabled(settings, context.setting)) return 'category-disabled';
  if (emailModeFor(settings, context.setting) === 'off') return 'type-email-disabled';
  return null;
}

/**
 * **Πότε φεύγει αυτό το email;**
 *
 * Η σειρά των ελέγχων είναι συμβόλαιο:
 *
 * 1. **Υποχρεωτικό** ⇒ τώρα. Πριν από κάθε άλλον έλεγχο, γιατί ένα κρίσιμο
 *    μήνυμα δεν επιτρέπεται να σιωπήσει από ρύθμιση άνεσης.
 * 2. **Διακόπτες ανθρώπου** ⇒ σιωπή ({@link emailSuppressionReason}): καθολικός, καναλιού,
 *    συχνότητα `disabled` και —ADR-849— ο τύπος ή το email του τύπου.
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

  const suppressed = emailSuppressionReason(settings, context);
  if (suppressed !== null) {
    return { kind: 'suppressed', reason: suppressed };
  }

  // 🕐 §8.28 — **η ζώνη ΤΟΥ ΧΡΗΣΤΗ**, λυμένη μία φορά και περασμένη παντού. Άκυρη ή
  // απούσα τιμή πέφτει στην προεπιλογή αντί να ρίξει το `Intl`.
  const timeZone = resolveTimeZone(settings.timezone);

  if (settings.emailFrequency === 'daily') {
    return withQuietHours(
      notEarlierThan({ kind: 'defer', deliverAt: nextDailyWindow(context.now, timeZone), reason: 'daily-window' }, context),
      settings,
      timeZone,
    );
  }

  if (settings.emailFrequency === 'weekly') {
    return withQuietHours(
      notEarlierThan({ kind: 'defer', deliverAt: nextWeeklyWindow(context.now, timeZone), reason: 'weekly-window' }, context),
      settings,
      timeZone,
    );
  }

  // `realtime` — η μόνη περίπτωση όπου η στιγμή παράδοσης είναι το τώρα (εκτός αν ο παραγωγός ζήτησε αναμονή).
  return withQuietHours(notEarlierThan({ kind: 'send-now' }, context), settings, timeZone, context.now);
}

/**
 * ADR-867 Β6 — **ανέβασε** τη στιγμή παράδοσης ως το `notBefore` του παραγωγού, αν χρειάζεται.
 * Καθαρή· δεν αγγίζει ποτέ απόφαση που ήδη στέλνει **αργότερα**.
 */
function notEarlierThan(decision: EmailDeliveryDecision, context: EmailDeliveryContext): EmailDeliveryDecision {
  const floor = context.notBefore;
  if (floor === undefined || decision.kind === 'suppressed') return decision;
  const at = decision.kind === 'defer' ? decision.deliverAt : context.now;
  return floor.getTime() > at.getTime() ? { kind: 'defer', deliverAt: floor, reason: 'unread-grace' } : decision;
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

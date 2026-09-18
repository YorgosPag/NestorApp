/**
 * =============================================================================
 * Η ΠΥΛΗ ΤΗΣ ΑΠΟΣΤΟΛΗΣ — «το θέλει ακόμη αυτός ο άνθρωπος;» (ADR-849 Δ4)
 * =============================================================================
 *
 * 🔴 **ΤΟ ΚΕΝΟ**: η απόφαση email λαμβανόταν **μόνο** τη στιγμή που το μήνυμα έμπαινε
 * στην ουρά. Ένα `daily` περιμένει ως τις 20:00· ο άνθρωπος που πάτησε «Διακοπή» ή
 * «όχι email για ταιριάσματα» στις 15:00 έπαιρνε **παρ' όλα αυτά** τη σύνοψη — ενώ η
 * σελίδα του είχε πει «σταμάτησαν». Ο αγωγός (`outbound-email-flush`) δεν διάβαζε
 * ρυθμίσεις ποτέ (grep: 0).
 *
 * 🔑 **Belt-and-suspenders (N.7.2 #4), με ΜΙΑ αλήθεια**: εδώ ρωτιέται το **ίδιο**
 * `emailSuppressionReason` που ρωτά το σκέλος email. Δύο στιγμές, μία συνάρτηση.
 *
 * | Μήνυμα | Κρίνεται; | Γιατί |
 * |---|---|---|
 * | Ειδοποίηση, κανονική, με `recipientId` | ✅ | Ο άνθρωπος και οι ρυθμίσεις του είναι γνωστοί |
 * | **Επείγουσα** (υποχρεωτική) | ❌ | Καμία ρύθμιση δεν τη σταματά — ούτε εδώ |
 * | Χωρίς `recipientId` (πριν το ADR-848) | ❌ | Χωρίς άνθρωπο δεν υπάρχουν ρυθμίσεις — **ποτέ** μαντεψιά από διεύθυνση |
 * | Ό,τι δεν είναι ειδοποίηση | ❌ | Δεν ανήκει σε ρυθμίσεις ειδοποιήσεων |
 *
 * 🔑 **ΔΕΥΤΕΡΗ ΕΡΩΤΗΣΗ, ΑΝΕΞΑΡΤΗΤΗ ΑΠΟ ΡΥΘΜΙΣΕΙΣ** (ADR-841 §7 Α21.21 Φάση Β): μήνυμα με **γεγονότα** ερώτησης αργιών
 * ρωτά τον **ίδιο** κριτή με τη σελίδα και το κουμπί — «ανοιχτή, ίδιο nonce, δεν έληξε, με μέρες που ακόμη περιμένουν στην
 * κάρτα;». Όχι ⇒ `question-settled`. Χωρίς αυτό, «Κλειστά» στη φόρμα στις 15:00 δεν σταματούσε το email των 20:00.
 * Ισχύει όποια κι αν είναι η προτεραιότητα ή ο παραλήπτης: είναι γεγονός **του αιτήματος**, όχι θέληση του ανθρώπου.
 *
 * 🔑 **ΤΡΙΤΗ ΕΡΩΤΗΣΗ, ΙΔΙΟ ΣΧΗΜΑ** (ADR-867 Β6): email «αδιάβαστο μήνυμα» ρωτά *«διάβασε το νήμα στο μεταξύ; το
 * σίγασε; έφυγε από το ακροατήριο; λείπει;»* — το missed-activity email του Teams, που στέλνεται **μόνο** για ό,τι
 * έμεινε αδιάβαστο. Όχι ⇒ `thread-settled`. Χωρίς αυτό, «απάντησα από το κινητό στις 15:02» δεν σταματούσε το email.
 *
 * ⚠️ **Αποτυχία ανάγνωσης ⇒ ΡΙΧΝΕΙ.** Ο αγωγός τότε δεν αγγίζει τίποτα και τα μηνύματα
 * μένουν `pending` για το επόμενο πέρασμα (5′). Η εναλλακτική «στείλ' τα» θα αγνοούσε
 * τη θέληση του ανθρώπου· η «σβήσ' τα» θα ήταν σιωπηλή απώλεια.
 *
 * @module server/notifications/email-send-gate
 * @see ADR-849
 */

import 'server-only';

import {
  EVENT_CATEGORY_MAP,
  isNotificationEventType,
  type EventCategoryMapping,
} from '@/config/notification-events';
import { nowISO } from '@/lib/date-local';
import { emailSuppressionReason, type SuppressReason } from '@/server/notifications/email-delivery-window';
import type { PendingEmail } from '@/server/notifications/email-digest';
import { loadUserNotificationSettingsMany } from '@/server/notifications/user-notification-settings-store';
import type { UserNotificationSettings } from '@/services/user-notification-settings/user-notification-settings.types';
import { MESSAGE_CATEGORIES, MESSAGE_PRIORITIES } from '@/types/communications';
import {
  holidayQuestionFactsKey,
  networkUnreadKey,
  type HolidayQuestionFactsRef,
  type NetworkUnreadRef,
} from '@/types/notification-email-facts';

/** Ένα μήνυμα που **δεν** θα φύγει, με τον λόγο — ονομασμένο, ποτέ boolean. */
export interface SuppressedEmail {
  readonly message: PendingEmail;
  readonly reason: SuppressReason;
}

/** Η απάντηση της πύλης. Κάθε μήνυμα της εισόδου σε **ακριβώς ένα** από τα δύο. */
export interface QueueGateResult {
  readonly deliverable: readonly PendingEmail[];
  readonly suppressed: readonly SuppressedEmail[];
}

/** Ποιος διαβάζει τις ρυθμίσεις — **ένεση**, ώστε η πύλη να δοκιμάζεται χωρίς Firestore. */
export type SettingsLoader = (
  userIds: readonly string[],
) => Promise<ReadonlyMap<string, UserNotificationSettings>>;

/**
 * **Ποιες ερωτήσεις αργιών έχουν ακόμη νόημα;** — ένεση, όπως οι ρυθμίσεις. Επιστρέφει κλειδιά `holidayQuestionFactsKey`.
 * ⚠️ Αποτυχία ⇒ **ρίχνει** (ίδιο δόγμα με τον φορτωτή ρυθμίσεων).
 */
export type HolidayQuestionLoader = (refs: readonly HolidayQuestionFactsRef[]) => Promise<ReadonlySet<string>>;

/** Δυναμική εισαγωγή: ο κριτής σέρνει κάρτα/κριτή ειδικών ωρών — τα περάσματα χωρίς ερώτηση αργιών δεν τα φορτώνουν ποτέ. */
const loadAskingHolidayQuestions: HolidayQuestionLoader = async (refs) => {
  const [{ holidayQuestionsStillAsking }, { getAdminFirestore }] = await Promise.all([
    import('@/services/mandate/holiday-hours-question-decision'),
    import('@/lib/firebaseAdmin'),
  ]);
  return holidayQuestionsStillAsking(getAdminFirestore(), refs);
};

/**
 * **Ποια αδιάβαστα νήματα εκκρεμούν ακόμη;** (ADR-867 Β6) — ένεση, όπως οι ρυθμίσεις. Επιστρέφει κλειδιά
 * `networkUnreadKey`. ⚠️ Αποτυχία ⇒ **ρίχνει** (ίδιο δόγμα): «δεν μπόρεσα να ρωτήσω» δεν είναι «στείλ' το».
 */
export type NetworkUnreadLoader = (refs: readonly NetworkUnreadRef[]) => Promise<ReadonlySet<string>>;

/** Δυναμική εισαγωγή: τα περάσματα χωρίς email νήματος δεν φορτώνουν ποτέ τον πυρήνα μηνυμάτων. */
const loadPendingNetworkUnread: NetworkUnreadLoader = async (refs) => {
  const [{ networkUnreadStillPending }, { getAdminFirestore }] = await Promise.all([
    import('@/services/network-messaging/network-unread-email'),
    import('@/lib/firebaseAdmin'),
  ]);
  return networkUnreadStillPending(getAdminFirestore(), refs, nowISO());
};

/** Το αδιάβαστο νήμα ενός μηνύματος — `null` αν το μήνυμα δεν είναι τέτοιο ή δεν έχει παραλήπτη. */
function networkUnreadRefOf(message: PendingEmail): NetworkUnreadRef | null {
  const { facts, recipientId } = message;
  if (facts?.kind !== 'network-thread-unread' || !recipientId) return null;
  return { threadId: facts.threadId, recipientUid: recipientId, since: facts.since };
}

/** Οι απαντήσεις των ερωτήσεων «από γεγονότα» ενός περάσματος. */
interface FactAnswers {
  readonly asking: ReadonlySet<string>;
  readonly pendingUnread: ReadonlySet<string>;
}

/**
 * **Ρωτά το μήνυμα κάτι που δεν ισχύει πια;** — κλειστό σύνολο, ένας κλάδος ανά είδος γεγονότων.
 * ⚠️ Email νήματος **χωρίς** παραλήπτη ⇒ `thread-settled`: δεν κρίνεται, άρα **δεν** φεύγει (ποτέ μαντεψιά).
 */
function questionSuppressionOf(message: PendingEmail, answers: FactAnswers): SuppressReason | null {
  const { facts } = message;
  if (facts === undefined) return null;
  switch (facts.kind) {
    case 'holiday-hours-question':
      return answers.asking.has(holidayQuestionFactsKey(facts)) ? null : 'question-settled';
    case 'network-thread-unread': {
      const ref = networkUnreadRefOf(message);
      return ref !== null && answers.pendingUnread.has(networkUnreadKey(ref)) ? null : 'thread-settled';
    }
  }
}

/** **Ποιος άνθρωπος κρίνεται για αυτό το μήνυμα;** — `null` αν το μήνυμα δεν κρίνεται. */
export function judgedRecipientOf(message: PendingEmail): string | null {
  if (message.category !== MESSAGE_CATEGORIES.NOTIFICATION) return null;
  if (message.priority === MESSAGE_PRIORITIES.URGENT) return null;
  return message.recipientId ?? null;
}

/** Ο διακόπτης του τύπου — ή `undefined` για παλιό έγγραφο / τύπο που δεν υπάρχει πια. */
function mappingOf(eventType: string | undefined): EventCategoryMapping | undefined {
  return isNotificationEventType(eventType) ? EVENT_CATEGORY_MAP[eventType] : undefined;
}

function suppressionOf(
  message: PendingEmail,
  settingsByUser: ReadonlyMap<string, UserNotificationSettings>,
): SuppressReason | null {
  const userId = judgedRecipientOf(message);
  const settings = userId === null ? undefined : settingsByUser.get(userId);
  if (!settings) return null;

  const mapping = mappingOf(message.eventType);
  return emailSuppressionReason(settings, {
    isMandatory: mapping?.isMandatory ?? false,
    ...(mapping ? { setting: mapping } : {}),
  });
}

/**
 * **Χώρισε τα ώριμα μηνύματα σε «φεύγουν» και «σιγασμένα»** — με τις ρυθμίσεις του
 * ανθρώπου **τώρα**, με **μία** ανάγνωση για όλους τους παραλήπτες του περάσματος.
 */
export async function gateQueuedEmails(
  pending: readonly PendingEmail[],
  load: SettingsLoader = loadUserNotificationSettingsMany,
  asking: HolidayQuestionLoader = loadAskingHolidayQuestions,
  unread: NetworkUnreadLoader = loadPendingNetworkUnread,
): Promise<QueueGateResult> {
  const userIds = pending.map(judgedRecipientOf).filter((id): id is string => id !== null);
  const questions = pending.flatMap(({ facts }) => (facts?.kind === 'holiday-hours-question' ? [facts] : []));
  const threads = pending.map(networkUnreadRefOf).filter((ref): ref is NetworkUnreadRef => ref !== null);
  const [settingsByUser, stillAsking, pendingUnread] = await Promise.all([
    userIds.length > 0 ? load(userIds) : new Map<string, UserNotificationSettings>(),
    questions.length > 0 ? asking(questions) : new Set<string>(),
    threads.length > 0 ? unread(threads) : new Set<string>(),
  ]);

  const answers: FactAnswers = { asking: stillAsking, pendingUnread };
  const deliverable: PendingEmail[] = [];
  const suppressed: SuppressedEmail[] = [];
  for (const message of pending) {
    const reason = questionSuppressionOf(message, answers) ?? suppressionOf(message, settingsByUser);
    if (reason === null) deliverable.push(message);
    else suppressed.push({ message, reason });
  }
  return { deliverable, suppressed };
}

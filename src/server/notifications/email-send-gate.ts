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
import { emailSuppressionReason, type SuppressReason } from '@/server/notifications/email-delivery-window';
import type { PendingEmail } from '@/server/notifications/email-digest';
import { loadUserNotificationSettingsMany } from '@/server/notifications/user-notification-settings-store';
import type { UserNotificationSettings } from '@/services/user-notification-settings/user-notification-settings.types';
import { MESSAGE_CATEGORIES, MESSAGE_PRIORITIES } from '@/types/communications';
import { holidayQuestionFactsKey, type HolidayQuestionFactsRef } from '@/types/notification-email-facts';

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

/** Το μήνυμα ρωτά κάτι που **δεν** περιμένει πια απάντηση; */
function questionSuppressionOf(message: PendingEmail, asking: ReadonlySet<string>): SuppressReason | null {
  return message.facts !== undefined && !asking.has(holidayQuestionFactsKey(message.facts)) ? 'question-settled' : null;
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
): Promise<QueueGateResult> {
  const userIds = pending.map(judgedRecipientOf).filter((id): id is string => id !== null);
  const questions = pending.flatMap(({ facts }) => (facts === undefined ? [] : [facts]));
  const [settingsByUser, stillAsking] = await Promise.all([
    userIds.length > 0 ? load(userIds) : new Map<string, UserNotificationSettings>(),
    questions.length > 0 ? asking(questions) : new Set<string>(),
  ]);

  const deliverable: PendingEmail[] = [];
  const suppressed: SuppressedEmail[] = [];
  for (const message of pending) {
    const reason = questionSuppressionOf(message, stillAsking) ?? suppressionOf(message, settingsByUser);
    if (reason === null) deliverable.push(message);
    else suppressed.push({ message, reason });
  }
  return { deliverable, suppressed };
}

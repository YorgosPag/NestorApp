/**
 * =============================================================================
 * ΤΟ ΣΚΕΛΟΣ EMAIL ΜΙΑΣ ΕΙΔΟΠΟΙΗΣΗΣ — ADR-777 §8.23
 * =============================================================================
 *
 * Χωριστό από τον `notification-orchestrator` για δύο λόγους, και ο δεύτερος
 * είναι ο σοβαρός:
 *
 * 1. **Μέγεθος** — ο orchestrator ήταν ήδη στις 390 γραμμές (N.7.1: όριο 500).
 * 2. 🔑 **Το σκέλος email είχε ΤΕΣΣΕΡΑ ανεξάρτητα σπασίματα** και όσο ζούσε ως
 *    δώδεκα γραμμές στο τέλος μιας μεγάλης συνάρτησης, **κανένα δεν φαινόταν**.
 *    Ένα πράγμα που έχει τέσσερις τρόπους να αποτύχει σιωπηλά αξίζει δικό του
 *    αρχείο, δικό του συμβόλαιο και δικές του άγκυρες.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΑ ΤΕΣΣΕΡΑ ΣΠΑΣΙΜΑΤΑ — ΜΕΤΡΗΜΕΝΑ 2026-08-19, ΟΧΙ ΥΠΟΘΕΤΙΚΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ζωντανή μέτρηση στη βάση παραγωγής: **77 ειδοποιήσεις** μέσα στην εφαρμογή,
 * **μηδέν** εξερχόμενα μηνύματα email. Η συλλογή `messages` έχει **4** έγγραφα
 * και **όλα** είναι *εισερχόμενα* Instagram, με εντελώς άλλο σχήμα.
 *
 * | # | Σπάσιμο | Απόδειξη |
 * |---|---|---|
 * | **Α** | Το `to` έπαιρνε **`recipientId`**, δηλαδή **userId**, όχι διεύθυνση | `to: recipientId` στον orchestrator· τα `users/{uid}` έχουν το `email` σε χωριστό πεδίο |
 * | **Β** | Το αποτέλεσμα του `enqueueMessage` **αγνοούνταν** | `await enqueueMessage(params);` — χωρίς ανάθεση. Η συνάρτηση επιστρέφει `{success:false}` όταν λείπει η Firestore, **χωρίς να πετά** |
 * | **Γ** | **Καμία** διεργασία δεν αδειάζει την ουρά | `grep` για καταναλωτή του `messages` με `status:'pending'` ⇒ **0** |
 * | **Δ** | Ο μόνος υποψήφιος αποστολέας διαβάζει **άλλη συλλογή** | `EmailAdapter.processEmailJob` διαβάζει `COLLECTIONS.COMMUNICATIONS`· το `enqueueMessage` γράφει `COLLECTIONS.MESSAGES`. Και έχει **μηδέν καλούντες** σε όλο το repo |
 *
 * ⚠️ **Αυτό το αρχείο κλείνει τα Α και Β.** Τα Γ και Δ είναι ο **αγωγός**: ζουν
 * στο `lib/cron/jobs/outbound-email-flush.job.ts`.
 *
 * 🔶 **Δηλωμένο όριο**: το σκέλος email αφορά **και τα 29** συμβάντα
 * ειδοποίησης, όχι μόνο τη ζήτηση ακινήτων. Η διόρθωση εδώ είναι **οριζόντια**
 * και σκόπιμα δεν ειδικεύεται στο ADR-777.
 *
 * @module server/notifications/notification-email-leg
 * @see ADR-777 §8.23
 * @see ADR-026 — orchestrator ειδοποιήσεων
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { MESSAGE_PRIORITIES } from '@/config/notification-events';
import { resolveHumanLanguage } from '@/i18n/languages';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';
import {
  COMMUNICATION_CHANNELS,
  MESSAGE_CATEGORIES,
  enqueueMessage,
  type EnqueueMessageParams,
} from '@/server/comms/orchestrator';
import { decideEmailDelivery } from '@/server/notifications/email-delivery-window';
import type { UserNotificationSettings } from '@/services/user-notification-settings/user-notification-settings.types';

const logger = createModuleLogger('NotificationEmailLeg');

/**
 * Τι απέγινε το email. **Πέντε ρητές καταστάσεις, κλειστό σύνολο.**
 *
 * ⚠️ **Ποτέ boolean.** Το «δεν έφυγε email» έχει πέντε εντελώς διαφορετικές
 * σημασίες — από «ο άνθρωπος το έκλεισε» (σωστό) μέχρι «δεν ξέρουμε πού να το
 * στείλουμε» (σφάλμα) — και η προηγούμενη υλοποίηση τις έδινε **όλες** ως
 * σιωπή.
 */
export type EmailLegOutcome =
  /** Μπήκε στην ουρά για άμεση αποστολή. */
  | { readonly kind: 'queued'; readonly messageIds: readonly string[] }
  /** Μπήκε στην ουρά με ώρα παράδοσης στο μέλλον (παράθυρο ή ησυχία). */
  | { readonly kind: 'scheduled'; readonly messageIds: readonly string[]; readonly deliverAt: Date }
  /** Ο χρήστης το έχει κλείσει — **επιλογή ανθρώπου**, όχι σφάλμα. */
  | { readonly kind: 'suppressed'; readonly reason: string }
  /** 🔴 Δεν βρέθηκε διεύθυνση για τον παραλήπτη — **σφάλμα**, όχι σιωπή. */
  | { readonly kind: 'no-address'; readonly recipientId: string }
  /** 🔴 Η ουρά απέρριψε το μήνυμα. Ήταν **εντελώς αόρατο** πριν. */
  | { readonly kind: 'enqueue-failed'; readonly errors: readonly string[] };

/**
 * Η διεύθυνση email ενός χρήστη.
 *
 * ⚠️ **Fail-closed**: `null` όταν δεν υπάρχει έγγραφο ή λείπει το πεδίο. Ο
 * καλών **οφείλει** να το χειριστεί ρητά — η προηγούμενη συμπεριφορά έβαζε το
 * `userId` στο πεδίο `to` και το μήνυμα ταξίδευε φαινομενικά κανονικά προς μια
 * διεύθυνση που δεν υπάρχει.
 */
export async function resolveRecipientEmail(recipientId: string): Promise<string | null> {
  const snapshot = await getAdminFirestore()
    .collection(COLLECTIONS.USERS)
    .doc(recipientId)
    .get();

  if (!snapshot.exists) return null;

  const email = snapshot.data()?.email;
  return typeof email === 'string' && email.includes('@') ? email : null;
}

/** Τι χρειάζεται το σκέλος email για να αποφασίσει και να στείλει. */
export interface EmailLegRequest {
  readonly recipientId: string;
  readonly settings: UserNotificationSettings;
  readonly isMandatory: boolean;
  readonly subject: string;
  readonly content: string;
  readonly dedupeKey: string;
  readonly entityId?: string;
  readonly entityType?: EnqueueMessageParams['entityType'];
  /** Η στιγμή αναφοράς. Δίνεται, ώστε η απόφαση να είναι δοκιμάσιμη. */
  readonly now?: Date;
}

/**
 * **Βάλε το email στην ουρά, με τη σωστή διεύθυνση και τη σωστή ώρα.**
 *
 * Δεν στέλνει· γράφει στην ουρά. Η αποστολή ανήκει στον αγωγό
 * (`outbound-email-flush`), γιατί ένα HTTP προς πάροχο email μέσα στη διαδρομή
 * που γεννά την ειδοποίηση θα έδενε τον χρόνο απόκρισης της εφαρμογής με τη
 * διαθεσιμότητα του Mailgun.
 */
export async function queueNotificationEmail(
  request: EmailLegRequest,
): Promise<EmailLegOutcome> {
  const decision = decideEmailDelivery(request.settings, {
    now: request.now ?? new Date(),
    isMandatory: request.isMandatory,
  });

  if (decision.kind === 'suppressed') {
    return { kind: 'suppressed', reason: decision.reason };
  }

  // 🔴 Σπάσιμο Α: το `to` πρέπει να είναι **διεύθυνση**, όχι ταυτότητα χρήστη.
  const address = await resolveRecipientEmail(request.recipientId);
  if (!address) {
    logger.error('Ειδοποίηση χωρίς διεύθυνση email — το μήνυμα ΔΕΝ μπήκε στην ουρά', {
      recipientId: request.recipientId,
      dedupeKey: request.dedupeKey,
    });
    return { kind: 'no-address', recipientId: request.recipientId };
  }

  const params: EnqueueMessageParams = {
    channels: [COMMUNICATION_CHANNELS.EMAIL],
    to: address,
    subject: request.subject,
    content: request.content,
    priority: request.isMandatory ? MESSAGE_PRIORITIES.URGENT : MESSAGE_PRIORITIES.NORMAL,
    category: MESSAGE_CATEGORIES.NOTIFICATION,
    entityType: request.entityType,
    entityId: request.entityId,
    // Το ίδιο κλειδί με πριν: το `dedupeKey` είναι ήδη ντετερμινιστικό ανά
    // (συμβάν, παραλήπτη, γεγονός), άρα δύο περάσματα δεν γεννούν δύο email.
    idempotencyKey: `email:${request.dedupeKey}`,
    // 🔑 Εδώ γίνεται πράξη η απόφαση συχνότητας/ησυχίας. Το πεδίο **υπήρχε ήδη**
    // στο συμβόλαιο της ουράς και δεν το έθετε κανείς.
    ...(decision.kind === 'defer' ? { scheduledAt: decision.deliverAt } : {}),
    // 🌐 §8.29 — **η μόνη θέση στον αγωγό όπου συνυπάρχουν παραλήπτης και
    // ρυθμίσεις του.** Δύο γραμμές πιο πάνω το `request.settings` έκρινε *πότε*
    // φεύγει· εδώ κρίνει *σε ποια γλώσσα*. Ο αποστολέας, δέκα λεπτά αργότερα,
    // βλέπει μόνο διευθύνσεις — γι' αυτό η γλώσσα ταξιδεύει **μαζί** με το μήνυμα
    // αντί να αναζητείται ξανά.
    language: resolveHumanLanguage(request.settings.language),
  };

  const result = await enqueueMessage(params);

  // 🔴 Σπάσιμο Β: πριν, αυτό το αποτέλεσμα **πεταγόταν**. Το `enqueueMessage`
  // επιστρέφει `{success:false}` —**χωρίς να πετάξει**— όταν δεν είναι διαθέσιμη
  // η Firestore ή το κανάλι δεν είναι υλοποιημένο. Δηλαδή η αποτυχία αποστολής
  // ήταν κυριολεκτικά αόρατη, και στα logs και στον καλούντα.
  if (!result.success) {
    logger.error('Η ουρά απέρριψε το email ειδοποίησης', {
      recipientId: request.recipientId,
      dedupeKey: request.dedupeKey,
      data: { errors: (result.errors ?? []).join(' | ') },
    });
    return { kind: 'enqueue-failed', errors: result.errors ?? ['unknown'] };
  }

  return decision.kind === 'defer'
    ? { kind: 'scheduled', messageIds: result.messageIds, deliverAt: decision.deliverAt }
    : { kind: 'queued', messageIds: result.messageIds };
}

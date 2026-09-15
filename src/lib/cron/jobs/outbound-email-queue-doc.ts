/**
 * =============================================================================
 * ΤΟ ΕΓΓΡΑΦΟ ΤΗΣ ΟΥΡΑΣ EMAIL — ανάγνωση (αμυντικά) + σήμανση σίγασης
 * =============================================================================
 *
 * Εξήχθη από το `outbound-email-flush.job.ts` όταν η πύλη της αποστολής (ADR-849)
 * χρειάστηκε χώρο σε αρχείο **499** γραμμών (N.7.1). 🔑 **Κατά ευθύνη, όχι κατά γραμμές**:
 * εδώ ζει η απάντηση στο *«τι σχήμα έχει ένα έγγραφο της ουράς και πώς το διαβάζω χωρίς
 * να το εμπιστευτώ;»*· ο αγωγός κρατά το *«τι κάνω με αυτό;»*.
 *
 * @module lib/cron/jobs/outbound-email-queue-doc
 * @see ADR-777 §8.23 · ADR-848 · ADR-849
 */

import 'server-only';

import { Timestamp } from 'firebase-admin/firestore';

import { emailTextsFor } from '@/server/comms/email-texts';
import type { SuppressReason } from '@/server/notifications/email-delivery-window';
import type { PendingEmail } from '@/server/notifications/email-digest';
import { MESSAGE_CATEGORIES, MESSAGE_PRIORITIES } from '@/types/communications';
import { readNotificationEmailFacts, type NotificationEmailFacts } from '@/types/notification-email-facts';

/** Το σχήμα ενός εξερχόμενου email στην ουρά, όπως το γράφει το `enqueueMessage`. */
interface QueuedEmail {
  readonly to?: unknown;
  readonly subject?: unknown;
  readonly content?: unknown;
  readonly from?: unknown;
  readonly attempts?: unknown;
  readonly maxAttempts?: unknown;
  /** `{ priority, category, ... }` — τα δύο πεδία που κρίνουν τη συνάθροιση. */
  readonly metadata?: unknown;
}

/** Τύπος αρκετά στενός ώστε να μη χρειάζεται το SDK ολόκληρο στα tests. */
export interface FlushableDoc {
  readonly id: string;
  data(): QueuedEmail | undefined;
  readonly ref: {
    update(data: Record<string, unknown>): Promise<unknown>;
  };
}

export function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Το `metadata` ενός εγγράφου ουράς, **αμυντικά**.
 *
 * ⚠️ Οι προεπιλογές δεν είναι διακοσμητικές. Έγγραφο χωρίς `priority` **δεν** είναι
 * επείγον (αλλιώς η απουσία πεδίου θα ακύρωνε τη συνάθροιση για όλους)· έγγραφο
 * χωρίς `category` **δεν** είναι ειδοποίηση (αλλιώς ξένα μηνύματα με δικό τους HTML
 * θα κατέληγαν μέσα σε σύνοψη και το πρότυπό τους θα πεταγόταν).
 */
function queueMetadata(data: QueuedEmail): {
  priority: string;
  category: string;
  language: string | undefined;
  notificationId: string | undefined;
  recipientId: string | undefined;
  eventType: string | undefined;
  facts: NotificationEmailFacts | undefined;
} {
  const raw = typeof data.metadata === 'object' && data.metadata !== null
    ? (data.metadata as Record<string, unknown>)
    : {};
  return {
    priority: asString(raw.priority) ?? MESSAGE_PRIORITIES.NORMAL,
    category: asString(raw.category) ?? MESSAGE_CATEGORIES.TRANSACTIONAL,
    // 🌐 §8.29 — **καμία προεπιλογή εδώ, επίτηδες.** Τα δύο από πάνω παίρνουν
    // προεπιλογή γιατί κρίνουν *αν* συναθροίζεται το μήνυμα· η γλώσσα κρίνει *τι
    // λέει*, και η στένωση ανήκει σε **ένα** σημείο (`resolveHumanLanguage` στον
    // σχεδιαστή). Μια δεύτερη προεπιλογή εδώ θα ήταν σιωπηλή ευκαιρία απόκλισης:
    // αρκεί κάποιος να τη γράψει `'en'` και ο αγωγός θα διαφωνούσε με τον σχεδιαστή.
    language: asString(raw.language) ?? undefined,
    // 🔗 ADR-848 — γεγονότα για τον φάκελο· απουσία (παλιά έγγραφα) ⇒ email όπως πριν.
    notificationId: asString(raw.notificationId) ?? undefined,
    recipientId: asString(raw.recipientId) ?? undefined,
    // 📧 ADR-849 — ο τύπος, για την πύλη της αποστολής· απουσία ⇒ μόνο καθολικοί έλεγχοι.
    eventType: asString(raw.eventType) ?? undefined,
    // ADR-841 Α21.21 Φάση Β — γεγονότα για κουμπιά ενέργειας· σκουπίδι ή απουσία ⇒ email χωρίς κουμπιά, ποτέ σφάλμα.
    facts: readNotificationEmailFacts(raw.facts),
  };
}

/** Το έγγραφο ουράς στη μορφή που κρίνουν η πύλη και ο σχεδιαστής συνάθροισης. */
export function toPendingEmail(doc: FlushableDoc): PendingEmail {
  const data = doc.data() ?? {};
  const meta = queueMetadata(data);
  return {
    id: doc.id,
    to: asString(data.to) ?? '',
    // 🌐 §8.29: ήταν σκληρογραμμένο `'Ειδοποίηση'`. Ακολουθεί τη γλώσσα του
    // **ίδιου** του μηνύματος, όχι μια καθολική επιλογή.
    subject: asString(data.subject) ?? emailTextsFor(meta.language).fallbackSubject,
    content: asString(data.content) ?? '',
    priority: meta.priority,
    category: meta.category,
    language: meta.language,
    notificationId: meta.notificationId,
    recipientId: meta.recipientId,
    eventType: meta.eventType,
    ...(meta.facts ? { facts: meta.facts } : {}),
  };
}

/**
 * **Ο άνθρωπος το σταμάτησε αφού μπήκε στην ουρά** (ADR-849) ⇒ `cancelled` με λόγο.
 *
 * ⚠️ **`cancelled`, όχι `failed`**: δεν απέτυχε τίποτα — είναι επιλογή ανθρώπου, και ένα
 * `failed` θα φούσκωνε τη μέτρηση dead-letter με μηνύματα που **σωστά** δεν έφυγαν. Και
 * **όχι διαγραφή**: το «γιατί δεν μου ήρθε;» πρέπει να απαντιέται από τη βάση.
 */
export async function markSuppressed(doc: FlushableDoc, reason: SuppressReason): Promise<void> {
  await doc.ref.update({
    status: 'cancelled',
    suppressedReason: reason,
    updatedAt: Timestamp.now(),
  });
}

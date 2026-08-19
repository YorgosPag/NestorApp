/**
 * =============================================================================
 * JOB: outbound-email-flush — **ΤΟ EMAIL ΦΕΥΓΕΙ ΟΝΤΩΣ** (ADR-777 §8.23)
 * =============================================================================
 *
 * 🔴 **Η ΟΥΡΑ ΕΞΕΡΧΟΜΕΝΩΝ ΔΕΝ ΑΔΕΙΑΖΕ ΑΠΟ ΚΑΝΕΝΑΝ. ΠΟΤΕ.**
 *
 * Το `enqueueMessage` γράφει έγγραφο στο `messages` με `status: 'pending'` και
 * τελειώνει. Μετρημένο 2026-08-19, με τρία ανεξάρτητα μέτρα:
 *
 * 1. `grep` για καταναλωτή που διαβάζει `messages` με `status:'pending'` και
 *    στέλνει ⇒ **μηδέν**.
 * 2. Ο μόνος υποψήφιος, `EmailAdapter.processEmailJob`, έχει **μηδέν καλούντες**
 *    σε ολόκληρο το repo — **και** διαβάζει `COLLECTIONS.COMMUNICATIONS`, ενώ το
 *    `enqueueMessage` γράφει `COLLECTIONS.MESSAGES`. Δύο διαφορετικές συλλογές.
 * 3. **Ζωντανή βάση**: `notifications` = **77** έγγραφα · εξερχόμενα email = **0**.
 *    Τα 4 έγγραφα του `messages` είναι *εισερχόμενα* Instagram, άλλο σχήμα.
 *
 * Δηλαδή κάθε ειδοποίηση με email έφτανε μέχρι μια εγγραφή που κανείς δεν
 * διάβαζε. Δεν ήταν σφάλμα του ADR-777 — αφορά **και τα 29** συμβάντα
 * ειδοποίησης, και είναι προϋπάρχον. Το ADR-777 απλώς ήταν το πρώτο που
 * **ρώτησε** αν το email φτάνει σε άνθρωπο.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΓΙΑΤΙ ΟΥΡΑ ΚΑΙ ΟΧΙ ΑΜΕΣΗ ΑΠΟΣΤΟΛΗ — και πού ξεπερνάμε τους μεγάλους
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η άμεση αποστολή μέσα στη διαδρομή που γεννά την ειδοποίηση θα έδενε τον χρόνο
 * απόκρισης της εφαρμογής με τη διαθεσιμότητα του Mailgun, και μια πεσμένη
 * σύνδεση θα **έχανε το γεγονός σιωπηλά**. Οι πλατφόρμες το λύνουν με ουρά και
 * **at-least-once** παράδοση — και φοβούνται τις επαναλήψεις, γιατί ο
 * καταναλωτής τους δεν είναι ιδεμποτής.
 *
 * 🔑 **Εμείς έχουμε ήδη το δύσκολο μισό**: ο καταναλωτής είναι **ιδεμποτής εκ
 * κατασκευής** σε **δύο** επίπεδα — το `dedupeKey` της ειδοποίησης (ατομικό
 * `create()`) και η **ζώνη** της ανακοίνωσης (`1·3·8·20·50`). Άρα το at-least-once
 * δεν μας βλάπτει: μια διπλή εκτέλεση δεν παράγει δεύτερο email.
 *
 * ⚠️ **ΤΡΕΙΣ ΡΗΤΕΣ ΚΑΤΑΛΗΞΕΙΣ, ΠΟΤΕ «απέτυχε»**: `sent` · `retrying` ·
 * `dead-lettered`. Ένα μήνυμα που εξάντλησε τις προσπάθειές του **δεν διαγράφεται
 * και δεν μένει pending για πάντα** — παίρνει `status: 'failed'` με τον λόγο, ώστε
 * να είναι **ευρέσιμο**. Ουρά χωρίς dead-letter είναι ουρά που κρύβει τα θύματά της.
 *
 * @module lib/cron/jobs/outbound-email-flush
 * @see ADR-777 §8.23
 * @see ADR-740 — το πρόγραμμα ζει στο src/config/cron-schedule.ts
 */

import 'server-only';

import { Timestamp } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';
import { EmailAdapter } from '@/server/comms/email-adapter';
import type { CronJobResult } from '@/types/cron-schedule';

const logger = createModuleLogger('CronOutboundEmailFlush');

/**
 * Πόσα μηνύματα ανά πέρασμα.
 *
 * Ο αγωγός τρέχει κάθε 5 λεπτά, άρα 50/πέρασμα = 14.400/ημέρα — πολλαπλάσιο κάθε
 * ρεαλιστικού όγκου. Το batching κάνει το job **επαναληπτικό**: ό,τι δεν προλάβει
 * τώρα, το παίρνει στο επόμενο πέρασμα, χωρίς να κρατά ανοιχτή σύνδεση για ώρα.
 */
export const MAX_FLUSH_PER_RUN = 50;

/** Τι απέγινε το πέρασμα. **Κλειστή λογιστική** — κάθε μήνυμα σε έναν κάδο. */
export interface FlushReport {
  /** Παραδόθηκε στον πάροχο. */
  readonly sent: number;
  /** Απέτυχε, αλλά **έχει ακόμη προσπάθειες** — μένει `pending`. */
  readonly retrying: number;
  /** Εξάντλησε τις προσπάθειες ⇒ `failed` **με λόγο**, ώστε να είναι ευρέσιμο. */
  readonly deadLettered: number;
  /** Πόσα εξετάστηκαν. */
  readonly considered: number;
  /** `true` όταν αγγίχθηκε το {@link MAX_FLUSH_PER_RUN}. */
  readonly truncated: boolean;
}

/** Κλείνει το άθροισμα; Υπάρχει **για να αποτύχει θορυβωδώς**. */
export function flushReportBalances(report: FlushReport): boolean {
  return report.sent + report.retrying + report.deadLettered === report.considered;
}

/** Το σχήμα ενός εξερχόμενου email στην ουρά, όπως το γράφει το `enqueueMessage`. */
interface QueuedEmail {
  readonly to?: unknown;
  readonly subject?: unknown;
  readonly content?: unknown;
  readonly from?: unknown;
  readonly attempts?: unknown;
  readonly maxAttempts?: unknown;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * **Άδειασε την ουρά εξερχομένων email.**
 *
 * ⚠️ **Η αναζήτηση σέβεται το `scheduledAt`** — εκεί γίνεται πράξη η πολιτική
 * παραθύρου/ησυχίας (`email-delivery-window.ts`). Χωρίς αυτόν τον όρο, ένα
 * μήνυμα προγραμματισμένο για τις 20:00 θα έφευγε στο επόμενο πέρασμα, και όλη
 * η πολιτική θα ήταν διακοσμητική.
 */
export async function runOutboundEmailFlush(): Promise<CronJobResult> {
  const db = getAdminFirestore();
  const now = Timestamp.now();

  // tenant-scope-exempt: ο αγωγός είναι **συστημική** διεργασία που παραδίδει
  // αλληλογραφία για ΟΛΟΥΣ τους μισθωτές· ένα φίλτρο `companyId` εδώ θα σήμαινε
  // ότι τα μηνύματα κάθε άλλης εταιρείας δεν φεύγουν ποτέ. Η απομόνωση μισθωτή
  // επιβλήθηκε **όταν γράφτηκε** το μήνυμα (ο παραλήπτης ορίστηκε από τον
  // orchestrator ειδοποιήσεων)· εδώ δεν επιλέγεται παραλήπτης, μόνο παραδίδεται.
  const snapshot = await db
    .collection(COLLECTIONS.MESSAGES)
    .where('channel', '==', 'email')
    .where('status', '==', 'pending')
    .where('scheduledAt', '<=', now)
    .orderBy('scheduledAt', 'asc')
    .limit(MAX_FLUSH_PER_RUN)
    .get();

  const adapter = new EmailAdapter();
  let sent = 0;
  let retrying = 0;
  let deadLettered = 0;

  for (const doc of snapshot.docs) {
    const outcome = await deliverOne(adapter, doc);
    if (outcome === 'sent') sent += 1;
    else if (outcome === 'retrying') retrying += 1;
    else deadLettered += 1;
  }

  const report: FlushReport = {
    sent,
    retrying,
    deadLettered,
    considered: snapshot.size,
    truncated: snapshot.size === MAX_FLUSH_PER_RUN,
  };

  // 🔴 Άγνωστη κατάσταση ⇒ σφάλμα **με όνομα**, ποτέ σιωπηλή απώλεια κάδου.
  if (!flushReportBalances(report)) {
    throw new Error(
      `outbound-email-flush: ασυνεπής λογιστική — ${report.sent}+${report.retrying}+` +
        `${report.deadLettered} ≠ ${report.considered}`,
    );
  }

  if (report.deadLettered > 0) {
    logger.error('Μηνύματα εξάντλησαν τις προσπάθειες — δες status:failed στο messages', {
      data: { deadLettered: String(report.deadLettered) },
    });
  }

  return {
    summary:
      `sent ${report.sent}, retrying ${report.retrying}, dead-lettered ${report.deadLettered} ` +
      `(considered ${report.considered}${report.truncated ? ', TRUNCATED' : ''})`,
    metrics: {
      sent: report.sent,
      retrying: report.retrying,
      deadLettered: report.deadLettered,
      considered: report.considered,
      truncated: report.truncated ? 1 : 0,
    },
  };
}

/** Τι απέγινε **ένα** μήνυμα. Ονομασμένο, ποτέ boolean. */
type DeliveryOutcome = 'sent' | 'retrying' | 'dead-lettered';

/** Τύπος αρκετά στενός ώστε να μη χρειάζεται το SDK ολόκληρο στα tests. */
interface FlushableDoc {
  readonly id: string;
  data(): QueuedEmail | undefined;
  readonly ref: {
    update(data: Record<string, unknown>): Promise<unknown>;
  };
}

/**
 * Μία παράδοση.
 *
 * ⚠️ **Το `attempts` αυξάνεται ΠΡΙΝ την αποστολή.** Αν αυξανόταν μετά, μια
 * κατάρρευση στη μέση θα άφηνε το μήνυμα με τον παλιό μετρητή — και ο επόμενος
 * γύρος θα το ξαναδοκίμαζε επ' άπειρον, χωρίς ποτέ να φτάσει στο dead-letter.
 */
async function deliverOne(
  adapter: EmailAdapter,
  doc: FlushableDoc,
): Promise<DeliveryOutcome> {
  const data = doc.data() ?? {};
  const attempts = asNumber(data.attempts, 0) + 1;
  const maxAttempts = asNumber(data.maxAttempts, 3);
  const to = asString(data.to);

  // Χωρίς διεύθυνση δεν υπάρχει «επόμενη προσπάθεια» — καμία επανάληψη δεν θα τη
  // γεννήσει. Πάει **κατευθείαν** σε dead-letter αντί να καίει τρεις γύρους.
  if (!to || !to.includes('@')) {
    await doc.ref.update({
      status: 'failed',
      error: 'Μη έγκυρη διεύθυνση παραλήπτη',
      attempts,
      updatedAt: Timestamp.now(),
    });
    return 'dead-lettered';
  }

  await doc.ref.update({ attempts, lastAttemptAt: Timestamp.now() });

  const result = await adapter.sendEmail({
    id: doc.id,
    to,
    subject: asString(data.subject) ?? 'Ειδοποίηση',
    content: asString(data.content) ?? '',
    from: asString(data.from) ?? undefined,
    attempts,
    maxAttempts,
  });

  if (result.success) {
    await doc.ref.update({
      status: 'sent',
      externalId: result.messageId ?? null,
      sentAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return 'sent';
  }

  const error = result.error ?? 'unknown provider error';

  if (attempts >= maxAttempts) {
    await doc.ref.update({
      status: 'failed',
      error,
      updatedAt: Timestamp.now(),
    });
    logger.error('Μήνυμα σε dead-letter', { data: { messageId: doc.id, error } });
    return 'dead-lettered';
  }

  // Μένει `pending`: ο επόμενος γύρος θα το ξαναπιάσει. Δεν γράφεται `status`,
  // ώστε το ερώτημα του αγωγού να το βρίσκει αυτούσιο.
  await doc.ref.update({ error, updatedAt: Timestamp.now() });
  logger.warn('Αποτυχία παράδοσης — θα ξαναδοκιμαστεί', {
    data: { messageId: doc.id, attempts: String(attempts), maxAttempts: String(maxAttempts) },
  });
  return 'retrying';
}

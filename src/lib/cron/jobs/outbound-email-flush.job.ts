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
import { brandedSubject } from '@/server/comms/email-texts';
import {
  sendThroughChain,
  type ChainOutcome,
  type EmailProvider,
} from '@/server/comms/email-provider-chain';
import { defaultEmailChain } from '@/server/comms/email-providers';
import {
  planCoversEveryMessage,
  planEmailDelivery,
  type DeliveryPlanEntry,
} from '@/server/notifications/email-digest';
import { gateQueuedEmails } from '@/server/notifications/email-send-gate';
import { digestHeaders, liveEmailLinks, soloEnvelope } from '@/server/notifications/notification-email-envelope';
import type { EmailLinks } from '@/server/notifications/notification-email-render';
import type { CronJobResult } from '@/types/cron-schedule';

import {
  asNumber,
  asString,
  markSuppressed,
  toPendingEmail,
  type FlushableDoc,
} from './outbound-email-queue-doc';

const logger = createModuleLogger('CronOutboundEmailFlush');

/**
 * Πόσα μηνύματα ανά πέρασμα.
 *
 * Ο αγωγός τρέχει κάθε 5 λεπτά, άρα 50/πέρασμα = 14.400/ημέρα — πολλαπλάσιο κάθε
 * ρεαλιστικού όγκου. Το batching κάνει το job **επαναληπτικό**: ό,τι δεν προλάβει
 * τώρα, το παίρνει στο επόμενο πέρασμα, χωρίς να κρατά ανοιχτή σύνδεση για ώρα.
 */
export const MAX_FLUSH_PER_RUN = 50;

/**
 * Τι απέγινε το πέρασμα. **Κλειστή λογιστική** — κάθε **έγγραφο** σε έναν κάδο.
 *
 * ⚠️ **Η μονάδα των τριών πρώτων κάδων είναι το ΕΓΓΡΑΦΟ, όχι το email**, και μετά τη
 * συνάθροιση τα δύο **δεν ταυτίζονται**: τρία έγγραφα σε μία σύνοψη δίνουν `sent: 3`
 * και `emailsSent: 1`. Αν η λογιστική μετρούσε email, το ισοζύγιο θα έσπαγε σε κάθε
 * σύνοψη — και η προφανής «διόρθωση» θα ήταν να χαλαρώσει ο έλεγχος, δηλαδή να
 * σιωπήσει ο μόνος φρουρός που εγγυάται ότι κανένα μήνυμα δεν χάνεται.
 */
export interface FlushReport {
  /** **Έγγραφα** που παραδόθηκαν (μόνα τους ή μέσα σε σύνοψη). */
  readonly sent: number;
  /** Απέτυχε, αλλά **έχει ακόμη προσπάθειες** — μένει `pending`. */
  readonly retrying: number;
  /** Εξάντλησε τις προσπάθειες ⇒ `failed` **με λόγο**, ώστε να είναι ευρέσιμο. */
  readonly deadLettered: number;
  /**
   * 📧 ADR-849 — ο άνθρωπος το σταμάτησε **αφού** μπήκε στην ουρά ⇒ `cancelled` με λόγο.
   * Κάδος **του ισοζυγίου**: έγγραφο που δεν ανήκε πουθενά θα έσπαγε τη λογιστική.
   */
  readonly suppressed: number;
  /** Πόσα **έγγραφα** εξετάστηκαν. */
  readonly considered: number;
  /** Πόσα **email** έφυγαν πραγματικά προς τον πάροχο. **Εκτός ισοζυγίου.** */
  readonly emailsSent: number;
  /** Πόσα **έγγραφα** ταξίδεψαν μέσα σε σύνοψη. Το κέρδος, μετρημένο. */
  readonly digested: number;
  /** `true` όταν αγγίχθηκε το {@link MAX_FLUSH_PER_RUN}. */
  readonly truncated: boolean;
}

/**
 * Κλείνει το άθροισμα; Υπάρχει **για να αποτύχει θορυβωδώς**.
 *
 * ⚠️ Τα `emailsSent`/`digested` **δεν** μπαίνουν στο ισοζύγιο επίτηδες: είναι
 * μετρήσεις **παράδοσης**, όχι κάδοι **εγγράφων**. Ένα άθροισμα που τα περιλάμβανε
 * θα ήταν αριθμητικά «σωστό» και σημασιολογικά κενό.
 */
export function flushReportBalances(report: FlushReport): boolean {
  return report.sent + report.retrying + report.deadLettered + report.suppressed === report.considered;
}

// 🔗 ADR-849 — το σχήμα του εγγράφου της ουράς και η αμυντική ανάγνωσή του ζουν στο
// `outbound-email-queue-doc.ts` (εξαγωγή κατά ευθύνη, N.7.1).

/**
 * **Άδειασε την ουρά εξερχομένων email.**
 *
 * ⚠️ **Η αναζήτηση σέβεται το `scheduledAt`** — εκεί γίνεται πράξη η πολιτική
 * παραθύρου/ησυχίας (`email-delivery-window.ts`). Χωρίς αυτόν τον όρο, ένα
 * μήνυμα προγραμματισμένο για τις 20:00 θα έφευγε στο επόμενο πέρασμα, και όλη
 * η πολιτική θα ήταν διακοσμητική.
 */
export async function runOutboundEmailFlush(
  chain: readonly EmailProvider[] = defaultEmailChain(),
): Promise<CronJobResult> {
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

  const report = await executePlan(chain, snapshot.docs, snapshot.size);

  // 🔴 Άγνωστη κατάσταση ⇒ σφάλμα **με όνομα**, ποτέ σιωπηλή απώλεια κάδου.
  if (!flushReportBalances(report)) {
    throw new Error(
      `outbound-email-flush: ασυνεπής λογιστική — ${report.sent}+${report.retrying}+` +
        `${report.deadLettered}+${report.suppressed} ≠ ${report.considered}`,
    );
  }

  if (report.deadLettered > 0) {
    logger.error('Μηνύματα εξάντλησαν τις προσπάθειες — δες status:failed στο messages', {
      data: { deadLettered: String(report.deadLettered) },
    });
  }

  return {
    summary:
      `sent ${report.sent}, retrying ${report.retrying}, dead-lettered ${report.deadLettered}, ` +
      `suppressed ${report.suppressed} ` +
      `(considered ${report.considered}${report.truncated ? ', TRUNCATED' : ''}; ` +
      `${report.emailsSent} email, ${report.digested} σε σύνοψη)`,
    metrics: {
      sent: report.sent,
      retrying: report.retrying,
      deadLettered: report.deadLettered,
      suppressed: report.suppressed,
      considered: report.considered,
      emailsSent: report.emailsSent,
      digested: report.digested,
      truncated: report.truncated ? 1 : 0,
    },
  };
}

/**
 * **Σχεδίασε και εκτέλεσε.**
 *
 * Δύο βήματα, σκόπιμα χωριστά: το **τι** (καθαρή συνάρτηση, `email-digest.ts`) και
 * το **πώς** (εδώ, με I/O). Η απόφαση συνάθροισης είναι δοκιμάσιμη εξαντλητικά
 * χωρίς Firestore· η εκτέλεση δοκιμάζεται με mock έγγραφα.
 */
async function executePlan(
  chain: readonly EmailProvider[],
  docs: readonly FlushableDoc[],
  considered: number,
): Promise<FlushReport> {
  const byId = new Map(docs.map((doc) => [doc.id, doc]));
  const tally: Tally = { sent: 0, retrying: 0, deadLettered: 0, suppressed: 0, emailsSent: 0, digested: 0 };

  // 📧 ADR-849 — Η ΘΕΛΗΣΗ ΤΟΥ ΑΝΘΡΩΠΟΥ **ΤΩΡΑ**, όχι τη στιγμή της ουράς: «Διακοπή» στις
  // 15:00 ⇒ καμία σύνοψη στις 20:00. Αποτυχία ανάγνωσης ρυθμίσεων ⇒ ρίχνει **πριν**
  // αγγιχτεί οτιδήποτε, και όλα μένουν `pending` για το επόμενο πέρασμα.
  const gate = await gateQueuedEmails(docs.map(toPendingEmail));
  for (const { message, reason } of gate.suppressed) {
    const doc = byId.get(message.id);
    if (!doc) continue; // αδύνατο· αν συνέβαινε, το ισοζύγιο θα το κατήγγελλε
    await markSuppressed(doc, reason);
    tally.suppressed += 1;
  }

  // 🔗 ADR-848 — οι σύνδεσμοι λύνονται ΜΙΑ φορά ανά πέρασμα, από το origin ΤΩΡΑ.
  const links = liveEmailLinks();
  const plan = planEmailDelivery(gate.deliverable, links);

  // 🔴 Μήνυμα εκτός πλάνου **δεν αποτυγχάνει** — μένει `pending` και ξαναδοκιμάζεται
  // αιώνια, χωρίς κανείς να το μάθει. Ο έλεγχος τρέχει **πριν** αγγιχτεί πάροχος.
  if (!planCoversEveryMessage(plan, gate.deliverable)) {
    throw new Error(
      `outbound-email-flush: το πλάνο δεν καλύπτει και τα ${gate.deliverable.length} μηνύματα`,
    );
  }

  for (const entry of plan) {
    await runPlanEntry(chain, entry, byId, tally, links);
  }

  return { ...tally, considered, truncated: considered === MAX_FLUSH_PER_RUN };
}

/** Ό,τι μετρά ένα πέρασμα, σε μεταβλητή μορφή. */
type Tally = {
  sent: number;
  retrying: number;
  deadLettered: number;
  suppressed: number;
  emailsSent: number;
  digested: number;
};

/** Εκτελεί **μία** γραμμή του πλάνου και χρεώνει τους κάδους. */
async function runPlanEntry(
  chain: readonly EmailProvider[],
  entry: DeliveryPlanEntry,
  byId: ReadonlyMap<string, FlushableDoc>,
  tally: Tally,
  links: EmailLinks,
): Promise<void> {
  const members = entry.kind === 'solo' ? [entry.message] : entry.members;
  const docs = members.map((member) => byId.get(member.id)).filter(isDoc);

  const outcomes = entry.kind === 'solo'
    ? [await deliverOne(chain, docs[0], links)]
    : await deliverDigest(chain, entry, docs, links);

  // Ένα email έφυγε μόνο αν κάτι παραδόθηκε· οι δύο άλλες καταλήξεις δεν άγγιξαν
  // τον πάροχο επιτυχώς και δεν επιτρέπεται να μετρηθούν ως παράδοση.
  if (outcomes.some((outcome) => outcome === 'sent')) tally.emailsSent += 1;
  if (entry.kind === 'digest') tally.digested += docs.length;

  for (const outcome of outcomes) {
    if (outcome === 'sent') tally.sent += 1;
    else if (outcome === 'retrying') tally.retrying += 1;
    else tally.deadLettered += 1;
  }
}

/** Φρουρός τύπου· η αστοχία του θα σήμαινε ότι το πλάνο επινόησε ταυτότητα. */
function isDoc(doc: FlushableDoc | undefined): doc is FlushableDoc {
  return doc !== undefined;
}

/** Τι απέγινε **ένα** μήνυμα. Ονομασμένο, ποτέ boolean. */
type DeliveryOutcome = 'sent' | 'retrying' | 'dead-lettered';

/**
 * **Μία σύνοψη: ένα email, πολλά έγγραφα.**
 *
 * ⚠️ **Η αποτυχία κρίνεται ΑΝΑ ΕΓΓΡΑΦΟ, όχι ανά email**, και αυτό δεν είναι
 * λεπτομέρεια: τα μέλη μιας σύνοψης μπορεί να έχουν **διαφορετικό** `maxAttempts`
 * (το `enqueueMessage` το παράγει από την προτεραιότητα). Ένας κοινός μετρητής θα
 * έστελνε το πιο ανεκτικό μήνυμα σε dead-letter μαζί με το πιο αυστηρό — ή, χειρότερα,
 * θα κρατούσε ζωντανό ένα μήνυμα που είχε ήδη εξαντληθεί.
 *
 * ⚠️ **Το `attempts` αυξάνεται ΠΡΙΝ την αποστολή, σε ΟΛΑ.** Ίδιος λόγος με τη
 * μεμονωμένη παράδοση: κατάρρευση στη μέση δεν επιτρέπεται να αφήσει μετρητή πίσω.
 */
async function deliverDigest(
  chain: readonly EmailProvider[],
  entry: Extract<DeliveryPlanEntry, { kind: 'digest' }>,
  docs: readonly FlushableDoc[],
  links: EmailLinks,
): Promise<readonly DeliveryOutcome[]> {
  if (!entry.to.includes('@')) {
    return Promise.all(docs.map((doc) => failInvalidAddress(doc)));
  }

  const attemptsById = new Map<string, number>();
  for (const doc of docs) {
    const attempts = asNumber((doc.data() ?? {}).attempts, 0) + 1;
    attemptsById.set(doc.id, attempts);
    await doc.ref.update({ attempts, lastAttemptAt: Timestamp.now() });
  }

  // 🔗 ADR-848 — RFC 8058, μόνο αν όλα τα μέλη ανήκουν στον ΙΔΙΟ άνθρωπο.
  const headers = digestHeaders(entry, links);
  const outcome = await sendThroughChain(chain, {
    to: entry.to,
    // 🔑 §8.54 — **μία** υπογραφή για ολόκληρη τη σύνοψη. Πριν, το «— ΝΕΣΤΩΡ»
    // ερχόταν από τους παραγωγούς και επαναλαμβανόταν σε **κάθε γραμμή** του σώματος.
    subject: brandedSubject(entry.subject),
    text: entry.content,
    html: entry.html,
    ...(headers ? { headers } : {}),
  });

  return Promise.all(
    docs.map((doc) =>
      settleOne(doc, outcome, attemptsById.get(doc.id) ?? 1, {
        // 🔑 Το αναγνωριστικό της σύνοψης γράφεται σε **κάθε** μέλος: χωρίς αυτό,
        // το «γιατί δεν έλαβα ξεχωριστό email;» δεν απαντιέται από τη βάση.
        digestOf: entry.to,
        digestSize: docs.length,
        // 🌐 §8.29 — **η διεύθυνση δεν αρκεί πια για ταυτότητα σύνοψης.** Ο ίδιος
        // παραλήπτης μπορεί να λάβει δύο συνόψεις στο ίδιο πέρασμα αν άλλαξε γλώσσα
        // μέσα στη μέρα· χωρίς αυτό το πεδίο, τα έγγραφα των δύο ομάδων είναι
        // δυσδιάκριτα στη βάση και το «γιατί δύο;» δεν απαντιέται.
        digestLanguage: entry.language,
      }),
    ),
  );
}

/** Άκυρη διεύθυνση ⇒ dead-letter αμέσως. Κοινό και για τις δύο διαδρομές. */
async function failInvalidAddress(doc: FlushableDoc): Promise<DeliveryOutcome> {
  await doc.ref.update({
    status: 'failed',
    error: 'Μη έγκυρη διεύθυνση παραλήπτη',
    attempts: asNumber((doc.data() ?? {}).attempts, 0) + 1,
    updatedAt: Timestamp.now(),
  });
  return 'dead-lettered';
}

/**
 * Το αποτέλεσμα της **αλυσίδας**, γραμμένο σε **ένα** έγγραφο.
 *
 * ⚠️ **Η `no-provider` ΔΕΝ καίει προσπάθεια.** Κανείς δεν δοκιμάστηκε: λείπει
 * μεταβλητή περιβάλλοντος, όχι δίκτυο. Αν μετρούσε ως αποτυχία, τρεις γύροι θα
 * έστελναν το μήνυμα σε dead-letter **χωρίς καμία κλήση παρόχου** — και η αναφορά
 * θα έδειχνε «ο πάροχος απέτυχε 3 φορές» για πάροχο που δεν υπάρχει.
 */
async function settleOne(
  doc: FlushableDoc,
  outcome: ChainOutcome,
  attempts: number,
  extra: Record<string, unknown> = {},
): Promise<DeliveryOutcome> {
  if (outcome.kind === 'delivered') {
    await doc.ref.update({
      status: 'sent',
      externalId: outcome.messageId ?? null,
      // 🔑 **Ποιος** το παρέδωσε — χωρίς αυτό, μια σιωπηλή μετάπτωση δεν αφήνει ίχνος.
      deliveredBy: outcome.provider,
      sentAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      ...extra,
    });
    return 'sent';
  }

  if (outcome.kind === 'no-provider') {
    await doc.ref.update({
      error: 'Κανένας πάροχος email δεν είναι ρυθμισμένος',
      updatedAt: Timestamp.now(),
    });
    logger.error('ΚΑΝΕΝΑΣ πάροχος email — τα μηνύματα μένουν στην ουρά', {
      data: { messageId: doc.id },
    });
    return 'retrying';
  }

  const error = outcome.attempts.map((a) => `${a.provider}: ${a.error}`).join(' | ');
  const maxAttempts = asNumber((doc.data() ?? {}).maxAttempts, 3);

  if (attempts >= maxAttempts) {
    await doc.ref.update({ status: 'failed', error, updatedAt: Timestamp.now() });
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

/**
 * Μία μεμονωμένη παράδοση: ένα έγγραφο, ένα email, το **δικό του** θέμα.
 *
 * ⚠️ **Το `attempts` αυξάνεται ΠΡΙΝ την αποστολή.** Αν αυξανόταν μετά, μια
 * κατάρρευση στη μέση θα άφηνε το μήνυμα με τον παλιό μετρητή — και ο επόμενος
 * γύρος θα το ξαναδοκίμαζε επ' άπειρον, χωρίς ποτέ να φτάσει στο dead-letter.
 *
 * 🔑 **Μοιράζεται τον ίδιο πυρήνα με τη σύνοψη** ({@link settleOne},
 * {@link failInvalidAddress}). Η πρώτη γραφή τα είχε **δύο φορές** — και ένα από τα
 * δύο αντίγραφα θα ήταν εκείνο που θα διορθωνόταν όταν αλλάξει η πολιτική
 * επαναλήψεων. Το CHECK 3.28 το πιάνει· ο κανόνας N.18 λέει «εξαγωγή, ποτέ παράκαμψη».
 */
async function deliverOne(
  chain: readonly EmailProvider[],
  doc: FlushableDoc,
  links: EmailLinks,
): Promise<DeliveryOutcome> {
  const data = doc.data() ?? {};
  const attempts = asNumber(data.attempts, 0) + 1;
  const to = asString(data.to);

  // Χωρίς διεύθυνση δεν υπάρχει «επόμενη προσπάθεια» — καμία επανάληψη δεν θα τη
  // γεννήσει. Πάει **κατευθείαν** σε dead-letter αντί να καίει τρεις γύρους.
  if (!to || !to.includes('@')) return failInvalidAddress(doc);

  await doc.ref.update({ attempts, lastAttemptAt: Timestamp.now() });

  // 🔑 §8.54 + ADR-848 — Ο ΦΑΚΕΛΟΣ σε ΕΝΑ σημείο (`notification-email-envelope`): υπογραφή
  // θέματος · εφεδρεία «κενό σώμα ⇒ το θέμα» (όχι στην ουρά) · σύνδεσμοι · RFC 8058.
  const envelope = soloEnvelope(toPendingEmail(doc), links);
  const outcome = await sendThroughChain(chain, {
    to,
    ...envelope,
    from: asString(data.from) ?? undefined,
  });

  return settleOne(doc, outcome, attempts);
}

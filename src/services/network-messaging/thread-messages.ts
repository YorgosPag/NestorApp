/**
 * @fileoverview **Η ΑΠΟΣΤΟΛΗ, Η ΑΝΑΚΛΗΣΗ, Η ΕΠΕΞΕΡΓΑΣΙΑ, Η ΑΝΑΓΝΩΣΗ, Η ΣΙΓΑΣΗ, ΤΟ «ΑΚΟΛΟΥΘΩ»** —
 * οι πράξεις πάνω σε υπαρκτό νήμα (επεξεργασία + follow: ADR-867 Β7).
 * @related ADR-867 §4.1 · §4.2 · §7 Α1/Α4 · ADR-834 §5 Β (α) ② (σίγαση) · CHECK 3.89
 * @module services/network-messaging/thread-messages
 *
 * 🔑 **ΤΟ ΔΙΚΑΙΩΜΑ ΓΡΑΦΗΣ ΔΕΝ ΞΑΝΑΚΡΙΝΕΤΑΙ ΕΔΩ — ΔΙΑΒΑΖΕΤΑΙ.** Ο κριτής ακμής
 * (`lib/network-edge/edge-judge.ts`) απάντησε **μία** φορά, τη στιγμή που γεννήθηκε το
 * νήμα· από εκεί και πέρα η ερώτηση *«μπορεί να γράψει;»* έχει **αποθηκευμένη** απάντηση:
 * **υπάρχει ζωντανή γραμμή ακροατηρίου;**. Ένας δεύτερος κριτής εδώ θα χρειαζόταν τα
 * τεκμήρια της πράξης σε **κάθε μήνυμα** — δηλαδή θα έκανε το «στείλε» να εξαρτάται από
 * το αν η εντολή είναι ακόμη σε ισχύ, που το (α) ① **απαγορεύει** ρητά.
 *
 * ⚠️ **Η ΓΡΑΦΗ ΤΗΣ ΓΡΑΜΜΗΣ ΑΚΡΟΑΤΗΡΙΟΥ ΔΕΝ ΖΕΙ ΕΔΩ** — ζητιέται από τον
 * `thread-writer.ts` (Κ3 του CHECK 3.89). Εδώ ζει **μόνο** η υποσυλλογή μηνυμάτων.
 */

import 'server-only';

import {
  generateDeterministicNetworkMessageId,
  generateNetworkMessageId,
  generateNetworkMessageRevisionId,
} from '@/services/enterprise-id.service';
import { liveMessageAtOf } from '@/lib/network-messaging/thread-liveness';
import { MAX_NETWORK_MESSAGE_CHARS, type NetworkMessage, type NetworkThread } from '@/types/network-thread';
import type { Firestore as AdminFirestore, Transaction } from 'firebase-admin/firestore';

import {
  currentVersionAt,
  editedMessage,
  judgeEdit,
  revisionRecord,
  type EditRefusal,
} from './message-edit';
import {
  judgeRetraction,
  retractionRecord,
  retractionTombstone,
  wasReadByOthers,
  type RetractionRefusal,
} from './message-retraction';
import {
  networkRetractionRef,
  networkRevisionRef,
  networkThreadMessages,
  networkThreadRef,
} from './network-thread-ref';
import {
  announceNetworkMessage,
  withdrawRetractedEpisodes,
  type NetworkMessageNotice,
  type NetworkRetractionNotice,
} from './network-notifier';
import { isLiveAudience } from './thread-audience';
import {
  readThreadAudience,
  touchOwnAudience,
  writeThreadActivity,
  type AudienceSelfOutcome,
} from './thread-writer';

/** Το ανώτατο μήκος ζει στους **κοινούς** τύπους (Β7): το κρίνει και το πλαίσιο γραφής, με την ίδια τιμή. */
export { MAX_NETWORK_MESSAGE_CHARS };

export type SendRefusal =
  | 'thread-absent'
  | 'thread-closed'
  | 'not-audience'
  | 'empty-text'
  | 'too-long';

export type SendOutcome =
  | { readonly kind: 'sent'; readonly messageId: string }
  | { readonly kind: 'refused'; readonly reason: SendRefusal };

export interface SendNetworkMessageInput {
  readonly threadId: string;
  readonly senderUid: string;
  readonly text: string;
  readonly nowISO: string;
  /**
   * 🔑 **Κλειδί ιδεμποτησίας του πελάτη** (ADR-867 Β7 · Slack `client_msg_id`). Με κλειδί, το id του
   * μηνύματος **παράγεται** από (αποστολέας, κλειδί) ⇒ η επανάληψη της ίδιας αποστολής — χαμένη απάντηση,
   * επανάληψη 5xx του μεταφορέα — βρίσκει το **ίδιο** μήνυμα και **δεν** γράφει ούτε ειδοποιεί δεύτερη φορά.
   * Χωρίς κλειδί (εσωτερικοί καλούντες) ⇒ τυχαίο id, όπως πριν.
   */
  readonly clientKey?: string;
}

/** Το μήνυμα ως έγγραφο — καθαρό, ώστε να ελέγχεται χωρίς Firestore. */
export function networkMessageDocument(
  input: SendNetworkMessageInput,
  messageId: string,
): NetworkMessage {
  return {
    id: messageId,
    senderUid: input.senderUid,
    text: input.text.trim(),
    createdAt: input.nowISO,
    editedAt: null,
    retractedAt: null,
    // ⚠️ `null` = **δεν ανακλήθηκε ποτέ**, ρητά διαφορετικό από `false` (= ανακλήθηκε
    //    και δεν το είχε δει κανείς). Ένα `false` εδώ θα έκανε τα δύο αδιάκριτα.
    readBeforeRetraction: null,
    readBeforeEdit: null,
  };
}

/**
 * 🔑 **Η αποστολή, ΜΕΣΑ σε συναλλαγή** — και οι δύο γραφές ή καμία.
 *
 * ⚠️ **Γιατί συναλλαγή για ένα μήνυμα**: το `lastMessageAt` του νήματος είναι αυτό που
 * ταξινομεί τη λίστα του ανθρώπου. Ένα μήνυμα **χωρίς** ενημέρωση του νήματος θα ήταν
 * μήνυμα που **κανείς δεν βλέπει ότι ήρθε** — και η δεύτερη γραφή σε ξεχωριστή πράξη
 * σημαίνει ότι κάποια στιγμή, κάπου, θα αποτύχει μόνη της.
 *
 * ⚠️ **Ο έλεγχος ακροατηρίου ξαναγίνεται ΜΕΣΑ στη συναλλαγή**: ανάμεσα στην οθόνη και
 * στο «στείλε» μπορεί να έχει σφραγιστεί η γραμμή του (αποχώρηση, μεταβίβαση). Ο κανόνας
 * Firestore **δεν** τον καλύπτει — ο πελάτης δεν γράφει ποτέ εδώ, γράφει ο διακομιστής.
 */
export async function sendNetworkMessage(
  adminDb: AdminFirestore,
  input: SendNetworkMessageInput,
  announce: (adminDb: AdminFirestore, notice: NetworkMessageNotice) => Promise<void> = announceNetworkMessage,
): Promise<SendOutcome> {
  const text = input.text.trim();
  if (text.length === 0) return { kind: 'refused', reason: 'empty-text' };
  if (text.length > MAX_NETWORK_MESSAGE_CHARS) return { kind: 'refused', reason: 'too-long' };

  const result = await commitNetworkMessage(adminDb, { ...input, text });
  // 🔔 ADR-867 Β6 — η ειδοποίηση είναι **παρενέργεια** (N.7.2 #6): **μετά** το commit, ποτέ μέσα στη
  //    συναλλαγή (που μπορεί να ξανατρέξει), με το ακροατήριο που **ήδη** διάβασε. Δεν πετά ποτέ.
  if (result.notice !== null) await announce(adminDb, result.notice);
  return result.outcome;
}

/** Το αποτέλεσμα της συναλλαγής — και ό,τι χρειάζεται η ειδοποίηση (`null` αν δεν στάλθηκε). */
type CommitResult = { readonly outcome: SendOutcome; readonly notice: NetworkMessageNotice | null };

/** Η συναλλαγή της αποστολής — επιστρέφει και ό,τι χρειάζεται η ειδοποίηση, χωρίς δεύτερη ανάγνωση. */
async function commitNetworkMessage(adminDb: AdminFirestore, input: SendNetworkMessageInput): Promise<CommitResult> {
  const { text } = input;
  const threadRef = networkThreadRef(adminDb, input.threadId);
  const messageId = input.clientKey === undefined
    ? generateNetworkMessageId()
    : generateDeterministicNetworkMessageId(input.senderUid, input.clientKey);
  const messageRef = networkThreadMessages(adminDb, input.threadId).doc(messageId);

  return adminDb.runTransaction<CommitResult>(async (transaction) => {
    // 🔑 **ΟΛΟ** το ακροατήριο, όχι μόνο η γραμμή του αποστολέα: το fan-out χρειάζεται κάθε
    //    ζωντανό μέλος, και οι αναγνώσεις πρέπει να προηγούνται **κάθε** γραφής.
    const [threadSnap, audience, existing] = await Promise.all([
      transaction.get(threadRef),
      readThreadAudience(transaction, adminDb, input.threadId),
      transaction.get(messageRef),
    ]);
    // 🔁 Η ΙΔΙΑ αποστολή ξανά ⇒ το ίδιο μήνυμα, **καμία** γραφή, **καμία** δεύτερη ειδοποίηση.
    if (existing.exists) return { outcome: { kind: 'sent', messageId }, notice: null };
    const entry = audience.find((row) => row.uid === input.senderUid) ?? null;

    const refusal = sendRefusal(threadSnap.exists, threadSnap.data(), entry);
    if (refusal !== null) return { outcome: { kind: 'refused', reason: refusal }, notice: null };

    transaction.set(messageRef, networkMessageDocument({ ...input, text }, messageId));
    // 🔑 Ε10: νέο μήνυμα ⇒ και το τελευταίο **ζωντανό** είναι αυτό (`thread-liveness.ts`).
    transaction.update(threadRef, { lastMessageAt: input.nowISO, lastLiveMessageAt: input.nowISO, updatedAt: input.nowISO });
    writeThreadActivity(transaction, adminDb, input.threadId, audience, {
      senderUid: input.senderUid,
      nowISO: input.nowISO,
    });

    const thread = threadSnap.data() as NetworkThread;
    return {
      outcome: { kind: 'sent', messageId },
      notice: { threadId: input.threadId, topic: thread.topic, audience, senderUid: input.senderUid, sentAt: input.nowISO },
    };
  });
}

/** Ο **ένας** τόπος που λέει γιατί δεν φεύγει ένα μήνυμα — `null` σημαίνει «προχώρα». */
function sendRefusal(
  exists: boolean,
  thread: unknown,
  entry: Parameters<typeof isLiveAudience>[0],
): SendRefusal | null {
  if (!exists) return 'thread-absent';
  if ((thread as { readonly state?: string } | undefined)?.state !== 'open') return 'thread-closed';
  // 🔴 **Σφραγισμένη γραμμή = ΟΧΙ**, όχι «παλιό μέλος με δικαίωμα σχολίου». Το ιστορικό
  //    το διαβάζει μόνο όποιος διαβάζει **τώρα** — ίδια ερώτηση με τον κανόνα Firestore.
  if (!isLiveAudience(entry)) return 'not-audience';
  return null;
}

// =============================================================================
// Η ΦΑΣΗ ΑΝΑΓΝΩΣΗΣ ΜΙΑΣ ΠΡΑΞΗΣ ΠΑΝΩ ΣΕ ΥΠΑΡΚΤΟ ΜΗΝΥΜΑ — ΚΟΙΝΗ (ανάκληση · επεξεργασία)
// =============================================================================

/**
 * Νήμα + μήνυμα + **όλο** το ακροατήριο, με **μία** φάση ανάγνωσης, πριν από κάθε γραφή (απαίτηση Firestore).
 * 🔗 Β7 (N.18 / CHECK 3.28): η ανάκληση και η επεξεργασία το έγραφαν η καθεμία — δίδυμα που θα απέκλιναν την
 * ημέρα που η μία αποκτούσε έλεγχο (π.χ. φραγή, Β8) και η άλλη όχι.
 */
async function readMessageSlot(
  transaction: Transaction,
  adminDb: AdminFirestore,
  target: { readonly threadId: string; readonly messageId: string },
) {
  const messageRef = networkThreadMessages(adminDb, target.threadId).doc(target.messageId);
  const [threadSnap, messageSnap, audience] = await Promise.all([
    transaction.get(networkThreadRef(adminDb, target.threadId)),
    transaction.get(messageRef),
    readThreadAudience(transaction, adminDb, target.threadId),
  ]);
  return {
    messageRef,
    thread: threadSnap.exists ? (threadSnap.data() as NetworkThread) : undefined,
    message: messageSnap.data() as NetworkMessage | undefined,
    audience,
  };
}

// =============================================================================
// Η ΑΝΑΚΛΗΣΗ — ΔΥΟ ΕΓΓΡΑΦΑ, ΜΙΑ ΣΥΝΑΛΛΑΓΗ (XEP-0424 · Teams «compliance copy»)
// =============================================================================

export type RetractOutcome =
  | {
      readonly kind: 'retracted';
      /** 🏆 Το πρόλαβε κάποιος; Η απάντηση που κανένας μεγάλος δεν δίνει. */
      readonly readBeforeRetraction: boolean;
    }
  | { readonly kind: 'refused'; readonly reason: RetractionRefusal | 'thread-absent' };

export interface RetractNetworkMessageInput {
  readonly threadId: string;
  readonly messageId: string;
  /** Ποιος ζητά την ανάκληση. **Πρέπει** να είναι ο αποστολέας (XEP-0424). */
  readonly actorUid: string;
  readonly nowISO: string;
}

/**
 * 🔑 **Η ΑΝΑΚΛΗΣΗ: ΤΟ ΚΕΙΜΕΝΟ ΑΛΛΑΖΕΙ ΤΟΠΟ, ΔΕΝ ΧΑΝΕΤΑΙ.**
 *
 * Μία συναλλαγή, **δύο** γραφές: ταφόπλακα στο μήνυμα *(ό,τι διαβάζει ο πελάτης)* και
 * αντίγραφο συμμόρφωσης στο `network_message_retractions` *(ό,τι δεν διαβάζει κανείς)*.
 * ⚠️ **Ή και τα δύο ή κανένα**: μια ταφόπλακα χωρίς αντίγραφο είναι **απώλεια
 * τεκμηρίου**· ένα αντίγραφο χωρίς ταφόπλακα είναι **ανάκληση που δεν έγινε**.
 *
 * ⚠️ **Το ακροατήριο διαβάζεται ΟΛΟΚΛΗΡΟ, και μέσα στη συναλλαγή**: το «το πρόλαβε
 * κάποιος;» πρέπει να απαντηθεί στη **στιγμή** της ανάκλησης. Μια απάντηση από έξω θα
 * μπορούσε να αγνοήσει ανάγνωση που συνέβη ενδιάμεσα — δηλαδή να πει «δεν το είδε
 * κανείς» για μήνυμα που **μόλις** διαβάστηκε.
 *
 * ⛔ **ΚΑΜΙΑ ΣΚΛΗΡΗ ΔΙΑΓΡΑΦΗ, ΠΟΤΕ** — ούτε του μηνύματος, ούτε του αντιγράφου.
 */
export async function retractNetworkMessage(
  adminDb: AdminFirestore,
  input: RetractNetworkMessageInput,
  withdraw: (adminDb: AdminFirestore, notice: NetworkRetractionNotice) => Promise<void> = withdrawRetractedEpisodes,
): Promise<RetractOutcome> {
  const result = await commitRetraction(adminDb, input);
  // 🔔 ADR-867 Ε10 — η απόσυρση είναι **παρενέργεια** (N.7.2 #6), μετά το commit, όπως η ειδοποίηση της
  //    αποστολής. Δεν πετά ποτέ· το email το φρουρεί ούτως ή άλλως η πύλη αποστολής με την ίδια αλήθεια.
  if (result.notice !== null) await withdraw(adminDb, result.notice);
  return result.outcome;
}

/** Η συναλλαγή της ανάκλησης — επιστρέφει και ό,τι χρειάζεται η απόσυρση, χωρίς δεύτερη ανάγνωση. */
async function commitRetraction(
  adminDb: AdminFirestore,
  input: RetractNetworkMessageInput,
): Promise<{ readonly outcome: RetractOutcome; readonly notice: NetworkRetractionNotice | null }> {
  return adminDb.runTransaction(async (transaction) => {
    const { messageRef, thread, message, audience } = await readMessageSlot(transaction, adminDb, input);
    if (thread === undefined) return { outcome: { kind: 'refused', reason: 'thread-absent' }, notice: null };

    const verdict = judgeRetraction(message, input.actorUid, input.nowISO);
    if (verdict.kind === 'refused') return { outcome: { kind: 'refused', reason: verdict.reason }, notice: null };

    const found = message as NetworkMessage;
    const readBefore = wasReadByOthers(found, audience);
    // ⚠️ Ανάγνωση ΠΡΙΝ από κάθε γραφή (απαίτηση Firestore) — και μέσα στη συναλλαγή: μια αποστολή που μπαίνει
    //    ενδιάμεσα αλλάζει το «τελευταίο ζωντανό», και η συναλλαγή τότε ξανατρέχει.
    const liveAt = await nextLiveMessageAt(transaction, adminDb, input.threadId, thread, found);

    transaction.set(messageRef, retractionTombstone(found, input.nowISO, readBefore));
    transaction.set(
      networkRetractionRef(adminDb, input.messageId),
      retractionRecord(found, { threadId: input.threadId, threadKind: thread.topic.kind, nowISO: input.nowISO, readBefore }),
    );
    transaction.update(networkThreadRef(adminDb, input.threadId), { lastLiveMessageAt: liveAt });

    return {
      outcome: { kind: 'retracted', readBeforeRetraction: readBefore },
      notice: { threadId: input.threadId, senderUid: found.senderUid, audience, liveAt, retractedAt: input.nowISO },
    };
  });
}

/** Πόσα μηνύματα ζητά κάθε σελίδα του επανυπολογισμού — σχεδόν πάντα αρκεί η πρώτη. */
const LIVE_SCAN_PAGE = 20;

/**
 * 🔑 **Το τελευταίο ζωντανό μήνυμα ΜΕΤΑ την ανάκληση** (ADR-867 Ε10 · `thread-liveness.ts`).
 *
 * Αν το ανακλημένο **δεν** ήταν το τελευταίο ζωντανό, τίποτα δεν αλλάζει. Αν **ήταν**, ψάχνουμε προς τα πίσω το
 * αμέσως προηγούμενο που ζει — ερώτημα πάνω **μόνο** στο `createdAt` (αυτόματος δείκτης ενός πεδίου, κανένας
 * σύνθετος). ⚠️ `<=` και όχι `<`: ζωντανό μήνυμα στο **ίδιο** χιλιοστό με το ανακλημένο μετράει. ⚠️ Σελιδοποίηση
 * με **δρομέα εγγράφου** (`startAfter`), όχι με τιμή: με τιμή, πολλά μηνύματα στο ίδιο χιλιοστό ξαναφέρνουν την
 * ίδια σελίδα και το ζωντανό χάνεται (μετρημένο: άγκυρα Ζ-6).
 */
async function nextLiveMessageAt(
  transaction: Transaction,
  adminDb: AdminFirestore,
  threadId: string,
  thread: NetworkThread,
  retracted: NetworkMessage,
): Promise<string | null> {
  const liveNow = liveMessageAtOf(thread);
  if (liveNow === null || liveNow > retracted.createdAt) return liveNow;

  const older = networkThreadMessages(adminDb, threadId)
    .where('createdAt', '<=', retracted.createdAt)
    .orderBy('createdAt', 'desc');
  let page = await transaction.get(older.limit(LIVE_SCAN_PAGE));
  for (;;) {
    const live = page.docs
      .map((doc) => doc.data() as NetworkMessage)
      .find((m) => m.id !== retracted.id && m.retractedAt === null);
    if (live !== undefined) return live.createdAt;
    const last = page.docs[page.docs.length - 1];
    if (last === undefined || page.docs.length < LIVE_SCAN_PAGE) return null;
    page = await transaction.get(older.startAfter(last).limit(LIVE_SCAN_PAGE));
  }
}

// =============================================================================
// Η ΕΠΕΞΕΡΓΑΣΙΑ — ΔΥΟ ΕΓΓΡΑΦΑ, ΜΙΑ ΣΥΝΑΛΛΑΓΗ (ADR-867 Β7 · Teams «compliance copy»)
// =============================================================================

export type EditOutcome =
  | { readonly kind: 'edited'; readonly editedAt: string; readonly readBeforeEdit: boolean }
  | { readonly kind: 'unchanged' }
  | { readonly kind: 'refused'; readonly reason: EditRefusal | SendRefusal };

export interface EditNetworkMessageInput {
  readonly threadId: string;
  readonly messageId: string;
  readonly actorUid: string;
  readonly text: string;
  readonly nowISO: string;
}

/**
 * 🔑 **Η ΕΠΕΞΕΡΓΑΣΙΑ: Η ΠΑΛΙΑ ΜΟΡΦΗ ΑΛΛΑΖΕΙ ΤΟΠΟ, ΔΕΝ ΧΑΝΕΤΑΙ** — ίδιο δόγμα με την ανάκληση.
 *
 * Μία συναλλαγή, **δύο** γραφές: νέο σώμα στο μήνυμα *(ό,τι διαβάζει ο πελάτης)* και η **προηγούμενη**
 * μορφή στο `network_message_revisions` *(ό,τι δεν διαβάζει κανείς)*. Ή και τα δύο ή κανένα.
 *
 * ⚠️ **Οι έλεγχοι της ΑΠΟΣΤΟΛΗΣ ξαναγίνονται εδώ**: κλειστό νήμα (ΓΚΠΔ (β)) ⇒ καμία αλλαγή κειμένου·
 * σφραγισμένη γραμμή ⇒ όχι — όποιος έφυγε από την ομάδα **δεν** ξαναγράφει ό,τι είπε ως μέλος της.
 * ⚠️ **Καμία ειδοποίηση, καμία κίνηση στον κατάλογο** (δες `message-edit.ts`).
 */
export async function editNetworkMessage(
  adminDb: AdminFirestore,
  input: EditNetworkMessageInput,
): Promise<EditOutcome> {
  const revisionRef = networkRevisionRef(adminDb, generateNetworkMessageRevisionId());

  return adminDb.runTransaction<EditOutcome>(async (transaction) => {
    const { messageRef, thread, message, audience } = await readMessageSlot(transaction, adminDb, input);
    if (thread === undefined) return { kind: 'refused', reason: 'thread-absent' };
    const editor = audience.find((row) => row.uid === input.actorUid) ?? null;
    const refusal = sendRefusal(true, thread, editor);
    if (refusal !== null) return { kind: 'refused', reason: refusal };

    const verdict = judgeEdit(message, input.actorUid, input.text, MAX_NETWORK_MESSAGE_CHARS);
    if (verdict.kind !== 'allowed') return verdict;

    const found = message as NetworkMessage;
    // 🏆 «Το είχαν διαβάσει;» — για την **τρέχουσα** μορφή, όχι την αρχική: διαβασμένη αρχική και
    //    αδιάβαστη πρώτη διόρθωση σημαίνει ότι η δεύτερη διόρθωση **δεν** άλλαξε κάτι που είδαν.
    const readBefore = wasReadByOthers({ senderUid: found.senderUid, createdAt: currentVersionAt(found) }, audience);

    transaction.set(messageRef, editedMessage(found, verdict.text, input.nowISO, readBefore));
    transaction.set(
      revisionRef,
      revisionRecord(found, {
        revisionId: revisionRef.id,
        threadId: input.threadId,
        threadKind: thread.topic.kind,
        nowISO: input.nowISO,
        readBefore,
      }),
    );
    return { kind: 'edited', editedAt: input.nowISO, readBeforeEdit: readBefore };
  });
}

/**
 * **«Το είδα»** — η ώρα ανάγνωσης, ανά μέλος ακροατηρίου.
 *
 * ⚠️ **Καμία ένδειξη ανά μήνυμα** (§8 #4): μόνο `lastReadAt`. Λεπτομερέστερη πολιτική δεν
 * γράφεται πριν αποφασιστεί — μια «μισή» ένδειξη ανάγνωσης είναι υπόσχεση που η οθόνη θα
 * παρουσιάσει ως βεβαιότητα.
 */
export async function markNetworkThreadRead(
  adminDb: AdminFirestore,
  threadId: string,
  uid: string,
  nowISO: string,
): Promise<AudienceSelfOutcome> {
  return touchOwnAudience(adminDb, threadId, uid, { lastReadAt: nowISO });
}

/**
 * **Η σίγαση** — μονομερής, χωρίς ειδοποίηση του άλλου (ADR-834 (α) ②).
 *
 * 🔑 **Σίγαση ≠ φραγή**: εδώ το νήμα μένει **ανοιχτό** και τα μηνύματα **φτάνουν** — απλώς
 * δεν χτυπά το καμπανάκι. Η **φραγή** (που κλείνει νήμα και αιτήματα) ανήκει στο νήμα
 * **σχέσης** και ζει στο Β8: σε νήμα **πράξης** μια φραγή θα έκοβε τον επαγγελματικό
 * δίαυλο μιας **ζωντανής εντολής**, που κανένα (α)-(ε) δεν ζητά.
 */
export async function setNetworkThreadMuted(
  adminDb: AdminFirestore,
  threadId: string,
  uid: string,
  muted: boolean,
): Promise<AudienceSelfOutcome> {
  return touchOwnAudience(adminDb, threadId, uid, { muted });
}

/**
 * **«Ακολουθώ»** — ο συνεργάτης ζητά να ειδοποιείται σαν κύριο πρόσωπο (ADR-867 Β7 · HubSpot «Follow»).
 *
 * 🔑 **Μονομερές, όπως η σίγαση**: ο άλλος δεν μαθαίνει τίποτα, το ακροατήριο **δεν** αλλάζει (ο
 * συνεργάτης **ήδη** διαβάζει — εδώ αλλάζει μόνο αν χτυπά το καμπανάκι). Η σίγαση **νικά** (Β6: βέτο).
 * ⚠️ Τελική κατάσταση, όχι εναλλαγή (ιδεμποτησία, N.7.2 #3).
 */
export async function setNetworkThreadFollowing(
  adminDb: AdminFirestore,
  threadId: string,
  uid: string,
  following: boolean,
): Promise<AudienceSelfOutcome> {
  return touchOwnAudience(adminDb, threadId, uid, { following });
}

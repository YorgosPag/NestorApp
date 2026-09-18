/**
 * @fileoverview **Η ΑΠΟΣΤΟΛΗ, Η ΑΝΑΓΝΩΣΗ, Η ΣΙΓΑΣΗ** — οι τρεις πράξεις πάνω σε υπαρκτό νήμα.
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

import { generateNetworkMessageId } from '@/services/enterprise-id.service';
import type { NetworkMessage, NetworkThread } from '@/types/network-thread';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import {
  judgeRetraction,
  retractionRecord,
  retractionTombstone,
  wasReadByOthers,
  type RetractionRefusal,
} from './message-retraction';
import {
  networkRetractionRef,
  networkThreadMessages,
  networkThreadRef,
} from './network-thread-ref';
import { isLiveAudience } from './thread-audience';
import {
  readThreadAudience,
  touchOwnAudience,
  writeThreadActivity,
  type AudienceSelfOutcome,
} from './thread-writer';

/**
 * **Ανώτατο μήκος μηνύματος.**
 *
 * ⚠️ Δεν είναι «ασφάλεια», είναι **σχήμα**: ένα έγγραφο Firestore έχει όριο 1 MiB, και ένα
 * μήνυμα που το πλησιάζει κάνει **κάθε** ανάγνωση του νήματος ακριβή για όλους. Το όριο
 * είναι το ίδιο μέγεθος που δίνει το Slack στο μήνυμα (~4.000 χαρακτήρες) — πάνω από αυτό
 * ο άνθρωπος στέλνει **αρχείο**, και τα συνημμένα έχουν δικό τους βήμα (§8 #2, Β8β).
 */
export const MAX_NETWORK_MESSAGE_CHARS = 4000;

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
): Promise<SendOutcome> {
  const text = input.text.trim();
  if (text.length === 0) return { kind: 'refused', reason: 'empty-text' };
  if (text.length > MAX_NETWORK_MESSAGE_CHARS) return { kind: 'refused', reason: 'too-long' };

  const threadRef = networkThreadRef(adminDb, input.threadId);
  const messageId = generateNetworkMessageId();

  return adminDb.runTransaction<SendOutcome>(async (transaction) => {
    // 🔑 **ΟΛΟ** το ακροατήριο, όχι μόνο η γραμμή του αποστολέα: το fan-out χρειάζεται κάθε
    //    ζωντανό μέλος, και οι αναγνώσεις πρέπει να προηγούνται **κάθε** γραφής.
    const [threadSnap, audience] = await Promise.all([
      transaction.get(threadRef),
      readThreadAudience(transaction, adminDb, input.threadId),
    ]);
    const entry = audience.find((row) => row.uid === input.senderUid) ?? null;

    const refusal = sendRefusal(threadSnap.exists, threadSnap.data(), entry);
    if (refusal !== null) return { kind: 'refused', reason: refusal };

    transaction.set(
      networkThreadMessages(adminDb, input.threadId).doc(messageId),
      networkMessageDocument({ ...input, text }, messageId),
    );
    transaction.update(threadRef, { lastMessageAt: input.nowISO, updatedAt: input.nowISO });
    writeThreadActivity(transaction, adminDb, input.threadId, audience, {
      senderUid: input.senderUid,
      nowISO: input.nowISO,
    });

    return { kind: 'sent', messageId };
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
): Promise<RetractOutcome> {
  const threadRef = networkThreadRef(adminDb, input.threadId);
  const messageRef = networkThreadMessages(adminDb, input.threadId).doc(input.messageId);

  return adminDb.runTransaction<RetractOutcome>(async (transaction) => {
    const [threadSnap, messageSnap, audience] = await Promise.all([
      transaction.get(threadRef),
      transaction.get(messageRef),
      readThreadAudience(transaction, adminDb, input.threadId),
    ]);

    const thread = threadSnap.data() as NetworkThread | undefined;
    if (!threadSnap.exists || thread === undefined) {
      return { kind: 'refused', reason: 'thread-absent' };
    }

    const message = messageSnap.data() as NetworkMessage | undefined;
    const verdict = judgeRetraction(message, input.actorUid, input.nowISO);
    if (verdict.kind === 'refused') return { kind: 'refused', reason: verdict.reason };

    const found = message as NetworkMessage;
    const readBefore = wasReadByOthers(found, audience);

    transaction.set(messageRef, retractionTombstone(found, input.nowISO, readBefore));
    transaction.set(
      networkRetractionRef(adminDb, input.messageId),
      retractionRecord(found, {
        threadId: input.threadId,
        threadKind: thread.topic.kind,
        nowISO: input.nowISO,
        readBefore,
      }),
    );

    return { kind: 'retracted', readBeforeRetraction: readBefore };
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

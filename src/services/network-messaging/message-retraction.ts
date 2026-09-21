/**
 * @fileoverview **Η ΑΝΑΚΛΗΣΗ ΜΗΝΥΜΑΤΟΣ** — καθαρός πυρήνας, **μηδέν** I/O.
 * @related ADR-867 §4.1 · ADR-834 §5 Β (β) ③ *(τεκμήριο)* · XMPP **XEP-0424** *(το πρότυπο)*
 * @module services/network-messaging/message-retraction
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 Η ΑΡΧΗ, ΑΠΟ ΤΟ ΠΡΟΤΥΠΟ: **Η ΑΝΑΚΛΗΣΗ ΕΙΝΑΙ ΓΕΓΟΝΟΣ, ΟΧΙ ΜΕΤΑΛΛΑΞΗ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το **XEP-0424** (Message Retraction) μοντελοποιεί την ανάκληση ως **ξεχωριστό
 * γεγονός που αναφέρεται** στο μήνυμα — ποτέ ως αλλαγή του. Και ορίζει ρητά ότι
 * *«the archiving service **MUST store** the retraction message»*: το γεγονός **δεν**
 * επιτρέπεται να χαθεί, όποια κι αν είναι η πολιτική για το σώμα.
 *
 * ⇒ Εδώ αυτό γίνεται **δύο έγγραφα**, σε **δύο** τόπους με **δύο** κανόνες:
 *   1. **ταφόπλακα** στο ίδιο μήνυμα — ίδιο id, ίδιο `createdAt`, **άδειο** σώμα
 *      *(ώστε να μη μετακινηθούν σειρά, δείκτες ανάγνωσης και σελιδοποίηση)*
 *   2. **αντίγραφο συμμόρφωσης** στο `network_message_retractions` — **κλειστό σε
 *      κάθε πελάτη**, ακριβώς όπως το `SubstrateHolds` του Microsoft Teams
 *      *(«one copy for compliance purposes, one for end-user access»)*
 *
 * 🏆 **ΚΑΙ ΕΝΑ ΤΡΙΤΟ ΠΡΑΓΜΑ ΠΟΥ ΔΕΝ ΚΑΝΕΙ ΚΑΝΕΙΣ**: η ταφόπλακα λέει **αν το
 * πρόλαβε ο άλλος**. Το μετρημένο κενό του WhatsApp είναι ότι ο αποστολέας δεν
 * μαθαίνει ποτέ αν ο παραλήπτης είχε ήδη δει το μήνυμα — οπότε «το ανακάλεσα»
 * σημαίνει *«ελπίζω»*. Εμείς το **ξέρουμε** (`lastReadAt` ανά μέλος ακροατηρίου),
 * και σε επαγγελματικό εργαλείο η διαφορά είναι μια λάθος τιμή που ο πελάτης
 * **είδε** έναντι μιας που **δεν είδε**.
 */

import type {
  NetworkAudienceSeat,
  NetworkMessage,
  NetworkMessageRetraction,
  NetworkThreadKind,
} from '@/types/network-thread';

/**
 * **Το παράθυρο ανάκλησης — 60 λεπτά, και ο αριθμός είναι απόφαση.**
 *
 * | Πρότυπο | Παράθυρο | Γιατί όχι εδώ |
 * |---|---|---|
 * | Gmail «Undo send» | 30 δευτ. | δεν καλύπτει ανθρώπινο λάθος που το βλέπεις σε 5′ |
 * | WhatsApp | ~60 ώρες | καταναλωτικό· **δεν** υπάρχει τεκμήριο να προστατευθεί |
 * | Slack / Teams | **απεριόριστο** | σε νήμα που είναι **τεκμήριο**, «απεριόριστο» σημαίνει «ξαναγράφω την ιστορία» |
 *
 * ⇒ **60 λεπτά**: αρκετά για «έστειλα λάθος τιμή και το κατάλαβα», πολύ λίγα για
 * αναθεώρηση ιστορίας. Το επαγγελματικά σωστό μετά από αυτό **δεν** είναι σβήσιμο —
 * είναι **διόρθωση** με νέο μήνυμα (πρότυπο Procore *RFI Revisions*: η παλιά έκδοση
 * **κλειδώνει** και μένει ορατή, δεν εξαφανίζεται).
 *
 * 🔑 **ΔΙΑΦΗΜΙΖΕΤΑΙ, ΔΕΝ ΚΡΥΒΕΤΑΙ** (XEP-0424: *«SHOULD determine whether any involved
 * entity advertises a retraction time limit»*). Η οθόνη του Β7 το δείχνει **πριν** πατήσει
 * ο άνθρωπος — οι μεγάλοι το μαθαίνεις όταν αποτύχει.
 */
export const RETRACTION_WINDOW_MINUTES = 60;

const MINUTE_MS = 60_000;

export type RetractionRefusal =
  | 'message-absent'
  | 'not-sender'
  | 'already-retracted'
  | 'window-expired';

export type RetractionVerdict =
  | { readonly kind: 'allowed' }
  | { readonly kind: 'refused'; readonly reason: RetractionRefusal };

const ALLOWED: RetractionVerdict = { kind: 'allowed' };

/**
 * **Ο κριτής** — «επιτρέπεται να ανακληθεί αυτό, από αυτόν, τώρα;»
 *
 * ⚠️ **ΜΟΝΟ Ο ΑΠΟΣΤΟΛΕΑΣ**, και είναι κανόνας του προτύπου, όχι προτίμηση: το XEP-0424
 * απαιτεί ρητά η ανάκληση να έρχεται από **την ίδια ταυτότητα** με το μήνυμα. Ένας
 * διαχειριστής που σβήνει τα λόγια **άλλου** δεν κάνει ανάκληση — κάνει λογοκρισία, και
 * είναι διαφορετική πράξη με διαφορετική απόφαση (δεν υπάρχει, και δεν γράφεται σιωπηλά).
 */
export function judgeRetraction(
  message: Pick<NetworkMessage, 'senderUid' | 'createdAt' | 'retractedAt'> | null | undefined,
  actorUid: string,
  nowISO: string,
): RetractionVerdict {
  if (message === null || message === undefined) {
    return { kind: 'refused', reason: 'message-absent' };
  }
  if (message.senderUid !== actorUid) return { kind: 'refused', reason: 'not-sender' };
  if (message.retractedAt !== null) return { kind: 'refused', reason: 'already-retracted' };
  if (isOutsideWindow(message.createdAt, nowISO)) {
    return { kind: 'refused', reason: 'window-expired' };
  }
  return ALLOWED;
}

/**
 * **Πέρασε το παράθυρο;**
 *
 * ⚠️ **Μη έγκυρη ημερομηνία ⇒ ΕΚΤΟΣ παραθύρου** — ποτέ «επιτρέπεται επειδή δεν
 * κατάλαβα». Ένα `NaN` σε σύγκριση δίνει `false` σε **κάθε** τελεστή, οπότε ένας
 * αφελής έλεγχος `diff <= limit` θα **άνοιγε** το παράθυρο στα χαλασμένα δεδομένα.
 */
export function isOutsideWindow(createdAt: string, nowISO: string): boolean {
  const created = Date.parse(createdAt);
  const now = Date.parse(nowISO);
  if (Number.isNaN(created) || Number.isNaN(now)) return true;
  return now - created > RETRACTION_WINDOW_MINUTES * MINUTE_MS;
}

/**
 * 🏆 **ΤΟ ΠΡΟΛΑΒΕ ΚΑΠΟΙΟΣ;** — η ερώτηση που κανένας μεγάλος δεν απαντά.
 *
 * `true` αν **οποιοδήποτε άλλο** μέλος του ακροατηρίου είχε `lastReadAt` **ίσο ή
 * μεταγενέστερο** της στιγμής του μηνύματος.
 *
 * ⚠️ **Ο ίδιος ο αποστολέας δεν μετράει**: ότι διάβασε τα δικά του λόγια δεν λέει
 * τίποτα σε κανέναν. ⚠️ Και μετράνε **και τα σφραγισμένα** μέλη: κάποιος που έφυγε
 * από την ομάδα **αφού** το διάβασε, **το διάβασε** — η σφραγίδα αφαιρεί μελλοντική
 * πρόσβαση, δεν ξεγράφει το παρελθόν.
 *
 * 🔑 Λεξικογραφική σύγκριση ISO: σταθερού πλάτους σε UTC ⇒ αλφαβητική = χρονολογική
 * (ίδιο ιδίωμα με τον `FakeFirestore` και με κάθε ερώτημα εύρους του έργου).
 */
export function wasReadByOthers(
  message: Pick<NetworkMessage, 'senderUid' | 'createdAt'>,
  audience: readonly Pick<NetworkAudienceSeat, 'uid' | 'lastReadAt'>[],
): boolean {
  return audience.some(
    (entry) =>
      entry.uid !== message.senderUid &&
      entry.lastReadAt !== null &&
      entry.lastReadAt >= message.createdAt,
  );
}

/**
 * **Η ταφόπλακα** — ό,τι μένει να διαβάσει ο πελάτης.
 *
 * ⚠️ `text: ''` και **όχι** διαγραφή εγγράφου: το κενό σώμα κρατά τη **θέση** στο νήμα.
 * Ένα σβησμένο έγγραφο θα μετακινούσε δείκτες ανάγνωσης και σελιδοποίηση, και θα έκανε
 * τη συνομιλία να «λείπει» αντί να λέει ότι κάτι ανακλήθηκε.
 */
export function retractionTombstone(
  message: NetworkMessage,
  nowISO: string,
  readBefore: boolean,
): NetworkMessage {
  return {
    ...message,
    text: '',
    retractedAt: nowISO,
    readBeforeRetraction: readBefore,
  };
}

/** **Το αντίγραφο συμμόρφωσης** — ο μόνος τόπος όπου επιβιώνει το κείμενο. */
export function retractionRecord(
  message: NetworkMessage,
  context: {
    readonly threadId: string;
    readonly threadKind: NetworkThreadKind;
    readonly nowISO: string;
    readonly readBefore: boolean;
  },
): NetworkMessageRetraction {
  return {
    id: message.id,
    threadId: context.threadId,
    threadKind: context.threadKind,
    senderUid: message.senderUid,
    // 🔑 Ταυτόσημο με το `senderUid` **εκ κατασκευής** (ο κριτής το επιβάλλει), και
    //    γράφεται χωριστά επίτηδες: αν αύριο γεννηθεί «διαγραφή από διαχειριστή», το
    //    βιβλίο θα μπορεί να πει ΠΟΙΟΣ — χωρίς μετανάστευση σχήματος.
    retractedBy: message.senderUid,
    originalText: message.text,
    originalCreatedAt: message.createdAt,
    retractedAt: context.nowISO,
    readBeforeRetraction: context.readBefore,
  };
}

/**
 * @fileoverview **Η ΕΠΕΞΕΡΓΑΣΙΑ ΜΗΝΥΜΑΤΟΣ** — καθαρός πυρήνας, **μηδέν** I/O.
 * @related ADR-867 Β7 · §4.1 (`editedAt`) · ADR-834 §5 Β (β) ③ *(τεκμήριο)* · `message-retraction.ts` *(το αδελφό)*
 * @module services/network-messaging/message-edit
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🌐 Η ΠΡΑΚΤΙΚΗ ΤΩΝ ΜΕΓΑΛΩΝ — ΑΠΟΦΑΣΗ ΤΗΣ ΕΡΕΥΝΑΣ (Giorgio: «όπως οι μεγάλοι», 2026-09-19)
 * ────────────────────────────────────────────────────────────────────────────
 * | Πλατφόρμα | Όριο | Τι βλέπει ο άλλος | Ιστορικό |
 * |---|---|---|---|
 * | Microsoft Teams | **κανένα** (προεπιλογή — ο διαχειριστής μπορεί να ορίσει) | «Edited» | αντίγραφο συμμόρφωσης |
 * | Slack | **οποτεδήποτε** (προεπιλογή — ο διαχειριστής από 1′ ως «ποτέ») | «(edited)» | «save edits and deletions» |
 * | Google Chat | κανένα τεκμηριωμένο | «Edited» | — |
 *
 * ⇒ **Χωρίς όριο χρόνου, μόνο ο αποστολέας, με ορατή ένδειξη — και ΚΑΘΕ προηγούμενη μορφή σε
 * αντίγραφο συμμόρφωσης** (`network_message_revisions`, κλειστό σε κάθε πελάτη).
 *
 * 🏆 **ΠΟΥ ΞΕΠΕΡΝΑΜΕ**: κανείς από τους τρεις δεν λέει στον αναγνώστη **ότι άλλαξε κάτι που είχε ήδη
 * διαβάσει**. Εδώ το `readBeforeEdit` (ίδιο με το `readBeforeRetraction`) το λέει — ο μεσίτης που
 * διόρθωσε την τιμή **αφού** την είδε ο ιδιοκτήτης δεν μπορεί να το παρουσιάσει ως τυπογραφικό.
 *
 * ⚠️ **Η επεξεργασία ΔΕΝ ειδοποιεί** (Slack/Teams: η διόρθωση δεν είναι νέο μήνυμα) και **δεν** κινεί το
 * νήμα στον κατάλογο (`threadActivityAt` μένει). ⛔ Ανακληθέν μήνυμα **δεν** επεξεργάζεται: η ταφόπλακα
 * είναι τελική (XEP-0424).
 */

import type {
  NetworkMessage,
  NetworkMessageRevision,
  NetworkThreadKind,
} from '@/types/network-thread';

export type EditRefusal =
  | 'message-absent'
  | 'not-sender'
  | 'already-retracted'
  | 'empty-text'
  | 'too-long';

export type EditVerdict =
  | { readonly kind: 'allowed'; readonly text: string }
  /** Το ίδιο κείμενο ⇒ **καμία** γραφή: η επανάληψη ενός αιτήματος δεν γεννά ψεύτικη αναθεώρηση. */
  | { readonly kind: 'unchanged' }
  | { readonly kind: 'refused'; readonly reason: EditRefusal };

/**
 * **Ο κριτής** — «επιτρέπεται αυτή η διόρθωση, από αυτόν;» Το μήκος κρίνεται με το **ίδιο** όριο με την
 * αποστολή (`maxChars` από τον γραφέα — **ένας** κανόνας για κάθε δρόμο που γράφει κείμενο).
 */
export function judgeEdit(
  message: Pick<NetworkMessage, 'senderUid' | 'text' | 'retractedAt'> | null | undefined,
  actorUid: string,
  rawText: string,
  maxChars: number,
): EditVerdict {
  if (message === null || message === undefined) return { kind: 'refused', reason: 'message-absent' };
  if (message.senderUid !== actorUid) return { kind: 'refused', reason: 'not-sender' };
  if (message.retractedAt !== null) return { kind: 'refused', reason: 'already-retracted' };
  const text = rawText.trim();
  // ⚠️ Άδειο ⇒ άρνηση, ΟΧΙ «σβήσιμο»: για να πάρεις πίσω τα λόγια σου υπάρχει η ανάκληση, με
  //    το δικό της παράθυρο και την ειλικρινή ταφόπλακα. Άδεια επεξεργασία θα την παρέκαμπτε.
  if (text.length === 0) return { kind: 'refused', reason: 'empty-text' };
  if (text.length > maxChars) return { kind: 'refused', reason: 'too-long' };
  if (text === message.text) return { kind: 'unchanged' };
  return { kind: 'allowed', text };
}

/** Η **τρέχουσα** μορφή γράφτηκε τότε — η αρχική, ή η τελευταία επεξεργασία. */
export function currentVersionAt(message: Pick<NetworkMessage, 'createdAt' | 'editedAt'>): string {
  return message.editedAt ?? message.createdAt;
}

/** Το μήνυμα **μετά** την επεξεργασία — ίδια θέση, ίδιο `createdAt`, νέο σώμα. */
export function editedMessage(
  message: NetworkMessage,
  text: string,
  nowISO: string,
  readBefore: boolean,
): NetworkMessage {
  return { ...message, text, editedAt: nowISO, readBeforeEdit: readBefore };
}

/** **Το αντίγραφο συμμόρφωσης** — η μορφή που αντικαταστάθηκε. */
export function revisionRecord(
  message: NetworkMessage,
  context: {
    readonly revisionId: string;
    readonly threadId: string;
    readonly threadKind: NetworkThreadKind;
    readonly nowISO: string;
    readonly readBefore: boolean;
  },
): NetworkMessageRevision {
  return {
    id: context.revisionId,
    messageId: message.id,
    threadId: context.threadId,
    threadKind: context.threadKind,
    senderUid: message.senderUid,
    previousText: message.text,
    previousAt: currentVersionAt(message),
    replacedAt: context.nowISO,
    readBeforeEdit: context.readBefore,
  };
}

/**
 * @fileoverview **ΤΟ ΧΡΟΝΟΛΟΓΙΟ ΤΟΥ ΝΗΜΑΤΟΣ** — καθαρός πυρήνας της οθόνης, **μηδέν** I/O, **μηδέν** React.
 * @related ADR-867 Β7 · §8 #4 (μόνο `lastReadAt` ανά μέλος) · `services/network-messaging/message-retraction.ts`
 * @module lib/network-messaging/thread-timeline
 *
 * 🔑 **Η ΟΘΟΝΗ ΔΕΝ ΑΠΟΦΑΣΙΖΕΙ ΤΙΠΟΤΑ ΑΠΟ ΑΥΤΑ** — τα παίρνει έτοιμα από εδώ:
 * ① πού μπαίνει η γραμμή **«νέα μηνύματα»** (Teams / Slack: ακριβώς πάνω από το πρώτο αδιάβαστο),
 * ② πού αλλάζει η **ημέρα**, ③ ποιο μήνυμα **συνεχίζει** το προηγούμενο (ίδιος αποστολέας, λίγα λεπτά —
 * η κεφαλίδα δεν επαναλαμβάνεται), ④ τι επιτρέπεται στο **δικό μου** μήνυμα και για πόσο ακόμη.
 *
 * ⚠️ **Η γραμμή «νέα μηνύματα» ΑΓΚΥΡΩΝΕΤΑΙ ΣΤΟ ΑΝΟΙΓΜΑ** (`anchorReadAt`), όχι στο ζωντανό
 * `lastReadAt`: μόλις ανοίξει το νήμα, το «το είδα» ανεβάζει το `lastReadAt` — αν η γραμμή το
 * ακολουθούσε, θα **εξαφανιζόταν κάτω από τα μάτια** του ανθρώπου πριν διαβάσει. Ο καλών κρατά την
 * άγκυρα όσο το νήμα μένει ανοιχτό.
 *
 * ⛔ **Καμία ένδειξη ανάγνωσης ανά μήνυμα** (§8 #4): εδώ μετράει **μόνο** το δικό μου `lastReadAt`.
 */

import { RETRACTION_WINDOW_MINUTES } from '@/services/network-messaging/message-retraction';
import type { NetworkMessage } from '@/types/network-thread';

/** Ίδιος αποστολέας μέσα σε τόσα λεπτά ⇒ **συνέχεια**, χωρίς νέα κεφαλίδα (το σχήμα του Slack). */
export const CONTINUATION_WINDOW_MINUTES = 5;

const MINUTE_MS = 60_000;

/** Τι μπορώ να κάνω **εγώ** σε αυτό το μήνυμα, **τώρα**. */
export interface MessageAffordances {
  /** Λεπτά που απομένουν για ανάκληση (≥1) — `null` ⇒ δεν επιτρέπεται. Διαφημίζεται **πριν** το πάτημα. */
  readonly retractMinutesLeft: number | null;
  /** Επεξεργασία: **μόνο** ο αποστολέας, **χωρίς** όριο χρόνου (Teams · Slack · Google Chat), όχι σε ταφόπλακα. */
  readonly canEdit: boolean;
}

export type TimelineItem =
  | { readonly kind: 'day'; readonly dayKey: string }
  | { readonly kind: 'new-messages' }
  | {
      readonly kind: 'message';
      readonly message: NetworkMessage;
      readonly own: boolean;
      /** Συνεχίζει το προηγούμενο ⇒ η οθόνη **δεν** ξαναγράφει όνομα/ώρα. */
      readonly continuation: boolean;
      readonly affordances: MessageAffordances;
    };

export interface TimelineInput {
  /** Τα μηνύματα **σε χρονολογική σειρά** (παλαιότερο πρώτο). */
  readonly messages: readonly NetworkMessage[];
  readonly viewerUid: string;
  /** Το `lastReadAt` **τη στιγμή που άνοιξε** το νήμα — `null` ⇒ δεν έχει διαβάσει ποτέ. */
  readonly anchorReadAt: string | null;
  readonly nowISO: string;
  /** ISO ⇒ κλειδί **τοπικής** ημέρας (`YYYY-MM-DD`) — δίνεται απ' έξω, ώστε η ζώνη ώρας να μην κρύβεται εδώ. */
  readonly dayKeyOf: (iso: string) => string;
}

/**
 * **Λεπτά που απομένουν για ανάκληση** — στρογγυλεμένα **προς τα πάνω**, ώστε το «1 λεπτό» να σημαίνει
 * «ακόμη προλαβαίνεις», ποτέ «0 λεπτά» σε κουμπί που ακόμη δουλεύει. Χαλασμένη ημερομηνία ⇒ `null`
 * (ίδιο δόγμα με το `isOutsideWindow`: ποτέ «επιτρέπεται επειδή δεν κατάλαβα»).
 */
export function retractMinutesLeft(createdAt: string, nowISO: string): number | null {
  const created = Date.parse(createdAt);
  const now = Date.parse(nowISO);
  if (Number.isNaN(created) || Number.isNaN(now)) return null;
  const leftMs = created + RETRACTION_WINDOW_MINUTES * MINUTE_MS - now;
  return leftMs > 0 ? Math.ceil(leftMs / MINUTE_MS) : null;
}

/** Οι δυνατότητες του **θεατή** πάνω σε ένα μήνυμα. Ξένο ή ανακληθέν ⇒ τίποτα. */
export function affordancesOf(message: NetworkMessage, viewerUid: string, nowISO: string): MessageAffordances {
  const mine = message.senderUid === viewerUid && message.retractedAt === null;
  return {
    retractMinutesLeft: mine ? retractMinutesLeft(message.createdAt, nowISO) : null,
    canEdit: mine,
  };
}

/** **Αδιάβαστο για μένα**: ξένο, και μεταγενέστερο της άγκυρας (λεξικογραφικά ISO σε UTC = χρονολογικά). */
export function isUnreadFor(message: NetworkMessage, viewerUid: string, anchorReadAt: string | null): boolean {
  if (message.senderUid === viewerUid) return false;
  return anchorReadAt === null || message.createdAt > anchorReadAt;
}

/**
 * **Συνεχίζει το προηγούμενο;** — ίδιος αποστολέας, κανένα από τα δύο ανακληθέν, μέσα στο παράθυρο.
 * ⚠️ Μια ταφόπλακα **δεν** συνεχίζει και **δεν** συνεχίζεται: πρέπει να φαίνεται **ποιος** ανακάλεσε.
 */
export function continuesPrevious(previous: NetworkMessage | null, message: NetworkMessage): boolean {
  if (previous === null || previous.senderUid !== message.senderUid) return false;
  if (previous.retractedAt !== null || message.retractedAt !== null) return false;
  const gap = Date.parse(message.createdAt) - Date.parse(previous.createdAt);
  return !Number.isNaN(gap) && gap >= 0 && gap <= CONTINUATION_WINDOW_MINUTES * MINUTE_MS;
}

/**
 * **Ποιες εκκρεμείς αποστολές ΔΕΝ έχουν φτάσει ακόμη στο snapshot** — η φούσκα φαίνεται μόνο γι' αυτές.
 *
 * 🔑 **Είναι ΠΑΡΑΓΩΓΗ, όχι παρενέργεια του snapshot** (ADR-872 ζωντανή επαλήθευση, 2026-09-22): οι δύο
 * είσοδοι φτάνουν **σε οποιαδήποτε σειρά**. Όταν το snapshot προλάβαινε την απάντηση HTTP (listener
 * γρηγορότερος από το δίκτυο, ή επανάληψη μετά από χαμένη απάντηση), η εκκρεμής φούσκα έπαιρνε το
 * `messageId` **αφού** είχε περάσει ο μόνος έλεγχος — και έμενε **διπλή για πάντα**.
 * Επιστρέφει την **ίδια** αναφορά όταν δεν φεύγει τίποτα (σταθερή ταυτότητα για React).
 */
export function pendingNotArrived<T extends { readonly messageId: string | null }>(
  pending: readonly T[],
  live: readonly Pick<NetworkMessage, 'id'>[],
): readonly T[] {
  if (pending.every((entry) => entry.messageId === null)) return pending;
  const arrived = new Set(live.map((message) => message.id));
  const next = pending.filter((entry) => entry.messageId === null || !arrived.has(entry.messageId));
  return next.length === pending.length ? pending : next;
}

/**
 * **Το χρονολόγιο** — μηνύματα ⇒ στοιχεία οθόνης (ημέρες · γραμμή «νέα» · μηνύματα).
 *
 * 🔑 Η γραμμή «νέα» μπαίνει **μία** φορά, πριν από το **πρώτο** αδιάβαστο. Μετά από αυτήν, και μετά
 * από αλλαγή ημέρας, **κανένα** μήνυμα δεν «συνεχίζει»: η κεφαλίδα ξαναγράφεται.
 */
export function buildTimeline(input: TimelineInput): readonly TimelineItem[] {
  const items: TimelineItem[] = [];
  let previous: NetworkMessage | null = null;
  let previousDay: string | null = null;
  let dividerPlaced = false;

  for (const message of input.messages) {
    const dayKey = input.dayKeyOf(message.createdAt);
    const newDay = dayKey !== previousDay;
    if (newDay) items.push({ kind: 'day', dayKey });

    const divider = !dividerPlaced && isUnreadFor(message, input.viewerUid, input.anchorReadAt);
    if (divider) {
      items.push({ kind: 'new-messages' });
      dividerPlaced = true;
    }

    items.push({
      kind: 'message',
      message,
      own: message.senderUid === input.viewerUid,
      continuation: !newDay && !divider && continuesPrevious(previous, message),
      affordances: affordancesOf(message, input.viewerUid, input.nowISO),
    });
    previous = message;
    previousDay = dayKey;
  }
  return items;
}

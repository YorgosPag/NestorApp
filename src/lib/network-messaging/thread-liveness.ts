/**
 * @fileoverview **«ΥΠΑΡΧΕΙ ΑΚΟΜΗ ΚΑΤΙ ΝΑ ΔΙΑΒΑΣΕΙ;»** — ο ΕΝΑΣ ορισμός του αδιάβαστου (ADR-867 Β9(β) Ε10).
 * @related services/network-messaging/thread-directory.ts (κατάλογος) · network-unread-email.ts (πύλη email) ·
 *   network-notifier.ts (απόσυρση ειδοποίησης) · thread-messages.ts (ο επανυπολογισμός στην ανάκληση)
 * @module lib/network-messaging/thread-liveness
 *
 * 🔴 **ΤΟ ΚΕΝΟ (Ε10, μετρημένο 2026-09-21)**: το «αδιάβαστο» ήταν `lastMessageAt > lastReadAt`. Η ανάκληση όμως
 * **δεν** αλλάζει το `lastMessageAt` — η ταφόπλακα κρατά τη θέση της στη συνομιλία, και σωστά. Άρα μήνυμα που
 * ανακλήθηκε πριν το δει κανείς άφηνε τον παραλήπτη **αδιάβαστο**, με καμπανάκι και email για κάτι που **δεν
 * υπάρχει πια**. Και οι τρεις (κατάλογος · καμπάνα · email) ρωτούσαν «ήρθε κάτι;», ενώ η ερώτηση είναι «**υπάρχει**
 * ακόμη κάτι;».
 *
 * 🔑 **ΔΥΟ ΧΡΟΝΟΙ, ΔΥΟ ΕΡΩΤΗΣΕΙΣ**: `lastMessageAt` = «πότε κινήθηκε το νήμα» (ταξινόμηση — η ταφόπλακα **είναι**
 * κίνηση)· `lastLiveMessageAt` = «πότε γράφτηκε το τελευταίο μήνυμα που **ζει**» (αδιάβαστο). Ένα πεδίο για τα δύο
 * θα έκανε είτε το νήμα να βουλιάζει στη λίστα με κάθε ανάκληση, είτε τον παραλήπτη να μένει αδιάβαστος.
 *
 * ⚠️ «Από **άλλον**» δεν χρειάζεται δεύτερο πεδίο: όποιος στέλνει παίρνει `lastReadAt = τώρα` στην **ίδια**
 * συναλλαγή (Slack/Teams), οπότε δικό του ζωντανό μήνυμα μετά την ανάγνωσή του δεν υπάρχει.
 */

import type { NetworkAudienceSeat, NetworkThread } from '@/types/network-thread';

/**
 * Πότε γράφτηκε το τελευταίο **ζωντανό** μήνυμα. `null` ⇒ κανένα.
 * 🔁 Νήμα **προ-Ε10** (χωρίς πεδίο) ⇒ `lastMessageAt`: μέχρι την πρώτη ανάκληση τα δύο ταυτίζονταν.
 */
export function liveMessageAtOf(thread: Pick<NetworkThread, 'lastMessageAt' | 'lastLiveMessageAt'>): string | null {
  return thread.lastLiveMessageAt === undefined ? thread.lastMessageAt : thread.lastLiveMessageAt;
}

/**
 * 🔑 **Υπάρχει μήνυμα που ζει, γραμμένο μετά την τελευταία του ανάγνωση;**
 * Λεξικογραφική σύγκριση ISO σε UTC ⇒ αλφαβητική = χρονολογική (ίδιο ιδίωμα με το `wasReadByOthers`).
 */
export function hasLiveUnread(
  thread: Pick<NetworkThread, 'lastMessageAt' | 'lastLiveMessageAt'>,
  lastReadAt: string | null,
): boolean {
  const live = liveMessageAtOf(thread);
  return live !== null && (lastReadAt === null || lastReadAt < live);
}

// =============================================================================
// ΤΟ ΚΟΥΤΙ ΑΔΙΑΒΑΣΤΩΝ (ADR-867 §4.5 · Β10) — η κρίση που ΥΛΟΠΟΙΕΙΤΑΙ ως γραμμή, αντί για μετρητή
// =============================================================================

/** Ό,τι χρειάζεται η κρίση από τη θέση — δημόσια (`until`) **και** ιδιωτική πλευρά (`muted`, `lastReadAt`). */
export type InboxSeatFacts = Pick<NetworkAudienceSeat, 'uid' | 'until' | 'muted' | 'lastReadAt'>;

/**
 * 🔑 **Μετρά αυτή η θέση στο badge «Μηνύματα»;** — ζωντανή θέση ∧ όχι σίγαση ∧ υπάρχει ζωντανό αδιάβαστο.
 *
 * Σιγασμένο νήμα **δεν** μετρά (Slack: σιγασμένο κανάλι ⇒ κανένα badge). Σφραγισμένη θέση **δεν** μετρά: ο
 * άνθρωπος δεν διαβάζει πια το νήμα, άρα δεν μπορεί και να το «διαβάσει» για να σβήσει τον αριθμό.
 */
export function seatCountsAsUnread(
  seat: Omit<InboxSeatFacts, 'uid'>,
  thread: Pick<NetworkThread, 'lastMessageAt' | 'lastLiveMessageAt'>,
): boolean {
  return seat.until === null && !seat.muted && hasLiveUnread(thread, seat.lastReadAt);
}

/**
 * Η ετυμηγορία για **μία** γραμμή του κουτιού: `liveMessageAt` ⇒ η γραμμή **υπάρχει** με αυτή την τιμή·
 * `null` ⇒ **δεν** υπάρχει. Συνάρτηση **μόνο** της αλήθειας ⇒ η γραφή που την εκτελεί είναι ιδεμποτής
 * (`set`/`delete`) χωρίς να διαβάσει την προηγούμενη κατάσταση της γραμμής.
 */
export interface InboxVerdict {
  readonly uid: string;
  readonly liveMessageAt: string | null;
}

/** Μία ετυμηγορία ανά θέση — η **ίδια** κρίση για αποστολή, ανάκληση, ανάγνωση, σίγαση και προβολή. */
export function inboxVerdictsOf(
  seats: readonly InboxSeatFacts[],
  thread: Pick<NetworkThread, 'lastMessageAt' | 'lastLiveMessageAt'>,
): readonly InboxVerdict[] {
  const live = liveMessageAtOf(thread);
  return seats.map((seat) => ({
    uid: seat.uid,
    liveMessageAt: seatCountsAsUnread(seat, thread) ? live : null,
  }));
}

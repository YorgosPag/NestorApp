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

import type { NetworkThread } from '@/types/network-thread';

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

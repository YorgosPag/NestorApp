/**
 * @fileoverview **ΤΙ ΣΗΜΑΙΝΕΙ Η ΚΑΤΑΣΤΑΣΗ ΜΙΑΣ ΕΙΔΟΠΟΙΗΣΗΣ** — ένας κριτής για το κουδούνι, το συρτάρι και τη σελίδα
 * ειδοποιήσεων (ADR-867 Β9(β) Ε10).
 * @related types/notification.ts (`DeliveryState`) · stores/notificationCenter.ts · NotificationDrawer.enterprise.tsx ·
 *   crm/notifications/NotificationInbox.tsx · server/notifications/notification-withdraw.ts
 * @module lib/notifications/notification-state
 *
 * 🔴 **ΤΕΣΣΕΡΙΣ ΔΙΑΤΥΠΩΣΕΙΣ, ΔΥΟ ΑΠΑΝΤΗΣΕΙΣ** (μετρημένο 2026-09-21): το κουδούνι μετρούσε αδιάβαστο το
 * `state !== 'seen'`, ενώ το συρτάρι έβαφε αδιάβαστο το `!== 'seen' && !== 'acted'` — μια ειδοποίηση με ενέργεια
 * μετρούσε στο σήμα αλλά φαινόταν διαβασμένη στη λίστα. Και η απόκρυψη (`dismissed`) ζούσε σε **ένα** σημείο με
 * γραμμένο το όνομα. Η απόσυρση (`withdrawn`) θα γινόταν πέμπτη διατύπωση· αντί γι' αυτό, οι τέσσερις ρωτούν εδώ.
 */

import type { DeliveryState } from '@/types/notification';

/**
 * Καταστάσεις που **δεν εμφανίζονται** στη λίστα και **δεν μετρούν** στο σήμα:
 * `dismissed` = την έκρυψε ο **άνθρωπος** · `withdrawn` = την απέσυρε η **πηγή** (π.χ. ανακλήθηκε το μήνυμα
 * πριν διαβαστεί — ADR-867 Ε10). Κανένα από τα δύο δεν σβήνει το έγγραφο: το ίχνος μένει.
 */
const HIDDEN_STATES: ReadonlySet<DeliveryState> = new Set<DeliveryState>(['dismissed', 'withdrawn']);

/** Καταστάσεις όπου ο άνθρωπος **έχει ασχοληθεί** με την ειδοποίηση. */
const READ_STATES: ReadonlySet<DeliveryState> = new Set<DeliveryState>(['seen', 'acted']);

/** Μένει έξω από τη λίστα; */
export function isHiddenFromInbox(state: DeliveryState): boolean {
  return HIDDEN_STATES.has(state);
}

/** Την έχει δει/χειριστεί ο άνθρωπος; */
export function isNotificationRead(state: DeliveryState): boolean {
  return READ_STATES.has(state);
}

/** 🔑 **Μετρά στο σήμα;** — ούτε διαβασμένη, ούτε κρυμμένη. Η ΜΙΑ ερώτηση του κουδουνιού. */
export function isNotificationUnread(state: DeliveryState): boolean {
  return !isNotificationRead(state) && !isHiddenFromInbox(state);
}

/**
 * 🔑 **Το ΕΝΑ σχήμα του «διαβάστηκε»** (ADR-848 · ADR-939 §6.1 6Γ): `delivery.state = 'seen'` + `seenAt` (ώρα
 * διακομιστή). Το γράφουν **και** ο πελάτης (`notificationService.markNotificationsAsRead`) **και** ο διακομιστής
 * (`server/notifications/notification-read.ts` — ack · `/n/{id}`). Ως 2026-11-13 ο διακομιστής έγραφε `seen: true`,
 * που **κανένας** αναγνώστης του κουδουνιού δεν διάβαζε ⇒ ειδοποίηση ανοιγμένη από το email έμενε «αδιάβαστη».
 */
export const SEEN_DELIVERY_STATE = 'seen' as const satisfies DeliveryState;

/**
 * **Επιτρέπεται η μετάβαση σε «διαβάστηκε»;** — μόνο από **αδιάβαστη** κατάσταση. Ποτέ υποβάθμιση του `acted`
 * σε `seen`, ποτέ αναβίωση `dismissed`/`withdrawn` από ένα άνοιγμα. Η ΜΙΑ κρίση και για τους δύο γραφείς.
 */
export function canMarkSeen(state: DeliveryState): boolean {
  return isNotificationUnread(state);
}

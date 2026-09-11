/**
 * @fileoverview **Ο μόνιμος σύνδεσμος μιας ειδοποίησης** — `/n/{id}` (ADR-848).
 * @module lib/notifications/notification-permalink-route
 *
 * 🔑 **Γιατί μόνιμος σύνδεσμος και όχι ο προορισμός κατευθείαν μέσα στο email**:
 * ένα email ζει **χρόνια** στο γραμματοκιβώτιο· οι διαδρομές της εφαρμογής όχι. Το
 * `/n/{id}` διαβάζει τον προορισμό από την ειδοποίηση **τη στιγμή του κλικ**, άρα
 * ένα παλιό email συνεχίζει να ανοίγει το σωστό πράγμα και όταν αλλάξει το σχήμα
 * των διαδρομών — ίδια ιδέα με το `app_redirect` του Slack.
 *
 * ⚠️ **Καθαρό κείμενο, ΟΧΙ `typedHref`**: ο καταναλωτής είναι ο **διακομιστής**
 * (φάκελος email, ανακατεύθυνση σύνδεσης), ποτέ το σύνορο πλοήγησης του πελάτη.
 * Και το `/n` είναι **εκτός χώρου** (`OUTSIDE_WORKSPACE`), άρα κανένα πρόθεμα.
 */

/** Το κορυφαίο τμήμα — **ένα**, για τη διαδρομή, το `OUTSIDE_WORKSPACE` και τα email. */
export const NOTIFICATION_PERMALINK_SEGMENT = 'n' as const;

/**
 * **Από ποιο κανάλι πατήθηκε ο σύνδεσμος** (ADR-849 Β1).
 *
 * 🔑 Το κουδούνι περνά **από τον ίδιο** μόνιμο σύνδεσμο με το email — όπως το
 * `app_redirect` του Slack είναι η **μία** πόρτα κάθε πελάτη του. Έτσι ο χώρος-στόχος
 * λύνεται σε **ένα** σημείο, στον διακομιστή (το ψευδώνυμο το λύνει **μόνο** αυτός —
 * άγκυρα `Λ2`). Το κανάλι είναι **μόνο ετικέτα** του «ανοίχτηκε από»: δεν αλλάζει ούτε
 * τον προορισμό ούτε την άδεια.
 */
const PERMALINK_CHANNELS = ['email', 'inapp'] as const;
export type PermalinkChannel = (typeof PERMALINK_CHANNELS)[number];

/** Η παράμετρος του καναλιού. Το email **δεν** τη γράφει — κάθε σταλμένο email μένει ίδιο. */
export const PERMALINK_CHANNEL_PARAM = 'via' as const;

/**
 * `/n/<id>` — με `encodeURIComponent`, γιατί οι ταυτότητες ειδοποιήσεων είναι
 * `συμβάν:παραλήπτης:γεγονός` και τα `:` έρχονται από **δεδομένα**.
 */
export function notificationPermalinkHref(
  notificationId: string,
  channel: PermalinkChannel = 'email',
): string {
  const path = `/${NOTIFICATION_PERMALINK_SEGMENT}/${encodeURIComponent(notificationId)}`;
  return channel === 'email' ? path : `${path}?${PERMALINK_CHANNEL_PARAM}=${channel}`;
}

/**
 * Το κανάλι από την παράμετρο — ό,τι άγνωστο (ή λείπει) είναι `email`, το κανάλι του
 * σκέτου συνδέσμου. Ετικέτα, όχι απόφαση: μια πλαστή τιμή αλλάζει μόνο το «ανοίχτηκε από».
 */
export function permalinkChannelOf(value: unknown): PermalinkChannel {
  return (PERMALINK_CHANNELS as readonly unknown[]).includes(value)
    ? (value as PermalinkChannel)
    : 'email';
}

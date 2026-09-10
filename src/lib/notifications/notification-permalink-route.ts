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
 * `/n/<id>` — με `encodeURIComponent`, γιατί οι ταυτότητες ειδοποιήσεων είναι
 * `συμβάν:παραλήπτης:γεγονός` και τα `:` έρχονται από **δεδομένα**.
 */
export function notificationPermalinkHref(notificationId: string): string {
  return `/${NOTIFICATION_PERMALINK_SEGMENT}/${encodeURIComponent(notificationId)}`;
}

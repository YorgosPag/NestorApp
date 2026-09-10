/**
 * @fileoverview **Οι διευθύνσεις της διαγραφής από τα email** (ADR-848, RFC 8058).
 * @module lib/notifications/email-subscription-routes
 *
 * 🔑 **ΔΥΟ διευθύνσεις, επίτηδες, για δύο διαφορετικούς αναγνώστες:**
 *
 * | Διεύθυνση | Ποιος την ανοίγει | Τι κάνει |
 * |---|---|---|
 * | `/email/preferences/<token>` | **Άνθρωπος** (σύνδεσμος στο υποσέλιδο) | **Ρωτά** — δείχνει επιλογές, αλλάζει μόνο με POST |
 * | `POST /api/notifications/email/subscription?t=<token>` | **Πρόγραμμα email** (κεφαλίδα `List-Unsubscribe`) | **Εκτελεί** — RFC 8058 one-click |
 *
 * ⚠️ **Κανένα από τα δύο δεν αλλάζει τίποτα σε GET.** Οι σαρωτές συνδέσμων (Microsoft
 * Safe Links, antivirus πύλες) **ανοίγουν** κάθε GET πριν τον άνθρωπο — ένα
 * «κατάργηση σε GET» θα διέγραφε ανθρώπους που δεν πάτησαν ποτέ τίποτα.
 */

/** Το κορυφαίο τμήμα της σελίδας — ένα, για τη διαδρομή και το `OUTSIDE_WORKSPACE`. */
export const EMAIL_PREFERENCES_SEGMENT = 'email' as const;

/**
 * Το endpoint του one-click. **Εξάγεται** ώστε το middleware (εξαίρεση από το
 * μπλοκάρισμα bot) και το όριο ρυθμού να δείχνουν στο **ίδιο** κείμενο — ένα
 * τυπογραφικό λάθος στο ένα από τα τρία θα έκοβε σιωπηλά το Gmail.
 */
export const EMAIL_SUBSCRIPTION_API = '/api/notifications/email/subscription' as const;

/** Η παράμετρος του token στο endpoint. */
export const EMAIL_SUBSCRIPTION_TOKEN_PARAM = 't' as const;

/** Η σελίδα προτιμήσεων — για άνθρωπο. */
export function emailPreferencesHref(token: string): string {
  return `/${EMAIL_PREFERENCES_SEGMENT}/preferences/${encodeURIComponent(token)}`;
}

/** Ο στόχος της κεφαλίδας `List-Unsubscribe` — για το πρόγραμμα email. */
export function emailOneClickHref(token: string): string {
  const query = new URLSearchParams({ [EMAIL_SUBSCRIPTION_TOKEN_PARAM]: token }).toString();
  return `${EMAIL_SUBSCRIPTION_API}?${query}`;
}

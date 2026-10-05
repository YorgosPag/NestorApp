// ⚠️ GENERATED — DO NOT EDIT. Verbatim projection of src/lib/webhooks/internal-webhook-delivery.ts (ADR-874 · CHECK 3.93).
// Edit the source, then run: npm run generate:functions-projection
// sha256:1425c2ffdb3994bb043629b17a24f9f30823c71131a6788675888129a0d3aeaf

/**
 * @fileoverview **ΠΑΡΑΔΟΣΗ ΕΣΩΤΕΡΙΚΟΥ WEBHOOK — τι σημαίνει κάθε απάντηση για τον αποστολέα** (ADR-905 §6.4).
 * @module lib/webhooks/internal-webhook-delivery
 *
 * Η πόρτα (`server/internal-webhooks/signed-webhook-door`) διαλέγει κωδικό· ο αποστολέας (Cloud Function) πρέπει να
 * τον διαβάσει **με το ίδιο λεξικό**. Γι' αυτό το λεξικό ζει εδώ, δίπλα στην υπογραφή, και **προβάλλεται** στα
 * Functions (ADR-874 · CHECK 3.93): ένας δεύτερος αποστολέας δεν θα ξαναγράψει «ποια 4xx είναι οριστικά».
 *
 * 🔑 **«Όχι» ≠ «όχι τώρα»** (πρακτική Stripe · Svix · Hookdeck): 408 / 425 / 429 είναι 4xx που λένε *ξαναέλα* —
 * λήξη χρόνου, πρόωρο, **όριο ρυθμού**. Ο αποδέκτης στέκεται πίσω από `withWebhookRateLimit`· αν το 429 διαβαζόταν
 * ως οριστικό, μια ριπή εγγραφών θα έχανε γεγονότα **χωρίς ίχνος**. Με επανάληψη, το όριο γίνεται αντίθλιψη.
 *
 * ⏳ **Συνθήκη τερματισμού** (Google «Retry event-driven functions»: *set an end condition*): ο trigger 1ης γενιάς
 * ξαναδοκιμάζει επί **7 ημέρες**. Το ταβάνι εδώ είναι **24 ώρες = το παράθυρο ιδεμποτίας του αποδέκτη**: ως εκεί
 * κάθε επανάληψη εκτελείται **μία** φορά· πέρα από εκεί η εγγύηση δεν ισχύει, και ένα σήμα «ξαναδιάβασε» μιας
 * μέρας δεν αξίζει βρόχο. (Ίδιο παράθυρο με τους triggers 2ης γενιάς.)
 *
 * **Layering**: leaf — καμία εισαγωγή. Κανένα `@/`, κανένα `server-only` (θα έσπαγε την προβολή).
 */

/** Τι κάνει ο αποστολέας με μια απάντηση. */
export type InternalWebhookDelivery = 'delivered' | 'retry' | 'refused';

/** Τα 4xx που σημαίνουν «όχι τώρα»: Request Timeout · Too Early · Too Many Requests. */
const RETRYABLE_CLIENT_STATUSES: ReadonlySet<number> = new Set([408, 425, 429]);

/**
 * **Η κρίση της παράδοσης.** 2xx ⇒ τέλος · 4xx ⇒ οριστική άρνηση, **εκτός** από τα «όχι τώρα» · οτιδήποτε άλλο
 * (5xx, απρόσμενο) ⇒ επανάληψη — το άγνωστο δεν είναι ποτέ λόγος να χαθεί γεγονός.
 */
export function judgeInternalWebhookDelivery(status: number): InternalWebhookDelivery {
  if (status >= 200 && status < 300) return 'delivered';
  if (status >= 400 && status < 500 && !RETRYABLE_CLIENT_STATUSES.has(status)) return 'refused';
  return 'retry';
}

/** Πέρα από αυτή την ηλικία ο αποστολέας **σταματά** να ξαναδοκιμάζει. ΔΕΝ ξεπερνά το `IDEMPOTENCY_TTL_MS` (άγκυρα). */
export const INTERNAL_WEBHOOK_MAX_EVENT_AGE_SECONDS = 24 * 60 * 60;

/**
 * Έληξε το γεγονός; `eventTimestamp` = η στιγμή **δημοσίευσης** (ISO), όχι της τρέχουσας προσπάθειας.
 * Μη αναγνώσιμη στιγμή ⇒ **όχι** ληγμένο: δεν πετάμε γεγονός επειδή δεν ξέρουμε την ηλικία του.
 */
export function isInternalWebhookEventExpired(eventTimestamp: string, nowSeconds: number): boolean {
  const publishedSeconds = Date.parse(eventTimestamp) / 1000;
  if (!Number.isFinite(publishedSeconds)) return false;
  return nowSeconds - publishedSeconds > INTERNAL_WEBHOOK_MAX_EVENT_AGE_SECONDS;
}

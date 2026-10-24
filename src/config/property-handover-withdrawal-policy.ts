/**
 * @fileoverview **Η πολιτική της ειδοποίησης ανάκλησης** — πόσες φορές και πότε ξαναδοκιμάζει το δίχτυ (ADR-916 §5.19 Φ-Δ.5).
 * @related lib/property-handover/handover-withdrawal-plan.ts (η κρίση που τη διαβάζει) ·
 *          config/property-handover-invitation-policy.ts (η αδελφή πολιτική της πρόσκλησης)
 * @module config/property-handover-withdrawal-policy
 */

/**
 * Πόσα email το πολύ για **μία** ανάκληση (πρώτο + επαναλήψεις του διχτυού). Μετά, η αποτυχία γίνεται σήμα στο γραφείο
 * (`withdrawal-notice-undelivered`) — ένας άνθρωπος ενημερώνει τον αγοραστή, η μηχανή σταματά να επιμένει.
 */
export const HANDOVER_WITHDRAWAL_NOTICE_CAP = 3;

/**
 * Πόσα λεπτά μετά την ανάκληση το δίχτυ θεωρεί ένα `pending` **εγκαταλελειμμένο** (πτώση ανάμεσα σε commit και αποστολή).
 * Νωρίτερα, η πράξη του γραφείου μπορεί να στέλνει ακόμη — δεύτερη αποστολή θα ήταν διπλό email.
 */
export const HANDOVER_WITHDRAWAL_NOTICE_GRACE_MINUTES = 15;

const MINUTE_MS = 60_000;

/** Πέρασε η χάρη από τη στιγμή της ανάκλησης; — η **μία** σύγκριση, για το δίχτυ και τις άγκυρες. */
export function isHandoverWithdrawalNoticeAbandoned(withdrawnAt: string, nowValue: string): boolean {
  return Date.parse(nowValue) - Date.parse(withdrawnAt) >= HANDOVER_WITHDRAWAL_NOTICE_GRACE_MINUTES * MINUTE_MS;
}

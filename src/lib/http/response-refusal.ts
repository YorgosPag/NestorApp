/**
 * @fileoverview **Ο ΛΟΓΟΣ ΑΡΝΗΣΗΣ ΣΤΟ ΣΩΜΑ ΜΙΑΣ ΑΠΑΝΤΗΣΗΣ** — μόνο αν ανήκει σε **κλειστό** σύνολο (ADR-841 §7 Α21.21 Φάση Β).
 * @related hooks/mandate/useEmailConfirmationSend.ts · hooks/mandate/useHolidayQuestionDecision.ts ·
 *   components/mandate/ShowcaseEmailConfirmationContent.tsx
 * @module lib/http/response-refusal
 *
 * 🔴 **ΕΞΗΧΘΗ ΤΗ ΣΤΙΓΜΗ ΠΟΥ ΧΡΕΙΑΣΤΗΚΕ ΤΡΙΤΗ ΦΟΡΑ** (N.0.2). Ο κωδικός του διακομιστή γίνεται **κλειδί i18n** στην οθόνη
 * (N.11) — άρα πρέπει να είναι γνωστός. Το `ShowcaseEmailConfirmationContent` έκανε `reason as FailureReason`: ένας κωδικός
 * που πρόσθεσε αύριο ο διακομιστής θα έβγαινε **ωμό κλειδί** στον παραλήπτη. Το `useEmailConfirmationSend` το έκανε σωστά
 * (`find` πάνω στο σύνολο) — αυτό έγινε ο κανόνας.
 *
 * ⚠️ `null` σημαίνει «**δεν ξέρουμε** τι είπε» — ο καλών το ονομάζει (`unavailable`/`failed`), ποτέ άρνηση του ανθρώπου.
 *
 * **Layering**: leaf — καθαρή συνάρτηση, χωρίς I/O.
 */

/** Ο λόγος του σώματος `{ reason }`, **μόνο** αν είναι ένας από τους `known`. */
export function refusalOf<R extends string>(body: unknown, known: readonly R[]): R | null {
  if (typeof body !== 'object' || body === null) return null;
  const reason: unknown = Reflect.get(body, 'reason');
  return known.find((candidate) => candidate === reason) ?? null;
}

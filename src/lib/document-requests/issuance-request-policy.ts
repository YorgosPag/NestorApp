/**
 * =============================================================================
 * «Ζήτησε έγγραφο» στην ανάθεση έκδοσης — ο ΚΡΙΤΗΣ, κοινός σε server και client (ADR-942 Φ1)
 * =============================================================================
 *
 * Ο server τον τρέχει για να **δεχτεί** το αίτημα, ο client για να δείξει **τι** ζητείται — ίδια απάντηση και στις
 * δύο πλευρές (ίδιο σχήμα με το `lib/conveyance/document-request-policy.ts`).
 *
 * Σειρά ερωτήσεων (η πρώτη άρνηση κερδίζει):
 * 1. η ανάθεση **εκτελείται** (`accepted`); αλλιώς `case-closed`
 * 2. ο φάκελος του κατόχου **το έχει ήδη**; τότε δεν λείπει ⇒ `not-requestable`
 * 3. υπάρχει **τώρα** λογαριασμός γραφείου να το λάβει; αλλιώς `no-recipient`
 * ⇒ παραλήπτης **πάντα** ο οικοδεσπότης: ο μηχανικός δεν διαλέγει (Α29).
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, χωρίς I/O.
 *
 * @module lib/document-requests/issuance-request-policy
 */

import type { IssuanceStage } from '@/lib/document-validity/issuance-stage';
import { HOST_REQUEST_ROLE, pendingFromLog, requestedTodayByViewer } from '@/lib/document-requests/request-core';
import type {
  IssuancePendingRequest,
  IssuanceRequestItemView,
  IssuanceRequestTarget,
  IssuanceRequestView,
} from '@/types/issuance-document-request';

/** Το στάδιο όπου η ανάθεση **εκτελείται** — το ίδιο με το «ο χώρος δέχεται είσοδο» (ADR-915 §39). */
export const ISSUANCE_REQUEST_OPEN_STAGE: IssuanceStage = 'accepted';

export interface IssuanceRequestQuestion {
  readonly stage: IssuanceStage;
  readonly item: Pick<IssuanceRequestItemView, 'providedAt'>;
  /** Υπάρχει τουλάχιστον ένας λογαριασμός γραφείου που θα ειδοποιηθεί. */
  readonly hasOfficeRecipient: boolean;
}

/** Σε ποιον θα πήγαινε το αίτημα αυτού του στοιχείου τώρα — ή γιατί όχι. */
export function issuanceRequestTargetOf(question: IssuanceRequestQuestion): IssuanceRequestTarget {
  if (question.stage !== ISSUANCE_REQUEST_OPEN_STAGE) return { ok: false, refusal: 'case-closed' };
  if (question.item.providedAt !== null) return { ok: false, refusal: 'not-requestable' };
  if (!question.hasOfficeRecipient) return { ok: false, refusal: 'no-recipient' };
  return { ok: true, recipient: HOST_REQUEST_ROLE };
}

/** «Εκκρεμεί από: …» — αιτήματα **μετά** το νεότερο αρχείο· στοιχείο που υπάρχει ήδη δεν εκκρεμεί. */
export function issuancePendingOf(
  item: IssuanceRequestItemView,
  log: readonly IssuanceRequestView[],
  today: string,
): IssuancePendingRequest | null {
  if (item.providedAt !== null) return null;
  return pendingFromLog(log, item.itemId, '', today);
}

/** Τα στοιχεία που **μπορεί** να ζητήσει τώρα με ένα πάτημα («Ζήτησε όλα») — όχι όσα ζήτησε ήδη σήμερα. */
export function issuanceRequestableNow(
  items: readonly IssuanceRequestItemView[],
  targets: Readonly<Record<string, IssuanceRequestTarget>>,
  log: readonly IssuanceRequestView[],
  today: string,
): readonly IssuanceRequestItemView[] {
  return items.filter((item) => targets[item.itemId]?.ok === true && !requestedTodayByViewer(log, item.itemId, today));
}

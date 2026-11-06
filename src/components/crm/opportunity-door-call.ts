/**
 * @fileoverview **Μία μετάφραση της απάντησης των πορτών ευκαιρίας** (πεδία §3.10 · κάτοχος §3.8) σε τυποποιημένο
 * αποτέλεσμα — 409 ⇒ `conflict` · 403 ⇒ `refused` · 400 ⇒ `invalid` · οτιδήποτε άλλο ⇒ `failed`.
 * @module components/crm/opportunity-door-call
 *
 * Κάθε πόρτα δίνει ΜΟΝΟ ό,τι διαφέρει: τι κουβαλά η σύγκρουσή της (η πόρτα κατόχου τον τωρινό κάτοχο, η πόρτα πεδίων
 * τίποτα). Το `apiClient` βάζει `Idempotency-Key` και **δεν** ξαναδοκιμάζει επιχειρησιακό 409 — η σύγκρουση φτάνει εδώ
 * μία φορά, ως γεγονός.
 */

import { ApiClientError } from '@/lib/api/api-client-types';
import { errorBodyText } from './stage-move/stage-move-api';

/** Σύγκρουση χωρίς επιπλέον στοιχεία. */
export type NoConflictDetail = Readonly<Record<never, never>>;

export type OpportunityDoorResult<T, Conflict extends object = NoConflictDetail> =
  | { readonly kind: 'ok'; readonly response: T }
  /** 409 — κάποιος άλλος άλλαξε στο μεταξύ το ίδιο πράγμα· τα στοιχεία τα ορίζει η πόρτα. */
  | ({ readonly kind: 'conflict' } & Conflict)
  /** 403 — δεν σου επιτρέπεται· `ownerUid` = ποιος μπορεί. */
  | { readonly kind: 'refused'; readonly ownerUid: string | null }
  /** 400 — π.χ. ο κάτοχος δεν είναι ενεργό μέλος του χώρου (`owner_not_member`). */
  | { readonly kind: 'invalid'; readonly reason: string | null }
  | { readonly kind: 'failed' };

const HTTP_BAD_REQUEST = 400;
const HTTP_FORBIDDEN = 403;
const HTTP_CONFLICT = 409;

export const noConflictDetail = (): NoConflictDetail => ({});

export async function callOpportunityDoor<T, Conflict extends object>(
  request: () => Promise<T>,
  conflictOf: (errorBody: unknown) => Conflict,
): Promise<OpportunityDoorResult<T, Conflict>> {
  try {
    return { kind: 'ok', response: await request() };
  } catch (error) {
    if (!(error instanceof ApiClientError)) return { kind: 'failed' };
    if (error.statusCode === HTTP_CONFLICT) return { kind: 'conflict', ...conflictOf(error.errorBody) };
    if (error.statusCode === HTTP_FORBIDDEN) return { kind: 'refused', ownerUid: errorBodyText(error.errorBody, 'ownerUid') };
    if (error.statusCode === HTTP_BAD_REQUEST) return { kind: 'invalid', reason: errorBodyText(error.errorBody, 'reason') };
    return { kind: 'failed' };
  }
}

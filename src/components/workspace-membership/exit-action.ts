'use client';

/**
 * ADR-892 — **Ο ΚΟΙΝΟΣ ΚΙΝΗΤΗΡΑΣ** κάθε διαλόγου θέσης μέλους: η προεπισκόπηση **πριν** από το κουμπί και η
 * μετάφραση της πράξης σε **κλειστό** σύνολο εκβάσεων. Ένας κινητήρας για τους διαλόγους του διαχειριστή
 * (αφαίρεση · παύση · επαναφορά, Φ2/Φ2β) **και** για την αποχώρηση του ίδιου (Φ3) — δύο αντίγραφα θα
 * απέκλιναν στο πιο ευαίσθητο σημείο: «τι σημαίνει αυτή η απάντηση για τον άνθρωπο» (CHECK 3.28).
 *
 * - Η προεπισκόπηση φορτώνει **πριν** φανεί το κουμπί (§3.6): αποτυχία ⇒ `failed` με επανάληψη, **ποτέ**
 *   «άδειο» (§7 — η αποτυχία δεν παρουσιάζεται ως κάτι άλλο). Φρουρός αγώνα: παλιά απάντηση δεν γράφει ποτέ
 *   πάνω στη νέα.
 * - Η πράξη: `done` (με τα δεδομένα της απάντησης) · άρνηση με **όνομα** (409 `reason` / 404) · `failed`
 *   (503 ή δίκτυο — ασφαλής επανάληψη, ο διακομιστής είναι ιδεμποτικός).
 *
 * ⛔ Δεν κρίνει τίποτα: ο κριτής είναι ο διακομιστής, που ξανακρίνει **μέσα** στη συναλλαγή. Η προεπισκόπηση
 * είναι πληροφορία, όχι άδεια.
 *
 * @module components/workspace-membership/exit-action
 */

import { useCallback, useEffect, useState } from 'react';

import { apiClient } from '@/lib/api/enterprise-api-client';
import { apiErrorBodyOf } from '@/lib/api/api-client-types';
import { refusalOf } from '@/lib/http/response-refusal';

export type ExitPreviewState<P> =
  | { readonly kind: 'loading' }
  | { readonly kind: 'failed' }
  | { readonly kind: 'ready'; readonly preview: P };

/** Η έκβαση μιας πράξης — `R` το κλειστό σύνολο αρνήσεων του διαλόγου, `D` η απάντηση της επιτυχίας. */
export type SettledAction<R extends string, D = unknown> =
  | { readonly kind: 'done'; readonly data: D }
  | { readonly kind: 'refused'; readonly refusal: R }
  | { readonly kind: 'failed' };

/** Η άρνηση «δεν είσαι (πια) μέλος» — η 404 της διαδρομής· κοινή σε κάθε διάλογο. */
type NotAMember = 'not-a-member';

/**
 * Η πράξη → κλειστή έκβαση. `null` λόγος ⇒ «δεν ξέρουμε» ⇒ `failed`, **ποτέ** άρνηση που ο άνθρωπος δεν έκανε.
 * @param refusals Το κλειστό σύνολο που αναγνωρίζει ο διάλογος — λόγος εκτός συνόλου ⇒ `failed`.
 */
export async function settleMemberAction<R extends string, D>(
  request: () => Promise<D>,
  refusals: readonly (R | NotAMember)[],
): Promise<SettledAction<R | NotAMember, D>> {
  try {
    return { kind: 'done', data: await request() };
  } catch (cause: unknown) {
    const body = apiErrorBodyOf(cause);
    if (body?.error === 'MEMBER_NOT_FOUND') return { kind: 'refused', refusal: 'not-a-member' };
    const refusal = body?.error === 'EXIT_REFUSED' ? refusalOf(body, refusals) : null;
    return refusal === null ? { kind: 'failed' } : { kind: 'refused', refusal };
  }
}

export interface ExitPreview<P> {
  readonly previewState: ExitPreviewState<P>;
  readonly reloadPreview: () => void;
}

/** Η προεπισκόπηση — `GET url`, ξανά σε κάθε αλλαγή διεύθυνσης ή «Δοκιμάστε ξανά». */
export function useExitPreview<P>(url: string): ExitPreview<P> {
  const [previewState, setPreviewState] = useState<ExitPreviewState<P>>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    setPreviewState({ kind: 'loading' });
    apiClient
      .get<P>(url)
      .then((data) => { if (current) setPreviewState({ kind: 'ready', preview: data }); })
      .catch(() => { if (current) setPreviewState({ kind: 'failed' }); });
    return () => { current = false; };
  }, [url, attempt]);

  const reloadPreview = useCallback(() => setAttempt((n) => n + 1), []);
  return { previewState, reloadPreview };
}

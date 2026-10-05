'use client';

/**
 * ADR-901 Φ2 §5.4 — «Οι υποθέσεις μου»: οι κάρτες του επαγγελματία και η απάντησή του σε μια πρόταση.
 *
 * 🔑 **Optimistic με επαναφορά** (Gmail): «Αναλαμβάνω» ⇒ η κάρτα γίνεται αμέσως «Έχει πρόσβαση»· η απάντηση
 *    του server την **αντικαθιστά** (φέρνει και την πρόοδο του καταλόγου, που υπάρχει μόνο μετά την αποδοχή)·
 *    αποτυχία ⇒ η κάρτα **επιστρέφει** όπως ήταν και ο λόγος λέγεται με όνομα.
 * 🔑 Η αποδοχή **φέρει** τη δήλωση ιδιότητας (ADR-901 Φ4 · Ε-4) — ο τύπος δεν επιτρέπει «ναι» χωρίς αυτή.
 * 🔑 **Ανά κάρτα** «σε εξέλιξη» — δεύτερο κλικ στην ίδια κάρτα δεν στέλνει δεύτερο αίτημα.
 *
 * @module hooks/useMyCases
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchMyCases,
  respondRejectionOf,
  respondToEngagementRequest,
  type RespondRejection,
} from '@/services/conveyance/conveyance-engagement-gateway';
import { actingForAfterAccept } from '@/lib/conveyance/acting-acceptance';
import type { CaseEngagementAnswer } from '@/lib/conveyance/declared-credential';
import type { MyCaseCard } from '@/types/conveyance-case';

export type RespondOutcome = { readonly ok: true } | { readonly ok: false; readonly rejection: RespondRejection };

/** Το ίδιο σχήμα καταστάσεων με τις λίστες «τα δικά μου» (`OwnedListStatus`) — μία απόδοση, όχι δεύτερο `switch`. */
export type MyCasesList =
  | { readonly state: 'loading' }
  | { readonly state: 'error' }
  | { readonly state: 'ready'; readonly cards: readonly MyCaseCard[] };

interface UseMyCasesReturn {
  readonly list: MyCasesList;
  readonly pending: ReadonlySet<string>;
  readonly respond: (engagementId: string, answer: CaseEngagementAnswer) => Promise<RespondOutcome>;
}

/** Η κάρτα όπως θα είναι μετά την απάντηση — μέχρι να έρθει η αλήθεια του server. */
function optimisticCard(card: MyCaseCard, answer: CaseEngagementAnswer): MyCaseCard {
  return answer.decision === 'accept'
    ? {
        ...card, engagementState: 'active', verdict: 'engaged', credentialHint: null, acceptance: null,
        // §15 Γ1 — ό,τι υποσχέθηκε η προεπισκόπηση του διακομιστή· `null` αν δεν το ξέρουμε (καμία μαντεψιά).
        actingFor: actingForAfterAccept(card.acceptance, answer.actingRequest),
      }
    : { ...card, engagementState: 'declined', verdict: 'declined', acceptance: null };
}

export function useMyCases(): UseMyCasesReturn {
  const [cards, setCards] = useState<readonly MyCaseCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const inFlight = useRef(new Set<string>());

  useEffect(() => {
    let alive = true;
    fetchMyCases()
      .then((result) => { if (alive) { setCards(result.cards); setFailed(false); } })
      .catch(() => { if (alive) setFailed(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const replace = useCallback((next: MyCaseCard) => {
    setCards((current) => current.map((card) => (card.engagementId === next.engagementId ? next : card)));
  }, []);

  const respond = useCallback(async (engagementId: string, answer: CaseEngagementAnswer): Promise<RespondOutcome> => {
    const before = cards.find((card) => card.engagementId === engagementId);
    if (!before || inFlight.current.has(engagementId)) return { ok: true };
    inFlight.current.add(engagementId);
    setPending(new Set(inFlight.current));
    replace(optimisticCard(before, answer));
    try {
      replace((await respondToEngagementRequest(engagementId, answer)).card);
      return { ok: true };
    } catch (error: unknown) {
      replace(before);
      return { ok: false, rejection: respondRejectionOf(error) ?? 'unknown' };
    } finally {
      inFlight.current.delete(engagementId);
      setPending(new Set(inFlight.current));
    }
  }, [cards, replace]);

  const list: MyCasesList = loading ? { state: 'loading' } : failed ? { state: 'error' } : { state: 'ready', cards };
  return { list, pending, respond };
}

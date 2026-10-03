'use client';

/**
 * ADR-901 Φ2 — οι θέσεις επαγγελματιών μιας υπόθεσης, από την πλευρά του **οικοδεσπότη**.
 *
 * - Η αλήθεια είναι ο server: κάθε πράξη επιστρέφει τις **νέες** θέσεις (καμία δεύτερη παραγωγή στον client —
 *   ο ορισμός, ο λογαριασμός και η συναίνεση κρίνονται μόνο εκεί).
 * - **Ανά θέση** κατάσταση «σε εξέλιξη» (Gmail «Sending…»): δύο κλικ στην ίδια θέση ⇒ ένα αίτημα· άλλη θέση
 *   δεν μπλοκάρεται.
 * - Αρνήσεις **ονομασμένες** (`offerRejectionOf`) — η οθόνη λέει τι να κάνει ο άνθρωπος, όχι «απέτυχε».
 *
 * @module hooks/useCaseProfessionals
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchCaseProfessionalSlots,
  offerCaseEngagementRequest,
  offerRejectionOf,
  revokeCaseEngagementRequest,
  type OfferRejection,
} from '@/services/conveyance/conveyance-engagement-gateway';
import type { CaseProfessionalSlot } from '@/types/conveyance-case';
import type { ConsentBasis } from '@/types/engagement';
import type { LegalProfessionalRole } from '@/types/legal-contracts';

export type ProfessionalActionOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly rejection: OfferRejection | 'generic' };

interface UseCaseProfessionalsReturn {
  readonly slots: readonly CaseProfessionalSlot[];
  readonly loading: boolean;
  readonly failed: boolean;
  /** Θέσεις με πράξη σε εξέλιξη. */
  readonly pending: ReadonlySet<LegalProfessionalRole>;
  readonly offer: (role: LegalProfessionalRole, basis: ConsentBasis | null) => Promise<ProfessionalActionOutcome>;
  readonly end: (role: LegalProfessionalRole, engagementId: string) => Promise<ProfessionalActionOutcome>;
}

export function useCaseProfessionals(caseId: string): UseCaseProfessionalsReturn {
  const [slots, setSlots] = useState<readonly CaseProfessionalSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState<ReadonlySet<LegalProfessionalRole>>(new Set());
  /** Η αλήθεια «σε εξέλιξη» χωρίς να περιμένει render — δύο γρήγορα κλικ βλέπουν το ίδιο. */
  const inFlight = useRef(new Set<LegalProfessionalRole>());

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchCaseProfessionalSlots(caseId)
      .then((result) => { if (alive) { setSlots(result.slots); setFailed(false); } })
      .catch(() => { if (alive) setFailed(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [caseId]);

  const act = useCallback(async (
    role: LegalProfessionalRole,
    request: () => Promise<{ readonly slots: readonly CaseProfessionalSlot[] }>,
  ): Promise<ProfessionalActionOutcome> => {
    if (inFlight.current.has(role)) return { ok: true };
    inFlight.current.add(role);
    setPending(new Set(inFlight.current));
    try {
      setSlots((await request()).slots);
      return { ok: true };
    } catch (error: unknown) {
      return { ok: false, rejection: offerRejectionOf(error) ?? 'generic' };
    } finally {
      inFlight.current.delete(role);
      setPending(new Set(inFlight.current));
    }
  }, []);

  const offer = useCallback(
    (role: LegalProfessionalRole, basis: ConsentBasis | null) => act(role, () => offerCaseEngagementRequest(caseId, role, basis)),
    [act, caseId],
  );
  const end = useCallback(
    (role: LegalProfessionalRole, engagementId: string) => act(role, () => revokeCaseEngagementRequest(caseId, engagementId)),
    [act, caseId],
  );

  return { slots, loading, failed, pending, offer, end };
}

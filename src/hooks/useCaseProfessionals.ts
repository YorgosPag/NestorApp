'use client';

/**
 * ADR-901 Φ2 — οι θέσεις επαγγελματιών μιας υπόθεσης, από την πλευρά του **οικοδεσπότη**.
 *
 * - Η αλήθεια είναι ο server: κάθε πράξη επιστρέφει τις **νέες** θέσεις (καμία δεύτερη παραγωγή στον client —
 *   ο ορισμός, ο λογαριασμός και η συναίνεση κρίνονται μόνο εκεί).
 * - **Ανά θέση** κατάσταση «σε εξέλιξη» (Gmail «Sending…»): δύο κλικ στην ίδια θέση ⇒ ένα αίτημα· άλλη θέση
 *   δεν μπλοκάρεται.
 * - Αρνήσεις **ονομασμένες** (`offerRejectionOf`) — η οθόνη λέει τι να κάνει ο άνθρωπος, όχι «απέτυχε».
 * - ADR-901 Φ3: η ίδια `offer` στέλνει **πρόσκληση με email** όταν δεν υπάρχει λογαριασμός (και ξανά = επαναποστολή)·
 *   η έκβαση της **αποστολής** (`invited`) επιστρέφει ονομασμένη — «δεν στάλθηκε» δεν είναι σιωπή.
 * - ADR-901 §14.8: **ζωντανές** — κάθε αλλαγή συμμετοχής/πρόσκλησης σημαίνει την όψη του οικοδεσπότη· όταν η
 *   αναθεώρησή της (`viewRevision`) ανέβει, οι θέσεις ξαναδιαβάζονται **στο παρασκήνιο** (χωρίς spinner). Μια
 *   ανάγνωση που ξεκίνησε **πριν** από πράξη του ίδιου ανθρώπου δεν «πατά» ποτέ τις θέσεις που επέστρεψε η πράξη.
 *
 * @module hooks/useCaseProfessionals
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchCaseProfessionalSlots,
  offerCaseEngagementRequest,
  offerRejectionOf,
  revokeCaseEngagementRequest,
  revokeCaseInvitationRequest,
  type InvitationDelivery,
  type OfferRejection,
} from '@/services/conveyance/conveyance-engagement-gateway';
import type { CaseProfessionalSlot } from '@/types/conveyance-case';
import type { ConsentBasis } from '@/types/engagement';
import type { LegalProfessionalRole } from '@/types/legal-contracts';

export type ProfessionalActionOutcome =
  /** `invited` — μόνο όταν η πράξη έστειλε πρόσκληση με email. */
  | { readonly ok: true; readonly invited: InvitationDelivery | null }
  | { readonly ok: false; readonly rejection: OfferRejection | 'generic' };

interface UseCaseProfessionalsReturn {
  readonly slots: readonly CaseProfessionalSlot[];
  readonly loading: boolean;
  readonly failed: boolean;
  /** Θέσεις με πράξη σε εξέλιξη. */
  readonly pending: ReadonlySet<LegalProfessionalRole>;
  readonly offer: (role: LegalProfessionalRole, basis: ConsentBasis | null) => Promise<ProfessionalActionOutcome>;
  readonly end: (role: LegalProfessionalRole, engagementId: string) => Promise<ProfessionalActionOutcome>;
  readonly cancelInvitation: (role: LegalProfessionalRole) => Promise<ProfessionalActionOutcome>;
}

export function useCaseProfessionals(caseId: string, viewRevision: number): UseCaseProfessionalsReturn {
  const [slots, setSlots] = useState<readonly CaseProfessionalSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState<ReadonlySet<LegalProfessionalRole>>(new Set());
  /** Η αλήθεια «σε εξέλιξη» χωρίς να περιμένει render — δύο γρήγορα κλικ βλέπουν το ίδιο. */
  const inFlight = useRef(new Set<LegalProfessionalRole>());
  /** Αυξάνει σε κάθε απάντηση πράξης — ανάγνωση που ξεκίνησε πριν από αυτήν είναι μπαγιάτικη. */
  const epoch = useRef(0);

  useEffect(() => { setLoading(true); }, [caseId]);

  useEffect(() => {
    let alive = true;
    const startedAt = epoch.current;
    fetchCaseProfessionalSlots(caseId)
      .then((result) => { if (alive && epoch.current === startedAt) { setSlots(result.slots); setFailed(false); } })
      .catch(() => { if (alive) setFailed(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [caseId, viewRevision]);

  const act = useCallback(async (
    role: LegalProfessionalRole,
    request: () => Promise<{ readonly slots: readonly CaseProfessionalSlot[]; readonly invited?: InvitationDelivery | null }>,
  ): Promise<ProfessionalActionOutcome> => {
    if (inFlight.current.has(role)) return { ok: true, invited: null };
    inFlight.current.add(role);
    setPending(new Set(inFlight.current));
    try {
      const result = await request();
      epoch.current += 1;
      setSlots(result.slots);
      return { ok: true, invited: result.invited ?? null };
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

  const cancelInvitation = useCallback(
    (role: LegalProfessionalRole) => act(role, () => revokeCaseInvitationRequest(caseId, role)),
    [act, caseId],
  );

  return { slots, loading, failed, pending, offer, end, cancelInvitation };
}
